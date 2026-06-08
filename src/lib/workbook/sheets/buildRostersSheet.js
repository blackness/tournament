import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'

export function buildRostersSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Rosters')

  addStyledHeaderRow(ws, [
    'example_row',
    'division_name',
    'team_name',
    'player_first_name',
    'player_last_name',
    'jersey_number',
    'role',
    'captain',
    'grade',
    'eligibility_notes',
  ])

  // If you do not currently generate real roster rows, include example row only.
  ws.addRow([
    'TRUE',
    'U19 Girls',
    'Example School 1',
    'Jamie',
    'Smith',
    '12',
    'Player',
    'false',
    '11',
    '',
  ])

  autoSizeColumns(ws)
}