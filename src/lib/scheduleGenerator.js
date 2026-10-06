import { FORMAT_TYPES } from '../lib/constants'
import { validateConstraints } from './constraints/constraintValidator'

/**
 * Suggest how many pools to create for a given team count.
 * Returns { numPools, poolSize, remainder }
 */
export function suggestPoolStructure(teamCount, options = {}) {
  const { preferredPoolSize = 4, maxPoolSize = 6 } = options
  if (teamCount <= 0) return { numPools: 1, poolSize: 0, remainder: 0 }

  let best = { numPools: 1, poolSize: teamCount, remainder: 0, score: Infinity }

  for (let n = 1; n <= teamCount; n++) {
    const poolSize = Math.ceil(teamCount / n)
    if (poolSize > maxPoolSize) continue
    const remainder = teamCount % n
    const score = Math.abs(poolSize - preferredPoolSize) * 10 + remainder
    if (score < best.score) {
      best = { numPools: n, poolSize, remainder, score }
    }
  }

  return best
}

/**
 * Serpentine (snake) seed teams into pools for balanced strength distribution.
 */
export function serpentineSeeding(teams, numPools) {
  if (!teams || teams.length === 0 || numPools <= 0) return teams

  const sorted = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
  const result = []
  let forward = true

  for (let round = 0; round < Math.ceil(sorted.length / numPools); round++) {
    const slice = sorted.slice(round * numPools, (round + 1) * numPools)
    result.push(...(forward ? slice : [...slice].reverse()))
    forward = !forward
  }

  return result
}

const FOUR_TEAM_POOL_TEMPLATE = [
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
  [
    [0, 1],
    [2, 3],
  ],
]

function generateSingleElimRound1Matchups(teamsInDivision, divisionId, tournamentId) {
  const crypto = globalThis.crypto
  if (!teamsInDivision || teamsInDivision.length < 2) return []

  const seededTeams = [...teamsInDivision]
  const size = Math.pow(2, Math.ceil(Math.log2(seededTeams.length)))

  while (seededTeams.length < size) {
    seededTeams.push(null)
  }

  const matchups = []

  for (let i = 0; i < size / 2; i++) {
    const top = seededTeams[i]
    const bottom = seededTeams[size - 1 - i]

    if (!top && !bottom) continue
    if (!top || !bottom) continue

    matchups.push({
      id: crypto.randomUUID(),
      tournament_id: tournamentId ?? null,
      division_id: divisionId,
      pool_id: null,
      team_a_id: top.dbId || top.id,
      team_b_id: bottom.dbId || bottom.id,
      round: 1,
      match_number: null,
      _structureType: 'single_elim',
    })
  }

  return matchups
}

// ---------------------------------------------------------------------------
// Constraint pre-processing helpers
// ---------------------------------------------------------------------------

/**
 * Build fast lookup maps from constraint rows for use during slot assignment.
 * Returns {
 *   teamNotBefore:    Map<teamId, 'HH:MM'>
 *   teamNotAfter:     Map<teamId, 'HH:MM'>
 *   teamUnavailDays:  Map<teamId, Set<dayIndex>>
 *   teamVenueLock:    Map<teamId, venueId>
 *   poolVenueLock:    Map<poolId, venueId>
 *   divisionVenueLock:Map<divisionId, venueId>
 *   teamMinRest:      Map<teamId, minutes>
 * }
 */
function buildConstraintMaps(constraints = []) {
  const teamNotBefore    = new Map()
  const teamNotAfter     = new Map()
  const teamUnavailDays  = new Map()
  const teamVenueLock    = new Map()
  const poolVenueLock    = new Map()
  const divisionVenueLock = new Map()
  const teamMinRest      = new Map()

  for (const c of constraints) {
    if (!c.is_active) continue

    switch (c.constraint_type) {
      case 'team_not_before':
        if (c.entity_id && c.params?.not_before) {
          teamNotBefore.set(c.entity_id, c.params.not_before)
        }
        break

      case 'team_not_after':
        if (c.entity_id && c.params?.not_after) {
          teamNotAfter.set(c.entity_id, c.params.not_after)
        }
        break

      case 'team_unavailable_day':
        if (c.entity_id && c.params?.day_index != null) {
          if (!teamUnavailDays.has(c.entity_id)) {
            teamUnavailDays.set(c.entity_id, new Set())
          }
          teamUnavailDays.get(c.entity_id).add(c.params.day_index)
        }
        break

      case 'team_venue_lock':
        if (c.entity_id && c.entity_b_id) {
          teamVenueLock.set(c.entity_id, c.entity_b_id)
        }
        break

      case 'pool_venue_lock':
        if (c.entity_id && c.entity_b_id) {
          poolVenueLock.set(c.entity_id, c.entity_b_id)
        }
        break

      case 'division_venue_lock':
        if (c.entity_id && c.entity_b_id) {
          divisionVenueLock.set(c.entity_id, c.entity_b_id)
        }
        break

      case 'min_rest_override':
        if (c.entity_id && c.params?.min_rest_minutes != null) {
          teamMinRest.set(c.entity_id, c.params.min_rest_minutes)
        }
        break

      default:
        break
    }
  }

  return {
    teamNotBefore,
    teamNotAfter,
    teamUnavailDays,
    teamVenueLock,
    poolVenueLock,
    divisionVenueLock,
    teamMinRest,
  }
}

/**
 * Get day index for a slot time given the tournament days.
 */
function getDayIndexForSlot(slotStart, tournamentDays = []) {
  const slotDate = new Date(slotStart).toISOString().slice(0, 10)
  const day = tournamentDays.find(d => {
    const dayDate = d.eventDate ?? d.event_date ?? ''
    return dayDate === slotDate
  })
  return day?.dayIndex ?? day?.day_index ?? null
}

/**
 * Get HH:MM time string from ISO timestamp.
 */
function getTimeOfDay(isoString) {
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Check whether a slot is allowed for a matchup given hard constraints.
 * Returns true if the slot is valid, false if it should be skipped.
 */
function slotPassesHardConstraints(slot, matchup, constraintMaps, tournamentDays) {
  const {
    teamNotBefore,
    teamNotAfter,
    teamUnavailDays,
    teamVenueLock,
    poolVenueLock,
    divisionVenueLock,
  } = constraintMaps

  const slotTime = getTimeOfDay(slot.scheduled_start)
  const dayIndex = getDayIndexForSlot(slot.scheduled_start, tournamentDays)
  const venueId = slot.venue_id

  const teamIds = [matchup.team_a_id, matchup.team_b_id].filter(Boolean)

  for (const teamId of teamIds) {
    // team_not_before
    const notBefore = teamNotBefore.get(teamId)
    if (notBefore && slotTime < notBefore) return false

    // team_not_after
    const notAfter = teamNotAfter.get(teamId)
    if (notAfter && slotTime > notAfter) return false

    // team_unavailable_day
    const unavailDays = teamUnavailDays.get(teamId)
    if (unavailDays && dayIndex != null && unavailDays.has(dayIndex)) return false

    // team_venue_lock (hard)
    const lockedVenue = teamVenueLock.get(teamId)
    if (lockedVenue && venueId !== lockedVenue) return false
  }

  // pool_venue_lock (hard)
  if (matchup.pool_id) {
    const lockedVenue = poolVenueLock.get(matchup.pool_id)
    if (lockedVenue && venueId !== lockedVenue) return false
  }

  // division_venue_lock (hard)
  if (matchup.division_id) {
    const lockedVenue = divisionVenueLock.get(matchup.division_id)
    if (lockedVenue && venueId !== lockedVenue) return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a full tournament schedule.
 * Accepts optional constraints[] for hard enforcement during generation
 * and soft violation detection post-generation.
 */
export function generateSchedule(config) {
  const {
    divisions = [],
    teams = [],
    pools = [],
    poolAssignments = {},
    venues = [],
    tournamentDays = [],
    scheduleDays = [],
    scheduleConfig = {},
    tournamentId,
    constraints = [],  // NEW: tournament_constraint rows
  } = config

  const {
    startTime,
    endTime,
    lunchBreakStart,
    lunchBreakEnd,
    gameDurationMinutes = 90,
    breakBetweenGamesMinutes = 30,
    minRestBetweenTeamGames = 90,
    generationMode = 'all',
  } = scheduleConfig ?? {}

  const crypto = globalThis.crypto
  const slotDuration = gameDurationMinutes + breakBetweenGamesMinutes

  if (venues.length === 0) {
    return { slots: [], matches: [], conflicts: [] }
  }

  const inputDays =
    Array.isArray(tournamentDays) && tournamentDays.length > 0
      ? tournamentDays
      : scheduleDays

  const normalizedDays =
    inputDays.length > 0
      ? inputDays
          .filter(day => day.startTime || day.start_time)
          .map(day => {
            const dayDate = day.eventDate || day.event_date || ''
            const dayStartTime = day.startTime || day.start_time || '09:00'
            const dayEndTime = day.endTime || day.end_time || ''
            const dayLunchStart = day.lunchBreakStart || day.lunch_break_start || null
            const dayLunchEnd = day.lunchBreakEnd || day.lunch_break_end || null

            const startIso = dayDate
              ? `${dayDate}T${dayStartTime}`
              : dayStartTime

            const endIso = dayDate && dayEndTime
              ? `${dayDate}T${dayEndTime}`
              : dayEndTime || null

            const lunchStartIso =
              dayDate && dayLunchStart ? `${dayDate}T${dayLunchStart}` : dayLunchStart

            const lunchEndIso =
              dayDate && dayLunchEnd ? `${dayDate}T${dayLunchEnd}` : dayLunchEnd

            return {
              start: new Date(startIso),
              end: endIso
                ? new Date(endIso)
                : new Date(new Date(startIso).getTime() + 10 * 60 * 60 * 1000),
              lunchStart: lunchStartIso ? new Date(lunchStartIso) : null,
              lunchEnd: lunchEndIso ? new Date(lunchEndIso) : null,
            }
          })
      : startTime
        ? [
            {
              start: new Date(startTime),
              end: endTime
                ? new Date(endTime)
                : new Date(new Date(startTime).getTime() + 10 * 60 * 60 * 1000),
              lunchStart: lunchBreakStart ? new Date(lunchBreakStart) : null,
              lunchEnd: lunchBreakEnd ? new Date(lunchBreakEnd) : null,
            },
          ]
        : []

  if (normalizedDays.length === 0) {
    return { slots: [], matches: [], conflicts: [] }
  }

  const timeRounds = []

  for (const day of normalizedDays) {
    let cursor = new Date(day.start)

    while (cursor < day.end) {
      if (day.lunchStart && day.lunchEnd && cursor >= day.lunchStart && cursor < day.lunchEnd) {
        cursor = new Date(day.lunchEnd)
        continue
      }

      const slotEnd = new Date(cursor.getTime() + gameDurationMinutes * 60 * 1000)
      if (slotEnd > day.end) break

      timeRounds.push({
        time: new Date(cursor),
        slots: venues.map(venue => ({
          id: crypto.randomUUID(),
          venue_id: venue.id,
          scheduled_start: cursor.toISOString(),
          scheduled_end: slotEnd.toISOString(),
          _assigned: false,
        })),
      })

      cursor = new Date(cursor.getTime() + slotDuration * 60 * 1000)
    }
  }

  const slots = timeRounds.flatMap(r => r.slots)

  const poolHomeVenue = {}
  pools.forEach((pool, i) => {
    poolHomeVenue[pool.id] = venues[i % venues.length]?.id ?? venues[0]?.id
  })

  const poolsWithTeams = pools.map(pool => ({
    ...pool,
    teams: teams.filter(team => {
      const assignedPoolId =
        poolAssignments?.[team.id] ??
        team.poolId ??
        team.pool_id ??
        null
      return assignedPoolId === pool.id
    }),
  }))

  const allMatchups = []

  for (const pool of poolsWithTeams) {
    const matchups = generatePoolMatchups(pool)
    matchups.forEach(m =>
      allMatchups.push({
        ...m,
        tournament_id: tournamentId ?? null,
        division_id: pool.divisionId ?? pool.division_id ?? null,
        pool_id: pool.id,
        home_venue: poolHomeVenue[pool.id],
        _structureType: 'pool',
      })
    )
  }

  for (const division of divisions) {
    const formatType = division.formatType ?? division.format_type
    if (formatType !== FORMAT_TYPES.SINGLE_ELIM) continue

    const divisionTeams = teams.filter(t => t.divisionId === division.id)
    const matchups = generateSingleElimRound1Matchups(
      divisionTeams,
      division.id,
      tournamentId
    )

    matchups.forEach((m, i) =>
      allMatchups.push({
        ...m,
        division_id: division.id,
        home_venue: venues[i % venues.length]?.id ?? venues[0]?.id ?? null,
      })
    )
  }

  allMatchups.sort((a, b) => {
    const roundDiff = (a.round ?? 1) - (b.round ?? 1)
    if (roundDiff !== 0) return roundDiff
    const aKey = a.pool_id ?? a.division_id ?? ''
    const bKey = b.pool_id ?? b.division_id ?? ''
    return String(aKey).localeCompare(String(bKey))
  })

  let matchupsToSchedule = allMatchups

  if (generationMode === 'game') {
    matchupsToSchedule = allMatchups.slice(0, 1)
  } else if (generationMode === 'round') {
    const firstRound = allMatchups[0]?.round
    matchupsToSchedule = allMatchups.filter(m => (m.round ?? 1) === firstRound)
  }

  // NEW: build constraint maps for fast lookup during slot assignment
  const constraintMaps = buildConstraintMaps(constraints)
  const hasConstraints = constraints.some(c => c.is_active)

  const matches = []
  const teamLastSlot = {}
  const minRestMs = minRestBetweenTeamGames * 60 * 1000

  // NEW: track hard constraint blocks for reporting
  const hardConstraintBlocks = []

  for (const matchup of matchupsToSchedule) {
    let assigned = false

    for (const round of timeRounds) {
      const slotTimeMs = round.time.getTime()
      const slotEndMs = slotTimeMs + gameDurationMinutes * 60 * 1000

      // Standard rest check (per-team min rest, with override support)
      const aLast = teamLastSlot[matchup.team_a_id]
      const bLast = teamLastSlot[matchup.team_b_id]

      // NEW: use per-team min rest override if available
      const aMinRest = constraintMaps.teamMinRest.get(matchup.team_a_id) ?? minRestBetweenTeamGames
      const bMinRest = constraintMaps.teamMinRest.get(matchup.team_b_id) ?? minRestBetweenTeamGames

      if (aLast && slotTimeMs - aLast < aMinRest * 60 * 1000) continue
      if (bLast && slotTimeMs - bLast < bMinRest * 60 * 1000) continue

      const slot =
        round.slots.find(s =>
          !s._assigned &&
          s.venue_id === matchup.home_venue &&
          (!hasConstraints || slotPassesHardConstraints(s, matchup, constraintMaps, inputDays))
        ) ??
        round.slots.find(s =>
          !s._assigned &&
          (!hasConstraints || slotPassesHardConstraints(s, matchup, constraintMaps, inputDays))
        )

      if (!slot) continue

      slot._assigned = true
      teamLastSlot[matchup.team_a_id] = slotEndMs
      teamLastSlot[matchup.team_b_id] = slotEndMs

      matches.push({
        id: crypto.randomUUID(),
        tournament_id: matchup.tournament_id ?? null,
        division_id: matchup.division_id ?? null,
        pool_id: matchup.pool_id ?? null,
        team_a_id: matchup.team_a_id,
        team_b_id: matchup.team_b_id,
        slot_id: slot.id,
        venue_id: slot.venue_id,
        round: matchup.round,
        match_number: matches.length + 1,
      })

      assigned = true
      break
    }

    if (!assigned) {
      // NEW: log whether constraint blocking caused this
      const blockedByConstraint = hasConstraints && timeRounds.some(round =>
        round.slots.some(s =>
          !s._assigned &&
          !slotPassesHardConstraints(s, matchup, constraintMaps, inputDays)
        )
      )

      if (blockedByConstraint) {
        hardConstraintBlocks.push({
          team_a_id: matchup.team_a_id,
          team_b_id: matchup.team_b_id,
          pool_id: matchup.pool_id,
          division_id: matchup.division_id,
        })
      }

      matches.push({
        id: crypto.randomUUID(),
        tournament_id: matchup.tournament_id ?? null,
        division_id: matchup.division_id ?? null,
        pool_id: matchup.pool_id ?? null,
        team_a_id: matchup.team_a_id,
        team_b_id: matchup.team_b_id,
        slot_id: null,
        venue_id: null,
        round: matchup.round,
        match_number: matches.length + 1,
      })
    }
  }

  const usedSlotIds = new Set(matches.map(m => m.slot_id).filter(Boolean))
  const usedSlots = slots.filter(s => usedSlotIds.has(s.id))

  if (matches.some(m => !m.slot_id)) {
    console.warn('[generateSchedule] Some matches could not be assigned to slots', {
      unscheduled: matches.filter(m => !m.slot_id).length,
      blockedByConstraints: hardConstraintBlocks.length,
    })
  }

  // Standard conflict detection
  const baseConflicts = validateSchedule(matches, usedSlots, minRestBetweenTeamGames)

  // NEW: constraint violation detection (soft constraints + post-generation hard check)
  const constraintResult = hasConstraints
    ? validateConstraints({
        matches,
        slots: usedSlots,
        constraints,
        tournamentDays: inputDays,
        entityMaps: {},  // entity name resolution not needed here — ScheduleEditor handles display
      })
    : { violations: [], warnings: [] }

  // NEW: hard constraint blocks become errors in conflicts
  const constraintBlockConflicts = hardConstraintBlocks.map(block => ({
    type: 'constraint_block',
    severity: 'error',
    teamId: block.team_a_id,
    matchIds: [],
    message: 'A game could not be scheduled due to a hard constraint (time, day, or venue restriction).',
  }))

  const conflicts = [
    ...baseConflicts,
    ...constraintBlockConflicts,
    // soft constraint warnings surface alongside standard warnings
    ...constraintResult.warnings.map(v => ({
      type: 'constraint_warning',
      severity: 'warning',
      teamId: v.matchId ?? null,
      matchIds: v.matchId ? [v.matchId] : [],
      message: v.message,
    })),
    // hard constraint violations that slipped through (post-generation check)
    ...constraintResult.violations.map(v => ({
      type: 'constraint_violation',
      severity: 'error',
      teamId: null,
      matchIds: v.matchId ? [v.matchId] : [],
      message: v.message,
    })),
  ]

  return {
    slots: usedSlots,
    matches,
    conflicts: dedupeConflicts(conflicts),
    // NEW: expose constraint result for caller to inspect
    constraintViolations: constraintResult.violations,
    constraintWarnings: constraintResult.warnings,
  }
}

// ---------------------------------------------------------------------------
// Pool matchup generation
// ---------------------------------------------------------------------------

export function generatePoolMatchups(pool) {
  const teams = pool.teams ?? []
  if (teams.length < 2) return []

  if (teams.length === 4) {
    const matchups = []

    for (let roundIndex = 0; roundIndex < FOUR_TEAM_POOL_TEMPLATE.length; roundIndex++) {
      const round = FOUR_TEAM_POOL_TEMPLATE[roundIndex]

      for (const [aIndex, bIndex] of round) {
        const teamA = teams[aIndex]
        const teamB = teams[bIndex]

        if (teamA && teamB && teamA.id !== teamB.id) {
          matchups.push({
            team_a_id: teamA.id,
            team_b_id: teamB.id,
            round: roundIndex + 1,
          })
        }
      }
    }

    return matchups
  }

  const n = teams.length % 2 === 0 ? teams.length : teams.length + 1
  const fixed = teams[0]
  const rotating = [...teams.slice(1)]
  const matchups = []
  let round = 1

  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rotating]
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const a = roundTeams[i]
      const b = roundTeams[n - 1 - i]

      if (a && b && a.id !== b.id) {
        matchups.push({
          team_a_id: a.id,
          team_b_id: b.id,
          round,
        })
      }
    }

    rotating.unshift(rotating.pop())
    round++
  }

  return matchups
}

// ---------------------------------------------------------------------------
// Schedule validation
// ---------------------------------------------------------------------------

export function validateSchedule(matches, slots, minRestMinutes) {
  const conflicts = []
  const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
  const teamGames = {}
  const slotUsage = {}

  for (const match of matches) {
    const isBracketMatch = !!match.bracket_type
    const isPlayable = !!match.team_a_id && !!match.team_b_id
    const slotId = match.slot_id || match.slotId || match.time_slot_id || null

    if (!isPlayable && !isBracketMatch) {
      conflicts.push({
        type: 'missing_team',
        severity: 'error',
        teamId: match.team_a_id ?? match.team_b_id ?? null,
        matchIds: [match.id],
        message: 'A game is missing one or both teams.',
      })
    }

    if (match.team_a_id && match.team_b_id && match.team_a_id === match.team_b_id) {
      conflicts.push({
        type: 'team_self',
        severity: 'error',
        teamId: match.team_a_id,
        matchIds: [match.id],
        message: 'A team cannot play itself.',
      })
    }

    if (!slotId) {
      if (isPlayable) {
        conflicts.push({
          type: 'unscheduled',
          severity: 'error',
          teamId: match.team_a_id,
          matchIds: [match.id],
          message: 'A game could not be scheduled - not enough time slots',
        })
      }
      continue
    }

    const slot = slotMap[slotId]
    if (!slot) {
      conflicts.push({
        type: 'missing_slot',
        severity: 'error',
        teamId: match.team_a_id,
        matchIds: [match.id],
        message: 'A game references a time slot that does not exist.',
      })
      continue
    }

    if (match.venue_id && slot.venue_id && match.venue_id !== slot.venue_id) {
      conflicts.push({
        type: 'slot_venue_mismatch',
        severity: 'warning',
        teamId: match.team_a_id,
        matchIds: [match.id],
        message: 'A game venue does not match its assigned time slot venue.',
      })
    }

    if (!slotUsage[slotId]) slotUsage[slotId] = []
    slotUsage[slotId].push(match)

    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamId) continue
      if (!teamGames[teamId]) teamGames[teamId] = []
      teamGames[teamId].push(match)
    }
  }

  for (const [, games] of Object.entries(slotUsage)) {
    if (games.length > 1) {
      conflicts.push({
        type: 'slot_double_booked',
        severity: 'error',
        teamId: null,
        matchIds: games.map(g => g.id),
        message: 'Multiple games are assigned to the same time slot.',
      })
    }
  }

  for (const [teamId, games] of Object.entries(teamGames)) {
    const scheduled = games
      .filter(g => {
        const gSlotId = g.slot_id || g.slotId || g.time_slot_id || null
        return gSlotId && slotMap[gSlotId]
      })
      .sort((a, b) => {
        const aSlotId = a.slot_id || a.slotId || a.time_slot_id
        const bSlotId = b.slot_id || b.slotId || b.time_slot_id
        const aStart = new Date(slotMap[aSlotId].scheduled_start).getTime()
        const bStart = new Date(slotMap[bSlotId].scheduled_start).getTime()
        return aStart - bStart
      })

    for (let i = 1; i < scheduled.length; i++) {
      const prevSlotId = scheduled[i - 1].slot_id || scheduled[i - 1].slotId || scheduled[i - 1].time_slot_id
      const nextSlotId = scheduled[i].slot_id || scheduled[i].slotId || scheduled[i].time_slot_id

      const prevSlot = slotMap[prevSlotId]
      const nextSlot = slotMap[nextSlotId]

      const prevEnd = new Date(prevSlot.scheduled_end).getTime()
      const nextStart = new Date(nextSlot.scheduled_start).getTime()

      if (nextStart < prevEnd) {
        conflicts.push({
          type: 'team_overlap',
          severity: 'error',
          teamId,
          matchIds: [scheduled[i - 1].id, scheduled[i].id],
          message: 'A team is scheduled for overlapping games.',
        })
      }

      const restMin = (nextStart - prevEnd) / 60000
      if (restMin < minRestMinutes) {
        conflicts.push({
          type: 'rest_time',
          severity: restMin < 30 ? 'error' : 'warning',
          teamId,
          matchIds: [scheduled[i - 1].id, scheduled[i].id],
          message: `A team has only ${Math.round(restMin)} min rest between games (minimum ${minRestMinutes} min)`,
        })
      }
    }
  }

  return dedupeConflicts(conflicts)
}

function dedupeConflicts(conflicts) {
  const seen = new Set()
  const result = []

  for (const conflict of conflicts) {
    const key = [
      conflict.type,
      conflict.severity,
      conflict.teamId ?? '',
      ...(conflict.matchIds ?? []).slice().sort(),
      conflict.message,
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(conflict)
  }

  return result
}

// ---------------------------------------------------------------------------
// Schedule delay
// ---------------------------------------------------------------------------

export function applyScheduleDelay(slots, fromTime, offsetMinutes, venueId = null) {
  return slots.map(slot => {
    const slotTime = new Date(slot.scheduled_start).getTime()
    const fromMs = new Date(fromTime).getTime()

    if (slotTime < fromMs) return slot
    if (venueId && slot.venue_id !== venueId) return slot

    return {
      ...slot,
      scheduled_start: new Date(slotTime + offsetMinutes * 60000).toISOString(),
      scheduled_end: new Date(new Date(slot.scheduled_end).getTime() + offsetMinutes * 60000).toISOString(),
      offset_minutes: (slot.offset_minutes ?? 0) + offsetMinutes,
    }
  })
}

// ---------------------------------------------------------------------------
// Tiebreakers
// ---------------------------------------------------------------------------

export function applyTiebreakers(teamStats, headToHead, tiebreakerOrder, discFlipOrder = {}) {
  return [...teamStats].sort((a, b) => {
    for (const rule of tiebreakerOrder) {
      let diff = 0

      switch (rule) {
        case 'head_to_head': {
          const h2h = headToHead?.[a.team_id]?.[b.team_id]
          if (h2h !== undefined) diff = h2h > 0 ? -1 : h2h < 0 ? 1 : 0
          break
        }
        case 'wins':
          diff = (b.wins ?? 0) - (a.wins ?? 0)
          break
        case 'points_against':
          diff = (a.points_against ?? 0) - (b.points_against ?? 0)
          break
        case 'points_scored':
          diff = (b.points_scored ?? 0) - (a.points_scored ?? 0)
          break
        case 'disc_flip': {
          const aOrder = discFlipOrder?.[a.team_id] ?? 0
          const bOrder = discFlipOrder?.[b.team_id] ?? 0
          diff = aOrder - bOrder
          break
        }
        default:
          break
      }

      if (diff !== 0) return diff
    }
    return 0
  })
}

// ---------------------------------------------------------------------------
// Single elimination bracket
// ---------------------------------------------------------------------------

export function generateSingleEliminationBracket(standings, divisionId, options = {}) {
  const { includeThirdPlace = false } = options
  const n = standings.length
  const size = Math.pow(2, Math.ceil(Math.log2(n)))
  const slots = []
  const crypto = globalThis.crypto

  const seeded = [...standings]
  while (seeded.length < size) seeded.push(null)

  const round1 = []
  for (let i = 0; i < size / 2; i++) {
    const top = seeded[i]
    const bottom = seeded[size - 1 - i]

    round1.push({
      id: crypto.randomUUID(),
      division_id: divisionId,
      round: 1,
      position: i + 1,
      phase: 2,
      team_a_id: top?.team_id ?? null,
      team_b_id: bottom?.team_id ?? null,
      team_a_source: top ? `${top.rank} seed` : null,
      team_b_source: bottom ? `${bottom.rank} seed` : null,
      is_bye: !bottom,
      bracket_side: 'winners',
    })
  }

  slots.push(...round1)

  return slots
}