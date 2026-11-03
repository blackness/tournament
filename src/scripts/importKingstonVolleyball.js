// src/scripts/importKingstonVolleyball.js
import { supabase } from '../lib/supabase'
import { KINGSTON_VOLLEYBALL } from '../lib/workbook/presets/kingstonVolleyball'

async function run() {
  const config = KINGSTON_VOLLEYBALL

  // 1. Create tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .insert({
      name: config.tournament.name,
      slug: config.tournament.slug,
      start_date: config.tournament.startDate,
      end_date: config.tournament.endDate,
      timezone: config.tournament.timezone,
      venue_name: config.tournament.hostSchool,
      venue_address: config.tournament.location,
      status: 'draft',
      is_public: false,
    })
    .select()
    .single()

  const tournamentId = tournament.id
  console.log('Tournament created:', tournamentId)

  // 2. Create venues
  const venueMap = {}
  for (const field of config.fields) {
    const { data: venue } = await supabase
      .from('venues')
      .insert({
        tournament_id: tournamentId,
        name: field.fieldName,
        short_name: field.shortName,
        qr_slug: field.qrSlug,
        sort_order: field.sortOrder,
      })
      .select()
      .single()
    venueMap[field.fieldName] = venue.id
  }
  console.log('Venues created:', Object.keys(venueMap))

  // 3. Create tournament days
  for (const day of config.tournamentDays) {
    await supabase.from('tournament_days').insert({
      tournament_id: tournamentId,
      day_index: day.dayIndex,
      event_date: day.eventDate,
      start_time: day.startTime,
      end_time: day.endTime,
      label: day.label,
    })
  }
  console.log('Days created')

  // 4. Create divisions, pools, teams
  const teamMap = {}
  for (const division of config.divisions) {
    const { data: div } = await supabase
      .from('divisions')
      .insert({
        tournament_id: tournamentId,
        name: division.name,
        slug: division.slug,
        format_type: division.formatType,
        sort_order: division.sortOrder,
        game_duration_minutes: division.gameDurationMinutes,
        break_between_games_minutes: division.breakBetweenGamesMinutes,
      })
      .select()
      .single()

    const divisionId = div.id
    console.log('Division created:', division.name)

    // Create pools
    const poolMap = {}
    for (const pool of division.pools) {
      const { data: p } = await supabase
        .from('pools')
        .insert({
          division_id: divisionId,
          name: pool.name,
          short_name: pool.shortName,
          sort_order: pool.sortOrder,
        })
        .select()
        .single()
      poolMap[pool.name] = p.id
    }

    // Create teams
    for (const team of division.teams) {
      const poolId = team.poolName ? poolMap[team.poolName] ?? null : null
      const { data: t } = await supabase
        .from('tournament_teams')
        .insert({
          tournament_id: tournamentId,
          division_id: divisionId,
          pool_id: poolId,
          name: team.name,
          short_name: team.shortName,
          seed: team.seed,
        })
        .select()
        .single()

      teamMap[`${division.name}::${team.name}`] = t.id
    }
    console.log('Teams created for', division.name)
  }

  // 5. Create matches
  for (const game of config.schedules) {
    const venueId = venueMap[game.field_name] ?? null

    // Find team IDs
    const teamAId = game.team_a_name === 'TBD' ? null
      : teamMap[`${game.division_name}::${game.team_a_name}`] ?? null
    const teamBId = game.team_b_name === 'TBD' ? null
      : teamMap[`${game.division_name}::${game.team_b_name}`] ?? null

    // Create time slot
    const scheduledStart = new Date(
      `${game.scheduled_date}T${game.start_time}:00`
    ).toISOString()
    const scheduledEnd = new Date(
      new Date(scheduledStart).getTime() + 45 * 60 * 1000
    ).toISOString()

    const { data: slot } = await supabase
      .from('time_slots')
      .insert({
        tournament_id: tournamentId,
        venue_id: venueId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        offset_minutes: 0,
      })
      .select()
      .single()

    await supabase.from('matches').insert({
      tournament_id: tournamentId,
      team_a_id: teamAId,
      team_b_id: teamBId,
      venue_id: venueId,
      time_slot_id: slot.id,
      round_label: game.round_label,
      match_code: game.match_code,
      status: 'scheduled',
      match_origin: 'manual',
      notes: game.notes ?? null,
    })
  }

  console.log('All matches created')
  console.log('Done — tournament ID:', tournamentId)
}

run().catch(console.error)