export type PoolCode = 'A' | 'B' | 'C' | 'D';
export type TeamId = string;

export type StandingEntry = {
  teamId: TeamId;
  rank: number;
};

export type StandingsByPool = Record<PoolCode, StandingEntry[]>;

export type MatchSourceType = 'pool_place' | 'pool_rank' | 'winner' | 'loser' | null;

export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'complete'
  | 'forfeit'
  | 'cancelled'
  | 'postponed';

export type Slot = 'A' | 'B';

export type BracketMatch = {
  id: string;
  tournament_id: string;
  division_id: string;
  match_code: string | null;

  source_a_type: MatchSourceType;
  source_a_ref: string | null;
  source_b_type: MatchSourceType;
  source_b_ref: string | null;

  team_a_id: TeamId | null;
  team_b_id: TeamId | null;

  winner_id: TeamId | null;
  status: MatchStatus;

  winner_to_match_code: string | null;
  winner_to_slot: Slot | null;
  loser_to_match_code: string | null;
  loser_to_slot: Slot | null;
};

export function resolvePoolPlace(
  ref: string,
  standingsByPool: StandingsByPool
): TeamId {
  const match = ref.match(/^(1st|2nd|3rd|4th)\s+([A-D])$/i);

  if (!match) {
    throw new Error(`Invalid pool_place ref: ${ref}`);
  }

  const placeLabel = match[1].toLowerCase();
  const poolCode = match[2].toUpperCase() as PoolCode;

  const rankMap: Record<string, number> = {
    '1st': 1,
    '2nd': 2,
    '3rd': 3,
    '4th': 4
  };

  const rank = rankMap[placeLabel];
  const standings = standingsByPool[poolCode];

  if (!standings || standings.length < rank) {
    throw new Error(`Cannot resolve ${ref}: insufficient standings for pool ${poolCode}`);
  }

  const entry = standings[rank - 1];
  if (!entry?.teamId) {
    throw new Error(`Cannot resolve ${ref}: missing team`);
  }

  return entry.teamId;
}

export function resolvePoolRank(
  ref: string,
  standingsByPool: StandingsByPool
): TeamId {
  const match = ref.match(/^([A-D])([1-4])$/i);

  if (!match) {
    throw new Error(`Invalid pool_rank ref: ${ref}`);
  }

  const poolCode = match[1].toUpperCase() as PoolCode;
  const rank = parseInt(match[2], 10);

  const standings = standingsByPool[poolCode];
  if (!standings || standings.length < rank) {
    throw new Error(`Cannot resolve ${ref}: insufficient standings for pool ${poolCode}`);
  }

  const entry = standings[rank - 1];
  if (!entry?.teamId) {
    throw new Error(`Cannot resolve ${ref}: missing team`);
  }

  return entry.teamId;
}

export function getLoserId(match: BracketMatch): TeamId | null {
  if (match.status !== 'complete' && match.status !== 'forfeit') {
    return null;
  }

  if (!match.team_a_id || !match.team_b_id || !match.winner_id) {
    return null;
  }

  if (match.winner_id === match.team_a_id) return match.team_b_id;
  if (match.winner_id === match.team_b_id) return match.team_a_id;

  return null;
}

export function buildMatchesByCode(matches: BracketMatch[]): Map<string, BracketMatch> {
  const map = new Map<string, BracketMatch>();

  for (const match of matches) {
    if (match.match_code) {
      map.set(match.match_code, match);
    }
  }

  return map;
}

export function resolveSource(
  sourceType: MatchSourceType,
  sourceRef: string | null,
  standingsByPool: StandingsByPool,
  matchesByCode: Map<string, BracketMatch>
): TeamId | null {
  if (!sourceType || !sourceRef) return null;

  if (sourceType === 'pool_place') {
    return resolvePoolPlace(sourceRef, standingsByPool);
  }

  if (sourceType === 'pool_rank') {
    return resolvePoolRank(sourceRef, standingsByPool);
  }

  if (sourceType === 'winner') {
    const sourceMatch = matchesByCode.get(sourceRef);
    if (!sourceMatch) return null;
    if (sourceMatch.status !== 'complete' && sourceMatch.status !== 'forfeit') return null;
    return sourceMatch.winner_id ?? null;
  }

  if (sourceType === 'loser') {
    const sourceMatch = matchesByCode.get(sourceRef);
    if (!sourceMatch) return null;
    return getLoserId(sourceMatch);
  }

  return null;
}

export function populateMatchParticipants(
  matches: BracketMatch[],
  standingsByPool: StandingsByPool,
  options?: { overwriteExisting?: boolean }
): BracketMatch[] {
  const overwriteExisting = options?.overwriteExisting ?? false;
  const matchesByCode = buildMatchesByCode(matches);

  return matches.map((match) => {
    let nextTeamA = match.team_a_id;
    let nextTeamB = match.team_b_id;

    if (overwriteExisting || !nextTeamA) {
      const resolvedA = resolveSource(
        match.source_a_type,
        match.source_a_ref,
        standingsByPool,
        matchesByCode
      );
      if (resolvedA) nextTeamA = resolvedA;
    }

    if (overwriteExisting || !nextTeamB) {
      const resolvedB = resolveSource(
        match.source_b_type,
        match.source_b_ref,
        standingsByPool,
        matchesByCode
      );
      if (resolvedB) nextTeamB = resolvedB;
    }

    return {
      ...match,
      team_a_id: nextTeamA,
      team_b_id: nextTeamB
    };
  });
}

export function advanceWinnerAndLoser(
  completedMatch: BracketMatch,
  matches: BracketMatch[]
): BracketMatch[] {
  if (completedMatch.status !== 'complete' && completedMatch.status !== 'forfeit') {
    return matches;
  }

  if (!completedMatch.winner_id || !completedMatch.team_a_id || !completedMatch.team_b_id) {
    return matches;
  }

  const loserId = getLoserId(completedMatch);
  const winnerCode = completedMatch.winner_to_match_code;
  const loserCode = completedMatch.loser_to_match_code;
  const winnerSlot = completedMatch.winner_to_slot;
  const loserSlot = completedMatch.loser_to_slot;

  return matches.map((match) => {
    if (!match.match_code) return match;

    const next = { ...match };

    if (winnerCode && match.match_code === winnerCode && winnerSlot) {
      if (winnerSlot === 'A') next.team_a_id = completedMatch.winner_id;
      if (winnerSlot === 'B') next.team_b_id = completedMatch.winner_id;
    }

    if (loserCode && match.match_code === loserCode && loserSlot && loserId) {
      if (loserSlot === 'A') next.team_a_id = loserId;
      if (loserSlot === 'B') next.team_b_id = loserId;
    }

    return next;
  });
}