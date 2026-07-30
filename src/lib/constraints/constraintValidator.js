const CONSTRAINT_LABELS = {
  team_not_before:      'Not before time',
  team_not_after:       'Not after time',
  team_unavailable_day: 'Unavailable day',
  pool_venue_lock:      'Pool venue lock',
  division_venue_lock:  'Division venue lock',
  team_venue_lock:      'Team venue lock',
  min_rest_override:    'Minimum rest override',
}

/**
 * Validates matches against tournament constraints.
 *
 * @param {object} params
 * @param {Array}  params.matches         - match rows (with time_slot_id, team_a_id, etc.)
 * @param {Array}  params.slots           - time_slot rows
 * @param {Array}  params.constraints     - tournament_constraint rows
 * @param {Array}  params.tournamentDays  - tournament_day rows
 * @param {object} params.entityMaps      - { teams, pools, divisions, venues } — each a Map(id → entity)
 *
 * @returns {{ violations: Array, warnings: Array }}
 */
export function validateConstraints({
  matches = [],
  slots = [],
  constraints = [],
  tournamentDays = [],
  entityMaps = {},
}) {
  const violations = []
  const warnings = []

  if (!constraints.length || !matches.length) return { violations, warnings }

  // Slot lookup
  const slotById = new Map(slots.map(s => [s.id, s]))

  // Day lookup by date string
  const dayByDate = new Map(
    tournamentDays.map(d => [d.event_date ?? d.eventDate, d])
  )

  // Team → matches (for rest checks and time checks)
  const matchesByTeam = new Map()
  for (const match of matches) {
    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamId) continue
      if (!matchesByTeam.has(teamId)) matchesByTeam.set(teamId, [])
      matchesByTeam.get(teamId).push(match)
    }
  }

  const activeConstraints = constraints.filter(c => c.is_active)

  for (const constraint of activeConstraints) {
    const {
      constraint_type,
      hardness,
      entity_type,
      entity_id,
      entity_b_id,
      params = {},
    } = constraint

    function addViolation(matchId, message) {
      const entry = {
        constraintId: constraint.id,
        constraintType: constraint_type,
        matchId,
        message,
        severity: hardness === 'hard' ? 'error' : 'warning',
      }
      if (hardness === 'hard') violations.push(entry)
      else warnings.push(entry)
    }

    // --- team_not_before / team_not_after ---
    if (constraint_type === 'team_not_before' || constraint_type === 'team_not_after') {
      const teamMatches = matchesByTeam.get(entity_id) ?? []
      for (const match of teamMatches) {
        const slot = slotById.get(match.time_slot_id ?? match.time_slot?.id)
        if (!slot?.scheduled_start) continue

        const slotTime = new Date(slot.scheduled_start).toTimeString().slice(0, 5)

        if (constraint_type === 'team_not_before') {
          const notBefore = params?.not_before
          if (notBefore && slotTime < notBefore) {
            addViolation(
              match.id,
              `Team scheduled at ${slotTime}, must not be before ${notBefore}`
            )
          }
        }

        if (constraint_type === 'team_not_after') {
          const notAfter = params?.not_after
          if (notAfter && slotTime > notAfter) {
            addViolation(
              match.id,
              `Team scheduled at ${slotTime}, must not be after ${notAfter}`
            )
          }
        }
      }
    }

    // --- team_unavailable_day ---
    if (constraint_type === 'team_unavailable_day') {
      const unavailableDayIndex = params?.day_index
      if (unavailableDayIndex == null) continue

      const teamMatches = matchesByTeam.get(entity_id) ?? []
      for (const match of teamMatches) {
        const slot = slotById.get(match.time_slot_id ?? match.time_slot?.id)
        if (!slot?.scheduled_start) continue

        const slotDate = new Date(slot.scheduled_start).toISOString().slice(0, 10)
        const day = dayByDate.get(slotDate)
        const dayIndex = day?.day_index ?? day?.dayIndex

        if (dayIndex != null && dayIndex === unavailableDayIndex) {
          addViolation(
            match.id,
            `Team has a game on Day ${unavailableDayIndex} but is marked unavailable that day`
          )
        }
      }
    }

    // --- pool_venue_lock / division_venue_lock / team_venue_lock ---
    if (
      constraint_type === 'pool_venue_lock' ||
      constraint_type === 'division_venue_lock' ||
      constraint_type === 'team_venue_lock'
    ) {
      const requiredVenueId = entity_b_id
      if (!requiredVenueId) continue

      const relevantMatches = matches.filter(match => {
        if (constraint_type === 'pool_venue_lock') return match.pool_id === entity_id
        if (constraint_type === 'division_venue_lock') return match.division_id === entity_id
        if (constraint_type === 'team_venue_lock') {
          return match.team_a_id === entity_id || match.team_b_id === entity_id
        }
        return false
      })

      for (const match of relevantMatches) {
        const matchVenueId = match.venue_id ?? match.venue?.id
        if (matchVenueId && matchVenueId !== requiredVenueId) {
          addViolation(match.id, `Match not at required venue (venue lock constraint)`)
        }
      }
    }

    // --- min_rest_override ---
    if (constraint_type === 'min_rest_override') {
      const minRestMinutes = params?.min_rest_minutes
      if (!minRestMinutes) continue

      const teamMatches = (matchesByTeam.get(entity_id) ?? [])
        .filter(m => {
          const slot = slotById.get(m.time_slot_id ?? m.time_slot?.id)
          return !!slot?.scheduled_start
        })
        .sort((a, b) => {
          const aSlot = slotById.get(a.time_slot_id ?? a.time_slot?.id)
          const bSlot = slotById.get(b.time_slot_id ?? b.time_slot?.id)
          return new Date(aSlot.scheduled_start) - new Date(bSlot.scheduled_start)
        })

      for (let i = 1; i < teamMatches.length; i++) {
        const prevSlot = slotById.get(
          teamMatches[i - 1].time_slot_id ?? teamMatches[i - 1].time_slot?.id
        )
        const currSlot = slotById.get(
          teamMatches[i].time_slot_id ?? teamMatches[i].time_slot?.id
        )

        if (!prevSlot?.scheduled_end || !currSlot?.scheduled_start) continue

        const restMinutes =
          (new Date(currSlot.scheduled_start) - new Date(prevSlot.scheduled_end)) / 60000

        if (restMinutes < minRestMinutes) {
          addViolation(
            teamMatches[i].id,
            `Team has only ${Math.round(restMinutes)}min rest, requires ${minRestMinutes}min minimum`
          )
        }
      }
    }
  }

  return { violations, warnings }
}

export function getConstraintLabel(type) {
  return CONSTRAINT_LABELS[type] ?? type
}

export function describeConstraint(constraint, entityMaps = {}) {
  const { constraint_type, entity_type, entity_id, entity_b_id, params } = constraint

  const entityName = resolveEntityName(entity_type, entity_id, entityMaps) ?? 'Unknown'
  const venueName = entity_b_id
    ? resolveEntityName('venue', entity_b_id, entityMaps) ?? 'Unknown venue'
    : null

  switch (constraint_type) {
    case 'team_not_before':
      return `${entityName} cannot play before ${params?.not_before ?? '?'}`
    case 'team_not_after':
      return `${entityName} cannot play after ${params?.not_after ?? '?'}`
    case 'team_unavailable_day':
      return `${entityName} unavailable on Day ${params?.day_index ?? '?'}`
    case 'pool_venue_lock':
      return `All ${entityName} games at ${venueName ?? 'specific venue'}`
    case 'division_venue_lock':
      return `All ${entityName} division games at ${venueName ?? 'specific venue'}`
    case 'team_venue_lock':
      return `${entityName} always plays at ${venueName ?? 'specific venue'}`
    case 'min_rest_override':
      return `${entityName} needs ${params?.min_rest_minutes ?? '?'}min rest between games`
    default:
      return constraint_type
  }
}

function resolveEntityName(type, id, entityMaps = {}) {
  if (!type || !id) return null
  // entityMaps keys: teams, pools, divisions, venues
  const mapKey = type === 'venue' ? 'venues'
    : type === 'team' ? 'teams'
    : type === 'pool' ? 'pools'
    : type === 'division' ? 'divisions'
    : null
  if (!mapKey) return null
  const map = entityMaps[mapKey]
  if (!map) return null
  const entity = map.get(id)
  return entity?.name ?? entity?.short_name ?? null
}