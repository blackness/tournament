import { supabase } from './supabase'

export async function loadStandingsByPool(divisionId) {
  const { data, error } = await supabase
    .from('pool_standings_display')
    .select(`
      pool_id,
      pool_name,
      rank,
      team_id,
      team_name,
      team_short_name,
      primary_color
    `)
    .eq('division_id', divisionId)
    .order('pool_id')
    .order('rank')

  if (error) {
    console.error('Failed to load standings by pool', error)
    return {}
  }

  const standingsByPool = {}

  for (const row of data ?? []) {
    const poolLetter = extractPoolLetter(row.pool_name)
    if (!poolLetter) continue

    if (!standingsByPool[poolLetter]) standingsByPool[poolLetter] = []

    standingsByPool[poolLetter][(row.rank ?? 1) - 1] = {
      id: row.team_id,
      name: row.team_name,
      short_name: row.team_short_name,
      primary_color: row.primary_color,
    }
  }

  return standingsByPool
}

function extractPoolLetter(poolName) {
  if (!poolName) return null

  const direct = /^([A-Z])$/.exec(poolName.trim())
  if (direct) return direct[1]

  const poolWord = /pool\s+([A-Z])/i.exec(poolName)
  if (poolWord) return poolWord[1].toUpperCase()

  const trailing = /([A-Z])$/.exec(poolName.trim())
  if (trailing) return trailing[1].toUpperCase()

  return null
}