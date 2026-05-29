import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'
import { toSlug } from '../workbookDraftConfig'

export function buildDivisionsSheet(workbook, config) {
  const ws = workbook.addWorksheet('Divisions')

  addStyledHeaderRow(ws, [
    'division_name',
    'division_slug',
    'format_type',
    'game_duration_minutes',
    'break_between_games_minutes',
    'teams_advance_per_pool',
    'third_place_game',
    'consolation_bracket',
  ])

  config.divisions.forEach(division => {
    ws.addRow([
      division.name,
      division.slug || toSlug(division.name),
      division.formatType,
      division.gameDurationMinutes,
      division.breakBetweenGamesMinutes,
      division.teamsAdvancePerPool,
      division.thirdPlaceGame ? 'true' : 'false',
      division.consolationBracket ? 'true' : 'false',
    ])
  })

  autoSizeColumns(ws)
}