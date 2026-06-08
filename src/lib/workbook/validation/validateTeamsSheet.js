import { addError, addWarning } from './validationResult'
import { isExampleRow, getRowNumber } from './rowHelpers'

export function validateTeamsSheet(rows, divisions, pools, result) {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeDivisions = Array.isArray(divisions) ? divisions : []
  const safePools = Array.isArray(pools) ? pools : []

  const normalized = []
  const divisionNames = new Set(
    safeDivisions.map(d => String(d.division_name ?? '').toLowerCase()).filter(Boolean)
  )
  const poolKeys = new Set(
    safePools
      .map(p => `${String(p.division_name ?? '').toLowerCase()}::${String(p.pool_name ?? '').toLowerCase()}`)
      .filter(key => key !== '::')
  )
  const seenTeams = new Set()
  const seedsByDivision = new Map()

  safeRows.forEach((row, index) => {
    if (isExampleRow(row)) return

    const rowNumber = getRowNumber(row, index)
    const divisionName = String(row.division_name ?? '').trim()
    const teamName = String(row.team_name ?? '').trim()
    const poolName = String(row.pool_name ?? '').trim()
    const seedRaw = row.seed

    if (!divisionName) {
      addError(result, {
        sheet: 'Teams',
        row: rowNumber,
        column: 'division_name',
        code: 'MISSING_DIVISION',
        message: 'division_name is required.',
      })
    } else if (!divisionNames.has(divisionName.toLowerCase())) {
      addError(result, {
        sheet: 'Teams',
        row: rowNumber,
        column: 'division_name',
        code: 'UNKNOWN_DIVISION',
        message: `Division "${divisionName}" does not exist in Divisions sheet.`,
      })
    }

    if (!teamName) {
      addError(result, {
        sheet: 'Teams',
        row: rowNumber,
        column: 'team_name',
        code: 'MISSING_TEAM_NAME',
        message: 'team_name is required.',
      })
    }

    if (divisionName && teamName) {
      const teamKey = `${divisionName.toLowerCase()}::${teamName.toLowerCase()}`
      if (seenTeams.has(teamKey)) {
        addError(result, {
          sheet: 'Teams',
          row: rowNumber,
          column: 'team_name',
          code: 'DUPLICATE_TEAM',
          message: `Team "${teamName}" appears more than once in division "${divisionName}".`,
        })
      }
      seenTeams.add(teamKey)
    }

    if (poolName) {
      const poolKey = `${divisionName.toLowerCase()}::${poolName.toLowerCase()}`
      if (!poolKeys.has(poolKey)) {
        addError(result, {
          sheet: 'Teams',
          row: rowNumber,
          column: 'pool_name',
          code: 'UNKNOWN_POOL',
          message: `Pool "${poolName}" does not exist for division "${divisionName}".`,
        })
      }
    }

    let normalizedSeed = null
    if (seedRaw !== '' && seedRaw != null) {
      const seed = Number(seedRaw)

      if (!Number.isInteger(seed) || seed < 1) {
        addError(result, {
          sheet: 'Teams',
          row: rowNumber,
          column: 'seed',
          code: 'INVALID_SEED',
          message: 'seed must be a positive integer.',
        })
      } else {
        normalizedSeed = seed

        const divisionKey = divisionName.toLowerCase()
        if (!seedsByDivision.has(divisionKey)) {
          seedsByDivision.set(divisionKey, new Set())
        }

        const seenSeeds = seedsByDivision.get(divisionKey)
        if (seenSeeds.has(seed)) {
          addWarning(result, {
            sheet: 'Teams',
            row: rowNumber,
            column: 'seed',
            code: 'DUPLICATE_SEED',
            message: `Seed "${seed}" appears more than once in division "${divisionName}".`,
          })
        }
        seenSeeds.add(seed)
      }
    }

    normalized.push({
      division_name: divisionName,
      team_name: teamName,
      short_name: row.short_name ?? '',
      school_name: row.school_name ?? '',
      seed: normalizedSeed,
      pool_name: poolName,
      primary_color: row.primary_color ?? '',
    })
  })

  return { rows: normalized }
}