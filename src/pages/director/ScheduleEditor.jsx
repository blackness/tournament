import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { validateSchedule } from '../../lib/scheduleGenerator'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import {
  ChevronLeft,
  Clock,
  MapPin,
  GripVertical,
  RotateCcw,
  Plus,
  Minus,
  AlertTriangle,
  Pencil,
} from 'lucide-react'

export function ScheduleEditor() {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [slots, setSlots] = useState([])
  const [venues, setVenues] = useState([])
  const [teams, setTeams] = useState([])
  const [pools, setPools] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [globalDelay, setGlobalDelay] = useState(0)
  const [applyingDelay, setApplyingDelay] = useState(false)
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState(null)
  const [conflicts, setConflicts] = useState([])

  const [editingMatchId, setEditingMatchId] = useState(null)
  const [editForm, setEditForm] = useState({
    pool_id: '',
    division_id: '',
    team_a_id: '',
    team_b_id: '',
    time_slot_id: '',
    venue_id: '',
    round: 1,
  })

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)

      const { data: v } = await db.venues.byTournament(tournamentId)
      setVenues(v ?? [])

      const { data: s } = await db.timeSlots.byTournament(tournamentId)
      setSlots(s ?? [])

      const { data: tm } = await db.teams.byTournament(tournamentId)
      setTeams(tm ?? [])

      const { data: dv } = await db.divisions.byTournament(tournamentId)
      setDivisions(dv ?? [])

      const divisionIds = (dv ?? []).map(d => d.id)
      let poolData = []
      if (divisionIds.length > 0) {
        const { data: p } = await supabase
          .from('pools')
          .select('id, division_id, name, sort_order')
          .in('division_id', divisionIds)
          .order('sort_order')
        poolData = p ?? []
      }
      setPools(poolData)

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, round, match_number, round_label, phase,
          score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(id, name, short_name),
          time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes),
          division:divisions(id, name),
          pool:pools(id, name)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')

      const sortedMatches = [...(m ?? [])].sort((a, b) => {
        const aStart = a.time_slot?.scheduled_start ?? '9999'
        const bStart = b.time_slot?.scheduled_start ?? '9999'
        if (aStart !== bStart) return aStart.localeCompare(bStart)
        return (a.match_number ?? 9999) - (b.match_number ?? 9999)
      })

      setMatches(sortedMatches)
      setLoading(false)
    }

    load()
  }, [tournamentId])

const recalculateConflicts = useCallback((nextMatches = matches, nextSlots = slots) => {
    const normalizedMatches = nextMatches.map(m => ({
      id: m.id,
      team_a_id: m.team_a?.id ?? null,
      team_b_id: m.team_b?.id ?? null,
      slot_id: m.time_slot?.id ?? m.time_slot_id ?? null,
      venue_id: m.venue?.id ?? m.venue_id ?? null,
    }))

    const normalizedSlots = nextSlots.map(s => ({
      id: s.id,
      venue_id: s.venue_id ?? s.venue?.id ?? null,
      scheduled_start: s.scheduled_start,
      scheduled_end: s.scheduled_end,
    }))

    const minRestMinutes = Number(
      tournament?.format_config?.schedule?.minRestBetweenTeamGames ?? 0
    )

    const nextConflicts = validateSchedule(
      normalizedMatches,
      normalizedSlots,
      minRestMinutes
    )

    setConflicts(nextConflicts)
    return nextConflicts
  }, [matches, slots, tournament])

  useEffect(() => {
    if (matches.length > 0 || slots.length > 0) {
      recalculateConflicts(matches, slots)
    } else {
      setConflicts([])
    }
  }, [matches, slots, recalculateConflicts])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

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

    if (!dragging || dragging.currentSlotId === targetSlotId) {
      setDragging(null)
      return
    }

    const matchId = dragging.matchId
    setDragging(null)
    setSaving(matchId)

    try {
      const occupant = matches.find(m => m.time_slot?.id === targetSlotId && m.id !== matchId)

      if (occupant) {
        const oldSlot = slots.find(s => s.id === dragging.currentSlotId)

        const { error: e1 } = await supabase
          .from('matches')
          .update({ time_slot_id: targetSlotId, venue_id: targetVenueId || null })
          .eq('id', matchId)

        const { error: e2 } = await supabase
          .from('matches')
          .update({ time_slot_id: dragging.currentSlotId, venue_id: oldSlot?.venue_id || null })
          .eq('id', occupant.id)

        if (e1 || e2) throw e1 || e2

        const nextMatches = matches.map(m => {
          if (m.id === matchId) {
            const newSlot = slots.find(s => s.id === targetSlotId) ?? m.time_slot
            const newVenue = venues.find(v => v.id === targetVenueId) ?? m.venue
            return { ...m, time_slot: newSlot, time_slot_id: targetSlotId, venue: newVenue, venue_id: targetVenueId }
          }

          if (m.id === occupant.id) {
            const oldTimeSlot = slots.find(s => s.id === dragging.currentSlotId) ?? m.time_slot
            const oldVenue = venues.find(v => v.id === oldTimeSlot?.venue_id) ?? m.venue
            return {
              ...m,
              time_slot: oldTimeSlot,
              time_slot_id: dragging.currentSlotId,
              venue: oldVenue,
              venue_id: oldTimeSlot?.venue_id ?? null,
            }
          }

          return m
        })

        setMatches(nextMatches)
        recalculateConflicts(nextMatches, slots)
        showMessage('Swapped game times')
      } else {
        const slot = slots.find(s => s.id === targetSlotId)
        const venue = venues.find(v => v.id === targetVenueId) ?? null

        const { error } = await supabase
          .from('matches')
          .update({ time_slot_id: targetSlotId, venue_id: targetVenueId || null })
          .eq('id', matchId)

        if (error) throw error

        const nextMatches = matches.map(m =>
          m.id === matchId
            ? {
                ...m,
                time_slot: slot ?? null,
                time_slot_id: targetSlotId,
                venue,
                venue_id: targetVenueId || null,
              }
            : m
        )

        setMatches(nextMatches)
        recalculateConflicts(nextMatches, slots)
        showMessage('Game moved')
      }
    } catch (err) {
      showMessage('Failed to move game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  async function applyGlobalDelay() {
    if (globalDelay === 0) return
    setApplyingDelay(true)

    try {
      await supabase.from('schedule_delays').insert({
        tournament_id: tournamentId,
        offset_minutes: globalDelay,
        reason: globalDelay > 0 ? 'Director delay' : 'Director advance',
        applies_from: new Date().toISOString(),
        is_active: true,
      })

      const now = new Date()
      const futureSlots = slots.filter(s => new Date(s.scheduled_start) > now)

      for (const slot of futureSlots) {
        const newStart = new Date(new Date(slot.scheduled_start).getTime() + globalDelay * 60000)
        const newEnd = new Date(new Date(slot.scheduled_end).getTime() + globalDelay * 60000)

        await supabase
          .from('time_slots')
          .update({
            scheduled_start: newStart.toISOString(),
            scheduled_end: newEnd.toISOString(),
            offset_minutes: (slot.offset_minutes ?? 0) + globalDelay,
          })
          .eq('id', slot.id)
      }

      const { data: newSlots } = await db.timeSlots.byTournament(tournamentId)
      const normalizedSlots = newSlots ?? []
      setSlots(normalizedSlots)

      const { data: newMatches } = await supabase
        .from('matches')
        .select(`
          id,
          venue_id,
          time_slot_id,
          venue:venues(id, name, short_name),
          time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')

      const nextMatches = matches.map(m => {
        const updated = newMatches?.find(nm => nm.id === m.id)
        return updated
          ? {
              ...m,
              time_slot: updated.time_slot,
              time_slot_id: updated.time_slot_id,
              venue: updated.venue ?? m.venue,
              venue_id: updated.venue_id,
            }
          : m
      })

      setMatches(nextMatches)
      recalculateConflicts(nextMatches, normalizedSlots)

      showMessage(
        globalDelay > 0
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

  function openAddModal() {
    const firstPool = pools[0] ?? null
    const firstDivisionId = firstPool?.division_id ?? divisions[0]?.id ?? ''
    const firstVenue = venues[0] ?? null

    setEditingMatchId('new')
    setEditForm({
      pool_id: firstPool?.id ?? '',
      division_id: firstDivisionId,
      team_a_id: '',
      team_b_id: '',
      time_slot_id: '',
      venue_id: firstVenue?.id ?? '',
      round: 1,
    })
  }

  function openEditModal(match) {
    setEditingMatchId(match.id)
    setEditForm({
      pool_id: match.pool_id ?? match.pool?.id ?? '',
      division_id: match.division_id ?? match.division?.id ?? '',
      team_a_id: match.team_a?.id ?? '',
      team_b_id: match.team_b?.id ?? '',
      time_slot_id: match.time_slot_id ?? match.time_slot?.id ?? '',
      venue_id: match.venue_id ?? match.venue?.id ?? '',
      round: match.round ?? 1,
    })
  }

  function closeEditModal() {
    setEditingMatchId(null)
    setEditForm({
      pool_id: '',
      division_id: '',
      team_a_id: '',
      team_b_id: '',
      time_slot_id: '',
      venue_id: '',
      round: 1,
    })
  }

  function handleEditFormChange(field, value) {
    setEditForm(prev => {
      const next = { ...prev, [field]: value }

      if (field === 'pool_id') {
        const selectedPool = pools.find(p => p.id === value)
        next.division_id = selectedPool?.division_id ?? ''
      }

      if (field === 'time_slot_id') {
        const selectedSlot = slots.find(s => s.id === value)
        if (selectedSlot?.venue_id) {
          next.venue_id = selectedSlot.venue_id
        }
      }

      return next
    })
  }

  async function handleSaveMatchEdit() {
    if (!editForm.division_id) {
      showMessage('Division is required', 'error')
      return
    }

    if (!editForm.team_a_id || !editForm.team_b_id) {
      showMessage('Both teams are required', 'error')
      return
    }

    if (editForm.team_a_id === editForm.team_b_id) {
      showMessage('A team cannot play itself', 'error')
      return
    }

    const selectedPool = pools.find(p => p.id === editForm.pool_id)
    const selectedDivisionId = selectedPool?.division_id ?? editForm.division_id ?? null
    const selectedSlot = slots.find(s => s.id === editForm.time_slot_id)
    const venueId = selectedSlot?.venue_id ?? editForm.venue_id ?? null
    const venue = venues.find(v => v.id === venueId) ?? null
    const timeSlot = selectedSlot ?? null
    const teamA = teams.find(t => t.id === editForm.team_a_id) ?? null
    const teamB = teams.find(t => t.id === editForm.team_b_id) ?? null
    const division = divisions.find(d => d.id === selectedDivisionId) ?? null
    const pool = pools.find(p => p.id === editForm.pool_id) ?? null

    if (editingMatchId === 'new') {
      setSaving('new')
      try {
        const nextMatchNumber =
          matches.reduce((max, m) => Math.max(max, m.match_number ?? 0), 0) + 1

        const insertRow = {
          tournament_id: tournamentId,
          division_id: selectedDivisionId,
          pool_id: editForm.pool_id || null,
          team_a_id: editForm.team_a_id,
          team_b_id: editForm.team_b_id,
          time_slot_id: editForm.time_slot_id || null,
          venue_id: venueId,
          round: Number(editForm.round) || 1,
          match_number: nextMatchNumber,
          phase: 1,
          status: 'scheduled',
        }

        const { data, error } = await supabase
          .from('matches')
          .insert(insertRow)
          .select(`
            id, status, round, match_number, round_label, phase,
            score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
            team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
            team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
            venue:venues(id, name, short_name),
            time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes),
            division:divisions(id, name),
            pool:pools(id, name)
          `)
          .single()

        if (error) throw error

        const nextMatches = [...matches, data].sort((a, b) => {
          const aStart = a.time_slot?.scheduled_start ?? '9999'
          const bStart = b.time_slot?.scheduled_start ?? '9999'
          if (aStart !== bStart) return aStart.localeCompare(bStart)
          return (a.match_number ?? 9999) - (b.match_number ?? 9999)
        })

        setMatches(nextMatches)
        recalculateConflicts(nextMatches, slots)
        showMessage('Game added')
        closeEditModal()
      } catch (err) {
        showMessage('Failed to add game: ' + err.message, 'error')
      } finally {
        setSaving(null)
      }
      return
    }

    setSaving(editingMatchId)

    try {
      const updateRow = {
        division_id: selectedDivisionId,
        pool_id: editForm.pool_id || null,
        team_a_id: editForm.team_a_id,
        team_b_id: editForm.team_b_id,
        time_slot_id: editForm.time_slot_id || null,
        venue_id: venueId,
        round: Number(editForm.round) || 1,
      }

      const { error } = await supabase
        .from('matches')
        .update(updateRow)
        .eq('id', editingMatchId)

      if (error) throw error

      const nextMatches = matches.map(m =>
        m.id === editingMatchId
          ? {
              ...m,
              division_id: selectedDivisionId,
              pool_id: editForm.pool_id || null,
              team_a: teamA,
              team_b: teamB,
              venue,
              venue_id: venueId,
              time_slot: timeSlot,
              time_slot_id: editForm.time_slot_id || null,
              division,
              pool,
              round: Number(editForm.round) || 1,
            }
          : m
      )

      setMatches(nextMatches)
      recalculateConflicts(nextMatches, slots)
      showMessage('Game updated')
      closeEditModal()
    } catch (err) {
      showMessage('Failed to update game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleCancelMatch() {
    if (!editingMatchId || editingMatchId === 'new') return

    setSaving(editingMatchId)
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', editingMatchId)

      if (error) throw error

      const nextMatches = matches.filter(m => m.id !== editingMatchId)
      setMatches(nextMatches)
      recalculateConflicts(nextMatches, slots)
      showMessage('Game archived')
      closeEditModal()
    } catch (err) {
      showMessage('Failed to archive game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <PageLoader />

  const filtered =
    filter === 'all'
      ? matches
      : matches.filter(m => m.venue?.id === filter || m.venue_id === filter)

  const grouped = groupByTime(filtered)
  const editablePools = pools
  const editableTeams = teams
  const editingMatch =
    matches.find(m => m.id === editingMatchId) ?? (editingMatchId === 'new' ? { id: 'new' } : null)

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Schedule Editor</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {tournament?.name} - {matches.length} games
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openAddModal} className="btn-secondary btn btn-sm">
            <Plus size={14} />
            Add game
          </button>

          <select
            className="field-input text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All fields</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            message.type === 'error'
              ? 'bg-[rgba(239,68,68,0.1)] text-[#f87171] border border-[rgba(239,68,68,0.2)]'
              : 'bg-[rgba(34,197,94,0.1)] text-[#4ade80] border border-[rgba(34,197,94,0.2)]'
          }`}
        >
          {message.text}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="space-y-1.5">
          {conflicts.slice(0, 5).map((c, i) => (
            <div
              key={i}
              className={
                'flex gap-2 p-2 rounded-lg text-xs border ' +
                (c.severity === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200')
              }
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {c.message}
            </div>
          ))}
          {conflicts.length > 5 && (
            <p className="text-xs text-[var(--text-muted)] ml-5">
              +{conflicts.length - 5} more warnings
            </p>
          )}
        </div>
      )}

      <div className="border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Global delay</p>
          <p className="text-xs text-[var(--text-muted)]">Push all future games forward or back</p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setGlobalDelay(d => d - 5)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <Minus size={14} />
          </button>

          <span
            className={`text-sm font-bold tabular-nums w-16 text-center ${
              globalDelay > 0 ? 'text-[#fb923c]' : globalDelay < 0 ? 'text-[#60a5fa]' : 'text-[var(--text-muted)]'
            }`}
          >
            {globalDelay > 0 ? '+' + globalDelay : globalDelay} min
          </span>

          <button
            onClick={() => setGlobalDelay(d => d + 5)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
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
            <button
              onClick={() => setGlobalDelay(0)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-2xl">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium text-[var(--text-secondary)]">No games scheduled</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
                  <Clock size={11} /> {group.label}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

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
                    onEdit={() => openEditModal(m)}
                    onTimeChange={async (slotId) => {
                      setSaving(m.id)
                      try {
                        const slot = slots.find(s => s.id === slotId)
                        const venue = venues.find(v => v.id === slot?.venue_id) ?? null

                        const { error } = await supabase
                          .from('matches')
                          .update({
                            time_slot_id: slotId || null,
                            venue_id: slot?.venue_id || null,
                          })
                          .eq('id', m.id)

                        if (error) throw error

                        const nextMatches = matches.map(mx =>
                          mx.id === m.id
                            ? {
                                ...mx,
                                time_slot: slot ?? null,
                                time_slot_id: slotId || null,
                                venue,
                                venue_id: slot?.venue_id || null,
                              }
                            : mx
                        )

                        setMatches(nextMatches)
                        recalculateConflicts(nextMatches, slots)
                        showMessage('Game time updated')
                      } catch (err) {
                        showMessage('Failed to update game time: ' + err.message, 'error')
                      } finally {
                        setSaving(null)
                      }
                    }}
                    onVenueChange={async (venueId) => {
                      setSaving(m.id)
                      try {
                        const venue = venues.find(v => v.id === venueId) ?? null

                        const { error } = await supabase
                          .from('matches')
                          .update({ venue_id: venueId || null })
                          .eq('id', m.id)

                        if (error) throw error

                        const nextMatches = matches.map(mx =>
                          mx.id === m.id
                            ? {
                                ...mx,
                                venue,
                                venue_id: venueId || null,
                              }
                            : mx
                        )

                        setMatches(nextMatches)
                        recalculateConflicts(nextMatches, slots)
                        showMessage('Field updated')
                      } catch (err) {
                        showMessage('Failed to update field: ' + err.message, 'error')
                      } finally {
                        setSaving(null)
                      }
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

      {editingMatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-mid)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              padding: 24,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {editingMatchId === 'new' ? 'Add game' : 'Edit game'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Update matchup, pool, time, field, and round.
                </p>
              </div>

              <button
                onClick={closeEditModal}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="field-group">
                <label className="field-label">Pool</label>
                <select
                  className="field-input"
                  value={editForm.pool_id}
                  onChange={e => handleEditFormChange('pool_id', e.target.value)}
                >
                  <option value="">No pool</option>
                  {editablePools.map(pool => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field-group">
                  <label className="field-label">Team A</label>
                  <select
                    className="field-input"
                    value={editForm.team_a_id}
                    onChange={e => handleEditFormChange('team_a_id', e.target.value)}
                  >
                    <option value="">Select team</option>
                    {editableTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.short_name ?? team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label">Team B</label>
                  <select
                    className="field-input"
                    value={editForm.team_b_id}
                    onChange={e => handleEditFormChange('team_b_id', e.target.value)}
                  >
                    <option value="">Select team</option>
                    {editableTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.short_name ?? team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Time slot</label>
                <select
                  className="field-input"
                  value={editForm.time_slot_id}
                  onChange={e => handleEditFormChange('time_slot_id', e.target.value)}
                >
                  <option value="">No time</option>
                  {slots.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {formatTime(slot.scheduled_start)}
                      {slot.venue ? ` • ${slot.venue.short_name ?? slot.venue.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field-group">
                  <label className="field-label">Field</label>
                  <select
                    className="field-input"
                    value={editForm.venue_id}
                    onChange={e => handleEditFormChange('venue_id', e.target.value)}
                    disabled={!!editForm.time_slot_id}
                  >
                    <option value="">No field</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.short_name ?? v.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {editForm.time_slot_id
                      ? 'Field is taken from the selected time slot.'
                      : 'Choose a field if no time slot is assigned.'}
                  </p>
                </div>

                <div className="field-group">
                  <label className="field-label">Round</label>
                  <input
                    type="number"
                    min={1}
                    className="field-input"
                    value={editForm.round}
                    onChange={e => handleEditFormChange('round', e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 text-xs">
                Schedule warnings update live after save. Archived games are hidden from this editor.
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 gap-3">
              {editingMatchId !== 'new' ? (
                <button
                  onClick={handleCancelMatch}
                  className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Archive game
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button onClick={closeEditModal} className="btn-secondary btn">
                  Cancel
                </button>
                <button onClick={handleSaveMatchEdit} className="btn-primary btn">
                  {editingMatchId === 'new' ? 'Add game' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchEditorCard({
  match: m,
  slots,
  venues,
  isSaving,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onEdit,
  onTimeChange,
  onVenueChange,
}) {
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
      {canEdit && (
        <GripVertical size={16} className="text-[var(--text-muted)] flex-shrink-0" />
      )}

      {isLive && <span className="live-dot flex-shrink-0" />}
      {isDone && <span className="w-2 h-2 rounded-full bg-[var(--border-mid)] flex-shrink-0" />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TeamDot team={m.team_a} />
          <span className="text-xs text-[var(--text-muted)]">vs</span>
          <TeamDot team={m.team_b} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {m.pool && <span className="text-xs text-[var(--text-muted)]">{m.pool.name}</span>}
          {m.division && <span className="text-xs text-[var(--text-muted)]">{m.division.name}</span>}
          {m.round_label && <span className="text-xs text-[var(--text-muted)]">{m.round_label}</span>}
        </div>
      </div>

      {isDone && (
        <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums flex-shrink-0">
          {m.score_a}-{m.score_b}
        </span>
      )}

      {canEdit ? (
        <select
          className="field-input text-xs flex-shrink-0 max-w-36 py-1"
          value={m.time_slot?.id ?? ''}
          onChange={e => onTimeChange(e.target.value)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">No time</option>
          {slots.map(s => (
            <option key={s.id} value={s.id}>
              {formatTime(s.scheduled_start)}
              {s.offset_minutes ? ' (+' + s.offset_minutes + 'm)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
          {m.time_slot?.scheduled_start ? formatTime(m.time_slot.scheduled_start) : 'TBD'}
        </span>
      )}

      {canEdit ? (
        <select
          className="field-input text-xs flex-shrink-0 max-w-28 py-1"
          value={m.venue?.id ?? ''}
          onChange={e => onVenueChange(e.target.value)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">No field</option>
          {venues.map(v => (
            <option key={v.id} value={v.id}>
              {v.short_name ?? v.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
          <MapPin size={10} /> {m.venue?.short_name ?? m.venue?.name ?? 'TBD'}
        </span>
      )}

      {canEdit && (
        <button
          onClick={e => {
            e.stopPropagation()
            onEdit()
          }}
          className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] hover:border-[var(--border-mid)] flex-shrink-0"
        >
          <Pencil size={12} />
        </button>
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
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: team?.primary_color ?? 'var(--border-mid)' }}
      />
      <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-24">
        {team?.short_name ?? team?.name ?? 'TBD'}
      </span>
    </div>
  )
}

function groupByTime(matches) {
  const groups = {}

  for (const m of matches) {
    const start = m.time_slot?.scheduled_start
    const key = start ? new Date(start).toISOString() : 'unscheduled'
    const label = start ? formatGroupTime(new Date(start)) : 'Unscheduled'

    if (!groups[key]) {
      groups[key] = { key, label, matches: [] }
    }

    groups[key].matches.push(m)
  }

  return Object.values(groups).sort((a, b) => {
    if (a.key === 'unscheduled') return 1
    if (b.key === 'unscheduled') return -1
    return a.key.localeCompare(b.key)
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatGroupTime(d) {
  return d.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}