import { useState, useRef } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { PlusCircle, Trash2, Upload, Users, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { suggestPoolStructure, serpentineSeeding } from '../../../lib/scheduleGenerator'

const crypto = globalThis.crypto

function newTeam(divisionId, seed) {
  return {
    id:             crypto.randomUUID(),
    name:           '',
    shortName:      '',
    divisionId,
    clubName:       '',
    primaryColor:   '#1a56db',
    seed,
    headCoachName:  '',
    headCoachEmail: '',
    constraints:    {},
  }
}

export function WizardStep5Teams({ onNext, onBack }) {
  const {
    divisions, teams, pools, poolAssignments,
    addTeam, addTeams, updateTeam, removeTeam,
    setPoolsForDivision, setPoolAssignment, setPoolAssignments,
    tournamentId,
  } = useWizardStore()

  const firstDivId = divisions[0]?.id ?? null
  const [activeDivision, setActiveDivision] = useState(firstDivId)
  const [errors, setErrors]                 = useState({})
  const [formError, setFormError]           = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [importing, setImporting]           = useState(false)
  const fileRef                             = useRef(null)

  const effectiveDivisionId = divisions.length > 0 ? activeDivision : null

  const divTeams = divisions.length === 0
    ? teams
    : teams.filter(t => t.divisionId === activeDivision)
  const divPools = pools.filter(p => p.divisionId === activeDivision)

  function validate() {
    const e = {}
    if (teams.length === 0) { setFormError('Add at least one team'); return false }
    teams.forEach(t => {
      if (!t.name.trim()) e[t.id + '_name'] = 'Name required'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleAutoPool(divisionId) {
    const dt = teams.filter(t => t.divisionId === divisionId)
    if (dt.length === 0) return

    const { numPools } = suggestPoolStructure(dt.length, { preferredPoolSize: 4, maxPoolSize: 6 })

    const newPools = Array.from({ length: numPools }, (_, i) => ({
      id:        crypto.randomUUID(),
      divisionId,
      name:      'Pool ' + String.fromCharCode(65 + i),
      shortName: String.fromCharCode(65 + i),
      sortOrder: i,
    }))

    setPoolsForDivision(divisionId, newPools)

    const seeded      = serpentineSeeding(dt, numPools)
    const assignments = {}
    seeded.forEach((team, idx) => { assignments[team.id] = newPools[idx % numPools].id })
    setPoolAssignments(assignments)
  }

  async function handleCSV(file) {
    if (!file) return
    const targetDivision = activeDivision ?? divisions[0]?.id ?? null
    setImporting(true)
    setFormError(null)

    try {
      const { default: Papa } = await import('papaparse')
      Papa.parse(file, {
        header:         true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          const currentCount = teams.filter(t => t.divisionId === targetDivision).length
          const imported = data
            .map((row, i) => ({
              ...newTeam(targetDivision, currentCount + i + 1),
              name:           (row['Team Name']  || row['name']       || row['team_name'] || '').trim(),
              shortName:      (row['Short Name'] || row['short_name'] || '').trim(),
              clubName:       (row['Club']       || row['club']       || '').trim(),
              headCoachName:  (row['Coach']      || row['coach']      || '').trim(),
              headCoachEmail: (row['Email']      || row['email']      || '').trim(),
              primaryColor:   (row['Color']      || row['color']      || '#1a56db').trim(),
            }))
            .filter(t => t.name.length > 0)

          if (imported.length === 0) {
            setFormError('No valid teams found. Make sure the file has a "Team Name" column.')
          } else {
            addTeams(imported)
            setFormError(null)
          }
          setImporting(false)
        },
        error: () => {
          setFormError('Failed to parse CSV')
          setImporting(false)
        },
      })
    } catch {
      setFormError('CSV import failed. Run: npm install papaparse')
      setImporting(false)
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleNext() {
    if (!validate()) return
    if (!tournamentId) { onNext(); return }

    setSaving(true)
    try {
      for (const div of divisions) {
        const dt = teams.filter(t => t.divisionId === div.id)
        const dp = pools.filter(p => p.divisionId === div.id)

        for (const pool of dp) {
          if (!div.dbId || pool.dbId) continue
          const { data } = await db.pools.create({
            division_id: div.dbId,
            name:        pool.name,
            short_name:  pool.shortName || null,
            sort_order:  pool.sortOrder,
          })
          if (data) useWizardStore.getState().updatePool(pool.id, { dbId: data.id })
        }

        for (const [i, team] of dt.entries()) {
          const assignedPool = pools.find(p => p.id === poolAssignments[team.id])
          const payload = {
            tournament_id:    tournamentId,
            division_id:      div.dbId,
            pool_id:          assignedPool?.dbId ?? null,
            name:             team.name.trim(),
            short_name:       team.shortName?.trim()      || null,
            club_name:        team.clubName?.trim()       || null,
            primary_color:    team.primaryColor,
            seed:             team.seed ?? i + 1,
            head_coach_name:  team.headCoachName?.trim()  || null,
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
        <p className="section-subtitle">
          Add teams manually or import a CSV. Assign to pools now, or skip and do it later.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      {divisions.length > 1 && (
        <div className="flex gap-0 border-b border-gray-200">
          {divisions.map(div => (
            <button
              key={div.id}
              onClick={() => setActiveDivision(div.id)}
              className={
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
                (activeDivision === div.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700')
              }
            >
              {div.name || ('Division ' + (divisions.indexOf(div) + 1))}
              <span className="ml-1.5 text-xs text-gray-400">
                ({teams.filter(t => t.divisionId === div.id).length})
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => addTeam(newTeam(effectiveDivisionId, divTeams.length + 1))}
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
          {importing ? 'Importing...' : 'Import CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => handleCSV(e.target.files?.[0])}
        />

        <a
          href="/team_import_template.csv"
          download
          className="btn-ghost btn btn-sm text-xs text-gray-400"
        >
          Download template
        </a>

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

      {divTeams.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Users size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No teams yet. Add manually or import a CSV.</p>
          <p className="text-xs mt-1">CSV columns: Team Name, Short Name, Club, Coach, Email, Color</p>
        </div>
      ) : (
        <div className="space-y-2">
          {divTeams.map((team, idx) => (
            <TeamRow
              key={team.id}
              team={team}
              idx={idx}
              pools={divPools}
              assignment={poolAssignments[team.id]}
              errors={errors}
              onUpdate={u => updateTeam(team.id, u)}
              onRemove={() => removeTeam(team.id)}
              onAssign={poolId => setPoolAssignment(team.id, poolId)}
            />
          ))}
        </div>
      )}

      {divPools.length > 0 && (
        <PoolSummary pools={divPools} teams={divTeams} assignments={poolAssignments} />
      )}

      {teams.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {teams.length} team{teams.length !== 1 ? 's' : ''} total
        </p>
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
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
        <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>
        <input
          type="color"
          value={team.primaryColor}
          onChange={e => onUpdate({ primaryColor: e.target.value })}
          className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer flex-shrink-0 p-0"
          title="Team colour"
        />
        <input
          type="text"
          className={
            'flex-1 text-sm font-medium bg-transparent border-b border-transparent ' +
            'focus:border-blue-400 outline-none py-0.5 min-w-0 ' +
            (errors[team.id + '_name'] ? 'border-red-400 text-red-700' : '')
          }
          placeholder="Team name"
          value={team.name}
          onChange={e => onUpdate({ name: e.target.value })}
        />
        {pools.length > 0 && (
          <select
            className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-700 focus:ring-1 focus:ring-blue-400 flex-shrink-0"
            value={assignment ?? ''}
            onChange={e => onAssign(e.target.value || null)}
          >
            <option value="">Pool</option>
            {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button onClick={() => setExpanded(e => !e)} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50">
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
    <div className="mt-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pool summary</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pools.map(pool => {
          const poolTeams = teams.filter(t => assignments[t.id] === pool.id)
          return (
            <div key={pool.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">{pool.name}</p>
              {poolTeams.length === 0
                ? <p className="text-xs text-gray-400 italic">Empty</p>
                : poolTeams.map(t => <p key={t.id} className="text-xs text-gray-600 truncate">{t.name}</p>)
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}
