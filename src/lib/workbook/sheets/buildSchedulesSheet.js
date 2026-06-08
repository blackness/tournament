import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'

export function buildSchedulesSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Schedules')

  addStyledHeaderRow(ws, [
    'example_row',
    'match_id',
    'match_code',
    'division_name',
    'pool_name',
    'bracket_type',
    'round_label',
    'team_a_name',
    'team_b_name',
    'scheduled_date',
    'start_time',
    'field_name',
    'status',
    'notes',
  ])

  const schedules = derived.schedules ?? []

  if (schedules.length === 0) {
    ws.addRow([
      'TRUE',
      'match-id-example',
      'QF-1',
      'Open',
      '',
      'championship',
      'Quarterfinal 1',
      'Team 1',
      'Team 8',
      '2026-06-06',
      '09:00',
      'Field 1',
      'scheduled',
      'Edit date, time, and field only for existing matches.',
    ])
  } else {
    schedules.forEach(row => {
      ws.addRow([
        '',
        row.match_id ?? '',
        row.match_code ?? '',
        row.division_name ?? '',
        row.pool_name ?? '',
        row.bracket_type ?? '',
        row.round_label ?? '',
        row.team_a_name ?? '',
        row.team_b_name ?? '',
        row.scheduled_date ?? '',
        row.start_time ?? '',
        row.field_name ?? '',
        row.status ?? '',
        row.notes ?? '',
      ])
    })
  }

  autoSizeColumns(ws)
}