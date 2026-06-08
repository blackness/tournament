import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'
import { toSlug } from '../workbookDraftConfig.js'

export function buildTeamsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Teams')

  addStyledHeaderRow(ws, [
    'example_row',
    'division_name',
    'team_name',
    'team_slug',
    'short_name',
    'school_name',
    'seed',
    'pool_name',
    'primary_color',
  ])

  const allTeams = derived.divisions.flatMap(division =>
    division.teams.map(team => ({
      divisionName: division.name,
      team,
    }))
  )

  if (allTeams.length === 0) {
    ws.addRow([
      'TRUE',
      'U19 Girls',
      'Example School 1',
      'example-school-1',
      'EX1',
      'Example High School',
      1,
      'Pool A',
      '#2563EB',
    ])
  } else {
    allTeams.forEach(({ divisionName, team }) => {
      ws.addRow([
        '',
        divisionName,
        team.teamName,
        team.teamName ? toSlug(team.teamName) : '',
        team.shortName,
        team.schoolName,
        team.seed,
        team.poolName,
        team.primaryColor,
      ])
    })
  }

  autoSizeColumns(ws)
}