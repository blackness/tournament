import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'
import { toSlug } from '../workbookDraftConfig.js'

export function buildDivisionsSheet(workbook, config) {
  const ws = workbook.addWorksheet('Divisions')

  addStyledHeaderRow(ws, [
    'example_row',
    'division_name',
    'division_slug',
    'format_type',
    'team_count',
    'pool_count',
    'game_duration_minutes',
    'break_between_games_minutes',
    'teams_advance_per_pool',
    'third_place_game',
    'consolation_bracket',
  ])

  if (!config.divisions?.length) {
    ws.addRow([
      'TRUE',
      'U19 Girls',
      'u19-girls',
      'pool_to_bracket',
      8,
      2,
      90,
      30,
      2,
      'true',
      'false',
    ])
  } else {
    config.divisions.forEach(division => {
      ws.addRow([
        '',
        division.name,
        division.slug || toSlug(division.name),
        division.formatType,
        division.teamCount ?? '',
        division.poolCount ?? '',
        division.gameDurationMinutes,
        division.breakBetweenGamesMinutes,
        division.teamsAdvancePerPool,
        division.thirdPlaceGame ? 'true' : 'false',
        division.consolationBracket ? 'true' : 'false',
      ])
    })
  }

  autoSizeColumns(ws)
}