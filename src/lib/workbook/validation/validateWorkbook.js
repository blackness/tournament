import { createValidationResult } from './validationResult'
import { validateTournamentSheet } from './validateTournamentSheet'
import { validateDivisionsSheet } from './validateDivisionsSheet'
import { validatePoolsSheet } from './validatePoolsSheet'
import { validateTeamsSheet } from './validateTeamsSheet'
import { validateFieldsSheet } from './validateFieldsSheet'
import { validateTournamentDaysSheet } from './validateTournamentDaysSheet'
import { validateRostersSheet } from './validateRostersSheet'
import { validateSchedulesSheet } from './validateSchedulesSheet'

export function validateWorkbook(workbookData) {
  const result = createValidationResult()

  if (workbookData.Tournament) {
    const tournament = validateTournamentSheet(
      workbookData.Tournament,
      result
    )
    result.normalized.tournament = tournament.rows
  }

  if (workbookData.Divisions) {
    const divisions = validateDivisionsSheet(
      workbookData.Divisions,
      result
    )
    result.normalized.divisions = divisions.rows
  }

  if (workbookData.Fields) {
    const fields = validateFieldsSheet(workbookData.Fields, result)
    result.normalized.fields = fields.rows
  }

  if (workbookData.TournamentDays) {
    const tournamentDays = validateTournamentDaysSheet(
      workbookData.TournamentDays,
      result
    )
    result.normalized.tournamentDays = tournamentDays.rows
  }

  if (workbookData.Pools) {
    const pools = validatePoolsSheet(
      workbookData.Pools,
      result.normalized.divisions,
      result
    )
    result.normalized.pools = pools.rows
  }

  if (workbookData.Teams) {
    const teams = validateTeamsSheet(
      workbookData.Teams,
      result.normalized.divisions,
      result.normalized.pools,
      result
    )
    result.normalized.teams = teams.rows
  }

  if (workbookData.Rosters) {
    const rosters = validateRostersSheet(
      workbookData.Rosters,
      result.normalized.teams,
      result
    )
    result.normalized.rosters = rosters.rows
  }

  if (workbookData.Schedules) {
    const schedules = validateSchedulesSheet(
      workbookData.Schedules,
      result.normalized.fields,
      result
    )
    result.normalized.schedules = schedules.rows
  }

  result.valid = result.errors.length === 0

  return result
}