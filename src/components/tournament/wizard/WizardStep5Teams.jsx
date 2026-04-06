import { useState, useRef, useEffect } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { evaluatePoolConstraints, autoDetect } from '../../../lib/constraintEngine'
import { ConstraintEditor } from '../teams/ConstraintEditor'
import { PlusCircle, Trash2, Upload, Users, ChevronDown, ChevronUp, AlertTriangle, Settings, GripVertical } from 'lucide-react'
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
    divisions, teams, pools, poolAssignments, venues,
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
  const [violations, setViolations]         = useState([])
  const fileRef                             = useRef(null)

  const effectiveDivisionId = divisions.length > 0 ? activeDivision : null
  const divTeams = divisions.length === 0 ? teams : teams.filter(t => t.divisionId === activeDivision)
  const divPools = pools.filter(p => p.divisionId === activeDivision)

  // Auto-detect constraint violations whenever teams or pool assignments change
  useEffect(() => {
    const found = autoDetect({ teams, pools, poolAssignments, matches: [], slots: [] })
    setViolations(found)
  }, [teams.length, JSON.stringify(poolAssignments)])

  function validate() {
    const e = {}
    const liveTeams = useWizardStore.getState().teams
    if (liveTeams.length === 0) { setFormError('Add at least one team'); return false }
    liveTeams.forEach(t => {
      if (!t.name.trim()) e[t.id + '_name'] = 'Name required'
    })
    setErrors(e)
    if (Object.keys(e).length > 0) { setFormError('Fix team names before continuing'); return false }
    return true
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
    const seeded = serpentineSeeding(dt, numPools)
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
        header: true, skipEmptyLines: true,
        complete: ({ data }) => {
          const currentCount = useWizardStore.getState().teams.filter(t => t.divisionId === targetDivision).length
          const imported = data.map((row, i) => ({
            ...newTeam(targetDivision, currentCount + i + 1),
            name:           (row['Team Name']  || row['name']       || '').trim(),
            shortName:      (row['Short Name'] || row['short_name'] || '').trim(),
            clubName:       (row['Club']       || row['club']       || '').trim(),
            headCoachName:  (row['Coach']      || row['coach']      || '').trim(),
            headCoachEmail: (row['Email']      || row['email']      || '').trim(),
            primaryColor:   (row['Color']      || row['color']      || '#1a56db').trim(),
          })).filter(t => t.name.length > 0)

          if (imported.length === 0) {
            setFormError('No valid teams found. Check the file has a "Team Name" column.')
          } else {
            addTeams(imported)
          }
          setImporting(false)
        },
        error: () => { setFormError('Failed to parse CSV'); setImporting(false) },
      })
    } catch {
      setFormError('CSV import failed -- run: npm install papaparse')
      setImporting(false)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleNext() {
    if (!validate()) return
    if (!tournamentId) { onNext(); return }

    setSaving(true)
    try {
      const liveState = useWizardStore.getState()

      // Load ALL divisions for this tournament from the DB
      const { data: dbDivisions, error: divErr } = await db.divisions.byTournament(tournamentId)
      if (divErr) throw new Error('Failed to load divisions: ' + divErr.message)
      if (!dbDivisions || dbDivisions.length === 0) throw new Error('No divisions found in DB for this tournament. Go back to Step 3 and save divisions first.')

      console.log('[Step5 save] DB divisions:', dbDivisions.map(d => ({ id: d.id, name: d.name, slug: d.slug })))
      console.log('[Step5 save] Store divisions:', liveState.divisions.map(d => ({ id: d.id, name: d.name, slug: d.slug, dbId: d.dbId })))

      // Match store divisions to DB divisions — try dbId first, then slug, then name
      const resolvedDivisions = liveState.divisions.map(div => {
        const dbDiv = dbDivisions.find(d =>
          d.id === div.dbId ||
          (div.slug && d.slug === div.slug) ||
          d.name.trim().toLowerCase() === div.name.trim().toLowerCase()
        )
        if (dbDiv && !div.dbId) useWizardStore.getState().updateDivision(div.id, { dbId: dbDiv.id })
        return { storeDiv: div, dbDivId: dbDiv?.id ?? null }
      })

      const unmapped = resolvedDivisions.filter(r => !r.dbDivId)
      if (unmapped.length > 0) throw new Error(`Could not match division "${unmapped[0].storeDiv.name}" to a saved division. Go back to Step 3 and re-save.`)

      // Re-read store after updating dbIds
      const state2 = useWizardStore.getState()

      for (const { storeDiv, dbDivId } of resolvedDivisions) {
        const dt = state2.teams.filter(t => t.divisionId === storeDiv.id)
        const dp = state2.pools.filter(p => p.divisionId === storeDiv.id)

        console.log('[Step5 save] Division', storeDiv.name, '→ dbId', dbDivId, '| pools:', dp.length, '| teams:', dt.length)

        // Load existing DB pools for this division to avoid duplicates
        const { data: dbPools } = await supabase
          .from('pools')
          .select('id, name')
          .eq('division_id', dbDivId)
        const dbPoolByName = Object.fromEntries((dbPools ?? []).map(p => [p.name.trim().toLowerCase(), p.id]))

        // Save pools — upsert by name
        for (const pool of dp) {
          const existingDbId = pool.dbId || dbPoolByName[pool.name.trim().toLowerCase()]
          if (existingDbId) {
            // Already exists — just stamp the dbId
            if (!pool.dbId) useWizardStore.getState().updatePool(pool.id, { dbId: existingDbId })
          } else {
            // Insert new pool
            const { data, error: poolErr } = await supabase
              .from('pools')
              .insert({ division_id: dbDivId, name: pool.name, short_name: pool.shortName || null, sort_order: pool.sortOrder ?? 0 })
              .select().single()
            if (poolErr) throw new Error('Failed to save pool "' + pool.name + '": ' + poolErr.message)
            if (data) useWizardStore.getState().updatePool(pool.id, { dbId: data.id })
          }
        }

        // Re-read after pool saves
        const state3 = useWizardStore.getState()

        for (const [i, team] of dt.entries()) {
          const assignedPool = state3.pools.find(p => p.id === state3.poolAssignments[team.id])
          const payload = {
            tournament_id:    tournamentId,
            division_id:      dbDivId,
            pool_id:          assignedPool?.dbId ?? null,
            name:             team.name.trim(),
            short_name:       team.shortName?.trim()      || null,
            club_name:        team.clubName?.trim()       || null,
            primary_color:    team.primaryColor,
            seed:             team.seed ?? i + 1,
            head_coach_name:  team.headCoachName?.trim()  || null,
            head_coach_email: team.headCoachEmail?.trim() || null,
            constraints:      team.constraints ?? {},
          }
          if (team.dbId) {
            await db.teams.update(team.dbId, payload)
          } else {
            const { data: existing } = await supabase
              .from('tournament_teams')
              .select('id')
              .eq('tournament_id', tournamentId)
              .eq('division_id', dbDivId)
              .eq('name', team.name.trim())
              .maybeSingle()
            if (existing) {
              updateTeam(team.id, { dbId: existing.id })
              await db.teams.update(existing.id, payload)
            } else {
              const { data, error: teamErr } = await db.teams.create(payload)
              if (teamErr) throw new Error('Failed to save team "' + team.name + '": ' + teamErr.message)
              if (data) updateTeam(team.id, { dbId: data.id })
            }
          }
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      console.error('[Step5 save] Error:', err)
      setFormError(err.message || 'Failed to save teams')
    } finally {
      setSaving(false)
    }
  }

  const errorCount   = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Teams & Pools</h2>
        <p className="section-subtitle">Add teams, assign pools, and set constraints. Same-club conflicts are auto-detected.</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /> {formError}
        </div>
      )}

      {/* Auto-detected violations banner */}
      {violations.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {errorCount > 0 && `${errorCount} conflict${errorCount !== 1 ? 's' : ''}`}
            {errorCount > 0 && warningCount > 0 && ', '}
            {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
            {' auto-detected'}
          </p>
          {violations.slice(0, 3).map((v, i) => (
            <p key={i} className="text-xs text-amber-700 ml-5">{v.message}</p>
          ))}
          {violations.length > 3 && (
            <p className="text-xs text-amber-600 ml-5">+{violations.length - 3} more (review in Step 7)</p>
          )}
        </div>
      )}

      {/* Division tabs */}
      {divisions.length > 1 && (
        <div className="flex gap-0 border-b border-[var(--border)]">
          {divisions.map(div => (
            <button key={div.id} onClick={() => setActiveDivision(div.id)}
              className={'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' + (
                activeDivision === div.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {div.name || ('Division ' + (divisions.indexOf(div) + 1))}
              <span className="ml-1.5 text-xs text-[var(--text-muted)]">({teams.filter(t => t.divisionId === div.id).length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => addTeam(newTeam(effectiveDivisionId, divTeams.length + 1))} className="btn-primary btn btn-sm">
          <PlusCircle size={14} /> Add team
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary btn btn-sm">
          <Upload size={14} /> {importing ? 'Importing...' : 'Import CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => handleCSV(e.target.files?.[0])} />
        <a href="/team_import_template.csv" download className="btn-ghost btn btn-sm text-xs text-[var(--text-muted)]">
          Download template
        </a>
        {divTeams.length >= 4 && (
          <button onClick={() => handleAutoPool(activeDivision)} className="btn-secondary btn btn-sm ml-auto">
            <Users size={14} /> Auto-generate pools
          </button>
        )}
      </div>

      {divTeams.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-xl">
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
              allTeams={divTeams}
              venues={venues}
              assignment={poolAssignments[team.id]}
              violations={violations.filter(v => v.teamIds.includes(team.id))}
              errors={errors}
              onUpdate={u => updateTeam(team.id, u)}
              onRemove={() => removeTeam(team.id)}
              onAssign={poolId => setPoolAssignment(team.id, poolId)}
            />
          ))}
        </div>
      )}

      {divPools.length > 0 && (
        <PoolSummary pools={divPools} teams={divTeams} assignments={poolAssignments} violations={violations}
          onAssign={(teamId, poolId) => setPoolAssignment(teamId, poolId)} />
      )}

      {teams.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] text-right">{teams.length} team{teams.length !== 1 ? 's' : ''} total</p>
      )}

      <WizardNavButtons onNext={handleNext} onBack={onBack} saving={saving} nextDisabled={teams.length === 0} />
    </div>
  )
}

function TeamRow({ team, idx, pools, allTeams, venues, assignment, violations, errors, onUpdate, onRemove, onAssign }) {
  const [expanded, setExpanded]           = useState(false)
  const [showConstraints, setShowConstraints] = useState(false)

  const hasViolations = violations.length > 0
  const hasErrors     = violations.some(v => v.severity === 'error')

  return (
    <div className={'border rounded-xl overflow-hidden ' + (hasErrors ? 'border-red-300' : hasViolations ? 'border-amber-300' : 'border-gray-200')}>
      <div className="flex items-center gap-2 px-3 py-2.5 ">
        <span className="text-xs text-[var(--text-muted)] w-5 text-right flex-shrink-0">{idx + 1}</span>
        <input type="color" value={team.primaryColor}
          onChange={e => onUpdate({ primaryColor: e.target.value })}
          className="w-6 h-6 rounded-full border border-[var(--border)] cursor-pointer flex-shrink-0 p-0" />
        <input type="text"
          className={'flex-1 text-sm font-medium bg-transparent border-b border-transparent focus:border-blue-400 outline-none py-0.5 min-w-0 ' + (errors[team.id + '_name'] ? 'border-red-400 text-red-700' : '')}
          placeholder="Team name" value={team.name}
          onChange={e => onUpdate({ name: e.target.value })} />

        {hasViolations && (
          <span className={'flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ' + (hasErrors ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
            {violations.length} {hasErrors ? 'conflict' : 'warning'}{violations.length !== 1 ? 's' : ''}
          </span>
        )}

        {pools.length > 0 && (
          <select className="text-xs border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)] focus:ring-1 focus:ring-blue-400 flex-shrink-0"
            value={assignment ?? ''} onChange={e => onAssign(e.target.value || null)}>
            <option value="">Pool</option>
            {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        <button onClick={() => setShowConstraints(c => !c)}
          className={'p-1 flex-shrink-0 rounded-lg transition-colors ' + (showConstraints ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600')}
          title="Constraints">
          <Settings size={14} />
        </button>
        <button onClick={() => setExpanded(e => !e)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[var(--text-muted)] hover:text-red-500 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Constraint editor */}
      {showConstraints && (
        <div className="border-t border-blue-100 bg-[var(--accent-dim)]/30 px-4 py-4">
          <p className="text-xs font-semibold text-[var(--accent)] mb-3">Constraints for {team.name || 'this team'}</p>
          <ConstraintEditor
            team={team}
            allTeams={allTeams}
            venues={venues}
            constraints={team.constraints}
            onChange={newConstraints => onUpdate({ constraints: newConstraints })}
          />
        </div>
      )}

      {/* Basic details */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 gap-3 ">
          <div className="field-group">
            <label className="field-label text-xs">Short name</label>
            <input type="text" className="field-input text-sm" value={team.shortName ?? ''}
              onChange={e => onUpdate({ shortName: e.target.value })} maxLength={8} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Club / school</label>
            <input type="text" className="field-input text-sm" value={team.clubName ?? ''}
              onChange={e => onUpdate({ clubName: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Seed</label>
            <input type="number" className="field-input text-sm" min={1} value={team.seed ?? ''}
              onChange={e => onUpdate({ seed: Number(e.target.value) })} />
          </div>
          <div className="field-group">
            <label className="field-label text-xs">Head coach</label>
            <input type="text" className="field-input text-sm" value={team.headCoachName ?? ''}
              onChange={e => onUpdate({ headCoachName: e.target.value })} />
          </div>
          <div className="field-group sm:col-span-2">
            <label className="field-label text-xs">Coach email</label>
            <input type="email" className="field-input text-sm" value={team.headCoachEmail ?? ''}
              onChange={e => onUpdate({ headCoachEmail: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  )
}

function PoolSummary({ pools, teams, assignments, violations, onAssign }) {
  const [dragTeamId, setDragTeamId] = useState(null)
  const [dragOver,   setDragOver]   = useState(null) // poolId being hovered

  function handleDragStart(teamId) { setDragTeamId(teamId) }
  function handleDragOver(e, poolId) { e.preventDefault(); setDragOver(poolId) }
  function handleDragLeave() { setDragOver(null) }
  function handleDrop(poolId) {
    if (dragTeamId) onAssign(dragTeamId, poolId)
    setDragTeamId(null)
    setDragOver(null)
  }

  const unassigned = teams.filter(t => !assignments[t.id] || !pools.find(p => p.id === assignments[t.id]))

  return (
    <div className="mt-2 space-y-3">
      <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
        Pool board — drag teams between pools
      </h4>

      {/* Unassigned bin */}
      {unassigned.length > 0 && (
        <div
          className={"border-2 border-dashed rounded-xl p-3 " + (dragOver === '__unassigned' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)]')}
          onDragOver={e => handleDragOver(e, '__unassigned')}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(null)}
        >
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Unassigned ({unassigned.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map(t => (
              <PoolTeamChip key={t.id} team={t} onDragStart={handleDragStart} />
            ))}
          </div>
        </div>
      )}

      {/* Pool columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(pools.length, 4)}, 1fr)` }}>
        {pools.map(pool => {
          const poolTeams      = teams.filter(t => assignments[t.id] === pool.id)
          const poolViolations = violations.filter(v => v.poolId === pool.id)
          const isOver         = dragOver === pool.id

          return (
            <div
              key={pool.id}
              onDragOver={e => handleDragOver(e, pool.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(pool.id)}
              className={"border-2 rounded-xl p-3 min-h-24 transition-colors " + (
                isOver
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
                  : poolViolations.length > 0
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-[var(--border)] bg-[var(--bg-raised)]'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">{pool.name}</p>
                <span className="text-xs text-[var(--text-muted)]">{poolTeams.length}</span>
              </div>

              {poolViolations.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mb-1.5">
                  <AlertTriangle size={10} /> {poolViolations[0].message}
                </p>
              )}

              <div className="space-y-1">
                {poolTeams.length === 0
                  ? <p className="text-xs text-[var(--text-muted)] italic py-2 text-center">Drop here</p>
                  : poolTeams.map(t => <PoolTeamChip key={t.id} team={t} onDragStart={handleDragStart} />)
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PoolTeamChip({ team, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(team.id)}
      className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg cursor-grab active:cursor-grabbing select-none hover:border-[var(--border-mid)] transition-colors"
    >
      <GripVertical size={11} className="text-[var(--text-muted)] flex-shrink-0" />
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.primaryColor ?? '#e5e7eb' }} />
      <span className="text-xs font-medium text-[var(--text-secondary)] truncate max-w-24">{team.name || 'Unnamed'}</span>
    </div>
  )
}
