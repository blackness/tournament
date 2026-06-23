import { isExampleRow } from './isExampleRow'

function normalizeCell(value) {
  return String(value ?? '').trim()
}

function resolveDivisionByName(divisions, divisionName) {
  const needle = normalizeCell(divisionName).toLowerCase()
  if (!needle) return null

  return (
    divisions.find(div => normalizeCell(div.name).toLowerCase() === needle) ||
    null
  )
}

function resolveVenueByName(venues, venueName) {
  const needle = normalizeCell(venueName).toLowerCase()
  if (!needle) return null

  return (
    venues.find(v => normalizeCell(v.name).toLowerCase() === needle) ||
    venues.find(v => normalizeCell(v.shortName).toLowerCase() === needle) ||
    null
  )
}

function isValidDateOnly(value) {
  const str = normalizeCell(value)
  if (!str) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(new Date(`${str}T12:00`).getTime())
}

function isValidTimeOnly(value) {
  const str = normalizeCell(value)
  if (!str) return true
  return /^\d{2}:\d{2}$/.test(str)
}

/**
 * Parses workbook rows from playoff_schedule_template and returns
 * merged playoffConfigs with matchScheduleTemplate entries.
 */
export function parsePlayoffScheduleTemplateRows({
  rows = [],
  divisions = [],
  venues = [],
  playoffConfigs = {},
}) {
  const warnings = []
  const nextPlayoffConfigs = { ...(playoffConfigs || {}) }
  const seenKeys = new Set()
  let appliedCount = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // header row = 1

    if (isExampleRow(row)) return

    const divisionName = normalizeCell(row.division)
    const matchCode = normalizeCell(row.match_code)
    const venueName = normalizeCell(row.venue)
    const scheduledDate = normalizeCell(row.scheduled_date)
    const scheduledTime = normalizeCell(row.scheduled_time)
    const notes = normalizeCell(row.notes)

    // ignore empty rows
    if (!divisionName && !matchCode && !venueName && !scheduledDate && !scheduledTime && !notes) {
      return
    }

    if (!divisionName) {
      warnings.push(`playoff_schedule_template row ${rowNumber}: division is required.`)
      return
    }

    if (!matchCode) {
      warnings.push(`playoff_schedule_template row ${rowNumber}: match_code is required.`)
      return
    }

    const division = resolveDivisionByName(divisions, divisionName)
    if (!division) {
      warnings.push(`playoff_schedule_template row ${rowNumber}: unknown division "${divisionName}".`)
      return
    }

    let resolvedVenue = null
    if (venueName) {
      resolvedVenue = resolveVenueByName(venues, venueName)
      if (!resolvedVenue) {
        warnings.push(`playoff_schedule_template row ${rowNumber}: unknown venue "${venueName}".`)
        return
      }
    }

    if (scheduledDate && !isValidDateOnly(scheduledDate)) {
      warnings.push(
        `playoff_schedule_template row ${rowNumber}: invalid scheduled_date "${scheduledDate}" (expected YYYY-MM-DD).`
      )
      return
    }

    if (scheduledTime && !isValidTimeOnly(scheduledTime)) {
      warnings.push(
        `playoff_schedule_template row ${rowNumber}: invalid scheduled_time "${scheduledTime}" (expected HH:MM).`
      )
      return
    }

    const duplicateKey = `${division.id}::${matchCode}`
    if (seenKeys.has(duplicateKey)) {
      warnings.push(
        `playoff_schedule_template row ${rowNumber}: duplicate ${division.name} / ${matchCode}; later row overwrote earlier row.`
      )
    }
    seenKeys.add(duplicateKey)

    const existingDivisionConfig = nextPlayoffConfigs[division.id] || {}
    const existingTemplate = existingDivisionConfig.matchScheduleTemplate || {}

    nextPlayoffConfigs[division.id] = {
      ...existingDivisionConfig,
      matchScheduleTemplate: {
        ...existingTemplate,
        [matchCode]: {
          venueId: resolvedVenue?.id || resolvedVenue?.dbId || null,
          scheduledDate: scheduledDate || '',
          scheduledTime: scheduledTime || '',
          notes: notes || '',
        },
      },
    }

    appliedCount += 1
  })

  return {
    playoffConfigs: nextPlayoffConfigs,
    warnings,
    appliedCount,
  }
}