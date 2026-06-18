import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { getMatchSourceLabels } from '../../../lib/playoffs/matchSourceLabels'
import {
  Check,
  Trophy,
  Users,
  MapPin,
  Calendar,
  Layers,
  ExternalLink,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { FORMAT_LABELS, TOURNAMENT_STATUS } from '../../../lib/constants'

const PROTECTED_MATCH_STATUSES = ['complete', 'forfeit', 'in_progress']

export function WizardStep8Preview({ onBack, isLast }) {
  const navigate = useNavigate()

  const {
    name,
    slug,
    startDate,
    endDate,
    venueName,
    venueAddress,
    timezone,
    primaryColor,
    divisions,
    venues,
    teams,
    pools,
    generatedMatches,
    generatedPlayoffMatches,
    generatedSlots,
    tournamentId,
    isPublished,
    setPublished,
  } = useWizardStore()

  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  const [savedMatches, setSavedMatches] = useState([])
  const [savedSlots, setSavedSlots] = useState([])
  const [hasProtectedMatches, setHasProtectedMatches] = useState(false)
  const [showCompletedMatches, setShowCompletedMatches] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSavedSchedule() {
      if (!tournamentId) {
        if (active) {
          setSavedMatches([])
          setSavedSlots([])
          setHasProtectedMatches(false)
        }
        return
      }

      const { data: slotData } = await db.timeSlots.byTournament(tournamentId)

      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          id,
          round,
          match_number,
          division_id,
          pool_id,
          venue_id,
          time_slot_id,
          team_a_id,
          team_b_id,
          status,
          score_a,
          score_b,
          winner_id,
          round_label,
          display_label,
          phase,
          bracket_position,
          match_code,
          bracket_type,
          source_a_type,
          source_a_ref,
          source_b_type,
          source_b_ref,
          winner_to_match_code,
          winner_to_slot,
          loser_to_match_code,
          loser_to_slot,
          placement_min,
          placement_max
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .order('match_number')

      if (!active) return

      const nextMatches = matchData ?? []

      setSavedSlots(slotData ?? [])
      setSavedMatches(nextMatches)
      setHasProtectedMatches(
        nextMatches.some(m => PROTECTED_MATCH_STATUSES.includes(m.status))
      )
    }

    loadSavedSchedule()

    return () => {
      active = false
    }
  }, [tournamentId])

  async function handlePublish() {
    if (!tournamentId) return

    setPublishing(true)
    setError(null)

    try {
      const { data: protectedMatches, error: protectedMatchesErr } = await supabase
        .from('matches')
        .select('id, status')
        .eq('tournament_id', tournamentId)
        .in('status', PROTECTED_MATCH_STATUSES)

      if (protectedMatchesErr) {
        throw new Error(`Failed to check protected matches: ${protectedMatchesErr.message}`)
      }

      const hasProtected = (protectedMatches ?? []).length > 0
      const playoffMatchesToSave = generatedPlayoffMatches ?? []

      if (hasProtected) {
        if (playoffMatchesToSave.length === 0) {
          throw new Error(
            'This tournament already has completed, forfeited, or live matches. Full publish replacement is disabled to protect recorded results. Generate playoff matches and use safe append instead.'
          )
        }

        const { savePlayoffMatchesSafe } = await import('../../../lib/playoffs/savePlayoffMatchesSafe')

        const result = await savePlayoffMatchesSafe({
          tournamentId,
          playoffMatches: playoffMatchesToSave,
          divisions,
          teams,
          pools,
          venues,
        })

        if (result.warnings?.length) {
          console.warn('[Safe playoff append warnings]', result.warnings)
        }

        await db.tournaments.update(tournamentId, {
          name: name?.trim() || 'Untitled Tournament',
          slug: slug?.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          venue_name: venueName?.trim() || null,
          venue_address: venueAddress?.trim() || null,
          timezone: timezone || 'America/Toronto',
          primary_color: primaryColor || '#1a56db',
          status: TOURNAMENT_STATUS.PUBLISHED,
        })

        setPublished()
        return
      }

      const scheduleMatchesToSave = [
        ...(generatedMatches ?? []),
        ...(generatedPlayoffMatches ?? []),
      ]

      const inlinePlayoffSlots = (generatedPlayoffMatches ?? [])
        .filter(match =>
          (match.slot_id || match.slotId || match.time_slot_id) &&
          (match.scheduled_start || match.scheduledStart) &&
          (match.scheduled_end || match.scheduledEnd) &&
          (match.venue_id || match.venueId)
        )
        .map(match => ({
          id: match.slot_id || match.slotId || match.time_slot_id,
          venue_id: match.venue_id || match.venueId || null,
          scheduled_start: match.scheduled_start || match.scheduledStart || null,
          scheduled_end: match.scheduled_end || match.scheduledEnd || null,
        }))

      const scheduleSlotsToSave = Array.from(
        new Map(
          [
            ...(generatedSlots ?? []),
            ...inlinePlayoffSlots,
          ].map(slot => [slot.id, slot])
        ).values()
      )

      const divisionDbIdByLocalId = Object.fromEntries(
        (divisions ?? [])
          .filter(div => div.id && div.dbId)
          .map(div => [div.id, div.dbId])
      )

      const poolDbIdByLocalId = Object.fromEntries(
        (pools ?? [])
          .filter(pool => pool.id && pool.dbId)
          .map(pool => [pool.id, pool.dbId])
      )

      const teamDbIdByLocalId = Object.fromEntries(
        (teams ?? [])
          .filter(team => team.id && team.dbId)
          .map(team => [team.id, team.dbId])
      )

      const venueDbIdByLocalId = Object.fromEntries(
        (venues ?? [])
          .filter(venue => venue.id && venue.dbId)
          .map(venue => [venue.id, venue.dbId])
      )

      const { error: deleteMatchesErr } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)

      if (deleteMatchesErr) {
        throw new Error(`Failed to clear existing saved matches: ${deleteMatchesErr.message}`)
      }

      const { error: deleteSlotsErr } = await supabase
        .from('time_slots')
        .delete()
        .eq('tournament_id', tournamentId)

      if (deleteSlotsErr) {
        throw new Error(`Failed to clear existing saved time slots: ${deleteSlotsErr.message}`)
      }

      const slotDbIdByLocalId = {}
      const insertedSlotRecords = []

      for (const slot of scheduleSlotsToSave) {
        const localVenueId = slot.venue_id || slot.venueId || null
        const venueDbId = venueDbIdByLocalId[localVenueId] || localVenueId || null
        const scheduledStart = slot.scheduled_start || null
        const scheduledEnd = slot.scheduled_end || null

        const payload = {
          tournament_id: tournamentId,
          venue_id: venueDbId,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
        }

        const { data: insertedSlot, error: insertSlotErr } = await supabase
          .from('time_slots')
          .insert(payload)
          .select('id, venue_id, scheduled_start, scheduled_end')
          .single()

        if (insertSlotErr) {
          throw new Error(`Failed to save time slot: ${insertSlotErr.message}`)
        }

        if (slot.id) {
          slotDbIdByLocalId[String(slot.id)] = insertedSlot.id
        }

        insertedSlotRecords.push(insertedSlot)
      }

      for (const match of scheduleMatchesToSave) {
        const localDivisionId = match.division_id || match.divisionId || null
        const localPoolId = match.pool_id || match.poolId || null
        const localTeamAId = match.team_a_id || match.teamAId || null
        const localTeamBId = match.team_b_id || match.teamBId || null
        const localVenueId = match.venue_id || match.venueId || null
        const localSlotId = match.slot_id || match.slotId || match.time_slot_id || null

        const divisionDbId = divisionDbIdByLocalId[localDivisionId] || localDivisionId || null
        const poolDbId = poolDbIdByLocalId[localPoolId] || localPoolId || null
        const teamADbId = teamDbIdByLocalId[localTeamAId] || localTeamAId || null
        const teamBDbId = teamDbIdByLocalId[localTeamBId] || localTeamBId || null
        const venueDbId = venueDbIdByLocalId[localVenueId] || localVenueId || null

        const scheduledStart = match.scheduled_start || match.scheduledStart || null
        const scheduledEnd = match.scheduled_end || match.scheduledEnd || null

        const scheduledStartMs = scheduledStart ? new Date(scheduledStart).getTime() : null
        const scheduledEndMs = scheduledEnd ? new Date(scheduledEnd).getTime() : null

        const fallbackSlot = insertedSlotRecords.find(slot => {
          if (!venueDbId || !scheduledStartMs) return false
          if (slot.venue_id !== venueDbId) return false

          const slotStartMs = slot.scheduled_start ? new Date(slot.scheduled_start).getTime() : null
          const slotEndMs = slot.scheduled_end ? new Date(slot.scheduled_end).getTime() : null

          if (slotStartMs !== scheduledStartMs) return false

          if (scheduledEndMs != null && slotEndMs != null) {
            return slotEndMs === scheduledEndMs
          }

          return true
        })

        const slotDbId =
          (localSlotId ? slotDbIdByLocalId[String(localSlotId)] : null) ||
          fallbackSlot?.id ||
          null

        const payload = {
          tournament_id: tournamentId,
          division_id: divisionDbId,
          pool_id: poolDbId,
          venue_id: venueDbId,
          time_slot_id: slotDbId,
          team_a_id: teamADbId,
          team_b_id: teamBDbId,
          round: match.round ?? null,
          match_number: match.match_number ?? null,
          round_label: match.round_label || match.roundLabel || null,
          display_label: match.display_label || match.displayLabel || null,
          status: match.status || 'scheduled',
          phase: match.phase || null,
          bracket_position: match.bracket_position ?? null,
          match_code: match.match_code || match.matchCode || null,
          bracket_type: match.bracket_type || match.bracketType || null,
          source_a_type: match.source_a_type || null,
          source_a_ref: match.source_a_ref || null,
          source_b_type: match.source_b_type || null,
          source_b_ref: match.source_b_ref || null,
          winner_to_match_code: match.winner_to_match_code || null,
          winner_to_slot: match.winner_to_slot || null,
          loser_to_match_code: match.loser_to_match_code || null,
          loser_to_slot: match.loser_to_slot || null,
          placement_min: match.placement_min ?? null,
          placement_max: match.placement_max ?? null,
        }

        const { error: insertMatchErr } = await supabase
          .from('matches')
          .insert(payload)

        if (insertMatchErr) {
          throw new Error(`Failed to save match: ${insertMatchErr.message}`)
        }
      }

      await db.tournaments.update(tournamentId, {
        name: name?.trim() || 'Untitled Tournament',
        slug: slug?.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        venue_name: venueName?.trim() || null,
        venue_address: venueAddress?.trim() || null,
        timezone: timezone || 'America/Toronto',
        primary_color: primaryColor || '#1a56db',
        status: TOURNAMENT_STATUS.PUBLISHED,
      })

      setPublished()
    } catch (err) {
      console.error('[Step8 publish] Error:', err)
      setError(err.message || 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  function handleGoToDashboard() {
    useWizardStore.getState().reset()
    navigate('/director')
  }

  function handleViewPublic() {
    window.open(`/t/${slug}`, '_blank')
  }

  const localCombinedMatches = [
    ...(generatedMatches ?? []),
    ...(generatedPlayoffMatches ?? []),
  ]

  const playoffMatchesToAppend = generatedPlayoffMatches ?? []

  const allScheduleMatches = savedMatches.length > 0 ? savedMatches : localCombinedMatches

  const inlinePreviewPlayoffSlots = (generatedPlayoffMatches ?? [])
    .filter(match =>
      (match.slot_id || match.slotId || match.time_slot_id) &&
      (match.scheduled_start || match.scheduledStart) &&
      (match.scheduled_end || match.scheduledEnd) &&
      (match.venue_id || match.venueId)
    )
    .map(match => ({
      id: match.slot_id || match.slotId || match.time_slot_id,
      venue_id: match.venue_id || match.venueId || null,
      scheduled_start: match.scheduled_start || match.scheduledStart || null,
      scheduled_end: match.scheduled_end || match.scheduledEnd || null,
    }))

  const scheduleSlots = savedSlots.length > 0
    ? savedSlots
    : Array.from(
        new Map(
          [
            ...(generatedSlots ?? []),
            ...inlinePreviewPlayoffSlots,
          ].map(slot => [slot.id, slot])
        ).values()
      )

  const scheduleMatches = showCompletedMatches
    ? allScheduleMatches
    : allScheduleMatches.filter(
        m => !['complete', 'forfeit'].includes(m.status)
      )

  const teamMap = Object.fromEntries(
    teams.map(t => [t.dbId || t.id, t])
  )

  const poolMap = Object.fromEntries(
    pools.map(p => [p.dbId || p.id, p])
  )

  const divisionMap = Object.fromEntries(
    divisions.map(d => [d.dbId || d.id, d])
  )

  const venueMap = Object.fromEntries(
    venues.map(v => [v.dbId || v.id, v])
  )

  const slotMap = Object.fromEntries(
    scheduleSlots.map(s => [s.id, s])
  )

  const normalizedTeams = teams.map(t => ({
    id: t.dbId || t.id,
    name: t.name,
    short_name: t.shortName || null,
  }))

  const normalizedPools = pools.map(p => ({
    id: p.dbId || p.id,
    name: p.name,
    short_name: p.shortName || null,
  }))

  const byTime = {}
  for (const m of scheduleMatches) {
    const slot =
      slotMap[m.slot_id || m.time_slot_id] ||
      ((m.scheduled_start || m.scheduledStart)
        ? {
            scheduled_start: m.scheduled_start || m.scheduledStart,
          }
        : null)

    const key = slot ? slot.scheduled_start : 'unscheduled'
    if (!byTime[key]) byTime[key] = []
    byTime[key].push(m)
  }

  const timeGroups = Object.entries(byTime).sort(([a], [b]) => {
    if (a === 'unscheduled') return 1
    if (b === 'unscheduled') return -1
    return a.localeCompare(b)
  })

  if (isPublished) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check size={28} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tournament published!</h2>
          <p className="text-[var(--text-muted)] mt-2">
            <strong>{name}</strong> is now live and visible to spectators.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={handleViewPublic} className="btn-secondary btn">
            <ExternalLink size={16} />
            View public page
          </button>
          <button onClick={handleGoToDashboard} className="btn-primary btn">
            <Trophy size={16} />
            Go to Director HQ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Preview & Publish</h2>
        <p className="section-subtitle">Review your tournament setup, then publish to make it live.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {hasProtectedMatches && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          This tournament already contains completed, forfeited, or live matches. Full publish replacement is disabled to protect recorded results. Completed games must never be deleted. Playoff structures can still be appended safely.
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="h-12 flex items-center px-5 gap-3" style={{ backgroundColor: primaryColor }}>
          <Trophy size={18} className="text-[var(--bg-base)]" />
          <h3 className="text-[var(--bg-base)] font-bold text-lg">{name || 'Untitled Tournament'}</h3>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryItem
            icon={<Calendar size={14} />}
            label="Dates"
            value={startDate === endDate
              ? formatDate(startDate)
              : `${formatDate(startDate)} – ${formatDate(endDate)}`
            }
          />
          <SummaryItem icon={<MapPin size={14} />} label="Venue" value={venueName || '—'} />
          <SummaryItem icon={<Layers size={14} />} label="Divisions" value={divisions.length} />
          <SummaryItem icon={<Users size={14} />} label="Teams" value={teams.length} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Divisions</h3>
        <div className="space-y-2">
          {divisions.map(div => {
            const divTeams = teams.filter(t => t.divisionId === div.id)
            const divPools = pools.filter(p => p.divisionId === div.id)
            const divGames = scheduleMatches.filter(
              m =>
                m.division_id === div.id ||
                pools.some(p => p.id === m.pool_id && p.divisionId === div.id)
            )

            return (
              <div key={div.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{div.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{FORMAT_LABELS[div.formatType] ?? div.formatType}</p>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-secondary)]">{divTeams.length}</p>
                    <p className="text-xs text-[var(--text-muted)]">teams</p>
                  </div>
                  {divPools.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">{divPools.length}</p>
                      <p className="text-xs text-[var(--text-muted)]">pools</p>
                    </div>
                  )}
                  {divGames.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">{divGames.length}</p>
                      <p className="text-xs text-[var(--text-muted)]">games</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Fields / Courts</h3>
        <div className="flex flex-wrap gap-2">
          {venues.map(v => (
            <span key={v.id} className="badge badge-blue text-xs">{v.name}</span>
          ))}
        </div>
      </div>

      {hasProtectedMatches && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              Playoff matches to append
            </h3>
            <p className="text-xs text-amber-800 mt-1">
              These playoff matches will be added to the existing tournament schedule without removing completed, forfeited, or live games.
            </p>
          </div>

          {playoffMatchesToAppend.length === 0 ? (
            <p className="text-sm text-amber-800">No playoff matches are currently queued to append.</p>
          ) : (
            <div className="space-y-2">
              {playoffMatchesToAppend.map(match => {
                const teamA = teamMap[match.team_a_id] || null
                const teamB = teamMap[match.team_b_id] || null

                const slotId = match.slot_id || match.slotId || match.time_slot_id || null
                const slot =
                  slotMap[slotId] ||
                  ((match.scheduled_start || match.scheduledStart)
                    ? {
                        scheduled_start: match.scheduled_start || match.scheduledStart,
                        venue_id: match.venue_id || match.venueId || null,
                      }
                    : null)

                const venueId = match.venue_id || match.venueId || slot?.venue_id || null
                const venue = venueMap[venueId] || null

                const sourceLabels = getMatchSourceLabels({
                  match,
                  teams: normalizedTeams,
                  pools: normalizedPools,
                })

                const label =
                  match.match_code ||
                  match.display_label ||
                  match.round_label ||
                  (match.round ? `Round ${match.round}` : 'Playoff match')

                return (
                  <div
                    key={match.id}
                    className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-amber-950">
                      {label}
                    </p>

                    <p className="text-xs text-amber-900 mt-1">
                      {(teamA?.shortName || teamA?.name || sourceLabels.aPrimary || 'TBD')}
                      {' vs '}
                      {(teamB?.shortName || teamB?.name || sourceLabels.bPrimary || 'TBD')}
                    </p>

                    <p className="text-xs text-amber-700 mt-1">
                      {slot?.scheduled_start
                        ? formatDateTime(slot.scheduled_start)
                        : 'Unscheduled'}
                      {' • '}
                      {venue?.shortName || venue?.name || 'Venue: —'}
                    </p>

                    <p className="text-[11px] text-amber-700 mt-1">
                      {match.bracket_type ? `${match.bracket_type} bracket` : 'playoff'}
                      {match.round ? ` • Round ${match.round}` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Scheduled Games</h3>

          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={showCompletedMatches}
              onChange={e => setShowCompletedMatches(e.target.checked)}
            />
            Show completed games
          </label>
        </div>

        {scheduleMatches.length === 0 ? (
          <div className="p-4 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">
            No games scheduled yet.
          </div>
        ) : (
          <div className="space-y-4">
            {timeGroups.map(([timeKey, groupMatches]) => (
              <div key={timeKey}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1">
                    <Clock size={11} />
                    {timeKey === 'unscheduled' ? 'Unscheduled' : formatTime(timeKey)}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-xs text-[var(--text-muted)]">
                    {groupMatches.length} game{groupMatches.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {groupMatches.map(m => {
                    const teamA = teamMap[m.team_a_id]
                    const teamB = teamMap[m.team_b_id]
                    const pool = poolMap[m.pool_id]
                    const division =
                      divisionMap[m.division_id] ||
                      (pool ? divisionMap[pool.divisionId] : null)
                    const venue = venueMap[m.venue_id]
                    const slot =
                      slotMap[m.slot_id || m.time_slot_id] ||
                      ((m.scheduled_start || m.scheduledStart)
                        ? {
                            scheduled_start: m.scheduled_start || m.scheduledStart,
                          }
                        : null)

                    const sourceLabels = getMatchSourceLabels({
                      match: m,
                      teams: normalizedTeams,
                      pools: normalizedPools,
                    })

                    const isBracketMatch = !!(m.bracket_type || m.match_code)
                    const hasResolvedBracketTeams = isBracketMatch && !!(teamA?.id && teamB?.id)

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
                              {teamA?.shortName ?? teamA?.name ?? sourceLabels.aPrimary}
                            </span>
                            <span className="text-[var(--text-muted)] text-xs">vs</span>
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: teamB?.primaryColor ?? '#e5e7eb' }}
                            />
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {teamB?.shortName ?? teamB?.name ?? sourceLabels.bPrimary}
                            </span>
                          </div>

                          {hasResolvedBracketTeams && sourceLabels.aPrimary && sourceLabels.bPrimary && (
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {sourceLabels.aPrimary} vs {sourceLabels.bPrimary}
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {division && (
                              <p className="text-xs text-[var(--text-muted)]">{division.name}</p>
                            )}
                            {pool && (
                              <p className="text-xs text-[var(--text-muted)]">{pool.name}</p>
                            )}
                            {m.bracket_type && (
                              <p className="text-xs text-[var(--text-muted)] capitalize">{m.bracket_type}</p>
                            )}
                            {m.round && (
                              <p className="text-xs text-[var(--text-muted)]">Round {m.round}</p>
                            )}
                            {slot?.scheduled_start && (
                              <p className="text-xs text-[var(--text-muted)]">
                                {formatDateTime(slot.scheduled_start)}
                              </p>
                            )}
                            {PROTECTED_MATCH_STATUSES.includes(m.status) && (
                              <p className="text-xs text-green-700 font-medium uppercase tracking-wide">
                                {m.status}
                              </p>
                            )}
                          </div>
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
      </div>

      <div className="p-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-mono break-all">
        /t/<strong>{slug}</strong>
      </div>

      <div className="space-y-1.5">
        <ChecklistItem ok={!!name} label="Tournament name set" />
        <ChecklistItem ok={divisions.length > 0} label={`${divisions.length} division${divisions.length !== 1 ? 's' : ''} configured`} />
        <ChecklistItem ok={venues.length > 0} label={`${venues.length} field${venues.length !== 1 ? 's' : ''} added`} />
        <ChecklistItem ok={teams.length > 0} label={`${teams.length} team${teams.length !== 1 ? 's' : ''} registered`} />
        <ChecklistItem ok={allScheduleMatches.length > 0} label={`${allScheduleMatches.length} games scheduled`} warn={allScheduleMatches.length === 0} />
        <ChecklistItem
          ok={!hasProtectedMatches}
          label={
            hasProtectedMatches
              ? 'Protected matches detected — only safe playoff append is allowed'
              : 'No protected matches detected'
          }
          warn={hasProtectedMatches}
        />
      </div>

      <WizardNavButtons
        onNext={handlePublish}
        onBack={onBack}
        saving={publishing}
        nextLabel={
          hasProtectedMatches
            ? 'Safely append playoff matches'
            : 'Publish tournament 🚀'
        }
        isLast={isLast}
      />
    </div>
  )
}

function SummaryItem({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

function ChecklistItem({ ok, label, warn = false }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? 'text-[var(--text-secondary)]' : warn ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-green-100' : warn ? 'bg-amber-100' : ''}`}>
        {ok
          ? <Check size={12} className="text-green-600" />
          : <span className="text-[var(--text-muted)] text-xs">–</span>
        }
      </div>
      {label}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}