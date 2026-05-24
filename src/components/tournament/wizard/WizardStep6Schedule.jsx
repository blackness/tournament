import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { generateSchedule } from '../../../lib/scheduleGenerator'
import { AlertTriangle, RefreshCw, Clock, MapPin, ExternalLink } from 'lucide-react'

export function WizardStep6Schedule({ onNext, onBack }) {
  const {
    divisions,
    venues,
    teams,
    pools,
    poolAssignments,
    scheduleConfig,
    setScheduleConfig,
    setGeneratedSchedule,
    generatedMatches,
    generatedSlots,
    scheduleConflicts,
    tournamentId,
    startDate,
  } = useWizardStore()

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [existingScheduleCount, setExistingScheduleCount] = useState(0)
  const [formError, setFormError] = useState(null)
  const [tournamentDays, setTournamentDays] = useState([])
  const [loadingTournamentDays, setLoadingTournamentDays] = useState(false)

  function toLocalInputFormat(val) {
    if (!val) return ''
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) return val
    return val.slice(0, 16)
  }

  const hasTournamentDays = tournamentDays.length > 0

  function formatDayLabel(day) {
    const date = new Date(day.event_date + 'T12:00')
    const dateLabel = date.toLocaleDateString('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    const timeLabel = new Date(`${day.event_date}T${day.start_time}`)
      .toLocaleTimeString('en-CA', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .replace(' AM', 'am')
      .replace(' PM', 'pm')

    return `Day ${day.day_index} · ${dateLabel} · Starts ${timeLabel}`
  }

  useEffect(() => {
    if (!scheduleConfig.startTime && startDate) {
      setScheduleConfig({
        startTime: startDate + 'T09:00',
        endTime: startDate + 'T18:00',
      })
    } else if (scheduleConfig.startTime && scheduleConfig.startTime.length > 16) {
      setScheduleConfig({
        startTime: toLocalInputFormat(scheduleConfig.startTime),
        endTime: toLocalInputFormat(scheduleConfig.endTime),
        lunchBreakStart: toLocalInputFormat(scheduleConfig.lunchBreakStart),
        lunchBreakEnd: toLocalInputFormat(scheduleConfig.lunchBreakEnd),
      })
    }
  }, [startDate])

  useEffect(() => {
    let active = true

    async function loadTournamentDays() {
      if (!tournamentId) {
        if (active) setTournamentDays([])
        return
      }

      setLoadingTournamentDays(true)

      const { data, error } = await supabase
        .from('tournament_days')
        .select('id, day_index, event_date, start_time')
        .eq('tournament_id', tournamentId)
        .order('day_index')

      if (!active) return

      if (error) {
        setTournamentDays([])
      } else {
        setTournamentDays(data ?? [])
      }

      setLoadingTournamentDays(false)
    }

    loadTournamentDays()
    return () => {
      active = false
    }
  }, [tournamentId])

  useEffect(() => {
    let active = true

    async function checkExistingSchedule() {
      if (!tournamentId) {
        if (active) {
          setExistingScheduleCount(0)
          setCheckingExisting(false)
        }
        return
      }

      setCheckingExisting(true)

      const { data, error } = await db.matches.byTournament(tournamentId)

      if (!active) return

      if (error) {
        setExistingScheduleCount(0)
      } else {
        setExistingScheduleCount((data ?? []).length)
      }

      setCheckingExisting(false)
    }

    checkExistingSchedule()
    return () => {
      active = false
    }
  }, [tournamentId])

  async function doGenerate() {
    const s = useWizardStore.getState()
    const liveVenues = s.venues
    const livePools = s.pools
    const liveTeams = s.teams
    const liveAssign = s.poolAssignments
    const liveConfig = s.scheduleConfig
    const liveStart = liveConfig.startTime || (s.startDate ? s.startDate + 'T09:00' : null)

    if (!liveStart && !hasTournamentDays) {
      setFormError('Set a start time first')
      return
    }

    if (liveVenues.length === 0) {
      setFormError('No venues found. Go back to Step 4 and add fields.')
      return
    }

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

      const venueList = liveVenues.map(v => ({
        id: v.dbId || v.id,
        name: v.name,
        qrSlug: v.qrSlug,
      }))

      const scheduleDays = (tournamentDays ?? []).map(day => {
        const start = new Date(`${day.event_date}T${day.start_time}`)

        return {
          eventDate: day.event_date,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 10 * 60 * 60 * 1000).toISOString(),
          lunchBreakStart: null,
          lunchBreakEnd: null,
        }
      })

      const result = generateSchedule({
        pools: allPools,
        venues: venueList,
        scheduleDays,
        startTime: scheduleDays.length === 0 ? liveStart : null,
        endTime:
          scheduleDays.length === 0
            ? (liveConfig.endTime || (s.startDate ? s.startDate + 'T18:00' : null))
            : null,
        lunchBreakStart: scheduleDays.length === 0 ? liveConfig.lunchBreakStart : null,
        lunchBreakEnd: scheduleDays.length === 0 ? liveConfig.lunchBreakEnd : null,
        gameDurationMinutes: liveConfig.gameDurationMinutes,
        breakBetweenGamesMinutes: liveConfig.breakBetweenGamesMinutes,
        minRestBetweenTeamGames: liveConfig.minRestBetweenTeamGames,
        tournamentId,
      })

      setGeneratedSchedule(result)
    } catch (err) {
      setFormError(err.message || 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  async function handleNext() {
    if (!tournamentId) {
      onNext()
      return
    }

    if (generatedMatches.length === 0) {
      onNext()
      return
    }

    setSaving(true)

    try {
      const { error: deleteMatchesErr } = await db.matches.deleteByTournament(tournamentId)
      if (deleteMatchesErr) {
        throw new Error('Failed to delete existing matches: ' + deleteMatchesErr.message)
      }

      const { error: deleteSlotsErr } = await db.timeSlots.deleteByTournament(tournamentId)
      if (deleteSlotsErr) {
        throw new Error('Failed to delete existing time slots: ' + deleteSlotsErr.message)
      }

      const freshState = useWizardStore.getState()
      const nextFormatConfig = {
        schedule: {
          startTime: freshState.scheduleConfig.startTime ?? null,
          endTime: freshState.scheduleConfig.endTime ?? null,
          lunchBreakStart: freshState.scheduleConfig.lunchBreakStart ?? null,
          lunchBreakEnd: freshState.scheduleConfig.lunchBreakEnd ?? null,
          gameDurationMinutes: freshState.scheduleConfig.gameDurationMinutes ?? null,
          breakBetweenGamesMinutes: freshState.scheduleConfig.breakBetweenGamesMinutes ?? null,
          minRestBetweenTeamGames: freshState.scheduleConfig.minRestBetweenTeamGames ?? 0,
        },
      }

      const { error: tournamentUpdateErr } = await db.tournaments.update(tournamentId, {
        format_config: nextFormatConfig,
      })

      if (tournamentUpdateErr) {
        throw new Error('Failed to save tournament schedule settings: ' + tournamentUpdateErr.message)
      }

      const { data: dbTeams } = await db.teams.byTournament(tournamentId)
      const { data: dbVenues } = await db.venues.byTournament(tournamentId)

      const teamDbIdMap = {}
      for (const t of freshState.teams) {
        if (t.dbId) {
          teamDbIdMap[t.id] = t.dbId
          teamDbIdMap[t.dbId] = t.dbId
        } else {
          const match = (dbTeams ?? []).find(dt => dt.name === t.name)
          if (match) teamDbIdMap[t.id] = match.id
        }
      }

      const venueDbIdMap = {}
      for (const v of freshState.venues) {
        if (v.dbId) {
          venueDbIdMap[v.id] = v.dbId
          venueDbIdMap[v.dbId] = v.dbId
        } else {
          const match = (dbVenues ?? []).find(dv => dv.qr_slug === v.qrSlug)
          if (match) venueDbIdMap[v.id] = match.id
        }
      }

      const poolDbIdMap = {}
      for (const p of freshState.pools) {
        if (p.dbId) {
          poolDbIdMap[p.id] = p.dbId
          poolDbIdMap[p.dbId] = p.dbId
        }
      }

      const { data: dbDivisions } = await db.divisions.byTournament(tournamentId)
      const divisionDbIdMap = {}

      for (const dbDiv of dbDivisions ?? []) {
        divisionDbIdMap[dbDiv.id] = dbDiv.id
        const storeDiv = freshState.divisions.find(
          d => d.dbId === dbDiv.id || d.slug === dbDiv.slug || d.name === dbDiv.name
        )
        if (storeDiv) divisionDbIdMap[storeDiv.id] = dbDiv.id
      }

      const { data: dbPools } = await supabase
        .from('pools')
        .select('id, division_id, name')
        .in('division_id', (dbDivisions ?? []).map(d => d.id))

      for (const dbPool of dbPools ?? []) {
        poolDbIdMap[dbPool.id] = dbPool.id
        const storePool = freshState.pools.find(p => p.dbId === dbPool.id || p.name === dbPool.name)
        if (storePool) {
          poolDbIdMap[storePool.id] = dbPool.id
          divisionDbIdMap[storePool.id + '_div'] = dbPool.division_id
        }
      }

      function getDivDbId(poolLocalId) {
        const poolDbId = poolDbIdMap[poolLocalId]
        if (poolDbId) {
          const dbPool = (dbPools ?? []).find(p => p.id === poolDbId)
          if (dbPool) return dbPool.division_id
        }

        const pool = freshState.pools.find(p => p.id === poolLocalId || p.dbId === poolLocalId)
        if (!pool) return null

        return divisionDbIdMap[pool.divisionId] ?? null
      }

      const usedSlotIds = new Set(generatedMatches.map(m => m.slot_id).filter(Boolean))
      const slotsToSave = generatedSlots.filter(s => usedSlotIds.has(s.id))

      const slotRows = slotsToSave.map(s => {
        const venueDbId = venueDbIdMap[s.venue_id] || s.venue_id || null
        return {
          tournament_id: tournamentId,
          venue_id: venueDbId,
          scheduled_start: s.scheduled_start,
          scheduled_end: s.scheduled_end,
          offset_minutes: 0,
        }
      })

      const { error: slotErr } = await db.timeSlots.createMany(slotRows)
      if (slotErr) throw slotErr

      const { data: persistedSlots, error: persistedSlotsErr } = await db.timeSlots.byTournament(tournamentId)
      if (persistedSlotsErr) {
        throw new Error('Failed to reload saved time slots: ' + persistedSlotsErr.message)
      }

      function normalizeIso(val) {
        if (!val) return ''
        return new Date(val).toISOString()
      }

      const dbSlotsByKey = {}
      for (const dbSlot of persistedSlots ?? []) {
        const key = [
          normalizeIso(dbSlot.scheduled_start),
          normalizeIso(dbSlot.scheduled_end),
          dbSlot.venue_id ?? dbSlot.venue?.id ?? '',
        ].join('|')

        dbSlotsByKey[key] = dbSlot.id
      }

      const slotIdMap = {}
      for (const s of slotsToSave) {
        const venueDbId = venueDbIdMap[s.venue_id] || s.venue_id || null
        const key = [
          normalizeIso(s.scheduled_start),
          normalizeIso(s.scheduled_end),
          venueDbId ?? '',
        ].join('|')

        slotIdMap[s.id] = dbSlotsByKey[key] ?? null
      }

      console.log('persistedSlots', persistedSlots)
      console.log('dbSlotsByKey', dbSlotsByKey)
      console.log('slotsToSave', slotsToSave)
      console.log('slotIdMap', slotIdMap)

      const unmappedSlots = Object.entries(slotIdMap).filter(([, value]) => !value)
      if (unmappedSlots.length > 0) {
        throw new Error(`Failed to map ${unmappedSlots.length} saved time slots back to matches.`)
      }

      const matchRows = generatedMatches.map(m => ({
        tournament_id: tournamentId,
        division_id: getDivDbId(m.pool_id),
        pool_id: poolDbIdMap[m.pool_id] || null,
        team_a_id: teamDbIdMap[m.team_a_id] || null,
        team_b_id: teamDbIdMap[m.team_b_id] || null,
        time_slot_id: slotIdMap[m.slot_id] || null,
        venue_id: venueDbIdMap[m.venue_id] || null,
        round: m.round,
        match_number: m.match_number,
        phase: 1,
        status: 'scheduled',
      }))

      const nullDivRows = matchRows.filter(m => !m.division_id)
      if (nullDivRows.length > 0) {
        throw new Error(`division_id is null on ${nullDivRows.length} match rows. Check that pools were saved in Step 5.`)
      }

      const nullSlotRows = matchRows.filter(m => !m.time_slot_id)
      if (nullSlotRows.length > 0) {
        throw new Error(`time_slot_id is null on ${nullSlotRows.length} match rows. Failed to map saved slots.`)
      }

      const { error: matchErr } = await db.matches.createMany(matchRows)
      if (matchErr) {
        throw new Error('Matches insert failed: ' + matchErr.message + ' | code: ' + matchErr.code)
      }

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
        await supabase
          .from('pool_standings')
          .upsert(standingRows, { onConflict: 'pool_id,team_id', ignoreDuplicates: true })
      }

      setExistingScheduleCount(generatedMatches.length)
      freshState.markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const hasGeneratedSchedule = generatedMatches.length > 0
  const hasExistingSchedule = existingScheduleCount > 0
  const allVenues = venues ?? []

  const venueMap = Object.fromEntries(
    allVenues.map(v => [v.dbId || v.id, v])
  )

  const teamMap = Object.fromEntries(
    teams.map(t => [t.dbId || t.id, t])
  )

  const poolMap = Object.fromEntries(
    pools.map(p => [p.dbId || p.id, p])
  )

  const slotMap = Object.fromEntries(
    generatedSlots.map(s => [s.id, s])
  )

  const byTime = {}
  for (const m of generatedMatches) {
    const slot = slotMap[m.slot_id]
    const key = slot ? slot.scheduled_start : 'unscheduled'
    if (!byTime[key]) byTime[key] = []
    byTime[key].push(m)
  }

  const timeGroups = Object.entries(byTime).sort(([a], [b]) => {
    if (a === 'unscheduled') return 1
    if (b === 'unscheduled') return -1
    return a.localeCompare(b)
  })

  const scheduleEditorPath = tournamentId ? `/director/${tournamentId}/schedule` : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Initial Schedule</h2>
        <p className="section-subtitle">
          Generate the initial tournament schedule here. After creation, all schedule changes happen in DirectorHQ.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      {checkingExisting ? (
        <div className="p-3 border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)]">
          Checking existing schedule...
        </div>
      ) : hasExistingSchedule && !hasGeneratedSchedule ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <div>
            <p className="text-sm font-semibold text-blue-900">Schedule already created</p>
            <p className="text-sm text-blue-800 mt-1">
              This tournament already has {existingScheduleCount} scheduled games. Use DirectorHQ Schedule Editor for all further changes.
            </p>
          </div>

          {scheduleEditorPath && (
            <Link
              to={scheduleEditorPath}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Open Schedule Editor
              <ExternalLink size={14} />
            </Link>
          )}
        </div>
      ) : (
        <>
          {hasTournamentDays ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
                  Tournament days
                </p>

                {loadingTournamentDays ? (
                  <p className="text-sm text-[var(--text-muted)]">Loading tournament days…</p>
                ) : tournamentDays.length > 0 ? (
                  <div className="space-y-2">
                    {tournamentDays.map(day => (
                      <div
                        key={day.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2"
                      >
                        <Clock size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                        <span className="text-sm text-[var(--text-primary)]">
                          {formatDayLabel(day)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No tournament days configured.</p>
                )}

                <p className="text-xs text-[var(--text-muted)] mt-3">
                  Day start times are managed from tournament day configuration and used during schedule generation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field-group">
                  <label className="field-label">Game duration (min)</label>
                  <input
                    type="number"
                    min={20}
                    max={180}
                    step={5}
                    className="field-input"
                    value={scheduleConfig.gameDurationMinutes}
                    onChange={e => setScheduleConfig({ gameDurationMinutes: Number(e.target.value) })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Break between games (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={5}
                    className="field-input"
                    value={scheduleConfig.breakBetweenGamesMinutes}
                    onChange={e => setScheduleConfig({ breakBetweenGamesMinutes: Number(e.target.value) })}
                  />
                </div>

                <div className="field-group col-span-2">
                  <label className="field-label">Min rest between team games (min)</label>
                  <input
                    type="number"
                    min={30}
                    max={240}
                    step={15}
                    className="field-input"
                    value={scheduleConfig.minRestBetweenTeamGames}
                    onChange={e => setScheduleConfig({ minRestBetweenTeamGames: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="field-group">
                <label className="field-label flex items-center gap-1">
                  <Clock size={13} />
                  Day start *
                </label>
                <input
                  type="datetime-local"
                  className="field-input"
                  value={toLocalInputFormat(scheduleConfig.startTime)}
                  onChange={e => setScheduleConfig({ startTime: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label flex items-center gap-1">
                  <Clock size={13} />
                  Day end
                </label>
                <input
                  type="datetime-local"
                  className="field-input"
                  value={toLocalInputFormat(scheduleConfig.endTime)}
                  onChange={e => setScheduleConfig({ endTime: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Game duration (min)</label>
                <input
                  type="number"
                  min={20}
                  max={180}
                  step={5}
                  className="field-input"
                  value={scheduleConfig.gameDurationMinutes}
                  onChange={e => setScheduleConfig({ gameDurationMinutes: Number(e.target.value) })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Break between games (min)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  className="field-input"
                  value={scheduleConfig.breakBetweenGamesMinutes}
                  onChange={e => setScheduleConfig({ breakBetweenGamesMinutes: Number(e.target.value) })}
                />
              </div>

              <div className="field-group col-span-2">
                <label className="field-label">Min rest between team games (min)</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  step={15}
                  className="field-input"
                  value={scheduleConfig.minRestBetweenTeamGames}
                  onChange={e => setScheduleConfig({ minRestBetweenTeamGames: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {!hasTournamentDays && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={!!scheduleConfig.lunchBreakStart}
                  onChange={e =>
                    setScheduleConfig({
                      lunchBreakStart: e.target.checked ? (startDate ? startDate + 'T12:00' : '') : null,
                      lunchBreakEnd: e.target.checked ? (startDate ? startDate + 'T13:00' : '') : null,
                    })
                  }
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Lunch break</span>
              </label>

              {scheduleConfig.lunchBreakStart && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="field-group">
                    <label className="field-label text-xs">Break start</label>
                    <input
                      type="datetime-local"
                      className="field-input text-sm"
                      value={toLocalInputFormat(scheduleConfig.lunchBreakStart)}
                      onChange={e => setScheduleConfig({ lunchBreakStart: e.target.value })}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label text-xs">Break end</label>
                    <input
                      type="datetime-local"
                      className="field-input text-sm"
                      value={toLocalInputFormat(scheduleConfig.lunchBreakEnd)}
                      onChange={e => setScheduleConfig({ lunchBreakEnd: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="divider" />

          <div className="flex items-center gap-3 flex-wrap">
            {!hasGeneratedSchedule ? (
              <button onClick={doGenerate} disabled={generating} className="btn-primary btn">
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                Generate initial schedule
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                Initial schedule generated. Save it below, then use DirectorHQ for all future edits.
              </div>
            )}

            {hasGeneratedSchedule && (
              <span className="text-sm text-[var(--text-muted)]">
                {generatedMatches.length} games across {allVenues.length} field{allVenues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {scheduleConflicts.length > 0 && (
            <div className="space-y-1.5">
              {scheduleConflicts.slice(0, 3).map((c, i) => (
                <div
                  key={i}
                  className={
                    'flex gap-2 p-2 rounded-lg text-xs ' +
                    (c.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700')
                  }
                >
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  {c.message}
                </div>
              ))}
              {scheduleConflicts.length > 3 && (
                <p className="text-xs text-[var(--text-muted)] ml-5">
                  +{scheduleConflicts.length - 3} more conflicts
                </p>
              )}
            </div>
          )}

          {hasGeneratedSchedule && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Initial schedule preview</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Full editing happens in DirectorHQ after save
                </p>
              </div>

              {timeGroups.map(([timeKey, groupMatches]) => (
                <div key={timeKey}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                      {timeKey === 'unscheduled' ? 'Unscheduled' : formatTime(timeKey)}
                    </span>
                    <div className="flex-1 h-px" />
                    <span className="text-xs text-[var(--text-muted)]">
                      {groupMatches.length} game{groupMatches.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {groupMatches.map(m => {
                      const teamA = teamMap[m.team_a_id]
                      const teamB = teamMap[m.team_b_id]
                      const pool = poolMap[m.pool_id]
                      const venue = venueMap[m.venue_id]

                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: teamA?.primaryColor ?? '#e5e7eb' }}
                              />
                              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {teamA?.shortName ?? teamA?.name ?? 'TBD'}
                              </span>
                              <span className="text-[var(--text-muted)] text-xs">vs</span>
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: teamB?.primaryColor ?? '#e5e7eb' }}
                              />
                              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {teamB?.shortName ?? teamB?.name ?? 'TBD'}
                              </span>
                            </div>

                            {pool && (
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">{pool.name}</p>
                            )}
                          </div>

                          {venue && (
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
                              <MapPin size={10} />
                              {venue.shortName ?? venue.name}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {hasExistingSchedule && scheduleEditorPath && (
        <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          <Link
            to={scheduleEditorPath}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:opacity-80"
          >
            Open Schedule Editor in DirectorHQ
            <ExternalLink size={14} />
          </Link>
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextLabel={hasGeneratedSchedule ? 'Save schedule & continue' : 'Skip schedule'}
      />
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}