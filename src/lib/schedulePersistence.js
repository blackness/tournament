import { supabase } from './supabase'

export async function clearSavedMatchesForTournament(tournamentId) {
  if (!tournamentId) {
    throw new Error('tournamentId is required to clear saved matches.')
  }

  console.log('Clearing saved matches for tournament:', tournamentId)

  const { data: divisions, error: divisionsErr } = await supabase
    .from('divisions')
    .select('id')
    .eq('tournament_id', tournamentId)

  if (divisionsErr) {
    throw new Error(`Failed to load divisions for schedule clear: ${divisionsErr.message}`)
  }

  const divisionIds = (divisions ?? []).map(div => div.id).filter(Boolean)

  if (divisionIds.length === 0) {
    return
  }

  const { data: beforeMatches, error: beforeErr } = await supabase
    .from('matches')
    .select('id, division_id, tournament_id')
    .in('division_id', divisionIds)

  if (beforeErr) {
    throw new Error(`Failed to inspect matches before clear: ${beforeErr.message}`)
  }

  const { error: deleteErr } = await supabase
    .from('matches')
    .delete()
    .in('division_id', divisionIds)

  if (deleteErr) {
    throw new Error(`Failed to clear saved matches for tournament: ${deleteErr.message}`)
  }

  const { data: afterMatches, error: afterErr } = await supabase
    .from('matches')
    .select('id, division_id, tournament_id')
    .in('division_id', divisionIds)

  if (afterErr) {
    throw new Error(`Failed to inspect matches after clear: ${afterErr.message}`)
  }
}