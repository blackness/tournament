import { isExampleRow } from './isExampleRow'

function isBlank(value) {
  return value == null || String(value).trim() === ''
}

function normalizeDate(value) {
  if (isBlank(value)) return ''
  return String(value).trim().slice(0, 10)
}

function normalizeTime(value) {
  if (isBlank(value)) return ''

  const raw = String(value).trim()

  if (/^\d{2}:\d{2}$/.test(raw)) return raw
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5)

  return raw
}

export function validateSchedulesSheet(rows, fields = [], result) {
  const normalizedRows = []

  const knownFieldNames = new Set(
    (fields || [])
      .map(field => String(field.field_name || field.name || '').trim().toLowerCase())
      .filter(Boolean)
  )

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // header row is 1

    if (isExampleRow(row)) return

    const matchId = String(row.match_id ?? '').trim()
    const matchCode = String(row.match_code ?? '').trim()
    const divisionName = String(row.division_name ?? '').trim()
    const poolName = String(row.pool_name ?? '').trim()
    const bracketType = String(row.bracket_type ?? '').trim()
    const roundLabel = String(row.round_label ?? '').trim()
    const teamAName = String(row.team_a_name ?? '').trim()
    const teamBName = String(row.team_b_name ?? '').trim()
    const scheduledDate = normalizeDate(row.scheduled_date)
    const startTime = normalizeTime(row.start_time)
    const fieldName = String(row.field_name ?? '').trim()
    const status = String(row.status ?? '').trim() || 'scheduled'
    const notes = String(row.notes ?? '').trim()

    if (!matchId && !matchCode) {
      result.errors.push({
        sheet: 'Schedules',
        row: rowNumber,
        column: 'match_id',
        message: 'Each schedule row must include match_id or match_code.',
      })
      return
    }

    if (!divisionName) {
      result.errors.push({
        sheet: 'Schedules',
        row: rowNumber,
        column: 'division_name',
        message: 'division_name is required.',
      })
      return
    }

    const hasAnySchedulingValue = !!scheduledDate || !!startTime || !!fieldName
    const hasAllSchedulingValues = !!scheduledDate && !!startTime && !!fieldName

    if (hasAnySchedulingValue && !hasAllSchedulingValues) {
      result.errors.push({
        sheet: 'Schedules',
        row: rowNumber,
        column: 'scheduled_date',
        message:
          'Scheduled matches require scheduled_date, start_time, and field_name together, or all three can be blank for unscheduled matches.',
      })
      return
    }

    if (fieldName && knownFieldNames.size > 0 && !knownFieldNames.has(fieldName.toLowerCase())) {
      result.errors.push({
        sheet: 'Schedules',
        row: rowNumber,
        column: 'field_name',
        message: `field_name "${fieldName}" does not match any known field.`,
      })
      return
    }

    normalizedRows.push({
      match_id: matchId,
      match_code: matchCode,
      division_name: divisionName,
      pool_name: poolName,
      bracket_type: bracketType,
      round_label: roundLabel,
      team_a_name: teamAName,
      team_b_name: teamBName,
      scheduled_date: scheduledDate,
      start_time: startTime,
      field_name: fieldName,
      status,
      notes,
    })
  })

  return {
    rows: normalizedRows,
  }
}