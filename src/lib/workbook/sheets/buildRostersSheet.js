import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'

export function buildRostersSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Rosters')

  addStyledHeaderRow(ws, [
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

  derived.divisions.forEach(division => {
    const sampleTeam = division.teams[0]
    ws.addRow([
      division.name,
      sampleTeam?.teamName || '',
      '',
      '',
      '',
      'player',
      'false',
      '',
      '',
    ])
  })

  autoSizeColumns(ws)
}