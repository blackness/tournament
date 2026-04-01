import { useState, useEffect } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { generateSchedule } from '../../../lib/scheduleGenerator'
import { AlertTriangle, RefreshCw, Calendar, Clock, GripVertical, MapPin } from 'lucide-react'

export function WizardStep6Schedule({ onNext, onBack }) {
  const {
    divisions, venues, teams, pools, poolAssignments,
    scheduleConfig, setScheduleConfig,
    setGeneratedSchedule, generatedMatches, generatedSlots, scheduleConflicts,
    tournamentId, startDate,
  } = useWizardStore()

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState(null)
  const [localMatches, setLocalMatches] = useState([]) // editable copy
  const [localSlots, setLocalSlots]     = useState([])
  const [dragging, setDragging]         = useState(null)
  const [confirmRegen, setConfirmRegen]   = useState(false)
  const [dragOver, setDragOver]         = useState(null)

  // Pre-fill start/end time from tournament start date
  useEffect(() => {
    if (!scheduleConfig.startTime && startDate) {
      setScheduleConfig({
        startTime: startDate + 'T09:00',
        endTime:   startDate + 'T18:00',
      })
    }
  }, [startDate])

  // Sync local editable copy when generated schedule changes
  useEffect(() => {
    if (generatedMatches.length > 0) {
      setLocalMatches([...generatedMatches])
      setLocalSlots([...generatedSlots])
    }
  }, [generatedMatches, generatedSlots])

  function handleGenerate() {
    // If matches exist, confirm before regenerating
    if (localMatches.length > 0) {
      setConfirmRegen(true)
      return
    }
    doGenerate()
  }

  function doGenerate() {
    const s = useWizardStore.getState()
    const liveVenues  = s.venues
    const livePools   = s.pools
    const liveTeams   = s.teams
    const liveAssign  = s.poolAssignments
    const liveConfig  = s.scheduleConfig
    const liveStart   = liveConfig.startTime || (s.startDate ? s.startDate + 'T09:00' : null)

    if (!liveStart) { setFormError('Set a start time first'); return }
    if (liveVenues.length === 0) { setFormError('No venues found. Go back to Step 4 and add fields.'); return }

    setGenerating(true)
    setFormError(null)

    try {
      const allPools = divisions.flatMap(div =>
        livePools
          .filter(p => p.divisionId === div.id)
          .map(p => ({
            ...p,
            teams: liveTeams
              .filter(t => liveAssign[t.id] === p.id)
              .map(t => ({ id: t.dbId || t.id, name: t.name })),
          }))
      )

      if (allPools.length === 0) {
        setFormError('No pools found. Go back to Step 5 and assign teams to pools.')
        setGenerating(false)
        return
      }
      const teamsWithPools = allPools.reduce((sum, p) => sum + p.teams.length, 0)
      if (teamsWithPools === 0) {
        setFormError('Teams are not assigned to pools. Go back to Step 5.')
        setGenerating(false)
        return
      }

      const venueList = liveVenues.map(v => ({ id: v.dbId || v.id, name: v.name, qrSlug: v.qrSlug }))

      const result = generateSchedule({
        pools:    allPools,
        venues:   venueList,
        startTime: liveStart,
        endTime:   liveConfig.endTime || (s.startDate ? s.startDate + 'T18:00' : null),
        lunchBreakStart:          liveConfig.lunchBreakStart,
        lunchBreakEnd:            liveConfig.lunchBreakEnd,
        gameDurationMinutes:      liveConfig.gameDurationMinutes,
        breakBetweenGamesMinutes: liveConfig.breakBetweenGamesMinutes,
        minRestBetweenTeamGames:  liveConfig.minRestBetweenTeamGames,
        tournamentId,
      })

      setGeneratedSchedule(result)
      setLocalMatches([...result.matches])
      setLocalSlots([...result.slots])
    } catch (err) {
      setFormError(err.message || 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  // Drag swap -- swap slot_id and venue_id between two matches
  function handleDragStart(matchId) { setDragging(matchId) }
  function handleDragOver(e, matchId) { e.preventDefault(); setDragOver(matchId) }
  function handleDragLeave() { setDragOver(null) }
  function handleDrop(targetMatchId) {
    setDragOver(null)
    if (!dragging || dragging === targetMatchId) { setDragging(null); return }
    setLocalMatches(prev => {
      const next = [...prev]
      const a = next.find(m => m.id === dragging)
      const b = next.find(m => m.id === targetMatchId)
      if (!a || !b) return prev
      // Swap slots and venues
      const tmp = { slot_id: a.slot_id, venue_id: a.venue_id }
      a.slot_id = b.slot_id; a.venue_id = b.venue_id
      b.slot_id = tmp.slot_id; b.venue_id = tmp.venue_id
      return next
    })
    setDragging(null)
  }

  function handleVenueChange(matchId, newVenueId) {
    const s = useWizardStore.getState()
    const venue = s.venues.find(v => (v.dbId || v.id) === newVenueId)
    setLocalMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, venue_id: newVenueId } : m
    ))
  }

  async function handleNext() {
    if (!tournamentId) { onNext(); return }
    if (localMatches.length === 0) { onNext(); return }

    setSaving(true)
    try {
      await db.matches.deleteByTournament(tournamentId)
      await db.timeSlots.deleteByTournament(tournamentId)

      const freshState = useWizardStore.getState()
      const { data: dbTeams }  = await db.teams.byTournament(tournamentId)
      const { data: dbVenues } = await db.venues.byTournament(tournamentId)

      const teamDbIdMap = {}
      for (const t of freshState.teams) {
        if (t.dbId) { teamDbIdMap[t.id] = t.dbId; teamDbIdMap[t.dbId] = t.dbId }
        else {
          const match = (dbTeams ?? []).find(dt => dt.name === t.name)
          if (match) teamDbIdMap[t.id] = match.id
        }
      }
      const venueDbIdMap = {}
      for (const v of freshState.venues) {
        if (v.dbId) { venueDbIdMap[v.id] = v.dbId; venueDbIdMap[v.dbId] = v.dbId }
        else {
          const match = (dbVenues ?? []).find(dv => dv.qr_slug === v.qrSlug)
          if (match) venueDbIdMap[v.id] = match.id
        }
      }
      const poolDbIdMap = {}
      for (const p of freshState.pools) {
        if (p.dbId) { poolDbIdMap[p.id] = p.dbId; poolDbIdMap[p.dbId] = p.dbId }
      }

      function getDivDbId(poolLocalId) {
        const pool = freshState.pools.find(p => p.id === poolLocalId || p.dbId === poolLocalId)
        if (!pool) return null
        const div = freshState.divisions.find(d => d.id === pool.divisionId)
        return div?.dbId ?? null
      }

      // Save slots (use localSlots, which may include slots from swapped matches)
      const usedSlotIds = new Set(localMatches.map(m => m.slot_id).filter(Boolean))
      const slotsToSave = localSlots.filter(s => usedSlotIds.has(s.id))

      const slotRows = slotsToSave.map(s => ({
        tournament_id:   tournamentId,
        venue_id:        venueDbIdMap[s.venue_id] || null,
        scheduled_start: s.scheduled_start,
        scheduled_end:   s.scheduled_end,
        offset_minutes:  0,
      }))
      const { data: slotData } = await db.timeSlots.createMany(slotRows)
      const slotIdMap = {}
      slotsToSave.forEach((s, i) => { slotIdMap[s.id] = slotData?.[i]?.id })

      // Save matches using localMatches (with any drag edits applied)
      const matchRows = localMatches.map(m => ({
        tournament_id: tournamentId,
        division_id:   getDivDbId(m.pool_id),
        pool_id:       poolDbIdMap[m.pool_id] || null,
        team_a_id:     teamDbIdMap[m.team_a_id] || null,
        team_b_id:     teamDbIdMap[m.team_b_id] || null,
        time_slot_id:  slotIdMap[m.slot_id] || null,
        venue_id:      venueDbIdMap[m.venue_id] || null,
        round:         m.round,
        match_number:  m.match_number,
        phase:         1,
        status:        'scheduled',
      }))
      await db.matches.createMany(matchRows)

      // Initialize pool_standings rows for all pool-assigned teams
      // Safe to run multiple times -- ON CONFLICT DO NOTHING
      const { data: poolTeams } = await supabase
        .from('tournament_teams')
        .select('id, pool_id')
        .eq('tournament_id', tournamentId)
        .not('pool_id', 'is', null)

      if (poolTeams && poolTeams.length > 0) {
        const standingRows = poolTeams.map(t => ({
          pool_id: t.pool_id,
          team_id: t.id,
        }))
        await supabase.from('pool_standings').upsert(standingRows, { onConflict: 'pool_id,team_id', ignoreDuplicates: true })
      }

      freshState.markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  // Build lookup maps for display
  const venueMap = Object.fromEntries(
    (useWizardStore.getState().venues ?? []).map(v => [v.dbId || v.id, v])
  )
  const teamMap  = Object.fromEntries(
    (useWizardStore.getState().teams ?? []).map(t => [t.dbId || t.id, t])
  )
  const poolMap  = Object.fromEntries(
    (useWizardStore.getState().pools ?? []).map(p => [p.dbId || p.id, p])
  )
  const slotMap  = Object.fromEntries(localSlots.map(s => [s.id, s]))

  const errorConflicts   = scheduleConflicts.filter(c => c.severity === 'error')
  const warningConflicts = scheduleConflicts.filter(c => c.severity === 'warning')
  const hasSchedule      = localMatches.length > 0

  // Group localMatches by time slot start for display
  const byTime = {}
  for (const m of localMatches) {
    const slot = slotMap[m.slot_id]
    const key  = slot ? slot.scheduled_start : 'unscheduled'
    if (!byTime[key]) byTime[key] = []
    byTime[key].push(m)
  }
  const timeGroups = Object.entries(byTime).sort(([a], [b]) => {
    if (a === 'unscheduled') return 1
    if (b === 'unscheduled') return -1
    return a.localeCompare(b)
  })

  const allVenues = useWizardStore.getState().venues ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Schedule</h2>
        <p className="section-subtitle">Configure timing, generate the schedule, then drag games to adjust before saving.</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {formError}
        </div>
      )}

      {/* Time config */}
      <div className="grid grid-cols-2 gap-4">
        <div className="field-group">
          <label className="field-label flex items-center gap-1"><Clock size={13} /> Day start *</label>
          <input type="datetime-local" className="field-input"
            value={scheduleConfig.startTime ?? ''}
            onChange={e => setScheduleConfig({ startTime: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label flex items-center gap-1"><Clock size={13} /> Day end</label>
          <input type="datetime-local" className="field-input"
            value={scheduleConfig.endTime ?? ''}
            onChange={e => setScheduleConfig({ endTime: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label">Game duration (min)</label>
          <input type="number" min={20} max={180} step={5} className="field-input"
            value={scheduleConfig.gameDurationMinutes}
            onChange={e => setScheduleConfig({ gameDurationMinutes: Number(e.target.value) })} />
        </div>
        <div className="field-group">
          <label className="field-label">Break between games (min)</label>
          <input type="number" min={0} max={60} step={5} className="field-input"
            value={scheduleConfig.breakBetweenGamesMinutes}
            onChange={e => setScheduleConfig({ breakBetweenGamesMinutes: Number(e.target.value) })} />
        </div>
        <div className="field-group col-span-2">
          <label className="field-label">Min rest between team games (min)</label>
          <input type="number" min={30} max={240} step={15} className="field-input"
            value={scheduleConfig.minRestBetweenTeamGames}
            onChange={e => setScheduleConfig({ minRestBetweenTeamGames: Number(e.target.value) })} />
        </div>
      </div>

      {/* Lunch break */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox"
            checked={!!scheduleConfig.lunchBreakStart}
            onChange={e => setScheduleConfig({
              lunchBreakStart: e.target.checked ? (startDate ? startDate + 'T12:00' : '') : null,
              lunchBreakEnd:   e.target.checked ? (startDate ? startDate + 'T13:00' : '') : null,
            })}
            className="rounded border-[var(--border)] text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Lunch break</span>
        </label>
        {scheduleConfig.lunchBreakStart && (
          <div className="grid grid-cols-2 gap-4 ml-6">
            <div className="field-group">
              <label className="field-label text-xs">Break start</label>
              <input type="datetime-local" className="field-input text-sm"
                value={scheduleConfig.lunchBreakStart ?? ''}
                onChange={e => setScheduleConfig({ lunchBreakStart: e.target.value })} />
            </div>
            <div className="field-group">
              <label className="field-label text-xs">Break end</label>
              <input type="datetime-local" className="field-input text-sm"
                value={scheduleConfig.lunchBreakEnd ?? ''}
                onChange={e => setScheduleConfig({ lunchBreakEnd: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <div className="divider" />

      {/* Generate button */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleGenerate} disabled={generating}
          className="btn-primary btn">
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          {hasSchedule ? 'Regenerate' : 'Generate schedule'}
        </button>
        {hasSchedule && (
          <span className="text-sm text-[var(--text-muted)]">
            {localMatches.length} games across {allVenues.length} field{allVenues.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Conflict summary */}
      {scheduleConflicts.length > 0 && (
        <div className="space-y-1.5">
          {scheduleConflicts.slice(0, 3).map((c, i) => (
            <div key={i} className={'flex gap-2 p-2 rounded-lg text-xs ' + (
              c.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
            )}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {c.message}
            </div>
          ))}
          {scheduleConflicts.length > 3 && (
            <p className="text-xs text-[var(--text-muted)] ml-5">+{scheduleConflicts.length - 3} more conflicts</p>
          )}
        </div>
      )}

      {/* Schedule preview -- editable */}
      {hasSchedule && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Schedule preview</h3>
            <p className="text-xs text-[var(--text-muted)]">Drag rows to swap game times</p>
          </div>

          {timeGroups.map(([timeKey, groupMatches]) => {
            const slot = timeKey !== 'unscheduled' ? Object.values(slotMap).find(s => s.scheduled_start === timeKey) : null
            return (
              <div key={timeKey}>
                {/* Time block header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    {timeKey === 'unscheduled' ? 'Unscheduled' : formatTime(timeKey)}
                  </span>
                  <div className="flex-1 h-px " />
                  <span className="text-xs text-[var(--text-muted)]">{groupMatches.length} game{groupMatches.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Match rows */}
                <div className="space-y-1.5">
                  {groupMatches.map(m => {
                    const teamA  = teamMap[m.team_a_id]
                    const teamB  = teamMap[m.team_b_id]
                    const pool   = poolMap[m.pool_id]
                    const venue  = venueMap[m.venue_id]
                    const isDragOver = dragOver === m.id

                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={() => handleDragStart(m.id)}
                        onDragOver={e => handleDragOver(e, m.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(m.id)}
                        className={'flex items-center gap-2 px-3 py-2 bg-[var(--bg-raised)] border rounded-xl cursor-grab active:cursor-grabbing select-none transition-all ' + (
                          isDragOver ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] hover:border-[var(--border-mid)]'
                        )}
                      >
                        <GripVertical size={14} className="text-[var(--text-muted)] flex-shrink-0" />

                        {/* Teams */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: teamA?.primaryColor ?? '#e5e7eb' }} />
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {teamA?.shortName ?? teamA?.name ?? 'TBD'}
                            </span>
                            <span className="text-[var(--text-muted)] text-xs">vs</span>
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: teamB?.primaryColor ?? '#e5e7eb' }} />
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {teamB?.shortName ?? teamB?.name ?? 'TBD'}
                            </span>
                          </div>
                          {pool && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{pool.name}</p>
                          )}
                        </div>

                        {/* Venue selector */}
                        {allVenues.length > 1 ? (
                          <select
                            className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] flex-shrink-0 max-w-28"
                            value={m.venue_id ?? ''}
                            onChange={e => handleVenueChange(m.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                          >
                            {allVenues.map(v => (
                              <option key={v.dbId || v.id} value={v.dbId || v.id}>
                                {v.shortName ?? v.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          venue && (
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
                              <MapPin size={10} /> {venue.shortName ?? venue.name}
                            </span>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm regenerate */}
      {confirmRegen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
          <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:16, width:'100%', maxWidth:400, padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(234,179,8,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <RefreshCw size={18} style={{ color:'#fde047' }} />
              </div>
              <div>
                <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Regenerate schedule?</h2>
                <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{localMatches.length} existing games will be replaced.</p>
              </div>
            </div>
            <div style={{ padding:'12px 14px', background:'var(--bg-hover)', borderRadius:10, marginBottom:16, fontSize:13, color:'var(--text-secondary)' }}>
              Only regenerate if no games have been scored yet. Completed games cannot be recovered.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmRegen(false)}
                style={{ flex:1, padding:'9px', fontSize:13, fontWeight:600, background:'transparent', border:'1px solid var(--border-mid)', borderRadius:9, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
                Cancel
              </button>
              <button onClick={() => { setConfirmRegen(false); doGenerate() }}
                style={{ flex:1, padding:'9px', fontSize:13, fontWeight:600, background:'rgba(234,179,8,0.15)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:9, cursor:'pointer', color:'#fde047', fontFamily:'inherit' }}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextLabel={hasSchedule ? 'Save schedule & continue' : 'Skip schedule'}
      />
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
