import ExcelJS from 'exceljs'
import {
  normalizeWorkbookDraftConfig,
  validateWorkbookDraftConfig,
  toSlug,
  isPoolBasedFormat,
  WORKBOOK_SCHEDULE_DRAFT_LEVELS,
  WORKBOOK_TEAM_ROW_STYLES,
  WORKBOOK_TEMPLATE_TYPES,
} from './workbookDraftConfig.js'
import { buildInstructionsSheet } from './sheets/buildInstuctionsSheet.js'
import { buildTournamentSheet } from './sheets/buildTournamentSheet.js'
import { buildDivisionsSheet } from './sheets/buildDivisionsSheet.js'
import { buildPoolsSheet } from './sheets/buildPoolsSheet.js'
import { buildTeamsSheet } from './sheets/buildTeamsSheet.js'
import { buildRostersSheet } from './sheets/buildRostersSheet.js'
import { buildFieldsSheet } from './sheets/buildFieldsSheet.js'
import { buildTournamentDaysSheet } from './sheets/buildTournamentDaysSheet.js'
import { buildScheduleDraftSheet } from './sheets/buildScheduleDraftSheet.js'
import { buildSchedulesSheet } from './sheets/buildSchedulesSheet.js'

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
  const templateType =
    config.workbookOptions?.templateType || WORKBOOK_TEMPLATE_TYPES.SIMPLE

  buildInstructionsSheet(workbook, config, derived)
  buildTournamentSheet(workbook, config)
  buildDivisionsSheet(workbook, config)

  if (derived.hasPools) {
    buildPoolsSheet(workbook, config, derived)
  }

  buildTeamsSheet(workbook, config, derived)

  if (config.workbookOptions.includeRosters) {
    buildRostersSheet(workbook, config, derived)
  }

  buildFieldsSheet(workbook, config, derived)
  buildTournamentDaysSheet(workbook, config, derived)

  if (
    config.workbookOptions.includeScheduleDraft &&
    config.workbookOptions.scheduleDraftLevel !== WORKBOOK_SCHEDULE_DRAFT_LEVELS.NONE
  ) {
    buildScheduleDraftSheet(workbook, config, derived)
  }

  buildSchedulesSheet(workbook, config, derived)

  // NEW: optional playoff schedule template sheet
  buildPlayoffScheduleTemplateSheet(workbook, config)

  if (templateType === WORKBOOK_TEMPLATE_TYPES.ADVANCED) {
    // future advanced-template hook
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

    const pools =
      Array.isArray(division.pools) && division.pools.length > 0
        ? normalizePoolsForDivision(division.pools)
        : isPoolBasedFormat(division.formatType)
        ? buildPoolsForDivision(division)
        : []

    const teams =
      Array.isArray(division.teams) && division.teams.length > 0
        ? normalizeTeamsForDivision(division.teams, pools, division, config.workbookOptions)
        : buildTeamsForDivision(division, config.workbookOptions, pools)

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
    fields:
      Array.isArray(config.fields) && config.fields.length > 0
        ? normalizeFields(config.fields)
        : buildFields(config.scheduleDefaults.fieldsCount),
    tournamentDays:
      Array.isArray(config.tournamentDays) && config.tournamentDays.length > 0
        ? normalizeTournamentDays(config.tournamentDays)
        : buildTournamentDays(
            config.tournament.startDate,
            config.scheduleDefaults.numberOfDays,
            config.scheduleDefaults.dayStartTime,
            config.scheduleDefaults.dayEndTime
          ),
    schedules: buildSchedules(config),
  }
}

function buildPoolsForDivision(division) {
  const poolCount = Number(division.poolCount || 0)

  return Array.from({ length: poolCount }).map((_, index) => {
    const letter = String.fromCharCode(65 + index)
    return {
      name: `Pool ${letter}`,
      shortName: letter,
      sortOrder: index + 1,
    }
  })
}

function normalizePoolsForDivision(pools) {
  return pools.map((pool, index) => ({
    name: pool.name || `Pool ${String.fromCharCode(65 + index)}`,
    shortName: pool.shortName || pool.short_name || String.fromCharCode(65 + index),
    sortOrder: pool.sortOrder ?? pool.sort_order ?? index + 1,
  }))
}

function buildTeamsForDivision(division, workbookOptions, pools = []) {
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

  if (
    workbookOptions.autoAssignPoolsEvenly &&
    isPoolBasedFormat(division.formatType) &&
    pools.length > 0
  ) {
    teams.forEach((team, index) => {
      const pool = pools[index % pools.length]
      team.poolName = pool?.name ?? ''
    })
  }

  return teams
}

function normalizeTeamsForDivision(teams, pools, division, workbookOptions) {
  const normalizedTeams = teams.map((team, index) => ({
    seed: team.seed ?? index + 1,
    teamName: team.name || team.teamName || '',
    shortName: team.shortName || team.short_name || '',
    schoolName: team.schoolName || team.clubName || team.school_name || '',
    primaryColor: team.primaryColor || team.primary_color || '',
    poolName: team.poolName || team.pool_name || '',
  }))

  if (
    workbookOptions.autoAssignPoolsEvenly &&
    isPoolBasedFormat(division.formatType) &&
    pools.length > 0
  ) {
    const hasAnyPoolAssigned = normalizedTeams.some(team => team.poolName)

    if (!hasAnyPoolAssigned) {
      normalizedTeams.forEach((team, index) => {
        const pool = pools[index % pools.length]
        team.poolName = pool?.name ?? ''
      })
    }
  }

  return normalizedTeams
}

function normalizeFields(fields) {
  return fields.map((field, index) => ({
    fieldName: field.fieldName || field.field_name || field.name || `Field ${index + 1}`,
    shortName: field.shortName || field.short_name || '',
    qrSlug: field.qrSlug || field.qr_slug || '',
    sortOrder: field.sortOrder ?? field.sort_order ?? index + 1,
  }))
}

function normalizeTournamentDays(days) {
  return days.map((day, index) => ({
    dayIndex: day.dayIndex ?? day.day_index ?? index + 1,
    eventDate: day.eventDate || day.event_date || '',
    startTime: day.startTime || day.start_time || '09:00',
    endTime: day.endTime || day.end_time || '',
    label: day.label || '',
  }))
}

function buildFields(fieldsCount) {
  return Array.from({ length: Number(fieldsCount || 0) }).map((_, index) => ({
    fieldName: `Field ${index + 1}`,
    shortName: `F${index + 1}`,
    qrSlug: `field-${index + 1}`,
    sortOrder: index + 1,
  }))
}

function buildTournamentDays(startDate, numberOfDays, dayStartTime, dayEndTime) {
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
      endTime: dayEndTime || '17:00',
      label: `Day ${index + 1}`,
    }
  })
}

function buildSchedules(config) {
  if (!Array.isArray(config.schedules) || config.schedules.length === 0) {
    return []
  }

  return config.schedules.map((row, index) => ({
    match_id: row.match_id || row.matchId || '',
    match_code: row.match_code || row.matchCode || `MATCH-${index + 1}`,
    division_name: row.division_name || row.divisionName || '',
    pool_name: row.pool_name || row.poolName || '',
    bracket_type: row.bracket_type || row.bracketType || '',
    round_label: row.round_label || row.roundLabel || '',
    team_a_name: row.team_a_name || row.teamAName || '',
    team_b_name: row.team_b_name || row.teamBName || '',
    scheduled_date: row.scheduled_date || row.scheduledDate || '',
    start_time: row.start_time || row.startTime || '',
    field_name: row.field_name || row.fieldName || '',
    status: row.status || 'scheduled',
    notes: row.notes || '',
  }))
}

function buildPlayoffScheduleTemplateSheetRows(playoffScheduleTemplate = []) {
  const rows = [
    {
      division: 'Open',
      match_code: 'P-SF1',
      venue: 'Field 1',
      scheduled_date: '2026-07-23',
      scheduled_time: '13:00',
      notes: 'Example semifinal slot',
      example_row: 'TRUE',
    },
  ]

  for (const row of playoffScheduleTemplate || []) {
    rows.push({
      division: row?.division || '',
      match_code: row?.match_code || '',
      venue: row?.venue || '',
      scheduled_date: row?.scheduled_date || '',
      scheduled_time: row?.scheduled_time || '',
      notes: row?.notes || '',
      example_row: '',
    })
  }

  return rows
}

function buildPlayoffScheduleTemplateSheet(workbook, config) {
  const rows = buildPlayoffScheduleTemplateSheetRows(config.playoffScheduleTemplate || [])

  const ws = workbook.addWorksheet('playoff_schedule_template')
  ws.columns = [
    { header: 'division', key: 'division', width: 22 },
    { header: 'match_code', key: 'match_code', width: 14 },
    { header: 'venue', key: 'venue', width: 20 },
    { header: 'scheduled_date', key: 'scheduled_date', width: 14 },
    { header: 'scheduled_time', key: 'scheduled_time', width: 12 },
    { header: 'notes', key: 'notes', width: 34 },
    { header: 'example_row', key: 'example_row', width: 12 },
  ]

  rows.forEach(r => ws.addRow(r))

  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}