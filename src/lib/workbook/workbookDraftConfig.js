import { FORMAT_TYPES } from '../constants'

export const WORKBOOK_SCHEDULE_DRAFT_LEVELS = {
  NONE: 'none',
  TIME_SLOTS: 'time_slots',
  MATCH_SCAFFOLD: 'match_scaffold',
}

export const WORKBOOK_TEAM_ROW_STYLES = {
  BLANK: 'blank',
  PLACEHOLDER: 'placeholder',
  SEEDED_PLACEHOLDER: 'seeded_placeholder',
}

export const DEFAULT_WORKBOOK_DRAFT_CONFIG = {
  tournament: {
    name: '',
    slug: '',
    sport: '',
    timezone: 'America/Toronto',
    startDate: '',
    endDate: '',
    hostSchool: '',
    location: '',
    primaryColor: '',
  },

  scheduleDefaults: {
    numberOfDays: 1,
    fieldsCount: 1,
    dayStartTime: '09:00',
    dayEndTime: '17:00',
    gameDurationMinutes: 90,
    breakBetweenGamesMinutes: 30,
  },

  workbookOptions: {
    includePools: true,
    includeRosters: true,
    includeScheduleDraft: true,
    scheduleDraftLevel: WORKBOOK_SCHEDULE_DRAFT_LEVELS.TIME_SLOTS,
    teamRowStyle: WORKBOOK_TEAM_ROW_STYLES.SEEDED_PLACEHOLDER,
    autoAssignPoolsEvenly: true,
  },

  divisions: [],
}

export function normalizeWorkbookDraftConfig(input = {}) {
  const merged = {
    tournament: {
      ...DEFAULT_WORKBOOK_DRAFT_CONFIG.tournament,
      ...(input.tournament ?? {}),
    },
    scheduleDefaults: {
      ...DEFAULT_WORKBOOK_DRAFT_CONFIG.scheduleDefaults,
      ...(input.scheduleDefaults ?? {}),
    },
    workbookOptions: {
      ...DEFAULT_WORKBOOK_DRAFT_CONFIG.workbookOptions,
      ...(input.workbookOptions ?? {}),
    },
    divisions: (input.divisions ?? []).map((division, index) => ({
      name: '',
      slug: '',
      formatType: FORMAT_TYPES.POOL_TO_BRACKET,
      teamCount: 8,
      poolCount: 2,
      teamsAdvancePerPool: 2,
      thirdPlaceGame: false,
      consolationBracket: false,
      gameDurationMinutes:
        input.scheduleDefaults?.gameDurationMinutes ??
        DEFAULT_WORKBOOK_DRAFT_CONFIG.scheduleDefaults.gameDurationMinutes,
      breakBetweenGamesMinutes:
        input.scheduleDefaults?.breakBetweenGamesMinutes ??
        DEFAULT_WORKBOOK_DRAFT_CONFIG.scheduleDefaults.breakBetweenGamesMinutes,
      sortOrder: index,
      ...division,
    })),
  }

  if (!merged.workbookOptions.includeScheduleDraft) {
    merged.workbookOptions.scheduleDraftLevel = WORKBOOK_SCHEDULE_DRAFT_LEVELS.NONE
  }

  return merged
}

export function validateWorkbookDraftConfig(config) {
  const errors = []

  if (!config.tournament?.name?.trim()) {
    errors.push('Tournament name is required.')
  }

  if (!config.scheduleDefaults?.numberOfDays || config.scheduleDefaults.numberOfDays < 1) {
    errors.push('Number of tournament days must be at least 1.')
  }

  if (!config.scheduleDefaults?.fieldsCount || config.scheduleDefaults.fieldsCount < 1) {
    errors.push('Number of fields must be at least 1.')
  }

  if (!config.scheduleDefaults?.gameDurationMinutes || config.scheduleDefaults.gameDurationMinutes < 20) {
    errors.push('Game duration must be at least 20 minutes.')
  }

  if (!Array.isArray(config.divisions) || config.divisions.length === 0) {
    errors.push('At least one division is required.')
  }

  for (const division of config.divisions ?? []) {
    if (!division.name?.trim()) {
      errors.push('Each division must have a name.')
    }

    if (!division.teamCount || division.teamCount < 2) {
      errors.push(`Division "${division.name || 'Unnamed'}" must have at least 2 teams.`)
    }

    if (!division.formatType) {
      errors.push(`Division "${division.name || 'Unnamed'}" must have a format type.`)
    }

    if (isPoolBasedFormat(division.formatType) && (!division.poolCount || division.poolCount < 1)) {
      errors.push(`Division "${division.name || 'Unnamed'}" must have at least 1 pool.`)
    }
  }

  return errors
}

export function isPoolBasedFormat(formatType) {
  return [
    FORMAT_TYPES.POOL_TO_BRACKET,
    FORMAT_TYPES.POOL_TO_PLACEMENT,
    FORMAT_TYPES.CROSSOVER,
  ].includes(formatType)
}

export function toSlug(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}