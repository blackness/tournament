export function validatePlayoffScheduleTemplateSheet(
  rows,
  divisions = [],
  fields = [],
  result
) {
  const normalizedRows = []
  const divisionNames = new Set(
    (divisions || []).map(d =>
      String(d?.division_name || d?.name || '').trim().toLowerCase()
    )
  )

  const fieldNames = new Set(
    (fields || []).map(f =>
      String(f?.field_name || f?.fieldName || f?.name || '').trim().toLowerCase()
    )
  )

  ;(rows || []).forEach((rawRow, index) => {
    const rowNumber = index + 2 // row 1 = header

    const row = normalizeRow(rawRow)

    if (isExampleRow(row)) return
    if (isEmptyRow(row)) return

    // Required
    if (!row.division) {
      addError(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'division',
        message: 'Division is required.',
      })
      return
    }

    if (!row.match_code) {
      addError(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'match_code',
        message: 'Match code is required.',
      })
      return
    }

    // Division existence check (warning, not fatal)
    if (divisionNames.size > 0 && !divisionNames.has(row.division.toLowerCase())) {
      addWarning(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'division',
        message: `Unknown division "${row.division}". Row will be skipped unless division exists in workbook.`,
      })
    }

    // Venue existence check (warning)
    if (row.venue && fieldNames.size > 0 && !fieldNames.has(row.venue.toLowerCase())) {
      addWarning(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'venue',
        message: `Unknown venue "${row.venue}".`,
      })
    }

    if (row.scheduled_date && !isValidDateOnly(row.scheduled_date)) {
      addError(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'scheduled_date',
        message: `Invalid date "${row.scheduled_date}". Expected YYYY-MM-DD.`,
      })
      return
    }

    if (row.scheduled_time && !isValidTimeOnly(row.scheduled_time)) {
      addError(result, {
        sheet: 'playoff_schedule_template',
        row: rowNumber,
        column: 'scheduled_time',
        message: `Invalid time "${row.scheduled_time}". Expected HH:MM.`,
      })
      return
    }

    normalizedRows.push(row)
  })

  return { rows: normalizedRows }
}

function normalizeRow(row) {
  return {
    division: norm(row?.division),
    match_code: norm(row?.match_code),
    venue: norm(row?.venue),
    scheduled_date: norm(row?.scheduled_date),
    scheduled_time: norm(row?.scheduled_time),
    notes: norm(row?.notes),
    example_row: norm(row?.example_row),
  }
}

function norm(v) {
  return String(v ?? '').trim()
}

function isExampleRow(row) {
  const v = String(row?.example_row ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

function isEmptyRow(row) {
  return (
    !row.division &&
    !row.match_code &&
    !row.venue &&
    !row.scheduled_date &&
    !row.scheduled_time &&
    !row.notes
  )
}

function isValidDateOnly(v) {
  if (!v) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime())
}

function isValidTimeOnly(v) {
  if (!v) return true
  return /^\d{2}:\d{2}$/.test(v)
}

function addError(result, issue) {
  result.errors = result.errors || []
  result.errors.push(issue)
}

function addWarning(result, issue) {
  result.warnings = result.warnings || []
  result.warnings.push(issue)
}