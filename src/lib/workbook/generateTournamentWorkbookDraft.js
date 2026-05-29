import ExcelJS from 'exceljs'
import {
  normalizeWorkbookDraftConfig,
  validateWorkbookDraftConfig,
  toSlug,
  isPoolBasedFormat,
  WORKBOOK_SCHEDULE_DRAFT_LEVELS,
  WORKBOOK_TEAM_ROW_STYLES,
} from './workbookDraftConfig'
import { buildInstructionsSheet } from './sheets/buildInstuctionsSheet'
import { buildTournamentSheet } from './sheets/buildTournamentSheet'
import { buildDivisionsSheet } from './sheets/buildDivisionsSheet'
import { buildPoolsSheet } from './sheets/buildPoolsSheet'
import { buildTeamsSheet } from './sheets/buildTeamsSheet'
import { buildRostersSheet } from './sheets/buildRostersSheet'
import { buildFieldsSheet } from './sheets/buildFieldsSheet'
import { buildTournamentDaysSheet } from './sheets/buildTournamentDaysSheet'
import { buildScheduleDraftSheet } from './sheets/buildScheduleDraftSheet'

export async function generateTournamentWorkbookDraft(inputConfig) {
  const config = normalizeWorkbookDraftConfig(inputConfig)
  const errors = validateWorkbookDraftConfig(config)

  if (errors.length > 0) {
    const err = new Error('Workbook draft config is invalid.')
    err.validationErrors = errors
    throw err
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AthleteOS'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.subject = 'Tournament Workbook Draft'
  workbook.title = config.tournament.name || 'Tournament Workbook Draft'

  const derived = buildDerivedDraftData(config)

  buildInstructionsSheet(workbook, config, derived)
  buildTournamentSheet(workbook, config)
  buildDivisionsSheet(workbook, config)
  if (derived.hasPools) buildPoolsSheet(workbook, config, derived)
  buildTeamsSheet(workbook, config, derived)
  if (config.workbookOptions.includeRosters) buildRostersSheet(workbook, config, derived)
  buildFieldsSheet(workbook, config, derived)
  buildTournamentDaysSheet(workbook, config, derived)

  if (
    config.workbookOptions.includeScheduleDraft &&
    config.workbookOptions.scheduleDraftLevel !== WORKBOOK_SCHEDULE_DRAFT_LEVELS.NONE
  ) {
    buildScheduleDraftSheet(workbook, config, derived)
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return {
    fileName: buildWorkbookFileName(config),
    buffer,
    config,
  }
}

function buildWorkbookFileName(config) {
  const base = toSlug(config.tournament.name || 'tournament')
  return `${base}-workbook-draft.xlsx`
}

function buildDerivedDraftData(config) {
  const divisions = config.divisions.map((division, divisionIndex) => {
    const divisionSlug = division.slug || toSlug(division.name)
    const pools = isPoolBasedFormat(division.formatType)
      ? buildPoolsForDivision(division)
      : []

    const teams = buildTeamsForDivision(division, config.workbookOptions)

    return {
      ...division,
      divisionIndex,
      divisionSlug,
      pools,
      teams,
    }
  })

  return {
    divisions,
    hasPools: divisions.some(d => d.pools.length > 0),
    fields: buildFields(config.scheduleDefaults.fieldsCount),
    tournamentDays: buildTournamentDays(
      config.tournament.startDate,
      config.scheduleDefaults.numberOfDays,
      config.scheduleDefaults.dayStartTime
    ),
  }
}

function buildPoolsForDivision(division) {
  const poolCount = Number(division.poolCount || 0)
  return Array.from({ length: poolCount }).map((_, index) => {
    const letter = String.fromCharCode(65 + index)
    return {
      name: `Pool ${letter}`,
      shortName: letter,
      sortOrder: index,
    }
  })
}

function buildTeamsForDivision(division, workbookOptions) {
  const count = Number(division.teamCount || 0)
  const teams = Array.from({ length: count }).map((_, index) => {
    const seed = index + 1
    return {
      seed,
      teamName:
        workbookOptions.teamRowStyle === WORKBOOK_TEAM_ROW_STYLES.BLANK
          ? ''
          : workbookOptions.teamRowStyle === WORKBOOK_TEAM_ROW_STYLES.PLACEHOLDER
          ? `Team ${seed}`
          : `Seed ${seed}`,
      shortName: '',
      schoolName: '',
      primaryColor: '',
      poolName: '',
    }
  })

  if (workbookOptions.autoAssignPoolsEvenly && isPoolBasedFormat(division.formatType)) {
    const pools = buildPoolsForDivision(division)
    teams.forEach((team, index) => {
      const pool = pools[index % pools.length]
      team.poolName = pool?.name ?? ''
    })
  }

  return teams
}

function buildFields(fieldsCount) {
  return Array.from({ length: Number(fieldsCount || 0) }).map((_, index) => ({
    fieldName: `Field ${index + 1}`,
    shortName: `F${index + 1}`,
    qrSlug: `field-${index + 1}`,
    sortOrder: index + 1,
  }))
}

function buildTournamentDays(startDate, numberOfDays, dayStartTime) {
  return Array.from({ length: Number(numberOfDays || 0) }).map((_, index) => {
    let eventDate = ''
    if (startDate) {
      const date = new Date(startDate + 'T12:00:00')
      date.setDate(date.getDate() + index)
      eventDate = date.toISOString().slice(0, 10)
    }

    return {
      dayIndex: index + 1,
      eventDate,
      startTime: dayStartTime || '09:00',
    }
  })
}