import { useEffect, useMemo, useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { supabase } from '../../../lib/supabase'
import { clearSavedMatchesForTournament } from '../../../lib/schedulePersistence'
import { WizardNavButtons } from './WizardNavButtons'
import { generateSchedule } from '../../../lib/scheduleGenerator'
import { AlertTriangle, CalendarDays, Clock3, Wand2, RotateCcw } from 'lucide-react'

const crypto = globalThis.crypto

function newTournamentDay(
  index,
  fallbackDate = '',
  defaultStartTime = '09:00',
  defaultEndTime = ''
) {
  return {
    id: crypto.randomUUID(),
    dayIndex: index,
    eventDate: fallbackDate,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    label: '',
  }
}

export function WizardStep6Schedule({ onNext, onBack }) {
  const {
    tournamentId,
    divisions,
    teams,
    pools,
    poolAssignments,
    venues,
    timezone,
    tournamentDays,
    scheduleConfig,
    generatedMatches,
    generatedSlots,
    scheduleConflicts,
    setTournamentDays,
    setScheduleConfig,
    setGeneratedSchedule,
    clearSchedule,
  } = useWizardStore()

  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [loadingSavedSchedule, setLoadingSavedSchedule] = useState(false)
  const [savedScheduleCleared, setSavedScheduleCleared] = useState(false)
  const [formError, setFormError] = useState(null)

  const canGenerate = useMemo(() => {
    return divisions.length > 0 && teams.length > 0 && venues.length > 0 && tournamentDays.length > 0
  }, [divisions.length, teams.length, venues.length, tournamentDays.length])

  useEffect(() => {
    let cancelled = false

    async function loadSavedScheduleIfNeeded() {
      if (!tournamentId) return
      if (savedScheduleCleared) return
      if ((generatedMatches?.length || 0) > 0 || (generatedSlots?.length || 0) > 0) return
      if (divisions.length === 0 || teams.length === 0 || venues.length === 0) return

      try {
        setLoadingSavedSchedule(true)

        const divisionDbIds = divisions.map(div => div.dbId).filter(Boolean)
        if (divisionDbIds.length === 0) return

        const { data: savedMatches, error } = await supabase
          .from('matches')
          .select(`
            id,
            tournament_id,
            division_id,
            pool_id,
            team_a_id,
            team_b_id,
            venue_id,
            round,
            match_number,
            time_slots (
              id,
              venue_id,
              scheduled_start,
              scheduled_end
            )
          `)
          .in('division_id', divisionDbIds)

        if (error) {
          throw new Error(`Failed to load saved schedule: ${error.message}`)
        }

        if (cancelled) return

        if (!Array.isArray(savedMatches) || savedMatches.length === 0) {
          return
        }

        const divisionIdByDbId = Object.fromEntries(
          divisions
            .filter(div => div.dbId)
            .map(div => [div.dbId, div.id])
        )

        const poolIdByDbId = Object.fromEntries(
          pools
            .filter(pool => pool.dbId)
            .map(pool => [pool.dbId, pool.id])
        )

        const teamIdByDbId = Object.fromEntries(
          teams
            .filter(team => team.dbId)
            .map(team => [team.dbId, team.id])
        )

        const venueIdByDbId = Object.fromEntries(
          venues
            .filter(venue => venue.dbId)
            .map(venue => [venue.dbId, venue.id])
        )

        const slotMap = new Map()
        const hydratedMatches = []

        savedMatches.forEach(match => {
          const slotRow = Array.isArray(match.time_slots)
            ? match.time_slots[0]
            : match.time_slots || null

          let localSlotId = null

          if (slotRow?.id) {
            if (!slotMap.has(slotRow.id)) {
              slotMap.set(slotRow.id, {
                id: slotRow.id,
                venue_id: venueIdByDbId[slotRow.venue_id] || slotRow.venue_id || null,
                scheduled_start: slotRow.scheduled_start || '',
                scheduled_end: slotRow.scheduled_end || '',
              })
            }
            localSlotId = slotRow.id
          }

          hydratedMatches.push({
            id: match.id,
            dbId: match.id,
            tournament_id: match.tournament_id,
            division_id: divisionIdByDbId[match.division_id] || match.division_id || null,
            pool_id: poolIdByDbId[match.pool_id] || match.pool_id || null,
            team_a_id: teamIdByDbId[match.team_a_id] || match.team_a_id || null,
            team_b_id: teamIdByDbId[match.team_b_id] || match.team_b_id || null,
            venue_id: venueIdByDbId[match.venue_id] || match.venue_id || null,
            slot_id: localSlotId,
            slotId: localSlotId,
            venueId: venueIdByDbId[match.venue_id] || match.venue_id || null,
            round: match.round ?? null,
            match_number: match.match_number ?? null,
          })
        })

        const hydratedSlots = Array.from(slotMap.values())

        setGeneratedSchedule({
          matches: hydratedMatches,
          slots: hydratedSlots,
          conflicts: [],
        })
      } catch (err) {
        console.error('[Step6 load saved schedule] Error:', err)
        if (!cancelled) {
          setFormError(err.message || 'Failed to load saved schedule.')
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedSchedule(false)
        }
      }
    }

    loadSavedScheduleIfNeeded()

    return () => {
      cancelled = true
    }
  }, [
    tournamentId,
    divisions,
    teams,
    pools,
    venues,
    generatedMatches.length,
    generatedSlots.length,
    savedScheduleCleared,
    setGeneratedSchedule,
  ])

  function updateDay(id, updates) {
    setTournamentDays(
      (tournamentDays || []).map(day => (day.id === id ? { ...day, ...updates } : day))
    )
  }

  function removeDay(id) {
    setTournamentDays((tournamentDays || []).filter(day => day.id !== id))
  }

  function addDay() {
    const nextIndex = (tournamentDays?.length || 0) + 1
    const fallbackDate = deriveNextDate(tournamentDays)
    const defaultStartTime = scheduleConfig?.startTime || '09:00'
    const defaultEndTime = scheduleConfig?.endTime || ''

    setTournamentDays([
      ...(tournamentDays || []),
      newTournamentDay(nextIndex, fallbackDate, defaultStartTime, defaultEndTime),
    ])
  }

  function validateTournamentDays() {
    if (!tournamentDays || tournamentDays.length === 0) {
      setFormError('Add at least one tournament day before generating or saving.')
      return false
    }

    for (let i = 0; i < tournamentDays.length; i++) {
      const day = tournamentDays[i]
      if (!day.eventDate) {
        setFormError(`Tournament day ${i + 1} is missing an event date.`)
        return false
      }
      if (!day.startTime) {
        setFormError(`Tournament day ${i + 1} is missing a start time.`)
        return false
      }
    }

    setFormError(null)
    return true
  }

  function handleGenerateSchedule() {
    setFormError(null)

    if (!validateTournamentDays()) return

    try {
      setGenerating(true)
      setSavedScheduleCleared(false)

      const result = generateSchedule({
        divisions,
        teams,
        pools,
        poolAssignments,
        venues,
        tournamentDays,
        scheduleConfig: {
          generationMode: scheduleConfig?.generationMode || 'round',
          ...scheduleConfig,
        },
      })

      const slots = result?.slots ?? []
      const matches = result?.matches ?? []
      const conflicts = result?.conflicts ?? []

      if (matches.length === 0 && slots.length === 0) {
        setFormError(
          'Schedule generation completed but produced no games or time slots. Check division formats, teams, pools, tournament days, and schedule settings.'
        )
      }

      setGeneratedSchedule({
        slots,
        matches,
        conflicts,
      })
    } catch (err) {
      console.error('[Step6 generate] Error:', err)
      setFormError(err.message || 'Failed to generate schedule.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleClearSchedule() {
    setFormError(null)

    try {
      setClearing(true)

      if (tournamentId) {
        await clearSavedMatchesForTournament(tournamentId)
      }

      setSavedScheduleCleared(true)
      clearSchedule()
    } catch (err) {
      console.error('[Step6 clear schedule] Error:', err)
      setFormError(err.message || 'Failed to clear saved schedule.')
    } finally {
      setClearing(false)
    }
  }

  async function handleNext() {
    setFormError(null)

    if (!validateTournamentDays()) return

    if (!tournamentId) {
      onNext()
      return
    }

    setSaving(true)

    try {
      const freshState = useWizardStore.getState()

      const dayRows = (freshState.tournamentDays || []).map((day, index) => {
        if (!day.eventDate) {
          throw new Error(`Tournament day ${index + 1} is missing an event date.`)
        }

        return {
          tournament_id: tournamentId,
          day_index: day.dayIndex ?? index + 1,
          event_date: day.eventDate,
          start_time: day.startTime || null,
          end_time: day.endTime || null,
          label: day.label || null,
        }
      })

      const { data: existingDays, error: existingDaysErr } = await supabase
        .from('tournament_days')
        .select('id, day_index, event_date')
        .eq('tournament_id', tournamentId)

      if (existingDaysErr) {
        throw new Error('Failed to load existing tournament days: ' + existingDaysErr.message)
      }

      const existingByDayIndex = Object.fromEntries(
        (existingDays ?? []).map(day => [day.day_index, day])
      )

      const seenDayIndexes = new Set()

      for (const row of dayRows) {
        const existing = existingByDayIndex[row.day_index]
        seenDayIndexes.add(row.day_index)

        if (existing?.id) {
          const { error: updateErr } = await supabase
            .from('tournament_days')
            .update({
              event_date: row.event_date,
              start_time: row.start_time,
              end_time: row.end_time,
              label: row.label,
            })
            .eq('id', existing.id)

          if (updateErr) {
            throw new Error(`Failed to update tournament day ${row.day_index}: ${updateErr.message}`)
          }
        } else {
          const { error: insertErr } = await supabase
            .from('tournament_days')
            .insert(row)

          if (insertErr) {
            throw new Error(`Failed to save tournament day ${row.day_index}: ${insertErr.message}`)
          }
        }
      }

      const daysToDelete = (existingDays ?? []).filter(day => !seenDayIndexes.has(day.day_index))

      for (const day of daysToDelete) {
        const { error: deleteErr } = await supabase
          .from('tournament_days')
          .delete()
          .eq('id', day.id)

        if (deleteErr) {
          throw new Error(`Failed to delete removed tournament day ${day.day_index}: ${deleteErr.message}`)
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      console.error('[Step6 save] Error:', err)
      setFormError(err.message || 'Failed to save tournament days.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Schedule & Tournament Days</h2>
        <p className="section-subtitle">
          Define event days and schedule settings, then generate a draft schedule.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      {loadingSavedSchedule && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Loading saved schedule...
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tournament Days</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Add the event dates that schedule generation can use.
            </p>
          </div>

          <button type="button" className="btn-secondary btn btn-sm" onClick={addDay}>
            <CalendarDays size={14} />
            Add day
          </button>
        </div>

        {tournamentDays.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl p-4">
            No tournament days yet. Add at least one day before generating a schedule.
          </div>
        ) : (
          <div className="space-y-3">
            {tournamentDays.map((day, index) => (
              <div
                key={day.id}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 rounded-xl border border-[var(--border)]"
              >
                <div className="field-group">
                  <label className="field-label text-xs">Day</label>
                  <input
                    type="number"
                    className="field-input text-sm"
                    min={1}
                    value={day.dayIndex ?? index + 1}
                    onChange={e =>
                      updateDay(day.id, {
                        dayIndex: Number(e.target.value) || index + 1,
                      })
                    }
                  />
                </div>

                <div className="field-group">
                  <label className="field-label text-xs">Date</label>
                  <input
                    type="date"
                    className="field-input text-sm"
                    value={day.eventDate || ''}
                    onChange={e => updateDay(day.id, { eventDate: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label text-xs">Start time</label>
                  <input
                    type="time"
                    className="field-input text-sm"
                    value={day.startTime || ''}
                    onChange={e => updateDay(day.id, { startTime: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label text-xs">End time</label>
                  <input
                    type="time"
                    className="field-input text-sm"
                    value={day.endTime || ''}
                    onChange={e => updateDay(day.id, { endTime: e.target.value })}
                  />
                </div>

                <div className="field-group flex items-end">
                  <button
                    type="button"
                    className="btn-ghost btn btn-sm w-full"
                    onClick={() => removeDay(day.id)}
                  >
                    <RotateCcw size={14} />
                    Remove
                  </button>
                </div>

                <div className="field-group md:col-span-5">
                  <label className="field-label text-xs">Label</label>
                  <input
                    type="text"
                    className="field-input text-sm"
                    value={day.label || ''}
                    onChange={e => updateDay(day.id, { label: e.target.value })}
                    placeholder="Optional (e.g. Pool Play Day, Championship Day)"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Schedule Settings</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Tournament day row start/end times are used for generation when present. These settings provide defaults for new days and control schedule generation behavior.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="field-group">
            <label className="field-label text-xs flex items-center gap-1">
              <Clock3 size={12} />
              Default day start time
            </label>
            <input
              type="time"
              className="field-input text-sm"
              value={scheduleConfig?.startTime || ''}
              onChange={e => setScheduleConfig({ startTime: e.target.value })}
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Default day end time</label>
            <input
              type="time"
              className="field-input text-sm"
              value={scheduleConfig?.endTime || ''}
              onChange={e => setScheduleConfig({ endTime: e.target.value })}
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Generation scope</label>
            <select
              className="field-input text-sm"
              value={scheduleConfig?.generationMode || 'round'}
              onChange={e => setScheduleConfig({ generationMode: e.target.value })}
            >
              <option value="round">First pool games only</option>
              <option value="all">All pool games</option>
            </select>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Choose whether to generate only the first round of pool games or the full pool schedule.
            </p>
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Game duration (min)</label>
            <input
              type="number"
              className="field-input text-sm"
              min={20}
              step={5}
              value={scheduleConfig?.gameDurationMinutes ?? 90}
              onChange={e =>
                setScheduleConfig({ gameDurationMinutes: Number(e.target.value) || 90 })
              }
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Break between games (min)</label>
            <input
              type="number"
              className="field-input text-sm"
              min={0}
              step={5}
              value={scheduleConfig?.breakBetweenGamesMinutes ?? 30}
              onChange={e =>
                setScheduleConfig({
                  breakBetweenGamesMinutes: Number(e.target.value) || 30,
                })
              }
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Minimum team rest (min)</label>
            <input
              type="number"
              className="field-input text-sm"
              min={0}
              step={5}
              value={scheduleConfig?.minRestBetweenTeamGames ?? 90}
              onChange={e =>
                setScheduleConfig({
                  minRestBetweenTeamGames: Number(e.target.value) || 90,
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Draft Schedule</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Generate either the first round of pool games or the full pool schedule from your divisions, teams, pools, venues, and tournament days.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost btn btn-sm"
              onClick={handleClearSchedule}
              disabled={(generatedMatches.length === 0 && generatedSlots.length === 0) || clearing}
            >
              <RotateCcw size={14} />
              {clearing ? 'Clearing...' : 'Clear'}
            </button>

            <button
              type="button"
              className="btn-primary btn btn-sm"
              onClick={handleGenerateSchedule}
              disabled={!canGenerate || generating}
            >
              <Wand2 size={14} />
              {generating ? 'Generating...' : 'Generate schedule'}
            </button>
          </div>
        </div>

        {!canGenerate && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Add divisions, teams, venues, and tournament days before generating a schedule.
          </div>
        )}

        {scheduleConflicts.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              {scheduleConflicts.length} schedule issue{scheduleConflicts.length !== 1 ? 's' : ''} detected
            </p>
            <ul className="space-y-1 text-xs text-amber-700">
              {scheduleConflicts.slice(0, 5).map((conflict, index) => (
                <li key={index}>• {conflict.message}</li>
              ))}
            </ul>
            {scheduleConflicts.length > 5 && (
              <p className="text-xs text-amber-600 mt-2">
                +{scheduleConflicts.length - 5} more conflict{scheduleConflicts.length - 5 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Generated games" value={generatedMatches.length} />
          <SummaryCard label="Time slots" value={generatedSlots.length} />
          <SummaryCard label="Conflicts" value={scheduleConflicts.length} />
        </div>
      </div>

      {generatedMatches.length > 0 && (
        <GeneratedSchedulePreview
          matches={generatedMatches}
          slots={generatedSlots}
          teams={teams}
          venues={venues}
          timezone={timezone || 'America/Toronto'}
        />
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextLabel="Save schedule setup & continue"
      />
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{value}</p>
    </div>
  )
}

function GeneratedSchedulePreview({
  matches,
  slots,
  teams,
  venues,
  timezone = 'America/Toronto',
}) {
  const teamMap = Object.fromEntries((teams || []).map(team => [team.id, team]))
  const venueMap = Object.fromEntries((venues || []).map(venue => [venue.id, venue]))
  const slotMap = Object.fromEntries((slots || []).map(slot => [slot.id, slot]))

  const rows = (matches || []).map((match, index) => {
    const slot =
      slotMap[match.slotId] ||
      slotMap[match.slot_id] ||
      null

    const venue =
      venueMap[match.venueId] ||
      venueMap[match.venue_id] ||
      (slot ? venueMap[slot.venue_id] : null) ||
      null

    const teamA =
      teamMap[match.teamAId] ||
      teamMap[match.team_a_id] ||
      null

    const teamB =
      teamMap[match.teamBId] ||
      teamMap[match.team_b_id] ||
      null

    let date = ''
    let time = ''

    if (slot?.scheduled_start) {
      const dt = new Date(slot.scheduled_start)

      date = dt.toLocaleDateString('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })

      time = dt.toLocaleTimeString('en-CA', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }

    return {
      id: match.id || `match-${index}`,
      round: match.round ?? '',
      teamAName: teamA?.name || 'TBD',
      teamBName: teamB?.name || 'TBD',
      date,
      time,
      fieldName: venue?.name || '',
    }
  })

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Generated Schedule Preview
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Review the current generated schedule assignments below. Workbook schedule imports should appear here after upload.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="py-2 pr-4">Round</th>
              <th className="py-2 pr-4">Team A</th>
              <th className="py-2 pr-4">Team B</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Field</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-[var(--border)]">
                <td className="py-2 pr-4">{row.round || '—'}</td>
                <td className="py-2 pr-4">{row.teamAName}</td>
                <td className="py-2 pr-4">{row.teamBName}</td>
                <td className="py-2 pr-4">{row.date || '—'}</td>
                <td className="py-2 pr-4">{row.time || '—'}</td>
                <td className="py-2 pr-4">{row.fieldName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function deriveNextDate(days) {
  const sorted = [...(days || [])]
    .filter(day => day.eventDate)
    .sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)))

  const last = sorted[sorted.length - 1]
  if (!last?.eventDate) return ''

  const date = new Date(last.eventDate + 'T12:00:00')
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}