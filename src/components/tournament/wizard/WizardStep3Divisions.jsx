import { useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { FORMAT_TYPES, FORMAT_LABELS } from '../../../lib/constants'
import { PlusCircle, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

const crypto = globalThis.crypto

function newDivision(sortOrder) {
  return {
    id:                      crypto.randomUUID(),
    name:                    '',
    slug:                    '',
    formatType:              FORMAT_TYPES.POOL_TO_BRACKET,
    gameDurationMinutes:     90,
    breakBetweenGamesMinutes: 30,
    teamsAdvancePerPool:     2,
    consolationBracket:      false,
    thirdPlaceGame:          false,
    sortOrder,
    _expanded: true,
  }
}

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

export function WizardStep3Divisions({ onNext, onBack }) {
  const { divisions, addDivision, updateDivision, removeDivision, tournamentId } = useWizardStore()
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [formError, setFormError] = useState(null)

  function validate() {
    const e = {}
    if (divisions.length === 0) {
      setFormError('Add at least one division')
      return false
    }
    divisions.forEach(d => {
      if (!d.name.trim()) e[`${d.id}_name`] = 'Name required'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleNext() {
    if (!validate()) return
    if (!tournamentId) { onNext(); return }

    setSaving(true)
    try {
      // Fetch existing divisions in DB
      const { data: existing } = await db.divisions.byTournament(tournamentId)
      const existingIds = new Set((existing ?? []).map(d => d.db_id ?? d.id))

      // Upsert each division
      for (const [i, div] of divisions.entries()) {
        const slug = div.slug || toSlug(div.name)
        const payload = {
          tournament_id:               tournamentId,
          name:                        div.name.trim(),
          slug,
          format_type:                 div.formatType,
          game_duration_minutes:       div.gameDurationMinutes,
          break_between_games_minutes: div.breakBetweenGamesMinutes,
          teams_advance_per_pool:      div.teamsAdvancePerPool,
          consolation_bracket:         div.consolationBracket,
          third_place_game:            div.thirdPlaceGame,
          sort_order:                  i,
        }
        if (div.dbId) {
          await db.divisions.update(div.dbId, payload)
        } else {
          // upsert by tournament_id+slug to handle retries
          const { data } = await db.divisions.upsert(payload)
          if (data) updateDivision(div.id, { dbId: data.id })
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save divisions')
    } finally {
      setSaving(false)
    }
  }

  function handleAdd() {
    addDivision(newDivision(divisions.length))
    setFormError(null)
  }

  const QUICK_PRESETS = [
    { label: 'Open', name: 'Open' },
    { label: 'Mixed', name: 'Mixed' },
    { label: "Women's", name: "Women's" },
    { label: 'Masters', name: 'Masters' },
    { label: 'U18', name: 'U18' },
    { label: 'Recreational', name: 'Recreational' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Divisions</h2>
        <p className="section-subtitle">Add the divisions for your tournament. Each division can have its own format.</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
      )}

      {/* Quick presets */}
      {divisions.length === 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Quick add a common division:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => addDivision({ ...newDivision(0), name: p.name, slug: toSlug(p.name) })}
                className="btn-secondary btn btn-sm"
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Division cards */}
      <div className="space-y-3">
        {divisions.map((div, idx) => (
          <DivisionCard
            key={div.id}
            div={div}
            idx={idx}
            errors={errors}
            onUpdate={(updates) => updateDivision(div.id, updates)}
            onRemove={() => removeDivision(div.id)}
          />
        ))}
      </div>

      {/* Add button */}
      <button onClick={handleAdd} className="btn-secondary btn w-full">
        <PlusCircle size={16} />
        Add division
      </button>

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextDisabled={divisions.length === 0}
      />
    </div>
  )
}

function DivisionCard({ div, idx, errors, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(div._expanded ?? false)

  const needsPoolConfig = [
    FORMAT_TYPES.POOL_TO_BRACKET,
    FORMAT_TYPES.CROSSOVER,
  ].includes(div.formatType)

  const needsBracketConfig = [
    FORMAT_TYPES.POOL_TO_BRACKET,
    FORMAT_TYPES.SINGLE_ELIM,
    FORMAT_TYPES.DOUBLE_ELIM,
    FORMAT_TYPES.CROSSOVER,
  ].includes(div.formatType)

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 ">
        <GripVertical size={16} className="text-[var(--text-muted)] cursor-grab" />
        <div className="flex-1 min-w-0">
          <input
            type="text"
            className={`w-full text-sm font-semibold bg-transparent border-b border-transparent focus:border-blue-400 outline-none pb-0.5 ${
              errors[`${div.id}_name`] ? 'border-red-400 text-red-400' : 'text-[var(--text-primary)]'
            }`}
            placeholder={`Division ${idx + 1} name (e.g. Open, Mixed, Women's)`}
            value={div.name}
            onChange={e => onUpdate({ name: e.target.value, slug: toSlug(e.target.value) })}
          />
          {errors[`${div.id}_name`] && (
            <p className="text-xs text-red-600 mt-0.5">{errors[`${div.id}_name`]}</p>
          )}
        </div>
        <select
          className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text-secondary)] focus:ring-1 focus:ring-blue-500 focus:border-[var(--accent)]"
          value={div.formatType}
          onChange={e => onUpdate({ formatType: e.target.value })}
        >
          {Object.entries(FORMAT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          title="Expand settings"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[var(--text-muted)] hover:text-red-500" title="Remove">
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div className="px-4 py-4 space-y-4 border-t border-[var(--border)]">
          <div className="grid grid-cols-2 gap-4">
            <div className="field-group">
              <label className="field-label">Game duration (min)</label>
              <input
                type="number"
                className="field-input"
                min={20} max={180} step={5}
                value={div.gameDurationMinutes}
                onChange={e => onUpdate({ gameDurationMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Break between games (min)</label>
              <input
                type="number"
                className="field-input"
                min={0} max={120} step={5}
                value={div.breakBetweenGamesMinutes}
                onChange={e => onUpdate({ breakBetweenGamesMinutes: Number(e.target.value) })}
              />
            </div>
          </div>

          {needsPoolConfig && (
            <div className="field-group">
              <label className="field-label">Teams that advance per pool</label>
              <select
                className="field-input"
                value={div.teamsAdvancePerPool}
                onChange={e => onUpdate({ teamsAdvancePerPool: Number(e.target.value) })}
              >
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          {needsBracketConfig && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={div.thirdPlaceGame}
                  onChange={e => onUpdate({ thirdPlaceGame: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">3rd place game</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={div.consolationBracket}
                  onChange={e => onUpdate({ consolationBracket: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Consolation bracket</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
