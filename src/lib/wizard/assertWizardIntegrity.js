export function assertWizardIntegrity(state, { label = 'wizard-integrity', throwOnError = false } = {}) {
  const divisions = Array.isArray(state?.divisions) ? state.divisions : []
  const teams = Array.isArray(state?.teams) ? state.teams : []
  const pools = Array.isArray(state?.pools) ? state.pools : []
  const venues = Array.isArray(state?.venues) ? state.venues : []
  const tournamentDays = Array.isArray(state?.tournamentDays) ? state.tournamentDays : []
  const poolAssignments = state?.poolAssignments || {}
  const playoffConfigs = state?.playoffConfigs || {}

  const issues = []
  const warnings = []

  const divisionIds = new Set(divisions.map(d => d.id))
  const poolIds = new Set(pools.map(p => p.id))
  const teamIds = new Set(teams.map(t => t.id))

  // duplicate ids
  pushDuplicateIdIssues(divisions, 'division', issues)
  pushDuplicateIdIssues(teams, 'team', issues)
  pushDuplicateIdIssues(pools, 'pool', issues)
  pushDuplicateIdIssues(venues, 'venue', issues)

  // duplicate division names (often source of ghost confusion)
  const divisionNameMap = new Map()
  for (const d of divisions) {
    const k = String(d?.name || '').trim().toLowerCase()
    if (!k) continue
    divisionNameMap.set(k, (divisionNameMap.get(k) || 0) + 1)
  }
  for (const [name, count] of divisionNameMap.entries()) {
    if (count > 1) warnings.push(`Duplicate division name "${name}" appears ${count} times.`)
  }

  // team -> division link
  for (const t of teams) {
    if (!t?.divisionId || !divisionIds.has(t.divisionId)) {
      issues.push(`Team "${t?.name || t?.id}" references missing divisionId "${t?.divisionId}".`)
    }
  }

  // pool -> division link
  for (const p of pools) {
    if (!p?.divisionId || !divisionIds.has(p.divisionId)) {
      issues.push(`Pool "${p?.name || p?.id}" references missing divisionId "${p?.divisionId}".`)
    }
  }

  // team assignment -> valid pool + same division
  for (const [teamId, poolId] of Object.entries(poolAssignments)) {
    if (!teamIds.has(teamId)) {
      issues.push(`Pool assignment references missing teamId "${teamId}".`)
      continue
    }
    if (!poolIds.has(poolId)) {
      issues.push(`Pool assignment for team "${teamId}" references missing poolId "${poolId}".`)
      continue
    }

    const team = teams.find(t => t.id === teamId)
    const pool = pools.find(p => p.id === poolId)
    if (team && pool && team.divisionId !== pool.divisionId) {
      issues.push(
        `Pool assignment mismatch: team "${team.name}" (division ${team.divisionId}) assigned to pool "${pool.name}" (division ${pool.divisionId}).`
      )
    }
  }

  // playoff config -> valid division
  for (const divisionId of Object.keys(playoffConfigs)) {
    if (!divisionIds.has(divisionId)) {
      warnings.push(`playoffConfigs has stale entry for missing divisionId "${divisionId}".`)
    }
  }

  // basic sanity
  if (divisions.length === 0) warnings.push('No divisions loaded.')
  if (venues.length === 0) warnings.push('No venues loaded.')
  if (tournamentDays.length === 0) warnings.push('No tournament days loaded.')

  const summary = {
    divisions: divisions.length,
    teams: teams.length,
    pools: pools.length,
    venues: venues.length,
    tournamentDays: tournamentDays.length,
    poolAssignments: Object.keys(poolAssignments).length,
    playoffConfigs: Object.keys(playoffConfigs).length,
  }

  const payload = { summary, issues, warnings }

  if (issues.length > 0) {
    console.error(`[${label}] FAILED`, payload)
    if (throwOnError) {
      throw new Error(
        `[${label}] Integrity failed: ${issues[0]}`
      )
    }
  } else {
    console.log(`[${label}] OK`, payload)
  }

  return {
    ok: issues.length === 0,
    summary,
    issues,
    warnings,
  }
}

function pushDuplicateIdIssues(items, kind, issues) {
  const seen = new Set()
  for (const item of items || []) {
    const id = item?.id
    if (!id) continue
    if (seen.has(id)) {
      issues.push(`Duplicate ${kind} id "${id}".`)
    } else {
      seen.add(id)
    }
  }
}