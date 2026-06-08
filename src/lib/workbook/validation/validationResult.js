export function createValidationResult() {
  return {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      sheetsChecked: [],
    },
    normalized: {
      tournament: [],
      divisions: [],
      pools: [],
      teams: [],
      rosters: [],
      fields: [],
      tournamentDays: [],
      scheduleDraft: [],
    },
  }
}

export function addError(result, item) {
  result.errors.push({ level: 'error', ...item })
  result.valid = false
  result.summary.errorCount = result.errors.length
}

export function addWarning(result, item) {
  result.warnings.push({ level: 'warning', ...item })
  result.summary.warningCount = result.warnings.length
}