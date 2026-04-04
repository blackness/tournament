import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, ChevronLeft, Clock } from 'lucide-react'

export function LiveScoreboard() {
  const { matchId }               = useParams()
  const [match, setMatch]         = useState(null)
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: m, error } = await supabase
        .from('matches')
        .select(`
          id, score_a, score_b, status, cap_status, started_at, completed_at,
          round_label, phase, period_scores,
          tournament:tournaments(id, name, slug, primary_color),
          division:divisions(id, name),
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color, logo_url),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color, logo_url),
          venue:venues(id, name, short_name),
          time_slot:time_slots(scheduled_start, scheduled_end)
        `)
        .eq('id', matchId)
        .single()

      if (error || !m) { setNotFound(true); setLoading(false); return }
      setMatch(m)

      const { data: ev } = await supabase
        .from('game_events')
        .select(`
          id, stat_id, score_a_after, score_b_after, event_timestamp, sequence,
          player:tournament_players!player_id(id, name, number),
          secondary_player:tournament_players!secondary_player_id(id, name, number),
          team:tournament_teams!team_id(id, name, short_name, primary_color)
        `)
        .eq('match_id', matchId)
        .is('deleted_at', null)
        .order('sequence', { ascending: false })
        .limit(30)

      setEvents(ev ?? [])
      setLoading(false)
    }
    load()
  }, [matchId])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('scoreboard-' + matchId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'id=eq.' + matchId,
      }, payload => setMatch(prev => prev ? { ...prev, ...payload.new } : prev))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_events',
        filter: 'match_id=eq.' + matchId,
      }, async () => {
        const { data } = await supabase
          .from('game_events')
          .select(`
            id, stat_id, score_a_after, score_b_after, event_timestamp, sequence,
            player:tournament_players!player_id(id, name, number),
            secondary_player:tournament_players!secondary_player_id(id, name, number),
            team:tournament_teams!team_id(id, name, short_name, primary_color)
          `)
          .eq('match_id', matchId)
          .is('deleted_at', null)
          .order('sequence', { ascending: false })
          .limit(30)
        setEvents(data ?? [])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [matchId])

  if (loading) return <PageLoader />
  if (notFound) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-[var(--text-muted)]">
      <Trophy size={36} className="mx-auto mb-3 opacity-30" />
      <p className="text-lg font-semibold text-[var(--text-secondary)]">Game not found</p>
    </div>
  )

  const isLive     = match.status === 'in_progress'
  const isDone     = match.status === 'complete' || match.status === 'forfeit'
  const isScheduled = match.status === 'scheduled'

  // Game clock
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isLive || !match.started_at) return
    const startMs = new Date(match.started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isLive, match.started_at])
  const clockStr = isLive && match.started_at
    ? String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0')
    : null
  const teamA      = match.team_a
  const teamB      = match.team_b
  const winner     = isDone
    ? (match.score_a > match.score_b ? teamA : match.score_b > match.score_a ? teamB : null)
    : null

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col">

      {/* Top bar */}
      <div className="bg-[var(--bg-base)] border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
        {match.tournament && (
          <Link to={'/t/' + match.tournament.slug} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-white text-sm">
            <ChevronLeft size={16} />
            {match.tournament.name}
          </Link>
        )}
        <div className="text-xs text-[var(--text-muted)] text-right">
          {match.division?.name}
          {match.venue && ' - ' + (match.venue.short_name ?? match.venue.name)}
          {match.round_label && ' - ' + match.round_label}
        </div>
      </div>

      {/* Score hero */}
      <div className="flex-shrink-0 px-4 py-8 flex flex-col items-center gap-6"
        style={{ background: 'linear-gradient(to bottom, var(--bg-surface), var(--bg-base))' }}>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 bg-[rgba(34,197,94,0.15)] text-[var(--live)] text-xs font-semibold px-3 py-1 rounded-full border border-[rgba(34,197,94,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
              LIVE
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1.5 bg-[var(--bg-raised)] text-[var(--text-muted)] text-xs font-semibold px-3 py-1 rounded-full">
              FINAL
            </span>
          )}
          {isScheduled && match.time_slot && (
            <span className="inline-flex items-center gap-1.5 bg-[var(--accent)]/20 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/30">
              <Clock size={11} />
              {formatTime(match.time_slot.scheduled_start)}
            </span>
          )}
          {match.cap_status && (
            <span className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-400 text-xs font-semibold px-3 py-1 rounded-full border border-orange-500/30">
              {match.cap_status === 'hard_cap' ? 'HARD CAP' : 'SOFT CAP'}
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div className="w-full max-w-sm grid grid-cols-3 items-center gap-2">
          {/* Team A */}
          <TeamDisplay
            team={teamA}
            score={match.score_a}
            isWinner={winner?.id === teamA?.id}
            isLoser={winner && winner.id !== teamA?.id}
            align="left"
          />

          {/* VS / score divider */}
          <div className="text-center flex flex-col items-center gap-1">
            {isScheduled
              ? <span className="text-2xl font-black text-[var(--text-secondary)]">VS</span>
              : <span className="text-[var(--text-secondary)] text-lg font-bold">-</span>
            }
            {clockStr && (
              <span style={{ fontFamily:'DM Mono, monospace', fontSize:16, fontWeight:600, color:'var(--text-primary)', letterSpacing:'0.05em' }}>
                {clockStr}
              </span>
            )}
          </div>

          {/* Team B */}
          <TeamDisplay
            team={teamB}
            score={match.score_b}
            isWinner={winner?.id === teamB?.id}
            isLoser={winner && winner.id !== teamB?.id}
            align="right"
          />
        </div>
      </div>

      {/* Event feed */}
      {events.length > 0 && (() => {
        // Deduplicate by sequence+team, filter standalone assist rows
        const seen = new Set()
        const deduped = events.filter(ev => {
          if (ev.stat_id === 'assist' && ev.score_a_after === null) return false
          const key = ev.match_id + '-' + ev.sequence + '-' + ev.team_id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        return (
          <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Play by play</h2>
            <div className="space-y-2">
              {deduped.map(ev => (
                <EventRow key={ev.id} event={ev} teamA={teamA} teamB={teamB} />
              ))}
            </div>
          </div>
        )
      })()}

      {isScheduled && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          Game starts {match.time_slot ? formatTime(match.time_slot.scheduled_start) : 'soon'}
        </div>
      )}
    </div>
  )
}

function TeamDisplay({ team, score, isWinner, isLoser, align }) {
  const opacity = isLoser ? 'opacity-40' : 'opacity-100'
  return (
    <div className={'flex flex-col items-center gap-2 ' + opacity}>
      {/* Colour circle */}
      <div
        className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center text-white font-black text-lg"
        style={{ backgroundColor: team?.primary_color ?? '#374151' }}
      >
        {team ? (team.short_name ?? team.name ?? '?')[0] : '?'}
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center leading-tight max-w-20 truncate">
        {team?.name ?? 'TBD'}
      </p>
      {score !== null && score !== undefined && (
        <p className={'text-5xl font-black tabular-nums ' + (isWinner ? 'text-white' : 'text-gray-300')}>
          {score}
        </p>
      )}
    </div>
  )
}

function EventRow({ event: ev, teamA, teamB }) {
  const isTeamA   = ev.team?.id === teamA?.id
  const color     = ev.team?.primary_color ?? '#6b7280'
  const statLabel = STAT_LABELS[ev.stat_id] ?? ev.stat_id
  const isScore   = ev.score_a_after !== null && ev.score_b_after !== null

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--border)]/50">
      {/* Score state */}
      {isScore && (
        <span className="text-xs font-black tabular-nums text-[var(--text-muted)] w-10 text-right flex-shrink-0">
          {ev.score_a_after}-{ev.score_b_after}
        </span>
      )}
      {/* Team dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {/* Description */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-200">{statLabel}</span>
        {ev.player && (
          <span className="text-sm text-[var(--text-muted)]">
            {' - '}
            <span className="text-[var(--text-muted)]">{ev.player.name}</span>
            {ev.player.number && <span className="text-[var(--text-muted)]"> #{ev.player.number}</span>}
          </span>
        )}
        {ev.secondary_player && (
          <span className="text-xs text-[var(--text-muted)]"> (assist: {ev.secondary_player.name})</span>
        )}
      </div>
      <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{formatEventTime(ev.event_timestamp)}</span>
    </div>
  )
}

const STAT_LABELS = {
  goal:      'Goal',
  assist:    'Assist',
  callahan:  'Callahan!',
  layout_d:  'Layout D',
  d_block:   'D Block',
  turnover:  'Turnover',
  drop:      'Drop',
  throwaway: 'Throwaway',
  stall:     'Stall out',
  pts_1:     'Free throw',
  pts_2:     '2 pointer',
  pts_3:     '3 pointer',
  kill:      'Kill',
  ace:       'Ace',
  block:     'Block',
  dig:       'Dig',
  error:     'Error',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatEventTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
