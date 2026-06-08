import { addError } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validateRostersSheet(rows, divisions, teams, result) {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeDivisions = Array.isArray(divisions) ? divisions : []
  const safeTeams = Array.isArray(teams) ? teams : []

  const normalized = []
  const divisionNames = new Set(
    safeDivisions.map(d => String(d.division_name ?? '').toLowerCase()).filter(Boolean)
  )
  const teamKeys = new Set(
    safeTeams
      .map(t => `${String(t.division_name ?? '').toLowerCase()}::${String(t.team_name ?? '').toLowerCase()}`)
      .filter(key => key !== '::')
  )

  safeRows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const divisionName = String(row.division_name ?? '').trim()
    const teamName = String(row.team_name ?? '').trim()
    const firstName = String(row.player_first_name ?? '').trim()
    const lastName = String(row.player_last_name ?? '').trim()

    if (!divisionName && !teamName && !firstName && !lastName) return

    if (!divisionName) {
      addError(result, {
        sheet: 'Rosters',
        row: rowNumber,
        column: 'division_name',
        code: 'MISSING_DIVISION',
        message: 'division_name is required.',
      })
    } else if (!divisionNames.has(divisionName.toLowerCase())) {
      addError(result, {
        sheet: 'Rosters',
        row: rowNumber,
        column: 'division_name',
        code: 'UNKNOWN_DIVISION',
        message: `Division "${divisionName}" does not exist in Divisions sheet.`,
      })
    }

    if (!teamName) {
      addError(result, {
        sheet: 'Rosters',
        row: rowNumber,
        column: 'team_name',
        code: 'MISSING_TEAM_NAME',
        message: 'team_name is required.',
      })
    } else {
      const teamKey = `${divisionName.toLowerCase()}::${teamName.toLowerCase()}`
      if (!teamKeys.has(teamKey)) {
        addError(result, {
          sheet: 'Rosters',
          row: rowNumber,
          column: 'team_name',
          code: 'UNKNOWN_TEAM',
          message: `Team "${teamName}" does not exist in Teams sheet for division "${divisionName}".`,
        })
      }
    }

    if (!firstName) {
      addError(result, {
        sheet: 'Rosters',
        row: rowNumber,
        column: 'player_first_name',
        code: 'MISSING_FIRST_NAME',
        message: 'player_first_name is required.',
      })
    }

    if (!lastName) {
      addError(result, {
        sheet: 'Rosters',
        row: rowNumber,
        column: 'player_last_name',
        code: 'MISSING_LAST_NAME',
        message: 'player_last_name is required.',
      })
    }

    normalized.push({
      division_name: divisionName,
      team_name: teamName,
      player_first_name: firstName,
      player_last_name: lastName,
      jersey_number: row.jersey_number ?? '',
      role: row.role ?? '',
      captain: row.captain ?? '',
      grade: row.grade ?? '',
      eligibility_notes: row.eligibility_notes ?? '',
    })
  })

  return { rows: normalized }
}