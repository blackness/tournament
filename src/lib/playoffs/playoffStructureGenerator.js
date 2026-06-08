import { PLAYOFF_PRESET_KEYS } from './playoffPresets'

const crypto = globalThis.crypto

export function buildPlayoffStructure({
  presetKey,
  division,
  teams = [],
  pools = [],
  standingsRows = [],
  tournamentId = null,
}) {
  switch (presetKey) {
    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS:
      return buildTop2PerPoolToSemisStructure({
        division,
        pools,
        standingsRows,
        tournamentId,
        includeBronze: false,
      })

    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS_BRONZE:
      return buildTop2PerPoolToSemisStructure({
        division,
        pools,
        standingsRows,
        tournamentId,
        includeBronze: true,
      })

    case PLAYOFF_PRESET_KEYS.TOP_4_PER_POOL_TO_QUARTERS:
      return buildTop4PerPoolToQuartersStructure({
        division,
        pools,
        standingsRows,
        tournamentId,
      })

    case PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_QUARTERS:
      return buildTop2PerPoolToQuartersStructure({
        division,
        pools,
        standingsRows,
        tournamentId,
      })

    default:
      return {
        matches: [],
        warnings: [`Structure generator not implemented yet for preset: ${presetKey}`],
      }
  }
}

function buildTop2PerPoolToSemisStructure({
  division,
  pools,
  standingsRows,
  tournamentId,
  includeBronze = false,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 2) {
    return invalidStructure('Top 2 per pool to semifinals requires exactly 2 pools.')
  }

  const poolA = orderedPools[0]
  const poolB = orderedPools[1]

  const a1Source = `${poolShort(poolA)}1`
  const a2Source = `${poolShort(poolA)}2`
  const b1Source = `${poolShort(poolB)}1`
  const b2Source = `${poolShort(poolB)}2`

  const warnings = []
  if (
    !getStandingRowAtRank(standingsByPool[poolA.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolA.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 2)
  ) {
    warnings.push('Missing one or more top-2 qualifiers required for semifinal generation.')
  }

  const sf1Code = 'P-SF1'
  const sf2Code = 'P-SF2'
  const bronzeCode = 'P-B'
  const finalCode = 'P-F'

  const matches = [
    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf1Code,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 1',
      sourceAType: 'pool_place',
      sourceARef: a1Source,
      sourceBType: 'pool_place',
      sourceBRef: b2Source,
      winnerToMatchCode: finalCode,
      winnerToSlot: 'A',
      loserToMatchCode: includeBronze ? bronzeCode : null,
      loserToSlot: includeBronze ? 'A' : null,
      placementMin: 1,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf2Code,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 2',
      sourceAType: 'pool_place',
      sourceARef: b1Source,
      sourceBType: 'pool_place',
      sourceBRef: a2Source,
      winnerToMatchCode: finalCode,
      winnerToSlot: 'B',
      loserToMatchCode: includeBronze ? bronzeCode : null,
      loserToSlot: includeBronze ? 'B' : null,
      placementMin: 1,
      placementMax: 4,
    }),

    ...(includeBronze
      ? [
          createSourceMatch({
            tournamentId,
            divisionId: division.id,
            matchCode: bronzeCode,
            bracketType: 'championship',
            round: 2,
            roundLabel: 'Bronze',
            displayLabel: 'Bronze',
            sourceAType: 'loser',
            sourceARef: sf1Code,
            sourceBType: 'loser',
            sourceBRef: sf2Code,
            placementMin: 3,
            placementMax: 4,
          }),
        ]
      : []),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: finalCode,
      bracketType: 'championship',
      round: 2,
      roundLabel: 'Final',
      displayLabel: 'Final',
      sourceAType: 'winner',
      sourceARef: sf1Code,
      sourceBType: 'winner',
      sourceBRef: sf2Code,
      placementMin: 1,
      placementMax: 2,
    }),
  ]

  return { matches, warnings }
}

function buildTop4PerPoolToQuartersStructure({
  division,
  pools,
  standingsRows,
  tournamentId,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 2) {
    return invalidStructure('Top 4 per pool to quarterfinals requires exactly 2 pools.')
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

  const warnings = []
  if (
    !getStandingRowAtRank(standingsByPool[poolA.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolA.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolA.id], 3) ||
    !getStandingRowAtRank(standingsByPool[poolA.id], 4) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 3) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 4)
  ) {
    warnings.push('Missing one or more top-4 qualifiers required for quarterfinal generation.')
  }

  const qf1 = 'P-QF1'
  const qf2 = 'P-QF2'
  const qf3 = 'P-QF3'
  const qf4 = 'P-QF4'
  const sf1 = 'P-SF1'
  const sf2 = 'P-SF2'
  const bronze = 'P-B'
  const final = 'P-F'

  const matches = [
    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf1,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 1',
      sourceAType: 'pool_place',
      sourceARef: a1Source,
      sourceBType: 'pool_place',
      sourceBRef: b4Source,
      winnerToMatchCode: sf1,
      winnerToSlot: 'A',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf2,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 2',
      sourceAType: 'pool_place',
      sourceARef: b2Source,
      sourceBType: 'pool_place',
      sourceBRef: a3Source,
      winnerToMatchCode: sf1,
      winnerToSlot: 'B',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf3,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 3',
      sourceAType: 'pool_place',
      sourceARef: b1Source,
      sourceBType: 'pool_place',
      sourceBRef: a4Source,
      winnerToMatchCode: sf2,
      winnerToSlot: 'A',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf4,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 4',
      sourceAType: 'pool_place',
      sourceARef: a2Source,
      sourceBType: 'pool_place',
      sourceBRef: b3Source,
      winnerToMatchCode: sf2,
      winnerToSlot: 'B',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf1,
      bracketType: 'championship',
      round: 2,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 1',
      sourceAType: 'winner',
      sourceARef: qf1,
      sourceBType: 'winner',
      sourceBRef: qf2,
      winnerToMatchCode: final,
      winnerToSlot: 'A',
      loserToMatchCode: bronze,
      loserToSlot: 'A',
      placementMin: 1,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf2,
      bracketType: 'championship',
      round: 2,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 2',
      sourceAType: 'winner',
      sourceARef: qf3,
      sourceBType: 'winner',
      sourceBRef: qf4,
      winnerToMatchCode: final,
      winnerToSlot: 'B',
      loserToMatchCode: bronze,
      loserToSlot: 'B',
      placementMin: 1,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: bronze,
      bracketType: 'championship',
      round: 3,
      roundLabel: 'Bronze',
      displayLabel: 'Bronze',
      sourceAType: 'loser',
      sourceARef: sf1,
      sourceBType: 'loser',
      sourceBRef: sf2,
      placementMin: 3,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: final,
      bracketType: 'championship',
      round: 3,
      roundLabel: 'Final',
      displayLabel: 'Final',
      sourceAType: 'winner',
      sourceARef: sf1,
      sourceBType: 'winner',
      sourceBRef: sf2,
      placementMin: 1,
      placementMax: 2,
    }),
  ]

  return { matches, warnings }
}

function buildTop2PerPoolToQuartersStructure({
  division,
  pools,
  standingsRows,
  tournamentId,
}) {
  const orderedPools = getOrderedDivisionPools({ division, pools })
  const standingsByPool = groupStandingsRowsByPool({ division, standingsRows })

  if (orderedPools.length !== 4) {
    return invalidStructure('Top 2 per pool to quarterfinals requires exactly 4 pools.')
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

  const warnings = []
  if (
    !getStandingRowAtRank(standingsByPool[poolA.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolA.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolB.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolC.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolC.id], 2) ||
    !getStandingRowAtRank(standingsByPool[poolD.id], 1) ||
    !getStandingRowAtRank(standingsByPool[poolD.id], 2)
  ) {
    warnings.push('Missing one or more top-2 qualifiers required for quarterfinal generation.')
  }

  const qf1 = 'P-QF1'
  const qf2 = 'P-QF2'
  const qf3 = 'P-QF3'
  const qf4 = 'P-QF4'
  const sf1 = 'P-SF1'
  const sf2 = 'P-SF2'
  const bronze = 'P-B'
  const final = 'P-F'

  const matches = [
    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf1,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 1',
      sourceAType: 'pool_place',
      sourceARef: a1Source,
      sourceBType: 'pool_place',
      sourceBRef: d2Source,
      winnerToMatchCode: sf1,
      winnerToSlot: 'A',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf2,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 2',
      sourceAType: 'pool_place',
      sourceARef: b1Source,
      sourceBType: 'pool_place',
      sourceBRef: c2Source,
      winnerToMatchCode: sf1,
      winnerToSlot: 'B',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf3,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 3',
      sourceAType: 'pool_place',
      sourceARef: c1Source,
      sourceBType: 'pool_place',
      sourceBRef: b2Source,
      winnerToMatchCode: sf2,
      winnerToSlot: 'A',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: qf4,
      bracketType: 'championship',
      round: 1,
      roundLabel: 'Quarterfinal',
      displayLabel: 'Quarterfinal 4',
      sourceAType: 'pool_place',
      sourceARef: d1Source,
      sourceBType: 'pool_place',
      sourceBRef: a2Source,
      winnerToMatchCode: sf2,
      winnerToSlot: 'B',
      placementMin: 1,
      placementMax: 8,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf1,
      bracketType: 'championship',
      round: 2,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 1',
      sourceAType: 'winner',
      sourceARef: qf1,
      sourceBType: 'winner',
      sourceBRef: qf2,
      winnerToMatchCode: final,
      winnerToSlot: 'A',
      loserToMatchCode: bronze,
      loserToSlot: 'A',
      placementMin: 1,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: sf2,
      bracketType: 'championship',
      round: 2,
      roundLabel: 'Semifinal',
      displayLabel: 'Semifinal 2',
      sourceAType: 'winner',
      sourceARef: qf3,
      sourceBType: 'winner',
      sourceBRef: qf4,
      winnerToMatchCode: final,
      winnerToSlot: 'B',
      loserToMatchCode: bronze,
      loserToSlot: 'B',
      placementMin: 1,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: bronze,
      bracketType: 'championship',
      round: 3,
      roundLabel: 'Bronze',
      displayLabel: 'Bronze',
      sourceAType: 'loser',
      sourceARef: sf1,
      sourceBType: 'loser',
      sourceBRef: sf2,
      placementMin: 3,
      placementMax: 4,
    }),

    createSourceMatch({
      tournamentId,
      divisionId: division.id,
      matchCode: final,
      bracketType: 'championship',
      round: 3,
      roundLabel: 'Final',
      displayLabel: 'Final',
      sourceAType: 'winner',
      sourceARef: sf1,
      sourceBType: 'winner',
      sourceBRef: sf2,
      placementMin: 1,
      placementMax: 2,
    }),
  ]

  return { matches, warnings }
}

function createSourceMatch({
  tournamentId,
  divisionId,
  matchCode,
  bracketType,
  round,
  roundLabel,
  displayLabel,
  sourceAType,
  sourceARef,
  sourceBType,
  sourceBRef,
  winnerToMatchCode = null,
  winnerToSlot = null,
  loserToMatchCode = null,
  loserToSlot = null,
  placementMin = null,
  placementMax = null,
}) {
  return {
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    division_id: divisionId,
    pool_id: null,
    status: 'scheduled',
    round,
    round_label: roundLabel,
    display_label: displayLabel,
    match_code: matchCode,
    bracket_type: bracketType,
    source_a_type: sourceAType,
    source_a_ref: sourceARef,
    source_b_type: sourceBType,
    source_b_ref: sourceBRef,
    team_a_id: null,
    team_b_id: null,
    winner_to_match_code: winnerToMatchCode,
    winner_to_slot: winnerToSlot,
    loser_to_match_code: loserToMatchCode,
    loser_to_slot: loserToSlot,
    placement_min: placementMin,
    placement_max: placementMax,
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
    byPool[poolId].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
  }

  return byPool
}

function getStandingRowAtRank(poolStandings = [], rank) {
  return (poolStandings || []).find(r => r.rank === rank) || null
}

function poolShort(pool) {
  return pool?.shortName || pool?.short_name || pool?.name || 'Pool'
}

function invalidStructure(message) {
  return {
    matches: [],
    warnings: [message],
  }
}