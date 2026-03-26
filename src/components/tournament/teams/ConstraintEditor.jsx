import { useState } from 'react'
import { parseConstraints, buildConstraints } from '../../../lib/constraintEngine'
import { X, Plus, Clock, Users } from 'lucide-react'

/**
 * ConstraintEditor -- shown per-team in Step 5 / Director HQ.
 * Receives the raw constraints JSONB, calls onChange with updated JSONB.
 */
export function ConstraintEditor({ team, allTeams, venues, constraints: raw, onChange }) {
  const c = parseConstraints(raw ?? {})
  const [localNotes, setLocalNotes] = useState(c.notes)

  function update(patch) {
    onChange(buildConstraints({ ...c, ...patch }))
  }

  const otherTeams = allTeams.filter(t => t.id !== team.id)

  return (
    <div className="space-y-5 text-sm">

      <section>
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock size={14} /> Time constraints
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="field-group">
            <label className="field-label text-xs">Cannot play before</label>
            <input type="time" className="field-input text-sm"
              value={c.notBefore ?? ''}
              onChange={e => update({ notBefore: e.target.value || null })} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Cannot play after</label>
            <input type="time" className="field-input text-sm"
              value={c.notAfter ?? ''}
              onChange={e => update({ notAfter: e.target.value || null })} />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <label className="field-label text-xs">Unavailable windows</label>
          {c.unavailableWindows.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" className="field-input text-sm flex-1" value={w.start}
                onChange={e => {
                  const u = [...c.unavailableWindows]
                  u[i] = { ...w, start: e.target.value }
                  update({ unavailableWindows: u })
                }} />
              <span className="text-gray-400 text-xs">to</span>
              <input type="time" className="field-input text-sm flex-1" value={w.end}
                onChange={e => {
                  const u = [...c.unavailableWindows]
                  u[i] = { ...w, end: e.target.value }
                  update({ unavailableWindows: u })
                }} />
              <input type="text" className="field-input text-sm flex-1"
                placeholder="Reason (optional)" value={w.label ?? ''}
                onChange={e => {
                  const u = [...c.unavailableWindows]
                  u[i] = { ...w, label: e.target.value }
                  update({ unavailableWindows: u })
                }} />
              <button onClick={() => update({ unavailableWindows: c.unavailableWindows.filter((_, j) => j !== i) })}
                className="p-1 text-gray-300 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => update({ unavailableWindows: [...c.unavailableWindows, { start: '12:00', end: '13:00', label: '' }] })}
            className="btn-ghost btn btn-sm text-xs">
            <Plus size={13} /> Add window
          </button>
        </div>

        <div className="mt-3 flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.noFirstGame}
              onChange={e => update({ noFirstGame: e.target.checked })}
              className="rounded border-gray-300 text-blue-600" />
            <span className="text-xs text-gray-700">No first game of the day</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c.noLastGame}
              onChange={e => update({ noLastGame: e.target.checked })}
              className="rounded border-gray-300 text-blue-600" />
            <span className="text-xs text-gray-700">No last game of the day</span>
          </label>
        </div>
      </section>

      <section>
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Users size={14} /> Pool constraints
        </h4>
        <TeamPicker
          label="Must NOT be in same pool as"
          selected={c.noSamePoolAs}
          teams={otherTeams}
          onChange={ids => update({ noSamePoolAs: ids })}
          badgeColor="bg-red-100 text-red-700"
        />
        <div className="mt-3">
          <TeamPicker
            label="Should be in same pool as"
            selected={c.mustSamePoolAs}
            teams={otherTeams}
            onChange={ids => update({ mustSamePoolAs: ids })}
            badgeColor="bg-green-100 text-green-700"
          />
        </div>
      </section>

      {venues && venues.length > 0 && (
        <section>
          <h4 className="font-semibold text-gray-700 mb-3">Field constraints</h4>
          <FieldPicker
            label="Avoid these fields"
            selected={c.avoidedFields}
            venues={venues}
            onChange={ids => update({ avoidedFields: ids })}
          />
        </section>
      )}

      <section>
        <label className="field-label text-xs">Director notes</label>
        <textarea className="field-input text-sm resize-none mt-1" rows={2}
          placeholder="Any other notes about this team..."
          value={localNotes}
          onChange={e => setLocalNotes(e.target.value)}
          onBlur={() => update({ notes: localNotes })} />
      </section>

    </div>
  )
}

function TeamPicker({ label, selected, teams, onChange, badgeColor }) {
  const [open, setOpen] = useState(false)
  const selectedTeams   = teams.filter(t => selected.includes(t.id))
  const remaining       = teams.filter(t => !selected.includes(t.id))

  return (
    <div>
      <label className="field-label text-xs mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedTeams.map(t => (
          <span key={t.id} className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + badgeColor}>
            {t.name}
            <button onClick={() => onChange(selected.filter(id => id !== t.id))} className="hover:opacity-70">
              <X size={11} />
            </button>
          </span>
        ))}
        {remaining.length > 0 && (
          <div className="relative">
            <button onClick={() => setOpen(o => !o)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
              <Plus size={11} /> Add team
            </button>
            {open && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-56 py-1 max-h-48 overflow-y-auto">
                {remaining.map(t => (
                  <button key={t.id} onClick={() => { onChange([...selected, t.id]); setOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {t.name}
                    {t.clubName && <span className="text-xs text-gray-400 ml-1">({t.clubName})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FieldPicker({ label, selected, venues, onChange }) {
  return (
    <div>
      <label className="field-label text-xs mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {venues.map(v => {
          const active = selected.includes(v.id)
          return (
            <button key={v.id}
              onClick={() => onChange(active ? selected.filter(id => id !== v.id) : [...selected, v.id])}
              className={'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ' + (
                active
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              )}>
              {active && <X size={10} className="inline mr-1" />}
              {v.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
