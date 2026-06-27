import { parseWorkbookFile } from './parseWorkbookFile'
import { validateWorkbook } from './validation/validateWorkbook'

export async function processWorkbookUpload(file) {
  const workbookData = await parseWorkbookFile(file)

  let rawValidation
  try {
    rawValidation = validateWorkbook(workbookData) || {}
  } catch (err) {
    rawValidation = {
      valid: false,
      errors: [{ sheet: 'Workbook', row: null, column: null, message: err.message || 'Validation failed.' }],
      warnings: [],
      normalized: {},
    }
  }

  const errors = normalizeIssues(rawValidation.errors)
  const warnings = normalizeIssues(rawValidation.warnings)

  const validation = {
    ...rawValidation,
    valid: typeof rawValidation.valid === 'boolean' ? rawValidation.valid : errors.length === 0,
    errors,
    warnings,
    normalized: rawValidation.normalized || {},
  }

  return {
    workbookData,
    validation,
  }
}

function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return []

  return issues
    .filter(Boolean)
    .map(issue => {
      if (typeof issue === 'string') {
        return {
          sheet: 'Workbook',
          row: null,
          column: null,
          message: issue,
        }
      }

      return {
        sheet: issue.sheet || 'Workbook',
        row: issue.row ?? null,
        column: issue.column ?? null,
        message: issue.message || 'Unknown validation issue',
      }
    })
}