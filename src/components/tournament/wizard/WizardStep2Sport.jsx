import { useState, useEffect } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { Check, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'

const SPORT_ICONS = {
  ultimate_frisbee: '🥏',
  basketball:       '🏀',
  volleyball:       '🏐',
  custom:           '🎯',
}

export function WizardStep2Sport({ onNext, onBack, isFirst }) {
  const {
    sportTemplateId, sportConfig, enabledStatIds, sotgEnabled, tiebreakerOrder,
    setSport, toggleStat, setField,
  } = useWizardStore()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    db.sportTemplates.list().then(({ data, error }) => {
      if (error) setError(error.message)
      else setTemplates(data ?? [])
      setLoading(false)
    })
  }, [])

  function validate() {
    if (!sportTemplateId) { setError('Please select a sport'); return false }
    return true
  }

  async function handleNext() {
    if (!validate()) return
    setSaving(true)
    // Persist sport_template_id + tiebreaker_order to DB
    const { tournamentId } = useWizardStore.getState()
    if (tournamentId) {
      await db.tournaments.update(tournamentId, {
        sport_template_id: sportTemplateId,
        tiebreaker_order:  tiebreakerOrder,
        sotg_enabled:      sotgEnabled,
        enabled_stat_ids:  enabledStatIds,
      })
    }
    useWizardStore.getState().markSaved()
    setSaving(false)
    onNext()
  }

  if (loading) return <LoadingSpinner className="py-12" />

  const stats = sportConfig?.stats ?? []
  const scoringStats  = stats.filter(s => s.category === 'scoring')
  const otherStats    = stats.filter(s => s.category !== 'scoring')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Sport & Format</h2>
        <p className="section-subtitle">Choose the sport and configure what stats to track.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Sport picker */}
      <div>
        <label className="field-label mb-2 block">Sport *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { setSport(t); setError(null) }}
              className={[
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                sportTemplateId === t.id
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              <span className="text-3xl">{SPORT_ICONS[t.slug] ?? '🏆'}</span>
              <span className="text-sm font-medium text-gray-800">{t.display_name}</span>
              {sportTemplateId === t.id && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <Check size={12} /> Selected
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stat configuration — only shown after sport is selected */}
      {sportConfig && (
        <>
          <div className="divider" />

          {/* Stats toggle */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Stats to track</h3>
            <p className="text-xs text-gray-500 mb-3">
              Toggle individual stats on or off. Scoring stats are always shown in scorecards.
            </p>

            {stats.length === 0 ? (
              <p className="text-sm text-gray-400 italic">This sport has no configurable stats.</p>
            ) : (
              <div className="space-y-2">
                {stats.map(stat => {
                  const enabled = enabledStatIds.includes(stat.id)
                  return (
                    <div
                      key={stat.id}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors ${
                        enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono font-bold w-8 ${enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                          {stat.short}
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                            {stat.label}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">{stat.category}</p>
                        </div>
                        {stat.adds_to_score && (
                          <span className="badge badge-green text-xs">Scoring</span>
                        )}
                        {stat.is_negative && (
                          <span className="badge badge-red text-xs">Negative</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleStat(stat.id)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={enabled ? 'Disable stat' : 'Enable stat'}
                      >
                        {enabled
                          ? <ToggleRight size={24} className="text-blue-600" />
                          : <ToggleLeft size={24} />
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SOTG */}
          {sportConfig.sotg_enabled !== undefined && (
            <>
              <div className="divider" />
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sotgEnabled}
                      onChange={e => setField('sotgEnabled', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Spirit of the Game (SOTG)</span>
                  </label>
                  {sotgEnabled && sportConfig.sotg_categories && (
                    <div className="mt-2 ml-6">
                      <p className="text-xs text-gray-500 mb-1">Categories ({sportConfig.sotg_scale?.min ?? 0}–{sportConfig.sotg_scale?.max ?? 4} scale):</p>
                      <ul className="text-xs text-gray-500 space-y-0.5">
                        {sportConfig.sotg_categories.map((cat, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-gray-400 rounded-full" />
                            {cat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        isFirst={isFirst}
        saving={saving}
        nextDisabled={!sportTemplateId}
      />
    </div>
  )
}
