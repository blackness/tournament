export function getMatchSourceLabels({
  match,
  pools = [],
  teams = [],
}) {
  const teamA = teams.find(t => t.id === match.team_a_id)
  const teamB = teams.find(t => t.id === match.team_b_id)

  const aPrimary =
    teamA?.short_name ||
    teamA?.name ||
    formatSource(match.source_a_type, match.source_a_ref, pools)

  const bPrimary =
    teamB?.short_name ||
    teamB?.name ||
    formatSource(match.source_b_type, match.source_b_ref, pools)

  return {
    aPrimary: aPrimary || 'TBD',
    bPrimary: bPrimary || 'TBD',
  }
}

function formatSource(sourceType, sourceRef, pools = []) {
  if (!sourceType && !sourceRef) return 'TBD'

  if (sourceType === 'pool_place') {
    return normalizePoolPlaceLabel(sourceRef, pools)
  }

  if (sourceType === 'winner') {
    return sourceRef ? `Winner ${sourceRef}` : 'Winner TBD'
  }

  if (sourceType === 'loser') {
    return sourceRef ? `Loser ${sourceRef}` : 'Loser TBD'
  }

  if (sourceType === 'seed') {
    return sourceRef ? `Seed ${sourceRef}` : 'Seed TBD'
  }

  return sourceRef || 'TBD'
}

function normalizePoolPlaceLabel(ref, pools = []) {
  if (!ref) return 'Pool TBD'

  if (/^[A-Z]\d+$/i.test(ref)) {
    return ref.toUpperCase()
  }

  return String(ref)
}