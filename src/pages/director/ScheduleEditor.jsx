import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Clock, MapPin, GripVertical, AlertTriangle, RotateCcw, Plus, Minus } from 'lucide-react'

export function ScheduleEditor() {
  const { tournamentId }              = useParams()
  const [tournament, setTournament]   = useState(null)
  const [matches, setMatches]         = useState([])
  const [slots, setSlots]             = useState([])
  const [venues, setVenues]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(null) // matchId being saved
  const [dragging, setDragging]       = useState(null) // { matchId, slotId }
  const [dragOver, setDragOver]       = useState(null)
  const [globalDelay, setGlobalDelay] = useState(0)
  const [applyingDelay, setApplyingDelay] = useState(false)
  const [filter, setFilter]           = useState('all') // venue id or 'all'
  const [message, setMessage]         = useState(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)

      const { data: v } = await db.venues.byTournament(tournamentId)
      setVenues(v ?? [])

      const { data: s } = await db.timeSlots.byTournament(tournamentId)
      setSlots(s ?? [])

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, round, match_number, round_label, phase,
          score_a, score_b,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(id, name, short_name),
          time_slot:time_slots(id, scheduled_start, scheduled_end, offset_minutes),
          division:divisions(id, name),
          pool:pools(id, name)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')
      setMatches(m ?? [])
      setLoading(false)
    }
    load()
  }, [tournamentId])

  // -- Drag and drop ------------------------------------------------------------
  function handleDragStart(e, matchId, currentSlotId) {
    setDragging({ matchId, currentSlotId })
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, slotId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(slotId)
  }

  function handleDragLeave() {
    setDragOver(null)
  }

  async function handleDrop(e, targetSlotId, targetVenueId) {
    e.preventDefault()
    setDragOver(null)
    if (!dragging || dragging.currentSlotId === targetSlotId) { setDragging(null); return }

    const matchId = dragging.matchId
    setDragging(null)
    setSaving(matchId)

    try {
      // Check if target slot is occupied
      const occupant = matches.find(m => m.time_slot?.id === targetSlotId && m.id !== matchId)

      if (occupant) {
        // Swap slots between the two matches
        const { error: e1 } = await supabase.from('matches')
          .update({ time_slot_id: targetSlotId, venue_id: targetVenueId })
          .eq('id', matchId)
        const { error: e2 } = await supabase.from('matches')
          .update({ time_slot_id: dragging.currentSlotId })
          .eq('id', occupant.id)
        if (e1 || e2) throw e1 || e2

        setMatches(prev => prev.map(m => {
          if (m.id === matchId) return { ...m, time_slot: slots.find(s => s.id === targetSlotId) ?? m.time_slot, venue: venues.find(v => v.id === targetVenueId) ?? m.venue }
          if (m.id === occupant.id) return { ...m, time_slot: slots.find(s => s.id === dragging.currentSlotId) ?? m.time_slot }
          return m
        }))
        showMessage('Swapped game times')
      } else {
        // Move to empty slot
        const { error } = await supabase.from('matches')
          .update({ time_slot_id: targetSlotId, venue_id: targetVenueId })
          .eq('id', matchId)
        if (error) throw error

        setMatches(prev => prev.map(m =>
          m.id === matchId
            ? { ...m, time_slot: slots.find(s => s.id === targetSlotId) ?? m.time_slot, venue: venues.find(v => v.id === targetVenueId) ?? m.venue }
            : m
        ))
        showMessage('Game moved')
      }
    } catch (err) {
      showMessage('Failed to move game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  // -- Global delay -------------------------------------------------------------
  async function applyGlobalDelay() {
    if (globalDelay === 0) return
    setApplyingDelay(true)
    try {
      // Record delay
      await supabase.from('schedule_delays').insert({
        tournament_id: tournamentId,
        offset_minutes: globalDelay,
        reason: globalDelay > 0 ? 'Director delay' : 'Director advance',
        applies_from: new Date().toISOString(),
        is_active: true,
      })

      // Update all future time slots
      const now = new Date()
      const futureSlots = slots.filter(s => new Date(s.scheduled_start) > now)

      for (const slot of futureSlots) {
        const newStart = new Date(new Date(slot.scheduled_start).getTime() + globalDelay * 60000)
        const newEnd   = new Date(new Date(slot.scheduled_end).getTime() + globalDelay * 60000)
        await supabase.from('time_slots').update({
          scheduled_start: newStart.toISOString(),
          scheduled_end:   newEnd.toISOString(),
          offset_minutes:  (slot.offset_minutes ?? 0) + globalDelay,
        }).eq('id', slot.id)
      }

      // Reload
      const { data: newSlots } = await db.timeSlots.byTournament(tournamentId)
      setSlots(newSlots ?? [])
      const { data: newMatches } = await supabase
        .from('matches')
        .select('id, time_slot:time_slots(id, scheduled_start, scheduled_end, offset_minutes)')
        .eq('tournament_id', tournamentId)
      setMatches(prev => prev.map(m => {
        const updated = newMatches?.find(nm => nm.id === m.id)
        return updated ? { ...m, time_slot: updated.time_slot } : m
      }))

      showMessage(globalDelay > 0
        ? 'All future games delayed by ' + globalDelay + ' minutes'
        : 'All future games moved ' + Math.abs(globalDelay) + ' minutes earlier'
      )
      setGlobalDelay(0)
    } catch (err) {
      showMessage('Failed to apply delay: ' + err.message, 'error')
    } finally {
      setApplyingDelay(false)
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) return <PageLoader />

  // Group matches by time slot start hour + venue
  const filtered = filter === 'all'
    ? matches
    : matches.filter(m => m.venue?.id === filter)

  const grouped = groupByTime(filtered)

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Schedule Editor</h1>
            <p className="text-sm text-[var(--text-muted)]">{tournament?.name} - {matches.length} games</p>
          </div>
        </div>

        {/* Venue filter */}
        <select
          className="field-input text-sm"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All fields</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Toast message */}
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          message.type === 'error' ? 'bg-[rgba(239,68,68,0.1)] text-[#f87171] border border-[rgba(239,68,68,0.2)]' : 'bg-[rgba(34,197,94,0.1)] text-[#4ade80] border border-[rgba(34,197,94,0.2)]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Global delay controls */}
      <div className=" border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Global delay</p>
          <p className="text-xs text-[var(--text-muted)]">Push all future games forward or back</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setGlobalDelay(d => d - 5)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <Minus size={14} />
          </button>
          <span className={`text-sm font-bold tabular-nums w-16 text-center ${globalDelay > 0 ? 'text-[#fb923c]' : globalDelay < 0 ? 'text-[#60a5fa]' : 'text-[var(--text-muted)]'}`}>
            {globalDelay > 0 ? '+' + globalDelay : globalDelay} min
          </span>
          <button onClick={() => setGlobalDelay(d => d + 5)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <Plus size={14} />
          </button>
          <button
            onClick={applyGlobalDelay}
            disabled={globalDelay === 0 || applyingDelay}
            className="btn-primary btn btn-sm disabled:opacity-40"
          >
            {applyingDelay ? 'Applying...' : 'Apply to all future games'}
          </button>
          {globalDelay !== 0 && (
            <button onClick={() => setGlobalDelay(0)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Schedule grid */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-2xl">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium text-[var(--text-secondary)]">No games scheduled</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.key}>
              {/* Time group header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
                  <Clock size={11} /> {group.label}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {/* Match cards in this time block */}
              <div className="space-y-2">
                {group.matches.map(m => (
                  <MatchEditorCard
                    key={m.id}
                    match={m}
                    slots={slots}
                    venues={venues}
                    isSaving={saving === m.id}
                    isDragOver={dragOver === m.time_slot?.id}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onTimeChange={async (slotId) => {
                      setSaving(m.id)
                      const slot = slots.find(s => s.id === slotId)
                      await supabase.from('matches').update({ time_slot_id: slotId, venue_id: slot?.venue_id }).eq('id', m.id)
                      setMatches(prev => prev.map(mx => mx.id === m.id ? { ...mx, time_slot: slot } : mx))
                      setSaving(null)
                    }}
                    onVenueChange={async (venueId) => {
                      setSaving(m.id)
                      await supabase.from('matches').update({ venue_id: venueId }).eq('id', m.id)
                      setMatches(prev => prev.map(mx => mx.id === m.id ? { ...mx, venue: venues.find(v => v.id === venueId) } : mx))
                      setSaving(null)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center pb-4">
        Drag game cards to swap time slots. Changes save immediately.
      </p>
    </div>
  )
}

function MatchEditorCard({ match: m, slots, venues, isSaving, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onTimeChange, onVenueChange }) {
  const isLive = m.status === 'in_progress'
  const isDone = m.status === 'complete' || m.status === 'forfeit'
  const canEdit = !isLive && !isDone

  return (
    <div
      draggable={canEdit}
      onDragStart={canEdit ? (e) => onDragStart(e, m.id, m.time_slot?.id) : undefined}
      onDragOver={canEdit ? (e) => onDragOver(e, m.time_slot?.id) : undefined}
      onDragLeave={onDragLeave}
      onDrop={canEdit ? (e) => onDrop(e, m.time_slot?.id, m.venue?.id) : undefined}
      className={[
        'flex items-center gap-3 px-3 py-2.5 bg-[var(--bg-surface)] border rounded-xl transition-all',
        canEdit ? 'cursor-grab active:cursor-grabbing' : 'opacity-70',
        isDragOver ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)]',
        isSaving ? 'opacity-50' : '',
        isLive ? 'border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)]' : '',
      ].join(' ')}
    >
      {/* Drag handle */}
      {canEdit && (
        <GripVertical size={16} className="text-[var(--text-muted)] flex-shrink-0" />
      )}

      {/* Status dot */}
      {isLive && <span className="live-dot flex-shrink-0" />}
      {isDone && <span className="w-2 h-2 rounded-full bg-[var(--border-mid)] flex-shrink-0" />}

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TeamDot team={m.team_a} />
          <span className="text-xs text-[var(--text-muted)]">vs</span>
          <TeamDot team={m.team_b} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {m.pool && <span className="text-xs text-[var(--text-muted)]">{m.pool.name}</span>}
          {m.division && <span className="text-xs text-[var(--text-muted)]">{m.division.name}</span>}
          {m.round_label && <span className="text-xs text-[var(--text-muted)]">{m.round_label}</span>}
        </div>
      </div>

      {/* Score if done */}
      {isDone && (
        <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums flex-shrink-0">
          {m.score_a}-{m.score_b}
        </span>
      )}

      {/* Time selector */}
      {canEdit ? (
        <select
          className="field-input text-xs flex-shrink-0 max-w-32 py-1"
          value={m.time_slot?.id ?? ''}
          onChange={e => onTimeChange(e.target.value)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">No time</option>
          {slots
            .filter(s => s.venue?.id === (m.venue?.id ?? s.venue?.id))
            .map(s => (
              <option key={s.id} value={s.id}>
                {formatTime(s.scheduled_start)}
                {s.offset_minutes ? ' (+' + s.offset_minutes + 'm)' : ''}
              </option>
            ))
          }
        </select>
      ) : (
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
          {m.time_slot?.scheduled_start ? formatTime(m.time_slot.scheduled_start) : 'TBD'}
        </span>
      )}

      {/* Venue selector */}
      {canEdit ? (
        <select
          className="field-input text-xs flex-shrink-0 max-w-28 py-1"
          value={m.venue?.id ?? ''}
          onChange={e => onVenueChange(e.target.value)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">No field</option>
          {venues.map(v => (
            <option key={v.id} value={v.id}>{v.short_name ?? v.name}</option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
          <MapPin size={10} /> {m.venue?.short_name ?? m.venue?.name ?? 'TBD'}
        </span>
      )}

      {isSaving && (
        <div className="w-3 h-3 border border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
    </div>
  )
}

function TeamDot({ team }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team?.primary_color ?? 'var(--border-mid)' }} />
      <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-24">{team?.short_name ?? team?.name ?? 'TBD'}</span>
    </div>
  )
}

function groupByTime(matches) {
  const groups = {}
  for (const m of matches) {
    const start = m.time_slot?.scheduled_start
    const key = start ? new Date(start).toISOString().slice(0, 13) : 'unscheduled'
    const label = start ? formatGroupTime(new Date(start)) : 'Unscheduled'
    if (!groups[key]) groups[key] = { key, label, matches: [] }
    groups[key].matches.push(m)
  }
  return Object.values(groups).sort((a, b) => {
    if (a.key === 'unscheduled') return 1
    if (b.key === 'unscheduled') return -1
    return a.key.localeCompare(b.key)
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatGroupTime(d) {
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
