import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  ChevronLeft, Play, RotateCcw, CheckCircle, AlertTriangle,
  Plus, Minus, Clock, Shield, Zap, X
} from 'lucide-react'

// --- Screens ------------------------------------------------------------------
const SCREEN = { PRE: 'pre', LIVE: 'live', POST: 'post' }

export function ScorekeeperPage() {
  const { matchId }             = useParams()
  const [match, setMatch]       = useState(null)
  const [events, setEvents]     = useState([])
  const [roster, setRoster]     = useState({ a: [], b: [] })
  const [sportConfig, setSportConfig] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [screen, setScreen]     = useState(SCREEN.PRE)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, score_a, score_b, status, cap_status, winner_id,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start),
          tournament:tournaments(id, name, slug, sport_template_id,
            sport_template:sport_templates(slug, config))
        `)
        .eq('id', matchId)
        .single()

      if (!m) { setLoading(false); return }

      setMatch(m)
      setSportConfig(m.tournament?.sport_template?.config ?? null)

      if (m.status === 'in_progress') setScreen(SCREEN.LIVE)
      else if (m.status === 'complete' || m.status === 'forfeit') setScreen(SCREEN.POST)

      // Load rosters
      const [{ data: rA }, { data: rB }] = await Promise.all([
        supabase.from('tournament_players').select('id, name, number').eq('tournament_team_id', m.team_a?.id ?? 'x').order('number'),
        supabase.from('tournament_players').select('id, name, number').eq('tournament_team_id', m.team_b?.id ?? 'x').order('number'),
      ])
      setRoster({ a: rA ?? [], b: rB ?? [] })

      // Load existing events
      const { data: ev } = await supabase
        .from('game_events')
        .select('*')
        .eq('match_id', matchId)
        .is('deleted_at', null)
        .order('sequence')
      setEvents(ev ?? [])
      setLoading(false)
    }
    load()
  }, [matchId])

  async function startGame() {
    setError(null)
    const { error } = await supabase
      .from('matches')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', matchId)
    if (error) { setError(error.message); return }
    setMatch(prev => ({ ...prev, status: 'in_progress' }))
    setScreen(SCREEN.LIVE)
  }

  async function endGame() {
    const scoreA = match.score_a ?? 0
    const scoreB = match.score_b ?? 0
    const winnerId = scoreA > scoreB ? match.team_a?.id
                   : scoreB > scoreA ? match.team_b?.id
                   : null
    const { error } = await supabase
      .from('matches')
      .update({
        status:       'complete',
        winner_id:    winnerId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', matchId)
    if (error) { setError(error.message); return }
    setMatch(prev => ({ ...prev, status: 'complete', winner_id: winnerId }))
    setScreen(SCREEN.POST)
  }

  async function recordEvent(teamId, statId, opts = {}) {
    if (!teamId) { setError('No team selected -- team data may not be loaded yet'); return }
    setError(null)
    const isScoring = sportConfig?.stats?.find(s => s.id === statId)?.adds_to_score
    const currentA  = match.score_a ?? 0
    const currentB  = match.score_b ?? 0
    const newA      = isScoring && teamId === match.team_a?.id ? currentA + 1 : currentA
    const newB      = isScoring && teamId === match.team_b?.id ? currentB + 1 : currentB

    const seq = (events[events.length - 1]?.sequence ?? 0) + 1

    const payload = {
      match_id:           matchId,
      stat_id:            statId,
      team_id:            teamId,
      player_id:          opts.playerId ?? null,
      secondary_player_id: opts.assistPlayerId ?? null,
      secondary_stat_id:  opts.secondaryStatId ?? null,
      score_a_after:      isScoring ? newA : null,
      score_b_after:      isScoring ? newB : null,
      event_timestamp:    new Date().toISOString(),
      sequence:           seq,
      source:             'manual',
    }

    const { data, error } = await supabase.from('game_events').insert(payload).select().single()
    if (error) { setError(error.message); return }

    setEvents(prev => [...prev, data])
    if (isScoring) {
      setMatch(prev => ({ ...prev, score_a: newA, score_b: newB }))
    }
  }

  async function undoLast() {
    const last = [...events].reverse().find(e => !e.deleted_at)
    if (!last) return
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    if (new Date(last.event_timestamp) < tenMinAgo) {
      setError('Can only undo events within the last 10 minutes')
      return
    }
    setError(null)
    const { error } = await supabase
      .from('game_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', last.id)
    if (error) { setError(error.message); return }
    setEvents(prev => prev.filter(e => e.id !== last.id))

    // Recalculate score from remaining events
    const remaining = events.filter(e => e.id !== last.id)
    const lastWithScore = [...remaining].reverse().find(e => e.score_a_after !== null)
    setMatch(prev => ({
      ...prev,
      score_a: lastWithScore?.score_a_after ?? 0,
      score_b: lastWithScore?.score_b_after ?? 0,
    }))
  }

  async function setCapStatus(capStatus) {
    const { error } = await supabase
      .from('matches')
      .update({ cap_status: capStatus, cap_triggered_at: new Date().toISOString() })
      .eq('id', matchId)
    if (!error) setMatch(prev => ({ ...prev, cap_status: capStatus }))
  }

  if (loading) return <PageLoader />
  if (!match) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Game not found</p>
    </div>
  )

  const sharedProps = { match, events, roster, sportConfig, error, setError }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <Link to={'/director/' + match.tournament?.id} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold">{match.team_a?.short_name ?? match.team_a?.name} vs {match.team_b?.short_name ?? match.team_b?.name}</p>
          <p className="text-xs text-gray-500">{match.venue?.name}{match.time_slot ? ' - ' + formatTime(match.time_slot.scheduled_start) : ''}</p>
        </div>
        <Link to={'/score/' + matchId} className="text-xs text-gray-500 hover:text-white">
          Spectator
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-red-300">{error}</p>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {screen === SCREEN.PRE && (
        <PreGameScreen {...sharedProps} onStart={startGame} />
      )}
      {screen === SCREEN.LIVE && (
        <LiveScoringScreen
          {...sharedProps}
          onScore={recordEvent}
          onUndo={undoLast}
          onSetCap={setCapStatus}
          onEndGame={() => setScreen(SCREEN.POST)}
          onConfirmEnd={endGame}
        />
      )}
      {screen === SCREEN.POST && (
        <PostGameScreen {...sharedProps} />
      )}
    </div>
  )
}

// --- Pre-game screen ----------------------------------------------------------
function PreGameScreen({ match, roster, onStart }) {
  const missingA = !match.team_a?.id
  const missingB = !match.team_b?.id
  const canStart = !missingA && !missingB

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center space-y-2">
        <p className="text-gray-400 text-sm uppercase tracking-wide">Ready to start</p>
        <div className="flex items-center gap-4 text-xl font-bold">
          <TeamChip team={match.team_a} missing={missingA} />
          <span className="text-gray-600">vs</span>
          <TeamChip team={match.team_b} missing={missingB} />
        </div>
        {match.time_slot && (
          <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
            <Clock size={13} /> Scheduled {formatTime(match.time_slot.scheduled_start)}
          </p>
        )}
      </div>

      {/* TBD warning */}
      {!canStart && (
        <div className="bg-amber-900/40 border border-amber-700/50 rounded-xl px-5 py-3 text-amber-300 text-sm text-center max-w-xs">
          <p className="font-semibold mb-1">Cannot start game</p>
          <p className="text-xs text-amber-400">
            {missingA && missingB ? 'Both teams are TBD.' : missingA ? 'Team A is TBD.' : 'Team B is TBD.'}
            {' '}Go to Director HQ to assign teams to this match.
          </p>
        </div>
      )}

      {/* Roster counts */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        <RosterCard team={match.team_a} players={roster.a} />
        <RosterCard team={match.team_b} players={roster.b} />
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-lg px-8 py-4 rounded-2xl transition-colors"
      >
        <Play size={20} fill="currentColor" /> Start game
      </button>
    </div>
  )
}

function RosterCard({ team, players }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team?.primary_color ?? '#6b7280' }} />
        <p className="text-xs font-semibold text-gray-300 truncate">{team?.short_name ?? team?.name}</p>
      </div>
      {players.length === 0
        ? <p className="text-xs text-gray-600 italic">No roster</p>
        : <p className="text-xs text-gray-500">{players.length} players</p>
      }
    </div>
  )
}

// --- Live scoring screen ------------------------------------------------------
function LiveScoringScreen({ match, events, roster, sportConfig, onScore, onUndo, onSetCap, onEndGame, onConfirmEnd }) {
  const [pendingEnd, setPendingEnd] = useState(false)
  const [activeTeam, setActiveTeam] = useState(null)
  const [activeStat, setActiveStat] = useState(null)

  const stats       = sportConfig?.stats ?? []
  const scoringStats = stats.filter(s => s.adds_to_score)
  const otherStats   = stats.filter(s => !s.adds_to_score)
  const lastEvents   = [...events].reverse().slice(0, 4)

  function handleStatTap(teamId, statId) {
    onScore(teamId, statId)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Scoreboard */}
      <div className="bg-gray-900 px-4 py-5 flex items-center justify-between gap-2 flex-shrink-0">
        <ScoreTeam team={match.team_a} score={match.score_a ?? 0} />
        <div className="flex flex-col items-center gap-1">
          {match.cap_status && (
            <span className="text-xs text-orange-400 font-bold uppercase">
              {match.cap_status === 'hard_cap' ? 'Hard Cap' : 'Soft Cap'}
            </span>
          )}
          <span className="text-gray-700 text-lg">-</span>
        </div>
        <ScoreTeam team={match.team_b} score={match.score_b ?? 0} right />
      </div>

      {/* Cap controls */}
      {!match.cap_status && (
        <div className="flex gap-2 px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex-shrink-0">
          <button onClick={() => onSetCap('soft_cap')}
            className="flex-1 text-xs py-1.5 rounded-lg bg-orange-900/40 text-orange-400 border border-orange-800/50 hover:bg-orange-900/60">
            Soft Cap
          </button>
          <button onClick={() => onSetCap('hard_cap')}
            className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-900/60">
            Hard Cap
          </button>
        </div>
      )}

      {/* Stat buttons - two columns, one per team */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {stats.length === 0 ? (
          // No sport config - simple +/- score buttons
          <SimpleScoreButtons match={match} onScore={onScore} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Team A column */}
            <TeamStatColumn
              team={match.team_a}
              stats={stats}
              onStat={statId => match.team_a?.id && handleStatTap(match.team_a.id, statId)}
            />
            {/* Team B column */}
            <TeamStatColumn
              team={match.team_b}
              stats={stats}
              onStat={statId => match.team_b?.id && handleStatTap(match.team_b.id, statId)}
            />
          </div>
        )}
      </div>

      {/* Recent events */}
      {lastEvents.length > 0 && (
        <div className="bg-gray-900/60 border-t border-gray-800 px-3 py-2 flex-shrink-0">
          {lastEvents.map(ev => (
            <div key={ev.id} className="flex items-center gap-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-600" />
              <p className="text-xs text-gray-500 truncate">
                {STAT_LABELS[ev.stat_id] ?? ev.stat_id}
                {ev.score_a_after !== null && (
                  <span className="ml-1 text-gray-600">{ev.score_a_after}-{ev.score_b_after}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex gap-2 px-3 pb-4 pt-2 border-t border-gray-800 flex-shrink-0">
        <button
          onClick={onUndo}
          disabled={events.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm disabled:opacity-30"
        >
          <RotateCcw size={15} /> Undo
        </button>
        <div className="flex-1" />
        {!pendingEnd ? (
          <button
            onClick={() => setPendingEnd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
          >
            End game
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setPendingEnd(false)} className="px-3 py-2.5 rounded-xl bg-gray-800 text-gray-400 text-sm">
              Cancel
            </button>
            <button
              onClick={onConfirmEnd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm"
            >
              <CheckCircle size={15} /> Confirm end
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamStatColumn({ team, stats, onStat }) {
  const color = team?.primary_color ?? '#6b7280'
  const scoring = stats.filter(s => s.adds_to_score)
  const defense = stats.filter(s => !s.adds_to_score && !s.is_negative)
  const negative = stats.filter(s => s.is_negative)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold text-gray-400 truncate">{team?.short_name ?? team?.name}</p>
      </div>

      {scoring.map(stat => (
        <button
          key={stat.id}
          onPointerDown={() => onStat(stat.id)}
          className="w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform select-none"
          style={{ backgroundColor: color + '22', color, border: '1px solid ' + color + '44' }}
        >
          {stat.label}
        </button>
      ))}

      {defense.length > 0 && <div className="h-px bg-gray-800 my-1" />}
      {defense.map(stat => (
        <button
          key={stat.id}
          onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-gray-400 bg-gray-800/60 border border-gray-700/50 active:scale-95 transition-transform select-none"
        >
          {stat.label}
        </button>
      ))}

      {negative.length > 0 && <div className="h-px bg-gray-800 my-1" />}
      {negative.map(stat => (
        <button
          key={stat.id}
          onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-red-400/70 bg-red-900/20 border border-red-900/30 active:scale-95 transition-transform select-none"
        >
          {stat.label}
        </button>
      ))}
    </div>
  )
}

function SimpleScoreButtons({ match, onScore }) {
  return (
    <div className="grid grid-cols-2 gap-6 py-4">
      {[match.team_a, match.team_b].map(team => (
        <div key={team?.id} className="flex flex-col items-center gap-3">
          <TeamChip team={team} />
          <button
            onPointerDown={() => team?.id && onScore(team.id, 'goal')}
            className="w-20 h-20 rounded-2xl text-4xl font-black active:scale-90 transition-transform select-none border-2"
            style={{ borderColor: team?.primary_color ?? '#6b7280', color: team?.primary_color ?? '#fff', backgroundColor: (team?.primary_color ?? '#6b7280') + '22' }}
          >
            +
          </button>
        </div>
      ))}
    </div>
  )
}

// --- Post-game screen ---------------------------------------------------------
function PostGameScreen({ match }) {
  const scoreA  = match.score_a ?? 0
  const scoreB  = match.score_b ?? 0
  const winnerA = scoreA > scoreB
  const winnerB = scoreB > scoreA

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center">
        <CheckCircle size={32} className="text-green-400" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-gray-400 text-sm">Final score</p>
        <div className="flex items-center gap-4 text-2xl font-black">
          <span style={{ color: winnerA ? match.team_a?.primary_color : '#6b7280' }}>
            {match.team_a?.short_name ?? match.team_a?.name}
          </span>
          <span className="text-gray-300 tabular-nums">{scoreA} - {scoreB}</span>
          <span style={{ color: winnerB ? match.team_b?.primary_color : '#6b7280' }}>
            {match.team_b?.short_name ?? match.team_b?.name}
          </span>
        </div>
        {!winnerA && !winnerB && <p className="text-gray-500 text-sm">Draw</p>}
        {(winnerA || winnerB) && (
          <p className="text-gray-400 text-sm">
            {winnerA ? match.team_a?.name : match.team_b?.name} wins
          </p>
        )}
      </div>
      <div className="flex gap-4">
        <Link to={'/score/' + match.id} className="text-sm text-blue-400 hover:underline">
          View scoreboard
        </Link>
        <Link to={'/sotg/' + match.id} className="text-sm text-green-400 hover:underline">
          Submit SOTG
        </Link>
      </div>
    </div>
  )
}

// --- Shared components --------------------------------------------------------
function ScoreTeam({ team, score, right }) {
  return (
    <div className={'flex items-center gap-3 ' + (right ? 'flex-row-reverse' : '')}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-2 border-white/10"
        style={{ backgroundColor: team?.primary_color ?? '#374151', color: '#fff' }}>
        {(team?.short_name ?? team?.name ?? '?')[0]}
      </div>
      <div className={right ? 'text-right' : ''}>
        <p className="text-xs text-gray-400 leading-tight">{team?.short_name ?? team?.name ?? 'TBD'}</p>
        <p className="text-4xl font-black tabular-nums leading-none">{score}</p>
      </div>
    </div>
  )
}

function TeamChip({ team, missing }) {
  return (
    <div className={'flex items-center gap-2 ' + (missing ? 'opacity-40' : '')}>
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: missing ? '#6b7280' : (team?.primary_color ?? '#6b7280') }} />
      <span className={'text-sm font-semibold ' + (missing ? 'text-gray-500 italic' : '')}>
        {missing ? 'TBD' : (team?.short_name ?? team?.name ?? 'TBD')}
      </span>
    </div>
  )
}

const STAT_LABELS = {
  goal: 'Goal', assist: 'Assist', callahan: 'Callahan!',
  layout_d: 'Layout D', d_block: 'D Block', turnover: 'Turnover',
  drop: 'Drop', throwaway: 'Throwaway', stall: 'Stall',
  pts_1: 'Free throw', pts_2: '2 pointer', pts_3: '3 pointer',
  kill: 'Kill', ace: 'Ace', block: 'Block', dig: 'Dig', error: 'Error',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
