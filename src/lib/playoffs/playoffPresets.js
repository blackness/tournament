import { FORMAT_TYPES } from '../constants'

export const PLAYOFF_GENERATION_SCOPES = {
  FIRST_ROUND: 'first_round',
  FULL_STRUCTURE: 'full_structure',
  ALL_SCHEDULABLE: 'all_schedulable',
}

export const PLAYOFF_SEEDING_METHODS = {
  PRESET: 'PRESET',
  POOL_FINISH_LOCKED: 'POOL_FINISH_LOCKED',
  CROSS_POOL_TIEBREAK_RANK: 'CROSS_POOL_TIEBREAK_RANK',
  AVOID_SAME_POOL_REMATCH_IF_POSSIBLE: 'AVOID_SAME_POOL_REMATCH_IF_POSSIBLE',
}

export const PLAYOFF_PRESET_KEYS = {
  SINGLE_ELIM: 'SINGLE_ELIM',
  SINGLE_ELIM_BRONZE: 'SINGLE_ELIM_BRONZE',
  TOP_2_PER_POOL_TO_SEMIS: 'TOP_2_PER_POOL_TO_SEMIS',
  TOP_2_PER_POOL_TO_SEMIS_BRONZE: 'TOP_2_PER_POOL_TO_SEMIS_BRONZE',
  POOL_WINNERS_TO_FINAL: 'POOL_WINNERS_TO_FINAL',
  TOP_4_PER_POOL_TO_QUARTERS: 'TOP_4_PER_POOL_TO_QUARTERS',
  TOP_2_PER_POOL_TO_QUARTERS: 'TOP_2_PER_POOL_TO_QUARTERS',
  OFSAA_CROSSOVER_CHAMPIONSHIP_CONSOLATION: 'OFSAA_CROSSOVER_CHAMPIONSHIP_CONSOLATION',
  FULL_CLASSIFICATION_1_TO_8: 'FULL_CLASSIFICATION_1_TO_8',
  FULL_CLASSIFICATION_1_TO_10: 'FULL_CLASSIFICATION_1_TO_10',
  FULL_CLASSIFICATION_1_TO_16: 'FULL_CLASSIFICATION_1_TO_16',
}

const POOL_BASED_FORMAT_TYPES = [
  FORMAT_TYPES.POOL_PLAY,
  FORMAT_TYPES.POOL_TO_BRACKET,
  FORMAT_TYPES.POOL_TO_SEMIS,
  FORMAT_TYPES.POOL_TO_SEMIS_BRONZE,
]

export const PLAYOFF_PRESETS = [
  {
    key: PLAYOFF_PRESET_KEYS.SINGLE_ELIM,
    label: 'Single Elimination',
    description: 'Single-elimination championship bracket.',
    category: 'DIRECT_ELIM',
    recommendationPriority: 40,
    eligibleWhen: {
      formatTypes: [FORMAT_TYPES.SINGLE_ELIM],
      minPoolCount: 0,
      maxPoolCount: 0,
      minTeamsPerPool: null,
      maxTeamsPerPool: null,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FIRST_ROUND,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: false,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.SINGLE_ELIM_BRONZE,
    label: 'Single Elimination + Bronze',
    description: 'Single-elimination championship bracket with a bronze game.',
    category: 'DIRECT_ELIM',
    recommendationPriority: 50,
    eligibleWhen: {
      formatTypes: [FORMAT_TYPES.SINGLE_ELIM],
      minPoolCount: 0,
      maxPoolCount: 0,
      minTeamsPerPool: null,
      maxTeamsPerPool: null,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS,
    label: 'Top 2 per pool → Semifinals',
    description: 'Top 2 teams from each pool advance into a 4-team semifinal bracket.',
    category: 'POOL_TO_SEMIS',
    recommendationPriority: 80,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 2,
      maxTeamsPerPool: 8,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FIRST_ROUND,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: false,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_SEMIS_BRONZE,
    label: 'Top 2 per pool → Semifinals + Bronze',
    description: 'Top 2 teams from each pool advance into semifinals, with a bronze game for 3rd place.',
    category: 'POOL_TO_SEMIS',
    recommendationPriority: 100,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 2,
      maxTeamsPerPool: 8,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.POOL_WINNERS_TO_FINAL,
    label: 'Pool Winners → Final',
    description: 'Only the winners of each pool advance to a final.',
    category: 'POOL_TO_FINAL',
    recommendationPriority: 30,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 2,
      maxTeamsPerPool: 8,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FIRST_ROUND,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: false,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.TOP_4_PER_POOL_TO_QUARTERS,
    label: 'Top 4 per pool → Quarterfinals',
    description: 'Top 4 teams from each pool advance into an 8-team quarterfinal bracket.',
    category: 'POOL_TO_QUARTERS',
    recommendationPriority: 95,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 5,
      maxTeamsPerPool: 8,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.TOP_2_PER_POOL_TO_QUARTERS,
    label: 'Top 2 per pool → Quarterfinals',
    description: 'Top 2 teams from each of 4 pools advance into an 8-team quarterfinal bracket.',
    category: 'POOL_TO_QUARTERS',
    recommendationPriority: 90,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 4,
      maxPoolCount: 4,
      minTeamsPerPool: 2,
      maxTeamsPerPool: 8,
      exactTeamCount: null,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'none',
      classificationMode: 'none',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.OFSAA_CROSSOVER_CHAMPIONSHIP_CONSOLATION,
    label: 'OFSAA Crossover → Championship / Consolation',
    description: 'Pool winners plus crossover results feed into championship and consolation brackets.',
    category: 'CHAMPIONSHIP_CONSOLATION_SPLIT',
    recommendationPriority: 110,
    eligibleWhen: {
      formatTypes: [FORMAT_TYPES.OFSAA_FULL_CLASSIFICATION],
      minPoolCount: 4,
      maxPoolCount: 4,
      minTeamsPerPool: 4,
      maxTeamsPerPool: 4,
      exactTeamCount: 16,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'full',
      classificationMode: 'full',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.FULL_CLASSIFICATION_1_TO_8,
    label: 'Full Classification 1–8',
    description: 'All teams continue into a full placement structure for 1st through 8th.',
    category: 'FULL_CLASSIFICATION',
    recommendationPriority: 60,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 4,
      maxTeamsPerPool: 4,
      exactTeamCount: 8,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'full',
      classificationMode: 'full',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.FULL_CLASSIFICATION_1_TO_10,
    label: 'Full Classification 1–10',
    description: 'All teams continue into a full placement structure for 1st through 10th.',
    category: 'FULL_CLASSIFICATION',
    recommendationPriority: 55,
    eligibleWhen: {
      formatTypes: POOL_BASED_FORMAT_TYPES,
      minPoolCount: 2,
      maxPoolCount: 2,
      minTeamsPerPool: 5,
      maxTeamsPerPool: 5,
      exactTeamCount: 10,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'full',
      classificationMode: 'full',
    },
  },

  {
    key: PLAYOFF_PRESET_KEYS.FULL_CLASSIFICATION_1_TO_16,
    label: 'Full Classification 1–16',
    description: 'All teams continue into a full placement structure for 1st through 16th.',
    category: 'FULL_CLASSIFICATION',
    recommendationPriority: 70,
    eligibleWhen: {
      formatTypes: [...POOL_BASED_FORMAT_TYPES, FORMAT_TYPES.OFSAA_FULL_CLASSIFICATION],
      minPoolCount: 4,
      maxPoolCount: 4,
      minTeamsPerPool: 4,
      maxTeamsPerPool: 4,
      exactTeamCount: 16,
    },
    defaults: {
      generationScope: PLAYOFF_GENERATION_SCOPES.FULL_STRUCTURE,
      seedingMethod: PLAYOFF_SEEDING_METHODS.PRESET,
      bronzeGame: true,
      consolationMode: 'full',
      classificationMode: 'full',
    },
  },
]

export function getDivisionStructureSummary({
  division,
  teams = [],
  pools = [],
  poolAssignments = {},
}) {
  const divisionTeams = teams.filter(
    t => t.divisionId === division.id || t.division_id === division.id
  )

  const divisionPools = pools.filter(
    p => p.divisionId === division.id || p.division_id === division.id
  )

  const teamsPerPool = divisionPools.map(pool =>
    divisionTeams.filter(team => {
      const assignedPoolId =
        poolAssignments?.[team.id] ??
        team.poolId ??
        team.pool_id ??
        null

      return assignedPoolId === pool.id
    }).length
  )

  const minTeamsPerPool = teamsPerPool.length ? Math.min(...teamsPerPool) : 0
  const maxTeamsPerPool = teamsPerPool.length ? Math.max(...teamsPerPool) : 0

  return {
    divisionId: division.id,
    formatType: division.formatType,
    teamCount: divisionTeams.length,
    poolCount: divisionPools.length,
    teamsPerPool,
    minTeamsPerPool,
    maxTeamsPerPool,
    isEvenPools: minTeamsPerPool === maxTeamsPerPool,
  }
}

export function isPresetEligible(preset, structure) {
  const rules = preset.eligibleWhen || {}

  if (rules.formatTypes?.length && !rules.formatTypes.includes(structure.formatType)) {
    return false
  }

  if (rules.minPoolCount != null && structure.poolCount < rules.minPoolCount) {
    return false
  }

  if (rules.maxPoolCount != null && structure.poolCount > rules.maxPoolCount) {
    return false
  }

  if (rules.minTeamsPerPool != null && structure.minTeamsPerPool < rules.minTeamsPerPool) {
    return false
  }

  if (rules.maxTeamsPerPool != null && structure.maxTeamsPerPool > rules.maxTeamsPerPool) {
    return false
  }

  if (rules.exactTeamCount != null && structure.teamCount !== rules.exactTeamCount) {
    return false
  }

  return true
}

export function getEligiblePlayoffPresets({
  division,
  teams = [],
  pools = [],
  poolAssignments = {},
}) {
  const structure = getDivisionStructureSummary({
    division,
    teams,
    pools,
    poolAssignments,
  })

  return PLAYOFF_PRESETS
    .filter(preset => isPresetEligible(preset, structure))
    .sort((a, b) => (b.recommendationPriority ?? 0) - (a.recommendationPriority ?? 0))
}

export function getRecommendedPlayoffPreset({
  division,
  teams = [],
  pools = [],
  poolAssignments = {},
}) {
  const eligible = getEligiblePlayoffPresets({
    division,
    teams,
    pools,
    poolAssignments,
  })

  return eligible[0] || null
}