import { supabase } from './supabase'

export const athleteOS16TeamBracketSeeds = [
  // =========================================================
  // DAY 1 · PLAY-IN
  // =========================================================
  {
    phase: 1,
    round_label: 'Play-in',
    bracket_type: 'play_in',
    match_code: 'X1',
    display_label: '2C vs 3D',
    source_a_type: 'pool_place',
    source_a_ref: '2C',
    source_b_type: 'pool_place',
    source_b_ref: '3D',
    winner_to_match_code: 'P2',
    winner_to_slot: 'B',
    loser_to_match_code: 'C2',
    loser_to_slot: 'B',
  },
  {
    phase: 1,
    round_label: 'Play-in',
    bracket_type: 'play_in',
    match_code: 'X2',
    display_label: '2D vs 3C',
    source_a_type: 'pool_place',
    source_a_ref: '2D',
    source_b_type: 'pool_place',
    source_b_ref: '3C',
    winner_to_match_code: 'P1',
    winner_to_slot: 'B',
    loser_to_match_code: 'C1',
    loser_to_slot: 'B',
  },
  {
    phase: 1,
    round_label: 'Play-in',
    bracket_type: 'play_in',
    match_code: 'X3',
    display_label: '2A vs 3B',
    source_a_type: 'pool_place',
    source_a_ref: '2A',
    source_b_type: 'pool_place',
    source_b_ref: '3B',
    winner_to_match_code: 'P4',
    winner_to_slot: 'B',
    loser_to_match_code: 'C4',
    loser_to_slot: 'B',
  },
  {
    phase: 1,
    round_label: 'Play-in',
    bracket_type: 'play_in',
    match_code: 'X4',
    display_label: '2B vs 3A',
    source_a_type: 'pool_place',
    source_a_ref: '2B',
    source_b_type: 'pool_place',
    source_b_ref: '3A',
    winner_to_match_code: 'P3',
    winner_to_slot: 'B',
    loser_to_match_code: 'C3',
    loser_to_slot: 'B',
  },

  // =========================================================
  // DAY 2 · CHAMPIONSHIP
  // =========================================================
  {
    phase: 2,
    round_label: 'Championship Round 1',
    bracket_type: 'championship',
    match_code: 'P1',
    display_label: 'Championship QF 1',
    source_a_type: 'pool_place',
    source_a_ref: '1A',
    source_b_type: 'winner',
    source_b_ref: 'X2',
    winner_to_match_code: 'P5',
    winner_to_slot: 'A',
    loser_to_match_code: 'P7',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Championship Round 1',
    bracket_type: 'championship',
    match_code: 'P2',
    display_label: 'Championship QF 2',
    source_a_type: 'pool_place',
    source_a_ref: '1B',
    source_b_type: 'winner',
    source_b_ref: 'X1',
    winner_to_match_code: 'P5',
    winner_to_slot: 'B',
    loser_to_match_code: 'P7',
    loser_to_slot: 'B',
  },
  {
    phase: 2,
    round_label: 'Championship Round 1',
    bracket_type: 'championship',
    match_code: 'P3',
    display_label: 'Championship QF 3',
    source_a_type: 'pool_place',
    source_a_ref: '1C',
    source_b_type: 'winner',
    source_b_ref: 'X4',
    winner_to_match_code: 'P6',
    winner_to_slot: 'A',
    loser_to_match_code: 'P8',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Championship Round 1',
    bracket_type: 'championship',
    match_code: 'P4',
    display_label: 'Championship QF 4',
    source_a_type: 'pool_place',
    source_a_ref: '1D',
    source_b_type: 'winner',
    source_b_ref: 'X3',
    winner_to_match_code: 'P6',
    winner_to_slot: 'B',
    loser_to_match_code: 'P8',
    loser_to_slot: 'B',
  },

  {
    phase: 2,
    round_label: 'Championship Classification',
    bracket_type: 'championship',
    match_code: 'P5',
    display_label: 'Championship Semi 1',
    source_a_type: 'winner',
    source_a_ref: 'P1',
    source_b_type: 'winner',
    source_b_ref: 'P2',
    winner_to_match_code: 'P9',
    winner_to_slot: 'A',
    loser_to_match_code: 'P10',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Championship Classification',
    bracket_type: 'championship',
    match_code: 'P6',
    display_label: 'Championship Semi 2',
    source_a_type: 'winner',
    source_a_ref: 'P3',
    source_b_type: 'winner',
    source_b_ref: 'P4',
    winner_to_match_code: 'P9',
    winner_to_slot: 'B',
    loser_to_match_code: 'P10',
    loser_to_slot: 'B',
  },
  {
    phase: 2,
    round_label: 'Championship Classification',
    bracket_type: 'championship',
    match_code: 'P7',
    display_label: '5–8 Semi 1',
    source_a_type: 'loser',
    source_a_ref: 'P1',
    source_b_type: 'loser',
    source_b_ref: 'P2',
    winner_to_match_code: 'P11',
    winner_to_slot: 'A',
    loser_to_match_code: 'P12',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Championship Classification',
    bracket_type: 'championship',
    match_code: 'P8',
    display_label: '5–8 Semi 2',
    source_a_type: 'loser',
    source_a_ref: 'P3',
    source_b_type: 'loser',
    source_b_ref: 'P4',
    winner_to_match_code: 'P11',
    winner_to_slot: 'B',
    loser_to_match_code: 'P12',
    loser_to_slot: 'B',
  },

  {
    phase: 2,
    round_label: 'Championship Placement Finals',
    bracket_type: 'championship',
    match_code: 'P9',
    display_label: 'Gold Medal Game',
    source_a_type: 'winner',
    source_a_ref: 'P5',
    source_b_type: 'winner',
    source_b_ref: 'P6',
    placement_min: 1,
    placement_max: 2,
  },
  {
    phase: 2,
    round_label: 'Championship Placement Finals',
    bracket_type: 'championship',
    match_code: 'P10',
    display_label: 'Bronze Medal Game',
    source_a_type: 'loser',
    source_a_ref: 'P5',
    source_b_type: 'loser',
    source_b_ref: 'P6',
    placement_min: 3,
    placement_max: 4,
  },
  {
    phase: 2,
    round_label: 'Championship Placement Finals',
    bracket_type: 'championship',
    match_code: 'P11',
    display_label: '5th Place Game',
    source_a_type: 'winner',
    source_a_ref: 'P7',
    source_b_type: 'winner',
    source_b_ref: 'P8',
    placement_min: 5,
    placement_max: 6,
  },
  {
    phase: 2,
    round_label: 'Championship Placement Finals',
    bracket_type: 'championship',
    match_code: 'P12',
    display_label: '7th Place Game',
    source_a_type: 'loser',
    source_a_ref: 'P7',
    source_b_type: 'loser',
    source_b_ref: 'P8',
    placement_min: 7,
    placement_max: 8,
  },

  // =========================================================
  // DAY 2 · CONSOLATION
  // =========================================================
  {
    phase: 2,
    round_label: 'Consolation Round 1',
    bracket_type: 'consolation',
    match_code: 'C1',
    display_label: 'Consolation QF 1',
    source_a_type: 'pool_place',
    source_a_ref: '4A',
    source_b_type: 'loser',
    source_b_ref: 'X2',
    winner_to_match_code: 'C5',
    winner_to_slot: 'A',
    loser_to_match_code: 'C7',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Consolation Round 1',
    bracket_type: 'consolation',
    match_code: 'C2',
    display_label: 'Consolation QF 2',
    source_a_type: 'pool_place',
    source_a_ref: '4B',
    source_b_type: 'loser',
    source_b_ref: 'X1',
    winner_to_match_code: 'C5',
    winner_to_slot: 'B',
    loser_to_match_code: 'C7',
    loser_to_slot: 'B',
  },
  {
    phase: 2,
    round_label: 'Consolation Round 1',
    bracket_type: 'consolation',
    match_code: 'C3',
    display_label: 'Consolation QF 3',
    source_a_type: 'pool_place',
    source_a_ref: '4C',
    source_b_type: 'loser',
    source_b_ref: 'X4',
    winner_to_match_code: 'C6',
    winner_to_slot: 'A',
    loser_to_match_code: 'C8',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Consolation Round 1',
    bracket_type: 'consolation',
    match_code: 'C4',
    display_label: 'Consolation QF 4',
    source_a_type: 'pool_place',
    source_a_ref: '4D',
    source_b_type: 'loser',
    source_b_ref: 'X3',
    winner_to_match_code: 'C6',
    winner_to_slot: 'B',
    loser_to_match_code: 'C8',
    loser_to_slot: 'B',
  },

  {
    phase: 2,
    round_label: 'Consolation Classification',
    bracket_type: 'consolation',
    match_code: 'C5',
    display_label: '9–12 Semi 1',
    source_a_type: 'winner',
    source_a_ref: 'C1',
    source_b_type: 'winner',
    source_b_ref: 'C2',
    winner_to_match_code: 'C9',
    winner_to_slot: 'A',
    loser_to_match_code: 'C10',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Consolation Classification',
    bracket_type: 'consolation',
    match_code: 'C6',
    display_label: '9–12 Semi 2',
    source_a_type: 'winner',
    source_a_ref: 'C3',
    source_b_type: 'winner',
    source_b_ref: 'C4',
    winner_to_match_code: 'C9',
    winner_to_slot: 'B',
    loser_to_match_code: 'C10',
    loser_to_slot: 'B',
  },
  {
    phase: 2,
    round_label: 'Consolation Classification',
    bracket_type: 'consolation',
    match_code: 'C7',
    display_label: '13–16 Semi 1',
    source_a_type: 'loser',
    source_a_ref: 'C1',
    source_b_type: 'loser',
    source_b_ref: 'C2',
    winner_to_match_code: 'C11',
    winner_to_slot: 'A',
    loser_to_match_code: 'C12',
    loser_to_slot: 'A',
  },
  {
    phase: 2,
    round_label: 'Consolation Classification',
    bracket_type: 'consolation',
    match_code: 'C8',
    display_label: '13–16 Semi 2',
    source_a_type: 'loser',
    source_a_ref: 'C3',
    source_b_type: 'loser',
    source_b_ref: 'C4',
    winner_to_match_code: 'C11',
    winner_to_slot: 'B',
    loser_to_match_code: 'C12',
    loser_to_slot: 'B',
  },

  {
    phase: 2,
    round_label: 'Consolation Placement Finals',
    bracket_type: 'consolation',
    match_code: 'C9',
    display_label: '9th Place Game',
    source_a_type: 'winner',
    source_a_ref: 'C5',
    source_b_type: 'winner',
    source_b_ref: 'C6',
    placement_min: 9,
    placement_max: 10,
  },
  {
    phase: 2,
    round_label: 'Consolation Placement Finals',
    bracket_type: 'consolation',
    match_code: 'C10',
    display_label: '11th Place Game',
    source_a_type: 'loser',
    source_a_ref: 'C5',
    source_b_type: 'loser',
    source_b_ref: 'C6',
    placement_min: 11,
    placement_max: 12,
  },
  {
    phase: 2,
    round_label: 'Consolation Placement Finals',
    bracket_type: 'consolation',
    match_code: 'C11',
    display_label: '13th Place Game',
    source_a_type: 'winner',
    source_a_ref: 'C7',
    source_b_type: 'winner',
    source_b_ref: 'C8',
    placement_min: 13,
    placement_max: 14,
  },
  {
    phase: 2,
    round_label: 'Consolation Placement Finals',
    bracket_type: 'consolation',
    match_code: 'C12',
    display_label: '15th Place Game',
    source_a_type: 'loser',
    source_a_ref: 'C7',
    source_b_type: 'loser',
    source_b_ref: 'C8',
    placement_min: 15,
    placement_max: 16,
  },
]

export async function seed16TeamClassificationBracket({
  tournamentId,
  divisionId,
  clearExisting = false,
}) {
  if (!tournamentId) throw new Error('tournamentId is required')
  if (!divisionId) throw new Error('divisionId is required')

  if (clearExisting) {
    const { error: deleteErr } = await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('division_id', divisionId)
      .in('bracket_type', ['play_in', 'championship', 'consolation'])

    if (deleteErr) {
      throw new Error('Failed clearing existing bracket matches: ' + deleteErr.message)
    }
  }

  const { data: existing, error: existingErr } = await supabase
    .from('matches')
    .select('id, match_code')
    .eq('tournament_id', tournamentId)
    .eq('division_id', divisionId)
    .in('bracket_type', ['play_in', 'championship', 'consolation'])

  if (existingErr) {
    throw new Error('Failed loading existing bracket matches: ' + existingErr.message)
  }

  const existingByCode = Object.fromEntries((existing ?? []).map(m => [m.match_code, m]))

const rows = athleteOS16TeamBracketSeeds.map((seed) => ({
  tournament_id: tournamentId,
  division_id: divisionId,
  phase: seed.phase,
  round_label: seed.round_label,
  bracket_type: seed.bracket_type,
  match_code: seed.match_code,
  display_label: seed.display_label ?? null,
  source_a_type: seed.source_a_type ?? null,
  source_a_ref: seed.source_a_ref ?? null,
  source_b_type: seed.source_b_type ?? null,
  source_b_ref: seed.source_b_ref ?? null,
  winner_to_match_code: seed.winner_to_match_code ?? null,
  winner_to_slot: seed.winner_to_slot ?? null,
  loser_to_match_code: seed.loser_to_match_code ?? null,
  loser_to_slot: seed.loser_to_slot ?? null,
  placement_min: seed.placement_min ?? null,
  placement_max: seed.placement_max ?? null,
  status: 'scheduled',
}))

  const toInsert = rows.filter(row => !existingByCode[row.match_code])
  const toUpdate = rows.filter(row => existingByCode[row.match_code])

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from('matches')
      .insert(toInsert)

    if (insertErr) {
      throw new Error('Failed inserting bracket matches: ' + insertErr.message)
    }
  }

  for (const row of toUpdate) {
    const existingMatch = existingByCode[row.match_code]

    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        phase: row.phase,
        round_label: row.round_label,
        bracket_type: row.bracket_type,
        display_label: row.display_label,
        source_a_type: row.source_a_type,
        source_a_ref: row.source_a_ref,
        source_b_type: row.source_b_type,
        source_b_ref: row.source_b_ref,
        winner_to_match_code: row.winner_to_match_code,
        winner_to_slot: row.winner_to_slot,
        loser_to_match_code: row.loser_to_match_code,
        loser_to_slot: row.loser_to_slot,
        placement_min: row.placement_min,
        placement_max: row.placement_max,
        sort_order: row.sort_order,
      })
      .eq('id', existingMatch.id)

    if (updateErr) {
      throw new Error(`Failed updating bracket match ${row.match_code}: ${updateErr.message}`)
    }
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    total: rows.length,
  }
}