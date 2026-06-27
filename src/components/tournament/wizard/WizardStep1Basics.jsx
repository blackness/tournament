import { useEffect, useMemo, useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { WizardNavButtons } from './WizardNavButtons'
import { supabase, db } from '../../../lib/supabase'
import { AlertTriangle, FileSpreadsheet, Globe, MapPin, Type, Upload } from 'lucide-react'
import { generateTournamentWorkbookDraft } from '../../../lib/workbook/generateTournamentWorkbookDraft'
import { UploadWorkbookModal } from '../../../lib/workbook/UploadWorkbookModal'
import { applyWorkbookToWizardState } from '../../../lib/workbook/mapWorkbookToWizardState'
import { useAuth } from '../../../lib/AuthContext'
import { SAMPLE_WORKBOOK_PRESETS } from '../../../lib/workbook/sampleWorkbookPresets'

export function WizardStep1Basics({ onNext }) {
  const { user } = useAuth()

  const {
    tournamentId,
    name,
    slug,
    sport,
    setFields,
    setTournamentId,
    venueName,
    venueAddress,
    timezone,
    startDate,
    endDate,
    primaryColor,
    isPublic,
    divisions,
    teams,
    venues,
    pools,
    poolAssignments,
    playoffConfigs,
    tournamentDays,
    scheduleConfig,
    generatedMatches,
    generatedSlots,
  } = useWizardStore()

  const [formError, setFormError] = useState(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloadingWorkbook, setDownloadingWorkbook] = useState(false)
  const [showWorkbookUpload, setShowWorkbookUpload] = useState(false)
  const [workbookSummary, setWorkbookSummary] = useState(null)
  const [selectedWorkbookPresetKey, setSelectedWorkbookPresetKey] = useState(
    SAMPLE_WORKBOOK_PRESETS[0]?.key || ''
  )

  const hasSetupData = useMemo(() => {
    return (
      (divisions?.length || 0) > 0 ||
      (teams?.length || 0) > 0 ||
      (venues?.length || 0) > 0 ||
      (pools?.length || 0) > 0 ||
      (tournamentDays?.length || 0) > 0
    )
  }, [divisions?.length, teams?.length, venues?.length, pools?.length, tournamentDays?.length])

  useEffect(() => {
    if (!timezone) {
      setFields({ timezone: 'America/Toronto' })
    }
  }, [timezone, setFields])

  function handleChange(field, value) {
    setFields({ [field]: value })
  }

  async function validateSlug() {
    if (!slug?.trim()) return true

    setCheckingSlug(true)

    const cleanSlug = slug.trim().toLowerCase()

    const query = supabase
      .from('tournaments')
      .select('id')
      .eq('slug', cleanSlug)

    const { data, error } = tournamentId
      ? await query.neq('id', tournamentId)
      : await query

    setCheckingSlug(false)

    if (error) {
      setFormError('Could not validate tournament slug.')
      return false
    }

    if ((data ?? []).length > 0) {
      setFormError('This tournament URL slug is already in use.')
      return false
    }

    return true
  }

  async function handleDownloadSampleWorkbook() {
    setFormError(null)

    try {
      const preset = SAMPLE_WORKBOOK_PRESETS.find(
        p => p.key === selectedWorkbookPresetKey
      )

      if (!preset) {
        setFormError('Please select a workbook format preset.')
        return
      }

      const result = await generateTournamentWorkbookDraft(preset.config)

      const blob = new Blob([result.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = preset.fileName || result.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Sample workbook generation failed:', err)
      setFormError(
        Array.isArray(err.validationErrors)
          ? err.validationErrors.join(' ')
          : err.message || 'Failed to generate sample workbook.'
      )
    }
  }

  async function handleDownloadWorkbook() {
    setFormError(null)
    setDownloadingWorkbook(true)
    setWorkbookSummary(null)

    try {
      const workbookSchedules = buildWorkbookSchedules({
        generatedMatches,
        generatedSlots,
        divisions,
        pools,
        teams,
        venues,
      })

      const playoffScheduleTemplate = buildPlayoffScheduleTemplateRows({
        playoffConfigs,
        divisions,
        venues,
      })

      const result = await generateTournamentWorkbookDraft({
        tournament: {
          name: name || '',
          slug: slug || '',
          sport: sport || '',
          timezone: timezone || 'America/Toronto',
          startDate: startDate || '',
          endDate: endDate || '',
          hostSchool: venueName || '',
          location: venueAddress || '',
          primaryColor: primaryColor || '#1a56db',
        },
        scheduleDefaults: {
          numberOfDays: tournamentDays?.length || 1,
          fieldsCount: venues?.length || 1,
          dayStartTime: scheduleConfig?.startTime || '09:00',
          dayEndTime: scheduleConfig?.endTime || '17:00',
          gameDurationMinutes: scheduleConfig?.gameDurationMinutes || 90,
          breakBetweenGamesMinutes: scheduleConfig?.breakBetweenGamesMinutes || 30,
        },
        fields: (venues || []).map((venue, index) => ({
          fieldName: venue.name || '',
          shortName: venue.shortName || '',
          qrSlug: venue.qrSlug || '',
          sortOrder: venue.sortOrder ?? index + 1,
        })),
        tournamentDays: (tournamentDays || []).map((day, index) => ({
          dayIndex: day.dayIndex ?? index + 1,
          eventDate: day.eventDate || '',
          startTime: day.startTime || '09:00',
          endTime: day.endTime || '',
          label: day.label || '',
        })),
        workbookOptions: {
          includePools: true,
          includeRosters: true,
          includeScheduleDraft: false,
          scheduleDraftLevel: 'time_slots',
          teamRowStyle: 'seeded_placeholder',
          autoAssignPoolsEvenly: true,
          templateType: 'simple',
        },
        divisions: (divisions || []).map((division, index) => {
          const divisionTeams = (teams || []).filter(t => t.divisionId === division.id)
          const divisionPools = (pools || []).filter(p => p.divisionId === division.id)

          return {
            name: division.name || '',
            slug: division.slug || '',
            formatType: division.formatType || '',
            teamCount: divisionTeams.length || 0,
            poolCount: divisionPools.length || 0,
            teamsAdvancePerPool: division.teamsAdvancePerPool ?? 2,
            thirdPlaceGame: division.thirdPlaceGame ?? false,
            consolationBracket: division.consolationBracket ?? false,
            gameDurationMinutes:
              division.gameDurationMinutes ?? scheduleConfig?.gameDurationMinutes ?? 90,
            breakBetweenGamesMinutes:
              division.breakBetweenGamesMinutes ??
              scheduleConfig?.breakBetweenGamesMinutes ??
              30,
            sortOrder: division.sortOrder ?? index,

            pools: divisionPools.map((pool, poolIndex) => ({
              name: pool.name || '',
              shortName: pool.shortName || '',
              sortOrder: pool.sortOrder ?? poolIndex + 1,
            })),

            teams: divisionTeams.map(team => ({
              name: team.name || '',
              shortName: team.shortName || '',
              schoolName: team.clubName || '',
              primaryColor: team.primaryColor || '',
              seed: team.seed ?? null,
              poolName: poolAssignments?.[team.id]
                ? divisionPools.find(p => p.id === poolAssignments[team.id])?.name || ''
                : '',
            })),
          }
        }),
        schedules: workbookSchedules,

        // NEW: exact object shape for playoff workbook export
        playoffScheduleTemplate: [
          {
            division: 'Open',
            match_code: 'P-SF1',
            venue: 'Field 1',
            scheduled_date: '2026-07-23',
            scheduled_time: '13:00',
            notes: 'Semi 1'
          }
        ]
              })

      const blob = new Blob([result.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Workbook draft generation failed:', err)
      console.error('Validation errors:', err.validationErrors)

      setFormError(
        Array.isArray(err.validationErrors)
          ? err.validationErrors.join(' ')
          : err.message || 'Failed to generate workbook.'
      )
    } finally {
      setDownloadingWorkbook(false)
    }
  }

  async function handleNext() {
    setFormError(null)

    if (!name?.trim()) {
      setFormError('Tournament name is required.')
      return
    }

    if (!slug?.trim()) {
      setFormError('Tournament URL slug is required.')
      return
    }

    if (!startDate) {
      setFormError('Tournament start date is required.')
      return
    }

    const normalizedEndDate = endDate || startDate

    if (normalizedEndDate < startDate) {
      setFormError('End date cannot be earlier than start date.')
      return
    }

    setSaving(true)

    try {
      const slugOk = await validateSlug()
      if (!slugOk) return

      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        sport: sport || null,
        start_date: startDate,
        end_date: normalizedEndDate,
        timezone: timezone || 'America/Toronto',
        venue_name: venueName?.trim() || null,
        venue_address: venueAddress?.trim() || null,
        primary_color: primaryColor || '#1a56db',
        is_public: !!isPublic,
        status: 'draft',
      }

      if (tournamentId) {
        await db.tournaments.update(tournamentId, payload)
      } else {
        const { data, error } = await db.tournaments.create({
          ...payload,
          director_id: user.id,
        })

        if (error) {
          throw new Error(error.message || 'Failed to create tournament.')
        }

        if (data?.id) {
          setTournamentId(data.id)
        } else if (data && typeof data === 'object' && data.id) {
          setTournamentId(data.id)
        }
      }

      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save tournament basics.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Tournament Basics</h2>
        <p className="section-subtitle">
          Set up tournament identity here. Tournament start/end dates are required here; detailed daily schedule windows are configured in Step 6.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="field-group md:col-span-2">
          <label className="field-label flex items-center gap-1">
            <Type size={13} />
            Tournament name *
          </label>
          <input
            type="text"
            className="field-input"
            value={name || ''}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g. OFSAA Ultimate Championship"
          />
        </div>

        <div className="field-group md:col-span-2">
          <label className="field-label flex items-center gap-1">
            <Globe size={13} />
            Tournament URL slug *
          </label>
          <input
            type="text"
            className="field-input"
            value={slug || ''}
            onChange={e => handleChange('slug', slugify(e.target.value))}
            placeholder="e.g. ofsaa-ultimate-championship"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Public page URL: /t/{slug || 'your-tournament-slug'}
          </p>
        </div>

        <div className="field-group md:col-span-2">
          <label className="field-label">Sport</label>
          <input
            type="text"
            className="field-input"
            value={sport || ''}
            onChange={e => handleChange('sport', e.target.value)}
            placeholder="e.g. Ultimate Frisbee"
          />
        </div>

        <div className="field-group md:col-span-2">
          <label className="field-label">Visibility</label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={!!isPublic}
              onChange={e => handleChange('isPublic', e.target.checked)}
            />
            Visible to the public
          </label>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            You can toggle this on or off at any time during setup. When off, the tournament remains active in AthleteOS but should not be publicly visible.
          </p>
        </div>

        <div className="field-group">
          <label className="field-label">Tournament start date *</label>
          <input
            type="date"
            className="field-input"
            value={startDate || ''}
            onChange={e => handleChange('startDate', e.target.value)}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Tournament end date</label>
          <input
            type="date"
            className="field-input"
            value={endDate || ''}
            min={startDate || undefined}
            onChange={e => handleChange('endDate', e.target.value)}
          />
        </div>

        <div className="field-group md:col-span-2">
          <p className="text-xs text-[var(--text-muted)]">
            If end date is blank, it defaults to the start date.
          </p>
        </div>

        <div className="field-group">
          <label className="field-label flex items-center gap-1">
            <MapPin size={13} />
            Venue / site name
          </label>
          <input
            type="text"
            className="field-input"
            value={venueName || ''}
            onChange={e => handleChange('venueName', e.target.value)}
            placeholder="e.g. Lamport Stadium"
          />
        </div>

        <div className="field-group md:col-span-2">
          <label className="field-label">Venue address</label>
          <input
            type="text"
            className="field-input"
            value={venueAddress || ''}
            onChange={e => handleChange('venueAddress', e.target.value)}
            placeholder="e.g. 1151 King St W, Toronto, ON"
          />
        </div>

        <div className="field-group md:col-span-2">
          <label className="field-label">Timezone</label>
          <select
            className="field-input"
            value={timezone || 'America/Toronto'}
            onChange={e => handleChange('timezone', e.target.value)}
          >
            {TIMEZONE_OPTIONS.map(tz => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)] mb-1">
            Workbook setup
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Download the Excel workbook template to fill in divisions, teams, pools, venues, schedule days, and other tournament setup details, or upload a completed workbook to populate the wizard.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary btn"
            onClick={handleDownloadWorkbook}
            disabled={downloadingWorkbook}
          >
            <FileSpreadsheet size={16} />
            {downloadingWorkbook ? 'Generating workbook...' : 'Download Current Tournament Excel workbook'}
          </button>

          <button
            type="button"
            className="btn-secondary btn"
            onClick={() => setShowWorkbookUpload(true)}
          >
            <Upload size={16} />
            Upload workbook
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Sample Workbook Templates
            </h3>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              Download a sample workbook for a supported tournament format.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <select
              className="field-input"
              value={selectedWorkbookPresetKey}
              onChange={e => setSelectedWorkbookPresetKey(e.target.value)}
              style={{ minWidth: 280 }}
            >
              {SAMPLE_WORKBOOK_PRESETS.map(preset => (
                <option key={preset.key} value={preset.key}>
                  {preset.label || preset.key}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-secondary btn btn-sm"
              onClick={handleDownloadSampleWorkbook}
            >
              Download sample workbook
            </button>
          </div>
        </div>

        {hasSetupData && (
          <p className="text-xs text-[var(--text-muted)]">
            Workbook export includes your current wizard setup data where available, including divisions, teams, pools, venues, tournament days, schedule settings, and optional playoff schedule template rows.
          </p>
        )}
      </div>

      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
          Wizard structure
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          Step 1 is for tournament identity and workbook setup. Step 2 handles sport-specific details and tracked stats. Step 6 handles detailed schedule windows and generation settings.
        </p>
      </div>

      {workbookSummary && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 space-y-1">
          <div className="font-semibold">Workbook applied successfully.</div>
          <ul className="list-disc ml-5 space-y-0.5">
            {workbookSummary.tournamentLoaded && <li>Tournament basics loaded</li>}
            <li>
              {workbookSummary.divisionCount} division
              {workbookSummary.divisionCount !== 1 ? 's' : ''} loaded
            </li>
            <li>
              {workbookSummary.teamCount} team
              {workbookSummary.teamCount !== 1 ? 's' : ''} loaded
            </li>
            <li>
              {workbookSummary.poolCount} pool
              {workbookSummary.poolCount !== 1 ? 's' : ''} loaded
            </li>
            <li>
              {workbookSummary.venueCount} field
              {workbookSummary.venueCount !== 1 ? 's' : ''} loaded
            </li>
            <li>
              {workbookSummary.tournamentDayCount} tournament day
              {workbookSummary.tournamentDayCount !== 1 ? 's' : ''} loaded
            </li>

            {workbookSummary.rosterCount > 0 && (
              <li>
                {workbookSummary.rosterCount} roster row
                {workbookSummary.rosterCount !== 1 ? 's' : ''} loaded
              </li>
            )}

            {workbookSummary.scheduleRowCount > 0 && (
              <li>
                {workbookSummary.scheduleRowCount} schedule row
                {workbookSummary.scheduleRowCount !== 1 ? 's' : ''} loaded
              </li>
            )}

            {workbookSummary.scheduleApplied && (
              <li>
                {workbookSummary.scheduleAppliedCount} schedule row
                {workbookSummary.scheduleAppliedCount !== 1 ? 's' : ''} applied to the generated schedule
              </li>
            )}
            {workbookSummary.playoffTemplateRowCount > 0 && (
              <li>
                {workbookSummary.playoffTemplateRowCount} playoff template row
                {workbookSummary.playoffTemplateRowCount !== 1 ? 's' : ''} found
              </li>
            )}

            {workbookSummary.playoffTemplateAppliedCount > 0 && (
              <li>
                {workbookSummary.playoffTemplateAppliedCount} playoff template row
                {workbookSummary.playoffTemplateAppliedCount !== 1 ? 's' : ''} applied
              </li>
            )}
          </ul>

          {workbookSummary.scheduleRowCount > 0 && !workbookSummary.scheduleApplied && (
            <p className="text-xs text-green-700 mt-2">
              Schedule rows were found in the workbook, but they could not be applied yet. Generate or load a schedule in Step 6 first, then upload again if you want workbook schedule edits to map onto existing generated matches.
            </p>
          )}

          <p className="text-xs text-green-700 mt-2">
            Review the imported data in each wizard step, then click Continue to save tournament basics and proceed.
          </p>
          {workbookSummary.playoffTemplateWarnings > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              {workbookSummary.playoffTemplateWarnings} playoff template row
              {workbookSummary.playoffTemplateWarnings !== 1 ? 's' : ''} had warnings and were skipped. 
              Check division names, match codes, venue names, and date/time formats.
            </p>
          )}
          {workbookSummary.playoffTemplateAppliedCount > 0 && (
            <p className="text-xs text-green-700 mt-2">
              Imported playoff schedule template rows will pre-populate playoff match venue/time in Step 7 when matching playoff match codes are generated.
            </p>
          )}
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        saving={saving}
        isFirst
        nextLabel={checkingSlug ? 'Checking...' : 'Continue'}
        nextDisabled={checkingSlug || saving}
      />

      <UploadWorkbookModal
        isOpen={showWorkbookUpload}
        onClose={() => setShowWorkbookUpload(false)}
        onValidated={result => {
          try {
            if (!result || !result.validation) {
              throw new Error('Workbook validation did not return expected data.')
            }

            const applied = applyWorkbookToWizardState(result)
            setFormError(null)
            setWorkbookSummary(applied.summary || null)
            setShowWorkbookUpload(false)
          } catch (err) {
            console.error('[Workbook apply error]', err, result)
            setFormError(err.message || 'Failed to apply workbook data.')
          }
        }}
      />
    </div>
  )
}

function buildWorkbookSchedules({
  generatedMatches,
  generatedSlots,
  divisions,
  pools,
  teams,
  venues,
}) {
  const divisionMap = Object.fromEntries((divisions || []).map(d => [d.id, d]))
  const poolMap = Object.fromEntries((pools || []).map(p => [p.id, p]))
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t]))
  const venueMap = Object.fromEntries((venues || []).map(v => [v.id, v]))
  const slotMap = Object.fromEntries((generatedSlots || []).map(s => [s.id, s]))

  return (generatedMatches || []).map((match, index) => {
    const division =
      divisionMap[match.divisionId] ||
      divisionMap[match.division_id] ||
      null

    const pool =
      poolMap[match.poolId] ||
      poolMap[match.pool_id] ||
      null

    const teamA =
      teamMap[match.teamAId] ||
      teamMap[match.team_a_id] ||
      null

    const teamB =
      teamMap[match.teamBId] ||
      teamMap[match.team_b_id] ||
      null

    const venue =
      venueMap[match.venueId] ||
      venueMap[match.venue_id] ||
      null

    const slot =
      slotMap[match.slotId] ||
      slotMap[match.slot_id] ||
      slotMap[match.time_slot_id] ||
      null

    let scheduledDate = ''
    let startTime = ''

    if (slot?.scheduled_start) {
      const iso = String(slot.scheduled_start)
      const [datePart, timePart] = iso.split('T')
      scheduledDate = datePart || ''
      startTime = timePart ? timePart.slice(0, 5) : ''
    }

    return {
      match_id: match.dbId || match.id || '',
      match_code:
        match.matchCode ||
        match.match_code ||
        buildFallbackMatchCode(match, index),
      division_name: division?.name || '',
      pool_name: pool?.name || '',
      bracket_type: match.bracketType || match.bracket_type || '',
      round_label:
        match.roundLabel ||
        match.round_label ||
        buildFallbackRoundLabel(match, index),
      team_a_name: teamA?.name || '',
      team_b_name: teamB?.name || '',
      scheduled_date: scheduledDate,
      start_time: startTime,
      field_name: venue?.name || '',
      status: match.status || 'scheduled',
      notes: '',
    }
  })
}

function buildPlayoffScheduleTemplateRows({
  playoffConfigs = {},
  divisions = [],
  venues = [],
}) {
  const divisionMap = Object.fromEntries((divisions || []).map(d => [d.id, d]))
  const venueMap = Object.fromEntries((venues || []).map(v => [v.id, v]))

  const rows = []

  for (const [divisionId, config] of Object.entries(playoffConfigs || {})) {
    const division = divisionMap[divisionId]
    const template = config?.matchScheduleTemplate || {}

    for (const [matchCode, entry] of Object.entries(template)) {
      const venue = entry?.venueId ? venueMap[entry.venueId] : null

      rows.push({
        division: division?.name || '',
        match_code: matchCode,
        venue: venue?.name || '',
        scheduled_date: entry?.scheduledDate || '',
        scheduled_time: entry?.scheduledTime || '',
        notes: entry?.notes || '',
      })
    }
  }

  return rows
}

function buildFallbackMatchCode(match, index) {
  if (match.round && match.match_number) {
    return `R${match.round}-M${match.match_number}`
  }

  if (match.match_number) {
    return `M${match.match_number}`
  }

  return `MATCH-${index + 1}`
}

function buildFallbackRoundLabel(match, index) {
  if (match.roundLabel || match.round_label) {
    return match.roundLabel || match.round_label
  }

  if (match.round) {
    return `Round ${match.round}`
  }

  return `Match ${index + 1}`
}

function slugify(val) {
  return String(val || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const TIMEZONE_OPTIONS = [
  'America/Toronto',
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Halifax',
  'America/St_Johns',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
]