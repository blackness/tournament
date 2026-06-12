export function finalizePlayoffRoundOneTeams({
  matches = [],
  standingsRows = [],
  pools = [],
}) {
  const nextMatches = matches.map(match => {
    const isRoundOne = Number(match.round ?? 0) === 1
    if (!isRoundOne) return match

    const resolvedA = resolvePoolPlaceSource({
      sourceType: match.source_a_type,
      sourceRef: match.source_a_ref,
      standingsRows,
      pools,
    })

    const resolvedB = resolvePoolPlaceSource({
      sourceType: match.source_b_type,
      sourceRef: match.source_b_ref,
      standingsRows,
      pools,
    })

    return {
      ...match,
      team_a_id: resolvedA?.team_id ?? match.team_a_id ?? null,
      team_b_id: resolvedB?.team_id ?? match.team_b_id ?? null,
    }
  })

  return nextMatches
}

function resolvePoolPlaceSource({
  sourceType,
  sourceRef,
  standingsRows = [],
  pools = [],
}) {
  if (sourceType !== 'pool_place' || !sourceRef) return null

  const parsed = parsePoolPlaceRef(sourceRef)
  if (!parsed) return null

  const matchingPool = findPoolByToken(parsed.poolToken, pools)
  if (!matchingPool) return null

  const poolDbId = matchingPool.dbId || matchingPool.id

  const row = (standingsRows || []).find(r => {
    return (
      String(r.pool_id) === String(poolDbId) &&
      Number(r.rank) === Number(parsed.rank)
    )
  })

  return row || null
}

function parsePoolPlaceRef(ref) {
  const normalized = String(ref || '').trim().toUpperCase()

  const match = normalized.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null

  return {
    poolToken: match[1],
    rank: Number(match[2]),
  }
}

function findPoolByToken(poolToken, pools = []) {
  const normalizedToken = String(poolToken || '').trim().toUpperCase()

  return (pools || []).find(pool => {
    const shortName = String(pool.shortName || pool.short_name || '').trim().toUpperCase()
    const name = String(pool.name || '').trim().toUpperCase()

    if (shortName === normalizedToken) return true
    if (name === normalizedToken) return true
    if (name === `POOL ${normalizedToken}`) return true

    return false
  }) || null
}