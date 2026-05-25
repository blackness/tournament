export function formatPoolPlace(ref) {
  if (!ref) return 'TBD'

  const match = /^([A-Z])([1-4])$/.exec(ref)
  if (!match) return ref

  const pool = match[1]
  const place = match[2]

  const placeText =
    place === '1' ? '1st' :
    place === '2' ? '2nd' :
    place === '3' ? '3rd' :
    place === '4' ? '4th' :
    place

  return `Pool ${pool} ${placeText}`
}

export function buildMatchesByCode(matches = []) {
  const map = {}
  for (const match of matches) {
    if (match?.match_code) map[match.match_code] = match
  }
  return map
}

export function getWinnerTeam(match) {
  if (!match?.winner_id) return null
  if (match.team_a?.id === match.winner_id) return match.team_a
  if (match.team_b?.id === match.winner_id) return match.team_b
  return null
}

export function getLoserTeam(match) {
  if (!match?.winner_id) return null
  if (!match.team_a?.id || !match.team_b?.id) return null
  if (match.team_a.id === match.winner_id) return match.team_b
  if (match.team_b.id === match.winner_id) return match.team_a
  return null
}

export function resolvePoolPlace(ref, standingsByPool = {}) {
  const match = /^([A-Z])([1-4])$/.exec(ref || '')
  if (!match) return null

  const pool = match[1]
  const place = Number(match[2])

  const poolStandings = standingsByPool[pool] || []
  const team = poolStandings[place - 1] || null

  return { team }
}

export function resolveParticipant({
  side,
  match,
  standingsByPool = {},
  matchesByCode = {},
  seedsLocked = false,
}) {
  const team = side === 'a' ? match.team_a : match.team_b
  const sourceType = side === 'a' ? match.source_a_type : match.source_b_type
  const sourceRef = side === 'a' ? match.source_a_ref : match.source_b_ref

  if (team?.id && seedsLocked) {
    return {
      team,
      primary: team.name,
      secondary: null,
      sourceType: 'locked',
      projected: false,
    }
  }

  if (sourceType === 'pool_place' && sourceRef) {
    const resolved = resolvePoolPlace(sourceRef, standingsByPool)
    return {
      team: resolved?.team ?? team ?? null,
      primary: formatPoolPlace(sourceRef),
      secondary: (resolved?.team ?? team)?.name ?? null,
      sourceType: 'pool_place',
      projected: !seedsLocked,
    }
  }

  if (sourceType === 'winner' && sourceRef) {
    const sourceMatch = matchesByCode[sourceRef]
    const winnerTeam = getWinnerTeam(sourceMatch)

    return {
      team: winnerTeam ?? team ?? null,
      primary: `Winner ${sourceRef}`,
      secondary: (winnerTeam ?? team)?.name ?? null,
      sourceType: 'winner',
      projected: false,
    }
  }

  if (sourceType === 'loser' && sourceRef) {
    const sourceMatch = matchesByCode[sourceRef]
    const loserTeam = getLoserTeam(sourceMatch)

    return {
      team: loserTeam ?? team ?? null,
      primary: `Loser ${sourceRef}`,
      secondary: (loserTeam ?? team)?.name ?? null,
      sourceType: 'loser',
      projected: false,
    }
  }

  return {
    team: team ?? null,
    primary: team?.name ?? 'TBD',
    secondary: null,
    sourceType: 'placeholder',
    projected: false,
  }
}

export function resolveMatchParticipants({
  match,
  standingsByPool = {},
  matchesByCode = {},
  seedsLocked = false,
}) {
  const a = resolveParticipant({
    side: 'a',
    match,
    standingsByPool,
    matchesByCode,
    seedsLocked,
  })

  const b = resolveParticipant({
    side: 'b',
    match,
    standingsByPool,
    matchesByCode,
    seedsLocked,
  })

  return {
    a,
    b,
    isProjected: !!a.projected || !!b.projected,
  }
}