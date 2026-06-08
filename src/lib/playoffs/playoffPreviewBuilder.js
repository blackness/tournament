import { PLAYOFF_PRESET_KEYS } from './playoffPresets'

export function buildPlayoffPreview({
  presetKey,
  division,
  teams = [],
  pools = [],
  standingsRows = [],
}) {
  switch (presetKey) {
    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS:
    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS_BRONZE:
      return buildTop2PerPoolToSemisPreview({
        division,
        teams,
        pools,
        standingsRows,
        includeBronze: presetKey === PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS_BRONZE,
      })

    case PLAYOFF_PRESET_KEYS.TOP_4_PER_POOL_TO_QUARTERS:
      return buildTop4PerPoolToQuartersPreview({
        division,
        teams,
        pools,
        standingsRows,
      })

    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_QUARTERS:
      return buildTop2PerPoolToQuartersPreview({
        division,
        teams,
        pools,
        standingsRows,
      })

    case PLAYOFF_PRESET_KEYS.OFSAA_CROSSOVER_CHAMPIONSHIP_CONSOLATION:
      return buildOfsaaCrossoverPreview({
        division,
        teams,
        pools,
        standingsRows,
      })

    default:
      return {
        presetKey,
        qualifiers: [],
        seeds: [],
        firstRound: [],
        structure: [],
        placementSummary: [],
        warnings: ['Preview not implemented yet for this playoff preset.'],
      }
  }
}

function buildTop2PerPoolToSemisPreview({
  division,
  teams,
  pools,
  standingsRows,
  includeBronze = false,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 2) {
    return invalidPreview('Top 2 per pool to semifinals requires exactly 2 pools.')
  }

  const poolA = orderedPools[0]
  const poolB = orderedPools[1]

  const a1Source = `${poolShort(poolA)}1`
  const a2Source = `${poolShort(poolA)}2`
  const b1Source = `${poolShort(poolB)}1`
  const b2Source = `${poolShort(poolB)}2`

  const a1 = getTeamAtRank(standingsByPool[poolA.id], 1, teams)
  const a2 = getTeamAtRank(standingsByPool[poolA.id], 2, teams)
  const b1 = getTeamAtRank(standingsByPool[poolB.id], 1, teams)
  const b2 = getTeamAtRank(standingsByPool[poolB.id], 2, teams)

  const qualifiers = compact([
    qualifierFromStanding(a1, a1Source, 1),
    qualifierFromStanding(b1, b1Source, 2),
    qualifierFromStanding(a2, a2Source, 3),
    qualifierFromStanding(b2, b2Source, 4),
  ])

  const firstRound = [
    matchup('SF1', a1Source, b2Source, a1, b2, 'Semifinal 1'),
    matchup('SF2', b1Source, a2Source, b1, a2, 'Semifinal 2'),
  ]

  const structure = [
    structureNode('SF1', 'Semifinal 1', a1Source, b2Source, 'F', includeBronze ? 'B' : null),
    structureNode('SF2', 'Semifinal 2', b1Source, a2Source, 'F', includeBronze ? 'B' : null),
    ...(includeBronze
      ? [structureNode('B', 'Bronze', 'Loser SF1', 'Loser SF2', null, null)]
      : []),
    structureNode('F', 'Final', 'Winner SF1', 'Winner SF2', null, null),
  ]

  return {
    presetKey: includeBronze
      ? PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS_BRONZE
      : PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS,
    qualifiers,
    seeds: qualifiers.map(q => ({
      seed: q.seed,
      teamId: q.teamId,
      teamName: q.teamName,
      source: q.source,
    })),
    firstRound,
    structure,
    placementSummary: [
      'Championship bracket determines 1st–4th.',
      includeBronze
        ? 'Bronze game determines 3rd and 4th.'
        : 'Semifinal losers share placement unless a bronze game is added.',
      'Non-qualifiers finish below championship qualifiers by pool standing.',
    ],
    warnings: [],
  }
}

function buildTop4PerPoolToQuartersPreview({
  division,
  teams,
  pools,
  standingsRows,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 2) {
    return invalidPreview('Top 4 per pool to quarterfinals requires exactly 2 pools.')
  }

  const poolA = orderedPools[0]
  const poolB = orderedPools[1]

  const a1Source = `${poolShort(poolA)}1`
  const a2Source = `${poolShort(poolA)}2`
  const a3Source = `${poolShort(poolA)}3`
  const a4Source = `${poolShort(poolA)}4`
  const b1Source = `${poolShort(poolB)}1`
  const b2Source = `${poolShort(poolB)}2`
  const b3Source = `${poolShort(poolB)}3`
  const b4Source = `${poolShort(poolB)}4`

  const a1 = getTeamAtRank(standingsByPool[poolA.id], 1, teams)
  const a2 = getTeamAtRank(standingsByPool[poolA.id], 2, teams)
  const a3 = getTeamAtRank(standingsByPool[poolA.id], 3, teams)
  const a4 = getTeamAtRank(standingsByPool[poolA.id], 4, teams)

  const b1 = getTeamAtRank(standingsByPool[poolB.id], 1, teams)
  const b2 = getTeamAtRank(standingsByPool[poolB.id], 2, teams)
  const b3 = getTeamAtRank(standingsByPool[poolB.id], 3, teams)
  const b4 = getTeamAtRank(standingsByPool[poolB.id], 4, teams)

  const qualifiers = compact([
    qualifierFromStanding(a1, a1Source, 1),
    qualifierFromStanding(b1, b1Source, 2),
    qualifierFromStanding(a2, a2Source, 3),
    qualifierFromStanding(b2, b2Source, 4),
    qualifierFromStanding(a3, a3Source, 5),
    qualifierFromStanding(b3, b3Source, 6),
    qualifierFromStanding(a4, a4Source, 7),
    qualifierFromStanding(b4, b4Source, 8),
  ])

  const firstRound = [
    matchup('QF1', a1Source, b4Source, a1, b4, 'Quarterfinal 1'),
    matchup('QF2', b2Source, a3Source, b2, a3, 'Quarterfinal 2'),
    matchup('QF3', b1Source, a4Source, b1, a4, 'Quarterfinal 3'),
    matchup('QF4', a2Source, b3Source, a2, b3, 'Quarterfinal 4'),
  ]

  const structure = [
    structureNode('QF1', 'Quarterfinal 1', a1Source, b4Source, 'SF1', null),
    structureNode('QF2', 'Quarterfinal 2', b2Source, a3Source, 'SF1', null),
    structureNode('QF3', 'Quarterfinal 3', b1Source, a4Source, 'SF2', null),
    structureNode('QF4', 'Quarterfinal 4', a2Source, b3Source, 'SF2', null),
    structureNode('SF1', 'Semifinal 1', 'Winner QF1', 'Winner QF2', 'F', 'B'),
    structureNode('SF2', 'Semifinal 2', 'Winner QF3', 'Winner QF4', 'F', 'B'),
    structureNode('B', 'Bronze', 'Loser SF1', 'Loser SF2', null, null),
    structureNode('F', 'Final', 'Winner SF1', 'Winner SF2', null, null),
  ]

  return {
    presetKey: PLAYOFF_PRESET_KEYS.TOP_4_PER_POOL_TO_QUARTERS,
    qualifiers,
    seeds: qualifiers.map(q => ({
      seed: q.seed,
      teamId: q.teamId,
      teamName: q.teamName,
      source: q.source,
    })),
    firstRound,
    structure,
    placementSummary: [
      'Quarterfinal winners advance to semifinals.',
      'Semifinal winners advance to the final.',
      'Semifinal losers play for bronze.',
      'Championship bracket determines the top 8 qualified placements.',
    ],
    warnings: [],
  }
}

function buildTop2PerPoolToQuartersPreview({
  division,
  teams,
  pools,
  standingsRows,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 4) {
    return invalidPreview('Top 2 per pool to quarterfinals requires exactly 4 pools.')
  }

  const [poolA, poolB, poolC, poolD] = orderedPools

  const a1Source = `${poolShort(poolA)}1`
  const a2Source = `${poolShort(poolA)}2`
  const b1Source = `${poolShort(poolB)}1`
  const b2Source = `${poolShort(poolB)}2`
  const c1Source = `${poolShort(poolC)}1`
  const c2Source = `${poolShort(poolC)}2`
  const d1Source = `${poolShort(poolD)}1`
  const d2Source = `${poolShort(poolD)}2`

  const a1 = getTeamAtRank(standingsByPool[poolA.id], 1, teams)
  const a2 = getTeamAtRank(standingsByPool[poolA.id], 2, teams)
  const b1 = getTeamAtRank(standingsByPool[poolB.id], 1, teams)
  const b2 = getTeamAtRank(standingsByPool[poolB.id], 2, teams)
  const c1 = getTeamAtRank(standingsByPool[poolC.id], 1, teams)
  const c2 = getTeamAtRank(standingsByPool[poolC.id], 2, teams)
  const d1 = getTeamAtRank(standingsByPool[poolD.id], 1, teams)
  const d2 = getTeamAtRank(standingsByPool[poolD.id], 2, teams)

  const qualifiers = compact([
    qualifierFromStanding(a1, a1Source, 1),
    qualifierFromStanding(b1, b1Source, 2),
    qualifierFromStanding(c1, c1Source, 3),
    qualifierFromStanding(d1, d1Source, 4),
    qualifierFromStanding(a2, a2Source, 5),
    qualifierFromStanding(b2, b2Source, 6),
    qualifierFromStanding(c2, c2Source, 7),
    qualifierFromStanding(d2, d2Source, 8),
  ])

  const firstRound = [
    matchup('QF1', a1Source, d2Source, a1, d2, 'Quarterfinal 1'),
    matchup('QF2', b1Source, c2Source, b1, c2, 'Quarterfinal 2'),
    matchup('QF3', c1Source, b2Source, c1, b2, 'Quarterfinal 3'),
    matchup('QF4', d1Source, a2Source, d1, a2, 'Quarterfinal 4'),
  ]

  const structure = [
    structureNode('QF1', 'Quarterfinal 1', a1Source, d2Source, 'SF1', null),
    structureNode('QF2', 'Quarterfinal 2', b1Source, c2Source, 'SF1', null),
    structureNode('QF3', 'Quarterfinal 3', c1Source, b2Source, 'SF2', null),
    structureNode('QF4', 'Quarterfinal 4', d1Source, a2Source, 'SF2', null),
    structureNode('SF1', 'Semifinal 1', 'Winner QF1', 'Winner QF2', 'F', 'B'),
    structureNode('SF2', 'Semifinal 2', 'Winner QF3', 'Winner QF4', 'F', 'B'),
    structureNode('B', 'Bronze', 'Loser SF1', 'Loser SF2', null, null),
    structureNode('F', 'Final', 'Winner SF1', 'Winner SF2', null, null),
  ]

  return {
    presetKey: PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_QUARTERS,
    qualifiers,
    seeds: qualifiers.map(q => ({
      seed: q.seed,
      teamId: q.teamId,
      teamName: q.teamName,
      source: q.source,
    })),
    firstRound,
    structure,
    placementSummary: [
      'Top 2 teams from each pool qualify to the championship quarterfinals.',
      'Quarterfinal winners advance to semifinals.',
      'Semifinal losers play for bronze.',
      'Final determines 1st and 2nd.',
    ],
    warnings: [],
  }
}

function buildOfsaaCrossoverPreview({
  division,
  teams,
  pools,
  standingsRows,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 4) {
    return invalidPreview('OFSAA crossover preset requires exactly 4 pools.')
  }

  const [poolA, poolB, poolC, poolD] = orderedPools

  const a1Source = `${poolShort(poolA)}1`
  const a2Source = `${poolShort(poolA)}2`
  const a3Source = `${poolShort(poolA)}3`
  const a4Source = `${poolShort(poolA)}4`
  const b1Source = `${poolShort(poolB)}1`
  const b2Source = `${poolShort(poolB)}2`
  const b3Source = `${poolShort(poolB)}3`
  const b4Source = `${poolShort(poolB)}4`
  const c1Source = `${poolShort(poolC)}1`
  const c2Source = `${poolShort(poolC)}2`
  const c3Source = `${poolShort(poolC)}3`
  const c4Source = `${poolShort(poolC)}4`
  const d1Source = `${poolShort(poolD)}1`
  const d2Source = `${poolShort(poolD)}2`
  const d3Source = `${poolShort(poolD)}3`
  const d4Source = `${poolShort(poolD)}4`

  const a1 = getTeamAtRank(standingsByPool[poolA.id], 1, teams)
  const a2 = getTeamAtRank(standingsByPool[poolA.id], 2, teams)
  const a3 = getTeamAtRank(standingsByPool[poolA.id], 3, teams)
  const a4 = getTeamAtRank(standingsByPool[poolA.id], 4, teams)

  const b1 = getTeamAtRank(standingsByPool[poolB.id], 1, teams)
  const b2 = getTeamAtRank(standingsByPool[poolB.id], 2, teams)
  const b3 = getTeamAtRank(standingsByPool[poolB.id], 3, teams)
  const b4 = getTeamAtRank(standingsByPool[poolB.id], 4, teams)

  const c1 = getTeamAtRank(standingsByPool[poolC.id], 1, teams)
  const c2 = getTeamAtRank(standingsByPool[poolC.id], 2, teams)
  const c3 = getTeamAtRank(standingsByPool[poolC.id], 3, teams)
  const c4 = getTeamAtRank(standingsByPool[poolC.id], 4, teams)

  const d1 = getTeamAtRank(standingsByPool[poolD.id], 1, teams)
  const d2 = getTeamAtRank(standingsByPool[poolD.id], 2, teams)
  const d3 = getTeamAtRank(standingsByPool[poolD.id], 3, teams)
  const d4 = getTeamAtRank(standingsByPool[poolD.id], 4, teams)

  const qualifiers = compact([
    qualifierFromStanding(a1, a1Source, 1),
    qualifierFromStanding(b1, b1Source, 2),
    qualifierFromStanding(c1, c1Source, 3),
    qualifierFromStanding(d1, d1Source, 4),
    qualifierFromStanding(a2, a2Source, 5),
    qualifierFromStanding(b2, b2Source, 6),
    qualifierFromStanding(c2, c2Source, 7),
    qualifierFromStanding(d2, d2Source, 8),
    qualifierFromStanding(a3, a3Source, 9),
    qualifierFromStanding(b3, b3Source, 10),
    qualifierFromStanding(c3, c3Source, 11),
    qualifierFromStanding(d3, d3Source, 12),
    qualifierFromStanding(a4, a4Source, 13),
    qualifierFromStanding(b4, b4Source, 14),
    qualifierFromStanding(c4, c4Source, 15),
    qualifierFromStanding(d4, d4Source, 16),
  ])

  const firstRound = [
    matchup('XO-1', b2Source, a3Source, b2, a3, 'Crossover 1'),
    matchup('XO-2', a2Source, b3Source, a2, b3, 'Crossover 2'),
    matchup('XO-3', d2Source, c3Source, d2, c3, 'Crossover 3'),
    matchup('XO-4', c2Source, d3Source, c2, d3, 'Crossover 4'),
  ]

  const structure = [
    structureNode('XO-1', 'Crossover 1', b2Source, a3Source, 'P6', 'P4'),
    structureNode('XO-2', 'Crossover 2', a2Source, b3Source, 'P5', 'P3'),
    structureNode('XO-3', 'Crossover 3', d2Source, c3Source, 'P8', 'P2'),
    structureNode('XO-4', 'Crossover 4', c2Source, d3Source, 'P7', 'P1'),

    structureNode('P5', 'Championship Round 1', a1Source, 'Winner XO-2', null, null),
    structureNode('P6', 'Championship Round 1', b1Source, 'Winner XO-1', null, null),
    structureNode('P7', 'Championship Round 1', c1Source, 'Winner XO-4', null, null),
    structureNode('P8', 'Championship Round 1', d1Source, 'Winner XO-3', null, null),

    structureNode('P1', 'Consolation Round 1', 'Loser XO-4', b4Source, null, null),
    structureNode('P2', 'Consolation Round 1', 'Loser XO-3', a4Source, null, null),
    structureNode('P3', 'Consolation Round 1', 'Loser XO-2', d4Source, null, null),
    structureNode('P4', 'Consolation Round 1', 'Loser XO-1', c4Source, null, null),
  ]

  return {
    presetKey: PLAYOFF_PRESET_KEYS.OFSAA_CROSSOVER_CHAMPIONSHIP_CONSOLATION,
    qualifiers,
    seeds: qualifiers.map(q => ({
      seed: q.seed,
      teamId: q.teamId,
      teamName: q.teamName,
      source: q.source,
    })),
    firstRound,
    structure,
    placementSummary: [
      'Pool winners advance directly to championship round 1.',
      '2nd and 3rd place teams play crossover to determine championship vs consolation path.',
      '4th place teams begin in consolation round 1.',
      'This structure supports full championship/consolation progression.',
    ],
    warnings: [],
  }
}

function getOrderedDivisionPools({ division, pools }) {
  return pools
    .filter(pool => pool.divisionId === division.id || pool.division_id === division.id)
    .slice()
    .sort((a, b) => {
      const aSort = a.sortOrder ?? a.sort_order ?? 0
      const bSort = b.sortOrder ?? b.sort_order ?? 0
      if (aSort !== bSort) return aSort - bSort
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
}

function groupStandingsRowsByPool({ division, standingsRows }) {
  const byPool = {}

  for (const row of standingsRows || []) {
    if (row.division_id && row.division_id !== division.dbId && row.division_id !== division.id) {
      continue
    }
    if (!byPool[row.pool_id]) byPool[row.pool_id] = []
    byPool[row.pool_id].push(row)
  }

  for (const poolId of Object.keys(byPool)) {
    byPool[poolId].sort((a, b) => {
      const aRank = a.rank ?? 999
      const bRank = b.rank ?? 999
      return aRank - bRank
    })
  }

  return byPool
}

function getTeamAtRank(poolStandings = [], rank, teams = []) {
  const row = (poolStandings || []).find(r => r.rank === rank)
  if (!row) return null

  const team =
    teams.find(t => t.dbId === row.team_id) ||
    teams.find(t => t.id === row.team_id) ||
    null

  return {
    row,
    team,
    teamId: row.team_id,
    teamName:
      row.team_short_name ||
      row.team_name ||
      team?.shortName ||
      team?.name ||
      'TBD',
  }
}

function qualifierFromStanding(entry, source, seed) {
  if (!entry) return null

  return {
    seed,
    source,
    teamId: entry.teamId,
    teamName: entry.teamName,
  }
}

function matchup(code, sourceA, sourceB, teamAEntry, teamBEntry, label) {
  return {
    code,
    label,
    sourceA,
    sourceB,
    teamA: {
      teamId: teamAEntry?.teamId || null,
      teamName: teamAEntry?.teamName || 'TBD',
    },
    teamB: {
      teamId: teamBEntry?.teamId || null,
      teamName: teamBEntry?.teamName || 'TBD',
    },
  }
}

function structureNode(code, label, sourceA, sourceB, winnerTo, loserTo) {
  return {
    code,
    label,
    sourceA,
    sourceB,
    winnerTo: winnerTo || null,
    loserTo: loserTo || null,
  }
}

function invalidPreview(message) {
  return {
    qualifiers: [],
    seeds: [],
    firstRound: [],
    structure: [],
    placementSummary: [],
    warnings: [message],
  }
}

function compact(arr) {
  return arr.filter(Boolean)
}

function poolShort(pool) {
  return pool?.shortName || pool?.short_name || pool?.name || 'Pool'
}