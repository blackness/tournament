import { FORMAT_TYPES } from '../constants.js'

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

export const WORKBOOK_TEMPLATE_TYPES = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
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
    templateType: WORKBOOK_TEMPLATE_TYPES.SIMPLE,
  },

  divisions: [],
  fields: [],
  tournamentDays: [],
  schedules: [],
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
      teamCount: 0,
      poolCount: 0,
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
      pools: [],
      teams: [],
      ...division,
    })),
    fields: Array.isArray(input.fields) ? input.fields : [],
    tournamentDays: Array.isArray(input.tournamentDays) ? input.tournamentDays : [],
    schedules: Array.isArray(input.schedules) ? input.schedules : [],
  }

  if (!merged.workbookOptions.includeScheduleDraft) {
    merged.workbookOptions.scheduleDraftLevel = WORKBOOK_SCHEDULE_DRAFT_LEVELS.NONE
  }

  if (
    !Object.values(WORKBOOK_TEMPLATE_TYPES).includes(merged.workbookOptions.templateType)
  ) {
    merged.workbookOptions.templateType = WORKBOOK_TEMPLATE_TYPES.SIMPLE
  }

  return merged
}

export function validateWorkbookDraftConfig(config) {
  const errors = []

  if (
    config.scheduleDefaults?.numberOfDays != null &&
    Number(config.scheduleDefaults.numberOfDays) < 1
  ) {
    errors.push('Number of tournament days must be at least 1.')
  }

  if (
    config.scheduleDefaults?.fieldsCount != null &&
    Number(config.scheduleDefaults.fieldsCount) < 1
  ) {
    errors.push('Number of fields must be at least 1.')
  }

  if (
    config.scheduleDefaults?.gameDurationMinutes != null &&
    Number(config.scheduleDefaults.gameDurationMinutes) < 20
  ) {
    errors.push('Game duration must be at least 20 minutes.')
  }

  const allowedTemplateTypes = Object.values(WORKBOOK_TEMPLATE_TYPES)
  if (
    config.workbookOptions?.templateType &&
    !allowedTemplateTypes.includes(config.workbookOptions.templateType)
  ) {
    errors.push('Workbook template type must be either "simple" or "advanced".')
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