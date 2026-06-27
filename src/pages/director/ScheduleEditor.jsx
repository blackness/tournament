import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { validateSchedule, generateSchedule } from '../../lib/scheduleGenerator'
import { clearSavedMatchesForTournament } from '../../lib/schedulePersistence'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { getDivisionReadiness } from '../../../lib/divisions/getDivisionReadiness'
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
  Trash2,
  CheckSquare,
  Square,
  X,
  Wand2,
} from 'lucide-react'

const crypto = globalThis.crypto

export function ScheduleEditor({ embedded = false, footer = null }) {
  const { tournamentId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [slots, setSlots] = useState([])
  const [venues, setVenues] = useState([])
  const [teams, setTeams] = useState([])
  const [pools, setPools] = useState([])
  const [divisions, setDivisions] = useState([])
  const [poolAssignments, setPoolAssignments] = useState([])
  const [tournamentDays, setTournamentDays] = useState([])
  const [savingDays, setSavingDays] = useState(false)
  const [scheduleSettings, setScheduleSettings] = useState({
    startTime: '09:00',
    endTime: '23:00',
    generationMode: 'round',
    gameDurationMinutes: 90,
    breakBetweenGamesMinutes: 30,
    minRestBetweenTeamGames: 90,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [generatingSchedule, setGeneratingSchedule] = useState(false)
  const [clearingSchedule, setClearingSchedule] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [globalDelay, setGlobalDelay] = useState(0)
  const [applyingDelay, setApplyingDelay] = useState(false)
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [newConflictNotice, setNewConflictNotice] = useState([])
  const [selectedMatchIds, setSelectedMatchIds] = useState([])

  const [editingMatchId, setEditingMatchId] = useState(null)
  const [editForm, setEditForm] = useState({
    pool_id: '',
    division_id: '',
    team_a_id: '',
    team_b_id: '',
    time_slot_id: '',
    venue_id: '',
    event_date: '',
    start_time: '',
    end_time: '',
    round: 1,
  })

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)

      setScheduleSettings({
        startTime: t?.default_day_start_time || '09:00',
        endTime: t?.default_day_end_time || '23:00',
        generationMode: t?.schedule_generation_mode || 'round',
        gameDurationMinutes: t?.game_duration_minutes ?? 90,
        breakBetweenGamesMinutes: t?.break_between_games_minutes ?? 30,
        minRestBetweenTeamGames: t?.min_rest_minutes ?? 90,
      })

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

      const { data: teamRows } = await supabase
        .from('tournament_teams')
        .select('id, pool_id')
        .eq('tournament_id', tournamentId)

      setPoolAssignments(
        (teamRows ?? [])
          .filter(row => row.pool_id)
          .map(row => ({
            team_id: row.id,
            pool_id: row.pool_id,
          }))
      )

      const { data: dayRows } = await supabase
        .from('tournament_days')
        .select('id, day_index, event_date, start_time, end_time, label')
        .eq('tournament_id', tournamentId)
        .order('day_index', { ascending: true })

      setTournamentDays(
        (dayRows ?? []).map(day => ({
          id: day.id,
          dayIndex: day.day_index,
          eventDate: day.event_date || '',
          startTime: day.start_time || t?.default_day_start_time || '09:00',
          endTime: day.end_time || t?.default_day_end_time || '23:00',
          label: day.label || '',
        }))
      )

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, round, match_number, round_label, phase,
          score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
          match_origin, pairing_locked, schedule_locked, is_manually_edited, manual_edit_fields,
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
      scheduleSettings?.minRestBetweenTeamGames ??
      tournament?.format_config?.schedule?.minRestBetweenTeamGames ??
      0
    )

    const nextConflicts = validateSchedule(
      normalizedMatches,
      normalizedSlots,
      minRestMinutes
    )

    setConflicts(nextConflicts)
    return nextConflicts
  }, [matches, slots, tournament, scheduleSettings])

  useEffect(() => {
    if (matches.length > 0 || slots.length > 0) {
      recalculateConflicts(matches, slots)
    } else {
      setConflicts([])
    }
  }, [matches, slots, recalculateConflicts])

  const canGenerateSchedule = useMemo(() => {
    return (
      divisions.length > 0 &&
      teams.length > 0 &&
      venues.length > 0 &&
      tournamentDays.length > 0
    )
  }, [divisions.length, teams.length, venues.length, tournamentDays.length])
const preflight = runSchedulePreflight({
      divisions,
      teams,
      pools,
      poolAssignments,
      venues,
      tournamentDays,
    })

    if (!preflight.ok) {
      showMessage(
        `Schedule cannot be generated yet: ${preflight.errors.join(' • ')}`,
        'error'
      )
      return
    }

    if (preflight.warnings.length > 0) {
      console.warn('[handleGenerateSchedule] preflight warnings', preflight.warnings)
    }
  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  function dismissNewConflictNotice() {
    setNewConflictNotice([])
  }

  function handlePostSaveConflicts(previousConflicts, nextMatches, nextSlots) {
    const nextConflicts = recalculateConflicts(nextMatches, nextSlots)
    const introduced = getNewConflicts(previousConflicts, nextConflicts)

    if (introduced.length > 0) {
      setNewConflictNotice(introduced)
    } else {
      setNewConflictNotice([])
    }

    return nextConflicts
  }

  function updateDay(id, updates) {
    setTournamentDays(prev =>
      prev.map(day => (day.id === id ? { ...day, ...updates } : day))
    )
  }

  function removeDay(id) {
    setTournamentDays(prev => prev.filter(day => day.id !== id))
  }

  function addDay() {
    const nextIndex = (tournamentDays?.length || 0) + 1
    const fallbackDate = deriveNextDate(tournamentDays)
    const defaultStartTime = scheduleSettings?.startTime || '09:00'
    const defaultEndTime = scheduleSettings?.endTime || '23:00'

    setTournamentDays(prev => [
      ...prev,
      newScheduleDay(nextIndex, fallbackDate, defaultStartTime, defaultEndTime),
    ])
  }

  async function saveTournamentDays() {
    if (!tournamentId) return

    setSavingDays(true)

    try {
      const dayRows = (tournamentDays || []).map((day, index) => {
        if (!day.eventDate) {
          throw new Error(`Tournament day ${index + 1} is missing a date.`)
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
        .select('id, day_index')
        .eq('tournament_id', tournamentId)

      if (existingDaysErr) throw existingDaysErr

      const existingByDayIndex = Object.fromEntries(
        (existingDays ?? []).map(day => [day.day_index, day])
      )

      const seenDayIndexes = new Set()

      for (const row of dayRows) {
        const existing = existingByDayIndex[row.day_index]
        seenDayIndexes.add(row.day_index)

        if (existing?.id) {
          const { error } = await supabase
            .from('tournament_days')
            .update({
              event_date: row.event_date,
              start_time: row.start_time,
              end_time: row.end_time,
              label: row.label,
            })
            .eq('id', existing.id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from('tournament_days')
            .insert(row)

          if (error) throw error
        }
      }

      const daysToDelete = (existingDays ?? []).filter(day => !seenDayIndexes.has(day.day_index))

      for (const day of daysToDelete) {
        const { error } = await supabase
          .from('tournament_days')
          .delete()
          .eq('id', day.id)

        if (error) throw error
      }

      showMessage('Tournament days saved')
    } catch (err) {
      showMessage('Failed to save tournament days: ' + err.message, 'error')
    } finally {
      setSavingDays(false)
    }
  }

  function updateScheduleSetting(field, value) {
    setScheduleSettings(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  async function saveScheduleSettings() {
    if (!tournamentId) return

    setSavingSettings(true)

    try {
      const payload = {
        game_duration_minutes: scheduleSettings?.gameDurationMinutes ?? 90,
        break_between_games_minutes: scheduleSettings?.breakBetweenGamesMinutes ?? 30,
        min_rest_minutes: scheduleSettings?.minRestBetweenTeamGames ?? 90,
        default_day_start_time: scheduleSettings?.startTime || '09:00',
        default_day_end_time: scheduleSettings?.endTime || '23:00',
        schedule_generation_mode: scheduleSettings?.generationMode || 'round',
      }

      const { data, error } = await supabase
        .from('tournaments')
        .update(payload)
        .eq('id', tournamentId)
        .select()
        .single()

      if (error) throw error

      setTournament(data)
      showMessage('Schedule settings saved')
    } catch (err) {
      showMessage('Failed to save schedule settings: ' + err.message, 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  function runSchedulePreflight() {
  const errors = []
  const warnings = []

  if (!divisions?.length) {
    errors.push('Add at least one division.')
  }

  if (!teams?.length) {
    errors.push('Add at least one team.')
  }

  if (!venues?.length) {
    errors.push('Add at least one field/venue.')
  }

  if (!tournamentDays?.length) {
    errors.push('Add at least one tournament day.')
  }

  const readinessByDivision = (divisions || []).map(div =>
    ({
      division: div,
      readiness: getDivisionReadiness(div, { teams, pools, poolAssignments }),
    })
  )

  readinessByDivision.forEach(({ division, readiness }) => {
    if (!readiness.ready) {
      readiness.errors.forEach(msg => {
        errors.push(`${division.name || 'Division'}: ${msg}`)
      })
    }

    readiness.warnings.forEach(msg => {
      warnings.push(`${division.name || 'Division'}: ${msg}`)
    })
  })

  return { ok: errors.length === 0, errors, warnings }
}
function runSchedulePreflight({
  divisions = [],
  teams = [],
  pools = [],
  poolAssignments = {},
  venues = [],
  tournamentDays = [],
}) {
  const errors = []
  const warnings = []

  if (!divisions.length) errors.push('Add at least one division.')
  if (!teams.length) errors.push('Add at least one team.')
  if (!venues.length) errors.push('Add at least one field/venue.')
  if (!tournamentDays.length) errors.push('Add at least one tournament day.')

  for (const division of divisions) {
    const readiness = getDivisionReadiness(division, { teams, pools, poolAssignments })

    if (!readiness.ready) {
      readiness.errors.forEach(msg => errors.push(`${division.name}: ${msg}`))
    }

    readiness.warnings.forEach(msg => warnings.push(`${division.name}: ${msg}`))
  }

  return { ok: errors.length === 0, errors, warnings }
}
  async function handleGenerateSchedule() {
    if (!canGenerateSchedule) {
      showMessage('Add divisions, teams, venues, and tournament days before generating.', 'error')
      return
    }

    try {
      setGeneratingSchedule(true)

      const result = generateSchedule({
        divisions,
        teams,
        pools,
        poolAssignments,
        venues,
        tournamentDays,
        scheduleConfig: {
          generationMode: scheduleSettings?.generationMode || 'round',
          startTime: scheduleSettings?.startTime || '09:00',
          endTime: scheduleSettings?.endTime || '23:00',
          gameDurationMinutes: scheduleSettings?.gameDurationMinutes ?? 90,
          breakBetweenGamesMinutes: scheduleSettings?.breakBetweenGamesMinutes ?? 30,
          minRestBetweenTeamGames: scheduleSettings?.minRestBetweenTeamGames ?? 90,
        },
      })

      const generatedSlots = result?.slots ?? []
      const generatedMatches = result?.matches ?? []
      const generatedConflicts = result?.conflicts ?? []

      const {
        errors: generationValidationErrors,
        normalizedSlots,
        normalizedMatches,
      } = validateGeneratedSchedulePayload(generatedSlots, generatedMatches)

      if (generationValidationErrors.length > 0) {
        console.error('[handleGenerateSchedule] Invalid generated schedule payload', {
          errors: generationValidationErrors,
          generatedSlots,
          generatedMatches,
        })

        showMessage(
          generationValidationErrors[0] || 'Generated schedule payload is invalid.',
          'error'
        )
        return
      }

if (normalizedMatches.length === 0 && normalizedSlots.length === 0) {
        const divisionHints = (divisions || [])
          .map(div => {
            const r = getDivisionReadiness(div, { teams, pools, poolAssignments })
            return r.ready ? null : `${div.name}: ${r.errors.join(', ')}`
          })
          .filter(Boolean)

        showMessage(
          divisionHints.length
            ? `No schedule was generated. Check: ${divisionHints.join(' • ')}`
            : 'Schedule generation completed but produced no games or time slots.',
          'error'
        )
        return
      }
      
      const { error: deleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)

      if (deleteMatchesError) throw deleteMatchesError

      const { error: deleteSlotsError } = await supabase
        .from('time_slots')
        .delete()
        .eq('tournament_id', tournamentId)

      if (deleteSlotsError) throw deleteSlotsError

      let insertedSlots = []
      if (normalizedSlots.length > 0) {
        const slotRows = normalizedSlots.map(slot => ({
          tournament_id: tournamentId,
          venue_id: slot.venue_id,
          scheduled_start: slot.scheduled_start,
          scheduled_end: slot.scheduled_end,
          offset_minutes: slot.offset_minutes ?? 0,
        }))

        const { data: savedSlots, error: slotInsertError } = await supabase
          .from('time_slots')
          .insert(slotRows)
          .select('id, venue_id, scheduled_start, scheduled_end, offset_minutes')

        if (slotInsertError) throw slotInsertError

        insertedSlots = (savedSlots ?? []).sort((a, b) =>
          String(a.scheduled_start || '').localeCompare(String(b.scheduled_start || ''))
        )
      }

      const makeSlotKey = slot => {
        const startMs = slot?.scheduled_start ? new Date(slot.scheduled_start).getTime() : ''
        const endMs = slot?.scheduled_end ? new Date(slot.scheduled_end).getTime() : ''

        return [
          slot?.venue_id ?? '',
          startMs,
          endMs,
        ].join('|')
      }

      const insertedSlotByKey = new Map(
        insertedSlots.map(slot => [makeSlotKey(slot), slot])
      )

      if (normalizedMatches.length > 0) {
        const normalizedSlotById = new Map(normalizedSlots.map(slot => [slot.id, slot]))

        const matchRows = normalizedMatches.map((match, index) => {
          const originalSlot = normalizedSlotById.get(match.slot_id) ?? null
          const savedSlot =
            originalSlot ? insertedSlotByKey.get(makeSlotKey(originalSlot)) ?? null : null
          const savedSlotId = savedSlot?.id ?? null

          return {
            tournament_id: tournamentId,
            division_id: match.division_id,
            pool_id: match.pool_id,
            team_a_id: match.team_a_id,
            team_b_id: match.team_b_id,
            venue_id: match.venue_id ?? originalSlot?.venue_id ?? savedSlot?.venue_id ?? null,
            time_slot_id: savedSlotId,
            round: match.round ?? 1,
            match_number: match.match_number ?? index + 1,
            phase: match.phase ?? 1,
            status: 'scheduled',
            match_origin: 'generated_pool',
            pairing_locked: false,
            schedule_locked: false,
            is_manually_edited: false,
            manual_edit_fields: [],
            generated_baseline: null,
          }
        })

        const invalidMatchRows = matchRows.filter(
          row => !row.team_a_id || !row.team_b_id
        )

        if (invalidMatchRows.length > 0) {
          console.error(
            '[handleGenerateSchedule] Refusing to insert invalid match rows',
            invalidMatchRows
          )
          showMessage('Generated matches are invalid. Aborting save.', 'error')
          return
        }

        const { error: matchInsertError } = await supabase
          .from('matches')
          .insert(matchRows)

        if (matchInsertError) throw matchInsertError
      }

      const { data: refreshedSlots } = await db.timeSlots.byTournament(tournamentId)
      const { data: refreshedMatches } = await supabase
        .from('matches')
        .select(`
          id, status, round, match_number, round_label, phase,
          score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
          match_origin, pairing_locked, schedule_locked, is_manually_edited, manual_edit_fields,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(id, name, short_name),
          time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes),
          division:divisions(id, name),
          pool:pools(id, name)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')

      const sortedMatches = [...(refreshedMatches ?? [])].sort((a, b) => {
        const aStart = a.time_slot?.scheduled_start ?? '9999'
        const bStart = b.time_slot?.scheduled_start ?? '9999'
        if (aStart !== bStart) return aStart.localeCompare(bStart)
        return (a.match_number ?? 9999) - (b.match_number ?? 9999)
      })

      const previousConflicts = conflicts
      setSlots(refreshedSlots ?? [])
      setMatches(sortedMatches)

      const nextConflicts = generatedConflicts
      const introduced = getNewConflicts(previousConflicts, nextConflicts)
      setConflicts(nextConflicts)
      setNewConflictNotice(introduced.length > 0 ? introduced : [])

      showMessage('Schedule generated')
    } catch (err) {
      console.error('[handleGenerateSchedule] failed', err)
      showMessage('Failed to generate schedule: ' + err.message, 'error')
    } finally {
      setGeneratingSchedule(false)
    }
  }
  async function handleClearGeneratedSchedule() {
    try {
      setClearingSchedule(true)
      await clearSavedMatchesForTournament(tournamentId)

      const { data: refreshedSlots } = await db.timeSlots.byTournament(tournamentId)
      const { data: refreshedMatches } = await supabase
        .from('matches')
        .select(`
          id, status, round, match_number, round_label, phase,
          score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
          match_origin, pairing_locked, schedule_locked, is_manually_edited, manual_edit_fields,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(id, name, short_name),
          time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes),
          division:divisions(id, name),
          pool:pools(id, name)
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')

      const sortedMatches = [...(refreshedMatches ?? [])].sort((a, b) => {
        const aStart = a.time_slot?.scheduled_start ?? '9999'
        const bStart = b.time_slot?.scheduled_start ?? '9999'
        if (aStart !== bStart) return aStart.localeCompare(bStart)
        return (a.match_number ?? 9999) - (b.match_number ?? 9999)
      })

      setSlots(refreshedSlots ?? [])
      setMatches(sortedMatches)
      setNewConflictNotice([])
      recalculateConflicts(sortedMatches, refreshedSlots ?? [])
      showMessage('Generated schedule cleared')
    } catch (err) {
      showMessage('Failed to clear schedule: ' + err.message, 'error')
    } finally {
      setClearingSchedule(false)
    }
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
        const draggedMatch = matches.find(m => m.id === matchId)

        const draggedPatch = buildManualEditPatch(draggedMatch, {
          team_a_id: draggedMatch?.team_a?.id ?? null,
          team_b_id: draggedMatch?.team_b?.id ?? null,
          time_slot_id: targetSlotId,
          venue_id: targetVenueId || null,
        })

        const { error: e1 } = await supabase
          .from('matches')
          .update({
            time_slot_id: targetSlotId,
            venue_id: targetVenueId || null,
            ...draggedPatch,
          })
          .eq('id', matchId)

        const occupantPatch = buildManualEditPatch(occupant, {
          team_a_id: occupant?.team_a?.id ?? null,
          team_b_id: occupant?.team_b?.id ?? null,
          time_slot_id: dragging.currentSlotId,
          venue_id: oldSlot?.venue_id || null,
        })

        const { error: e2 } = await supabase
          .from('matches')
          .update({
            time_slot_id: dragging.currentSlotId,
            venue_id: oldSlot?.venue_id || null,
            ...occupantPatch,
          })
          .eq('id', occupant.id)

        if (e1 || e2) throw e1 || e2

        const nextMatches = matches.map(m => {
          if (m.id === matchId) {
            const newSlot = slots.find(s => s.id === targetSlotId) ?? m.time_slot
            const newVenue = venues.find(v => v.id === targetVenueId) ?? m.venue
            return {
              ...m,
              time_slot: newSlot,
              time_slot_id: targetSlotId,
              venue: newVenue,
              venue_id: targetVenueId,
              ...draggedPatch,
            }
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
              ...occupantPatch,
            }
          }

          return m
        })

        setMatches(nextMatches)
        const previousConflicts = conflicts
        handlePostSaveConflicts(previousConflicts, nextMatches, slots)
        showMessage('Swapped game times')
      } else {
        const slot = slots.find(s => s.id === targetSlotId)
        const venue = venues.find(v => v.id === targetVenueId) ?? null
        const draggedMatch = matches.find(m => m.id === matchId)

        const draggedPatch = buildManualEditPatch(draggedMatch, {
          team_a_id: draggedMatch?.team_a?.id ?? null,
          team_b_id: draggedMatch?.team_b?.id ?? null,
          time_slot_id: targetSlotId,
          venue_id: targetVenueId || null,
        })

        const { error } = await supabase
          .from('matches')
          .update({
            time_slot_id: targetSlotId,
            venue_id: targetVenueId || null,
            ...draggedPatch,
          })
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
                ...draggedPatch,
              }
            : m
        )

        setMatches(nextMatches)
        const previousConflicts = conflicts
        handlePostSaveConflicts(previousConflicts, nextMatches, slots)
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
      const previousConflicts = conflicts
      handlePostSaveConflicts(previousConflicts, nextMatches, normalizedSlots)

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
    const firstDay = tournamentDays[0] ?? null
    const defaultStartTime = scheduleSettings?.startTime || '09:00'
    const duration = Number(scheduleSettings?.gameDurationMinutes ?? 90)
    const defaultEndTime = addMinutesToTime(defaultStartTime, duration)

    setEditingMatchId('new')
    setEditForm({
      pool_id: firstPool?.id ?? '',
      division_id: firstDivisionId,
      team_a_id: '',
      team_b_id: '',
      time_slot_id: '',
      venue_id: firstVenue?.id ?? '',
      event_date: firstDay?.eventDate ?? '',
      start_time: defaultStartTime,
      end_time: defaultEndTime,
      round: 1,
    })
  }

  function openEditModal(match) {
    const scheduledStart = match.time_slot?.scheduled_start ?? null
    const scheduledEnd = match.time_slot?.scheduled_end ?? null

    setEditingMatchId(match.id)
    setEditForm({
      pool_id: match.pool_id ?? match.pool?.id ?? '',
      division_id: match.division_id ?? match.division?.id ?? '',
      team_a_id: match.team_a?.id ?? '',
      team_b_id: match.team_b?.id ?? '',
      time_slot_id: match.time_slot_id ?? match.time_slot?.id ?? '',
      venue_id: match.venue_id ?? match.venue?.id ?? '',
      event_date: scheduledStart ? formatDateInputValue(scheduledStart) : '',
      start_time: scheduledStart ? formatTimeInputValue(scheduledStart) : '',
      end_time: scheduledEnd ? formatTimeInputValue(scheduledEnd) : '',
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
      event_date: '',
      start_time: '',
      end_time: '',
      round: 1,
    })
  }

  function handleEditFormChange(field, value) {
    setEditForm(prev => {
      const next = { ...prev, [field]: value }

      if (field === 'time_slot_id') {
        const selectedSlot = slots.find(s => s.id === value)
        if (selectedSlot?.venue_id) {
          next.venue_id = selectedSlot.venue_id
        }
        if (selectedSlot?.scheduled_start) {
          next.event_date = formatDateInputValue(selectedSlot.scheduled_start)
          next.start_time = formatTimeInputValue(selectedSlot.scheduled_start)
        }
        if (selectedSlot?.scheduled_end) {
          next.end_time = formatTimeInputValue(selectedSlot.scheduled_end)
        }
      }

      if (field === 'start_time' && next.event_date && !prev.end_time) {
        next.end_time = addMinutesToTime(value, Number(scheduleSettings?.gameDurationMinutes ?? 90))
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

    if (!editForm.venue_id) {
      showMessage('Field is required', 'error')
      return
    }

    if (!editForm.event_date || !editForm.start_time || !editForm.end_time) {
      showMessage('Date, start time, and end time are required', 'error')
      return
    }

    const scheduledStart = combineDateAndTime(editForm.event_date, editForm.start_time)
    const scheduledEnd = combineDateAndTime(editForm.event_date, editForm.end_time)

    if (!scheduledStart || !scheduledEnd) {
      showMessage('Invalid date/time values', 'error')
      return
    }

    if (scheduledEnd <= scheduledStart) {
      showMessage('End time must be after start time', 'error')
      return
    }

    const selectedPool = pools.find(p => p.id === editForm.pool_id)
    const selectedDivisionId = selectedPool?.division_id ?? editForm.division_id ?? null
    const venueId = editForm.venue_id ?? null
    const venue = venues.find(v => v.id === venueId) ?? null
    const teamA = teams.find(t => t.id === editForm.team_a_id) ?? null
    const teamB = teams.find(t => t.id === editForm.team_b_id) ?? null
    const division = divisions.find(d => d.id === selectedDivisionId) ?? null
    const pool = pools.find(p => p.id === editForm.pool_id) ?? null

    try {
      const slot = await findOrCreateTimeSlot({
        tournamentId,
        venueId,
        scheduledStart,
        scheduledEnd,
      })

      const slotId = slot?.id ?? null

      if (editingMatchId === 'new') {
        setSaving('new')

        const nextMatchNumber =
          matches.reduce((max, m) => Math.max(max, m.match_number ?? 0), 0) + 1

        const insertRow = {
          tournament_id: tournamentId,
          division_id: selectedDivisionId,
          pool_id: editForm.pool_id || null,
          team_a_id: editForm.team_a_id,
          team_b_id: editForm.team_b_id,
          time_slot_id: slotId,
          venue_id: venueId,
          round: Number(editForm.round) || 1,
          match_number: nextMatchNumber,
          phase: 1,
          status: 'scheduled',
          match_origin: 'manual',
          pairing_locked: true,
          schedule_locked: true,
          is_manually_edited: true,
          manual_edit_fields: [
            'team_a_id',
            'team_b_id',
            'scheduled_start',
            'scheduled_end',
            'venue_id',
          ],
          generated_baseline: null,
        }

        const { data, error } = await supabase
          .from('matches')
          .insert(insertRow)
          .select(`
            id, status, round, match_number, round_label, phase,
            score_a, score_b, division_id, pool_id, venue_id, time_slot_id,
            match_origin, pairing_locked, schedule_locked, is_manually_edited, manual_edit_fields,
            team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
            team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
            venue:venues(id, name, short_name),
            time_slot:time_slots(id, venue_id, scheduled_start, scheduled_end, offset_minutes),
            division:divisions(id, name),
            pool:pools(id, name)
          `)
          .single()

        if (error) throw error

        const nextSlots = (() => {
          const exists = slots.some(s => s.id === slot.id)
          return exists
            ? slots
            : [...slots, slot].sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))
        })()

        setSlots(nextSlots)

        const nextMatches = [...matches, data].sort((a, b) => {
          const aStart = a.time_slot?.scheduled_start ?? '9999'
          const bStart = b.time_slot?.scheduled_start ?? '9999'
          if (aStart !== bStart) return aStart.localeCompare(bStart)
          return (a.match_number ?? 9999) - (b.match_number ?? 9999)
        })

        setMatches(nextMatches)
        const previousConflicts = conflicts
        handlePostSaveConflicts(previousConflicts, nextMatches, nextSlots)
        showMessage('Game added')
        closeEditModal()
        return
      }

      setSaving(editingMatchId)

      const existingMatch = matches.find(m => m.id === editingMatchId)

      const nextDraft = {
        team_a_id: editForm.team_a_id,
        team_b_id: editForm.team_b_id,
        time_slot_id: slotId,
        venue_id: venueId,
      }

      const metadataPatch = buildManualEditPatch(existingMatch, nextDraft)

      const updateRow = {
        division_id: selectedDivisionId,
        pool_id: editForm.pool_id || null,
        team_a_id: editForm.team_a_id,
        team_b_id: editForm.team_b_id,
        time_slot_id: slotId,
        venue_id: venueId,
        round: Number(editForm.round) || 1,
        ...metadataPatch,
      }

      const { error } = await supabase
        .from('matches')
        .update(updateRow)
        .eq('id', editingMatchId)

      if (error) throw error

      const nextSlots = (() => {
        const exists = slots.some(s => s.id === slot.id)
        return exists
          ? slots
          : [...slots, slot].sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))
      })()

      setSlots(nextSlots)

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
              time_slot: slot,
              time_slot_id: slotId,
              division,
              pool,
              round: Number(editForm.round) || 1,
              ...metadataPatch,
            }
          : m
      )

      setMatches(nextMatches)
      const previousConflicts = conflicts
      handlePostSaveConflicts(previousConflicts, nextMatches, nextSlots)
      showMessage('Game updated')
      closeEditModal()
    } catch (err) {
      showMessage('Failed to update game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteMatch(matchId = editingMatchId, { closeModal = true } = {}) {
    if (!matchId || matchId === 'new') return

    const confirmed = window.confirm(
      'Delete this game?\n\nThis will remove it from the active schedule and public views.'
    )

    if (!confirmed) return

    setSaving(matchId)
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId)

      if (error) throw error

      const nextMatches = matches.filter(m => m.id !== matchId)
      setMatches(nextMatches)
      setSelectedMatchIds(prev => prev.filter(id => id !== matchId))
      setNewConflictNotice([])
      recalculateConflicts(nextMatches, slots)
      showMessage('Game deleted')

      if (closeModal) closeEditModal()
    } catch (err) {
      showMessage('Failed to delete game: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  function toggleSelectedMatch(matchId) {
    setSelectedMatchIds(prev =>
      prev.includes(matchId)
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    )
  }

  function clearSelection() {
    setSelectedMatchIds([])
  }

  const filtered =
    filter === 'all'
      ? matches
      : matches.filter(m => m.venue?.id === filter || m.venue_id === filter)

  const visibleMatchIds = useMemo(() => filtered.map(m => m.id), [filtered])
  const selectedVisibleCount = visibleMatchIds.filter(id => selectedMatchIds.includes(id)).length
  const allVisibleSelected = visibleMatchIds.length > 0 && selectedVisibleCount === visibleMatchIds.length

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedMatchIds(prev => prev.filter(id => !visibleMatchIds.includes(id)))
      return
    }

    setSelectedMatchIds(prev => [...new Set([...prev, ...visibleMatchIds])])
  }

  async function handleDeleteSelected() {
    if (selectedMatchIds.length === 0) return

    const confirmed = window.confirm(
      `Delete ${selectedMatchIds.length} selected game${selectedMatchIds.length !== 1 ? 's' : ''}?\n\nThis will remove them from the active schedule and public views.`
    )

    if (!confirmed) return

    setSaving('bulk-delete')
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .in('id', selectedMatchIds)

      if (error) throw error

      const nextMatches = matches.filter(m => !selectedMatchIds.includes(m.id))
      setMatches(nextMatches)
      setSelectedMatchIds([])
      setNewConflictNotice([])
      recalculateConflicts(nextMatches, slots)
      showMessage(`${selectedMatchIds.length} game${selectedMatchIds.length !== 1 ? 's' : ''} deleted`)
    } catch (err) {
      showMessage('Failed to delete selected games: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteAllVisible() {
    if (visibleMatchIds.length === 0) return

    const confirmed = window.confirm(
      `Delete all ${visibleMatchIds.length} visible game${visibleMatchIds.length !== 1 ? 's' : ''}?\n\nThis will remove them from the active schedule and public views.`
    )

    if (!confirmed) return

    setSaving('bulk-delete-visible')
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .in('id', visibleMatchIds)

      if (error) throw error

      const nextMatches = matches.filter(m => !visibleMatchIds.includes(m.id))
      setMatches(nextMatches)
      setSelectedMatchIds(prev => prev.filter(id => !visibleMatchIds.includes(id)))
      setNewConflictNotice([])
      recalculateConflicts(nextMatches, slots)
      showMessage(`${visibleMatchIds.length} visible game${visibleMatchIds.length !== 1 ? 's' : ''} deleted`)
    } catch (err) {
      showMessage('Failed to delete visible games: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteAllGames() {
    if (matches.length === 0) return

    const confirmed = window.confirm(
      `Delete all ${matches.length} active game${matches.length !== 1 ? 's' : ''} in this tournament?\n\nThis will remove them from the active schedule and public views.`
    )

    if (!confirmed) return

    const secondConfirmed = window.confirm(
      'Are you absolutely sure? This is intended for major schedule cleanup.'
    )

    if (!secondConfirmed) return

    setSaving('bulk-delete-all')
    try {
      const allIds = matches.map(m => m.id)

      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .in('id', allIds)

      if (error) throw error

      setMatches([])
      setSelectedMatchIds([])
      setNewConflictNotice([])
      recalculateConflicts([], slots)
      showMessage('All active games deleted')
    } catch (err) {
      showMessage('Failed to delete all games: ' + err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <PageLoader />

  const grouped = groupByTime(filtered)
  const editablePools = pools
  const editableTeams = teams
  const editingMatch =
    matches.find(m => m.id === editingMatchId) ?? (editingMatchId === 'new' ? { id: 'new' } : null)

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <ChevronLeft size={20} />
            </Link>
          )}

          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {embedded ? 'Schedule' : 'Schedule Editor'}
            </h1>
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

      {newConflictNotice.length > 0 && (
        <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                New scheduling conflict{newConflictNotice.length !== 1 ? 's' : ''} introduced
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {newConflictNotice.slice(0, 5).map((conflict, index) => (
                  <li key={index}>• {conflict.message}</li>
                ))}
              </ul>
              {newConflictNotice.length > 5 && (
                <p className="text-xs mt-2">
                  +{newConflictNotice.length - 5} more
                </p>
              )}
            </div>

            <button
              onClick={dismissNewConflictNotice}
              className="text-amber-700 hover:text-amber-900 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="border border-[var(--border)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Tournament Days</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Manage the event dates and daily scheduling windows used for schedule generation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={addDay} className="btn-secondary btn btn-sm">
              <Plus size={14} />
              Add day
            </button>

            <button
              onClick={saveTournamentDays}
              disabled={savingDays}
              className="btn-primary btn btn-sm"
            >
              {savingDays ? 'Saving...' : 'Save days'}
            </button>
          </div>
        </div>

        {tournamentDays.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl p-4">
            No tournament days yet. Add at least one day to support schedule generation.
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
                    className="btn-secondary btn btn-sm w-full"
                    onClick={() => removeDay(day.id)}
                  >
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

      <div className="border border-[var(--border)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Schedule Settings</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Configure default scheduling windows and generator settings for this tournament.
            </p>
          </div>

          <button
            onClick={saveScheduleSettings}
            disabled={savingSettings}
            className="btn-primary btn btn-sm"
          >
            {savingSettings ? 'Saving...' : 'Save settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="field-group">
            <label className="field-label text-xs">Default day start time</label>
            <input
              type="time"
              className="field-input text-sm"
              value={scheduleSettings?.startTime || '09:00'}
              onChange={e => updateScheduleSetting('startTime', e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Default day end time</label>
            <input
              type="time"
              className="field-input text-sm"
              value={scheduleSettings?.endTime || '23:00'}
              onChange={e => updateScheduleSetting('endTime', e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Generation scope</label>
            <select
              className="field-input text-sm"
              value={scheduleSettings?.generationMode || 'round'}
              onChange={e => updateScheduleSetting('generationMode', e.target.value)}
            >
              <option value="round">First pool games only</option>
              <option value="all">All pool games</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label text-xs">Game duration (min)</label>
            <input
              type="number"
              className="field-input text-sm"
              min={20}
              step={5}
              value={scheduleSettings?.gameDurationMinutes ?? 90}
              onChange={e =>
                updateScheduleSetting('gameDurationMinutes', Number(e.target.value) || 90)
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
              value={scheduleSettings?.breakBetweenGamesMinutes ?? 30}
              onChange={e =>
                updateScheduleSetting('breakBetweenGamesMinutes', Number(e.target.value) || 30)
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
              value={scheduleSettings?.minRestBetweenTeamGames ?? 90}
              onChange={e =>
                updateScheduleSetting('minRestBetweenTeamGames', Number(e.target.value) || 90)
              }
            />
          </div>
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Schedule Generation</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Generate or clear the tournament schedule using the current settings, venues, teams, pools, and tournament days.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleClearGeneratedSchedule}
              disabled={clearingSchedule || (matches.length === 0 && slots.length === 0)}
              className="btn-secondary btn btn-sm"
            >
              <RotateCcw size={14} />
              {clearingSchedule ? 'Clearing...' : 'Clear schedule'}
            </button>

            <button
              onClick={handleGenerateSchedule}
              disabled={!canGenerateSchedule || generatingSchedule}
              className="btn-primary btn btn-sm"
            >
              <Wand2 size={14} />
              {generatingSchedule ? 'Generating...' : 'Generate schedule'}
            </button>
          </div>
        </div>

        {!canGenerateSchedule && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Add divisions, teams, venues, and tournament days before generating a schedule.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Games" value={matches.length} />
          <SummaryCard label="Time slots" value={slots.length} />
          <SummaryCard label="Conflicts" value={conflicts.length} />
        </div>
      </div>

      {selectedMatchIds.length > 0 && (
        <div className="border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <CheckSquare size={16} className="text-red-500" />
            <span>
              {selectedMatchIds.length} game{selectedMatchIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleSelectAllVisible}
              className="btn-secondary btn btn-sm"
            >
              {allVisibleSelected ? 'Unselect visible' : 'Select all visible'}
            </button>

            <button
              onClick={clearSelection}
              className="btn-secondary btn btn-sm"
            >
              <X size={14} />
              Clear
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={saving === 'bulk-delete'}
              className="btn btn-sm"
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <Trash2 size={14} />
              {saving === 'bulk-delete' ? 'Deleting...' : 'Delete selected'}
            </button>
          </div>
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

      <div className="border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Bulk delete</p>
          <p className="text-xs text-[var(--text-muted)]">
            Remove many games from the active schedule quickly.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleSelectAllVisible}
            className="btn-secondary btn btn-sm"
          >
            {allVisibleSelected ? <Square size={14} /> : <CheckSquare size={14} />}
            {allVisibleSelected ? 'Unselect visible' : 'Select all visible'}
          </button>

          <button
            onClick={handleDeleteAllVisible}
            disabled={visibleMatchIds.length === 0 || saving === 'bulk-delete-visible'}
            className="btn btn-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.16)',
              opacity: visibleMatchIds.length === 0 || saving === 'bulk-delete-visible' ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
            {saving === 'bulk-delete-visible' ? 'Deleting...' : 'Delete all visible'}
          </button>

          <button
            onClick={handleDeleteAllGames}
            disabled={matches.length === 0 || saving === 'bulk-delete-all'}
            className="btn btn-sm"
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
              opacity: matches.length === 0 || saving === 'bulk-delete-all' ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
            {saving === 'bulk-delete-all' ? 'Deleting...' : 'Delete all games'}
          </button>
        </div>
      </div>

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
                    isSelected={selectedMatchIds.includes(m.id)}
                    isDragOver={dragOver === m.time_slot?.id}
                    onToggleSelected={() => toggleSelectedMatch(m.id)}
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

                        const metadataPatch = buildManualEditPatch(m, {
                          team_a_id: m.team_a?.id ?? null,
                          team_b_id: m.team_b?.id ?? null,
                          time_slot_id: slotId || null,
                          venue_id: slot?.venue_id || null,
                        })

                        const { error } = await supabase
                          .from('matches')
                          .update({
                            time_slot_id: slotId || null,
                            venue_id: slot?.venue_id || null,
                            ...metadataPatch,
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
                                ...metadataPatch,
                              }
                            : mx
                        )

                        setMatches(nextMatches)
                        const previousConflicts = conflicts
                        handlePostSaveConflicts(previousConflicts, nextMatches, slots)
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

                        const metadataPatch = buildManualEditPatch(m, {
                          team_a_id: m.team_a?.id ?? null,
                          team_b_id: m.team_b?.id ?? null,
                          time_slot_id: m.time_slot?.id ?? m.time_slot_id ?? null,
                          venue_id: venueId || null,
                        })

                        const { error } = await supabase
                          .from('matches')
                          .update({
                            venue_id: venueId || null,
                            ...metadataPatch,
                          })
                          .eq('id', m.id)

                        if (error) throw error

                        const nextMatches = matches.map(mx =>
                          mx.id === m.id
                            ? {
                                ...mx,
                                venue,
                                venue_id: venueId || null,
                                ...metadataPatch,
                              }
                            : mx
                        )

                        setMatches(nextMatches)
                        const previousConflicts = conflicts
                        handlePostSaveConflicts(previousConflicts, nextMatches, slots)
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
        Drag game cards to swap time slots. Changes save immediately. Use the edit modal for arbitrary date/time scheduling.
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
              maxWidth: 640,
              padding: 24,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {editingMatchId === 'new' ? 'Add game' : 'Edit game'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Update matchup, pool, date, time, field, and round.
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="field-group">
                  <label className="field-label">Date</label>
                  <input
                    type="date"
                    className="field-input"
                    value={editForm.event_date}
                    onChange={e => handleEditFormChange('event_date', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Start time</label>
                  <input
                    type="time"
                    className="field-input"
                    value={editForm.start_time}
                    onChange={e => handleEditFormChange('start_time', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">End time</label>
                  <input
                    type="time"
                    className="field-input"
                    value={editForm.end_time}
                    onChange={e => handleEditFormChange('end_time', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Field</label>
                  <select
                    className="field-input"
                    value={editForm.venue_id}
                    onChange={e => handleEditFormChange('venue_id', e.target.value)}
                  >
                    <option value="">No field</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.short_name ?? v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Suggested slot (optional helper)</label>
                <select
                  className="field-input"
                  value={editForm.time_slot_id}
                  onChange={e => handleEditFormChange('time_slot_id', e.target.value)}
                >
                  <option value="">No suggested slot</option>
                  {slots.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {formatTime(slot.scheduled_start)}
                      {slot.venue ? ` • ${slot.venue.short_name ?? slot.venue.name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Choosing a slot will prefill date, time, and field, but you can still override them.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                Schedule warnings update live after save. Arbitrary date/time edits create or reuse a concrete time slot behind the scenes.
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 gap-3">
              {editingMatchId !== 'new' ? (
                <button
                  onClick={() => handleDeleteMatch(editingMatchId, { closeModal: true })}
                  className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete game
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

      {footer}
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

function MatchEditorCard({
  match: m,
  slots,
  venues,
  isSaving,
  isSelected,
  isDragOver,
  onToggleSelected,
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
        isSelected ? 'ring-2 ring-red-300 border-red-300' : '',
        isDragOver ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)]',
        isSaving ? 'opacity-50' : '',
        isLive ? 'border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)]' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onToggleSelected()
        }}
        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex-shrink-0"
        title={isSelected ? 'Unselect game' : 'Select game'}
      >
        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>

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

        {(m.is_manually_edited || m.schedule_locked || m.pairing_locked) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {hasManualField(m, 'team_a_id') || hasManualField(m, 'team_b_id') ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium">
                Teams changed
              </span>
            ) : null}

            {hasManualField(m, 'scheduled_start') || hasManualField(m, 'scheduled_end') ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 font-medium">
                Time changed
              </span>
            ) : null}

            {hasManualField(m, 'venue_id') ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
                Venue changed
              </span>
            ) : null}

            {m.schedule_locked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-medium">
                Time locked
              </span>
            )}

            {m.pairing_locked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 font-medium">
                Matchup locked
              </span>
            )}
          </div>
        )}
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

function hasManualField(match, field) {
  return Array.isArray(match?.manual_edit_fields) && match.manual_edit_fields.includes(field)
}

function appendUnique(existing = [], fields = []) {
  return [...new Set([...(existing || []), ...fields])]
}

function getChangedMatchFields(prev, next) {
  const changed = []

  if ((prev.team_a?.id ?? null) !== (next.team_a_id ?? null)) {
    changed.push('team_a_id')
  }

  if ((prev.team_b?.id ?? null) !== (next.team_b_id ?? null)) {
    changed.push('team_b_id')
  }

  if ((prev.venue_id ?? prev.venue?.id ?? null) !== (next.venue_id ?? null)) {
    changed.push('venue_id')
  }

  if ((prev.time_slot?.id ?? prev.time_slot_id ?? null) !== (next.time_slot_id ?? null)) {
    changed.push('scheduled_start')
    changed.push('scheduled_end')
  }

  return changed
}

function buildManualEditPatch(prev, next) {
  const changedFields = getChangedMatchFields(prev, next)

  const pairingChanged =
    changedFields.includes('team_a_id') ||
    changedFields.includes('team_b_id')

  const scheduleChanged =
    changedFields.includes('venue_id') ||
    changedFields.includes('scheduled_start') ||
    changedFields.includes('scheduled_end')

  return {
    is_manually_edited: changedFields.length > 0 ? true : prev.is_manually_edited ?? false,
    pairing_locked: pairingChanged ? true : prev.pairing_locked ?? false,
    schedule_locked: scheduleChanged ? true : prev.schedule_locked ?? false,
    manual_edit_fields: appendUnique(prev.manual_edit_fields, changedFields),
  }
}

function getConflictKey(conflict) {
  return `${conflict?.severity || 'info'}|${conflict?.message || ''}`
}

function getNewConflicts(prevConflicts = [], nextConflicts = []) {
  const prevKeys = new Set(prevConflicts.map(getConflictKey))
  return nextConflicts.filter(conflict => !prevKeys.has(getConflictKey(conflict)))
}

async function findOrCreateTimeSlot({
  tournamentId,
  venueId,
  scheduledStart,
  scheduledEnd,
}) {
  const startIso = scheduledStart.toISOString()
  const endIso = scheduledEnd.toISOString()

  const { data: existing, error: existingError } = await supabase
    .from('time_slots')
    .select('id, venue_id, scheduled_start, scheduled_end, offset_minutes')
    .eq('tournament_id', tournamentId)
    .eq('venue_id', venueId)
    .eq('scheduled_start', startIso)
    .eq('scheduled_end', endIso)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing

  const { data: created, error: insertError } = await supabase
    .from('time_slots')
    .insert({
      tournament_id: tournamentId,
      venue_id: venueId,
      scheduled_start: startIso,
      scheduled_end: endIso,
      offset_minutes: 0,
    })
    .select('id, venue_id, scheduled_start, scheduled_end, offset_minutes')
    .single()

  if (insertError) throw insertError
  return created
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  return new Date(`${dateStr}T${timeStr}:00`)
}

function formatDateInputValue(iso) {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeInputValue(iso) {
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr) return ''
  const [hh, mm] = timeStr.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return ''
  const total = hh * 60 + mm + Number(minutesToAdd || 0)
  const normalized = ((total % 1440) + 1440) % 1440
  const nextH = String(Math.floor(normalized / 60)).padStart(2, '0')
  const nextM = String(normalized % 60).padStart(2, '0')
  return `${nextH}:${nextM}`
}

function newScheduleDay(
  index,
  fallbackDate = '',
  defaultStartTime = '09:00',
  defaultEndTime = '23:00'
) {
  return {
    id: crypto.randomUUID(),
    dayIndex: index,
    eventDate: fallbackDate,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    label: '',
    isNew: true,
  }
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

function normalizeGeneratedSlot(slot) {
  return {
    id: slot?.id ?? null,
    venue_id: slot?.venue_id ?? slot?.venueId ?? null,
    scheduled_start: slot?.scheduled_start ?? null,
    scheduled_end: slot?.scheduled_end ?? null,
    offset_minutes: slot?.offset_minutes ?? 0,
  }
}

function normalizeGeneratedMatch(match, index = 0) {
  return {
    id: match?.id ?? null,
    division_id: match?.division_id ?? match?.divisionId ?? null,
    pool_id: match?.pool_id ?? match?.poolId ?? null,
    team_a_id: match?.team_a_id ?? match?.teamAId ?? null,
    team_b_id: match?.team_b_id ?? match?.teamBId ?? null,
    slot_id: match?.slot_id ?? match?.slotId ?? null,
    venue_id: match?.venue_id ?? match?.venueId ?? null,
    round: match?.round ?? 1,
    match_number: match?.match_number ?? match?.matchNumber ?? index + 1,
    phase: match?.phase ?? 1,
  }
}

function validateGeneratedSchedulePayload(slots = [], matches = []) {
  const errors = []

  const normalizedSlots = slots.map(normalizeGeneratedSlot)
  const normalizedMatches = matches.map(normalizeGeneratedMatch)

  normalizedSlots.forEach((slot, index) => {
    if (!slot.id) errors.push(`Generated slot ${index + 1} is missing an id.`)
    if (!slot.venue_id) errors.push(`Generated slot ${index + 1} is missing a venue_id.`)
    if (!slot.scheduled_start) errors.push(`Generated slot ${index + 1} is missing scheduled_start.`)
    if (!slot.scheduled_end) errors.push(`Generated slot ${index + 1} is missing scheduled_end.`)
  })

  normalizedMatches.forEach((match, index) => {
    if (!match.team_a_id) errors.push(`Generated match ${index + 1} is missing team_a_id.`)
    if (!match.team_b_id) errors.push(`Generated match ${index + 1} is missing team_b_id.`)
    if (match.team_a_id && match.team_b_id && match.team_a_id === match.team_b_id) {
      errors.push(`Generated match ${index + 1} has the same team on both sides.`)
    }
    if (!match.round) errors.push(`Generated match ${index + 1} is missing a round.`)
  })

  return {
    errors,
    normalizedSlots,
    normalizedMatches,
  }
}