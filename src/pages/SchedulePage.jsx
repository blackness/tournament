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

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Group by */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {[['time','By time'],['field','By field'],['division','By division']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setGroupBy(val)}
              className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' + (
                groupBy === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Field filter */}
        {venues.length > 1 && (
          <select
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:ring-1 focus:ring-blue-500"
            value={filterVenue}
            onChange={e => setFilterVenue(e.target.value)}
          >
            <option value="all">All fields</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}

        {/* Division filter */}
        {divisions.length > 1 && (
          <select
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:ring-1 focus:ring-blue-500"
            value={filterDivision}
            onChange={e => setFilterDivision(e.target.value)}
          >
            <option value="all">All divisions</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
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

function ScheduleMatchCard({ match: m, showVenue, showDivision, showTime, brandColor, tournamentId }) {
  const isLive  = m.status === 'in_progress'
  const isDone  = m.status === 'complete' || m.status === 'forfeit'
  const teamA   = m.team_a
  const teamB   = m.team_b

  return (
    <Link
      to={'/score/' + m.id}
      className={[
        'flex items-center gap-3 p-3 bg-white rounded-xl border transition-all hover:shadow-sm',
        isLive ? 'border-green-200 bg-green-50/30' : 'border-gray-200',
      ].join(' ')}
    >
      {/* Time column */}
      <div className="w-14 flex-shrink-0 text-center">
        {m.time_slot?.scheduled_start ? (
          <div>
            <p className={'text-xs font-bold tabular-nums ' + (isLive ? 'text-green-600' : 'text-gray-700')}>
              {formatTime(m.time_slot.scheduled_start)}
            </p>
            {isLive && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-semibold mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
            {isDone && <p className="text-xs text-gray-400">Final</p>}
          </div>
        ) : (
          <p className="text-xs text-gray-400">TBD</p>
        )}
      </div>

      {/* Divider */}
      <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />

      {/* Teams */}
      <div className="flex-1 min-w-0 space-y-1">
        <MatchTeamRow team={teamA} score={isDone || isLive ? m.score_a : null}
          isWinner={isDone && m.score_a > m.score_b} />
        <MatchTeamRow team={teamB} score={isDone || isLive ? m.score_b : null}
          isWinner={isDone && m.score_b > m.score_a} />
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 text-right space-y-0.5 hidden sm:block">
        {showVenue && m.venue && (
          <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
            <MapPin size={10} /> {m.venue.short_name ?? m.venue.name}
          </p>
        )}
        {showDivision && m.division && (
          <p className="text-xs text-gray-400">{m.division.name}</p>
        )}
        {m.round_label && (
          <p className="text-xs text-gray-300">{m.round_label}</p>
        )}
      </div>

      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
    </Link>
  )
}

function MatchTeamRow({ team, score, isWinner }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: team?.primary_color ?? '#e5e7eb' }} />
      <span className={'text-sm truncate flex-1 ' + (isWinner ? 'font-bold text-gray-900' : 'text-gray-700')}>
        {team?.name ?? 'TBD'}
      </span>
      {score !== null && score !== undefined && (
        <span className={'text-sm font-bold tabular-nums flex-shrink-0 ' + (isWinner ? 'text-gray-900' : 'text-gray-400')}>
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
