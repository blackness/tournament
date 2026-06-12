const crypto = globalThis.crypto

export function schedulePlayoffRoundOneFromDay({
  playoffMatches = [],
  existingMatches = [],
  tournamentDay = null,
  venues = [],
  scheduleConfig = {},
}) {
  const warnings = []

  if (!tournamentDay?.eventDate) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['Select a tournament day before scheduling playoff round 1.'],
    }
  }

  if (!venues.length) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No venues available for playoff scheduling.'],
    }
  }

  const roundOnePlayable = [...(playoffMatches || [])]
    .filter(match => Number(match.round ?? 0) === 1)
    .filter(match => !!match.bracket_type)
    .filter(match => !!match.team_a_id && !!match.team_b_id)
    .filter(match => !(match.slot_id || match.slotId || match.time_slot_id))
    .sort((a, b) => {
      const aCode = a.match_code || ''
      const bCode = b.match_code || ''
      return aCode.localeCompare(bCode)
    })

  if (roundOnePlayable.length === 0) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No finalized round 1 playoff matches are ready to schedule.'],
    }
  }

  const gameDurationMinutes = Number(scheduleConfig?.gameDurationMinutes ?? 90)
  const breakBetweenGamesMinutes = Number(scheduleConfig?.breakBetweenGamesMinutes ?? 30)

  const dayStartTime =
    tournamentDay.startTime ||
    scheduleConfig?.startTime ||
    '09:00'

  const dayEndTime =
    tournamentDay.endTime ||
    scheduleConfig?.endTime ||
    '21:00'

  const candidateSlots = buildCandidateSlotsForDay({
    eventDate: tournamentDay.eventDate,
    startTime: dayStartTime,
    endTime: dayEndTime,
    venues,
    gameDurationMinutes,
    breakBetweenGamesMinutes,
  })

  if (candidateSlots.length === 0) {
    return {
      matches: playoffMatches,
      generatedSlots: [],
      warnings: ['No candidate slots could be generated for the selected tournament day.'],
    }
  }

  const occupiedSlotKeys = new Set(
    (existingMatches || [])
      .filter(m => !!(m.time_slot_id || m.slot_id || m.slotId))
      .map(m => {
        const slotId = m.time_slot_id || m.slot_id || m.slotId
        return `slot:${slotId}`
      })
  )

  const occupiedVenueTimeKeys = new Set(
    (existingMatches || [])
      .filter(m => !!m.venue_id || !!m.venueId)
      .map(m => {
        const venueId = m.venue_id || m.venueId || null
        const start = m.scheduled_start || m.scheduledStart || null
        if (!venueId || !start) return null
        return `vt:${venueId}:${start}`
      })
      .filter(Boolean)
  )

  const availableSlots = candidateSlots.filter(slot => {
    const slotKey = `slot:${slot.id}`
    const venueTimeKey = `vt:${slot.venue_id}:${slot.scheduled_start}`

    if (occupiedSlotKeys.has(slotKey)) return false
    if (occupiedVenueTimeKeys.has(venueTimeKey)) return false
    return true
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

  for (const match of roundOnePlayable) {
    const slot = availableSlots[slotCursor]

    if (!slot) {
      warnings.push(`Not enough open slots to schedule ${match.match_code || 'a playoff game'}.`)
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

function toDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  return new Date(`${dateStr}T${timeStr}:00`)
}