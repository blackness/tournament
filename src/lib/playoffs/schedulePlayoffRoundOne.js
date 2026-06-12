export function schedulePlayoffRoundOne({
  playoffMatches = [],
  existingMatches = [],
  slots = [],
}) {
  const usedSlotIds = new Set(
    [...(existingMatches || []), ...(playoffMatches || [])]
      .map(m => m.slot_id || m.slotId || m.time_slot_id || null)
      .filter(Boolean)
  )

  const availableSlots = [...(slots || [])]
    .filter(slot => !usedSlotIds.has(slot.id))
    .sort((a, b) => {
      const aStart = new Date(a.scheduled_start).getTime()
      const bStart = new Date(b.scheduled_start).getTime()
      return aStart - bStart
    })

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

  const warnings = []

  if (roundOnePlayable.length === 0) {
    return {
      matches: playoffMatches,
      warnings: ['No finalized round 1 playoff matches are ready to schedule.'],
    }
  }

  if (availableSlots.length === 0) {
    return {
      matches: playoffMatches,
      warnings: ['No available time slots found for playoff scheduling.'],
    }
  }

  const nextMatches = [...playoffMatches]

  for (const match of roundOnePlayable) {
    const slot = availableSlots.shift()

    if (!slot) {
      warnings.push(`Not enough available slots to schedule ${match.match_code || 'a playoff game'}.`)
      continue
    }

    const matchIndex = nextMatches.findIndex(m => m.id === match.id)
    if (matchIndex === -1) continue

    nextMatches[matchIndex] = {
      ...nextMatches[matchIndex],
      time_slot_id: slot.id,
      slot_id: slot.id,
      slotId: slot.id,
      venue_id: slot.venue_id || nextMatches[matchIndex].venue_id || null,
      venueId: slot.venue_id || nextMatches[matchIndex].venueId || null,
    }
  }

  return {
    matches: nextMatches,
    warnings,
  }
}