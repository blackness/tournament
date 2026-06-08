import { addError, addWarning } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

const SUPPORTED_TEMPLATE_VERSION = '1.5'
const SUPPORTED_TEMPLATE_TYPES = ['simple', 'advanced']

export function validateTournamentSheet(rows, result) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).filter(row => !isExampleRow(row))

  if (normalizedRows.length === 0) {
    addError(result, {
      sheet: 'Tournament',
      row: null,
      column: null,
      code: 'EMPTY_TOURNAMENT_SHEET',
      message: 'Tournament sheet must contain one non-example data row.',
    })

    return { rows: [] }
  }

  if (normalizedRows.length > 1) {
    addError(result, {
      sheet: 'Tournament',
      row: getRowNumber(normalizedRows[1], 1),
      column: null,
      code: 'MULTIPLE_TOURNAMENT_ROWS',
      message: 'Tournament sheet must contain only one non-example data row.',
    })
  }

  const row = normalizedRows[0] ?? {}
  const rowNumber = getRowNumber(row, 0)

  const tournamentName = String(row.tournament_name ?? '').trim()
  const startDate = String(row.start_date ?? '').trim()
  const endDate = String(row.end_date ?? '').trim()
  const templateVersion = String(row.template_version ?? '').trim()
  const templateTypeRaw = String(row.template_type ?? '').trim()

  if (!tournamentName) {
    addError(result, {
      sheet: 'Tournament',
      row: rowNumber,
      column: 'tournament_name',
      code: 'MISSING_TOURNAMENT_NAME',
      message: 'Tournament name is required.',
    })
  }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      addError(result, {
        sheet: 'Tournament',
        row: rowNumber,
        column: 'end_date',
        code: 'INVALID_DATE_RANGE',
        message: 'end_date must be on or after start_date.',
      })
    }
  }

  if (templateVersion) {
    if (templateVersion !== SUPPORTED_TEMPLATE_VERSION) {
      addError(result, {
        sheet: 'Tournament',
        row: rowNumber,
        column: 'template_version',
        code: 'UNSUPPORTED_TEMPLATE_VERSION',
        message: `Unsupported template_version "${templateVersion}". Expected "${SUPPORTED_TEMPLATE_VERSION}".`,
      })
    }
  } else {
    addWarning(result, {
      sheet: 'Tournament',
      row: rowNumber,
      column: 'template_version',
      code: 'MISSING_TEMPLATE_VERSION',
      message: 'template_version is recommended for workbook v1.5 compatibility.',
    })
  }

  let templateType = templateTypeRaw.toLowerCase()

  if (templateTypeRaw) {
    if (!SUPPORTED_TEMPLATE_TYPES.includes(templateType)) {
      addError(result, {
        sheet: 'Tournament',
        row: rowNumber,
        column: 'template_type',
        code: 'INVALID_TEMPLATE_TYPE',
        message: `template_type must be one of: ${SUPPORTED_TEMPLATE_TYPES.join(', ')}.`,
      })
    }
  } else {
    addWarning(result, {
      sheet: 'Tournament',
      row: rowNumber,
      column: 'template_type',
      code: 'MISSING_TEMPLATE_TYPE',
      message: 'template_type is recommended for workbook v1.5 compatibility.',
    })
    templateType = ''
  }

  return {
    rows: [
      {
        tournament_name: tournamentName,
        slug: row.slug ?? '',
        sport: row.sport ?? '',
        timezone: row.timezone ?? 'America/Toronto',
        start_date: startDate || '',
        end_date: endDate || '',
        host_school: row.host_school ?? '',
        location: row.location ?? '',
        primary_color: row.primary_color ?? '',
        template_version: templateVersion || '',
        template_type: templateType || '',
      },
    ],
  }
}