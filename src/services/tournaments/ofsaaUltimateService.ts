import { db } from '../../lib/supabase'
import {
  type BracketMatch,
  type PoolCode,
  type StandingsByPool,
  advanceWinnerAndLoser,
  populateMatchParticipants,
} from './formats/ofsaaBracketResolver'

type StandingsRow = {
  pool_id: string
  team_id: string
  rank: number | null
  pool_name: string | null
  pool_short_name: string | null
  division_id: string
}

function normalizeMatch(row: any): BracketMatch {
  return {
    id: row.id,
    tournament_id: row.tournament_id,
    division_id: row.division_id,
    match_code: row.match_code,

    source_a_type: row.source_a_type,
    source_a_ref: row.source_a_ref,
    source_b_type: row.source_b_type,
    source_b_ref: row.source_b_ref,

    team_a_id: row.team_a_id,
    team_b_id: row.team_b_id,

    winner_id: row.winner_id,
    status: row.status,

    winner_to_match_code: row.winner_to_match_code,
    winner_to_slot: row.winner_to_slot,
    loser_to_match_code: row.loser_to_match_code,
    loser_to_slot: row.loser_to_slot,
  }
}

function inferPoolCode(row: StandingsRow): PoolCode | null {
  const raw = row.pool_short_name ?? row.pool_name ?? null
  if (!raw) return null

  const cleaned = raw.trim().toUpperCase()

  if (cleaned === 'A' || cleaned === 'POOL A') return 'A'
  if (cleaned === 'B' || cleaned === 'POOL B') return 'B'
  if (cleaned === 'C' || cleaned === 'POOL C') return 'C'
  if (cleaned === 'D' || cleaned === 'POOL D') return 'D'

  return null
}

export async function loadMatchesForDivision(
  tournamentId: string,
  divisionId: string
): Promise<BracketMatch[]> {
  const { data, error } = await db.matches.byTournament(tournamentId)

  if (error) throw error

  return (data ?? [])
    .filter((m: any) => m.division_id === divisionId)
    .map(normalizeMatch)
}

export async function loadStandingsByPool(
  divisionId: string
): Promise<StandingsByPool> {
  const { data, error } = await db.standings.byDivision(divisionId)

  if (error) throw error

  const standings: StandingsByPool = {
    A: [],
    B: [],
    C: [],
    D: [],
  }

  for (const row of (data ?? []) as StandingsRow[]) {
    const poolCode = inferPoolCode(row)
    if (!poolCode) continue
    if (row.rank == null) continue
    if (!row.team_id) continue

    standings[poolCode].push({
      teamId: row.team_id,
      rank: row.rank,
    })
  }

  for (const poolCode of ['A', 'B', 'C', 'D'] as PoolCode[]) {
    standings[poolCode].sort((a, b) => a.rank - b.rank)
  }

  return standings
}

export async function persistParticipantChanges(
  before: BracketMatch[],
  after: BracketMatch[]
): Promise<void> {
  const beforeMap = new Map(before.map((m) => [m.id, m]))

  for (const next of after) {
    const prev = beforeMap.get(next.id)
    if (!prev) continue

    const changed =
      prev.team_a_id !== next.team_a_id ||
      prev.team_b_id !== next.team_b_id

    if (!changed) continue

    const { error } = await db.matches.update(next.id, {
      team_a_id: next.team_a_id,
      team_b_id: next.team_b_id,
      updated_at: new Date().toISOString(),
    })

    if (error) throw error
  }
}

export async function rebuildOFSAABracketParticipants(
  tournamentId: string,
  divisionId: string,
  options?: { overwriteExisting?: boolean }
): Promise<BracketMatch[]> {
  const matches = await loadMatchesForDivision(tournamentId, divisionId)
  const standingsByPool = await loadStandingsByPool(divisionId)

  const updatedMatches = populateMatchParticipants(matches, standingsByPool, {
    overwriteExisting: options?.overwriteExisting ?? false,
  })

  await persistParticipantChanges(matches, updatedMatches)

  return updatedMatches
}

export async function propagateCompletedOFSAAMatch(
  tournamentId: string,
  divisionId: string,
  completedMatchId: string
): Promise<BracketMatch[]> {
  const matches = await loadMatchesForDivision(tournamentId, divisionId)
  const completedMatch = matches.find((m) => m.id === completedMatchId)

  if (!completedMatch) {
    throw new Error(`Completed match not found: ${completedMatchId}`)
  }

  const advancedMatches = advanceWinnerAndLoser(completedMatch, matches)
  await persistParticipantChanges(matches, advancedMatches)

  const standingsByPool = await loadStandingsByPool(divisionId)
  const rebuiltMatches = populateMatchParticipants(advancedMatches, standingsByPool, {
    overwriteExisting: false,
  })

  await persistParticipantChanges(advancedMatches, rebuiltMatches)

  return rebuiltMatches
}

export async function rebuildAfterStandingsFinalize(
  tournamentId: string,
  divisionId: string
) {
  return rebuildOFSAABracketParticipants(tournamentId, divisionId, {
    overwriteExisting: false,
  })
}

export async function handleMatchCompletionForOFSAA(
  tournamentId: string,
  divisionId: string,
  matchId: string
) {
  return propagateCompletedOFSAAMatch(tournamentId, divisionId, matchId)
}