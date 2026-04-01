import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase, db } from '../../lib/supabase'
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS } from '../../lib/constants'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import {
  Trophy, Calendar, MapPin, Users, ExternalLink, Edit,
  Trash2, AlertTriangle, X, ChevronRight, Play, Link2, Copy, Check,
  CheckCircle, Archive, Eye
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
  const [error, setError]             = useState(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      if (!t || t.director_id !== user?.id) { navigate('/director'); return }
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
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = window.location.origin + '/scorekeeper/' + matchId
    const text = pin ? url + '\nPIN: ' + pin : url
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={pin ? 'Copy scorekeeper link + PIN' : 'Copy scorekeeper link'}
      className={'flex-shrink-0 p-1.5 rounded-lg transition-colors ' + (
        copied
          ? 'text-[#4ade80] bg-[rgba(34,197,94,0.08)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function MatchRow({ match: m, tournamentId }) {
  const isLive  = m.status === 'in_progress'
  const isDone  = m.status === 'complete' || m.status === 'forfeit'
  const hasTBD  = !m.team_a?.id || !m.team_b?.id
  const [editing, setEditing] = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [scoreEdit, setScoreEdit] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [teamA, setTeamA]     = useState(m.team_a?.id ?? '')
  const [teamB, setTeamB]     = useState(m.team_b?.id ?? '')

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

  return (
    <div className={'rounded-xl border text-sm transition-all ' + (isLive ? 'border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)]' : hasTBD ? 'border-[rgba(234,179,8,0.2)] bg-[rgba(234,179,8,0.04)]' : 'border-[var(--border)] bg-[var(--bg-surface)]')}>
      <div className="flex items-center gap-3 px-3 py-2">
        {isLive && <span className="live-dot flex-shrink-0" />}
        {hasTBD && !isLive && <span className="w-2 h-2 rounded-full bg-[#fde047] flex-shrink-0" />}

        <span className="flex-1 truncate text-[var(--text-secondary)]">
          <span className={!m.team_a?.id ? 'text-[#fde047] italic' : ''}>{m.team_a?.name ?? 'TBD'}</span>
          <span className="text-[var(--text-muted)] mx-1">vs</span>
          <span className={!m.team_b?.id ? 'text-[#fde047] italic' : ''}>{m.team_b?.name ?? 'TBD'}</span>
        </span>

        {isDone && <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums flex-shrink-0">{m.score_a} - {m.score_b}</span>}
        {isLive && <span className="text-xs font-bold text-[var(--live)] tabular-nums flex-shrink-0 font-mono">{m.score_a} - {m.score_b}</span>}
        {m.time_slot?.scheduled_start && !isLive && !isDone && (
          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{formatTime(m.time_slot.scheduled_start)}</span>
        )}

        {/* Fix TBD button */}
        {hasTBD && !isDone && (
          <button onClick={e => { e.stopPropagation(); loadTeams() }}
            className="text-xs text-[#fde047] hover:text-[#fbbf24] border border-[rgba(234,179,8,0.3)] rounded px-1.5 py-0.5 flex-shrink-0">
            Fix teams
          </button>
        )}

        {/* Score correction / forfeit */}
        {!hasTBD && (
          <button onClick={e => { e.stopPropagation(); setScoreEdit(s => !s) }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] rounded px-1.5 py-0.5 flex-shrink-0">
            {isDone ? 'Correct' : 'Forfeit'}
          </button>
        )}

        {/* Copy scorekeeper link */}
        {!isDone && (
          <CopyLinkButton matchId={m.id} pin={m.scorekeeper_pin} />
        )}

        {isLive ? (
          <Link to={'/scorekeeper/' + m.id}
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--live)] text-[var(--bg-base)] hover:opacity-90">
            Score
          </Link>
        ) : !isDone ? (
          <Link to={'/scorekeeper/' + m.id}
            className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            Start
          </Link>
        ) : (
          <Link to={'/score/' + m.id}
            className="flex-shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {/* Inline team editor */}
      {editing && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] space-y-2 bg-[rgba(234,179,8,0.04)]">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Assign teams</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Team A</label>
              <select className="field-input text-xs" value={teamA} onChange={e => setTeamA(e.target.value)}>
                <option value="">TBD</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Team B</label>
              <select className="field-input text-xs" value={teamB} onChange={e => setTeamB(e.target.value)}>
                <option value="">TBD</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveTeams} disabled={saving} className="btn-primary btn btn-sm">
              {saving ? 'Saving...' : 'Save teams'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary btn btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Score correction / forfeit panel */}
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
