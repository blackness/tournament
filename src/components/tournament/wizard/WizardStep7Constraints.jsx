import { useMemo } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { WizardNavButtons } from './WizardNavButtons'
import { validateSchedule } from '../../../lib/scheduleGenerator'
import { AlertTriangle, Check, Clock, Home } from 'lucide-react'

const CONFLICT_ICONS = {
  same_club: <Home size={13} />,
  rest_time: <Clock size={13} />,
  field_clash: <AlertTriangle size={13} />,
  slot_double_booked: <AlertTriangle size={13} />,
  team_overlap: <AlertTriangle size={13} />,
  unscheduled: <AlertTriangle size={13} />,
  missing_slot: <AlertTriangle size={13} />,
  missing_team: <AlertTriangle size={13} />,
  slot_venue_mismatch: <AlertTriangle size={13} />,
  team_self: <AlertTriangle size={13} />,
  default: <AlertTriangle size={13} />,
}

export function WizardStep7Constraints({ onNext, onBack }) {
  const {
    teams,
    venues,
    generatedMatches,
    generatedPlayoffMatches,
    generatedSlots,
    scheduleConfig,
    acknowledgedConflicts,
    acknowledgeConflict,
  } = useWizardStore()

  const effectiveMatches = useMemo(
    () => [
      ...(generatedMatches ?? []),
      ...(generatedPlayoffMatches ?? []),
    ],
    [generatedMatches, generatedPlayoffMatches]
  )

  const inlinePlayoffSlots = useMemo(
    () =>
      (generatedPlayoffMatches ?? [])
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
        })),
    [generatedPlayoffMatches]
  )

  const effectiveSlots = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...(generatedSlots ?? []),
            ...inlinePlayoffSlots,
          ].map(slot => [slot.id, slot])
        ).values()
      ),
    [generatedSlots, inlinePlayoffSlots]
  )

  const liveConflicts = useMemo(() => {
    const minRestBetweenTeamGames = Number(scheduleConfig?.minRestBetweenTeamGames ?? 90)
    return validateSchedule(effectiveMatches, effectiveSlots, minRestBetweenTeamGames)
  }, [effectiveMatches, effectiveSlots, scheduleConfig?.minRestBetweenTeamGames])

  const matchMap = useMemo(
    () => Object.fromEntries(effectiveMatches.map(m => [m.id, m])),
    [effectiveMatches]
  )

  const slotMap = useMemo(
    () => Object.fromEntries(effectiveSlots.map(s => [s.id, s])),
    [effectiveSlots]
  )

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map(t => [t.dbId || t.id, t])),
    [teams]
  )

  const venueMap = useMemo(
    () => Object.fromEntries(venues.map(v => [v.dbId || v.id, v])),
    [venues]
  )

  const errors = liveConflicts.filter(c => c.severity === 'error')
  const warnings = liveConflicts.filter(c => c.severity === 'warning')

  const unacknowledgedErrors = errors.filter(
    c => !acknowledgedConflicts.includes(`${c.type}:${c.teamId}`)
  )

  const scheduledEffectiveMatches = effectiveMatches.filter(
    m => !!(m.slot_id || m.slotId || m.time_slot_id || m.scheduled_start || m.scheduledStart)
  )

  const playoffGeneratedCount = (generatedPlayoffMatches ?? []).length

  const playoffScheduledCount = (generatedPlayoffMatches ?? []).filter(
    m => !!(m.slot_id || m.slotId || m.time_slot_id || m.scheduled_start || m.scheduledStart)
  ).length

  const scheduledMatchList = useMemo(() => {
    return [...scheduledEffectiveMatches].sort((a, b) => {
      const aSlotId = a.slot_id || a.slotId || a.time_slot_id || null
      const bSlotId = b.slot_id || b.slotId || b.time_slot_id || null

      const aStart = aSlotId && slotMap[aSlotId]?.scheduled_start
        ? new Date(slotMap[aSlotId].scheduled_start).getTime()
        : Infinity

      const bStart = bSlotId && slotMap[bSlotId]?.scheduled_start
        ? new Date(slotMap[bSlotId].scheduled_start).getTime()
        : Infinity

      if (aStart !== bStart) return aStart - bStart

      return String(a.match_code || a.display_label || a.id).localeCompare(
        String(b.match_code || b.display_label || b.id)
      )
    })
  }, [scheduledEffectiveMatches, slotMap])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Constraint Review</h2>
        <p className="section-subtitle">
          Review scheduling conflicts before publishing.
          Conflicts are informational only — you decide how to handle them.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-4 text-center ${errors.length > 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{errors.length}</p>
          <p className={`text-xs mt-0.5 ${errors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>Errors</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${warnings.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${warnings.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{warnings.length}</p>
          <p className={`text-xs mt-0.5 ${warnings.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>Warnings</p>
        </div>
        <div className="rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text-secondary)]">{teams.length}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Teams</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--bg-surface)]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[var(--text-muted)] text-xs">Total scheduled games</p>
            <p className="font-semibold text-[var(--text-primary)] mt-1">
              {scheduledEffectiveMatches.length}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] text-xs">Playoff games generated</p>
            <p className="font-semibold text-[var(--text-primary)] mt-1">
              {playoffGeneratedCount}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] text-xs">Playoff games scheduled</p>
            <p className="font-semibold text-[var(--text-primary)] mt-1">
              {playoffScheduledCount}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--bg-surface)]">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Games currently scheduled
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Review the games currently placed in the schedule, including playoff games.
          </p>
        </div>

        {scheduledMatchList.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No games are scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {scheduledMatchList.map(match => {
              const slotId = match.slot_id || match.slotId || match.time_slot_id || null
              const slot = slotId ? slotMap[slotId] : null
              const venueId = match.venue_id || match.venueId || slot?.venue_id || null
              const venue = venueMap[venueId] || null
              const teamA = teamMap[match.team_a_id] || null
              const teamB = teamMap[match.team_b_id] || null

              const label =
                match.match_code ||
                match.display_label ||
                match.round_label ||
                (match.round ? `Round ${match.round}` : 'Game')

              return (
                <div
                  key={match.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--bg-raised)]"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {(teamA?.shortName || teamA?.name || 'TBD')} vs {(teamB?.shortName || teamB?.name || 'TBD')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {slot?.scheduled_start
                      ? new Date(slot.scheduled_start).toLocaleString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : 'Unscheduled'}
                    {' • '}
                    {venue?.shortName || venue?.name || 'Venue: —'}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {liveConflicts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-green-600">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Check size={22} />
          </div>
          <p className="font-medium">No scheduling conflicts found!</p>
          <p className="text-sm text-[var(--text-muted)]">Your schedule looks good. Continue to publish.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((c, i) => {
            const key = `${c.type}:${c.teamId}`
            const acked = acknowledgedConflicts.includes(key)
            return (
              <ConflictRow
                key={`e-${i}`}
                conflict={c}
                acknowledged={acked}
                onAcknowledge={() => acknowledgeConflict(key)}
                matchMap={matchMap}
                slotMap={slotMap}
                teamMap={teamMap}
              />
            )
          })}

          {warnings.map((c, i) => {
            const key = `${c.type}:${c.teamId}`
            const acked = acknowledgedConflicts.includes(key)
            return (
              <ConflictRow
                key={`w-${i}`}
                conflict={c}
                acknowledged={acked}
                onAcknowledge={() => acknowledgeConflict(key)}
                matchMap={matchMap}
                slotMap={slotMap}
                teamMap={teamMap}
              />
            )
          })}
        </div>
      )}

      {unacknowledgedErrors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            {unacknowledgedErrors.length} unacknowledged error{unacknowledgedErrors.length !== 1 ? 's' : ''}.
            Acknowledge each one to proceed — conflicts are <strong>informational only</strong> and won't block publishing.
          </span>
        </div>
      )}

      <WizardNavButtons
        onNext={onNext}
        onBack={onBack}
        nextDisabled={unacknowledgedErrors.length > 0}
        nextLabel="Continue to preview"
      />
    </div>
  )
}

function ConflictRow({ conflict, acknowledged, onAcknowledge, matchMap, slotMap, teamMap }) {
  const isError = conflict.severity === 'error'
  const relatedMatches = (conflict.matchIds || [])
    .map(id => matchMap?.[id])
    .filter(Boolean)

  return (
    <div
      className={`flex gap-3 p-3 rounded-xl border transition-opacity ${
        acknowledged ? 'opacity-50' : ''
      } ${
        isError
          ? 'bg-red-50 border-red-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}
    >
      <div className={`flex-shrink-0 mt-0.5 ${isError ? 'text-red-500' : 'text-yellow-600'}`}>
        {CONFLICT_ICONS[conflict.type] ?? CONFLICT_ICONS.default}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isError ? 'text-red-800' : 'text-yellow-800'}`}>
          {conflict.message}
        </p>

        {conflict.matchIds?.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Affects {conflict.matchIds.length} game{conflict.matchIds.length !== 1 ? 's' : ''}
          </p>
        )}

        {relatedMatches.length > 0 && (
          <div className="mt-2 space-y-1">
            {relatedMatches.map(match => (
              <p
                key={match.id}
                className="text-xs text-[var(--text-muted)] break-words"
              >
                • {formatConstraintMatch(match, slotMap, teamMap)}
              </p>
            ))}
          </div>
        )}
      </div>

      {!acknowledged ? (
        <button
          onClick={onAcknowledge}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg font-medium ${
            isError
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }`}
        >
          Acknowledge
        </button>
      ) : (
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)] flex items-center gap-1">
          <Check size={12} /> OK
        </span>
      )}
    </div>
  )
}

function formatConstraintMatch(match, slotMap, teamMap) {
  const slotId = match.slot_id || match.slotId || match.time_slot_id || null
  const slot = slotId ? slotMap?.[slotId] : null

  const teamA = teamMap?.[match.team_a_id] || null
  const teamB = teamMap?.[match.team_b_id] || null

  const label =
    match.match_code ||
    match.display_label ||
    match.round_label ||
    (match.round ? `Round ${match.round}` : 'Game')

  const teamLabelA = teamA?.shortName || teamA?.name || 'TBD'
  const teamLabelB = teamB?.shortName || teamB?.name || 'TBD'

  const timeLabel = slot?.scheduled_start
    ? new Date(slot.scheduled_start).toLocaleString('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Unscheduled'

  return `${label} — ${teamLabelA} vs ${teamLabelB} — ${timeLabel}`
}