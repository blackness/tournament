import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'

export function buildFieldsSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('Fields')

  addStyledHeaderRow(ws, [
    'example_row',
    'field_name',
    'short_name',
    'qr_slug',
    'sort_order',
  ])

  if (!derived.fields?.length) {
    ws.addRow([
      'TRUE',
      'Field 1',
      'F1',
      'field-1',
      1,
    ])
  } else {
    derived.fields.forEach(field => {
      ws.addRow([
        '',
        field.fieldName,
        field.shortName,
        field.qrSlug,
        field.sortOrder,
      ])
    })
  }

  autoSizeColumns(ws)
}