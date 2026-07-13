// src/lib/schedule/syncTournamentDaysFromDateRange.js
// src/lib/schedule/syncTournamentDaysFromDateRange.js
export function syncTournamentDaysFromDateRange(
  startDate,
  endDate,
  existingDays = [],
  {
    defaultStartTime = '09:00',
    defaultEndTime = '17:00',
    makeId = (dateStr, idx) => `day-${dateStr}-${idx + 1}`,
  } = {}
) {
  if (!startDate) return []

  const start = asDateOnly(startDate)
  const end = asDateOnly(endDate || startDate)
  if (!start || !end) return []

  const [minDate, maxDate] = start <= end ? [start, end] : [end, start]

  const existingByDate = new Map(
    (existingDays || []).map((d, i) => {
      const key = normalizeDateString(d?.eventDate || d?.event_date)
      return [
        key,
        {
          ...d,
          _originalIndex: i,
        },
      ]
    })
  )

  const out = []
  const cursor = new Date(minDate)
  let idx = 0

  while (cursor <= maxDate) {
    const dateStr = toYMD(cursor)
    const existing = existingByDate.get(dateStr)

    const day = existing
      ? {
          ...existing,
          id: existing.id || makeId(dateStr, idx),
          dayIndex: idx + 1,
          day_index: idx + 1,
          eventDate: dateStr,
          event_date: dateStr,
          startTime: normalizeTime(existing.startTime || existing.start_time) || defaultStartTime,
          start_time: normalizeTime(existing.startTime || existing.start_time) || defaultStartTime,
          endTime: normalizeTime(existing.endTime || existing.end_time) || defaultEndTime,
          end_time: normalizeTime(existing.endTime || existing.end_time) || defaultEndTime,
          label: existing.label || `Day ${idx + 1}`,
        }
      : {
          id: makeId(dateStr, idx),
          dayIndex: idx + 1,
          day_index: idx + 1,
          eventDate: dateStr,
          event_date: dateStr,
          startTime: defaultStartTime,
          start_time: defaultStartTime,
          endTime: defaultEndTime,
          end_time: defaultEndTime,
          label: `Day ${idx + 1}`,
          _auto: true,
        }

    delete day._originalIndex
    out.push(day)

    cursor.setDate(cursor.getDate() + 1)
    idx += 1
  }

  return out
}

function asDateOnly(value) {
  const s = normalizeDateString(value)
  if (!s) return null
  const d = new Date(`${s}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeDateString(value) {
  if (!value) return ''
  const s = String(value).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return toYMD(d)
}

function toYMD(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeTime(value) {
  if (!value) return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  const hh = String(Math.max(0, Math.min(23, Number(m[1])))).padStart(2, '0')
  const mm = String(Math.max(0, Math.min(59, Number(m[2])))).padStart(2, '0')
  return `${hh}:${mm}`
}

function asDateOnly(value) {
  const s = normalizeDateString(value)
  if (!s) return null
  const d = new Date(`${s}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeDateString(value) {
  if (!value) return ''
  const s = String(value).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return toYMD(d)
}

function toYMD(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeTime(value) {
  if (!value) return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  const hh = String(Math.max(0, Math.min(23, Number(m[1])))).padStart(2, '0')
  const mm = String(Math.max(0, Math.min(59, Number(m[2])))).padStart(2, '0')
  return `${hh}:${mm}`
}