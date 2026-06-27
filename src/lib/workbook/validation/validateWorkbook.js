import { createValidationResult } from './validationResult'
import { validateTournamentSheet } from './validateTournamentSheet'
import { validateDivisionsSheet } from './validateDivisionsSheet'
import { validatePoolsSheet } from './validatePoolsSheet'
import { validateTeamsSheet } from './validateTeamsSheet'
import { validateFieldsSheet } from './validateFieldsSheet'
import { validateTournamentDaysSheet } from './validateTournamentDaysSheet'
import { validateRostersSheet } from './validateRostersSheet'
import { validateSchedulesSheet } from './validateSchedulesSheet'
import { validatePlayoffScheduleTemplateSheet } from './validatePlayoffScheduleTemplateSheet'

export function validateWorkbook(workbookData) {
  const result = createValidationResult()

  // Always initialize normalized arrays to avoid undefined chains
result.normalized = result.normalized || {}
result.errors = Array.isArray(result.errors) ? result.errors : []
result.warnings = Array.isArray(result.warnings) ? result.warnings : []

result.normalized.tournament = result.normalized.tournament || []
result.normalized.divisions = result.normalized.divisions || []
result.normalized.fields = result.normalized.fields || []
result.normalized.tournamentDays = result.normalized.tournamentDays || []
result.normalized.pools = result.normalized.pools || []
result.normalized.teams = result.normalized.teams || []
result.normalized.rosters = result.normalized.rosters || []
result.normalized.schedules = result.normalized.schedules || []
result.normalized.playoff_schedule_template = result.normalized.playoff_schedule_template || []

  const Tournament = workbookData.Tournament || workbookData.tournament
  const Divisions = workbookData.Divisions || workbookData.divisions
  const Fields = workbookData.Fields || workbookData.fields
  const TournamentDays = workbookData.TournamentDays || workbookData.tournament_days || workbookData.tournamentDays
  const Pools = workbookData.Pools || workbookData.pools
  const Teams = workbookData.Teams || workbookData.teams
  const Rosters = workbookData.Rosters || workbookData.rosters
  const Schedules = workbookData.Schedules || workbookData.schedules
  const PlayoffTemplate =
    workbookData.PlayoffScheduleTemplate ||
    workbookData.playoff_schedule_template ||
    workbookData.Playoff_Schedule_Template

  if (PlayoffTemplate) {
    const playoffTemplate = validatePlayoffScheduleTemplateSheet(
      PlayoffTemplate,
      result.normalized.divisions,
      result.normalized.fields,
      result
    )
    result.normalized.playoff_schedule_template = playoffTemplate?.rows || []
  }

  if (Tournament) {
    const tournament = validateTournamentSheet(Tournament, result)
    result.normalized.tournament = tournament?.rows || []
  }

  if (Divisions) {
    const divisions = validateDivisionsSheet(Divisions, result)
    result.normalized.divisions = divisions?.rows || []
  }

  if (Fields) {
    const fields = validateFieldsSheet(Fields, result)
    result.normalized.fields = fields?.rows || []
  }

  if (TournamentDays) {
    const tournamentDays = validateTournamentDaysSheet(TournamentDays, result)
    result.normalized.tournamentDays = tournamentDays?.rows || []
  }

  if (Pools) {
    const pools = validatePoolsSheet(
      Pools,
      result.normalized.divisions,
      result
    )
    result.normalized.pools = pools?.rows || []
  }

  if (Teams) {
    const teams = validateTeamsSheet(
      Teams,
      result.normalized.divisions,
      result.normalized.pools,
      result
    )
    result.normalized.teams = teams?.rows || []
  }

  if (Rosters) {
    const rosters = validateRostersSheet(
      Rosters,
      result.normalized.teams,
      result
    )
    result.normalized.rosters = rosters?.rows || []
  }

  if (Schedules) {
    const schedules = validateSchedulesSheet(
      Schedules,
      result.normalized.fields,
      result
    )
    result.normalized.schedules = schedules?.rows || []
  }

  // Optional sheet: pass through rows now, parse later in mapper
  if (Array.isArray(PlayoffTemplate)) {
    result.normalized.playoff_schedule_template = PlayoffTemplate
  }

  result.valid = (result.errors || []).length === 0

  return result
}