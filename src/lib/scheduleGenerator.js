// scheduleGenerator.js
// Full implementation delivered separately (scheduleGenerator.js output file).
// This file contains the subset needed by WizardStep5Teams.

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
 * e.g. 8 teams, 2 pools: Pool A gets seeds 1,4,5,8 / Pool B gets 2,3,6,7
 */
export function serpentineSeeding(teams, numPools) {
  if (!teams || teams.length === 0 || numPools <= 0) return teams

  const sorted = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
  const result = []
  let forward  = true

  for (let round = 0; round < Math.ceil(sorted.length / numPools); round++) {
    const slice = sorted.slice(round * numPools, (round + 1) * numPools)
    result.push(...(forward ? slice : [...slice].reverse()))
    forward = !forward
  }

  return result
}

/**
 * Generate a full tournament schedule.
 * Full implementation - called by WizardStep6Schedule.
 */
export function generateSchedule(config) {
  const {
    pools = [],
    venues = [],
    startTime,
    endTime,
    lunchBreakStart,
    lunchBreakEnd,
    gameDurationMinutes      = 90,
    breakBetweenGamesMinutes = 30,
    minRestBetweenTeamGames  = 90,
    tournamentId,
  } = config

  if (!startTime || venues.length === 0) {
    return { slots: [], matches: [], conflicts: [] }
  }

  const crypto       = globalThis.crypto
  const slotDuration = gameDurationMinutes + breakBetweenGamesMinutes
  const start        = new Date(startTime)
  const end          = endTime ? new Date(endTime) : new Date(start.getTime() + 10 * 60 * 60 * 1000)
  const lunchStart   = lunchBreakStart ? new Date(lunchBreakStart) : null
  const lunchEnd     = lunchBreakEnd   ? new Date(lunchBreakEnd)   : null

  // Build time rounds -- all venues play simultaneously within each round
  const timeRounds = []
  let cursor = new Date(start)
  while (cursor < end) {
    if (lunchStart && lunchEnd && cursor >= lunchStart && cursor < lunchEnd) {
      cursor = new Date(lunchEnd)
      continue
    }
    const slotEnd = new Date(cursor.getTime() + gameDurationMinutes * 60 * 1000)
    if (slotEnd > end) break

    timeRounds.push({
      time: new Date(cursor),
      slots: venues.map(venue => ({
        id:              crypto.randomUUID(),
        venue_id:        venue.id,
        scheduled_start: cursor.toISOString(),
        scheduled_end:   slotEnd.toISOString(),
        _assigned:       false,
      })),
    })
    cursor = new Date(cursor.getTime() + slotDuration * 60 * 1000)
  }

  const slots = timeRounds.flatMap(r => r.slots)

  // Assign a home venue to each pool for field affinity
  const poolHomeVenue = {}
  pools.forEach((pool, i) => {
    poolHomeVenue[pool.id] = venues[i % venues.length]?.id ?? venues[0]?.id
  })

  // Generate all matchups, sorted by round so rounds fill across all pools before moving on
  const allMatchups = []
  for (const pool of pools) {
    const matchups = generatePoolMatchups(pool)
    matchups.forEach(m => allMatchups.push({ ...m, pool_id: pool.id, home_venue: poolHomeVenue[pool.id] }))
  }
  allMatchups.sort((a, b) => (a.round ?? 1) - (b.round ?? 1))

  const matches      = []
  const teamLastSlot = {}
  const minRestMs    = minRestBetweenTeamGames * 60 * 1000

  for (const matchup of allMatchups) {
    let assigned = false

    for (const round of timeRounds) {
      const slotTimeMs = round.time.getTime()
      const slotEndMs  = slotTimeMs + gameDurationMinutes * 60 * 1000

      const aLast = teamLastSlot[matchup.team_a_id]
      const bLast = teamLastSlot[matchup.team_b_id]
      if (aLast && slotTimeMs - aLast < minRestMs) continue
      if (bLast && slotTimeMs - bLast < minRestMs) continue

      // Prefer home venue, fall back to any free slot in this round
      const slot = round.slots.find(s => !s._assigned && s.venue_id === matchup.home_venue)
               ?? round.slots.find(s => !s._assigned)
      if (!slot) continue

      slot._assigned = true
      teamLastSlot[matchup.team_a_id] = slotEndMs
      teamLastSlot[matchup.team_b_id] = slotEndMs

      matches.push({
        id:           crypto.randomUUID(),
        pool_id:      matchup.pool_id,
        team_a_id:    matchup.team_a_id,
        team_b_id:    matchup.team_b_id,
        slot_id:      slot.id,
        venue_id:     slot.venue_id,
        round:        matchup.round,
        match_number: matches.length + 1,
      })
      assigned = true
      break
    }

    if (!assigned) {
      matches.push({
        id:           crypto.randomUUID(),
        pool_id:      matchup.pool_id,
        team_a_id:    matchup.team_a_id,
        team_b_id:    matchup.team_b_id,
        slot_id:      null,
        venue_id:     null,
        round:        matchup.round,
        match_number: matches.length + 1,
      })
    }
  }
  const conflicts = validateSchedule(matches, slots, teamLastSlot, minRestBetweenTeamGames)

  return { slots, matches, conflicts }
}

/**
 * Generate round-robin matchups for a pool using the circle method.
 */
export function generatePoolMatchups(pool) {
  const teams = pool.teams ?? []
  if (teams.length < 2) return []

  const n        = teams.length % 2 === 0 ? teams.length : teams.length + 1
  const fixed    = teams[0]
  const rotating = [...teams.slice(1)]
  const matchups = []
  let round      = 1

  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rotating]
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const a = roundTeams[i]
      const b = roundTeams[n - 1 - i]
      if (a && b && a.id !== b.id) {
        matchups.push({ team_a_id: a.id, team_b_id: b.id, round })
      }
    }
    rotating.unshift(rotating.pop())
    round++
  }

  return matchups
}

/**
 * Validate a generated schedule and return conflict objects.
 */
function validateSchedule(matches, slots, teamLastSlot, minRestMinutes) {
  const conflicts = []
  const slotMap   = Object.fromEntries(slots.map(s => [s.id, s]))
  const teamGames = {}

  for (const match of matches) {
    if (!match.slot_id) {
      conflicts.push({
        type:     'unscheduled',
        severity: 'error',
        teamId:   match.team_a_id,
        matchIds: [match.id],
        message:  'A game could not be scheduled - not enough time slots',
      })
      continue
    }

    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamGames[teamId]) teamGames[teamId] = []
      teamGames[teamId].push(match)
    }
  }

  // Check rest times
  for (const [teamId, games] of Object.entries(teamGames)) {
    const sorted = games
      .filter(g => g.slot_id && slotMap[g.slot_id])
      .sort((a, b) => new Date(slotMap[a.slot_id].scheduled_start) - new Date(slotMap[b.slot_id].scheduled_start))

    for (let i = 1; i < sorted.length; i++) {
      const prev    = new Date(slotMap[sorted[i - 1].slot_id].scheduled_end).getTime()
      const next    = new Date(slotMap[sorted[i].slot_id].scheduled_start).getTime()
      const restMin = (next - prev) / 60000

      if (restMin < minRestMinutes) {
        conflicts.push({
          type:     'rest_time',
          severity: restMin < 30 ? 'error' : 'warning',
          teamId,
          matchIds: [sorted[i - 1].id, sorted[i].id],
          message:  `A team has only ${Math.round(restMin)} min rest between games (minimum ${minRestMinutes} min)`,
        })
      }
    }
  }

  return conflicts
}

/**
 * Apply a delay offset to all slots at or after a given time.
 */
export function applyScheduleDelay(slots, fromTime, offsetMinutes, venueId = null) {
  return slots.map(slot => {
    const slotTime = new Date(slot.scheduled_start).getTime()
    const fromMs   = new Date(fromTime).getTime()
    if (slotTime < fromMs) return slot
    if (venueId && slot.venue_id !== venueId) return slot

    return {
      ...slot,
      scheduled_start: new Date(slotTime + offsetMinutes * 60000).toISOString(),
      scheduled_end:   new Date(new Date(slot.scheduled_end).getTime() + offsetMinutes * 60000).toISOString(),
      offset_minutes:  (slot.offset_minutes ?? 0) + offsetMinutes,
    }
  })
}

/**
 * Tiebreaker calculation - returns teams sorted by tiebreaker order.
 */
export function applyTiebreakers(teamStats, headToHead, tiebreakerOrder) {
  return [...teamStats].sort((a, b) => {
    for (const rule of tiebreakerOrder) {
      let diff = 0
      switch (rule) {
        case 'head_to_head': {
          const h2h = headToHead?.[a.team_id]?.[b.team_id]
          if (h2h !== undefined) diff = h2h > 0 ? -1 : h2h < 0 ? 1 : 0
          break
        }
        case 'point_diff':     diff = (b.point_diff ?? 0)     - (a.point_diff ?? 0);     break
        case 'points_scored':  diff = (b.points_scored ?? 0)  - (a.points_scored ?? 0);  break
        case 'points_against': diff = (a.points_against ?? 0) - (b.points_against ?? 0); break
        case 'sotg':           diff = (b.sotg_average ?? 0)   - (a.sotg_average ?? 0);   break
        default: break
      }
      if (diff !== 0) return diff
    }
    return 0
  })
}

/**
 * Generate a single-elimination bracket from pool standings.
 */
export function generateSingleEliminationBracket(standings, divisionId, options = {}) {
  const { includeThirdPlace = false } = options
  const n     = standings.length
  const size  = Math.pow(2, Math.ceil(Math.log2(n)))
  const byes  = size - n
  const slots = []
  const crypto = globalThis.crypto

  // Round 1
  const seeded = [...standings]
  while (seeded.length < size) seeded.push(null)

  const round1 = []
  for (let i = 0; i < size / 2; i++) {
    const top    = seeded[i]
    const bottom = seeded[size - 1 - i]
    round1.push({
      id:          crypto.randomUUID(),
      division_id: divisionId,
      round:       1,
      position:    i + 1,
      phase:       2,
      team_a_id:   top?.team_id    ?? null,
      team_b_id:   bottom?.team_id ?? null,
      team_a_source: top    ? `${top.rank} seed`    : null,
      team_b_source: bottom ? `${bottom.rank} seed` : null,
      is_bye:      !bottom,
      bracket_side: 'winners',
    })
  }

  slots.push(...round1)
  return slots
}
