import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { MapPin, Clock, Trophy, AlertTriangle } from 'lucide-react'

/**
 * CourtLanding -- /court/:tournamentId/:venueSlug
 *
 * Scanned from a QR code on a physical field/court.
 * Logic:
 *   1. Find the active (in_progress) match on this venue -> redirect to scorekeeper
 *   2. No active match -> find next scheduled match -> show "up next" with countdown
 *   3. No matches at all -> show venue info
 */
export function CourtLanding() {
  const { tournamentId, venueSlug } = useParams()
  const navigate                    = useNavigate()
  const [state, setState]           = useState('loading') // loading | redirecting | upcoming | idle | error
  const [venue, setVenue]           = useState(null)
  const [match, setMatch]           = useState(null)
  const [tournament, setTournament] = useState(null)
  const [countdown, setCountdown]   = useState(null)

  useEffect(() => {
    async function load() {
      // Load venue info
      const { data: venueData } = await supabase
        .from('venues')
        .select('id, name, short_name, qr_slug')
        .eq('tournament_id', tournamentId)
        .eq('qr_slug', venueSlug)
        .single()

      if (!venueData) { setState('error'); return }
      setVenue(venueData)

      // Load tournament
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, slug, primary_color, status')
        .eq('id', tournamentId)
        .single()
      setTournament(t)

      // Check for active match on this venue
      const { data: active } = await supabase
        .from('matches')
        .select(`
          id, status, score_a, score_b,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          time_slot:time_slots(scheduled_start, scheduled_end)
        `)
        .eq('tournament_id', tournamentId)
        .eq('venue_id', venueData.id)
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle()

      if (active) {
        // Active game -- redirect to scorekeeper after brief pause
        setMatch(active)
        setState('redirecting')
        setTimeout(() => navigate('/scorekeeper/' + active.id), 1800)
        return
      }

      // Find next scheduled match on this venue
      const { data: next } = await supabase
        .from('matches')
        .select(`
          id, status,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          time_slot:time_slots(scheduled_start, scheduled_end)
        `)
        .eq('tournament_id', tournamentId)
        .eq('venue_id', venueData.id)
        .eq('status', 'scheduled')
        .order('time_slot(scheduled_start)')
        .limit(1)
        .maybeSingle()

      if (next) {
        setMatch(next)
        setState('upcoming')
      } else {
        setState('idle')
      }
    }

    load()
  }, [tournamentId, venueSlug])

  // Countdown timer for upcoming match
  useEffect(() => {
    if (state !== 'upcoming' || !match?.time_slot?.scheduled_start) return

    function tick() {
      const diff = new Date(match.time_slot.scheduled_start) - new Date()
      if (diff <= 0) {
        setCountdown('Starting now')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(
        h > 0
          ? h + 'h ' + m + 'm'
          : m > 0
            ? m + 'm ' + s + 's'
            : s + 's'
      )
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [state, match])

  // Realtime: watch for match status changes on this venue
  useEffect(() => {
    if (!venue) return
    const channel = supabase
      .channel('court-' + venueSlug)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'venue_id=eq.' + venue.id,
      }, payload => {
        if (payload.new.status === 'in_progress') {
          navigate('/scorekeeper/' + payload.new.id)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [venue?.id])

  const brandColor = tournament?.primary_color ?? '#1a56db'

  // -- Loading ------------------------------------------------------------------
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" className="text-white" />
      </div>
    )
  }

  // -- Error --------------------------------------------------------------------
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-white font-bold text-xl">Court not found</p>
        <p className="text-[var(--text-muted)] text-sm">This QR code may be outdated or the tournament has ended.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#030712' }}>

      {/* Top colour bar */}
      <div className="h-2 w-full flex-shrink-0" style={{ backgroundColor: brandColor }} />

      {/* Venue header */}
      <div className="px-6 pt-8 pb-4 text-center flex-shrink-0">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white font-black text-2xl"
          style={{ backgroundColor: brandColor }}
        >
          <MapPin size={28} />
        </div>
        <h1 className="text-white text-2xl font-black">{venue?.name}</h1>
        {tournament && (
          <p className="text-[var(--text-muted)] text-sm mt-1">{tournament.name}</p>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">

        {/* Redirecting */}
        {state === 'redirecting' && match && (
          <div className="text-center space-y-6 w-full max-w-sm">
            <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 text-sm font-semibold px-4 py-2 rounded-full border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              LIVE NOW
            </div>
            <MatchDisplay match={match} brandColor={brandColor} />
            <p className="text-[var(--text-muted)] text-sm">Opening scorekeeper...</p>
            <LoadingSpinner size="sm" className="mx-auto text-[var(--text-secondary)]" />
          </div>
        )}

        {/* Upcoming */}
        {state === 'upcoming' && match && (
          <div className="text-center space-y-6 w-full max-w-sm">
            <div className="space-y-1">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-semibold">Up next</p>
              {match.time_slot?.scheduled_start && (
                <p className="text-[var(--text-muted)] text-sm">
                  {formatTime(match.time_slot.scheduled_start)}
                </p>
              )}
            </div>

            <MatchDisplay match={match} brandColor={brandColor} />

            {/* Countdown */}
            {countdown && (
              <div className="bg-[var(--bg-base)] border border-gray-800 rounded-2xl px-6 py-4">
                <p className="text-[var(--text-muted)] text-xs mb-1 flex items-center justify-center gap-1">
                  <Clock size={11} /> Starts in
                </p>
                <p className="text-white text-4xl font-black tabular-nums">{countdown}</p>
              </div>
            )}

            <Link
              to={'/scorekeeper/' + match.id}
              className="block w-full py-4 rounded-2xl font-bold text-white text-lg text-center"
              style={{ backgroundColor: brandColor }}
            >
              Open scorekeeper
            </Link>
          </div>
        )}

        {/* Idle */}
        {state === 'idle' && (
          <div className="text-center space-y-4">
            <Trophy size={48} className="mx-auto text-[var(--text-secondary)]" />
            <p className="text-[var(--text-muted)] font-semibold">No games scheduled</p>
            <p className="text-[var(--text-secondary)] text-sm">Check back later or view the full schedule.</p>
            {tournament && (
              <Link
                to={'/t/' + tournament.slug + '/schedule'}
                className="inline-block mt-2 text-sm px-4 py-2 rounded-xl border border-[var(--border-mid)] text-[var(--text-muted)] hover:border-gray-500"
              >
                View schedule
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {tournament && (
        <div className="px-6 pb-8 text-center flex-shrink-0">
          <Link to={'/t/' + tournament.slug} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-muted)]">
            {tournament.name}
          </Link>
        </div>
      )}
    </div>
  )
}

function MatchDisplay({ match, brandColor }) {
  const teamA = match.team_a
  const teamB = match.team_b

  return (
    <div className="bg-[var(--bg-base)] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <TeamPill team={teamA} />
        <span className="text-[var(--text-secondary)] font-bold text-sm flex-shrink-0">VS</span>
        <TeamPill team={teamB} align="right" />
      </div>
      {match.status === 'in_progress' && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <span className="text-3xl font-black tabular-nums" style={{ color: teamA?.primary_color ?? '#fff' }}>
            {match.score_a ?? 0}
          </span>
          <span className="text-3xl font-black tabular-nums" style={{ color: teamB?.primary_color ?? '#fff' }}>
            {match.score_b ?? 0}
          </span>
        </div>
      )}
    </div>
  )
}

function TeamPill({ team, align = 'left' }) {
  return (
    <div className={'flex items-center gap-2 min-w-0 ' + (align === 'right' ? 'flex-row-reverse' : '')}>
      <div
        className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-black"
        style={{ backgroundColor: team?.primary_color ?? '#374151' }}
      >
        {(team?.short_name ?? team?.name ?? '?')[0]}
      </div>
      <span className="text-white font-semibold text-sm truncate max-w-24">
        {team?.short_name ?? team?.name ?? 'TBD'}
      </span>
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
