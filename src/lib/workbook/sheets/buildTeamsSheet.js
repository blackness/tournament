import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'

export function buildTeamsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Teams')

  addStyledHeaderRow(ws, [
    'division_name',
    'team_name',
    'short_name',
    'school_name',
    'seed',
    'pool_name',
    'primary_color',
  ])

  derived.divisions.forEach(division => {
    division.teams.forEach(team => {
      ws.addRow([
        division.name,
        team.teamName,
        team.shortName,
        team.schoolName,
        team.seed,
        team.poolName,
        team.primaryColor,
      ])
    })
  })

  autoSizeColumns(ws)
}