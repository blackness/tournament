export function isExampleRow(row) {
  const value = String(row?.example_row ?? '')
    .trim()
    .toLowerCase()

  return ['true', '1', 'yes'].includes(value)
}

export function getRowNumber(row, index) {
  return row?.__rowNum ?? index + 2
}