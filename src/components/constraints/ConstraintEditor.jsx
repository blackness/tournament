import { useState, useEffect } from 'react'

const CONSTRAINT_TYPES = [
  {
    value: 'team_not_before',
    label: 'Team — not before time',
    description: 'Team cannot be scheduled before a specific time on any day',
    entityType: 'team',
    entityBType: null,
  },
  {
    value: 'team_not_after',
    label: 'Team — not after time',
    description: 'Team cannot be scheduled to start after a specific time',
    entityType: 'team',
    entityBType: null,
  },
  {
    value: 'team_unavailable_day',
    label: 'Team — unavailable on day',
    description: 'Team is not available on a specific tournament day',
    entityType: 'team',
    entityBType: null,
  },
  {
    value: 'pool_venue_lock',
    label: 'Pool — venue lock',
    description: 'All games in a pool must be played at a specific venue',
    entityType: 'pool',
    entityBType: 'venue',
  },
  {
    value: 'division_venue_lock',
    label: 'Division — venue lock',
    description: 'All games in a division must be played at a specific venue',
    entityType: 'division',
    entityBType: 'venue',
  },
  {
    value: 'team_venue_lock',
    label: 'Team — venue lock',
    description: 'A team must always play at a specific venue (e.g. accessibility)',
    entityType: 'team',
    entityBType: 'venue',
  },
  {
    value: 'min_rest_override',
    label: 'Team — minimum rest override',
    description: 'Override the minimum rest time between games for a specific team',
    entityType: 'team',
    entityBType: null,
  },
]

const BLANK_FORM = {
  constraint_type: '',
  hardness: 'soft',
  entity_id: '',
  entity_b_id: '',
  params: {},
  notes: '',
  is_active: true,
}

export function ConstraintEditor({
  constraint = null,
  teams = [],
  pools = [],
  divisions = [],
  venues = [],
  tournamentDays = [],
  onSave,
  onCancel,
  saving = false,
}) {
  const [form, setForm] = useState(BLANK_FORM)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (constraint) {
      setForm({
        constraint_type: constraint.constraint_type ?? '',
        hardness: constraint.hardness ?? 'soft',
        entity_id: constraint.entity_id ?? '',
        entity_b_id: constraint.entity_b_id ?? '',
        params: constraint.params ?? {},
        notes: constraint.notes ?? '',
        is_active: constraint.is_active ?? true,
      })
    } else {
      setForm(BLANK_FORM)
    }
    setFormError(null)
  }, [constraint?.id])

  const typeDef = CONSTRAINT_TYPES.find(t => t.value === form.constraint_type) ?? null

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setParam(key, value) {
    setForm(prev => ({ ...prev, params: { ...prev.params, [key]: value } }))
  }

  function handleTypeChange(value) {
    setForm(prev => ({
      ...prev,
      constraint_type: value,
      entity_id: '',
      entity_b_id: '',
      params: {},
    }))
    setFormError(null)
  }

  function validate() {
    if (!form.constraint_type) return 'Choose a constraint type.'
    if (!form.entity_id) {
      const label = typeDef?.entityType === 'pool' ? 'pool'
        : typeDef?.entityType === 'division' ? 'division'
        : 'team'
      return `Choose a ${label}.`
    }
    if (typeDef?.entityBType === 'venue' && !form.entity_b_id) return 'Choose a venue.'
    if (form.constraint_type === 'team_not_before' && !form.params?.not_before) return 'Enter a time.'
    if (form.constraint_type === 'team_not_after' && !form.params?.not_after) return 'Enter a time.'
    if (form.constraint_type === 'team_unavailable_day' && form.params?.day_index == null) return 'Choose a day.'
    if (form.constraint_type === 'min_rest_override' && !form.params?.min_rest_minutes) return 'Enter minimum rest minutes.'
    return null
  }

  function handleSave() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError(null)

    onSave({
      constraint_type: form.constraint_type,
      hardness: form.hardness,
      entity_type: typeDef?.entityType ?? null,
      entity_id: form.entity_id || null,
      entity_b_type: typeDef?.entityBType ?? null,
      entity_b_id: form.entity_b_id || null,
      params: form.params ?? {},
      notes: form.notes || null,
      is_active: form.is_active,
    })
  }

  const entityOptions =
    typeDef?.entityType === 'team' ? teams
    : typeDef?.entityType === 'pool' ? pools
    : typeDef?.entityType === 'division' ? divisions
    : []

  const entityLabel =
    typeDef?.entityType === 'pool' ? 'Pool'
    : typeDef?.entityType === 'division' ? 'Division'
    : 'Team'

  return (
    <div className="space-y-4">

      {/* Type picker */}
      <div className="field-group">
        <label className="field-label">Constraint type</label>
        <select
          className="field-input"
          value={form.constraint_type}
          onChange={e => handleTypeChange(e.target.value)}
        >
          <option value="">Choose type...</option>
          {CONSTRAINT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {typeDef && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{typeDef.description}</p>
        )}
      </div>

      {/* Entity picker */}
      {typeDef && (
        <div className="field-group">
          <label className="field-label">{entityLabel}</label>
          <select
            className="field-input"
            value={form.entity_id}
            onChange={e => setField('entity_id', e.target.value)}
          >
            <option value="">Choose {entityLabel.toLowerCase()}...</option>
            {entityOptions.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Venue picker (entity B) */}
      {typeDef?.entityBType === 'venue' && (
        <div className="field-group">
          <label className="field-label">Required venue</label>
          <select
            className="field-input"
            value={form.entity_b_id}
            onChange={e => setField('entity_b_id', e.target.value)}
          >
            <option value="">Choose venue...</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Time param */}
      {(form.constraint_type === 'team_not_before' || form.constraint_type === 'team_not_after') && (
        <div className="field-group">
          <label className="field-label">
            {form.constraint_type === 'team_not_before' ? 'Not before' : 'Not after'}
          </label>
          <input
            type="time"
            className="field-input"
            value={form.params?.not_before ?? form.params?.not_after ?? ''}
            onChange={e => {
              const key = form.constraint_type === 'team_not_before' ? 'not_before' : 'not_after'
              setParam(key, e.target.value)
            }}
          />
        </div>
      )}

      {/* Day param */}
      {form.constraint_type === 'team_unavailable_day' && (
        <div className="field-group">
          <label className="field-label">Unavailable on day</label>
          <select
            className="field-input"
            value={form.params?.day_index ?? ''}
            onChange={e => setParam('day_index', Number(e.target.value))}
          >
            <option value="">Choose day...</option>
            {tournamentDays.map(day => {
              const idx = day.dayIndex ?? day.day_index
              const date = day.eventDate ?? day.event_date ?? ''
              const label = day.label ?? ''
              return (
                <option key={day.id} value={idx}>
                  Day {idx}{date ? ` — ${date}` : ''}{label ? ` (${label})` : ''}
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* Rest param */}
      {form.constraint_type === 'min_rest_override' && (
        <div className="field-group">
          <label className="field-label">Minimum rest (minutes)</label>
          <input
            type="number"
            min={0}
            step={5}
            className="field-input"
            value={form.params?.min_rest_minutes ?? ''}
            onChange={e => setParam('min_rest_minutes', Number(e.target.value))}
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Overrides tournament default for this team only.
          </p>
        </div>
      )}

      {/* Hardness */}
      {typeDef && (
        <div className="field-group">
          <label className="field-label">Strictness</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: 'soft',
                label: 'Soft',
                description: 'Warn if violated, still allow scheduling',
                activeClass: 'border-blue-400 bg-blue-50 text-blue-800',
              },
              {
                value: 'hard',
                label: 'Hard',
                description: 'Block schedule generation if violated',
                activeClass: 'border-red-400 bg-red-50 text-red-800',
              },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('hardness', opt.value)}
                className={[
                  'text-left px-3 py-2.5 rounded-xl border text-sm transition-colors',
                  form.hardness === opt.value
                    ? opt.activeClass
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-mid)]',
                ].join(' ')}
              >
                <p className="font-semibold">{opt.label}</p>
                <p className="text-xs mt-0.5 opacity-80">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {typeDef && (
        <div className="field-group">
          <label className="field-label">Notes (optional)</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. Accessibility requirement, late arrival"
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
          />
        </div>
      )}

      {/* Error */}
      {formError && (
        <p className="text-sm text-red-600">{formError}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.constraint_type}
          className="btn-primary btn flex-1"
        >
          {saving ? 'Saving...' : constraint ? 'Update constraint' : 'Add constraint'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary btn"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}