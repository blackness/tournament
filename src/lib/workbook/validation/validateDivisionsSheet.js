import { addError, addWarning } from './validationResult'
import { FORMAT_SUPPORT } from '../../constants'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validateDivisionsSheet(rows, result) {
  const normalized = []
  const seenNames = new Set()

  rows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const divisionName = String(row.division_name ?? '').trim()
    const formatType = String(row.format_type ?? '').trim()

    if (!divisionName) {
      addError(result, {
        sheet: 'Divisions',
        row: rowNumber,
        column: 'division_name',
        code: 'MISSING_DIVISION_NAME',
        message: 'Division name is required.',
      })
      return
    }

    if (seenNames.has(divisionName.toLowerCase())) {
      addError(result, {
        sheet: 'Divisions',
        row: rowNumber,
        column: 'division_name',
        code: 'DUPLICATE_DIVISION_NAME',
        message: `Division "${divisionName}" appears more than once.`,
      })
    }
    seenNames.add(divisionName.toLowerCase())

    if (!formatType) {
      addError(result, {
        sheet: 'Divisions',
        row: rowNumber,
        column: 'format_type',
        code: 'MISSING_FORMAT_TYPE',
        message: `Division "${divisionName}" is missing format_type.`,
      })
    } else if (!FORMAT_SUPPORT[formatType]) {
      addError(result, {
        sheet: 'Divisions',
        row: rowNumber,
        column: 'format_type',
        code: 'UNKNOWN_FORMAT_TYPE',
        message: `Format "${formatType}" is not recognized.`,
      })
    } else {
      const support = FORMAT_SUPPORT[formatType]
      if (support.status !== 'supported') {
        addWarning(result, {
          sheet: 'Divisions',
          row: rowNumber,
          column: 'format_type',
          code: 'UNSUPPORTED_OR_LIMITED_FORMAT',
          message: `Format "${formatType}" is currently marked "${support.status}".`,
        })
      }
    }

    normalized.push({
      division_name: divisionName,
      format_type: formatType,
      team_count: row.team_count ?? null,
      pool_count: row.pool_count ?? null,
      game_duration_minutes: row.game_duration_minutes ?? null,
      break_between_games_minutes: row.break_between_games_minutes ?? null,
      teams_advance_per_pool: row.teams_advance_per_pool ?? null,
      third_place_game: row.third_place_game ?? null,
      consolation_bracket: row.consolation_bracket ?? null,
    })
  })

  return { rows: normalized }
}