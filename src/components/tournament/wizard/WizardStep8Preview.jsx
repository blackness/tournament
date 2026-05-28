import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { Check, Trophy, Users, MapPin, Calendar, Layers, ExternalLink, Clock } from 'lucide-react'
import { FORMAT_LABELS, TOURNAMENT_STATUS } from '../../../lib/constants'

export function WizardStep8Preview({ onBack, isLast }) {
  const navigate = useNavigate()
  const {
    name,
    slug,
    startDate,
    endDate,
    venueName,
    primaryColor,
    divisions,
    venues,
    teams,
    pools,
    generatedMatches,
    generatedSlots,
    tournamentId,
    isPublished,
    setPublished,
  } = useWizardStore()

  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  const [savedMatches, setSavedMatches] = useState([])
  const [savedSlots, setSavedSlots] = useState([])

  useEffect(() => {
    let active = true

    async function loadSavedSchedule() {
      if (!tournamentId) {
        if (active) {
          setSavedMatches([])
          setSavedSlots([])
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
          status
        `)
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .order('match_number')

      if (!active) return

      setSavedSlots(slotData ?? [])
      setSavedMatches(matchData ?? [])
    }

    loadSavedSchedule()

    return () => {
      active = false
    }
  }, [tournamentId])

  async function handlePublish() {
    if (!tournamentId) return
    setPublishing(true)
    try {
      await db.tournaments.update(tournamentId, { status: TOURNAMENT_STATUS.PUBLISHED })
      setPublished()
    } catch (err) {
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

  const scheduleMatches = savedMatches.length > 0 ? savedMatches : generatedMatches
  const scheduleSlots = savedSlots.length > 0 ? savedSlots : generatedSlots

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

  const byTime = {}
  for (const m of scheduleMatches) {
    const slot = slotMap[m.slot_id || m.time_slot_id]
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
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

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Scheduled Games</h3>

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
                    const slot = slotMap[m.slot_id || m.time_slot_id]

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

                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {division && (
                              <p className="text-xs text-[var(--text-muted)]">{division.name}</p>
                            )}
                            {pool && (
                              <p className="text-xs text-[var(--text-muted)]">{pool.name}</p>
                            )}
                            {m.round && (
                              <p className="text-xs text-[var(--text-muted)]">Round {m.round}</p>
                            )}
                            {slot?.scheduled_start && (
                              <p className="text-xs text-[var(--text-muted)]">
                                {formatDateTime(slot.scheduled_start)}
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
        <ChecklistItem ok={scheduleMatches.length > 0} label={`${scheduleMatches.length} games scheduled`} warn={scheduleMatches.length === 0} />
      </div>

      <WizardNavButtons
        onNext={handlePublish}
        onBack={onBack}
        saving={publishing}
        nextLabel="Publish tournament 🚀"
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