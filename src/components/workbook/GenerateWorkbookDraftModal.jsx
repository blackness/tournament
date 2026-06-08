import { useState } from 'react'
import { X, FileSpreadsheet, Download, PlusCircle, Trash2 } from 'lucide-react'
import { generateTournamentWorkbookDraft } from '../../lib/workbook/generateTournamentWorkbookDraft'
import {
  DEFAULT_WORKBOOK_DRAFT_CONFIG,
  WORKBOOK_SCHEDULE_DRAFT_LEVELS,
  WORKBOOK_TEAM_ROW_STYLES,
} from '../../lib/workbook/workbookDraftConfig'
import { FORMAT_LABELS, FORMAT_SUPPORT } from '../../lib/constants'

function newDivision(sortOrder, defaults) {
  return {
    name: '',
    slug: '',
    formatType: 'pool_to_bracket',
    teamCount: 8,
    poolCount: 2,
    teamsAdvancePerPool: 2,
    thirdPlaceGame: false,
    consolationBracket: false,
    gameDurationMinutes: defaults.gameDurationMinutes,
    breakBetweenGamesMinutes: defaults.breakBetweenGamesMinutes,
    sortOrder,
  }
}

export function GenerateWorkbookDraftModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    tournament: { ...DEFAULT_WORKBOOK_DRAFT_CONFIG.tournament },
    scheduleDefaults: { ...DEFAULT_WORKBOOK_DRAFT_CONFIG.scheduleDefaults },
    workbookOptions: { ...DEFAULT_WORKBOOK_DRAFT_CONFIG.workbookOptions },
    divisions: [
      newDivision(0, DEFAULT_WORKBOOK_DRAFT_CONFIG.scheduleDefaults),
    ],
  })

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState([])

  if (!isOpen) return null

  function updateTournament(updates) {
    setForm(prev => ({
      ...prev,
      tournament: { ...prev.tournament, ...updates },
    }))
  }

  function updateScheduleDefaults(updates) {
    setForm(prev => ({
      ...prev,
      scheduleDefaults: { ...prev.scheduleDefaults, ...updates },
      divisions: prev.divisions.map(div => ({
        ...div,
        gameDurationMinutes:
          updates.gameDurationMinutes ?? div.gameDurationMinutes,
        breakBetweenGamesMinutes:
          updates.breakBetweenGamesMinutes ?? div.breakBetweenGamesMinutes,
      })),
    }))
  }

  function updateWorkbookOptions(updates) {
    setForm(prev => ({
      ...prev,
      workbookOptions: {
        ...prev.workbookOptions,
        ...updates,
      },
    }))
  }

  function updateDivision(index, updates) {
    setForm(prev => ({
      ...prev,
      divisions: prev.divisions.map((division, i) =>
        i === index ? { ...division, ...updates } : division
      ),
    }))
  }

  function addDivision() {
    setForm(prev => ({
      ...prev,
      divisions: [
        ...prev.divisions,
        newDivision(prev.divisions.length, prev.scheduleDefaults),
      ],
    }))
  }

  function removeDivision(index) {
    setForm(prev => ({
      ...prev,
      divisions: prev.divisions.filter((_, i) => i !== index),
    }))
  }

  function validateStep(currentStep) {
    const nextErrors = []

    if (currentStep === 1) {
      if (!form.tournament.name.trim()) nextErrors.push('Tournament name is required.')
      if (!form.scheduleDefaults.numberOfDays || form.scheduleDefaults.numberOfDays < 1) {
        nextErrors.push('Number of days must be at least 1.')
      }
      if (!form.scheduleDefaults.fieldsCount || form.scheduleDefaults.fieldsCount < 1) {
        nextErrors.push('Number of fields must be at least 1.')
      }
      if (!form.scheduleDefaults.gameDurationMinutes || form.scheduleDefaults.gameDurationMinutes < 20) {
        nextErrors.push('Game duration must be at least 20 minutes.')
      }
    }

    if (currentStep === 2) {
      if (form.divisions.length === 0) {
        nextErrors.push('Add at least one division.')
      }

      form.divisions.forEach((division, index) => {
        if (!division.name.trim()) {
          nextErrors.push(`Division ${index + 1} needs a name.`)
        }
        if (!division.teamCount || division.teamCount < 2) {
          nextErrors.push(`Division ${division.name || index + 1} must have at least 2 teams.`)
        }

        const support = FORMAT_SUPPORT[division.formatType]
        if (!support) {
          nextErrors.push(`Division ${division.name || index + 1} has an unknown format.`)
        }

        const needsPools = ['pool_to_bracket', 'pool_to_placement', 'crossover_pools'].includes(
          division.formatType
        )

        if (needsPools && (!division.poolCount || division.poolCount < 1)) {
          nextErrors.push(`Division ${division.name || index + 1} must have at least 1 pool.`)
        }
      })
    }

    setErrors(nextErrors)
    return nextErrors.length === 0
  }

  function handleNext() {
    if (!validateStep(step)) return
    setStep(s => Math.min(3, s + 1))
  }

  function handleBack() {
    setErrors([])
    setStep(s => Math.max(1, s - 1))
  }

  async function handleGenerate() {
    if (!validateStep(step)) return

    setSubmitting(true)
    setErrors([])

    try {
      const result = await generateTournamentWorkbookDraft(form)

      const blob = new Blob([result.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName
      a.click()
      window.URL.revokeObjectURL(url)

      onClose?.()
    } catch (err) {
      setErrors(err.validationErrors ?? [err.message || 'Failed to generate workbook draft.'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(16,185,129,0.10)',
                color: '#10b981',
              }}
            >
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Generate Sample Workbook Template
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Create a sample editable workbook template for a tournament structure. This is separate from the current tournament round-trip workbook export.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              borderRadius: 10,
              padding: 8,
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 8px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 1, label: 'Tournament' },
              { id: 2, label: 'Divisions' },
              { id: 3, label: 'Workbook Options' },
            ].map(item => (
              <div
                key={item.id}
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  border: `1px solid ${step === item.id ? '#10b981' : 'var(--border)'}`,
                  background: step === item.id ? 'rgba(16,185,129,0.10)' : 'transparent',
                  color: step === item.id ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {errors.length > 0 && (
          <div
            style={{
              margin: '8px 20px 0',
              padding: 12,
              borderRadius: 12,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ padding: 20 }}>
          {step === 1 && (
            <StepTournamentBasics
              tournament={form.tournament}
              scheduleDefaults={form.scheduleDefaults}
              onTournamentChange={updateTournament}
              onScheduleDefaultsChange={updateScheduleDefaults}
            />
          )}

          {step === 2 && (
            <StepDivisions
              divisions={form.divisions}
              onDivisionChange={updateDivision}
              onAddDivision={addDivision}
              onRemoveDivision={removeDivision}
            />
          )}

          {step === 3 && (
            <StepWorkbookOptions
              workbookOptions={form.workbookOptions}
              onWorkbookOptionsChange={updateWorkbookOptions}
            />
          )}
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button
            onClick={step === 1 ? onClose : handleBack}
            style={secondaryButtonStyle()}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button onClick={handleNext} style={primaryButtonStyle()}>
              Next
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={submitting} style={primaryButtonStyle(submitting)}>
              <Download size={15} />
              {submitting ? 'Generating...' : 'Generate template'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepTournamentBasics({
  tournament,
  scheduleDefaults,
  onTournamentChange,
  onScheduleDefaultsChange,
}) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="Tournament Basics"
        subtitle="These values are used to prefill the Tournament, Fields, and TournamentDays tabs."
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tournament name *">
          <input
            className="field-input"
            value={tournament.name}
            onChange={e => onTournamentChange({ name: e.target.value })}
          />
        </Field>

        <Field label="Timezone">
          <input
            className="field-input"
            value={tournament.timezone}
            onChange={e => onTournamentChange({ timezone: e.target.value })}
            placeholder="America/Toronto"
          />
        </Field>

        <Field label="Start date">
          <input
            type="date"
            className="field-input"
            value={tournament.startDate}
            onChange={e => onTournamentChange({ startDate: e.target.value })}
          />
        </Field>

        <Field label="Number of days *">
          <input
            type="number"
            min={1}
            className="field-input"
            value={scheduleDefaults.numberOfDays}
            onChange={e => onScheduleDefaultsChange({ numberOfDays: Number(e.target.value) })}
          />
        </Field>

        <Field label="Number of fields *">
          <input
            type="number"
            min={1}
            className="field-input"
            value={scheduleDefaults.fieldsCount}
            onChange={e => onScheduleDefaultsChange({ fieldsCount: Number(e.target.value) })}
          />
        </Field>

        <Field label="Game duration (min) *">
          <input
            type="number"
            min={20}
            step={5}
            className="field-input"
            value={scheduleDefaults.gameDurationMinutes}
            onChange={e => onScheduleDefaultsChange({ gameDurationMinutes: Number(e.target.value) })}
          />
        </Field>

        <Field label="Break between games (min) *">
          <input
            type="number"
            min={0}
            step={5}
            className="field-input"
            value={scheduleDefaults.breakBetweenGamesMinutes}
            onChange={e => onScheduleDefaultsChange({ breakBetweenGamesMinutes: Number(e.target.value) })}
          />
        </Field>

        <Field label="Day start time">
          <input
            type="time"
            className="field-input"
            value={scheduleDefaults.dayStartTime}
            onChange={e => onScheduleDefaultsChange({ dayStartTime: e.target.value })}
          />
        </Field>

        <Field label="Day end time">
          <input
            type="time"
            className="field-input"
            value={scheduleDefaults.dayEndTime}
            onChange={e => onScheduleDefaultsChange({ dayEndTime: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

function StepDivisions({ divisions, onDivisionChange, onAddDivision, onRemoveDivision }) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="Divisions"
        subtitle="Define the divisions and basic format structure for the workbook template."
      />

      <div className="space-y-4">
        {divisions.map((division, index) => {
          const support = FORMAT_SUPPORT[division.formatType]
          const needsPools = ['pool_to_bracket', 'pool_to_placement', 'crossover_pools'].includes(
            division.formatType
          )

          return (
            <div
              key={index}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 16,
                background: 'var(--bg-base)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Division {index + 1}
                  </div>
                  {support?.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {support.description}
                    </div>
                  )}
                </div>

                {divisions.length > 1 && (
                  <button onClick={() => onRemoveDivision(index)} style={iconButtonStyle('#ef4444')}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Division name *">
                  <input
                    className="field-input"
                    value={division.name}
                    onChange={e => onDivisionChange(index, { name: e.target.value })}
                  />
                </Field>

                <Field label="Format type *">
                  <select
                    className="field-input"
                    value={division.formatType}
                    onChange={e => onDivisionChange(index, { formatType: e.target.value })}
                  >
                    {Object.entries(FORMAT_LABELS)
                      .filter(([value]) => FORMAT_SUPPORT[value]?.wizardSelectable !== false)
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Team count *">
                  <input
                    type="number"
                    min={2}
                    className="field-input"
                    value={division.teamCount}
                    onChange={e => onDivisionChange(index, { teamCount: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Pools">
                  <input
                    type="number"
                    min={needsPools ? 1 : 0}
                    className="field-input"
                    value={division.poolCount}
                    onChange={e => onDivisionChange(index, { poolCount: Number(e.target.value) })}
                    disabled={!needsPools}
                  />
                </Field>

                <Field label="Teams advance per pool">
                  <input
                    type="number"
                    min={1}
                    className="field-input"
                    value={division.teamsAdvancePerPool}
                    onChange={e => onDivisionChange(index, { teamsAdvancePerPool: Number(e.target.value) })}
                    disabled={!needsPools}
                  />
                </Field>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: 8 }}>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={division.thirdPlaceGame}
                      onChange={e => onDivisionChange(index, { thirdPlaceGame: e.target.checked })}
                    />
                    3rd place game
                  </label>

                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={division.consolationBracket}
                      onChange={e => onDivisionChange(index, { consolationBracket: e.target.checked })}
                    />
                    Consolation bracket
                  </label>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onAddDivision} style={secondaryButtonStyle()}>
        <PlusCircle size={15} />
        Add division
      </button>
    </div>
  )
}

function StepWorkbookOptions({ workbookOptions, onWorkbookOptionsChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="Workbook Options"
        subtitle="Choose which tabs and scaffolding the sample template should include."
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={workbookOptions.includePools}
            onChange={e => onWorkbookOptionsChange({ includePools: e.target.checked })}
          />
          Include Pools tab
        </label>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={workbookOptions.includeRosters}
            onChange={e => onWorkbookOptionsChange({ includeRosters: e.target.checked })}
          />
          Include Rosters tab
        </label>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={workbookOptions.includeScheduleDraft}
            onChange={e => onWorkbookOptionsChange({ includeScheduleDraft: e.target.checked })}
          />
          Include ScheduleDraft tab
        </label>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={workbookOptions.autoAssignPoolsEvenly}
            onChange={e => onWorkbookOptionsChange({ autoAssignPoolsEvenly: e.target.checked })}
          />
          Evenly assign teams to pools
        </label>

        <Field label="Schedule draft level">
          <select
            className="field-input"
            value={workbookOptions.scheduleDraftLevel}
            onChange={e => onWorkbookOptionsChange({ scheduleDraftLevel: e.target.value })}
            disabled={!workbookOptions.includeScheduleDraft}
          >
            <option value={WORKBOOK_SCHEDULE_DRAFT_LEVELS.NONE}>None</option>
            <option value={WORKBOOK_SCHEDULE_DRAFT_LEVELS.TIME_SLOTS}>Time slots</option>
            <option value={WORKBOOK_SCHEDULE_DRAFT_LEVELS.MATCH_SCAFFOLD}>Match scaffold</option>
          </select>
        </Field>

        <Field label="Team row style">
          <select
            className="field-input"
            value={workbookOptions.teamRowStyle}
            onChange={e => onWorkbookOptionsChange({ teamRowStyle: e.target.value })}
          >
            <option value={WORKBOOK_TEAM_ROW_STYLES.BLANK}>Blank rows</option>
            <option value={WORKBOOK_TEAM_ROW_STYLES.PLACEHOLDER}>Placeholder team names</option>
            <option value={WORKBOOK_TEAM_ROW_STYLES.SEEDED_PLACEHOLDER}>Seeded placeholders</option>
          </select>
        </Field>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-base)',
          borderRadius: 14,
          padding: 14,
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        This template workbook is intended for structure setup and sample editing. It is not the same as the current tournament round-trip workbook export from the wizard.
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          <li>Instructions</li>
          <li>Tournament</li>
          <li>Divisions</li>
          <li>Teams</li>
          <li>Fields</li>
          <li>TournamentDays</li>
          {workbookOptions.includePools && <li>Pools</li>}
          {workbookOptions.includeRosters && <li>Rosters</li>}
          {workbookOptions.includeScheduleDraft && <li>ScheduleDraft</li>}
        </ul>
      </div>
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function primaryButtonStyle(disabled = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(16,185,129,0.22)',
    background: disabled ? 'rgba(16,185,129,0.35)' : '#10b981',
    color: '#fff',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 150,
  }
}

function secondaryButtonStyle() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function iconButtonStyle(color = 'var(--text-muted)') {
  return {
    border: '1px solid var(--border)',
    background: 'transparent',
    color,
    borderRadius: 10,
    padding: 8,
    cursor: 'pointer',
  }
}