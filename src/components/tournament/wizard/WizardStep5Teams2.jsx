import { useState, useRef } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { PlusCircle, Trash2, Upload, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { suggestPoolStructure, serpentineSeeding } from '../../../../scheduleGenerator'

const crypto = globalThis.crypto

function newTeam(divisionId, seed) {
  return {
    id:           crypto.randomUUID(),
    name:         '',
    shortName:    '',
    divisionId,
    clubName:     '',
    primaryColor: '#1a56db',
    seed,
    headCoachName: '',
    headCoachEmail: '',
    constraints:  {},
  }
}

export function WizardStep5Teams({ onNext, onBack }) {
  const {
    divisions, teams, pools, poolAssignments,
    addTeam, addTeams, updateTeam, removeTeam,
    addPool, setPoolsForDivision, setPoolAssignment, setPoolAssignments,
    tournamentId,
  } = useWizardStore()

  const [activeDivision, setActiveDivision] = useState(divisions[0]?.id ?? null)
  const [errors, setErrors]     = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const divTeams = teams.filter(t => t.divisionId === activeDivision)
  const divPools = pools.filter(p => p.divisionId === activeDivision)

  function validate() {
    const e = {}
    teams.forEach(t => {
      if (!t.name.trim()) e[`${t.id}_name`] = 'Name required'
    })
    setErrors(e)
    if (teams.length === 0) { setFormError('Add at least one team'); return false }
    return Object.keys(e).length === 0
  }

  // ── Auto-generate pools ────────────────────────────────────────────────────
  function handleAutoPool(divisionId) {
    const div     = divisions.find(d => d.id === divisionId)
    const divTeams = teams.filter(t => t.divisionId === divisionId)
    if (!div || divTeams.length === 0) return

    const { numPools } = suggestPoolStructure(divTeams.length, {
      preferredPoolSize: 4,
      maxPoolSize: 6,
    })

    // Create pools
    const newPools = Array.from({ length: numPools }, (_, i) => ({
      id:         crypto.randomUUID(),
      divisionId,
      name:       `Pool ${String.fromCharCode(65 + i)}`,  // A, B, C…
      shortName:  String.fromCharCode(65 + i),
      sortOrder:  i,
    }))

    setPoolsForDivision(divisionId, newPools)

    // Serpentine seed teams into pools
    const seeded       = serpentineSeeding(divTeams, numPools)
    const assignments  = {}
    seeded.forEach((team, idx) => {
      assignments[team.id] = newPools[idx % numPools].id
    })
    setPoolAssignments(assignments)
  }

  // ── CSV import ──────────────────────────────────────────────────────────────
  async function handleCSV(file) {
    if (!file || !activeDivision) return
    setImporting(true)

    const { default: Papa } = await import('papaparse')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const imported = data.map((row, i) => ({
          ...newTeam(activeDivision, divTeams.length + i + 1),
          name:          row['Team Name'] || row['name'] || row['team_name'] || '',
          shortName:     row['Short Name'] || row['short_name'] || '',
          clubName:      row['Club'] || row['club'] || '',
          headCoachName: row['Coach'] || row['coach'] || '',
          headCoachEmail:row['Email'] || row['email'] || '',
          primaryColor:  row['Color'] || row['color'] || '#1a56db',
        })).filter(t => t.name)

        addTeams(imported)
        setImporting(false)
      },
      error: () => {
        setFormError('Failed to parse CSV')
        setImporting(false)
      },
    })
  }

  // ── Save to DB ──────────────────────────────────────────────────────────────
  async function handleNext() {
    if (!validate()) return
    if (!tournamentId) { onNext(); return }

    setSaving(true)
    try {
      for (const div of divisions) {
        const divTeams = teams.filter(t => t.divisionId === div.id)
        const divPools = pools.filter(p => p.divisionId === div.id)

        // Upsert pools
        const poolIdMap = {}
        for (const pool of divPools) {
          const dbDivId = div.dbId
          if (!dbDivId) continue
          const payload = {
            division_id: dbDivId,
            name:        pool.name,
            short_name:  pool.shortName || null,
            sort_order:  pool.sortOrder,
          }
          if (pool.dbId) {
            await db.pools.create(payload) // idempotent via ON CONFLICT if we add it
          } else {
            const { data } = await db.pools.create(payload)
            if (data) {
              poolIdMap[pool.id] = data.id
              useWizardStore.getState().updatePool(pool.id, { dbId: data.id })
            }
          }
        }

        // Upsert teams
        for (const [i, team] of divTeams.entries()) {
          const dbDivId  = div.dbId
          const dbPoolId = poolIdMap[poolAssignments[team.id]]
                        || pools.find(p => p.id === poolAssignments[team.id])?.dbId
                        || null

          const payload = {
            tournament_id: tournamentId,
            division_id:   dbDivId,
            pool_id:       dbPoolId,
            name:          team.name.trim(),
            short_name:    team.shortName?.trim() || null,
            club_name:     team.clubName?.trim() || null,
            primary_color: team.primaryColor,
            seed:          team.seed ?? i + 1,
            head_coach_name:  team.headCoachName?.trim() || null,
            head_coach_email: team.headCoachEmail?.trim() || null,
          }

          if (team.dbId) {
            await db.teams.update(team.dbId, payload)
          } else {
            const { data } = await db.teams.create(payload)
            if (data) updateTeam(team.id, { dbId: data.id })
          }
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save teams')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Teams & Pools</h2>
        <p className="section-subtitle">Add teams, then assign them to pools. You can auto-generate balanced pools.</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
      )}

      {/* Division tabs */}
      {divisions.length > 1 && (
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {divisions.map(div => (
            <button
              key={div.id}
              onClick={() => setActiveDivision(div.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeDivision === div.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {div.name || `Division ${divisions.indexOf(div) + 1}`}
              <span className="ml-1.5 text-xs text-gray-400">
                ({teams.filter(t => t.divisionId === div.id).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {activeDivision && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => addTeam(newTeam(activeDivision, divTeams.length + 1))}
              className="btn-primary btn btn-sm"
            >
              <PlusCircle size={14} />
              Add team
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="btn-secondary btn btn-sm"
            >
              <Upload size={14} />
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => handleCSV(e.target.files?.[0])}
            />

            {divTeams.length >= 4 && (
              <button
                onClick={() => handleAutoPool(activeDivision)}
                className="btn-secondary btn btn-sm ml-auto"
              >
                <Users size={14} />
                Auto-generate pools
              </button>
            )}
          </div>

          {/* CSV hint */}
          {divTeams.length === 0 && (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <Users size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No teams yet. Add manually or import a CSV.</p>
              <p className="text-xs mt-1">CSV columns: Team Name, Short Name, Club, Coach, Email, Color</p>
            </div>
          )}

          {/* Team list */}
          {divTeams.length > 0 && (
            <div className="space-y-2">
              {divTeams.map((team, idx) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  idx={idx}
                  pools={divPools}
                  assignment={poolAssignments[team.id]}
                  errors={errors}
                  onUpdate={(u) => updateTeam(team.id, u)}
                  onRemove={() => removeTeam(team.id)}
                  onAssign={(poolId) => setPoolAssignment(team.id, poolId)}
                />
              ))}
            </div>
          )}

          {/* Pool summary */}
          {divPools.length > 0 && (
            <PoolSummary pools={divPools} teams={divTeams} assignments={poolAssignments} />
          )}
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextDisabled={teams.length === 0}
      />
    </div>
  )
}

function TeamRow({ team, idx, pools, assignment, errors, onUpdate, onRemove, onAssign }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white">
        <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>

        {/* Colour dot */}
        <input
          type="color"
          value={team.primaryColor}
          onChange={e => onUpdate({ primaryColor: e.target.value })}
          className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer flex-shrink-0"
          title="Team colour"
        />

        {/* Name */}
        <input
          type="text"
          className={`flex-1 text-sm font-medium bg-transparent border-b border-transparent focus:border-blue-400 outline-none py-0.5 ${
            errors[`${team.id}_name`] ? 'border-red-400' : ''
          }`}
          placeholder="Team name"
          value={team.name}
          onChange={e => onUpdate({ name: e.target.value })}
        />

        {/* Pool assignment */}
        {pools.length > 0 && (
          <select
            className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-700 focus:ring-1 focus:ring-blue-400"
            value={assignment ?? ''}
            onChange={e => onAssign(e.target.value || null)}
          >
            <option value="">— Pool</option>
            {pools.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <button onClick={() => setExpanded(e => !e)} className="p-1 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50">
          <div className="field-group">
            <label className="field-label text-xs">Short name</label>
            <input type="text" className="field-input text-sm" value={team.shortName ?? ''} onChange={e => onUpdate({ shortName: e.target.value })} maxLength={8} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Club / school</label>
            <input type="text" className="field-input text-sm" value={team.clubName ?? ''} onChange={e => onUpdate({ clubName: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Seed</label>
            <input type="number" className="field-input text-sm" min={1} value={team.seed ?? ''} onChange={e => onUpdate({ seed: Number(e.target.value) })} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Head coach</label>
            <input type="text" className="field-input text-sm" value={team.headCoachName ?? ''} onChange={e => onUpdate({ headCoachName: e.target.value })} />
          </div>
          <div className="field-group sm:col-span-2">
            <label className="field-label text-xs">Coach email</label>
            <input type="email" className="field-input text-sm" value={team.headCoachEmail ?? ''} onChange={e => onUpdate({ headCoachEmail: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  )
}

function PoolSummary({ pools, teams, assignments }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pool summary</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pools.map(pool => {
          const poolTeams = teams.filter(t => assignments[t.id] === pool.id)
          return (
            <div key={pool.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">{pool.name}</p>
              {poolTeams.length === 0
                ? <p className="text-xs text-gray-400 italic">Empty</p>
                : poolTeams.map(t => (
                  <p key={t.id} className="text-xs text-gray-600 truncate">{t.name}</p>
                ))
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}
