import { addError } from './validationResult'

export const REQUIRED_SHEETS = ['Tournament', 'Divisions', 'Teams']

export const REQUIRED_COLUMNS = {
  Tournament: ['tournament_name'],
  Divisions: ['division_name', 'format_type'],
  Pools: ['division_name', 'pool_name'],
  Teams: ['division_name', 'team_name'],
  Rosters: ['division_name', 'team_name', 'player_first_name', 'player_last_name'],
  Fields: ['field_name'],
  TournamentDays: ['day_index', 'event_date', 'start_time'],

  // forward-compatible
  Formats: ['division_name', 'format_type'],
  BracketMatches: ['division_name', 'match_code'],
  Schedules: ['match_code', 'division_name', 'scheduled_date', 'start_time'],
}

export function validateStructure(workbookData, result) {
  validateSheetCollisions(workbookData, result)
  validateRequiredSheets(workbookData, result)
  validateSheetColumns(workbookData, result)

  return { ok: result.errors.length === 0 }
}

function validateSheetCollisions(workbookData, result) {
  const collisions = workbookData?.__meta?.sheetCollisions ?? []

  for (const collision of collisions) {
    addError(result, {
      sheet: collision.originalName,
      row: null,
      column: null,
      code: 'DUPLICATE_NORMALIZED_SHEET',
      message: `Sheet "${collision.originalName}" conflicts with another sheet after name normalization as "${collision.canonicalName}".`,
    })
  }
}

function validateRequiredSheets(workbookData, result) {
  for (const sheet of REQUIRED_SHEETS) {
    if (!Array.isArray(workbookData[sheet])) {
      addError(result, {
        sheet,
        row: null,
        column: null,
        code: 'MISSING_SHEET',
        message: `Required sheet "${sheet}" is missing.`,
      })
      continue
    }

    if (workbookData[sheet].length === 0) {
      addError(result, {
        sheet,
        row: null,
        column: null,
        code: 'EMPTY_REQUIRED_SHEET',
        message: `Required sheet "${sheet}" is present but contains no data rows.`,
      })
    }
  }
}

function validateSheetColumns(workbookData, result) {
  for (const [sheetName, rows] of Object.entries(workbookData)) {
    if (sheetName === '__meta') continue
    if (!Array.isArray(rows) || rows.length === 0) continue

    result.summary.sheetsChecked.push(sheetName)

    const requiredColumns = REQUIRED_COLUMNS[sheetName]
    if (!requiredColumns) continue

    const firstRow = rows[0] ?? {}

    for (const column of requiredColumns) {
      if (!(column in firstRow)) {
        addError(result, {
          sheet: sheetName,
          row: 1,
          column,
          code: 'MISSING_COLUMN',
          message: `Sheet "${sheetName}" is missing required column "${column}".`,
        })
      }
    }
  }
}