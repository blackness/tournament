import { addError } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validateFieldsSheet(rows, result) {
  const normalized = []
  const seenFieldNames = new Set()

  rows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const fieldName = String(row.field_name ?? '').trim()
    const shortName = String(row.short_name ?? '').trim()
    const qrSlug = String(row.qr_slug ?? '').trim()
    const sortOrderRaw = row.sort_order

    if (!fieldName && !shortName && !qrSlug && (sortOrderRaw === '' || sortOrderRaw == null)) {
      return
    }

    if (!fieldName) {
      addError(result, {
        sheet: 'Fields',
        row: rowNumber,
        column: 'field_name',
        code: 'MISSING_FIELD_NAME',
        message: 'field_name is required when defining a field.',
      })
      return
    }

    const key = fieldName.toLowerCase()
    if (seenFieldNames.has(key)) {
      addError(result, {
        sheet: 'Fields',
        row: rowNumber,
        column: 'field_name',
        code: 'DUPLICATE_FIELD',
        message: `Field "${fieldName}" appears more than once.`,
      })
    }
    seenFieldNames.add(key)

    let sortOrder = null
    if (sortOrderRaw !== '' && sortOrderRaw != null) {
      const parsed = Number(sortOrderRaw)
      if (!Number.isInteger(parsed) || parsed < 0) {
        addError(result, {
          sheet: 'Fields',
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
      field_name: fieldName,
      short_name: shortName,
      qr_slug: qrSlug,
      sort_order: sortOrder,
    })
  })

  return { rows: normalized }
}