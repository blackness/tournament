import { supabase } from './supabase'

export async function resolveBracketSources({ tournamentId, divisionId }) {
  // 1. Load pools for this division
  const { data: pools, error: poolsErr } = await supabase
    .from('pools')
    .select('id, name, short_name, sort_order')
    .eq('division_id', divisionId)
    .order('sort_order')

  if (poolsErr) throw new Error('Failed to load pools: ' + poolsErr.message)

  // 2. Build pool label lookup (A, B, C, D)
  const poolByLabel = {}
  for (const pool of pools ?? []) {
    const label =
      pool.short_name?.trim()?.toUpperCase() ||
      pool.name?.replace(/^Pool\s+/i, '').trim().toUpperCase()

    if (label) {
      poolByLabel[label] = pool
    }
  }

  // 3. Load current standings / placements
  // Assumes pool_standings_display rank is the pool placement
  const { data: standingsRows, error: standingsErr } = await supabase
    .from('pool_standings_display')
    .select('team_id, pool_id, rank')
    .eq('division_id', divisionId)

  if (standingsErr) throw new Error('Failed to load standings: ' + standingsErr.message)

  // 4. Build pool-place lookup, e.g. "1A" => team_id
  const poolPlaceToTeamId = {}

  for (const row of standingsRows ?? []) {
    const pool = (pools ?? []).find(p => p.id === row.pool_id)
    if (!pool) continue

    const label =
      pool.short_name?.trim()?.toUpperCase() ||
      pool.name?.replace(/^Pool\s+/i, '').trim().toUpperCase()

    if (!label || row.rank == null) continue

    poolPlaceToTeamId[`${row.rank}${label}`] = row.team_id
  }

  // 5. Load all bracket/crossover matches for this tournament
  const { data: matches, error: matchesErr } = await supabase
    .from('matches')
    .select(`
      id,
      match_code,
      bracket_type,
      source_a_type,
      source_a_ref,
      source_b_type,
      source_b_ref,
      team_a_id,
      team_b_id,
      score_a,
      score_b,
      status
    `)
    .eq('tournament_id', tournamentId)
    .in('bracket_type', ['crossover', 'championship', 'consolation'])

  if (matchesErr) throw new Error('Failed to load bracket matches: ' + matchesErr.message)

  const matchByCode = Object.fromEntries((matches ?? []).map(m => [m.match_code, m]))

  function getWinnerTeamId(match) {
    if (!match) return null
    if (match.score_a == null || match.score_b == null) return null
    if (match.score_a === match.score_b) return null
    return match.score_a > match.score_b ? match.team_a_id : match.team_b_id
  }

  function getLoserTeamId(match) {
    if (!match) return null
    if (match.score_a == null || match.score_b == null) return null
    if (match.score_a === match.score_b) return null
    return match.score_a > match.score_b ? match.team_b_id : match.team_a_id
  }

  function resolveSource(type, ref) {
    if (!type || !ref) return null

    if (type === 'pool_place') {
      return poolPlaceToTeamId[ref] ?? null
    }

    if (type === 'winner') {
      const upstream = matchByCode[ref]
      return getWinnerTeamId(upstream)
    }

    if (type === 'loser') {
      const upstream = matchByCode[ref]
      return getLoserTeamId(upstream)
    }

    return null
  }

  // 6. Resolve and update matches where needed
  const updates = []

  for (const match of matches ?? []) {
    const resolvedA = resolveSource(match.source_a_type, match.source_a_ref)
    const resolvedB = resolveSource(match.source_b_type, match.source_b_ref)

    const needsUpdate =
      match.team_a_id !== resolvedA ||
      match.team_b_id !== resolvedB

    if (needsUpdate) {
      updates.push({
        id: match.id,
        team_a_id: resolvedA,
        team_b_id: resolvedB,
      })
    }
  }

  for (const update of updates) {
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        team_a_id: update.team_a_id,
        team_b_id: update.team_b_id,
      })
      .eq('id', update.id)

    if (updateErr) {
      throw new Error(`Failed to update match teams for ${update.id}: ${updateErr.message}`)
    }
  }

  return {
    updatedCount: updates.length,
    poolPlaceToTeamId,
  }
}