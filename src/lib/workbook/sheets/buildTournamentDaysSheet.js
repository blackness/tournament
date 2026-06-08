import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'

export function buildTournamentDaysSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('TournamentDays')

  addStyledHeaderRow(ws, [
    'example_row',
    'day_index',
    'event_date',
    'start_time',
    'end_time',
    'label',
  ])

  const tournamentDays = derived.tournamentDays ?? []

  if (tournamentDays.length === 0) {
    ws.addRow([
      'TRUE',
      1,
      config.tournament?.startDate || '2026-06-01',
      config.scheduleDefaults?.dayStartTime || '09:00',
      config.scheduleDefaults?.dayEndTime || '17:00',
      'Day 1',
    ])
  } else {
    tournamentDays.forEach(day => {
      ws.addRow([
        '',
        day.dayIndex ?? '',
        day.eventDate ?? '',
        day.startTime ?? '',
        day.endTime ?? '',
        day.label ?? '',
      ])
    })
  }

  autoSizeColumns(ws)
}