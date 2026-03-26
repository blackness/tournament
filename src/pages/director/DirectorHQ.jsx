import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase, db } from '../../lib/supabase'
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS } from '../../lib/constants'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import {
  Trophy, Calendar, MapPin, Users, ExternalLink, Edit,
  Trash2, AlertTriangle, X, ChevronRight, Play,
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
        .select('id, status, score_a, score_b, team_a:tournament_teams!team_a_id(name), team_b:tournament_teams!team_b_id(name), time_slot:time_slots(scheduled_start)')
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
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{tournament.name}</h1>
            <span className={'badge ' + statusBadge}>
              {TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {tournament.status === 'draft' && 'Ready to publish? Teams and spectators will be able to see this tournament.'}
              {tournament.status === 'published' && 'Ready to start? Mark the tournament as live when games begin.'}
              {tournament.status === 'live' && 'Finished for the day? Move to review to confirm final scores.'}
              {tournament.status === 'review' && 'All done? Archive this tournament to finalize results.'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Manage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickLink to={'/director/' + tournamentId + '/schedule'} label="Schedule editor" sub="Drag to adjust game times" />
          <QuickLink to={'/director/' + tournamentId + '/bracket'} label="Generate brackets" sub="Seed teams from pool standings" />
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

      {/* Games */}
      {matches.length > 0 && (
        <MatchList matches={matches} tournamentId={tournamentId} />
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Delete tournament?</h2>
                  <p className="text-sm text-gray-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <button onClick={() => setShowDelete(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">{tournament.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(tournament.start_date)}</p>
            </div>

            {tournament.status !== 'draft' && (
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
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
    <div className={'bg-white border rounded-xl p-4 text-center ' + (highlight ? 'border-green-200 bg-green-50' : 'border-gray-200')}>
      <p className={'text-2xl font-bold ' + (highlight ? 'text-green-700' : 'text-gray-900')}>{value}</p>
      <p className={'text-xs mt-0.5 ' + (highlight ? 'text-green-600' : 'text-gray-500')}>{label}</p>
    </div>
  )
}

function QuickLink({ to, label, sub, external }) {
  const cls = 'flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all'
  const inner = (
    <>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </>
  )
  if (external) return <a href={to} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
  return <Link to={to} className={cls}>{inner}</Link>
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
        <h2 className="text-sm font-semibold text-gray-700">Games ({matches.length})</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {[
            ['unplayed', 'Unplayed', counts.unplayed],
            ['live',     'Live',     counts.live],
            ['done',     'Done',     counts.done],
            ['all',      'All',      matches.length],
          ].map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={'px-2.5 py-1 rounded-md text-xs font-medium transition-colors ' + (
                filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {label} {count > 0 && <span className="ml-0.5 opacity-60">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No {filter} games</p>
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

function MatchRow({ match: m, tournamentId }) {
  const isLive  = m.status === 'in_progress'
  const isDone  = m.status === 'complete' || m.status === 'forfeit'
  const hasTBD  = !m.team_a?.id || !m.team_b?.id
  const [editing, setEditing] = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [saving, setSaving]   = useState(false)
  const [teamA, setTeamA]     = useState(m.team_a?.id ?? '')
  const [teamB, setTeamB]     = useState(m.team_b?.id ?? '')

  async function loadTeams() {
    const { supabase } = await import('../../lib/supabase')
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
    const { supabase } = await import('../../lib/supabase')
    await supabase.from('matches').update({
      team_a_id: teamA || null,
      team_b_id: teamB || null,
    }).eq('id', m.id)
    setSaving(false)
    setEditing(false)
    window.location.reload()
  }

  return (
    <div className={'rounded-lg border text-sm transition-all ' + (isLive ? 'border-green-200 bg-green-50/50' : hasTBD ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white')}>
      <div className="flex items-center gap-3 px-3 py-2">
        {isLive && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
        {hasTBD && !isLive && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}

        <span className="flex-1 truncate text-gray-700">
          <span className={!m.team_a?.id ? 'text-amber-500 italic' : ''}>{m.team_a?.name ?? 'TBD'}</span>
          <span className="text-gray-400 mx-1">vs</span>
          <span className={!m.team_b?.id ? 'text-amber-500 italic' : ''}>{m.team_b?.name ?? 'TBD'}</span>
        </span>

        {isDone && <span className="text-xs font-bold text-gray-500 tabular-nums flex-shrink-0">{m.score_a} - {m.score_b}</span>}
        {isLive && <span className="text-xs font-bold text-green-700 tabular-nums flex-shrink-0">{m.score_a} - {m.score_b}</span>}
        {m.time_slot?.scheduled_start && !isLive && !isDone && (
          <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(m.time_slot.scheduled_start)}</span>
        )}

        {/* Fix TBD button */}
        {hasTBD && !isDone && (
          <button onClick={e => { e.stopPropagation(); loadTeams() }}
            className="text-xs text-amber-600 hover:text-amber-800 border border-amber-300 rounded px-1.5 py-0.5 flex-shrink-0">
            Fix teams
          </button>
        )}

        {isLive ? (
          <Link to={'/scorekeeper/' + m.id}
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-500 text-white hover:bg-green-400">
            Score
          </Link>
        ) : !isDone ? (
          <Link to={'/scorekeeper/' + m.id}
            className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
            Start
          </Link>
        ) : (
          <Link to={'/score/' + m.id}
            className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600">
            <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {/* Inline team editor */}
      {editing && (
        <div className="px-3 pb-3 pt-1 border-t border-amber-100 space-y-2 bg-amber-50/50">
          <p className="text-xs font-semibold text-gray-600">Assign teams</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Team A</label>
              <select className="field-input text-xs" value={teamA} onChange={e => setTeamA(e.target.value)}>
                <option value="">TBD</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Team B</label>
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
