const crypto = globalThis.crypto

/**
 * Generate first-round playoff matches for a 4-pool / 16-team format.
 *
 * standingsByPool format:
 * {
 *   A: [{ rank: 1, team_id: '...' }, { rank: 2, team_id: '...' }, ...],
 *   B: [...],
 *   C: [...],
 *   D: [...]
 * }
 *
 * Returns concrete match objects compatible with your current match shape.
 */
export function generate4PoolPlayoffRound1({
  standingsByPool,
  divisionId,
}) {
  validate4PoolStandings(standingsByPool)

  const A1 = getSeed(standingsByPool, 'A', 1)
  const A2 = getSeed(standingsByPool, 'A', 2)
  const A3 = getSeed(standingsByPool, 'A', 3)
  const A4 = getSeed(standingsByPool, 'A', 4)

  const B1 = getSeed(standingsByPool, 'B', 1)
  const B2 = getSeed(standingsByPool, 'B', 2)
  const B3 = getSeed(standingsByPool, 'B', 3)
  const B4 = getSeed(standingsByPool, 'B', 4)

  const C1 = getSeed(standingsByPool, 'C', 1)
  const C2 = getSeed(standingsByPool, 'C', 2)
  const C3 = getSeed(standingsByPool, 'C', 3)
  const C4 = getSeed(standingsByPool, 'C', 4)

  const D1 = getSeed(standingsByPool, 'D', 1)
  const D2 = getSeed(standingsByPool, 'D', 2)
  const D3 = getSeed(standingsByPool, 'D', 3)
  const D4 = getSeed(standingsByPool, 'D', 4)

  return [
    createPlayoffMatch({
      code: 'CQF1',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'championship',
      team_a_id: A1.team_id,
      team_b_id: B2.team_id,
      source_label: 'A1 vs B2',
    }),
    createPlayoffMatch({
      code: 'CQF2',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'championship',
      team_a_id: B1.team_id,
      team_b_id: A2.team_id,
      source_label: 'B1 vs A2',
    }),
    createPlayoffMatch({
      code: 'CQF3',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'championship',
      team_a_id: C1.team_id,
      team_b_id: D2.team_id,
      source_label: 'C1 vs D2',
    }),
    createPlayoffMatch({
      code: 'CQF4',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'championship',
      team_a_id: D1.team_id,
      team_b_id: C2.team_id,
      source_label: 'D1 vs C2',
    }),

    createPlayoffMatch({
      code: 'LQF1',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'consolation',
      team_a_id: A3.team_id,
      team_b_id: B4.team_id,
      source_label: 'A3 vs B4',
    }),
    createPlayoffMatch({
      code: 'LQF2',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'consolation',
      team_a_id: B3.team_id,
      team_b_id: A4.team_id,
      source_label: 'B3 vs A4',
    }),
    createPlayoffMatch({
      code: 'LQF3',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'consolation',
      team_a_id: C3.team_id,
      team_b_id: D4.team_id,
      source_label: 'C3 vs D4',
    }),
    createPlayoffMatch({
      code: 'LQF4',
      division_id: divisionId,
      phase: 2,
      round: 1,
      bracket_type: 'consolation',
      team_a_id: D3.team_id,
      team_b_id: C4.team_id,
      source_label: 'D3 vs C4',
    }),
  ]
}

/**
 * Generate round 2 playoff matches from completed quarterfinals.
 *
 * Requires results in completedMatches:
 * [
 *   { code: 'CQF1', team_a_id, team_b_id, winner_id, loser_id },
 *   ...
 * ]
 */
export function generate4PoolPlayoffRound2({
  divisionId,
  completedMatches,
}) {
  const map = mapByCode(completedMatches)

  requireMatchCodes(map, [
    'CQF1', 'CQF2', 'CQF3', 'CQF4',
    'LQF1', 'LQF2', 'LQF3', 'LQF4',
  ])

  return [
    createPlayoffMatch({
      code: 'CSF1',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'championship',
      team_a_id: map.CQF1.winner_id,
      team_b_id: map.CQF2.winner_id,
      source_label: 'Winner CQF1 vs Winner CQF2',
    }),
    createPlayoffMatch({
      code: 'CSF2',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'championship',
      team_a_id: map.CQF3.winner_id,
      team_b_id: map.CQF4.winner_id,
      source_label: 'Winner CQF3 vs Winner CQF4',
    }),

    createPlayoffMatch({
      code: 'P5SF1',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-5-8',
      team_a_id: map.CQF1.loser_id,
      team_b_id: map.CQF2.loser_id,
      source_label: 'Loser CQF1 vs Loser CQF2',
    }),
    createPlayoffMatch({
      code: 'P5SF2',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-5-8',
      team_a_id: map.CQF3.loser_id,
      team_b_id: map.CQF4.loser_id,
      source_label: 'Loser CQF3 vs Loser CQF4',
    }),

    createPlayoffMatch({
      code: 'C9SF1',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-9-12',
      team_a_id: map.LQF1.winner_id,
      team_b_id: map.LQF2.winner_id,
      source_label: 'Winner LQF1 vs Winner LQF2',
    }),
    createPlayoffMatch({
      code: 'C9SF2',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-9-12',
      team_a_id: map.LQF3.winner_id,
      team_b_id: map.LQF4.winner_id,
      source_label: 'Winner LQF3 vs Winner LQF4',
    }),

    createPlayoffMatch({
      code: 'C13SF1',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-13-16',
      team_a_id: map.LQF1.loser_id,
      team_b_id: map.LQF2.loser_id,
      source_label: 'Loser LQF1 vs Loser LQF2',
    }),
    createPlayoffMatch({
      code: 'C13SF2',
      division_id: divisionId,
      phase: 2,
      round: 2,
      bracket_type: 'placement-13-16',
      team_a_id: map.LQF3.loser_id,
      team_b_id: map.LQF4.loser_id,
      source_label: 'Loser LQF3 vs Loser LQF4',
    }),
  ]
}

/**
 * Generate final placement games from completed semifinal-style playoff matches.
 */
export function generate4PoolPlayoffRound3({
  divisionId,
  completedMatches,
  includeThirdPlace = true,
}) {
  const map = mapByCode(completedMatches)

  requireMatchCodes(map, [
    'CSF1', 'CSF2',
    'P5SF1', 'P5SF2',
    'C9SF1', 'C9SF2',
    'C13SF1', 'C13SF2',
  ])

  const games = [
    createPlayoffMatch({
      code: 'FINAL',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'final',
      team_a_id: map.CSF1.winner_id,
      team_b_id: map.CSF2.winner_id,
      source_label: 'Winner CSF1 vs Winner CSF2',
    }),
    createPlayoffMatch({
      code: 'P5',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-5-6',
      team_a_id: map.P5SF1.winner_id,
      team_b_id: map.P5SF2.winner_id,
      source_label: 'Winner P5SF1 vs Winner P5SF2',
    }),
    createPlayoffMatch({
      code: 'P7',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-7-8',
      team_a_id: map.P5SF1.loser_id,
      team_b_id: map.P5SF2.loser_id,
      source_label: 'Loser P5SF1 vs Loser P5SF2',
    }),
    createPlayoffMatch({
      code: 'P9',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-9-10',
      team_a_id: map.C9SF1.winner_id,
      team_b_id: map.C9SF2.winner_id,
      source_label: 'Winner C9SF1 vs Winner C9SF2',
    }),
    createPlayoffMatch({
      code: 'P11',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-11-12',
      team_a_id: map.C9SF1.loser_id,
      team_b_id: map.C9SF2.loser_id,
      source_label: 'Loser C9SF1 vs Loser C9SF2',
    }),
    createPlayoffMatch({
      code: 'P13',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-13-14',
      team_a_id: map.C13SF1.winner_id,
      team_b_id: map.C13SF2.winner_id,
      source_label: 'Winner C13SF1 vs Winner C13SF2',
    }),
    createPlayoffMatch({
      code: 'P15',
      division_id: divisionId,
      phase: 2,
      round: 3,
      bracket_type: 'placement-15-16',
      team_a_id: map.C13SF1.loser_id,
      team_b_id: map.C13SF2.loser_id,
      source_label: 'Loser C13SF1 vs Loser C13SF2',
    }),
  ]

  if (includeThirdPlace) {
    games.push(
      createPlayoffMatch({
        code: 'BRONZE',
        division_id: divisionId,
        phase: 2,
        round: 3,
        bracket_type: 'third-place',
        team_a_id: map.CSF1.loser_id,
        team_b_id: map.CSF2.loser_id,
        source_label: 'Loser CSF1 vs Loser CSF2',
      })
    )
  }

  return games
}

/**
 * Optional helper:
 * Assign already-generated concrete playoff matches to a fresh set of slots.
 */
export function assignPlayoffMatchesToSlots({
  matches,
  venues = [],
  startTime,
  endTime,
  lunchBreakStart,
  lunchBreakEnd,
  gameDurationMinutes = 90,
  breakBetweenGamesMinutes = 30,
  minRestBetweenTeamGames = 90,
}) {
  if (!startTime || venues.length === 0) {
    return { slots: [], matches: [], conflicts: [] }
  }

  const slotDurationMinutes = gameDurationMinutes + breakBetweenGamesMinutes
  const start = new Date(startTime)
  const end = endTime
    ? new Date(endTime)
    : new Date(start.getTime() + 10 * 60 * 60 * 1000)

  const lunchStart = lunchBreakStart ? new Date(lunchBreakStart) : null
  const lunchEnd = lunchBreakEnd ? new Date(lunchBreakEnd) : null

  const timeRounds = buildTimeRounds({
    venues,
    start,
    end,
    lunchStart,
    lunchEnd,
    gameDurationMinutes,
    slotDurationMinutes,
  })

  const matchesToAssign = [...matches].sort((a, b) => {
    if ((a.round ?? 1) !== (b.round ?? 1)) return (a.round ?? 1) - (b.round ?? 1)
    return String(a.code ?? '').localeCompare(String(b.code ?? ''))
  })

  const assignedMatches = []
  const teamLastEnd = {}
  const minRestMs = minRestBetweenTeamGames * 60 * 1000

  for (const match of matchesToAssign) {
    let assigned = false

    for (const round of timeRounds) {
      const roundStartMs = round.time.getTime()
      const aLast = teamLastEnd[match.team_a_id]
      const bLast = teamLastEnd[match.team_b_id]

      if (aLast && roundStartMs - aLast < minRestMs) continue
      if (bLast && roundStartMs - bLast < minRestMs) continue

      const slot = round.slots.find(s => !s._assigned)
      if (!slot) continue

      slot._assigned = true

      const slotEndMs = new Date(slot.scheduled_end).getTime()
      teamLastEnd[match.team_a_id] = slotEndMs
      teamLastEnd[match.team_b_id] = slotEndMs

      assignedMatches.push({
        ...match,
        slot_id: slot.id,
        venue_id: slot.venue_id,
        match_number: assignedMatches.length + 1,
      })

      assigned = true
      break
    }

    if (!assigned) {
      assignedMatches.push({
        ...match,
        slot_id: null,
        venue_id: null,
        match_number: assignedMatches.length + 1,
      })
    }
  }

  const slots = timeRounds.flatMap(r => r.slots)
  const conflicts = validateAssignedMatches(assignedMatches, slots, minRestBetweenTeamGames)

  return {
    slots,
    matches: assignedMatches,
    conflicts,
  }
}

/**
 * Utility to create a concrete playoff match.
 */
function createPlayoffMatch({
  code,
  division_id,
  phase,
  round,
  bracket_type,
  team_a_id,
  team_b_id,
  source_label = null,
}) {
  return {
    id: crypto.randomUUID(),
    code,
    division_id,
    pool_id: null,
    team_a_id,
    team_b_id,
    slot_id: null,
    venue_id: null,
    round,
    match_number: null,
    phase,
    bracket_type,
    source_label,
    status: 'scheduled',
  }
}

function validate4PoolStandings(standingsByPool) {
  for (const pool of ['A', 'B', 'C', 'D']) {
    if (!Array.isArray(standingsByPool[pool])) {
      throw new Error(`Missing standings for pool ${pool}`)
    }
    if (standingsByPool[pool].length < 4) {
      throw new Error(`Pool ${pool} must have 4 ranked teams`)
    }
  }
}

function getSeed(standingsByPool, poolName, rank) {
  const row = standingsByPool[poolName].find(r => Number(r.rank) === Number(rank))
  if (!row) {
    throw new Error(`Missing ${poolName}${rank} in standings`)
  }
  if (!row.team_id) {
    throw new Error(`${poolName}${rank} is missing team_id`)
  }
  return row
}

function mapByCode(matches) {
  const out = {}
  for (const match of matches) {
    if (match?.code) out[match.code] = match
  }
  return out
}

function requireMatchCodes(map, codes) {
  for (const code of codes) {
    const match = map[code]
    if (!match) {
      throw new Error(`Missing required completed match: ${code}`)
    }
    if (!match.winner_id || !match.loser_id) {
      throw new Error(`Completed match ${code} must include winner_id and loser_id`)
    }
  }
}

function buildTimeRounds({
  venues,
  start,
  end,
  lunchStart,
  lunchEnd,
  gameDurationMinutes,
  slotDurationMinutes,
}) {
  const rounds = []
  let cursor = new Date(start)

  while (cursor < end) {
    if (lunchStart && lunchEnd && cursor >= lunchStart && cursor < lunchEnd) {
      cursor = new Date(lunchEnd)
      continue
    }

    const slotEnd = new Date(cursor.getTime() + gameDurationMinutes * 60 * 1000)
    if (slotEnd > end) break

    rounds.push({
      time: new Date(cursor),
      slots: venues.map(venue => ({
        id: crypto.randomUUID(),
        venue_id: venue.id,
        scheduled_start: new Date(cursor).toISOString(),
        scheduled_end: slotEnd.toISOString(),
        _assigned: false,
      })),
    })

    cursor = new Date(cursor.getTime() + slotDurationMinutes * 60 * 1000)
  }

  return rounds
}

function validateAssignedMatches(matches, slots, minRestMinutes) {
  const conflicts = []
  const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
  const teamGames = {}

  for (const match of matches) {
    if (!match.slot_id) {
      conflicts.push({
        type: 'unscheduled',
        severity: 'error',
        teamId: match.team_a_id,
        matchIds: [match.id],
        message: 'A playoff game could not be scheduled - not enough time slots',
      })
      continue
    }

    for (const teamId of [match.team_a_id, match.team_b_id]) {
      if (!teamGames[teamId]) teamGames[teamId] = []
      teamGames[teamId].push(match)
    }
  }

  for (const [teamId, games] of Object.entries(teamGames)) {
    const sorted = games
      .filter(g => g.slot_id && slotMap[g.slot_id])
      .sort((a, b) => {
        const aStart = new Date(slotMap[a.slot_id].scheduled_start).getTime()
        const bStart = new Date(slotMap[b.slot_id].scheduled_start).getTime()
        return aStart - bStart
      })

    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(slotMap[sorted[i - 1].slot_id].scheduled_end).getTime()
      const nextStart = new Date(slotMap[sorted[i].slot_id].scheduled_start).getTime()
      const restMin = (nextStart - prevEnd) / 60000

      if (restMin < minRestMinutes) {
        conflicts.push({
          type: 'rest_time',
          severity: restMin < 30 ? 'error' : 'warning',
          teamId,
          matchIds: [sorted[i - 1].id, sorted[i].id],
          message: `A team has only ${Math.round(restMin)} min rest between playoff games (minimum ${minRestMinutes} min)`,
        })
      }
    }
  }

  return conflicts
}