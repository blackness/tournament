import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, MapPin, Clock, ChevronRight } from 'lucide-react'

export function SchedulePage() {
  const { slug }                    = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [venues, setVenues]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [groupBy, setGroupBy]       = useState('time') // 'time' | 'field' | 'division'
  const [filterVenue, setFilterVenue] = useState('all')
  const [filterDivision, setFilterDivision] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, slug, primary_color, start_date, end_date')
        .eq('slug', slug)
        .single()

      if (!t) { setLoading(false); return }
      setTournament(t)

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, score_a, score_b, round_label, phase,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(id, name, short_name, qr_slug),
          division:divisions(id, name),
          time_slot:time_slots(scheduled_start, scheduled_end, offset_minutes)
        `)
        .eq('tournament_id', t.id)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')

      setMatches(m ?? [])

      const { data: v } = await supabase
        .from('venues')
        .select('id, name, short_name')
        .eq('tournament_id', t.id)
        .order('sort_order')
      setVenues(v ?? [])

      setLoading(false)
    }
    load()
  }, [slug])

  // Realtime match updates
  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel('schedule-' + tournament.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'tournament_id=eq.' + tournament.id,
      }, payload => {
        setMatches(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        ))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (!tournament) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Tournament not found</p>
    </div>
  )

  // Filter
  let filtered = matches
  if (filterVenue !== 'all')    filtered = filtered.filter(m => m.venue?.id === filterVenue)
  if (filterDivision !== 'all') filtered = filtered.filter(m => m.division?.id === filterDivision)

  // Unique divisions for filter
  const divisions = [...new Map(matches.map(m => m.division).filter(Boolean).map(d => [d.id, d])).values()]

  // Group matches
  const groups = groupMatches(filtered, groupBy)

  const brandColor = tournament.primary_color ?? '#1a56db'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={'/t/' + slug} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Schedule</h1>
          <p className="text-sm text-gray-400">{tournament.name}</p>
        </div>
      </div>

      {/* Controls -- stacked on mobile */}
      <div className="space-y-2">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {[['time','Time'],['field','Field'],['division','Division']].map(([val, label]) => (
            <button key={val} onClick={() => setGroupBy(val)}
              className={'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ' + (
                groupBy === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}>
              {label}
            </button>
          ))}
        </div>

        {(venues.length > 1 || divisions.length > 1) && (
          <div className="flex gap-2">
            {venues.length > 1 && (
              <select
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white"
                value={filterVenue} onChange={e => setFilterVenue(e.target.value)}>
                <option value="all">All fields</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.short_name ?? v.name}</option>)}
              </select>
            )}
            {divisions.length > 1 && (
              <select
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white"
                value={filterDivision} onChange={e => setFilterDivision(e.target.value)}>
                <option value="all">All divisions</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-right">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Schedule groups */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium text-gray-600">No games scheduled</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Match cards */}
              <div className="space-y-2">
                {group.matches.map(m => (
                  <ScheduleMatchCard
                    key={m.id}
                    match={m}
                    showVenue={groupBy !== 'field'}
                    showDivision={groupBy !== 'division'}
                    showTime={groupBy !== 'time'}
                    brandColor={brandColor}
                    tournamentId={tournament.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleMatchCard({ match: m, showVenue, showDivision, showTime, brandColor }) {
  const isLive = m.status === 'in_progress'
  const isDone = m.status === 'complete' || m.status === 'forfeit'
  const teamA  = m.team_a
  const teamB  = m.team_b

  return (
    <Link
      to={'/score/' + m.id}
      className={[
        'block p-3 bg-white rounded-xl border transition-all active:scale-98',
        isLive ? 'border-green-200 bg-green-50/30' : 'border-gray-200',
      ].join(' ')}
    >
      {/* Top row: time + venue + live badge */}
      <div className="flex items-center gap-2 mb-2">
        {m.time_slot?.scheduled_start && (
          <span className={'text-xs font-bold tabular-nums ' + (isLive ? 'text-green-600' : 'text-gray-500')}>
            {formatTime(m.time_slot.scheduled_start)}
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        )}
        {isDone && <span className="text-xs text-gray-400 font-medium">Final</span>}
        {m.venue && showVenue && (
          <span className="text-xs text-gray-400 ml-auto flex items-center gap-0.5">
            <MapPin size={10} /> {m.venue.short_name ?? m.venue.name}
          </span>
        )}
        {m.pool && !showVenue && (
          <span className="text-xs text-gray-400 ml-auto">{m.pool.name}</span>
        )}
      </div>

      {/* Teams + scores */}
      <div className="space-y-1.5">
        <MatchTeamRow team={teamA} score={isDone || isLive ? m.score_a : null}
          isWinner={isDone && m.score_a > m.score_b} />
        <MatchTeamRow team={teamB} score={isDone || isLive ? m.score_b : null}
          isWinner={isDone && m.score_b > m.score_a} />
      </div>
    </Link>
  )
}

function MatchTeamRow({ team, score, isWinner }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: team?.primary_color ?? '#e5e7eb' }} />
      <span className={'text-sm truncate flex-1 min-w-0 ' + (isWinner ? 'font-bold text-gray-900' : 'text-gray-600')}>
        {team?.short_name ?? team?.name ?? 'TBD'}
      </span>
      {score !== null && score !== undefined && (
        <span className={'text-base font-black tabular-nums flex-shrink-0 ' + (isWinner ? 'text-gray-900' : 'text-gray-400')}>
          {score}
        </span>
      )}
    </div>
  )
}

// --- Grouping logic -----------------------------------------------------------
function groupMatches(matches, groupBy) {
  const groups = {}

  for (const m of matches) {
    let key, label

    if (groupBy === 'time') {
      const start = m.time_slot?.scheduled_start
      if (start) {
        const d = new Date(start)
        key   = d.toISOString().slice(0, 13) // group by hour
        label = formatGroupTime(d)
      } else {
        key = 'unscheduled'; label = 'Unscheduled'
      }
    } else if (groupBy === 'field') {
      key   = m.venue?.id ?? 'no-field'
      label = m.venue?.name ?? 'No field assigned'
    } else {
      key   = m.division?.id ?? 'no-div'
      label = m.division?.name ?? 'No division'
    }

    if (!groups[key]) groups[key] = { key, label, matches: [] }
    groups[key].matches.push(m)
  }

  return Object.values(groups).sort((a, b) => {
    if (groupBy === 'time') {
      if (a.key === 'unscheduled') return 1
      if (b.key === 'unscheduled') return -1
      return a.key.localeCompare(b.key)
    }
    return a.label.localeCompare(b.label)
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatGroupTime(d) {
  const now   = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time  = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date  = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  return isToday ? time : date + ' - ' + time
}
