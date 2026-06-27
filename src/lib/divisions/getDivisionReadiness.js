const FORMAT_RULES = {
  ROUND_ROBIN: { needsPools: false, minTeams: 2 },
  SINGLE_ELIMINATION: { needsPools: false, minTeams: 2 },
  SINGLE_ELIMINATION_BRONZE: { needsPools: false, minTeams: 4 },

  POOL_PLAY: { needsPools: true, minTeams: 4 },
  POOL_TO_SEMIS: { needsPools: true, minTeams: 4 },
  POOL_TO_SEMIS_BRONZE: { needsPools: true, minTeams: 4 },
  POOL_TO_MEDAL_5TH: { needsPools: true, minTeams: 6 },

  OFSAA_FULL_CLASSIFICATION: { needsPools: true, minTeams: 8 },
  DOUBLE_ELIMINATION: { needsPools: false, minTeams: 4 },
}

function normalizeFormatType(formatType) {
  return String(formatType || '').trim().toUpperCase()
}

export function getDivisionReadiness(division, ctx = {}) {
  const errors = []
  const warnings = []

  if (!division) {
    return { ready: false, errors: ['Division is missing.'], warnings: [] }
  }

  const teams = (ctx.teams || []).filter(t => t.divisionId === division.id)
  const pools = (ctx.pools || []).filter(p => p.divisionId === division.id)
  const poolAssignments = ctx.poolAssignments || {}

  const formatType = normalizeFormatType(division.formatType)
  if (!formatType) {
    errors.push('Format type is required.')
  }

  if (!division.name || !String(division.name).trim()) {
    errors.push('Division name is required.')
  }

  const rules = FORMAT_RULES[formatType] || { needsPools: false, minTeams: 2 }

  if (teams.length < rules.minTeams) {
    errors.push(`Needs at least ${rules.minTeams} teams (currently ${teams.length}).`)
  }

  if (rules.needsPools) {
    if (pools.length === 0) {
      errors.push('This format requires pools, but no pools are configured.')
    }

    if (teams.length > 0 && pools.length > 0) {
      const assignedCount = teams.filter(team => !!poolAssignments[team.id]).length

      if (assignedCount === 0) {
        errors.push('No teams are assigned to pools.')
      } else if (assignedCount < teams.length) {
        warnings.push(
          `${teams.length - assignedCount} team(s) are not assigned to a pool.`
        )
      }

      const validPoolIds = new Set(pools.map(p => p.id))
      const invalidAssignments = teams.filter(
        team => poolAssignments[team.id] && !validPoolIds.has(poolAssignments[team.id])
      )
      if (invalidAssignments.length > 0) {
        errors.push('Some team pool assignments reference pools not in this division.')
      }
    }
  }

  // Optional sanity checks
  if ((division.gameDurationMinutes ?? 0) <= 0) {
    warnings.push('Game duration should be greater than 0.')
  }

  if ((division.breakBetweenGamesMinutes ?? 0) < 0) {
    warnings.push('Break between games should not be negative.')
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    meta: {
      formatType,
      teamCount: teams.length,
      poolCount: pools.length,
    },
  }
}