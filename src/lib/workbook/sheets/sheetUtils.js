export function addStyledHeaderRow(worksheet, headers) {
  const row = worksheet.addRow(headers)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF374151' },
  }
  row.alignment = { vertical: 'middle' }
  row.height = 20

  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  return row
}

export function autoSizeColumns(worksheet, min = 14, max = 36) {
  worksheet.columns.forEach(column => {
    let longest = min
    column.eachCell?.({ includeEmpty: true }, cell => {
      const value = cell.value == null ? '' : String(cell.value)
      longest = Math.max(longest, value.length + 2)
    })
    column.width = Math.min(Math.max(longest, min), max)
  })
}