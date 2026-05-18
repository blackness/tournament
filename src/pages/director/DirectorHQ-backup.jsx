import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase, db } from '../../lib/supabase'
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS } from '../../lib/constants'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import {
  Trophy, Calendar, MapPin, Users, ExternalLink, Edit,
  Trash2, AlertTriangle, X, ChevronRight, Play, Link2, Copy, Check,
  CheckCircle, Archive, Eye, Lock
} from 'lucide-react'

const STATUS_FLOW = {
  draft:     { next: 'published', label: 'Publish',     icon: Eye,         color: 'btn-primary' },
  published: { next: 'live',      label: 'Go Live',      icon: Play,        color: 'btn-primary' },
  live:      { next: 'review',    label: 'End & Review', icon: CheckCircle, color: 'btn-secondary' },
  review:    { next: 'archived',  label: 'Archive',      icon: Archive,     color: 'btn-secondary' },
  archived:  { next: null,        label: null,           icon: null,        color: '' },
}

export function DirectorHQ() {
  const { tournamentId }              = useParams()
  const { user }                      = useAuth()
  const navigate                      = useNavigate()
  const [tournament, setTournament]   = useState(null)
  const [divisions, setDivisions]     = useState([])
  const [matches, setMatches]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [advancing, setAdvancing]     = useState(false)
  const [seedingBracket, setSeedingBracket] = useState(false)
  const [seedResult, setSeedResult]     = useState(null)
  const [error, setError]             = useState(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      if (!t) { navigate('/director'); return }

      // Allow access if user is the tournament director OR has a director/co_director role
      const isOwner = t.director_id === user?.id
      if (!isOwner) {
        const { data: role } = await supabase
          .from('tournament_roles')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('user_id', user?.id)
          .in('role', ['director', 'co_director'])
          .maybeSingle()
        if (!role) { navigate('/director'); return }
      }
      setTournament(t)

      const { data: divs } = await db.divisions.byTournament(tournamentId)
      setDivisions(divs ?? [])

      const { data: m } = await supabase
        .from('matches')
        .select('id, status, score_a, score_b, scorekeeper_pin, tournament_id, team_a:tournament_teams!team_a_id(name, id), team_b:tournament_teams!team_b_id(name, id), time_slot:time_slots(scheduled_start), venue:venues(name)')
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')
        
      setMatches(m ?? [])
      setLoading(false)
    }
    load()
  }, [tournamentId, user])

  async function handleAdvanceStatus() {
    const flow = STATUS_FLOW[tournament.status]
    if (!flow?.next) return
    setAdvancing(true)
    setError(null)
    try {
      const { data } = await db.tournaments.update(tournamentId, { status: flow.next })
      setTournament(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdvancing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await supabase
        .from('tournaments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', tournamentId)
        .eq('director_id', user.id)
      navigate('/director')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }


  async function seedBracket() {
    setSeedingBracket(true)
    setSeedResult(null)
    setError(null)
    try {
      // Fetch final pool standings ordered by rank
      const { data: standings, error: stErr } = await supabase
        .from('pool_standings_display')
        .select('team_id, pool_id, rank, pool_name, team_name')
        .in('division_id', divisions.map(d => d.id))
        .order('pool_id')
        .order('rank')
      if (stErr) throw new Error(stErr.message)

      // Group by pool
      const byPool = {}
      for (const s of standings) {
        if (!byPool[s.pool_name]) byPool[s.pool_name] = []
        byPool[s.pool_name].push(s)
      }

      const pools = Object.keys(byPool).sort()
      if (pools.length < 2) throw new Error('Need at least 2 pools to seed bracket')

      // Fetch bracket matches (phase 2, no teams yet)
      const { data: bracketMatches } = await supabase
        .from('matches')
        .select('id, bracket_position, notes, team_a_id, team_b_id')
        .eq('tournament_id', tournamentId)
        .eq('phase', 2)
        .order('match_number')

      // Build seed map: pool letter + rank → team_id
      // e.g. A1, A2, B1, B2, etc.
      const seedMap = {}
      for (const pool of pools) {
        const letter = pool.replace('Pool ', '')
        for (const s of byPool[pool]) {
          seedMap[letter + s.rank] = s.team_id
        }
      }

      // Parse bracket notes to slot teams
      // notes format: 'bracket:A1-vs-B4' or 'bracket:1A-vs-2D'
      const updates = []
      for (const m of bracketMatches) {
        if (!m.notes?.startsWith('bracket:')) continue
        if (m.team_a_id && m.team_b_id) continue // already seeded

        const inner = m.notes.replace('bracket:', '')
        const [rawA, rawB] = inner.split('-vs-')

        // Normalize: '1A' → 'A1', 'A1' → 'A1'
        const normalize = s => {
          if (!s) return null
          // skip non-seed labels like winG1, winnerV etc
          if (s.startsWith('win') || s.startsWith('loser') || s.startsWith('semi')) return null
          // '1A' format
          const m1 = s.match(/^(\d+)([A-Z])$/)
          if (m1) return m1[2] + m1[1]
          // 'A1' format
          const m2 = s.match(/^([A-Z])(\d+)$/)
          if (m2) return m2[1] + m2[2]
          return null
        }

        const keyA = normalize(rawA)
        const keyB = normalize(rawB)
        const teamA = keyA ? seedMap[keyA] : null
        const teamB = keyB ? seedMap[keyB] : null

        if (teamA || teamB) {
          const update = { id: m.id }
          if (teamA && !m.team_a_id) update.team_a_id = teamA
          if (teamB && !m.team_b_id) update.team_b_id = teamB
          updates.push(update)
        }
      }

      // Apply updates
      let seeded = 0
      for (const u of updates) {
        const { id, ...fields } = u
        await supabase.from('matches').update(fields).eq('id', id)
        seeded++
      }

      setSeedResult(`✓ Seeded ${seeded} bracket game${seeded !== 1 ? 's' : ''} successfully`)

      // Refresh matches
      const { data: refreshed } = await supabase
        .from('matches')
        .select('id, status, score_a, score_b, scorekeeper_pin, tournament_id, team_a:tournament_teams!team_a_id(name, id), team_b:tournament_teams!team_b_id(name, id), time_slot:time_slots(scheduled_start), venue:venues(name)')
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')
      if (refreshed) setMatches(refreshed)

    } catch (err) {
      setError('Bracket seeding failed: ' + err.message)
    } finally {
      setSeedingBracket(false)
    }
  }

  if (loading) return <PageLoader />
  if (!tournament) return null

  const flow      = STATUS_FLOW[tournament.status]
  const StatusIcon = flow?.icon
  const liveCount = matches.filter(m => m.status === 'in_progress').length
  const doneCount = matches.filter(m => m.status === 'complete' || m.status === 'forfeit').length
  const totalCount = matches.length

  const statusBadge = {
    draft:     'badge-gray',
    published: 'badge-blue',
    live:      'badge-green',
    review:    'badge-yellow',
    archived:  'badge-gray',
  }[tournament.status] ?? 'badge-gray'

  return (
    <div style={{maxWidth:800}}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] truncate">{tournament.name}</h1>
            <span className={'badge ' + statusBadge}>
              {TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {formatDate(tournament.start_date)}
              {tournament.start_date !== tournament.end_date && ' - ' + formatDate(tournament.end_date)}
            </span>
            {tournament.venue_name && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {tournament.venue_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Link to={'/t/' + tournament.slug} target="_blank" className="btn-ghost btn btn-sm">
            <ExternalLink size={14} /> Public page
          </Link>
          <Link to={'/director/' + tournamentId + '/edit'} className="btn-secondary btn btn-sm">
            <Edit size={14} /> Edit
          </Link>
          <button onClick={() => setShowDelete(true)} className="btn-ghost btn btn-sm text-red-500 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Status transition */}
      {flow?.next && (
        <div className=" border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {tournament.status === 'draft' && 'Ready to publish? Teams and spectators will be able to see this tournament.'}
              {tournament.status === 'published' && 'Ready to start? Mark the tournament as live when games begin.'}
              {tournament.status === 'live' && 'Finished for the day? Move to review to confirm final scores.'}
              {tournament.status === 'review' && 'All done? Archive this tournament to finalize results.'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {'Current status: ' + (TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status)}
            </p>
          </div>
          {StatusIcon && (
            <button
              onClick={handleAdvanceStatus}
              disabled={advancing}
              className={flow.color + ' btn flex-shrink-0'}
            >
              <StatusIcon size={15} />
              {advancing ? 'Updating...' : flow.label}
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Divisions" value={divisions.length} />
        <StatCard label="Games" value={totalCount} />
        <StatCard label="Live now" value={liveCount} highlight={liveCount > 0} />
        <StatCard label="Completed" value={doneCount + (totalCount > 0 ? '/' + totalCount : '')} />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Manage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickLink to={'/director/' + tournamentId + '/schedule'} label="Schedule editor" sub="Drag to adjust game times" />
          <QuickLink to={'/director/' + tournamentId + '/bracket'} label="Generate brackets" sub="Seed teams from pool standings" />
          <QuickLink to={'/director/' + tournamentId + '/roster'} label="Roster manager" sub="Add and manage players" />
          <QuickLink to={'/director/' + tournamentId + '/constraints'} label="Constraint review" sub="Review scheduling conflicts" />
          <QuickLink to={'/director/' + tournamentId + '/qr'} label="QR codes" sub="Print field QR cards" />
          <QuickLink to={'/director/' + tournamentId + '/scorekeeper-sheet'} label="Scorekeeper sheet" sub="Print QR codes for all games" />
          {divisions.map(div => (
            <QuickLink
              key={div.id}
              to={'/t/' + tournament.slug + '/standings/' + div.id}
              label={div.name + ' standings'}
              sub="Live pool standings"
              external
            />
          ))}
        </div>
      </div>

      {/* Seed Bracket */}
      {divisions.length > 0 && matches.some(m => m.status === 'complete') && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', margin:0 }}>Seed bracket from standings</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'3px 0 0' }}>
              Reads final pool standings and slots teams into bracket games automatically.
            </p>
            {seedResult && <p style={{ fontSize:12, color:'#4ade80', margin:'4px 0 0', fontWeight:600 }}>{seedResult}</p>}
          </div>
          <button onClick={seedBracket} disabled={seedingBracket}
            style={{ flexShrink:0, padding:'10px 20px', background:'var(--accent)', color:'var(--bg-base)', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: seedingBracket ? 0.6 : 1, whiteSpace:'nowrap' }}>
            {seedingBracket ? 'Seeding...' : '⚡ Seed Bracket'}
          </button>
        </div>
      )}

      {/* Stream URLs per venue */}
      <StreamManager tournamentId={tournamentId} />

      {/* PIN management */}
      <PinManager tournamentId={tournamentId} matches={matches} onPinsUpdated={() => window.location.reload()} />

      {/* Games */}
      {matches.length > 0 && (
        <MatchList matches={matches} tournamentId={tournamentId} />
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className=" rounded-2xl  w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[rgba(239,68,68,0.12)] rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Delete tournament?</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <button onClick={() => setShowDelete(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className=" rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{tournament.name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(tournament.start_date)}</p>
            </div>

            {tournament.status !== 'draft' && (
              <div className="flex gap-2 p-3 bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)] rounded-lg text-xs text-[#fde047]">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                This tournament has teams, games, and scores attached. All data will be soft-deleted.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowDelete(false)} disabled={deleting} className="btn-secondary btn flex-1">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger btn flex-1">
                {deleting ? 'Deleting...' : 'Delete tournament'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={'border rounded-xl p-4 text-center' + (highlight ? ' border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)]' : ' border-[var(--border)]')}>
      <p className={'text-2xl font-bold font-mono ' + (highlight ? 'text-[#4ade80]' : 'text-[var(--text-primary)]')}>{value}</p>
      <p className={'text-xs mt-0.5 ' + (highlight ? 'text-[#4ade80]' : 'text-[var(--text-muted)]')}>{label}</p>
    </div>
  )
}

function QuickLink({ to, label, sub, external }) {
  const cls = 'flex items-center justify-between gap-3 border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--border-mid)] hover:bg-[var(--bg-raised)] transition-all'
  const inner = (
    <>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-[var(--text-muted)] flex-shrink-0" />
    </>
  )
  if (external) return <a href={to} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
  return <Link to={to} className={cls}>{inner}</Link>
}

function StreamManager({ tournamentId }) {
  const [venues, setVenues]   = useState([])
  const [saving, setSaving]   = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    supabase.from('venues').select('id, name, short_name, youtube_url')
      .eq('tournament_id', tournamentId).order('sort_order')
      .then(({ data }) => setVenues(data ?? []))
  }, [tournamentId])

  async function saveUrl(venueId, url) {
    setSaving(venueId)
    await supabase.from('venues').update({ youtube_url: url || null }).eq('id', venueId)
    setMessage('Stream URL saved')
    setTimeout(() => setMessage(null), 2500)
    setSaving(null)
  }

  if (venues.length === 0) return null

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
      <p style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Live stream URLs</p>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:14 }}>Paste a YouTube live URL per field. Spectators can watch at /watch/:matchId</p>
      {venues.map(v => (
        <div key={v.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', width:70, flexShrink:0 }}>{v.short_name ?? v.name}</span>
          <input
            className="field-input"
            style={{ flex:1, fontSize:12 }}
            placeholder="https://youtube.com/watch?v=..."
            defaultValue={v.youtube_url ?? ''}
            onBlur={e => saveUrl(v.id, e.target.value)}
          />
          {saving === v.id && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Saving...</span>}
        </div>
      ))}
      {message && <p style={{ fontSize:12, color:'#4ade80', marginTop:6 }}>{message}</p>}
    </div>
  )
}

function PinManager({ tournamentId, matches, onPinsUpdated }) {
  const [open, setOpen]       = useState(false)
  const [pin, setPin]         = useState('')
  const [saving, setSaving]   = useState(false)
  const [message, setMessage] = useState(null)

  const unpinnedCount = matches.filter(m => !['complete','forfeit','cancelled'].includes(m.status) && !m.scorekeeper_pin).length

  async function generatePins() {
    setSaving(true)
    const tournamentPin = pin.trim() || Math.floor(1000 + Math.random() * 9000).toString()
    // Apply to all non-completed matches (overwrite existing PINs too)
    const toPin = matches.filter(m => !['complete', 'forfeit', 'cancelled'].includes(m.status))
    for (const m of toPin) {
      await supabase.from('matches').update({ scorekeeper_pin: tournamentPin }).eq('id', m.id)
    }
    setMessage('PIN set: ' + tournamentPin + ' (' + toPin.length + ' games)')
    setSaving(false)
    setPin('')
    setTimeout(() => { setMessage(null); onPinsUpdated() }, 3000)
  }

  const hasAnyPin = matches.some(m => m.scorekeeper_pin)
  const samplePin = matches.find(m => m.scorekeeper_pin)?.scorekeeper_pin

  return (
    <div className=" border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            Scorekeeper PIN
            {hasAnyPin && (
              <span className="badge badge-green">Active: {samplePin}</span>
            )}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {hasAnyPin
              ? 'Scorekeepers use this PIN to access the console'
              : unpinnedCount + ' games have no PIN set'}
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="btn-secondary btn btn-sm">
          {open ? 'Close' : hasAnyPin ? 'Change PIN' : 'Set PIN'}
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-3 flex-wrap">
          <input
            type="text"
            className="field-input w-32"
            placeholder="e.g. 1234"
            value={pin}
            maxLength={6}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          />
          <button onClick={generatePins} disabled={saving} className="btn-primary btn btn-sm">
            {saving ? 'Setting...' : pin ? 'Set PIN: ' + pin : 'Generate random PIN'}
          </button>
          <p className="text-xs text-[var(--text-muted)]">Applies to all unstarted games</p>
        </div>
      )}

      {message && (
        <p className="mt-2 text-sm font-semibold text-[#4ade80] bg-[rgba(34,197,94,0.1)] px-3 py-1.5 rounded-lg">
          {message}
        </p>
      )}
    </div>
  )
}

function MatchList({ matches, tournamentId }) {
  const [filter, setFilter] = useState('unplayed')

  const filtered = filter === 'all'
    ? matches
    : filter === 'unplayed'
      ? matches.filter(m => m.status === 'scheduled')
      : filter === 'live'
        ? matches.filter(m => m.status === 'in_progress')
        : matches.filter(m => m.status === 'complete' || m.status === 'forfeit')

  const counts = {
    unplayed: matches.filter(m => m.status === 'scheduled').length,
    live:     matches.filter(m => m.status === 'in_progress').length,
    done:     matches.filter(m => m.status === 'complete' || m.status === 'forfeit').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Games ({matches.length})</h2>
        <div className="flex  rounded-lg p-0.5 gap-0.5">
          {[
            ['unplayed', 'Unplayed', counts.unplayed],
            ['live',     'Live',     counts.live],
            ['done',     'Done',     counts.done],
            ['all',      'All',      matches.length],
          ].map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={'px-2.5 py-1 rounded-md text-xs font-medium transition-colors ' + (
                filter === val ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}>
              {label} {count > 0 && <span className="ml-0.5 opacity-60">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">No {filter} games</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(m => (
            <MatchRow key={m.id} match={m} tournamentId={tournamentId} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreEditor({ match: m, onClose, onSaved }) {
  const [scoreA, setScoreA]   = useState(m.score_a ?? 0)
  const [scoreB, setScoreB]   = useState(m.score_b ?? 0)
  const [isForfeit, setIsForfeit] = useState(false)
  const [forfeitTeam, setForfeitTeam] = useState('a')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    const finalA = isForfeit ? (forfeitTeam === 'b' ? 15 : 0) : Number(scoreA)
    const finalB = isForfeit ? (forfeitTeam === 'a' ? 15 : 0) : Number(scoreB)
    const winnerId = finalA > finalB ? m.team_a?.id
                   : finalB > finalA ? m.team_b?.id : null

    await supabase.from('matches').update({
      score_a:      finalA,
      score_b:      finalB,
      winner_id:    winnerId,
      status:       isForfeit ? 'forfeit' : 'complete',
      completed_at: new Date().toISOString(),
    }).eq('id', m.id)

    // Recompute standings
    await supabase.rpc('fn_recompute_standings', { p_match_id: m.id }).catch(() => {})
    setSaving(false)
    onSaved()
  }

  const teamA = m.team_a?.name ?? 'Team A'
  const teamB = m.team_b?.name ?? 'Team B'

  return (
    <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] /50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">
          {m.status === 'complete' || m.status === 'forfeit' ? 'Correct score' : 'Record result'}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={isForfeit} onChange={e => setIsForfeit(e.target.checked)} className="rounded" />
          Forfeit
        </label>
      </div>

      {isForfeit ? (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1.5">Which team forfeited?</p>
          <div className="grid grid-cols-2 gap-2">
            {[['a', teamA], ['b', teamB]].map(([side, name]) => (
              <button key={side} onClick={() => setForfeitTeam(side)}
                className={'py-2 rounded-lg text-xs font-semibold border-2 transition-colors ' + (
                  forfeitTeam === side
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-mid)]'
                )}>
                {name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 text-center">
            Winner gets 15-0. Score recorded as forfeit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)] mb-1 truncate">{teamA}</p>
            <input type="number" min="0" max="99" value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              className="field-input text-center text-xl font-black w-full" />
          </div>
          <div className="text-center text-[var(--text-muted)] text-sm font-bold">vs</div>
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)] mb-1 truncate">{teamB}</p>
            <input type="number" min="0" max="99" value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              className="field-input text-center text-xl font-black w-full" />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className={'btn btn-sm flex-1 ' + (isForfeit ? 'btn-danger' : 'btn-primary')}>
          {saving ? 'Saving...' : isForfeit ? 'Record forfeit' : 'Save score'}
        </button>
        <button onClick={onClose} className="btn-secondary btn btn-sm">Cancel</button>
      </div>
    </div>
  )
}

function CopyLinkButton({ matchId, pin }) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedPin, setCopiedPin] = useState(false)

  const url = window.location.origin + '/scorekeeper/' + matchId

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  function copyPin() {
    if (!pin) return
    navigator.clipboard.writeText(pin).then(() => {
      setCopiedPin(true)
      setTimeout(() => setCopiedPin(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Copy URL only */}
      <button
        onClick={copyUrl}
        title="Copy scorekeeper link"
        className={'p-1.5 rounded-lg transition-colors flex items-center gap-1 ' + (
          copiedUrl
            ? 'text-[#4ade80] bg-[rgba(34,197,94,0.08)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
        )}
      >
        {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
        <span className="text-[10px] font-medium">{copiedUrl ? 'Copied!' : 'Link'}</span>
      </button>

      {/* Show PIN inline + copy it separately */}
      {pin && (
        <button
          onClick={copyPin}
          title="Copy PIN"
          className={'p-1.5 rounded-lg transition-colors flex items-center gap-1 ' + (
            copiedPin
              ? 'text-[#4ade80] bg-[rgba(34,197,94,0.08)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          <Lock size={11} />
          <span className="text-[10px] font-mono font-bold">{copiedPin ? '✓' : pin}</span>
        </button>
      )}
    </div>
  )
}

function MatchRow({ match: m, tournamentId }) {
  const isLive  = m.status === 'in_progress'
  const isDone  = m.status === 'complete' || m.status === 'forfeit'
  const hasTBD  = !m.team_a?.id || !m.team_b?.id
  const [editing, setEditing]   = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [scoreEdit, setScoreEdit] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [teamA, setTeamA]       = useState(m.team_a?.id ?? '')
  const [teamB, setTeamB]       = useState(m.team_b?.id ?? '')

  async function loadTeams() {
    const { data } = await supabase
      .from('tournament_teams')
      .select('id, name, short_name, primary_color')
      .eq('tournament_id', m.tournament_id ?? tournamentId)
      .order('name')
    setAllTeams(data ?? [])
    setEditing(true)
  }

  async function saveTeams() {
    setSaving(true)
    await supabase.from('matches').update({
      team_a_id: teamA || null,
      team_b_id: teamB || null,
    }).eq('id', m.id)
    setSaving(false)
    setEditing(false)
    window.location.reload()
  }

  const borderColor = isLive
    ? 'rgba(34,197,94,0.3)'
    : hasTBD ? 'rgba(234,179,8,0.25)'
    : 'var(--border)'
  const bg = isLive
    ? 'rgba(34,197,94,0.05)'
    : hasTBD ? 'rgba(234,179,8,0.03)'
    : 'var(--bg-surface)'

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius:12, background:bg, overflow:'hidden' }}>

      {/* Row 1: Teams + score */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
        {/* Status dot */}
        {isLive && <span className="live-dot" style={{ flexShrink:0 }} />}
        {hasTBD && !isLive && <span style={{ width:8, height:8, borderRadius:'50%', background:'#fde047', flexShrink:0 }} />}

        {/* Team names */}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <span style={{ color: !m.team_a?.id ? '#fde047' : 'inherit', fontStyle: !m.team_a?.id ? 'italic' : 'normal' }}>
              {m.team_a?.name ?? 'TBD'}
            </span>
            <span style={{ color:'var(--text-muted)', fontWeight:400, margin:'0 6px' }}>vs</span>
            <span style={{ color: !m.team_b?.id ? '#fde047' : 'inherit', fontStyle: !m.team_b?.id ? 'italic' : 'normal' }}>
              {m.team_b?.name ?? 'TBD'}
            </span>
          </p>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>
            {m.time_slot?.scheduled_start ? formatTime(m.time_slot.scheduled_start) : ''}
            {m.team_a?.id && m.team_b?.id && m.round_label ? ' · ' + m.round_label : ''}
          </p>
        </div>

        {/* Score */}
        {(isLive || isDone) && (
          <span style={{ fontFamily:'DM Mono, monospace', fontSize:16, fontWeight:700, color: isLive ? 'var(--live)' : 'var(--text-muted)', flexShrink:0 }}>
            {m.score_a ?? 0}–{m.score_b ?? 0}
          </span>
        )}
      </div>

      {/* Row 2: Action buttons */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px 10px', flexWrap:'wrap' }}>
        {/* Start / Score button */}
        {isLive ? (
          <Link to={'/scorekeeper/' + m.id}
            style={{ padding:'8px 16px', background:'var(--live)', color:'var(--bg-base)', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
            Score →
          </Link>
        ) : !isDone ? (
          <Link to={'/scorekeeper/' + m.id}
            style={{ padding:'8px 16px', background:'var(--bg-raised)', border:'1px solid var(--border-mid)', color:'var(--text-secondary)', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none', flexShrink:0 }}>
            Start game
          </Link>
        ) : (
          <Link to={'/score/' + m.id}
            style={{ padding:'8px 16px', background:'var(--bg-raised)', border:'1px solid var(--border)', color:'var(--text-muted)', borderRadius:8, fontSize:13, textDecoration:'none', flexShrink:0 }}>
            View →
          </Link>
        )}

        {/* Fix teams */}
        {hasTBD && !isDone && (
          <button onClick={() => loadTeams()}
            style={{ padding:'8px 14px', background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.3)', color:'#fde047', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            Fix teams
          </button>
        )}

        {/* Score correction */}
        {!hasTBD && (
          <button onClick={() => setScoreEdit(s => !s)}
            style={{ padding:'8px 14px', background:'var(--bg-raised)', border:'1px solid var(--border)', color:'var(--text-muted)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            {isDone ? 'Correct score' : 'Record result'}
          </button>
        )}

        {/* Scorekeeper link + PIN */}
        {!isDone && (
          <div style={{ marginLeft:'auto' }}>
            <CopyLinkButton matchId={m.id} pin={m.scorekeeper_pin} />
          </div>
        )}
      </div>

      {/* Team editor panel */}
      {editing && (
        <div style={{ padding:'12px', borderTop:'1px solid var(--border)', background:'rgba(234,179,8,0.04)' }}>
          <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:10 }}>Assign teams</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Team A</label>
              <select className="field-input" style={{ fontSize:13, width:'100%' }} value={teamA} onChange={e => setTeamA(e.target.value)}>
                <option value="">TBD</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Team B</label>
              <select className="field-input" style={{ fontSize:13, width:'100%' }} value={teamB} onChange={e => setTeamB(e.target.value)}>
                <option value="">TBD</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={saveTeams} disabled={saving}
              style={{ flex:1, padding:'10px', background:'var(--accent)', color:'var(--bg-base)', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving...' : 'Save teams'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding:'10px 16px', background:'var(--bg-raised)', border:'1px solid var(--border)', color:'var(--text-muted)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Score editor panel */}
      {scoreEdit && (
        <ScoreEditor match={m} onClose={() => setScoreEdit(false)} onSaved={() => { setScoreEdit(false); window.location.reload() }} />
      )}
    </div>
  )
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
