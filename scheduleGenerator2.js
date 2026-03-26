/**
 * athleteOS — Tournament Module
 * Schedule Generation Algorithm
 *
 * Semi-automatic schedule generator.
 * Takes tournament config and returns a proposed schedule
 * that the director can then drag-to-adjust.
 *
 * Usage:
 *   import { generateSchedule } from './scheduleGenerator'
 *   const result = generateSchedule(config)
 *   // result.slots   → array of time slots to insert into DB
 *   // result.matches → array of match assignments (match_id → slot_id)
 *   // result.conflicts → array of detected constraint violations
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Team
 * @property {string}   id
 * @property {string}   name
 * @property {string}   pool_id
 * @property {string}   division_id
 * @property {string}   [club_name]
 * @property {string}   [head_coach_name]
 * @property {Object}   [constraints]         - { unavailable_before, unavailable_after }
 */

/**
 * @typedef {Object} Pool
 * @property {string}   id
 * @property {string}   division_id
 * @property {string}   name
 * @property {Team[]}   teams
 */

/**
 * @typedef {Object} Venue
 * @property {string}   id
 * @property {string}   name
 * @property {string}   qr_slug
 */

/**
 * @typedef {Object} ScheduleConfig
 * @property {string}   tournament_id
 * @property {string}   timezone
 * @property {string}   start_time            - ISO datetime of first game
 * @property {string}   end_time              - ISO datetime of last allowed game end
 * @property {string[]} [lunch_break]         - ['12:00', '13:00'] local time
 * @property {number}   game_duration_minutes
 * @property {number}   break_between_games_minutes
 * @property {number}   min_rest_between_team_games - minutes a team must rest between games
 * @property {Pool[]}   pools
 * @property {Venue[]}  venues
 */

/**
 * @typedef {Object} ScheduledMatch
 * @property {string}   id                    - temporary UUID for pre-DB use
 * @property {string}   pool_id
 * @property {string}   division_id
 * @property {string}   team_a_id
 * @property {string}   team_b_id
 * @property {string}   [slot_id]             - assigned time slot
 * @property {string}   [venue_id]            - assigned venue
 * @property {Date}     [scheduled_start]
 * @property {Date}     [scheduled_end]
 * @property {number}   round
 * @property {number}   match_number
 */

/**
 * @typedef {Object} TimeSlot
 * @property {string}   id
 * @property {string}   venue_id
 * @property {Date}     scheduled_start
 * @property {Date}     scheduled_end
 * @property {string|null} assigned_match_id
 */

/**
 * @typedef {Object} Conflict
 * @property {string}   type                  - 'double_booked'|'rest_violation'|'coach_conflict'|'club_conflict'
 * @property {string}   severity              - 'error'|'warning'
 * @property {string}   team_id
 * @property {string}   [team_name]
 * @property {string}   [match_a_id]
 * @property {string}   [match_b_id]
 * @property {string}   message
 */

/**
 * @typedef {Object} ScheduleResult
 * @property {TimeSlot[]}       slots
 * @property {ScheduledMatch[]} matches
 * @property {Conflict[]}       conflicts
 * @property {ScheduleStats}    stats
 */

/**
 * @typedef {Object} ScheduleStats
 * @property {number} total_matches
 * @property {number} total_slots
 * @property {number} slots_used
 * @property {number} slots_free
 * @property {number} conflicts_count
 * @property {number} games_per_team_min
 * @property {number} games_per_team_max
 * @property {Date}   earliest_game
 * @property {Date}   latest_game
 */


// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

function minutesBetween(a, b) {
  return (b.getTime() - a.getTime()) / 60000
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

/**
 * Parse local time string 'HH:MM' into today's Date at that time.
 */
function parseLocalTime(timeStr, referenceDate) {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(referenceDate)
  d.setHours(h, m, 0, 0)
  return d
}


// ─────────────────────────────────────────────────────────────
// STEP 1: GENERATE ALL POOL MATCHUPS
// Round-robin within each pool
// ─────────────────────────────────────────────────────────────

/**
 * Generate round-robin pairings for a pool.
 * Uses the "circle method" — one team stays fixed, others rotate.
 * Returns matches in round order so same-round games can be parallelized.
 *
 * @param {Pool} pool
 * @returns {ScheduledMatch[]}
 */
export function generatePoolMatchups(pool) {
  const teams = [...pool.teams]
  const n = teams.length
  const matches = []
  let matchNumber = 1

  // Odd number of teams: add a dummy BYE team
  const hasBye = n % 2 !== 0
  if (hasBye) teams.push({ id: 'bye', name: 'BYE' })

  const numTeams = teams.length
  const numRounds = numTeams - 1
  const gamesPerRound = numTeams / 2

  // Fixed team is teams[0], others rotate
  const rotating = teams.slice(1)

  for (let round = 0; round < numRounds; round++) {
    const roundTeams = [teams[0], ...rotating]
    const roundMatches = []

    for (let i = 0; i < gamesPerRound; i++) {
      const teamA = roundTeams[i]
      const teamB = roundTeams[numTeams - 1 - i]

      // Skip bye games — they auto-advance in DB
      const isByeGame = teamA.id === 'bye' || teamB.id === 'bye'

      roundMatches.push({
        id: generateId(),
        pool_id: pool.id,
        division_id: pool.division_id,
        team_a_id: teamA.id === 'bye' ? teamB.id : teamA.id,
        team_b_id: teamA.id === 'bye' ? null : (teamB.id === 'bye' ? null : teamB.id),
        is_bye: isByeGame,
        round: round + 1,
        match_number: matchNumber++,
        slot_id: null,
        venue_id: null,
        scheduled_start: null,
        scheduled_end: null,
      })

      // Rotate: last element goes to index 1
      rotating.unshift(rotating.pop())
    }

    matches.push(...roundMatches)
  }

  return matches
}


// ─────────────────────────────────────────────────────────────
// STEP 2: GENERATE TIME SLOTS
// Creates all available slots across all venues for the day
// ─────────────────────────────────────────────────────────────

/**
 * Generate time slots for all venues.
 *
 * @param {ScheduleConfig} config
 * @returns {TimeSlot[]}
 */
export function generateTimeSlots(config) {
  const {
    venues,
    tournament_id,
    game_duration_minutes,
    break_between_games_minutes,
    lunch_break,
  } = config

  const slotDuration = game_duration_minutes + break_between_games_minutes
  const allSlots = []

  for (const venue of venues) {
    let cursor = new Date(config.start_time)
    const end = new Date(config.end_time)

    while (true) {
      const slotEnd = addMinutes(cursor, game_duration_minutes)

      // Would this slot end after the tournament end time? Stop.
      if (slotEnd > end) break

      // Skip lunch break
      if (lunch_break) {
        const lunchStart = parseLocalTime(lunch_break[0], cursor)
        const lunchEnd = parseLocalTime(lunch_break[1], cursor)

        // If this slot overlaps lunch, jump to after lunch
        if (cursor < lunchEnd && slotEnd > lunchStart) {
          cursor = new Date(lunchEnd)
          continue
        }
      }

      allSlots.push({
        id: generateId(),
        tournament_id,
        venue_id: venue.id,
        scheduled_start: new Date(cursor),
        scheduled_end: slotEnd,
        assigned_match_id: null,
        offset_minutes: 0,
        is_available: true,
        notes: null,
      })

      cursor = addMinutes(cursor, slotDuration)
    }
  }

  return allSlots
}


// ─────────────────────────────────────────────────────────────
// STEP 3: BUILD TEAM SCHEDULE MAP
// Tracks when each team is playing — used for conflict checking
// ─────────────────────────────────────────────────────────────

/**
 * Build a map of team_id → array of assigned slot times.
 * Used to check rest periods and double-booking.
 *
 * @param {ScheduledMatch[]} assigned
 * @param {Map<string, TimeSlot>} slotMap
 * @returns {Map<string, Date[]>}
 */
function buildTeamScheduleMap(assigned, slotMap) {
  const map = new Map()

  for (const match of assigned) {
    if (!match.slot_id) continue
    const slot = slotMap.get(match.slot_id)
    if (!slot) continue

    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamId || teamId === 'bye') continue
      if (!map.has(teamId)) map.set(teamId, [])
      map.get(teamId).push(slot.scheduled_start)
    }
  }

  return map
}


// ─────────────────────────────────────────────────────────────
// STEP 4: CONFLICT CHECKER
// ─────────────────────────────────────────────────────────────

/**
 * Check if assigning a match to a slot creates any conflicts.
 *
 * @param {ScheduledMatch} match
 * @param {TimeSlot} slot
 * @param {Map<string, Date[]>} teamScheduleMap
 * @param {number} minRestMinutes
 * @param {Team[]} allTeams
 * @returns {{ ok: boolean, conflicts: Conflict[] }}
 */
function checkSlotConflicts(match, slot, teamScheduleMap, minRestMinutes, allTeams) {
  const conflicts = []
  const teamMap = new Map(allTeams.map(t => [t.id, t]))

  for (const teamId of [match.team_a_id, match.team_b_id]) {
    if (!teamId || teamId === 'bye') continue

    const team = teamMap.get(teamId)
    const existing = teamScheduleMap.get(teamId) || []

    for (const existingStart of existing) {
      const diff = Math.abs(minutesBetween(existingStart, slot.scheduled_start))

      // Hard conflict: same slot
      if (diff < 1) {
        conflicts.push({
          type: 'double_booked',
          severity: 'error',
          team_id: teamId,
          team_name: team?.name,
          message: `${team?.name || teamId} is double-booked at ${slot.scheduled_start.toLocaleTimeString()}`,
        })
        continue
      }

      // Soft conflict: not enough rest
      if (diff < minRestMinutes) {
        conflicts.push({
          type: 'rest_violation',
          severity: 'warning',
          team_id: teamId,
          team_name: team?.name,
          message: `${team?.name || teamId} only has ${Math.round(diff)} min rest (minimum ${minRestMinutes} min)`,
        })
      }
    }

    // Coach conflict: check if another team with same coach is at same time
    if (team?.head_coach_name) {
      const coachTeams = allTeams.filter(
        t => t.head_coach_name === team.head_coach_name && t.id !== teamId
      )
      for (const coachTeam of coachTeams) {
        const coachSchedule = teamScheduleMap.get(coachTeam.id) || []
        for (const coachTime of coachSchedule) {
          const diff = Math.abs(minutesBetween(coachTime, slot.scheduled_start))
          if (diff < 1) {
            conflicts.push({
              type: 'coach_conflict',
              severity: 'warning',
              team_id: teamId,
              team_name: team.name,
              message: `Coach ${team.head_coach_name} has ${coachTeam.name} at same time as ${team.name}`,
            })
          }
        }
      }
    }

    // Team availability constraints
    if (team?.constraints?.unavailable_before) {
      const unavailBefore = parseLocalTime(team.constraints.unavailable_before, slot.scheduled_start)
      if (slot.scheduled_start < unavailBefore) {
        conflicts.push({
          type: 'availability',
          severity: 'warning',
          team_id: teamId,
          team_name: team?.name,
          message: `${team?.name} requested no games before ${team.constraints.unavailable_before}`,
        })
      }
    }

    if (team?.constraints?.unavailable_after) {
      const unavailAfter = parseLocalTime(team.constraints.unavailable_after, slot.scheduled_start)
      if (slot.scheduled_end > unavailAfter) {
        conflicts.push({
          type: 'availability',
          severity: 'warning',
          team_id: teamId,
          team_name: team?.name,
          message: `${team?.name} requested no games after ${team.constraints.unavailable_after}`,
        })
      }
    }
  }

  return {
    ok: conflicts.filter(c => c.severity === 'error').length === 0,
    conflicts,
  }
}


// ─────────────────────────────────────────────────────────────
// STEP 5: ASSIGN MATCHES TO SLOTS
// Core scheduling algorithm
// ─────────────────────────────────────────────────────────────

/**
 * Assign matches to time slots using a greedy algorithm.
 *
 * Strategy:
 * 1. Sort matches by round (so round 1 games are scheduled before round 2)
 * 2. Within each round, try to parallelize across venues
 * 3. For each match, find the earliest available slot with no hard conflicts
 * 4. Track soft conflicts separately (shown to director, not blocking)
 *
 * @param {ScheduledMatch[]} matches
 * @param {TimeSlot[]}       slots
 * @param {ScheduleConfig}   config
 * @param {Team[]}           allTeams
 * @returns {{ assigned: ScheduledMatch[], slots: TimeSlot[], conflicts: Conflict[] }}
 */
export function assignMatchesToSlots(matches, slots, config, allTeams) {
  const { min_rest_between_team_games = 90 } = config

  // Work with copies
  const assignedMatches = matches.map(m => ({ ...m }))
  const workingSlots = slots.map(s => ({ ...s }))
  const allConflicts = []

  // Index slots by venue and start time for quick lookup
  const slotsByVenue = new Map()
  for (const slot of workingSlots) {
    if (!slotsByVenue.has(slot.venue_id)) {
      slotsByVenue.set(slot.venue_id, [])
    }
    slotsByVenue.get(slot.venue_id).push(slot)
  }

  // Sort venues for round-robin distribution
  const venueIds = [...slotsByVenue.keys()]
  let venueIndex = 0

  // Track team schedule as we assign
  const teamScheduleMap = new Map()

  // Sort matches: by round first, then within round by pool
  // to keep same-pool games together visually on the schedule
  assignedMatches.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round
    return a.pool_id.localeCompare(b.pool_id)
  })

  for (const match of assignedMatches) {
    // Bye games don't need slots
    if (match.is_bye) continue

    let assigned = false

    // Try each venue in round-robin order (for balance across fields)
    for (let attempt = 0; attempt < venueIds.length && !assigned; attempt++) {
      const venueId = venueIds[(venueIndex + attempt) % venueIds.length]
      const venueSlots = slotsByVenue.get(venueId)

      for (const slot of venueSlots) {
        if (slot.assigned_match_id) continue // slot taken

        const { ok, conflicts } = checkSlotConflicts(
          match, slot, teamScheduleMap, min_rest_between_team_games, allTeams
        )

        if (ok) {
          // Assign
          slot.assigned_match_id = match.id
          match.slot_id = slot.id
          match.venue_id = venueId
          match.scheduled_start = new Date(slot.scheduled_start)
          match.scheduled_end = new Date(slot.scheduled_end)

          // Update team schedule map
          for (const teamId of [match.team_a_id, match.team_b_id]) {
            if (!teamId || teamId === 'bye') continue
            if (!teamScheduleMap.has(teamId)) teamScheduleMap.set(teamId, [])
            teamScheduleMap.get(teamId).push(slot.scheduled_start)
          }

          // Still collect soft conflict warnings
          allConflicts.push(...conflicts)

          assigned = true
          venueIndex = (venueIndex + 1) % venueIds.length
          break
        } else {
          // Collect all conflicts for director review
          allConflicts.push(...conflicts)
        }
      }
    }

    if (!assigned) {
      allConflicts.push({
        type: 'no_slot_available',
        severity: 'error',
        team_id: match.team_a_id,
        message: `Could not find a valid slot for ${match.team_a_id} vs ${match.team_b_id} (Round ${match.round}). Add more venues or extend end time.`,
      })
    }
  }

  return {
    assigned: assignedMatches,
    slots: workingSlots,
    conflicts: deduplicateConflicts(allConflicts),
  }
}


// ─────────────────────────────────────────────────────────────
// STEP 6: POOL VALIDATOR
// Checks pool composition for same-club conflicts
// ─────────────────────────────────────────────────────────────

/**
 * Check if pools have same-club or same-school teams together.
 * Returns warnings for director review (not blocking in Phase 1).
 *
 * @param {Pool[]} pools
 * @returns {Conflict[]}
 */
export function validatePoolComposition(pools) {
  const conflicts = []

  for (const pool of pools) {
    const clubCounts = new Map()

    for (const team of pool.teams) {
      const key = team.club_name || team.school_name
      if (!key) continue
      if (!clubCounts.has(key)) clubCounts.set(key, [])
      clubCounts.get(key).push(team)
    }

    for (const [club, teams] of clubCounts) {
      if (teams.length > 1) {
        conflicts.push({
          type: 'club_conflict',
          severity: 'warning',
          team_id: teams[0].id,
          message: `Pool ${pool.name}: ${teams.map(t => t.name).join(' and ')} are both from ${club}`,
          teams: teams.map(t => t.id),
          pool_id: pool.id,
        })
      }
    }
  }

  return conflicts
}


// ─────────────────────────────────────────────────────────────
// STEP 7: POOL GENERATION
// Given N teams, suggest optimal pool structure
// ─────────────────────────────────────────────────────────────

/**
 * Calculate optimal pool structure for N teams.
 * Returns multiple options for director to choose from.
 *
 * @param {number} teamCount
 * @param {Object} options
 * @param {number} [options.minGamesGuaranteed=2]
 * @param {number} [options.preferredPoolSize=4]
 * @returns {PoolOption[]}
 */
export function suggestPoolStructure(teamCount, options = {}) {
  const { minGamesGuaranteed = 2, preferredPoolSize = 4 } = options
  const suggestions = []

  // Option A: Pools of 4 (most common)
  if (teamCount >= 4) {
    suggestions.push(...buildPoolOption(teamCount, 4, 'Pools of 4'))
  }

  // Option B: Pools of 3
  if (teamCount >= 3) {
    suggestions.push(...buildPoolOption(teamCount, 3, 'Pools of 3'))
  }

  // Option C: Pools of 5
  if (teamCount >= 5 && teamCount > 10) {
    suggestions.push(...buildPoolOption(teamCount, 5, 'Pools of 5'))
  }

  // Option D: Single round-robin (all teams, small tournaments)
  if (teamCount <= 8) {
    suggestions.push({
      type: 'round_robin',
      description: 'Single round robin (all teams)',
      pools: [{ size: teamCount, count: 1 }],
      guaranteed_games: teamCount - 1,
      total_matches: (teamCount * (teamCount - 1)) / 2,
      byes: 0,
      flex_games: 0,
    })
  }

  // Score and sort by "fairness" (minimize bye/flex games, maximize guaranteed games)
  return suggestions
    .filter(s => s.guaranteed_games >= minGamesGuaranteed)
    .sort((a, b) => {
      // Prefer options with more guaranteed games
      if (b.guaranteed_games !== a.guaranteed_games) {
        return b.guaranteed_games - a.guaranteed_games
      }
      // Then prefer fewer bye/flex games
      return (a.byes + a.flex_games) - (b.byes + b.flex_games)
    })
}

/**
 * @private
 */
function buildPoolOption(teamCount, poolSize, label) {
  const fullPools = Math.floor(teamCount / poolSize)
  const remainder = teamCount % poolSize

  if (remainder === 0) {
    // Perfect fit
    const gamesPerTeam = poolSize - 1
    return [{
      type: 'pool_play',
      description: `${fullPools} ${label} (perfect fit)`,
      pools: [{ size: poolSize, count: fullPools }],
      guaranteed_games: gamesPerTeam,
      total_matches: fullPools * ((poolSize * (poolSize - 1)) / 2),
      byes: 0,
      flex_games: 0,
    }]
  }

  const options = []

  // Approach 1: One smaller pool
  if (remainder >= 2) {
    options.push({
      type: 'pool_play',
      description: `${fullPools} ${label} + 1 pool of ${remainder}`,
      pools: [
        { size: poolSize, count: fullPools },
        { size: remainder, count: 1 },
      ],
      guaranteed_games: Math.min(poolSize - 1, remainder - 1),
      total_matches:
        fullPools * ((poolSize * (poolSize - 1)) / 2) +
        (remainder * (remainder - 1)) / 2,
      byes: 0,
      flex_games: 0,
      note: `Teams in the pool of ${remainder} play ${remainder - 1} guaranteed games vs ${poolSize - 1} for others`,
    })
  }

  // Approach 2: Flex cross-pool games to equalize game count
  if (remainder >= 2) {
    const flexGamesNeeded = poolSize - remainder
    options.push({
      type: 'pool_play_flex',
      description: `${fullPools} ${label} + 1 pool of ${remainder} + ${flexGamesNeeded} cross-pool flex game(s)`,
      pools: [
        { size: poolSize, count: fullPools },
        { size: remainder, count: 1 },
      ],
      guaranteed_games: poolSize - 1,
      total_matches:
        fullPools * ((poolSize * (poolSize - 1)) / 2) +
        (remainder * (remainder - 1)) / 2 +
        flexGamesNeeded,
      byes: 0,
      flex_games: flexGamesNeeded,
      note: `${flexGamesNeeded} cross-pool game(s) give all teams ${poolSize - 1} guaranteed games`,
    })
  }

  // Approach 3: Byes (add empty slots to reach next even number)
  const byesNeeded = poolSize - remainder
  if (byesNeeded < poolSize / 2) {
    options.push({
      type: 'pool_play_byes',
      description: `${fullPools + 1} ${label} with ${byesNeeded} bye(s)`,
      pools: [{ size: poolSize, count: fullPools + 1 }],
      guaranteed_games: poolSize - 1,
      total_matches:
        (fullPools + 1) * ((poolSize * (poolSize - 1)) / 2) -
        byesNeeded * (poolSize - 1),
      byes: byesNeeded,
      flex_games: 0,
      note: `${byesNeeded} team(s) receive a bye — they auto-advance in one round`,
    })
  }

  return options
}


// ─────────────────────────────────────────────────────────────
// STEP 8: SERPENTINE SEEDING
// Distributes seeded teams across pools fairly
// ─────────────────────────────────────────────────────────────

/**
 * Assign seeds to pools using serpentine (snake) seeding.
 * Ensures balanced pool strength.
 *
 * Seeds 1,2,3 go to pools A,B,C
 * Seeds 4,5,6 go to pools C,B,A (reverse)
 * Seeds 7,8,9 go to pools A,B,C (forward again)
 * etc.
 *
 * @param {Team[]} teams       - sorted by seed ascending
 * @param {number} numPools
 * @returns {Map<string, string>} - team_id → pool_id (use pool index as stand-in)
 */
export function serpentineSeeding(teams, numPools) {
  const assignments = new Map() // team_id → pool_index (0-based)
  const poolIndices = Array.from({ length: numPools }, (_, i) => i)

  let forward = true
  const order = [...poolIndices]

  for (let i = 0; i < teams.length; i++) {
    if (i > 0 && i % numPools === 0) {
      forward = !forward
    }

    const poolIndex = forward
      ? order[i % numPools]
      : order[numPools - 1 - (i % numPools)]

    assignments.set(teams[i].id, poolIndex)
  }

  return assignments
}


// ─────────────────────────────────────────────────────────────
// STEP 9: GLOBAL DELAY
// Recalculates slot times after a delay is applied
// ─────────────────────────────────────────────────────────────

/**
 * Apply a global delay to all slots from a given time onwards.
 * Returns updated slots — call updateTimeSlots() to persist.
 *
 * @param {TimeSlot[]} slots
 * @param {Date}       fromTime      - apply to slots at or after this time
 * @param {number}     offsetMinutes - how many minutes to delay
 * @param {string}     [venueId]     - if set, only delay this venue
 * @returns {TimeSlot[]}             - updated slots with new times
 */
export function applyScheduleDelay(slots, fromTime, offsetMinutes, venueId = null) {
  return slots.map(slot => {
    const shouldApply =
      slot.scheduled_start >= fromTime &&
      (venueId === null || slot.venue_id === venueId)

    if (!shouldApply) return slot

    return {
      ...slot,
      scheduled_start: addMinutes(slot.scheduled_start, offsetMinutes),
      scheduled_end: addMinutes(slot.scheduled_end, offsetMinutes),
      offset_minutes: (slot.offset_minutes || 0) + offsetMinutes,
    }
  })
}


// ─────────────────────────────────────────────────────────────
// STEP 10: STATS
// Summary statistics for the generated schedule
// ─────────────────────────────────────────────────────────────

/**
 * @param {ScheduledMatch[]} matches
 * @param {TimeSlot[]} slots
 * @param {Conflict[]} conflicts
 * @returns {ScheduleStats}
 */
function buildStats(matches, slots, conflicts) {
  const assignedMatches = matches.filter(m => m.slot_id && !m.is_bye)
  const usedSlots = slots.filter(s => s.assigned_match_id)

  // Games per team
  const teamGameCount = new Map()
  for (const match of assignedMatches) {
    for (const tid of [match.team_a_id, match.team_b_id]) {
      if (!tid || tid === 'bye') continue
      teamGameCount.set(tid, (teamGameCount.get(tid) || 0) + 1)
    }
  }
  const gameCounts = [...teamGameCount.values()]

  const assignedTimes = assignedMatches
    .map(m => m.scheduled_start)
    .filter(Boolean)
    .sort((a, b) => a - b)

  return {
    total_matches: matches.filter(m => !m.is_bye).length,
    total_slots: slots.length,
    slots_used: usedSlots.length,
    slots_free: slots.length - usedSlots.length,
    conflicts_count: conflicts.length,
    games_per_team_min: gameCounts.length ? Math.min(...gameCounts) : 0,
    games_per_team_max: gameCounts.length ? Math.max(...gameCounts) : 0,
    earliest_game: assignedTimes[0] || null,
    latest_game: assignedTimes[assignedTimes.length - 1] || null,
  }
}


// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function deduplicateConflicts(conflicts) {
  const seen = new Set()
  return conflicts.filter(c => {
    const key = `${c.type}:${c.team_id}:${c.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}


// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * Generate a complete schedule for a tournament.
 *
 * @param {ScheduleConfig} config
 * @returns {ScheduleResult}
 */
export function generateSchedule(config) {
  const allMatches = []
  const allTeams = []

  // Collect all teams across all pools
  for (const pool of config.pools) {
    allTeams.push(...pool.teams)
  }

  // Step 1: Generate matchups for each pool
  for (const pool of config.pools) {
    const matches = generatePoolMatchups(pool)
    allMatches.push(...matches)
  }

  // Step 2: Check pool composition for club/school conflicts
  const poolConflicts = validatePoolComposition(config.pools)

  // Step 3: Generate all available time slots
  const slots = generateTimeSlots(config)

  // Step 4: Assign matches to slots
  const { assigned, slots: updatedSlots, conflicts: scheduleConflicts } =
    assignMatchesToSlots(allMatches, slots, config, allTeams)

  // Combine all conflicts
  const allConflicts = deduplicateConflicts([...poolConflicts, ...scheduleConflicts])

  // Step 5: Build stats
  const stats = buildStats(assigned, updatedSlots, allConflicts)

  return {
    slots: updatedSlots,
    matches: assigned,
    conflicts: allConflicts,
    stats,
  }
}


// ─────────────────────────────────────────────────────────────
// BRACKET GENERATION
// Generates single-elimination bracket from pool standings
// ─────────────────────────────────────────────────────────────

/**
 * Generate single-elimination bracket slots from pool standings.
 *
 * @param {Object[]} standings       - pool standings sorted by rank
 *   Each: { team_id, pool_id, rank, pool_short_name }
 * @param {string}   division_id
 * @param {Object}   options
 * @param {boolean}  [options.third_place_game=false]
 * @param {boolean}  [options.consolation=false]
 * @returns {{ bracket_slots: Object[], matches: Object[] }}
 */
export function generateSingleEliminationBracket(standings, division_id, options = {}) {
  const { third_place_game = false } = options

  // Sort by bracket seed:
  // Pool winners first (seeded by pool finish order),
  // then runners-up, then wildcards
  const bracketOrder = buildBracketSeedOrder(standings)
  const n = bracketOrder.length
  const bracketSize = nextPowerOf2(n)
  const byesNeeded = bracketSize - n

  const bracketSlots = []
  const matches = []

  // Calculate number of rounds
  const numRounds = Math.log2(bracketSize)

  // Round 1: place teams + byes
  const round1Slots = bracketSize / 2
  let teamIndex = 0

  for (let pos = 1; pos <= round1Slots; pos++) {
    const slotId = generateId()
    const matchId = generateId()

    const teamA = bracketOrder[teamIndex++]
    const teamB = teamIndex < bracketOrder.length ? bracketOrder[teamIndex++] : null
    const isBye = !teamB

    // Calculate which slot this winner goes to (next round)
    const nextRoundPos = Math.ceil(pos / 2)

    bracketSlots.push({
      id: slotId,
      division_id,
      phase: 2,
      round: 1,
      position: pos,
      bracket_side: 'winners',
      label: isBye ? `Seed ${teamA?.seed} - Bye` : `Round of ${bracketSize}`,
      team_a_id: teamA?.team_id || null,
      team_b_id: teamB?.team_id || null,
      team_a_source: teamA ? `pool_seed:${teamA.pool_short_name}${teamA.rank}` : null,
      team_b_source: teamB ? `pool_seed:${teamB.pool_short_name}${teamB.rank}` : null,
      match_id: matchId,
    })

    matches.push({
      id: matchId,
      division_id,
      phase: 2,
      round: 1,
      match_number: pos,
      bracket_position: `R1-${pos}`,
      team_a_id: teamA?.team_id || null,
      team_b_id: teamB?.team_id || null,
      is_bye: isBye,
      winner_next_slot: pos % 2 === 1 ? 'team_a' : 'team_b',
      round_label: isBye ? 'Bye' : getRoundLabel(1, numRounds),
      status: 'scheduled',
    })
  }

  // Subsequent rounds (auto-populated by DB trigger as teams advance)
  for (let round = 2; round <= numRounds; round++) {
    const slotsInRound = bracketSize / Math.pow(2, round)

    for (let pos = 1; pos <= slotsInRound; pos++) {
      const slotId = generateId()
      const matchId = generateId()

      bracketSlots.push({
        id: slotId,
        division_id,
        phase: 2,
        round,
        position: pos,
        bracket_side: 'winners',
        label: getRoundLabel(round, numRounds),
        team_a_id: null, // TBD — filled by trigger
        team_b_id: null,
        team_a_source: `winner:R${round - 1}-${pos * 2 - 1}`,
        team_b_source: `winner:R${round - 1}-${pos * 2}`,
        match_id: matchId,
      })

      matches.push({
        id: matchId,
        division_id,
        phase: 2,
        round,
        match_number: round * 100 + pos,
        bracket_position: `R${round}-${pos}`,
        team_a_id: null,
        team_b_id: null,
        is_bye: false,
        winner_next_slot: pos % 2 === 1 ? 'team_a' : 'team_b',
        round_label: getRoundLabel(round, numRounds),
        status: 'scheduled',
      })
    }
  }

  // Third place game
  if (third_place_game && numRounds >= 2) {
    const matchId = generateId()
    const slotId = generateId()

    bracketSlots.push({
      id: slotId,
      division_id,
      phase: 2,
      round: numRounds,
      position: 2, // position 1 = final, position 2 = third place
      bracket_side: 'consolation',
      label: '3rd Place',
      team_a_id: null,
      team_b_id: null,
      team_a_source: `loser:R${numRounds - 1}-1`,
      team_b_source: `loser:R${numRounds - 1}-2`,
      match_id: matchId,
    })

    matches.push({
      id: matchId,
      division_id,
      phase: 2,
      round: numRounds,
      match_number: 999,
      bracket_position: '3rd',
      team_a_id: null,
      team_b_id: null,
      is_bye: false,
      round_label: '3rd Place',
      status: 'scheduled',
    })
  }

  // Wire up winner_next_match_id / loser_next_match_id
  // (link bracket slots into the matches table structure)
  wireUpBracketAdvancement(matches, bracketSlots)

  return { bracket_slots: bracketSlots, matches }
}


/**
 * Order teams for bracket seeding.
 * Standard pool-to-bracket seeding:
 *   Seed 1: 1st Pool A
 *   Seed 2: 1st Pool B
 *   Seed 3: 1st Pool C
 *   Seed 4: 2nd Pool A
 *   ...
 *
 * @private
 */
function buildBracketSeedOrder(standings) {
  // Group by rank within pool
  const byRank = new Map()
  for (const s of standings) {
    if (!byRank.has(s.rank)) byRank.set(s.rank, [])
    byRank.get(s.rank).push(s)
  }

  const ordered = []
  const maxRank = Math.max(...standings.map(s => s.rank))

  for (let rank = 1; rank <= maxRank; rank++) {
    const atRank = byRank.get(rank) || []
    // Sort within same rank by pool name (Pool A before Pool B etc.)
    atRank.sort((a, b) => a.pool_short_name.localeCompare(b.pool_short_name))
    ordered.push(...atRank.map((s, i) => ({ ...s, seed: (rank - 1) * atRank.length + i + 1 })))
  }

  return ordered
}

/** @private */
function nextPowerOf2(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** @private */
function getRoundLabel(round, totalRounds) {
  const roundsFromEnd = totalRounds - round
  if (roundsFromEnd === 0) return 'Final'
  if (roundsFromEnd === 1) return 'Semifinal'
  if (roundsFromEnd === 2) return 'Quarterfinal'
  const bracketSize = Math.pow(2, totalRounds - round + 1)
  return `Round of ${bracketSize}`
}

/** @private */
function wireUpBracketAdvancement(matches, slots) {
  // Build lookup: position string → match
  const matchByPosition = new Map()
  for (const m of matches) {
    matchByPosition.set(m.bracket_position, m)
  }

  for (const slot of slots) {
    if (!slot.team_a_source || !slot.team_b_source) continue

    const aSource = slot.team_a_source
    const bSource = slot.team_b_source

    // Parse "winner:R2-1" → find match at R2-1 and set its winner_next_match_id
    for (const [source, nextSlot] of [[aSource, 'team_a'], [bSource, 'team_b']]) {
      if (!source.startsWith('winner:')) continue
      const sourcePos = source.replace('winner:', '')
      const sourceMatch = matchByPosition.get(sourcePos)
      if (sourceMatch && slot.match_id) {
        sourceMatch.winner_next_match_id = slot.match_id
        sourceMatch.winner_next_slot = nextSlot
      }
    }
  }
}


// ─────────────────────────────────────────────────────────────
// TIE-BREAKER ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * Apply configured tie-breaker order to rank teams in a pool.
 * Returns teams sorted by rank (1 = best).
 *
 * @param {Object[]} teamStats      - pool_standings rows
 * @param {Object[]} headToHead     - all completed matches in this pool
 * @param {string[]} tiebreakerOrder - e.g. ['head_to_head','point_diff',...]
 * @returns {Object[]}              - sorted teamStats with rank assigned
 */
export function applyTiebreakers(teamStats, headToHead, tiebreakerOrder) {
  // Primary sort: wins descending
  let sorted = [...teamStats].sort((a, b) => b.wins - a.wins)

  // Find groups of tied teams (same win count)
  const groups = groupBy(sorted, t => t.wins)

  const result = []

  for (const [wins, group] of Object.entries(groups).sort(([a], [b]) => b - a)) {
    if (group.length === 1) {
      result.push(...group)
      continue
    }

    // Apply tie-breakers within this tied group
    const ranked = resolveTies(group, headToHead, tiebreakerOrder)
    result.push(...ranked)
  }

  // Assign ranks
  result.forEach((team, i) => {
    team.rank = i + 1
    team.is_tied = false
  })

  // Mark teams that are still tied after all tie-breakers
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].wins === result[i + 1].wins &&
        result[i].point_diff === result[i + 1].point_diff &&
        result[i].points_scored === result[i + 1].points_scored) {
      result[i].is_tied = true
      result[i + 1].is_tied = true
    }
  }

  return result
}

/** @private */
function resolveTies(group, allMatches, order) {
  if (group.length <= 1) return group

  for (const criterion of order) {
    let sorted

    switch (criterion) {
      case 'head_to_head': {
        // Only look at games between tied teams
        const tiedIds = new Set(group.map(t => t.team_id))
        const h2h = allMatches.filter(
          m => tiedIds.has(m.team_a_id) && tiedIds.has(m.team_b_id) && m.status === 'complete'
        )

        if (h2h.length === 0) continue

        // Build h2h win map
        const h2hWins = new Map(group.map(t => [t.team_id, 0]))
        for (const match of h2h) {
          if (match.winner_id && h2hWins.has(match.winner_id)) {
            h2hWins.set(match.winner_id, h2hWins.get(match.winner_id) + 1)
          }
        }

        sorted = [...group].sort((a, b) =>
          (h2hWins.get(b.team_id) || 0) - (h2hWins.get(a.team_id) || 0)
        )
        break
      }

      case 'point_diff':
        sorted = [...group].sort((a, b) => b.point_diff - a.point_diff)
        break

      case 'points_scored':
        sorted = [...group].sort((a, b) => b.points_scored - a.points_scored)
        break

      case 'points_against':
        sorted = [...group].sort((a, b) => a.points_against - b.points_against)
        break

      case 'sotg':
        sorted = [...group].sort((a, b) => b.sotg_average - a.sotg_average)
        break

      case 'director':
        // Cannot resolve algorithmically — return as-is, mark as tied
        return group.map(t => ({ ...t, is_tied: true, tie_resolved_by: 'director' }))

      default:
        continue
    }

    // Check if this criterion actually broke the tie
    const isResolved = sorted[0][criterion === 'head_to_head' ? 'wins' : criterion] !==
                      sorted[sorted.length - 1][criterion === 'head_to_head' ? 'wins' : criterion]

    if (isResolved || criterion !== 'director') {
      // Mark how the tie was resolved
      sorted.forEach(t => { t.tie_resolved_by = criterion })
      return sorted
    }
  }

  return group
}

/** @private */
function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}


// ─────────────────────────────────────────────────────────────
// NON-POWER-OF-2 BRACKET HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Determine how to handle a non-power-of-2 team count in bracket.
 *
 * @param {number} teamCount
 * @returns {{ strategy: string, bracketSize: number, byes: number, playInGames: number }}
 */
export function getNonPowerOf2Strategy(teamCount) {
  const bracketSize = nextPowerOf2(teamCount)
  const byes = bracketSize - teamCount
  const byePct = byes / bracketSize

  if (byePct <= 0.25) {
    // Acceptable — use byes, top seeds get them
    return {
      strategy: 'byes',
      bracketSize,
      byes,
      playInGames: 0,
      description: `${bracketSize}-team bracket with ${byes} bye(s) for top seeds`,
    }
  } else {
    // Too many byes — use play-in games instead
    // Teams (byes*2) lowest seeds play in, winners fill bracket
    const playInTeams = byes * 2
    return {
      strategy: 'play_in',
      bracketSize,
      byes: 0,
      playInGames: byes,
      playInTeams,
      description: `${byes} play-in game(s) between seeds ${teamCount - playInTeams + 1}–${teamCount}`,
    }
  }
}
