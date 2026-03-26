import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, Play, Clock, MapPin, CheckCircle } from 'lucide-react'

/**
 * GameDayPage -- /t/:slug/gameday
 * A simple scorekeeping entry point for the day.
 * Shows live games first, then upcoming, with big buttons to open each.
 * No login required to view -- the scorekeeper console handles auth.
 */
export function GameDayPage() {
  const { slug }                    = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [loading, setLoading]       = useState(true)

  async function loadMatches(tournamentId) {
    const { data } = await supabase
      .from('matches')
      .select(`
        id, status, score_a, score_b, round_label,
        team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
        team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
        venue:venues(id, name, short_name),
        time_slot:time_slots(scheduled_start),
        division:divisions(name),
        pool:pools(name)
      `)
      .eq('tournament_id', tournamentId)
      .in('status', ['scheduled', 'in_progress'])
      .order('time_slot(scheduled_start)')
    setMatches(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, slug, primary_color, status')
        .eq('slug', slug)
        .single()
      if (!t) { setLoading(false); return }
      setTournament(t)
      await loadMatches(t.id)
      setLoading(false)
    }
    load()
  }, [slug])

  // Realtime
  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel('gameday-' + tournament.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'tournament_id=eq.' + tournament.id,
      }, () => loadMatches(tournament.id))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (!tournament) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Tournament not found</p>
    </div>
  )

  const live     = matches.filter(m => m.status === 'in_progress')
  const upcoming = matches.filter(m => m.status === 'scheduled')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={'/t/' + slug} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scorekeeper</h1>
          <p className="text-sm text-gray-400">{tournament.name}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Select a game below to open the scorekeeper console. Scan a field QR code to go directly to the active game on that field.
      </div>

      {/* Live games */}
      {live.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live now ({live.length})
          </h2>
          <div className="space-y-3">
            {live.map(m => (
              <GameDayCard key={m.id} match={m} isLive />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock size={12} /> Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(m => (
              <GameDayCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {live.length === 0 && upcoming.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium text-gray-600">All games complete</p>
          <p className="text-sm mt-1">No more games to score today.</p>
        </div>
      )}
    </div>
  )
}

function GameDayCard({ match: m, isLive }) {
  const teamA   = m.team_a
  const teamB   = m.team_b
  const hasTBD  = !teamA?.id || !teamB?.id

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${isLive ? 'border-green-300' : 'border-gray-200'}`}>
      {/* Match info */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {/* Teams */}
          <div className="flex items-center gap-2 flex-wrap">
            <TeamPill team={teamA} />
            <span className="text-gray-400 text-xs font-medium">vs</span>
            <TeamPill team={teamB} />
          </div>
          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            {m.venue && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {m.venue.short_name ?? m.venue.name}
              </span>
            )}
            {m.time_slot?.scheduled_start && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> {formatTime(m.time_slot.scheduled_start)}
              </span>
            )}
            {m.pool && <span>{m.pool.name}</span>}
            {m.division && <span className="text-gray-300">{m.division.name}</span>}
          </div>
        </div>

        {/* Score if live */}
        {isLive && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl font-black tabular-nums" style={{ color: teamA?.primary_color ?? '#1f2937' }}>
              {m.score_a ?? 0}
            </span>
            <span className="text-gray-300 text-sm">-</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: teamB?.primary_color ?? '#1f2937' }}>
              {m.score_b ?? 0}
            </span>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4">
        <Link
          to={'/scorekeeper/' + m.id}
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-colors ${
            isLive
              ? 'bg-green-500 hover:bg-green-400 text-white'
              : hasTBD
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-gray-900 hover:bg-gray-700 text-white'
          }`}
        >
          <Play size={16} fill="currentColor" />
          {isLive ? 'Continue scoring' : hasTBD ? 'Teams TBD - view anyway' : 'Start scoring'}
        </Link>
      </div>
    </div>
  )
}

function TeamPill({ team }) {
  if (!team?.id) return <span className="text-xs text-amber-500 italic font-medium">TBD</span>
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.primary_color ?? '#6b7280' }} />
      <span className="text-sm font-semibold text-gray-900">{team.short_name ?? team.name}</span>
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
