import { useEffect, useMemo, useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import {
  getDivisionStructureSummary,
  getEligiblePlayoffPresets,
  getRecommendedPlayoffPreset,
} from '../../../lib/playoffs/playoffPresets'
import { buildPlayoffPreview } from '../../../lib/playoffs/playoffPreviewBuilder'
import { buildPlayoffStructure } from '../../../lib/playoffs/playoffStructureGenerator'
import {
  AlertTriangle,
  Trophy,
  Layers,
  CheckCircle2,
  Braces,
} from 'lucide-react'

export function WizardStep7Playoffs({ onNext, onBack }) {
  const {
    tournamentId,
    divisions,
    teams,
    pools,
    poolAssignments,
    playoffConfigs,
    generatedPlayoffMatches,
    setPlayoffConfig,
    setGeneratedPlayoffMatches,
  } = useWizardStore()

  const [activeDivisionId, setActiveDivisionId] = useState(divisions[0]?.id ?? null)
  const [standingsRows, setStandingsRows] = useState([])
  const [loadingStandings, setLoadingStandings] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showDebug, setShowDebug] = useState(false)

  const activeDivision =
    divisions.find(d => d.id === activeDivisionId) || divisions[0] || null

  useEffect(() => {
    if (!activeDivisionId && divisions.length > 0) {
      setActiveDivisionId(divisions[0].id)
    }
  }, [activeDivisionId, divisions])

  useEffect(() => {
    async function loadStandings() {
      if (!activeDivision?.dbId) {
        setStandingsRows([])
        return
      }

      setLoadingStandings(true)
      setFormError(null)

      try {
        const { data, error } = await supabase
          .from('pool_standings_display')
          .select(`
            pool_id,
            division_id,
            rank,
            team_id,
            team_name,
            team_short_name,
            primary_color
          `)
          .eq('division_id', activeDivision.dbId)
          .order('pool_id')
          .order('rank')

        if (error) {
          throw new Error(error.message || 'Failed to load standings.')
        }

        setStandingsRows(data ?? [])
      } catch (err) {
        console.error('[Step7 standings load] Error:', err)
        setFormError(err.message || 'Failed to load standings.')
        setStandingsRows([])
      } finally {
        setLoadingStandings(false)
      }
    }

    loadStandings()
  }, [activeDivision?.dbId])

  const structure = useMemo(() => {
    if (!activeDivision) return null

    return getDivisionStructureSummary({
      division: activeDivision,
      teams,
      pools,
      poolAssignments,
    })
  }, [activeDivision, teams, pools, poolAssignments])

  const eligiblePresets = useMemo(() => {
    if (!activeDivision) return []

    return getEligiblePlayoffPresets({
      division: activeDivision,
      teams,
      pools,
      poolAssignments,
    })
  }, [activeDivision, teams, pools, poolAssignments])

  const recommendedPreset = useMemo(() => {
    if (!activeDivision) return null

    return getRecommendedPlayoffPreset({
      division: activeDivision,
      teams,
      pools,
      poolAssignments,
    })
  }, [activeDivision, teams, pools, poolAssignments])

  const selectedPresetKey =
    (activeDivisionId && playoffConfigs?.[activeDivisionId]?.presetKey) ||
    recommendedPreset?.key ||
    null

  const selectedPreset =
    eligiblePresets.find(p => p.key === selectedPresetKey) || null

  const preview = useMemo(() => {
    if (!activeDivision || !selectedPresetKey) return null

    return buildPlayoffPreview({
      presetKey: selectedPresetKey,
      division: activeDivision,
      teams,
      pools,
      standingsRows,
    })
  }, [selectedPresetKey, activeDivision, teams, pools, standingsRows])

  const divisionGeneratedPlayoffMatches = useMemo(() => {
    if (!activeDivision) return []
    return (generatedPlayoffMatches || []).filter(
      m => m.division_id === activeDivision.id
    )
  }, [generatedPlayoffMatches, activeDivision])

  function handleSelectPreset(preset) {
    if (!activeDivision) return

    setPlayoffConfig(activeDivision.id, {
      presetKey: preset.key,
      championshipTeams: preset.championshipTeams ?? null,
      bronzeGame: preset.defaults?.bronzeGame ?? false,
      consolationMode: preset.defaults?.consolationMode ?? 'none',
      classificationMode: preset.defaults?.classificationMode ?? 'none',
      seedingMethod: preset.defaults?.seedingMethod ?? 'PRESET',
      generationScope: preset.defaults?.generationScope ?? 'first_round',
      locked: false,
    })
  }

  function handleGenerateStructure() {
    if (!activeDivision || !selectedPresetKey) {
      setFormError('Choose a playoff preset before generating structure.')
      return
    }

    const result = buildPlayoffStructure({
      presetKey: selectedPresetKey,
      division: activeDivision,
      teams,
      pools,
      standingsRows,
      tournamentId,
    })

    if (result?.warnings?.length) {
      setFormError(result.warnings.join(' '))
    } else {
      setFormError(null)
    }

    const otherDivisionMatches = (generatedPlayoffMatches || []).filter(
      m => m.division_id !== activeDivision.id
    )

    setGeneratedPlayoffMatches([
      ...otherDivisionMatches,
      ...(result?.matches || []),
    ])
  }

  function validate() {
    if (!divisions.length) {
      setFormError('Add at least one division before configuring playoffs.')
      return false
    }

    for (const division of divisions) {
      const config = playoffConfigs?.[division.id]
      if (!config?.presetKey) {
        setFormError(`Choose a playoff preset for ${division.name}.`)
        return false
      }
    }

    setFormError(null)
    return true
  }

  function handleNext() {
    if (!validate()) return
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Advancement & Playoffs</h2>
        <p className="section-subtitle">
          Choose how each division advances from pool play into playoffs or classification games.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      {divisions.length > 1 && (
        <div className="flex gap-0 border-b border-[var(--border)]">
          {divisions.map(div => {
            const isActive = activeDivisionId === div.id
            const configured = !!playoffConfigs?.[div.id]?.presetKey

            return (
              <button
                key={div.id}
                onClick={() => setActiveDivisionId(div.id)}
                className={
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ' +
                  (isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700')
                }
              >
                {div.name || 'Division'}
                {configured && <CheckCircle2 size={14} />}
              </button>
            )
          })}
        </div>
      )}

      {!activeDivision ? (
        <div className="text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl p-4">
          No division selected.
        </div>
      ) : (
        <>
          <DetectedStructureCard
            division={activeDivision}
            structure={structure}
            loadingStandings={loadingStandings}
            standingsRows={standingsRows}
          />

          <div className="rounded-xl border border-dashed border-[var(--border)] p-4 bg-[var(--bg-raised)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Step 7 debug
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Temporary playoff wiring diagnostics
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDebug(v => !v)}
                className="btn-ghost btn btn-sm"
              >
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
            </div>

            {showDebug && (
              <div className="mt-4 space-y-4 text-xs">
                <DebugRow label="Division name" value={activeDivision?.name} />
                <DebugRow label="Division id" value={activeDivision?.id} />
                <DebugRow label="Division dbId" value={activeDivision?.dbId} />
                <DebugRow label="Format type" value={activeDivision?.formatType} />
                <DebugRow label="Team count" value={structure?.teamCount} />
                <DebugRow label="Pool count" value={structure?.poolCount} />
                <DebugRow
                  label="Pool sizes"
                  value={structure?.teamsPerPool?.length ? structure.teamsPerPool.join(', ') : '—'}
                />
                <DebugRow label="Standings rows" value={standingsRows?.length ?? 0} />
                <DebugRow
                  label="Eligible presets"
                  value={
                    eligiblePresets.length
                      ? eligiblePresets.map(p => p.key).join(', ')
                      : 'None'
                  }
                />
                <DebugRow label="Recommended preset" value={recommendedPreset?.key || 'None'} />
                <DebugRow label="Selected preset" value={selectedPresetKey || 'None'} />
                <DebugRow
                  label="Generated playoff matches"
                  value={divisionGeneratedPlayoffMatches.length}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Playoff presets
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                AthleteOS recommends the best playoff path for this division structure, but you can choose another valid option.
              </p>
            </div>

            {eligiblePresets.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No playoff presets are currently available for this division structure.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {eligiblePresets.map(preset => {
                  const isRecommended = recommendedPreset?.key === preset.key
                  const isSelected = selectedPresetKey === preset.key

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={
                        'text-left rounded-xl border p-4 transition-colors ' +
                        (isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isRecommended
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-mid)]')
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {preset.label}
                            </p>
                            {isRecommended && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                Recommended
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Selected
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {preset.description}
                          </p>
                        </div>

                        <Trophy size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="px-2 py-1 rounded-full bg-[var(--bg-raised)]">
                          {preset.category}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-[var(--bg-raised)]">
                          Scope: {preset.defaults?.generationScope || 'first_round'}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-[var(--bg-raised)]">
                          Bronze: {preset.defaults?.bronzeGame ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGenerateStructure}
              disabled={!selectedPresetKey}
              className="btn-primary btn btn-sm"
            >
              <Braces size={14} />
              Generate playoff structure
            </button>
          </div>

          <PlayoffPreviewCard
            division={activeDivision}
            preset={selectedPreset}
            preview={preview}
          />

          <GeneratedStructureCard matches={divisionGeneratedPlayoffMatches} />
        </>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        nextLabel="Save playoff setup & continue"
      />
    </div>
  )
}

function DetectedStructureCard({ division, structure, loadingStandings, standingsRows }) {
  if (!division || !structure) return null

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={16} className="text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Detected division structure
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat label="Format" value={division.formatType || '—'} />
        <SummaryStat label="Teams" value={structure.teamCount} />
        <SummaryStat label="Pools" value={structure.poolCount} />
        <SummaryStat
          label="Pool sizes"
          value={
            structure.teamsPerPool?.length
              ? structure.teamsPerPool.join(', ')
              : '—'
          }
        />
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {loadingStandings
          ? 'Loading standings for preview...'
          : standingsRows.length > 0
          ? 'Standings loaded. Presets can preview real qualifiers and seeds.'
          : 'No standings rows found yet. Presets can still be configured, but previews may be incomplete.'}
      </div>
    </div>
  )
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
        {value ?? '—'}
      </p>
    </div>
  )
}

function DebugRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 items-start">
      <p className="font-semibold text-[var(--text-secondary)]">{label}</p>
      <p className="text-[var(--text-muted)] break-all">{String(value ?? '—')}</p>
    </div>
  )
}

function PlayoffPreviewCard({ division, preset, preview }) {
  const [viewMode, setViewMode] = useState('sources')

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Playoff preview
          </h3>
        </div>

        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('sources')}
            className={
              'px-3 py-1.5 text-xs font-medium transition-colors ' +
              (viewMode === 'sources'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-transparent text-[var(--text-muted)]')
            }
          >
            Sources
          </button>
          <button
            type="button"
            onClick={() => setViewMode('projected')}
            className={
              'px-3 py-1.5 text-xs font-medium transition-colors border-l border-[var(--border)] ' +
              (viewMode === 'projected'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-transparent text-[var(--text-muted)]')
            }
          >
            Projected teams
          </button>
        </div>
      </div>

      {!preset ? (
        <div className="text-sm text-[var(--text-muted)]">
          Choose a playoff preset to preview qualifiers, seeds, and first-round matchups.
        </div>
      ) : preview?.warnings?.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-700">
            Preview is incomplete
          </p>
          <ul className="text-xs text-amber-700 space-y-1">
            {preview.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Qualifiers
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(preview?.qualifiers || []).map(q => (
                <div
                  key={`${q.seed}-${q.teamId}`}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--bg-surface)]"
                >
                  <p className="text-xs text-[var(--text-muted)]">
                    Seed {q.seed} • {q.source}
                  </p>
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                    {q.teamName}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              First round
            </p>
            <div className="space-y-2">
              {(preview?.firstRound || []).map(match => (
                <div
                  key={match.code}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--bg-surface)]"
                >
                  <p className="text-xs text-[var(--text-muted)]">
                    {match.code} • {match.label}
                  </p>

                  {viewMode === 'sources' ? (
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                      {match.sourceA} vs {match.sourceB}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                      {match.teamA.teamName} vs {match.teamB.teamName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Structure
            </p>
            <div className="space-y-2">
              {(preview?.structure || []).map(node => (
                <div
                  key={node.code}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--bg-surface)]"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {node.code} — {node.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {node.sourceA} vs {node.sourceB}
                  </p>
                  {(node.winnerTo || node.loserTo) && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {node.winnerTo ? `Winner → ${node.winnerTo}` : ''}
                      {node.winnerTo && node.loserTo ? ' • ' : ''}
                      {node.loserTo ? `Loser → ${node.loserTo}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Placement summary
            </p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              {(preview?.placementSummary || []).map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {preset && (
        <div className="text-xs text-[var(--text-muted)]">
          Selected preset for {division?.name}: <span className="font-semibold">{preset.label}</span>
        </div>
      )}
    </div>
  )
}

function GeneratedStructureCard({ matches = [] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Braces size={16} className="text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Generated playoff structure
        </h3>
      </div>

      {matches.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">
          No playoff structure generated yet.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map(match => (
            <div
              key={match.id}
              className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--bg-surface)]"
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {match.match_code} — {match.display_label || match.round_label || 'Playoff match'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {match.source_a_type}:{match.source_a_ref} vs {match.source_b_type}:{match.source_b_ref}
              </p>
              {(match.winner_to_match_code || match.loser_to_match_code) && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {match.winner_to_match_code ? `Winner → ${match.winner_to_match_code}` : ''}
                  {match.winner_to_match_code && match.loser_to_match_code ? ' • ' : ''}
                  {match.loser_to_match_code ? `Loser → ${match.loser_to_match_code}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}