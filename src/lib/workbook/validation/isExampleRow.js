export function isExampleRow(row) {
  const value = row?.example_row

  if (value == null) return false

  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}