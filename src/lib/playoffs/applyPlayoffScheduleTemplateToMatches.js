const crypto = globalThis.crypto

export function applyPlayoffScheduleTemplateToMatches({
  matches = [],
  matchScheduleTemplate = {},
  tournamentDay = null,
  venues = [],
  gameDurationMinutes = 90,
}) {
  if (!matches.length || !matchScheduleTemplate) return matches

  const normalizedDay = normalizeTournamentDay(tournamentDay)
  const venueIds = new Set((venues || []).map(v => v.dbId || v.id))

  return matches.map(match => {
    const matchCode = match.match_code || match.matchCode || null
    if (!matchCode) return match

    const template = matchScheduleTemplate[matchCode]
    if (!template) return match

    const templateVenueId = template.venueId || null
    const templateDate =
      template.scheduledDate ||
      normalizedDay.eventDate ||
      ''

    const templateTime =
      template.scheduledTime ||
      ''

    if (!templateVenueId && !templateDate && !templateTime) {
      return match
    }

    const resolvedVenueId =
      templateVenueId && venueIds.has(templateVenueId)
        ? templateVenueId
        : templateVenueId

    const scheduledStart =
      templateDate && templateTime
        ? new Date(`${templateDate}T${templateTime}:00`).toISOString()
        : null

    const scheduledEnd =
      scheduledStart
        ? new Date(
            new Date(scheduledStart).getTime() + gameDurationMinutes * 60 * 1000
          ).toISOString()
        : null

    const localSlotId =
      scheduledStart && resolvedVenueId
        ? `template-${matchCode}-${resolvedVenueId}-${scheduledStart}`
        : (match.slot_id || match.slotId || match.time_slot_id || crypto.randomUUID())

    return {
      ...match,
      venue_id: resolvedVenueId || match.venue_id || match.venueId || null,
      venueId: resolvedVenueId || match.venue_id || match.venueId || null,
      scheduled_start: scheduledStart || match.scheduled_start || match.scheduledStart || null,
      scheduled_end: scheduledEnd || match.scheduled_end || match.scheduledEnd || null,
      slot_id: localSlotId,
      slotId: localSlotId,
      time_slot_id: localSlotId,
    }
  })
}

function normalizeTournamentDay(day) {
  return {
    eventDate: day?.eventDate || day?.event_date || '',
    startTime: day?.startTime || day?.start_time || '',
    endTime: day?.endTime || day?.end_time || '',
  }
}