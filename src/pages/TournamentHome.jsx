import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, Calendar, MapPin, Users, ChevronRight, Clock, Star } from 'lucide-react'

export function TournamentHome() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [tournament, setTournament] = useState(null)
  const [divisions, setDivisions]   = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      try {
      // Load tournament + divisions
      const { data: t, error } = await supabase
        .from('tournaments')
        .select('*, sport_template:sport_templates(slug, display_name), divisions(*)')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single()

      if (error || !t) { setNotFound(true); setLoading(false); return }
      setTournament(t)
      setDivisions(t.divisions ?? [])

      // Load live matches
      const { data: live } = await supabase
        .from('matches')
        .select(`
          id, score_a, score_b, status, round_label, cap_status,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start)
        `)
        .eq('tournament_id', t.id)
        .eq('status', 'in_progress')
        .order('time_slot(scheduled_start)')

      setLiveMatches(live ?? [])

      // Load next few upcoming matches
      const { data: upcoming } = await supabase
        .from('matches')
        .select(`
          id, status, round_label,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start)
        `)
        .eq('tournament_id', t.id)
        .eq('status', 'scheduled')
        .order('time_slot(scheduled_start)')
        .limit(6)

      setUpcomingMatches(upcoming ?? [])
      } catch (err) {
        console.error('TournamentHome error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // Realtime: update live scores
  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel('tournament-home-' + tournament.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'tournament_id=eq.' + tournament.id,
      }, payload => {
        setLiveMatches(prev => {
          const updated = payload.new
          if (updated.status === 'in_progress') {
            const exists = prev.find(m => m.id === updated.id)
            if (exists) return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
            return [...prev, updated]
          }
          return prev.filter(m => m.id !== updated.id)
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />

  if (notFound) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
      <Trophy size={40} className="mx-auto mb-3 opacity-30" />
      <h2 className="text-xl font-semibold text-gray-700">Tournament not found</h2>
      <p className="text-sm mt-2 mb-4">This tournament may have been removed or the link is incorrect.</p>
      <Link to="/tournaments" className="btn-primary btn">Browse tournaments</Link>
    </div>
  )

  const isLive     = tournament.status === 'live'
  const isUpcoming = tournament.status === 'published'
  const isPast     = ['review', 'archived'].includes(tournament.status)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="h-16 flex items-center px-6 gap-3" style={{ backgroundColor: tournament.primary_color ?? '#1a56db' }}>
          <Trophy size={20} className="text-white opacity-80" />
          <h1 className="text-white font-bold text-xl truncate">{tournament.name}</h1>
          {isLive && (
            <span className="ml-auto inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="bg-white px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoItem icon={<Calendar size={13} />} label="Date" value={formatDateRange(tournament.start_date, tournament.end_date)} />
          <InfoItem icon={<MapPin size={13} />} label="Location" value={tournament.venue_name ?? 'TBD'} />
          <InfoItem icon={<Trophy size={13} />} label="Sport" value={tournament.sport_template?.display_name ?? 'Tournament'} />
          <InfoItem icon={<Users size={13} />} label="Divisions" value={divisions.length + ' division' + (divisions.length !== 1 ? 's' : '')} />
        </div>
        {tournament.description && (
          <div className="px-6 pb-4 border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-600">{tournament.description}</p>
          </div>
        )}
        {/* Staff access -- only shown when logged in */}
        {user && (isLive || isUpcoming) && (
          <div className="px-6 pb-4">
            <Link
              to={'/t/' + slug + '/gameday'}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold transition-colors"
            >
              Staff / Scorekeeper entry
            </Link>
          </div>
        )}
      </div>

      {/* Live matches */}
      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live now
          </h2>
          <div className="space-y-2">
            {liveMatches.map(m => <MatchCard key={m.id} match={m} live />)}
          </div>
        </section>
      )}

      {/* Divisions */}
      {divisions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Divisions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {divisions.map(div => (
              <div key={div.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{div.name}</h3>
                  <span className="text-xs text-gray-400 capitalize">{div.format_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    to={'/t/' + slug + '/standings/' + div.id}
                    className="btn-secondary btn btn-sm"
                  >
                    Standings
                  </Link>
                  <Link
                    to={'/t/' + slug + '/bracket/' + div.id}
                    className="btn-secondary btn btn-sm"
                  >
                    Bracket
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Up next</h2>
            <Link to={'/t/' + slug + '/schedule'} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full schedule <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Empty state for upcoming tournament */}
      {isUpcoming && liveMatches.length === 0 && upcomingMatches.length === 0 && (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <Clock size={28} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium text-gray-600">Schedule coming soon</p>
          <p className="text-sm mt-1">Check back closer to the tournament date.</p>
        </div>
      )}

      {/* Past tournament */}
      {isPast && liveMatches.length === 0 && upcomingMatches.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <Star size={28} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium text-gray-600">Tournament complete</p>
          <p className="text-sm mt-1">View standings and brackets above.</p>
        </div>
      )}

    </div>
  )
}

function MatchCard({ match: m, live = false }) {
  const teamA = m.team_a
  const teamB = m.team_b

  return (
    <Link
      to={'/score/' + m.id}
      className={'flex items-center gap-3 px-4 py-3 bg-white border rounded-xl hover:shadow-sm transition-all ' + (live ? 'border-green-200' : 'border-gray-200')}
    >
      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <TeamName team={teamA} />
          {live && (
            <div className="flex items-center gap-2 flex-shrink-0 font-black text-lg tabular-nums">
              <span style={{ color: teamA?.primary_color ?? '#111' }}>{m.score_a ?? 0}</span>
              <span className="text-gray-300 text-sm font-normal">vs</span>
              <span style={{ color: teamB?.primary_color ?? '#111' }}>{m.score_b ?? 0}</span>
            </div>
          )}
          <TeamName team={teamB} align="right" />
        </div>
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 text-right text-xs text-gray-400 space-y-0.5 hidden sm:block">
        {m.venue && <p>{m.venue.short_name ?? m.venue.name}</p>}
        {m.time_slot?.scheduled_start && <p>{formatTime(m.time_slot.scheduled_start)}</p>}
        {m.round_label && <p className="text-gray-300">{m.round_label}</p>}
      </div>

      {live && m.cap_status && (
        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex-shrink-0">
          {m.cap_status === 'hard_cap' ? 'Hard Cap' : 'Soft Cap'}
        </span>
      )}

      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
    </Link>
  )
}

function TeamName({ team, align = 'left' }) {
  if (!team) return <span className="text-sm text-gray-400 italic">TBD</span>
  return (
    <div className={'flex items-center gap-2 min-w-0 ' + (align === 'right' ? 'flex-row-reverse' : '')}>
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.primary_color ?? '#ccc' }} />
      <span className="text-sm font-medium text-gray-900 truncate">{team.short_name ?? team.name}</span>
    </div>
  )
}

function InfoItem({ icon, label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">{icon}{label}</p>
      <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
    </div>
  )
}

function formatDateRange(start, end) {
  if (!start) return 'TBD'
  const fmt = d => new Date(d + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  return start === end ? fmt(start) : fmt(start) + ' - ' + fmt(end)
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
