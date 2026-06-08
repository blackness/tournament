import { addError } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validatePoolsSheet(rows, divisions, result) {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeDivisions = Array.isArray(divisions) ? divisions : []

  const normalized = []
  const divisionNames = new Set(
    safeDivisions.map(d => String(d.division_name ?? '').toLowerCase()).filter(Boolean)
  )
  const seen = new Set()

  safeRows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const divisionName = String(row.division_name ?? '').trim()
    const poolName = String(row.pool_name ?? '').trim()
    const sortOrderRaw = row.sort_order

    if (!divisionName && !poolName) return

    if (!divisionName) {
      addError(result, {
        sheet: 'Pools',
        row: rowNumber,
        column: 'division_name',
        code: 'MISSING_DIVISION',
        message: 'division_name is required when defining a pool.',
      })
      return
    }

    if (!poolName) {
      addError(result, {
        sheet: 'Pools',
        row: rowNumber,
        column: 'pool_name',
        code: 'MISSING_POOL_NAME',
        message: 'pool_name is required when defining a pool.',
      })
      return
    }

    if (!divisionNames.has(divisionName.toLowerCase())) {
      addError(result, {
        sheet: 'Pools',
        row: rowNumber,
        column: 'division_name',
        code: 'UNKNOWN_DIVISION',
        message: `Division "${divisionName}" does not exist in Divisions sheet.`,
      })
    }

    const key = `${divisionName.toLowerCase()}::${poolName.toLowerCase()}`
    if (seen.has(key)) {
      addError(result, {
        sheet: 'Pools',
        row: rowNumber,
        column: 'pool_name',
        code: 'DUPLICATE_POOL',
        message: `Pool "${poolName}" appears more than once in division "${divisionName}".`,
      })
    }
    seen.add(key)

    let sortOrder = null
    if (sortOrderRaw !== '' && sortOrderRaw != null) {
      const parsed = Number(sortOrderRaw)
      if (!Number.isInteger(parsed) || parsed < 0) {
        addError(result, {
          sheet: 'Pools',
          row: rowNumber,
          column: 'sort_order',
          code: 'INVALID_SORT_ORDER',
          message: 'sort_order must be a non-negative integer.',
        })
      } else {
        sortOrder = parsed
      }
    }

    normalized.push({
      division_name: divisionName,
      pool_name: poolName,
      pool_short_name: row.pool_short_name ?? '',
      sort_order: sortOrder,
    })
  })

  return { rows: normalized }
}