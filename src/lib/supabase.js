import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY - copy .env.example to .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
})

// --- Auth helpers --------------------------------------------------------------

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  await supabase.auth.signOut()
}

// --- DB query helpers ----------------------------------------------------------
// Centralised here so components never construct raw queries.
// All return the raw Supabase promise - await in the caller.

export const db = {

  // -- Sport templates ----------------------------------------------------------
  sportTemplates: {
    list: () =>
      supabase
        .from('sport_templates')
        .select('id, slug, display_name, config')
        .eq('is_active', true)
        .order('display_name'),

    bySlug: (slug) =>
      supabase
        .from('sport_templates')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single(),
  },

  // -- Tournaments --------------------------------------------------------------
  tournaments: {
    mine: (userId) =>
      supabase
        .from('tournaments')
        .select('id, slug, name, start_date, end_date, status, logo_url, primary_color, sport_template_id')
        .eq('director_id', userId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false }),

    bySlug: (slug) =>
      supabase
        .from('tournaments')
        .select(`*, sport_template:sport_templates(slug, display_name, config), divisions(*)`)
        .eq('slug', slug)
        .is('deleted_at', null)
        .single(),

    byId: (id) =>
      supabase.from('tournaments').select('*').eq('id', id).is('deleted_at', null).single(),

    create: (data) =>
      supabase.from('tournaments').insert(data).select().single(),

    update: (id, data) =>
      supabase.from('tournaments').update(data).eq('id', id).select().single(),
  },

  // -- Divisions ----------------------------------------------------------------
  divisions: {
    byTournament: (tournamentId) =>
      supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('sort_order'),

    create: (data) =>
      supabase.from('divisions').insert(data).select().single(),

    createMany: (rows) =>
      supabase.from('divisions').insert(rows).select(),

    upsert: (data) =>
      supabase.from('divisions').upsert(data, { onConflict: 'tournament_id,slug' }).select().single(),

    update: (id, data) =>
      supabase.from('divisions').update(data).eq('id', id).select().single(),

    delete: (id) =>
      supabase.from('divisions').delete().eq('id', id),
  },

  // -- Venues -------------------------------------------------------------------
  venues: {
    byTournament: (tournamentId) =>
      supabase
        .from('venues')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('sort_order'),

    create: (data) =>
      supabase.from('venues').insert(data).select().single(),

    createMany: (rows) =>
      supabase.from('venues').insert(rows).select(),

    upsert: (data) =>
      supabase.from('venues').upsert(data, { onConflict: 'tournament_id,qr_slug' }).select().single(),

    update: (id, data) =>
      supabase.from('venues').update(data).eq('id', id).select().single(),

    delete: (id) =>
      supabase.from('venues').delete().eq('id', id),
  },

  // -- Pools --------------------------------------------------------------------
  pools: {
    byDivision: (divisionId) =>
      supabase
        .from('pools')
        .select('*, tournament_teams(*)')
        .eq('division_id', divisionId)
        .order('sort_order'),

    create: (data) =>
      supabase.from('pools').insert(data).select().single(),

    createMany: (rows) =>
      supabase.from('pools').insert(rows).select(),

    upsert: (data) =>
      supabase.from('pools').upsert(data, { onConflict: 'division_id,name' }).select().single(),

    deleteByDivision: (divisionId) =>
      supabase.from('pools').delete().eq('division_id', divisionId),
  },

  // -- Teams --------------------------------------------------------------------
  teams: {
    byTournament: (tournamentId) =>
      supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name'),

    byDivision: (divisionId) =>
      supabase
        .from('tournament_teams')
        .select('*')
        .eq('division_id', divisionId)
        .order('seed'),

    create: (data) =>
      supabase.from('tournament_teams').insert(data).select().single(),

    createMany: (rows) =>
      supabase.from('tournament_teams').insert(rows).select(),

    // Note: no upsert for teams -- no suitable unique constraint. Use create() and track dbId.

    update: (id, data) =>
      supabase.from('tournament_teams').update(data).eq('id', id).select().single(),

    delete: (id) =>
      supabase.from('tournament_teams').delete().eq('id', id),
  },

  // -- Time slots ---------------------------------------------------------------
  timeSlots: {
    byTournament: (tournamentId) =>
      supabase
        .from('time_slots')
        .select('*, venue:venues(id, name, short_name)')
        .eq('tournament_id', tournamentId)
        .order('scheduled_start'),

    createMany: (rows) =>
      supabase.from('time_slots').insert(rows).select(),

    deleteByTournament: (tournamentId) =>
      supabase.from('time_slots').delete().eq('tournament_id', tournamentId),
  },

  // -- Matches ------------------------------------------------------------------
  matches: {
    byTournament: (tournamentId) =>
      supabase
        .from('matches')
        .select(`
          *,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color, logo_url),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color, logo_url),
          venue:venues(id, name, short_name),
          time_slot:time_slots(scheduled_start, scheduled_end, offset_minutes)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled'),

    byId: (matchId) =>
      supabase
        .from('matches')
        .select(`
          *,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color, logo_url),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color, logo_url),
          venue:venues(id, name, short_name),
          time_slot:time_slots(scheduled_start, scheduled_end, offset_minutes)
        `)
        .eq('id', matchId)
        .single(),

    createMany: (rows) =>
      supabase.from('matches').insert(rows).select(),

    update: (id, data) =>
      supabase.from('matches').update(data).eq('id', id).select().single(),

    deleteByTournament: (tournamentId) =>
      supabase.from('matches').delete().eq('tournament_id', tournamentId),
  },

  // -- Game events ---------------------------------------------------------------
  gameEvents: {
    byMatch: (matchId) =>
      supabase
        .from('game_events')
        .select(`
          *,
          player:tournament_players!player_id(id, name, number),
          secondary_player:tournament_players!secondary_player_id(id, name, number)
        `)
        .eq('match_id', matchId)
        .is('deleted_at', null)
        .order('sequence', { ascending: true }),

    insert: (data) =>
      supabase.from('game_events').insert(data).select().single(),

    softDelete: (id, deletedBy) =>
      supabase
        .from('game_events')
        .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', id),
  },

  // -- Standings -----------------------------------------------------------------
  standings: {
    byPool: (poolId) =>
      supabase
        .from('pool_standings_display')
        .select('*')
        .eq('pool_id', poolId)
        .order('rank'),

    byDivision: (divisionId) =>
      supabase
        .from('pool_standings_display')
        .select('*')
        .eq('division_id', divisionId)
        .order('pool_id, rank'),
  },

  // -- Bracket -------------------------------------------------------------------
  bracket: {
    byDivision: (divisionId) =>
      supabase
        .from('bracket_slots')
        .select(`
          *,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          match:matches(id, score_a, score_b, status, winner_id)
        `)
        .eq('division_id', divisionId)
        .order('round, position'),
  },

  // -- Roles ---------------------------------------------------------------------
  roles: {
    mine: (userId, tournamentId) =>
      supabase
        .from('tournament_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('tournament_id', tournamentId),

    byTournament: (tournamentId) =>
      supabase
        .from('tournament_roles')
        .select('*, user:auth.users(email)')
        .eq('tournament_id', tournamentId),

    assign: (data) =>
      supabase.from('tournament_roles').insert(data).select().single(),

    remove: (id) =>
      supabase.from('tournament_roles').delete().eq('id', id),
  },

  // -- Players (roster) ----------------------------------------------------------
  players: {
    byTeam: (teamId) =>
      supabase
        .from('tournament_players')
        .select('*')
        .eq('tournament_team_id', teamId)
        .order('sort_order, name'),

    createMany: (rows) =>
      supabase.from('tournament_players').insert(rows).select(),

    update: (id, data) =>
      supabase.from('tournament_players').update(data).eq('id', id),

    delete: (id) =>
      supabase.from('tournament_players').delete().eq('id', id),
  },

  // -- SOTG ----------------------------------------------------------------------
  sotg: {
    byMatch: (matchId) =>
      supabase.from('sotg_scores').select('*').eq('match_id', matchId),

    submit: (data) =>
      supabase.from('sotg_scores').insert(data).select().single(),
  },

  // -- Court QR routing ---------------------------------------------------------
  court: {
    activeMatch: (tournamentId, venueSlug) =>
      supabase
        .from('active_matches_by_venue')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('venue_qr_slug', venueSlug)
        .in('status', ['in_progress', 'scheduled'])
        .order('scheduled_start')
        .limit(1)
        .maybeSingle(),
  },

  // -- Delays -------------------------------------------------------------------
  delays: {
    active: (tournamentId) =>
      supabase
        .from('schedule_delays')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)
        .order('announced_at', { ascending: false }),

    create: (data) =>
      supabase.from('schedule_delays').insert(data).select().single(),
  },

  // -- Follows -------------------------------------------------------------------
  follows: {
    byUser: (userId) =>
      supabase
        .from('user_follows')
        .select('*, tournament_team:tournament_teams(id, name), match:matches(id, status, score_a, score_b), tournament:tournaments(id, name, slug)')
        .eq('user_id', userId),

    byGuest: (guestToken) =>
      supabase
        .from('user_follows')
        .select('*')
        .eq('guest_token', guestToken),

    add: (data) =>
      supabase.from('user_follows').insert(data).select().single(),

    remove: (id) =>
      supabase.from('user_follows').delete().eq('id', id),
  },

  // -- Incidents -----------------------------------------------------------------
  incidents: {
    byTournament: (tournamentId) =>
      supabase
        .from('incident_reports')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('reported_at', { ascending: false }),

    report: (data) =>
      supabase.from('incident_reports').insert(data).select().single(),

    resolve: (id, data) =>
      supabase.from('incident_reports').update({ resolved: true, ...data }).eq('id', id),
  },
}
