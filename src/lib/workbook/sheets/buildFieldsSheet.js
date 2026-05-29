import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils'

export function buildFieldsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Fields')

  addStyledHeaderRow(ws, [
    'field_name',
    'short_name',
    'qr_slug',
    'sort_order',
  ])

  derived.fields.forEach(field => {
    ws.addRow([
      field.fieldName,
      field.shortName,
      field.qrSlug,
      field.sortOrder,
    ])
  })

  autoSizeColumns(ws)
}