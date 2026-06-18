import { supabase } from '../supabase'

const PROTECTED_MATCH_STATUSES = ['complete', 'forfeit', 'in_progress']

export async function savePlayoffMatchesSafe({
  tournamentId,
  playoffMatches = [],
  divisions = [],
  teams = [],
  pools = [],
  venues = [],
}) {
  if (!tournamentId) {
    throw new Error('Tournament ID is required to save playoff matches.')
  }

  const divisionDbIdByLocalId = Object.fromEntries(
    (divisions ?? [])
      .filter(div => div.id && div.dbId)
      .map(div => [div.id, div.dbId])
  )

  const poolDbIdByLocalId = Object.fromEntries(
    (pools ?? [])
      .filter(pool => pool.id && pool.dbId)
      .map(pool => [pool.id, pool.dbId])
  )

  const teamDbIdByLocalId = Object.fromEntries(
    (teams ?? [])
      .filter(team => team.id && team.dbId)
      .map(team => [team.id, team.dbId])
  )

  const venueDbIdByLocalId = Object.fromEntries(
    (venues ?? [])
      .filter(venue => venue.id && venue.dbId)
      .map(venue => [venue.id, venue.dbId])
  )

  const { data: existingMatches, error: existingErr } = await supabase
    .from('matches')
    .select(`
      id,
      match_code,
      status,
      tournament_id,
      division_id,
      pool_id,
      venue_id,
      time_slot_id,
      team_a_id,
      team_b_id
    `)
    .eq('tournament_id', tournamentId)

  if (existingErr) {
    throw new Error(`Failed to load existing matches: ${existingErr.message}`)
  }

  const existingByMatchCode = Object.fromEntries(
    (existingMatches ?? [])
      .filter(m => m.match_code)
      .map(m => [m.match_code, m])
  )

  // Build / find real time slots for any scheduled playoff matches
  const inlinePlayoffSlots = (playoffMatches ?? [])
    .filter(match =>
      (match.slot_id || match.slotId || match.time_slot_id) &&
      (match.scheduled_start || match.scheduledStart) &&
      (match.scheduled_end || match.scheduledEnd) &&
      (match.venue_id || match.venueId)
    )
    .map(match => ({
      localSlotId: match.slot_id || match.slotId || match.time_slot_id,
      localVenueId: match.venue_id || match.venueId || null,
      scheduledStart: match.scheduled_start || match.scheduledStart || null,
      scheduledEnd: match.scheduled_end || match.scheduledEnd || null,
    }))

  const uniqueInlinePlayoffSlots = Array.from(
    new Map(
      inlinePlayoffSlots.map(slot => [
        String(slot.localSlotId),
        slot,
      ])
    ).values()
  )

  const slotDbIdByLocalId = {}

  for (const slot of uniqueInlinePlayoffSlots) {
    const venueDbId = venueDbIdByLocalId[slot.localVenueId] || slot.localVenueId || null

    if (!venueDbId || !slot.scheduledStart) continue

    const { data: existingSlot, error: existingSlotErr } = await supabase
      .from('time_slots')
      .select('id, venue_id, scheduled_start, scheduled_end')
      .eq('tournament_id', tournamentId)
      .eq('venue_id', venueDbId)
      .eq('scheduled_start', slot.scheduledStart)
      .maybeSingle()

    if (existingSlotErr) {
      throw new Error(`Failed to check existing time slot: ${existingSlotErr.message}`)
    }

    if (existingSlot?.id) {
      slotDbIdByLocalId[String(slot.localSlotId)] = existingSlot.id
      continue
    }

    const { data: insertedSlot, error: insertSlotErr } = await supabase
      .from('time_slots')
      .insert({
        tournament_id: tournamentId,
        venue_id: venueDbId,
        scheduled_start: slot.scheduledStart,
        scheduled_end: slot.scheduledEnd,
      })
      .select('id')
      .single()

    if (insertSlotErr) {
      throw new Error(`Failed to insert playoff time slot: ${insertSlotErr.message}`)
    }

    slotDbIdByLocalId[String(slot.localSlotId)] = insertedSlot.id
  }

  const inserted = []
  const updated = []
  const skipped = []
  const warnings = []

  for (const match of playoffMatches) {
    const matchCode = match.match_code || match.matchCode || null

    if (!matchCode) {
      warnings.push('Skipped playoff match with no match_code.')
      skipped.push({ reason: 'missing_match_code', match })
      continue
    }

    const existing = existingByMatchCode[matchCode]

    const localDivisionId = match.division_id || match.divisionId || null
    const localPoolId = match.pool_id || match.poolId || null
    const localTeamAId = match.team_a_id || match.teamAId || null
    const localTeamBId = match.team_b_id || match.teamBId || null
    const localVenueId = match.venue_id || match.venueId || null
    const localSlotId = match.slot_id || match.slotId || match.time_slot_id || null

    const divisionDbId = divisionDbIdByLocalId[localDivisionId] || localDivisionId || null
    const poolDbId = poolDbIdByLocalId[localPoolId] || localPoolId || null
    const teamADbId = teamDbIdByLocalId[localTeamAId] || localTeamAId || null
    const teamBDbId = teamDbIdByLocalId[localTeamBId] || localTeamBId || null
    const venueDbId = venueDbIdByLocalId[localVenueId] || localVenueId || null
    const slotDbId = localSlotId ? slotDbIdByLocalId[String(localSlotId)] || null : null

    const payload = {
      tournament_id: tournamentId,
      division_id: divisionDbId,
      pool_id: poolDbId,
      venue_id: venueDbId,
      time_slot_id: slotDbId,
      team_a_id: teamADbId,
      team_b_id: teamBDbId,
      round: match.round ?? null,
      match_number: match.match_number ?? null,
      round_label: match.round_label || match.roundLabel || null,
      display_label: match.display_label || match.displayLabel || null,
      status: match.status || 'scheduled',
      phase: match.phase || null,
      bracket_position: match.bracket_position ?? null,
      match_code: matchCode,
      bracket_type: match.bracket_type || match.bracketType || null,
      source_a_type: match.source_a_type || null,
      source_a_ref: match.source_a_ref || null,
      source_b_type: match.source_b_type || null,
      source_b_ref: match.source_b_ref || null,
      winner_to_match_code: match.winner_to_match_code || null,
      winner_to_slot: match.winner_to_slot || null,
      loser_to_match_code: match.loser_to_match_code || null,
      loser_to_slot: match.loser_to_slot || null,
      placement_min: match.placement_min ?? null,
      placement_max: match.placement_max ?? null,
    }

    if (!existing) {
      const { data: insertedRow, error: insertErr } = await supabase
        .from('matches')
        .insert(payload)
        .select('id, match_code')
        .single()

      if (insertErr) {
        throw new Error(`Failed to insert playoff match ${matchCode}: ${insertErr.message}`)
      }

      inserted.push(insertedRow)
      continue
    }

    if (PROTECTED_MATCH_STATUSES.includes(existing.status)) {
      warnings.push(
        `Skipped protected playoff match ${matchCode} because its status is ${existing.status}.`
      )
      skipped.push({
        reason: 'protected_existing_match',
        matchCode,
        existingId: existing.id,
        status: existing.status,
      })
      continue
    }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('matches')
      .update(payload)
      .eq('id', existing.id)
      .select('id, match_code')
      .single()

    if (updateErr) {
      throw new Error(`Failed to update playoff match ${matchCode}: ${updateErr.message}`)
    }

    updated.push(updatedRow)
  }

  return {
    inserted,
    updated,
    skipped,
    warnings,
  }
}