import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'

export function buildTournamentDaysSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('TournamentDays')

  addStyledHeaderRow(ws, [
    'day_index',
    'event_date',
    'start_time',
  ])

  derived.tournamentDays.forEach(day => {
    ws.addRow([
      day.dayIndex,
      day.eventDate,
      day.startTime,
    ])
  })

  autoSizeColumns(ws)
}