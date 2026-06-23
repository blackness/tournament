export function isExampleRow(row) {
  const value = String(row?.example_row ?? '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}