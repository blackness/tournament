import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'
import { toSlug } from '../workbookDraftConfig.js'

const WORKBOOK_TEMPLATE_VERSION = '1.5'
const DEFAULT_TEMPLATE_TYPE = 'simple'

export function buildTournamentSheet(workbook, config) {
  const ws = workbook.addWorksheet('Tournament')

  const templateType = config.workbookOptions?.templateType || DEFAULT_TEMPLATE_TYPE

  const headers = [
    'example_row',
    'tournament_name',
    'slug',
    'sport',
    'timezone',
    'start_date',
    'end_date',
    'host_school',
    'location',
    'primary_color',
    'template_version',
    'template_type',
  ]

  addStyledHeaderRow(ws, headers)

  const hasRealData =
    !!config.tournament.name ||
    !!config.tournament.slug ||
    !!config.tournament.startDate ||
    !!config.tournament.endDate ||
    !!config.tournament.hostSchool ||
    !!config.tournament.location

  if (!hasRealData) {
    ws.addRow([
      'TRUE',
      'Example Invitational',
      'example-invitational',
      'ultimate',
      'America/Toronto',
      '2026-06-05',
      '2026-06-06',
      'Example Host School',
      'Toronto, ON',
      '#1D4ED8',
      WORKBOOK_TEMPLATE_VERSION,
      templateType,
    ])
  } else {
    ws.addRow([
      '',
      config.tournament.name,
      config.tournament.slug || toSlug(config.tournament.name),
      config.tournament.sport,
      config.tournament.timezone,
      config.tournament.startDate,
      config.tournament.endDate,
      config.tournament.hostSchool,
      config.tournament.location,
      config.tournament.primaryColor,
      WORKBOOK_TEMPLATE_VERSION,
      templateType,
    ])
  }

  autoSizeColumns(ws)
}