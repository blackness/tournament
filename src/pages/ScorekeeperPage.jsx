import { useEffect, useState, useRef, useCallback } from 'react'
import { ThemeToggle } from '../components/ui/ThemeToggle'
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
  const [gameStartTime, setGameStartTime] = useState(null) // epoch ms when game started

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
          tournament_id, scorekeeper_pin,
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
      if (m.status === 'in_progress') { setScreen(SCREEN.LIVE); if (m.started_at) setGameStartTime(new Date(m.started_at).getTime()) }
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
    const teamAId = matchData?.team_a?.id
    const teamBId = matchData?.team_b?.id
    console.log('[Roster] loading for teams:', teamAId, teamBId)
    const [{ data: rA, error: eA }, { data: rB, error: eB }] = await Promise.all([
      supabase.from('tournament_players').select('id, name, number')
        .eq('tournament_team_id', teamAId ?? 'x').order('number'),
      supabase.from('tournament_players').select('id, name, number')
        .eq('tournament_team_id', teamBId ?? 'x').order('number'),
    ])
    console.log('[Roster] A:', rA?.length, 'error:', eA?.message)
    console.log('[Roster] B:', rB?.length, 'error:', eB?.message)
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
    setGameStartTime(Date.now())
    setScreen(SCREEN.LIVE)
  }

  async function endGame(forceTie = false) {
    const scoreA   = match.score_a ?? 0
    const scoreB   = match.score_b ?? 0
    const isTie    = forceTie || scoreA === scoreB
    const winnerId = isTie ? null
                   : scoreA > scoreB ? match.team_a?.id : match.team_b?.id
    const { error } = await supabase.from('matches').update({
      status: 'complete', winner_id: winnerId,
      completed_at: new Date().toISOString(),
    }).eq('id', matchId)
    if (error) { setError(error.message); return }

    // Insert a game_end event so the standings trigger fires
    const seq = (events[events.length - 1]?.sequence ?? 0) + 1
    await supabase.from('game_events').insert({
      match_id:        matchId,
      stat_id:         'game_end',
      team_id:         winnerId ?? match.team_a?.id,
      score_a_after:   scoreA,
      score_b_after:   scoreB,
      event_timestamp: new Date().toISOString(),
      sequence:        seq,
      source:          'manual',
    })

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
  const lastTap = useRef({})
  async function handleStatTap(teamId, statId) {
    if (!teamId) return
    // Debounce -- ignore taps within 800ms of the same stat
    const key = teamId + statId
    const now = Date.now()
    if (lastTap.current[key] && now - lastTap.current[key] < 800) return
    lastTap.current[key] = now

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
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-[var(--text-muted)]">
      <p className="text-lg font-semibold text-[var(--text-secondary)]">Game not found</p>
    </div>
  )

  if (!authed) {
    return <PinGate match={match} onSuccess={() => setAuthed(true)} />
  }

  const pickerRoster = picker
    ? (picker.teamId === match.team_a?.id ? roster.a : roster.b)
    : []
  if (picker) console.log('[Picker] teamId:', picker.teamId, 'team_a.id:', match.team_a?.id, 'match?', picker.teamId === match.team_a?.id, 'roster.a:', roster.a?.length, 'roster.b:', roster.b?.length, 'pickerRoster:', pickerRoster?.length)

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <div className="bg-[var(--bg-base)] border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <Link to={'/t/' + match.tournament?.slug + '/gameday'} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ChevronLeft size={20} />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {match.team_a?.short_name ?? match.team_a?.name ?? 'TBD'} vs {match.team_b?.short_name ?? match.team_b?.name ?? 'TBD'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {match.venue?.name}{match.time_slot ? ' - ' + formatTime(match.time_slot.scheduled_start) : ''}
          </p>
        </div>
        <Link to={'/score/' + matchId} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
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
          gameStartTime={gameStartTime}
          match={match} events={events} roster={roster} sportConfig={sportConfig}
          onStat={handleStatTap}
          onUndo={undoLast}
          onSetCap={setCapStatus}
          onConfirmEnd={(forceTie) => endGame(forceTie)}
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
  const [showRosters, setShowRosters] = useState(false)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Match info */}
      <div style={{ padding:'20px 16px 16px', textAlign:'center' }}>
        <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Pre-game</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontSize:17, fontWeight:700, flexWrap:'wrap', marginBottom:8 }}>
          <TeamChip team={match.team_a} missing={missingA} />
          <span style={{ color:'var(--text-muted)', fontWeight:400 }}>vs</span>
          <TeamChip team={match.team_b} missing={missingB} />
        </div>
        {match.time_slot && (
          <p style={{ fontSize:13, color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <Clock size={13} /> {formatTime(match.time_slot.scheduled_start)}
          </p>
        )}
      </div>

      {!canStart && (
        <div style={{ margin:'0 16px 16px', padding:'12px 14px', background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.2)', borderRadius:12, fontSize:13, color:'#fde047', textAlign:'center' }}>
          Teams are TBD -- assign teams in Director HQ before starting.
        </div>
      )}

      {/* START GAME -- always visible at top */}
      {canStart && (
        <div style={{ padding:'0 16px 16px' }}>
          <button onClick={onStart}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'16px', fontSize:18, fontWeight:700, fontFamily:'inherit', background:'var(--live)', color:'var(--bg-base)', border:'none', borderRadius:16, cursor:'pointer', transition:'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
            <Play size={20} fill="currentColor" /> Start game
          </button>
        </div>
      )}

      {/* Roster section -- collapsible */}
      {canStart && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <button onClick={() => setShowRosters(s => !s)}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'transparent', border:'none', borderTop:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              Rosters ({(roster.a?.length ?? 0) + (roster.b?.length ?? 0)} players)
            </span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{showRosters ? '▲' : '▼'}</span>
          </button>

          {showRosters && (
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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
        </div>
      )}
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
    <div className="bg-[var(--bg-base)] rounded-xl p-3 border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team?.primary_color ?? '#6b7280' }} />
        <p className="text-xs font-semibold text-[var(--text-muted)] truncate flex-1">{team?.short_name ?? team?.name}</p>
        <button onClick={() => setAdding(a => !a)} className="text-[var(--text-muted)] hover:text-[var(--text-muted)]">
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5 max-h-36 overflow-y-auto">
        {players.length === 0
          ? <p className="text-xs text-[var(--text-secondary)] italic">No roster</p>
          : players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="font-mono text-[var(--text-secondary)] w-4 text-right">{p.number ?? '-'}</span>
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
            className="w-full bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-gray-600 outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-1.5">
            <input
              type="text" placeholder="#" value={newNum}
              onChange={e => setNewNum(e.target.value)}
              className="w-12 bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-gray-600 outline-none focus:border-[var(--accent)]"
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim()}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)] disabled:opacity-40 text-[var(--text-primary)] text-xs rounded-lg py-1.5 font-semibold">
              {saving ? '...' : 'Add'}
            </button>
            <button onClick={() => setAdding(false)} className="px-2 text-[var(--text-muted)] hover:text-[var(--text-muted)] text-xs">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Live scoring screen ------------------------------------------------------
function LiveScoringScreen({ match, events, roster, sportConfig, onStat, onUndo, onSetCap, onConfirmEnd, gameStartTime }) {
  const [pendingEnd, setPendingEnd] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Game clock
  useEffect(() => {
    if (!gameStartTime) return
    const tick = () => setElapsed(Math.floor((Date.now() - gameStartTime) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [gameStartTime])

  const clockStr = gameStartTime
    ? String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0')
    : '--:--'
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
      <div className="bg-[var(--bg-base)] px-4 py-4 flex items-center justify-between gap-2 flex-shrink-0">
        <ScoreTeam team={match.team_a} score={match.score_a ?? 0} />
        <div className="flex flex-col items-center gap-1">
          {match.cap_status && (
            <span className="text-xs text-orange-400 font-bold uppercase leading-none">
              {match.cap_status === 'hard_cap' ? 'Hard Cap' : 'Soft Cap'}
            </span>
          )}
          <span style={{ fontFamily:'DM Mono, monospace', fontSize:22, fontWeight:600, color:'var(--text-primary)', letterSpacing:'0.05em', lineHeight:1 }}>
            {clockStr}
          </span>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--live)' }}>Live</span>
        </div>
        <ScoreTeam team={match.team_b} score={match.score_b ?? 0} right />
      </div>

      {/* Cap controls */}
      {!match.cap_status && (
        <div className="flex gap-2 px-3 py-2 bg-[var(--bg-base)]/50 border-b border-gray-800 flex-shrink-0">
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
        <div className="bg-[var(--bg-base)]/80 border-t border-gray-800 px-3 py-2 flex-shrink-0 max-h-28 overflow-y-auto">
          {lastEvents.map(ev => (
            <EventFeedRow key={ev.id} event={ev} match={match} />
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex gap-2 px-3 pb-4 pt-2 border-t border-gray-800 flex-shrink-0">
        <button onClick={onUndo} disabled={events.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-raised)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] text-sm disabled:opacity-30">
          <RotateCcw size={15} /> Undo
        </button>
        <div className="flex-1" />
        {!pendingEnd ? (
          <button onClick={() => setPendingEnd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--bg-raised)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] text-sm">
            End game
          </button>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setPendingEnd(false)}
                style={{ padding:'8px 14px', borderRadius:10, background:'transparent', border:'1px solid #374151', color:'#9ca3af', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
              {match.score_a === match.score_b && (
                <button onClick={() => onConfirmEnd(true)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:10, background:'rgba(234,179,8,0.15)', border:'1px solid rgba(234,179,8,0.3)', color:'#fde047', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Tie
                </button>
              )}
              <button onClick={() => onConfirmEnd(false)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:10, background:'#16a34a', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                <CheckCircle size={14} /> End game
              </button>
            </div>
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
        <p className="text-xs font-semibold text-[var(--text-muted)] truncate">{team?.short_name ?? team?.name}</p>
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
      {defenseStats.length > 0 && <div className="h-px bg-[var(--bg-raised)]" />}
      {defenseStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-[var(--accent)] bg-[var(--accent-dim)] border border-[rgba(232,255,71,0.15)] active:scale-95 transition-transform select-none">
          {stat.label}
        </button>
      ))}

      {/* Other non-negative */}
      {otherStats.length > 0 && <div className="h-px bg-[var(--bg-raised)]" />}
      {otherStats.map(stat => (
        <button key={stat.id} onPointerDown={() => onStat(stat.id)}
          className="w-full py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-raised)]/60 border border-[var(--border-mid)]/50 active:scale-95 transition-transform select-none">
          {stat.label}
        </button>
      ))}

      {/* Negative -- red tint */}
      {negativeStats.length > 0 && <div className="h-px bg-[var(--bg-raised)]" />}
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
      <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
        {STAT_LABELS[ev.stat_id] ?? ev.stat_id}
        {ev.score_a_after !== null && (
          <span className="ml-1 text-[var(--text-secondary)] tabular-nums">{ev.score_a_after}-{ev.score_b_after}</span>
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
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column", justifyContent:"flex-end", zIndex:9999 }}>
      {/* Backdrop */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)" }} onClick={onSkip} />

      {/* Sheet */}
      <div className="relative bg-[var(--bg-base)] border-t border-[var(--border-mid)] rounded-t-2xl px-4 pt-4 pb-8 max-h-[70vh] flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-[var(--bg-raised)] rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-[var(--accent)] transition-all duration-100 rounded-full"
            style={{ width: progress + '%' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
              {isSecondary ? 'Assist -- ' : ''}{label}
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{teamName} -- who {isSecondary ? 'assisted?' : 'got the ' + label.toLowerCase() + '?'}</p>
          </div>
          <button onClick={onSkip} className="text-[var(--text-muted)] hover:text-[var(--text-muted)] p-1">
            <X size={18} />
          </button>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-3">
          {players.map(p => (
            <button key={p.id} onClick={() => onPick(p.id, p.name)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-left active:scale-98 transition-all">
              <span className="text-xs font-mono text-[var(--text-muted)] w-6 text-right">{p.number ?? '-'}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{p.name}</span>
            </button>
          ))}

          {players.length === 0 && !addMode && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-3 italic">No roster -- add players below or skip</p>
          )}

          {/* Quick add inline */}
          {addMode ? (
            <div className="bg-[var(--bg-raised)] rounded-xl p-3 space-y-2">
              <p className="text-xs text-[var(--text-muted)] font-semibold">Add player</p>
              <input type="text" placeholder="Player name" value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                autoFocus />
              <div className="flex gap-2">
                <input type="text" placeholder="#" value={newNum}
                  onChange={e => setNewNum(e.target.value)}
                  className="w-14 bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-lg px-2 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]" />
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)] disabled:opacity-40 text-[var(--text-primary)] text-sm rounded-lg py-2 font-semibold">
                  Add & select
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddMode(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border-mid)] text-[var(--text-muted)] hover:text-[var(--text-muted)] hover:border-gray-500 text-sm">
              <UserPlus size={14} /> Add player
            </button>
          )}
        </div>

        <button onClick={onSkip}
          className="w-full py-2.5 rounded-xl bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-muted)] text-sm font-medium">
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"0 16px" }}>
      <div className="bg-[var(--bg-base)] border border-[var(--border-mid)] rounded-2xl p-5 w-full max-w-sm space-y-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Add player to {teamName}</h3>
        <input type="text" placeholder="Player name" value={name}
          onChange={e => setName(e.target.value)} autoFocus
          className="w-full bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent)]" />
        <input type="text" placeholder="Jersey number (optional)" value={num}
          onChange={e => setNum(e.target.value)}
          className="w-full bg-[var(--bg-raised)] border border-[var(--border-mid)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent)]" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--bg-raised)] text-[var(--text-muted)] text-sm">Cancel</button>
          <button onClick={() => name.trim() && onAdd(teamId, name.trim(), num.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)] disabled:opacity-40 text-[var(--text-primary)] text-sm font-semibold">
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
        <div className="w-12 h-12 bg-[rgba(34,197,94,0.15)] rounded-full flex items-center justify-center">
          <CheckCircle size={24} className="text-[var(--live)]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[var(--text-muted)] text-sm">Final</p>
          <div className="flex items-center gap-4 text-2xl font-black">
            <span style={{ color: winnerA ? match.team_a?.primary_color : '#6b7280' }}>
              {match.team_a?.short_name ?? match.team_a?.name}
            </span>
            <span className="text-[var(--text-muted)] tabular-nums">{scoreA} - {scoreB}</span>
            <span style={{ color: winnerB ? match.team_b?.primary_color : '#6b7280' }}>
              {match.team_b?.short_name ?? match.team_b?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Player stats summary */}
      {Object.keys(playerStats).length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Player stats</p>
          <div className="space-y-2">
            {Object.entries(playerStats)
              .map(([playerId, pStats]) => {
                const player = allPlayers.find(p => p.id === playerId)
                return player ? { player, pStats } : null
              })
              .filter(Boolean)
              .sort((a, b) => {
                const aScore = scoringStats.reduce((s, st) => s + (a.pStats[st.id] ?? 0), 0)
                const bScore = scoringStats.reduce((s, st) => s + (b.pStats[st.id] ?? 0), 0)
                return bScore - aScore
              })
              .map(({ player, pStats }) => (
                <div key={player.id} className="flex items-center gap-3 bg-[var(--bg-base)] rounded-xl px-3 py-2.5">
                  <span className="text-xs text-[var(--text-secondary)] font-mono w-5 text-right">{player.number ?? '-'}</span>
                  <span className="text-sm text-[var(--text-primary)] flex-1">{player.name}</span>
                  <div className="flex gap-3">
                    {stats.filter(s => pStats[s.id]).map(s => (
                      <div key={s.id} className="text-center">
                        <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{pStats[s.id]}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{s.short}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-8 flex gap-4 justify-center mt-2">
        <Link to={'/score/' + match.id} className="text-sm text-[var(--accent)] hover:underline">
          View scoreboard
        </Link>
        <Link to={'/sotg/' + match.id} className="text-sm text-[var(--live)] hover:underline">
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
        <p className="text-xs text-[var(--text-muted)]">{team?.short_name ?? team?.name ?? 'TBD'}</p>
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
