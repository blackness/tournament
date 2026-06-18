const crypto = globalThis.crypto

export function schedulePlayoffRoundOneFromDay({
  playoffMatches = [],
  existingMatches = [],
  tournamentDay = null,
  playoffStartTime = '',
  venues = [],
  scheduleConfig = {},
}) {
  const warnings = []
  const normalizedDay = normalizeTournamentDay(tournamentDay)
  const currentMatches = Array.isArray(existingMatches) ? existingMatches : []

  if (!normalizedDay.eventDate) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['Select a tournament day before scheduling playoff games.'],
    }
  }

  if (!venues.length) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No venues available for playoff scheduling.'],
    }
  }

  const playableMatches = [...(playoffMatches || [])]
    .filter(match => !!match.bracket_type)
    .filter(match => !!match.team_a_id && !!match.team_b_id)
    .filter(match => !(match.slot_id || match.slotId || match.time_slot_id))
    .sort((a, b) => {
      const aRound = Number(a.round ?? 999)
      const bRound = Number(b.round ?? 999)
      if (aRound !== bRound) return aRound - bRound

      const aCode = a.match_code || ''
      const bCode = b.match_code || ''
      return aCode.localeCompare(bCode)
    })

  if (playableMatches.length === 0) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No playable unscheduled playoff matches are ready to schedule.'],
    }
  }

  const gameDurationMinutes = Number(scheduleConfig?.gameDurationMinutes ?? 90)
  const breakBetweenGamesMinutes = Number(scheduleConfig?.breakBetweenGamesMinutes ?? 30)

  const dayStartTime =
    playoffStartTime ||
    normalizedDay.startTime ||
    scheduleConfig?.startTime ||
    '09:00'

  const dayEndTime =
    normalizedDay.endTime ||
    scheduleConfig?.endTime ||
    '21:00'

  const rawCandidateSlots = buildCandidateSlotsForDay({
    eventDate: normalizedDay.eventDate,
    startTime: dayStartTime,
    endTime: dayEndTime,
    venues,
    gameDurationMinutes,
    breakBetweenGamesMinutes,
  })

  const now = Date.now()
  const candidateSlots = rawCandidateSlots.filter(slot => {
    const startMs = new Date(slot.scheduled_start).getTime()
    return Number.isFinite(startMs) && startMs >= now
  })

  if (candidateSlots.length === 0) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No future candidate slots could be generated for the selected playoff day and start time.'],
    }
  }

  const occupiedVenueTimeKeys = new Set(
    currentMatches
      .map(match => {
        const venueId = match?.venue_id || match?.venueId || match?.venue?.id || null
        const start =
          match?.scheduled_start ||
          match?.scheduledStart ||
          match?.time_slot?.scheduled_start ||
          null

        if (!venueId || !start) return null
        return `vt:${venueId}:${start}`
      })
      .filter(Boolean)
  )

  const availableSlots = candidateSlots.filter(slot => {
    const venueTimeKey = `vt:${slot.venue_id}:${slot.scheduled_start}`
    return !occupiedVenueTimeKeys.has(venueTimeKey)
  })

  if (availableSlots.length === 0) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No open venue/time capacity was found on the selected tournament day.'],
    }
  }

  const nextMatches = [...playoffMatches]
  const newGeneratedSlots = []
  let slotCursor = 0

  for (const match of playableMatches) {
    const slot = availableSlots[slotCursor]

    if (!slot) {
      warnings.push(`Not enough open slots to schedule ${match.match_code || 'a playable playoff game'}.`)
      continue
    }

    slotCursor += 1
    newGeneratedSlots.push(slot)

    const index = nextMatches.findIndex(m => m.id === match.id)
    if (index === -1) continue

    nextMatches[index] = {
      ...nextMatches[index],
      time_slot_id: slot.id,
      slot_id: slot.id,
      slotId: slot.id,
      venue_id: slot.venue_id,
      venueId: slot.venue_id,
      scheduled_start: slot.scheduled_start,
      scheduled_end: slot.scheduled_end,
    }
  }

  return {
    matches: nextMatches,
    generatedSlots: newGeneratedSlots,
    warnings,
  }
}

function buildCandidateSlotsForDay({
  eventDate,
  startTime,
  endTime,
  venues,
  gameDurationMinutes,
  breakBetweenGamesMinutes,
}) {
  const slots = []

  const dayStart = toDateTime(eventDate, startTime)
  const dayEnd = toDateTime(eventDate, endTime)

  if (!dayStart || !dayEnd || dayEnd <= dayStart) {
    console.error('[buildCandidateSlotsForDay] invalid day window', {
      eventDate,
      startTime,
      endTime,
      parsedStart: dayStart,
      parsedEnd: dayEnd,
    })
    return []
  }

  for (const venue of venues) {
    let cursor = new Date(dayStart.getTime())

    while (true) {
      const gameEnd = new Date(cursor.getTime() + gameDurationMinutes * 60 * 1000)
      if (gameEnd > dayEnd) break

      slots.push({
        id: crypto.randomUUID(),
        venue_id: venue.dbId || venue.id,
        scheduled_start: cursor.toISOString(),
        scheduled_end: gameEnd.toISOString(),
      })

      cursor = new Date(
        gameEnd.getTime() + breakBetweenGamesMinutes * 60 * 1000
      )
    }
  }

  slots.sort((a, b) => {
    const aStart = new Date(a.scheduled_start).getTime()
    const bStart = new Date(b.scheduled_start).getTime()
    if (aStart !== bStart) return aStart - bStart
    return String(a.venue_id).localeCompare(String(b.venue_id))
  })

  return slots
}

function normalizeTournamentDay(day) {
  return {
    eventDate: day?.eventDate || day?.event_date || '',
    startTime: day?.startTime || day?.start_time || '',
    endTime: day?.endTime || day?.end_time || '',
    label: day?.label || '',
  }
}

function toDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null

  const normalizedDate = String(dateStr).slice(0, 10)
  const rawTime = String(timeStr).trim()

  let normalizedTime = rawTime

  if (rawTime.includes('T')) {
    const parsed = new Date(rawTime)
    if (Number.isNaN(parsed.getTime())) return null

    const hh = String(parsed.getHours()).padStart(2, '0')
    const mm = String(parsed.getMinutes()).padStart(2, '0')
    normalizedTime = `${hh}:${mm}`
  } else {
    normalizedTime = rawTime.slice(0, 5)
  }

  const dt = new Date(`${normalizedDate}T${normalizedTime}:00`)
  if (Number.isNaN(dt.getTime())) return null

  return dt
}