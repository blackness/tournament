import { addError } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validateTournamentDaysSheet(rows, result) {
  const normalized = []
  const seenDayIndexes = new Set()

  rows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const dayIndexRaw = row.day_index
    const eventDate = String(row.event_date ?? '').trim()
    const startTime = String(row.start_time ?? '').trim()

    if (dayIndexRaw == null && !eventDate && !startTime) return

    let dayIndex = null

    if (dayIndexRaw == null || dayIndexRaw === '') {
      addError(result, {
        sheet: 'TournamentDays',
        row: rowNumber,
        column: 'day_index',
        code: 'MISSING_DAY_INDEX',
        message: 'day_index is required.',
      })
    } else {
      const parsed = Number(dayIndexRaw)

      if (!Number.isInteger(parsed) || parsed < 1) {
        addError(result, {
          sheet: 'TournamentDays',
          row: rowNumber,
          column: 'day_index',
          code: 'INVALID_DAY_INDEX',
          message: 'day_index must be a positive integer.',
        })
      } else {
        dayIndex = parsed

        if (seenDayIndexes.has(String(dayIndex))) {
          addError(result, {
            sheet: 'TournamentDays',
            row: rowNumber,
            column: 'day_index',
            code: 'DUPLICATE_DAY_INDEX',
            message: `day_index "${dayIndex}" appears more than once.`,
          })
        }
        seenDayIndexes.add(String(dayIndex))
      }
    }

    if (!eventDate) {
      addError(result, {
        sheet: 'TournamentDays',
        row: rowNumber,
        column: 'event_date',
        code: 'MISSING_EVENT_DATE',
        message: 'event_date is required.',
      })
    }

    if (!startTime) {
      addError(result, {
        sheet: 'TournamentDays',
        row: rowNumber,
        column: 'start_time',
        code: 'MISSING_START_TIME',
        message: 'start_time is required.',
      })
    }

    normalized.push({
      day_index: dayIndex,
      event_date: eventDate,
      start_time: startTime,
    })
  })

  return { rows: normalized }
}