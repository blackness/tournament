import ExcelJS from 'exceljs'

export async function parseWorkbookFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const out = {}

  workbook.worksheets.forEach(ws => {
    const rows = worksheetToJson(ws)

    const sheetName = ws.name
    out[sheetName] = rows

    const snake = toSnakeCase(sheetName)
    const camel = toCamelCase(sheetName)
    const pascal = toPascalCase(sheetName)

    out[snake] = out[snake] || rows
    out[camel] = out[camel] || rows
    out[pascal] = out[pascal] || rows
  })

  return out
}

function worksheetToJson(ws) {
  const headerRow = ws.getRow(1)
  const headers = []

  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim()
  })

  const rows = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const obj = {}
    let hasAnyValue = false

    headers.forEach((header, colNumber) => {
      if (!header) return
      const cell = row.getCell(colNumber)
      const value = normalizeCellValue(cell?.value)
      obj[header] = value
      if (value !== '') hasAnyValue = true
    })

    if (hasAnyValue) rows.push(obj)
  })

  return rows
}

function normalizeCellValue(value) {
  if (value == null) return ''

  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim()
    if (value.result != null) return String(value.result).trim()
    if (value.richText) {
      return value.richText.map(rt => rt.text || '').join('').trim()
    }
    if (value.hyperlink != null && value.text != null) {
      return String(value.text).trim()
    }
  }

  return String(value).trim()
}

function toSnakeCase(str) {
  return String(str)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function toCamelCase(str) {
  const s = toSnakeCase(str)
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toPascalCase(str) {
  const c = toCamelCase(str)
  return c.charAt(0).toUpperCase() + c.slice(1)
}