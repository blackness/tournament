import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  ChevronLeft, Play, RotateCcw, CheckCircle, X,
  Plus, Clock, UserPlus, Upload
} from 'lucide-react'
import { PinGate, checkScorekeeperAuth } from '../lib/scorekeeperAuth'

const SCREEN = { PRE: 'pre', LIVE: 'live', POST: 'post' }
const PLAYER_PICKER_TIMEOUT = 10000 // 10 seconds to pick player

export function ScorekeeperPage() {
  const { matchId }               = useParams()
  const [match, setMatch]         = useState(null)
  const [events, setEvents]       = useState([])
  const [roster, setRoster]       = useState({ a: [], b: [] })
  const [sportConfig, setSportConfig] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [screen, setScreen]       = useState(SCREEN.PRE)
  const [error, setError]         = useState(null)
  const [authed, setAuthed]       = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  // Player picker state
  const [picker, setPicker]       = useState(null) // { statId, teamId, label, isSecondary, primaryEventId }
  const [pickerTimeout, setPickerTimeout] = useState(null)
  const [addingPlayer, setAddingPlayer] = useState(null) // teamId for quick-add

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, score_a, score_b, status, cap_status, winner_id,
          tournament_id,
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

      // Auth check
      const tid = m.tournament_id ?? m.tournament?.id
      const { authed: ok } = await checkScorekeeperAuth(matchId, tid, m.scorekeeper_pin)
      setAuthed(ok)
      setAuthChecking(false)

      await loadRosters(m)
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

  async function loadRosters(m) {
    const matchData = m ?? match
    const [{ data: rA }, { data: rB }] = await Promise.all([
      supabase.from('tournament_players').select('id, name, number')
        .eq('tournament_team_id', matchData?.team_a?.id ?? 'x').order('number'),
      supabase.from('tournament_players').select('id, name, number')
        .eq('tournament_team_id', matchData?.team_b?.id ?? 'x').order('number'),
    ])
    setRoster({ a: rA ?? [], b: rB ?? [] })
  }

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
                   : scoreB > scoreA ? match.team_b?.id : null
    const { error } = await supabase.from('matches').update({
      status: 'complete', winner_id: winnerId,
      completed_at: new Date().toISOString(),
    }).eq('id', matchId)
    if (error) { setError(error.message); return }
    setMatch(prev => ({ ...prev, status: 'complete', winner_id: winnerId }))
    setScreen(SCREEN.POST)
  }

  // -- Core event recording ---------------------------------------------------
  async function recordEvent(teamId, statId, opts = {}) {
    if (!teamId) { setError('Team not identified'); return }
    setError(null)

    const statDef   = sportConfig?.stats?.find(s => s.id === statId)
    const isScoring = statDef?.adds_to_score ?? false
    const currentA  = match.score_a ?? 0
    const currentB  = match.score_b ?? 0
    const newA = isScoring && teamId === match.team_a?.id ? currentA + 1 : currentA
    const newB = isScoring && teamId === match.team_b?.id ? currentB + 1 : currentB
    const seq  = (events[events.length - 1]?.sequence ?? 0) + 1

    const payload = {
      match_id:            matchId,
      stat_id:             statId,
      team_id:             teamId,
      player_id:           opts.playerId ?? null,
      secondary_player_id: opts.assistPlayerId ?? null,
      secondary_stat_id:   opts.secondaryStatId ?? null,
      score_a_after:       isScoring ? newA : null,
      score_b_after:       isScoring ? newB : null,
      event_timestamp:     new Date().toISOString(),
      sequence:            seq,
      source:              'manual',
    }

    const { data, error } = await supabase.from('game_events').insert(payload).select().single()
    if (error) { setError(error.message); return }

    setEvents(prev => [...prev, data])
    if (isScoring) setMatch(prev => ({ ...prev, score_a: newA, score_b: newB }))
    return data
  }

  // -- Stat tap -- record immediately, then show player picker ---------------
  async function handleStatTap(teamId, statId) {
    if (!teamId) return
    const statDef = sportConfig?.stats?.find(s => s.id === statId)
    if (!statDef) return

    // Record the event immediately (score first)
    const event = await recordEvent(teamId, statId)
    if (!event) return

    // Show player picker for player stats
    if (statDef.is_player_stat !== false) {
      showPicker({
        statId,
        teamId,
        label: statDef.label,
        eventId: event.id,
        isSecondary: false,
      })
    }

    // For scoring stats, also ask for assist
    if (statDef.adds_to_score && statId !== 'callahan') {
      // Will show assist picker after primary player is picked
    }
  }

  function showPicker({ statId, teamId, label, eventId, isSecondary }) {
    // Clear any existing timeout
    if (pickerTimeout) clearTimeout(pickerTimeout)

    setPicker({ statId, teamId, label, eventId, isSecondary })

    // Auto-dismiss after timeout
    const t = setTimeout(() => {
      setPicker(null)
      setPickerTimeout(null)
    }, PLAYER_PICKER_TIMEOUT)
    setPickerTimeout(t)
  }

  async function handlePlayerPick(playerId, playerName) {
    if (pickerTimeout) { clearTimeout(pickerTimeout); setPickerTimeout(null) }

    if (picker && playerId) {
      // Update the event with the player
      if (picker.isSecondary) {
        await supabase.from('game_events')
          .update({ secondary_player_id: playerId, secondary_stat_id: 'assist' })
          .eq('id', picker.eventId)
      } else {
        await supabase.from('game_events')
          .update({ player_id: playerId })
          .eq('id', picker.eventId)

        // For scoring stats, ask for assist next
        const statDef = sportConfig?.stats?.find(s => s.id === picker.statId)
        if (statDef?.adds_to_score && picker.statId !== 'callahan') {
          // Brief pause then show assist picker
          setTimeout(() => {
            showPicker({
              statId:      'assist',
              teamId:      picker.teamId,
              label:       'Assist',
              eventId:     picker.eventId,
              isSecondary: true,
            })
          }, 200)
          setPicker(null)
          return
        }
      }

      // Update local events
      setEvents(prev => prev.map(e =>
        e.id === picker.eventId
          ? picker.isSecondary
            ? { ...e, secondary_player_id: playerId }
            : { ...e, player_id: playerId }
          : e
      ))
    }

    setPicker(null)
  }

  async function handleQuickAddPlayer(teamId, name, number) {
    if (!name.trim()) return
    const teamField = teamId === match.team_a?.id ? 'team_a' : 'team_b'
    const { data } = await supabase.from('tournament_players').insert({
      tournament_team_id: teamId,
      name: name.trim(),
      number: number?.trim() || null,
    }).select().single()
    if (data) {
      setRoster(prev => ({
        ...prev,
        [teamField === 'team_a' ? 'a' : 'b']: [...prev[teamField === 'team_a' ? 'a' : 'b'], data],
      }))
    }
    setAddingPlayer(null)
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
    await supabase.from('game_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', last.id)
    const remaining = events.filter(e => e.id !== last.id)
    setEvents(remaining)
    const lastWithScore = [...remaining].reverse().find(e => e.score_a_after !== null)
    setMatch(prev => ({
      ...prev,
      score_a: lastWithScore?.score_a_after ?? 0,
      score_b: lastWithScore?.score_b_after ?? 0,
    }))
  }

  async function setCapStatus(capStatus) {
    await supabase.from('matches')
      .update({ cap_status: capStatus, cap_triggered_at: new Date().toISOString() })
      .eq('id', matchId)
    setMatch(prev => ({ ...prev, cap_status: capStatus }))
  }

  if (loading || authChecking) return <PageLoader />
  if (!match) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Game not found</p>
    </div>
  )

  if (!authed) {
    return <PinGate match={match} onSuccess={() => setAuthed(true)} />
  }

  const pickerRoster = picker
    ? (picker.teamId === match.team_a?.id ? roster.a : roster.b)
    : []

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <Link to={'/t/' + match.tournament?.slug + '/gameday'} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {match.team_a?.short_name ?? match.team_a?.name ?? 'TBD'} vs {match.team_b?.short_name ?? match.team_b?.name ?? 'TBD'}
          </p>
          <p className="text-xs text-gray-500">
            {match.venue?.name}{match.time_slot ? ' - ' + formatTime(match.time_slot.scheduled_start) : ''}
          </p>
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
        <PreGameScreen
          match={match} roster={roster}
          onStart={startGame}
          onAddPlayer={handleQuickAddPlayer}
          onImportCSV={(teamId) => setAddingPlayer(teamId)}
        />
      )}
      {screen === SCREEN.LIVE && (
        <LiveScoringScreen
          match={match} events={events} roster={roster} sportConfig={sportConfig}
          onStat={handleStatTap}
          onUndo={undoLast}
          onSetCap={setCapStatus}
          onConfirmEnd={endGame}
        />
      )}
      {screen === SCREEN.POST && (
        <PostGameScreen match={match} events={events} roster={roster} sportConfig={sportConfig} />
      )}

      {/* Player picker bottom sheet */}
      {picker && (
        <PlayerPicker
          label={picker.label}
          isSecondary={picker.isSecondary}
          teamName={picker.teamId === match.team_a?.id
            ? (match.team_a?.short_name ?? match.team_a?.name)
            : (match.team_b?.short_name ?? match.team_b?.name)
          }
          players={pickerRoster}
          teamId={picker.teamId}
          onPick={handlePlayerPick}
          onSkip={() => handlePlayerPick(null)}
          onAddPlayer={handleQuickAddPlayer}
          timeout={PLAYER_PICKER_TIMEOUT}
        />
      )}

      {/* Quick add player modal */}
      {addingPlayer && (
        <QuickAddPlayer
          teamId={addingPlayer}
          teamName={addingPlayer === match.team_a?.id
            ? (match.team_a?.name ?? 'Team A')
            : (match.team_b?.name ?? 'Team B')
          }
          onAdd={handleQuickAddPlayer}
          onClose={() => setAddingPlayer(null)}
        />
      )}
    </div>
  )
}

// --- Pre-game screen ----------------------------------------------------------
function PreGameScreen({ match, roster, onStart, onAddPlayer }) {
  const missingA = !match.team_a?.id
  const missingB = !match.team_b?.id
  const canStart = !missingA && !missingB
  const [showAddA, setShowAddA] = useState(false)
  const [showAddB, setShowAddB] = useState(false)

  return (
    <div className="flex-1 flex flex-col gap-6 p-5 overflow-y-auto">
      <div className="text-center space-y-1 pt-4">
        <p className="text-gray-400 text-sm uppercase tracking-wide">Pre-game</p>
        <div className="flex items-center justify-center gap-4 text-lg font-bold flex-wrap">
          <TeamChip team={match.team_a} missing={missingA} />
          <span className="text-gray-600">vs</span>
          <TeamChip team={match.team_b} missing={missingB} />
        </div>
        {match.time_slot && (
          <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
            <Clock size={13} /> {formatTime(match.time_slot.scheduled_start)}
          </p>
        )}
      </div>

      {!canStart && (
        <div className="bg-amber-900/40 border border-amber-700/50 rounded-xl px-4 py-3 text-amber-300 text-sm text-center">
          Teams are TBD -- assign teams in Director HQ before starting.
        </div>
      )}

      {/* Roster management */}
      {canStart && (
        <div className="grid grid-cols-2 gap-3">
          <RosterPanel
            team={match.team_a} players={roster.a}
            onAdd={(name, num) => onAddPlayer(match.team_a.id, name, num)}
          />
          <RosterPanel
            team={match.team_b} players={roster.b}
            onAdd={(name, num) => onAddPlayer(match.team_b.id, name, num)}
          />
        </div>
      )}

      <button
        onClick={onStart}
        disabled={!canStart}
        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-colors w-full mt-auto"
      >
        <Play size={20} fill="currentColor" /> Start game
      </button>
    </div>
  )
}

function RosterPanel({ team, players, onAdd }) {
  const [newName, setNewName]   = useState('')
  const [newNum, setNewNum]     = useState('')
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    await onAdd(newName.trim(), newNum.trim())
    setNewName('')
    setNewNum('')
    setSaving(false)
    setAdding(false)
  }

  return (
    <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team?.primary_color ?? '#6b7280' }} />
        <p className="text-xs font-semibold text-gray-300 truncate flex-1">{team?.short_name ?? team?.name}</p>
        <button onClick={() => setAdding(a => !a)} className="text-gray-500 hover:text-gray-300">
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5 max-h-36 overflow-y-auto">
        {players.length === 0
          ? <p className="text-xs text-gray-600 italic">No roster</p>
          : players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="font-mono text-gray-600 w-4 text-right">{p.number ?? '-'}</span>
              <span className="truncate">{p.name}</span>
            </div>
          ))
        }
      </div>

      {adding && (
        <div className="mt-2 space-y-1.5 border-t border-gray-800 pt-2">
          <input
            type="text" placeholder="Player name" value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500"
          />
          <div className="flex gap-1.5">
            <input
              type="text" placeholder="#" value={newNum}
              onChange={e => setNewNum(e.target.value)}
              className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg py-1.5 font-semibold">
              {saving ? '...' : 'Add'}
            </button>
            <button onClick={() => setAdding(false)} className="px-2 text-gray-500 hover:text-gray-300 text-xs">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Live scoring screen ------------------------------------------------------
function LiveScoringScreen({ match, events, roster, sportConfig, onStat, onUndo, onSetCap, onConfirmEnd }) {
  const [pendingEnd, setPendingEnd] = useState(false)
  const stats = sportConfig?.stats ?? []
  const lastEvents = [...events].reverse().slice(0, 5)

  // Group stats by category for better layout
  const scoringStats  = stats.filter(s => s.adds_to_score)
  const defenseStats  = stats.filter(s => !s.adds_to_score && !s.is_negative && s.category === 'defense')
  const negativeStats = stats.filter(s => s.is_negative)
  const otherStats    = stats.filter(s => !s.adds_to_score && !s.is_negative && s.category !== 'defense')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scoreboard */}
      <div className="bg-gray-900 px-4 py-4 flex items-center justify-between gap-2 flex-shrink-0">
        <ScoreTeam team={match.team_a} score={match.score_a ?? 0} />
        <div className="flex flex-col items-center gap-1">
          {match.cap_status && (
            <span className="text-xs text-orange-400 font-bold uppercase leading-none">
              {match.cap_status === 'hard_cap' ? 'Hard Cap' : 'Soft Cap'}
            </span>
          )}
          <span className="text-gray-700">-</span>
        </div>
        <ScoreTeam team={match.team_b} score={match.score_b ?? 0} right />
      </div>

      {/* Cap controls */}
      {!match.cap_status && (
        <div className="flex gap-2 px-3 py-2 bg-gray-900/50 border-b border-gray-800 flex-shrink-0">
          <button onClick={() => onSetCap('soft_cap')}
            className="flex-1 text-xs py-1.5 rounded-lg bg-orange-900/40 text-orange-400 border border-orange-800/50">
            Soft Cap
          </button>
          <button onClick={() => onSetCap('hard_cap')}
            className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/40 text-red-400 border border-red-800/50">
            Hard Cap
          </button>
        </div>
      )}

      {/* Stat grid */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {stats.length === 0 ? (
          <SimpleScoreButtons match={match} onScore={onStat} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <TeamStatColumn
              team={match.team_a}
              scoringStats={scoringStats}
              defenseStats={defenseStats}
              negativeStats={negativeStats}
              otherStats={otherStats}
              onStat={statId => match.team_a?.id && onStat(match.team_a.id, statId)}
            />
            <TeamStatColumn
              team={match.team_b}
              scoringStats={scoringStats}
              defenseStats={defenseStats}
              negativeStats={negativeStats}
              otherStats={otherStats}
              onStat={statId => match.team_b?.id && onStat(match.team_b.id, statId)}
            />
          </div>
        )}
      </div>

      {/* Recent events feed */}
      {lastEvents.length > 0 && (
        <div className="bg-gray-900/80 border-t border-gray-800 px-3 py-2 flex-shrink-0 max-h-28 overflow-y-auto">
          {lastEvents.map(ev => (
            <EventFeedRow key={ev.id} event={ev} match={match} />
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex gap-2 px-3 pb-4 pt-2 border-t border-gray-800 flex-shrink-0">
        <button onClick={onUndo} disabled={events.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm disabled:opacity-30">
          <RotateCcw size={15} /> Undo
        </button>
        <div className="flex-1" />
        {!pendingEnd ? (
          <button onClick={() => setPendingEnd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">
            End game
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setPendingEnd(false)}
              className="px-3 py-2.5 rounded-xl bg-gray-800 text-gray-400 text-sm">Cancel</button>
            <button onClick={onConfirmEnd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm">
              <CheckCircle size={15} /> Confirm end
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamStatColumn({ team, scoringStats, defenseStats, negativeStats, otherStats, onStat }) {
  const color = team?.primary_color ?? '#6b7280'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold text-gray-400 truncate">{team?.short_name ?? team?.name}</p>
      </div>

      {/* Scoring -- big buttons */}
      {scoringStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-transform select-none"
          style={{ backgroundColor: color + '25', color, border: '1.5px solid ' + color + '50' }}>
          {stat.label}
        </button>
      ))}

      {/* Defense -- medium */}
      {defenseStats.length > 0 && <div className="h-px bg-gray-800" />}
      {defenseStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-blue-400 bg-blue-900/20 border border-blue-900/40 active:scale-95 transition-transform select-none">
          {stat.label}
        </button>
      ))}

      {/* Other non-negative */}
      {otherStats.length > 0 && <div className="h-px bg-gray-800" />}
      {otherStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-gray-400 bg-gray-800/60 border border-gray-700/50 active:scale-95 transition-transform select-none">
          {stat.label}
        </button>
      ))}

      {/* Negative -- red tint */}
      {negativeStats.length > 0 && <div className="h-px bg-gray-800" />}
      {negativeStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-red-400/80 bg-red-900/20 border border-red-900/30 active:scale-95 transition-transform select-none">
          {stat.label}
        </button>
      ))}
    </div>
  )
}

function EventFeedRow({ event: ev, match }) {
  const isTeamA = ev.team_id === match.team_a?.id
  const color   = isTeamA ? (match.team_a?.primary_color ?? '#6b7280') : (match.team_b?.primary_color ?? '#6b7280')
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-500 flex-1 truncate">
        {STAT_LABELS[ev.stat_id] ?? ev.stat_id}
        {ev.score_a_after !== null && (
          <span className="ml-1 text-gray-600 tabular-nums">{ev.score_a_after}-{ev.score_b_after}</span>
        )}
      </span>
    </div>
  )
}

// --- Player picker bottom sheet -----------------------------------------------
function PlayerPicker({ label, isSecondary, teamName, players, teamId, onPick, onSkip, onAddPlayer, timeout }) {
  const [progress, setProgress] = useState(100)
  const [newName, setNewName]   = useState('')
  const [newNum, setNewNum]     = useState('')
  const [addMode, setAddMode]   = useState(false)
  const intervalRef             = useRef(null)

  useEffect(() => {
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / timeout) * 100)
      setProgress(pct)
      if (pct <= 0) clearInterval(intervalRef.current)
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [timeout])

  async function handleAdd() {
    if (!newName.trim()) return
    await onAddPlayer(teamId, newName.trim(), newNum.trim())
    setNewName(''); setNewNum(''); setAddMode(false)
  }

  return (
    <div className="absolute inset-0 flex flex-col justify-end z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onSkip} />

      {/* Sheet */}
      <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl px-4 pt-4 pb-8 max-h-[70vh] flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-gray-800 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-100 rounded-full"
            style={{ width: progress + '%' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {isSecondary ? 'Assist -- ' : ''}{label}
            </p>
            <p className="text-sm font-semibold text-white">{teamName} -- who {isSecondary ? 'assisted?' : 'got the ' + label.toLowerCase() + '?'}</p>
          </div>
          <button onClick={onSkip} className="text-gray-500 hover:text-gray-300 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-3">
          {players.map(p => (
            <button key={p.id} onClick={() => onPick(p.id, p.name)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-left active:scale-98 transition-all">
              <span className="text-xs font-mono text-gray-500 w-6 text-right">{p.number ?? '-'}</span>
              <span className="text-sm font-medium text-white">{p.name}</span>
            </button>
          ))}

          {players.length === 0 && !addMode && (
            <p className="text-sm text-gray-600 text-center py-3 italic">No roster -- add players below or skip</p>
          )}

          {/* Quick add inline */}
          {addMode ? (
            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-400 font-semibold">Add player</p>
              <input type="text" placeholder="Player name" value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                autoFocus />
              <div className="flex gap-2">
                <input type="text" placeholder="#" value={newNum}
                  onChange={e => setNewNum(e.target.value)}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg py-2 font-semibold">
                  Add & select
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddMode(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-sm">
              <UserPlus size={14} /> Add player
            </button>
          )}
        </div>

        <button onClick={onSkip}
          className="w-full py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-gray-300 text-sm font-medium">
          Skip -- no player
        </button>
      </div>
    </div>
  )
}

// --- Quick add player modal ---------------------------------------------------
function QuickAddPlayer({ teamId, teamName, onAdd, onClose }) {
  const [name, setName] = useState('')
  const [num, setNum]   = useState('')
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm space-y-4">
        <h3 className="font-semibold text-white">Add player to {teamName}</h3>
        <input type="text" placeholder="Player name" value={name}
          onChange={e => setName(e.target.value)} autoFocus
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
        <input type="text" placeholder="Jersey number (optional)" value={num}
          onChange={e => setNum(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-400 text-sm">Cancel</button>
          <button onClick={() => name.trim() && onAdd(teamId, name.trim(), num.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">
            Add player
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Post-game screen ---------------------------------------------------------
function PostGameScreen({ match, events, roster, sportConfig }) {
  const scoreA  = match.score_a ?? 0
  const scoreB  = match.score_b ?? 0
  const winnerA = scoreA > scoreB
  const winnerB = scoreB > scoreA

  // Build player stats from events
  const allPlayers = [...(roster.a ?? []), ...(roster.b ?? [])]
  const playerStats = {}
  for (const ev of events) {
    if (ev.player_id) {
      if (!playerStats[ev.player_id]) playerStats[ev.player_id] = {}
      playerStats[ev.player_id][ev.stat_id] = (playerStats[ev.player_id][ev.stat_id] ?? 0) + 1
    }
    if (ev.secondary_player_id) {
      if (!playerStats[ev.secondary_player_id]) playerStats[ev.secondary_player_id] = {}
      playerStats[ev.secondary_player_id]['assist'] = (playerStats[ev.secondary_player_id]['assist'] ?? 0) + 1
    }
  }

  const stats = sportConfig?.stats ?? []
  const scoringStats = stats.filter(s => s.adds_to_score)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Final score */}
      <div className="flex flex-col items-center gap-4 p-6 border-b border-gray-800">
        <div className="w-12 h-12 bg-green-900/50 rounded-full flex items-center justify-center">
          <CheckCircle size={24} className="text-green-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-gray-400 text-sm">Final</p>
          <div className="flex items-center gap-4 text-2xl font-black">
            <span style={{ color: winnerA ? match.team_a?.primary_color : '#6b7280' }}>
              {match.team_a?.short_name ?? match.team_a?.name}
            </span>
            <span className="text-gray-300 tabular-nums">{scoreA} - {scoreB}</span>
            <span style={{ color: winnerB ? match.team_b?.primary_color : '#6b7280' }}>
              {match.team_b?.short_name ?? match.team_b?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Player stats summary */}
      {Object.keys(playerStats).length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Player stats</p>
          <div className="space-y-2">
            {Object.entries(playerStats)
              .sort(([, a], [, b]) => {
                const aScore = scoringStats.reduce((s, st) => s + (a[st.id] ?? 0), 0)
                const bScore = scoringStats.reduce((s, st) => s + (b[st.id] ?? 0), 0)
                return bScore - aScore
              })
              .map(([playerId, pStats]) => {
                const player = allPlayers.find(p => p.id === playerId)
                if (!player) return null
                return (
                  <div key={playerId} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-gray-600 font-mono w-5 text-right">{player.number ?? '-'}</span>
                    <span className="text-sm text-white flex-1">{player.name}</span>
                    <div className="flex gap-3">
                      {stats.filter(s => pStats[s.id]).map(s => (
                        <div key={s.id} className="text-center">
                          <p className="text-sm font-bold text-white tabular-nums">{pStats[s.id]}</p>
                          <p className="text-xs text-gray-600">{s.short}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-8 flex gap-4 justify-center mt-2">
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
        <p className="text-xs text-gray-400">{team?.short_name ?? team?.name ?? 'TBD'}</p>
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

function SimpleScoreButtons({ match, onScore }) {
  return (
    <div className="grid grid-cols-2 gap-6 py-4">
      {[match.team_a, match.team_b].map(team => (
        <div key={team?.id} className="flex flex-col items-center gap-3">
          <TeamChip team={team} />
          <button
            onPointerDown={() => team?.id && onScore(team.id, 'goal')}
            className="w-20 h-20 rounded-2xl text-4xl font-black active:scale-90 transition-transform select-none border-2"
            style={{ borderColor: team?.primary_color ?? '#6b7280', color: team?.primary_color ?? '#fff', backgroundColor: (team?.primary_color ?? '#6b7280') + '22' }}>
            +
          </button>
        </div>
      ))}
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
