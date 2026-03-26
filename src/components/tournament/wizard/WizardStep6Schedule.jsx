import { useState, useEffect } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { generateSchedule } from '../../../lib/scheduleGenerator'
import { AlertTriangle, RefreshCw, Calendar, Clock } from 'lucide-react'

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

  // Pre-fill start/end time from tournament start date if not already set
  useEffect(() => {
    if (!scheduleConfig.startTime && startDate) {
      setScheduleConfig({
        startTime: startDate + 'T09:00',
        endTime:   startDate + 'T18:00',
      })
    }
  }, [startDate])

  function handleGenerate() {
    // Read fresh from store to avoid stale closures
    const s = useWizardStore.getState()
    const liveVenues  = s.venues
    const livePools   = s.pools
    const liveTeams   = s.teams
    const liveAssign  = s.poolAssignments
    const liveConfig  = s.scheduleConfig
    const liveStart   = liveConfig.startTime || (s.startDate ? s.startDate + 'T09:00' : null)

    console.log('[Step6] generate', {
      venues: liveVenues.length,
      pools:  livePools.length,
      teams:  liveTeams.length,
      startTime: liveStart,
      poolAssignments: liveAssign,
    })

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

      console.log('[Step6] allPools', allPools.map(p => ({ name: p.name, teams: p.teams.length })))
    console.log('[Step6] livePools raw', livePools.map(p => ({ id: p.id, name: p.name, divisionId: p.divisionId })))
    console.log('[Step6] liveAssign', liveAssign)
    console.log('[Step6] liveTeams sample', liveTeams.slice(0,3).map(t => ({ id: t.id, name: t.name, divisionId: t.divisionId })))

    if (allPools.length === 0) {
      setFormError('No pools found. Go back to Step 5 and use "Auto-generate pools" to assign teams to pools before scheduling.')
      setGenerating(false)
      return
    }

    const teamsWithPools = allPools.reduce((sum, p) => sum + p.teams.length, 0)
    if (teamsWithPools === 0) {
      setFormError('Teams are not assigned to pools. Go back to Step 5, click "Auto-generate pools", then return here.')
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

      console.log('[Step6] result', { slots: result.slots.length, matches: result.matches.length, conflicts: result.conflicts.length })
      setGeneratedSchedule(result)
    } catch (err) {
      console.error('[Step6] generate error', err)
      setFormError(err.message || 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  async function handleNext() {
    if (!tournamentId) { onNext(); return }
    if (generatedMatches.length === 0) { onNext(); return } // skip if no schedule yet

    setSaving(true)
    try {
      // Clear existing slots + matches for this tournament (regenerate)
      await db.matches.deleteByTournament(tournamentId)
      await db.timeSlots.deleteByTournament(tournamentId)

      // Build lookup maps from local UUID -> DB id for teams, pools, venues
      // Re-fetch from DB to guarantee we have real IDs regardless of store state
      const { data: dbTeams }  = await db.teams.byTournament(tournamentId)
      const { data: dbVenues } = await db.venues.byTournament(tournamentId)

      // Map local store id -> db id for teams (match by name+division as fallback)
      const freshState = useWizardStore.getState()
      const teamDbIdMap = {}
      for (const localTeam of freshState.teams) {
        if (localTeam.dbId) {
          teamDbIdMap[localTeam.id] = localTeam.dbId
        } else {
          // Match by name against DB teams
          const match = (dbTeams ?? []).find(dt => dt.name === localTeam.name)
          if (match) teamDbIdMap[localTeam.id] = match.id
        }
        // Also map dbId -> dbId so generator-produced IDs work
        if (localTeam.dbId) teamDbIdMap[localTeam.dbId] = localTeam.dbId
      }

      // Map local venue id -> db id
      const venueDbIdMap = {}
      for (const localVenue of freshState.venues) {
        if (localVenue.dbId) {
          venueDbIdMap[localVenue.id] = localVenue.dbId
          venueDbIdMap[localVenue.dbId] = localVenue.dbId
        } else {
          const match = (dbVenues ?? []).find(dv => dv.qr_slug === localVenue.qrSlug)
          if (match) venueDbIdMap[localVenue.id] = match.id
        }
      }

      // Map local pool id -> db id
      const poolDbIdMap = {}
      for (const localPool of freshState.pools) {
        if (localPool.dbId) {
          poolDbIdMap[localPool.id] = localPool.dbId
          poolDbIdMap[localPool.dbId] = localPool.dbId
        }
      }

      // Map local division id -> db id
      const divDbIdMap = {}
      for (const localDiv of freshState.divisions) {
        if (localDiv.dbId) {
          divDbIdMap[localDiv.id] = localDiv.dbId
          divDbIdMap[localDiv.dbId] = localDiv.dbId
        }
      }

      console.log('[Step6 save] teamDbIdMap', teamDbIdMap)
      console.log('[Step6 save] venueDbIdMap', venueDbIdMap)

      // Insert slots
      const slotRows = generatedSlots.map(s => ({
        tournament_id:   tournamentId,
        venue_id:        venueDbIdMap[s.venue_id] || null,
        scheduled_start: s.scheduled_start,
        scheduled_end:   s.scheduled_end,
        offset_minutes:  0,
      }))
      const { data: slotData } = await db.timeSlots.createMany(slotRows)
      const slotIdMap = {}
      generatedSlots.forEach((s, i) => { slotIdMap[s.id] = slotData?.[i]?.id })

      // Find division for a match via its pool
      function getDivDbId(poolLocalId) {
        const pool = freshState.pools.find(p => p.id === poolLocalId || p.dbId === poolLocalId)
        if (!pool) return null
        const div = freshState.divisions.find(d => d.id === pool.divisionId)
        return div?.dbId ?? null
      }

      // Insert matches
      const matchRows = generatedMatches.map(m => ({
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

      console.log('[Step6 save] sample matchRow', matchRows[0])
      await db.matches.createMany(matchRows)

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const errorConflicts   = scheduleConflicts.filter(c => c.severity === 'error')
  const warningConflicts = scheduleConflicts.filter(c => c.severity === 'warning')
  const totalTeams       = teams.length
  const totalMatches     = generatedMatches.length

  // Build default start time from tournament start date
  const defaultStartTime = startDate ? `${startDate}T09:00` : ''
  const defaultEndTime   = startDate ? `${startDate}T18:00` : ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Schedule</h2>
        <p className="section-subtitle">Configure the day's timing and auto-generate the schedule. You can drag to adjust after.</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
      )}

      {/* Time config */}
      <div className="grid grid-cols-2 gap-4">
        <div className="field-group">
          <label className="field-label flex items-center gap-1"><Clock size={13} /> Day start *</label>
          <input
            type="datetime-local"
            className="field-input"
            value={scheduleConfig.startTime ?? ''}
            onChange={e => setScheduleConfig({ startTime: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label className="field-label flex items-center gap-1"><Clock size={13} /> Day end</label>
          <input
            type="datetime-local"
            className="field-input"
            value={scheduleConfig.endTime ?? ''}
            onChange={e => setScheduleConfig({ endTime: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Game duration (min)</label>
          <input
            type="number" min={20} max={180} step={5}
            className="field-input"
            value={scheduleConfig.gameDurationMinutes}
            onChange={e => setScheduleConfig({ gameDurationMinutes: Number(e.target.value) })}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Break between games (min)</label>
          <input
            type="number" min={0} max={60} step={5}
            className="field-input"
            value={scheduleConfig.breakBetweenGamesMinutes}
            onChange={e => setScheduleConfig({ breakBetweenGamesMinutes: Number(e.target.value) })}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Min rest between team games (min)</label>
          <input
            type="number" min={30} max={240} step={15}
            className="field-input"
            value={scheduleConfig.minRestBetweenTeamGames}
            onChange={e => setScheduleConfig({ minRestBetweenTeamGames: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Lunch break */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={!!scheduleConfig.lunchBreakStart}
            onChange={e => setScheduleConfig({
              lunchBreakStart: e.target.checked ? (startDate ? `${startDate}T12:00` : '') : null,
              lunchBreakEnd:   e.target.checked ? (startDate ? `${startDate}T13:00` : '') : null,
            })}
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">Lunch break</span>
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || (!scheduleConfig.startTime && !startDate)}
          className="btn-primary btn"
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          {generatedMatches.length > 0 ? 'Regenerate' : 'Generate schedule'}
        </button>

        {totalTeams === 0 && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <AlertTriangle size={14} /> No teams assigned to pools yet
          </p>
        )}
      </div>

      {/* Generated summary */}
      {generatedMatches.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalMatches}</p>
              <p className="text-xs text-blue-600 mt-0.5">Total games</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{generatedSlots.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Time slots</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${errorConflicts.length > 0 ? 'bg-red-50' : warningConflicts.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <p className={`text-2xl font-bold ${errorConflicts.length > 0 ? 'text-red-700' : warningConflicts.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                {scheduleConflicts.length}
              </p>
              <p className={`text-xs mt-0.5 ${errorConflicts.length > 0 ? 'text-red-600' : warningConflicts.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {scheduleConflicts.length === 0 ? 'No conflicts' : 'Conflicts'}
              </p>
            </div>
          </div>

          {/* Conflict list */}
          {scheduleConflicts.length > 0 && (
            <div className="space-y-2">
              {scheduleConflicts.slice(0, 5).map((c, i) => (
                <div key={i} className={`flex gap-2 p-2 rounded-lg text-xs ${
                  c.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  {c.message}
                </div>
              ))}
              {scheduleConflicts.length > 5 && (
                <p className="text-xs text-gray-400 ml-5">+{scheduleConflicts.length - 5} more (review in next step)</p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar size={12} />
            Fine-tune the schedule in the Schedule Editor after publishing.
          </p>
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
      />
    </div>
  )
}
