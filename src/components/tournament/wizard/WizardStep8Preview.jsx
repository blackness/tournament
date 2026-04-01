import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { Check, Trophy, Users, MapPin, Calendar, Layers, ExternalLink } from 'lucide-react'
import { FORMAT_LABELS, TOURNAMENT_STATUS } from '../../../lib/constants'

export function WizardStep8Preview({ onBack, isLast }) {
  const navigate = useNavigate()
  const {
    name, slug, startDate, endDate, venueName, primaryColor,
    divisions, venues, teams, pools, generatedMatches,
    tournamentId, isPublished,
    setPublished,
  } = useWizardStore()

  const [publishing, setPublishing] = useState(false)
  const [error, setError]           = useState(null)

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

  // ── Published success screen ───────────────────────────────────────────────
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

  // ── Preview ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Preview & Publish</h2>
        <p className="section-subtitle">Review your tournament setup, then publish to make it live.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Tournament header preview */}
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
          <SummaryItem icon={<MapPin size={14} />}    label="Venue"     value={venueName || '—'} />
          <SummaryItem icon={<Layers size={14} />}    label="Divisions" value={divisions.length} />
          <SummaryItem icon={<Users size={14} />}     label="Teams"     value={teams.length} />
        </div>
      </div>

      {/* Divisions breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Divisions</h3>
        <div className="space-y-2">
          {divisions.map(div => {
            const divTeams  = teams.filter(t => t.divisionId === div.id)
            const divPools  = pools.filter(p => p.divisionId === div.id)
            const divGames  = generatedMatches.filter(m =>
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

      {/* Venues */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Fields / Courts</h3>
        <div className="flex flex-wrap gap-2">
          {venues.map(v => (
            <span key={v.id} className="badge badge-blue text-xs">{v.name}</span>
          ))}
        </div>
      </div>

      {/* Public URL */}
      <div className="p-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-mono break-all">
        /t/<strong>{slug}</strong>
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        <ChecklistItem ok={!!name}               label="Tournament name set" />
        <ChecklistItem ok={divisions.length > 0}  label={`${divisions.length} division${divisions.length !== 1 ? 's' : ''} configured`} />
        <ChecklistItem ok={venues.length > 0}     label={`${venues.length} field${venues.length !== 1 ? 's' : ''} added`} />
        <ChecklistItem ok={teams.length > 0}      label={`${teams.length} team${teams.length !== 1 ? 's' : ''} registered`} />
        <ChecklistItem ok={generatedMatches.length > 0} label={`${generatedMatches.length} games scheduled`} warn={generatedMatches.length === 0} />
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
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
