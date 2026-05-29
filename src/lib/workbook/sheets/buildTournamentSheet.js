import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'
import { toSlug } from '../workbookDraftConfig'

export function buildTournamentSheet(workbook, config) {
  const ws = workbook.addWorksheet('Tournament')

  const headers = [
    'tournament_name',
    'slug',
    'sport',
    'timezone',
    'start_date',
    'end_date',
    'host_school',
    'location',
    'primary_color',
  ]

  addStyledHeaderRow(ws, headers)

  ws.addRow([
    config.tournament.name,
    config.tournament.slug || toSlug(config.tournament.name),
    config.tournament.sport,
    config.tournament.timezone,
    config.tournament.startDate,
    config.tournament.endDate,
    config.tournament.hostSchool,
    config.tournament.location,
    config.tournament.primaryColor,
  ])

  autoSizeColumns(ws)
}