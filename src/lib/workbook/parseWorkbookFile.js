import ExcelJS from 'exceljs'

const SHEET_NAME_MAP = {
  instructions: 'Instructions',
  tournament: 'Tournament',
  divisions: 'Divisions',
  teams: 'Teams',
  pools: 'Pools',
  rosters: 'Rosters',
  fields: 'Fields',
  tournamentdays: 'TournamentDays',
  formats: 'Formats',
  bracketmatches: 'BracketMatches',
  schedules: 'Schedules',
  lookuplists: 'LookupLists',
}

export async function parseWorkbookFile(file) {
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const workbookData = {}
  const sheetCollisions = []

  workbook.eachSheet(worksheet => {
    const originalName = worksheet.name
    const canonicalName = canonicalizeSheetName(originalName)
    const rows = worksheetToObjects(worksheet)

    if (workbookData[canonicalName]) {
      sheetCollisions.push({
        canonicalName,
        originalName,
      })
      return
    }

    workbookData[canonicalName] = rows
  })

  if (sheetCollisions.length > 0) {
    workbookData.__meta = {
      ...(workbookData.__meta ?? {}),
      sheetCollisions,
    }
  }

  return workbookData
}

function canonicalizeSheetName(name) {
  const normalized = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

  return SHEET_NAME_MAP[normalized] ?? String(name ?? '').trim()
}

function worksheetToObjects(worksheet) {
  const rawRows = []

  worksheet.eachRow({ includeEmpty: false }, row => {
    rawRows.push(row.values)
  })

  if (rawRows.length === 0) return []

  const headerRow = rawRows[0]
  const headers = normalizeHeaders(headerRow)
  const objects = []

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    const obj = {}

    let hasAnyValue = false

    for (let colIndex = 1; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex]
      if (!header) continue

      const value = normalizeCellValue(row?.[colIndex])

      if (value !== '' && value != null) {
        hasAnyValue = true
      }

      obj[header] = value
    }

    if (hasAnyValue) {
      obj.__rowNum = i + 1
      objects.push(obj)
    }
  }

  return objects
}

function normalizeHeaders(headerRow) {
  const headers = []

  for (let i = 0; i < headerRow.length; i++) {
    headers[i] = normalizeHeaderName(headerRow[i])
  }

  return headers
}

function normalizeHeaderName(value) {
  if (value == null) return ''

  return String(value)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeCellValue(value) {
  if (value == null) return ''

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim()
    if (value.hyperlink != null) return String(value.text || value.hyperlink).trim()
    if (value.result != null) return normalizeCellValue(value.result)
    if (value.formula != null && value.result != null) return normalizeCellValue(value.result)
    if (value instanceof Date) return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string') return value.trim()

  return value
}