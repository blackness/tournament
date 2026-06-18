import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { useAuth } from '../../../lib/AuthContext'
import { db, supabase } from '../../../lib/supabase'
import { WizardProgress } from './WizardProgress'
import { WizardStep1Basics } from './WizardStep1Basics'
import { WizardStep2Sport } from './WizardStep2Sport'
import { WizardStep3Divisions } from './WizardStep3Divisions'
import { WizardStep4Venues } from './WizardStep4Venues'
import { WizardStep5Teams } from './WizardStep5Teams'
import { WizardStep6Schedule } from './WizardStep6Schedule'
import { WizardStep7Playoffs } from './WizardStep7Playoffs'
import { WizardStep7Constraints } from './WizardStep7Constraints'
import { WizardStep8Preview } from './WizardStep8Preview'
import { PageLoader } from '../../ui/LoadingSpinner'

const STEP_COMPONENTS = [
  WizardStep1Basics,
  WizardStep2Sport,
  WizardStep3Divisions,
  WizardStep4Venues,
  WizardStep5Teams,
  WizardStep6Schedule,
  WizardStep7Playoffs,
  WizardStep7Constraints,
  WizardStep8Preview,
]

export function TournamentWizard({ mode = 'create', tournamentId: existingId }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [hasAppliedRequestedStep, setHasAppliedRequestedStep] = useState(false)

  const {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    isDirty,
    tournamentId,
    reset,
    setFields,
  } = useWizardStore()

  const requestedStep = parseRequestedStep(searchParams.get('step'))

  const backToDirectorHref =
    existingId || tournamentId
      ? `/director/${existingId || tournamentId}`
      : '/director'

  useEffect(() => {
    if (mode === 'edit' && existingId) {
      loadExistingTournament(existingId)
    }

    if (mode === 'create' && !tournamentId) {
      // Fresh create -- already handled by WizardPage reset
    }
  }, [mode, existingId])

  useEffect(() => {
    if (!requestedStep) return
    if (loadingEdit) return
    if (hasAppliedRequestedStep) return
    if (requestedStep < 1 || requestedStep > STEP_COMPONENTS.length) return

    if (currentStep !== requestedStep) {
      goToStep(requestedStep)
    }

    setHasAppliedRequestedStep(true)
  }, [
    requestedStep,
    loadingEdit,
    currentStep,
    goToStep,
    hasAppliedRequestedStep,
  ])

  async function loadExistingTournament(id) {
    setLoadingEdit(true)

    try {
      const { data: t, error: tournamentErr } = await supabase
        .from('tournaments')
        .select('*, sport_template:sport_templates(id, slug, display_name, config)')
        .eq('id', id)
        .single()

      if (tournamentErr || !t) {
        reset()
        navigate('/director')
        return
      }

      if (t.deleted_at) {
        reset()
        navigate('/director', {
          state: {
            error: `Tournament "${t.name}" has been deleted and cannot be edited.`,
          },
        })
        return
      }

      const { data: divs } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', id)
        .order('sort_order')

      const { data: venueRows } = await supabase
        .from('venues')
        .select('*')
        .eq('tournament_id', id)
        .order('sort_order')

      const { data: teamRows } = await supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', id)
        .order('seed')

      const { data: poolRows } = await supabase
        .from('pools')
        .select('*')
        .in('division_id', (divs ?? []).map(d => d.id))
        .order('sort_order')

      const { data: dayRows } = await supabase
        .from('tournament_days')
        .select('*')
        .eq('tournament_id', id)
        .order('day_index')

      const divisions = (divs ?? []).map(d => ({
        id: d.id,
        dbId: d.id,
        name: d.name,
        slug: d.slug,
        formatType: d.format_type,
        gameDurationMinutes: d.game_duration_minutes,
        breakBetweenGamesMinutes: d.break_between_games_minutes,
        teamsAdvancePerPool: d.teams_advance_per_pool,
        consolationBracket: d.consolation_bracket,
        thirdPlaceGame: d.third_place_game,
        sortOrder: d.sort_order,
        tiebreakerOrder: d.tiebreaker_order,
      }))

      const venues = (venueRows ?? []).map(v => ({
        id: v.id,
        dbId: v.id,
        name: v.name,
        shortName: v.short_name,
        qrSlug: v.qr_slug,
        sortOrder: v.sort_order,
        notes: v.notes ?? '',
      }))

      const pools = (poolRows ?? []).map(p => ({
        id: p.id,
        dbId: p.id,
        divisionId: p.division_id,
        name: p.name,
        shortName: p.short_name,
        sortOrder: p.sort_order,
      }))

      const poolAssignments = {}
      const teams = (teamRows ?? []).map(tm => {
        if (tm.pool_id) poolAssignments[tm.id] = tm.pool_id

        return {
          id: tm.id,
          dbId: tm.id,
          name: tm.name,
          shortName: tm.short_name,
          divisionId: tm.division_id,
          poolId: tm.pool_id,
          clubName: tm.club_name,
          seed: tm.seed,
          primaryColor: tm.primary_color,
          headCoachName: tm.head_coach_name,
          headCoachEmail: tm.head_coach_email,
          constraints: tm.constraints ?? {},
        }
      })

      const tournamentDays = (dayRows ?? []).map(day => ({
        id: day.id,
        dayIndex: day.day_index,
        eventDate: day.event_date,
        startTime: day.start_time,
        endTime: day.end_time,
        label: day.label,
      }))

      const scheduleConfig = {
        startTime: formatTimeValue(t.default_day_start_time) || '09:00',
        endTime: formatTimeValue(t.default_day_end_time) || '23:00',
        lunchBreakStart: null,
        lunchBreakEnd: null,
        gameDurationMinutes: t.game_duration_minutes ?? 90,
        breakBetweenGamesMinutes: t.break_between_games_minutes ?? 30,
        minRestBetweenTeamGames: t.min_rest_minutes ?? 90,
        generationMode: t.schedule_generation_mode || 'round',
      }

      const sportTemplate = t.sport_template
      const enabledStatIds =
        t.enabled_stat_ids ??
        sportTemplate?.config?.stats?.map(s => s.id) ??
        []

      setFields({
        tournamentId: t.id,
        name: t.name,
        description: t.description ?? '',
        slug: t.slug,
        allowTies: t.allow_ties ?? false,
        startDate: t.start_date,
        endDate: t.end_date,
        timezone: t.timezone ?? 'America/Toronto',
        venueName: t.venue_name ?? '',
        venueAddress: t.venue_address ?? '',
        isPublic: t.is_public ?? true,
        primaryColor: t.primary_color ?? '#1a56db',
        logoUrl: t.logo_url,
        tiebreakerOrder: t.tiebreaker_order ?? [],
        sotgEnabled: t.sotg_enabled ?? true,
        sportTemplateId: t.sport_template_id,
        sportSlug: sportTemplate?.slug ?? null,
        sportConfig: sportTemplate?.config ?? null,
        enabledStatIds,
        divisions,
        venues,
        pools,
        teams,
        poolAssignments,
        tournamentDays,
        scheduleConfig,
        generatedSlots: [],
        generatedMatches: [],
        scheduleConflicts: [],
      })
    } finally {
      setLoadingEdit(false)
    }
  }

  if (loadingEdit) return <PageLoader />

  const CurrentStep = STEP_COMPONENTS[currentStep - 1]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-3">
        <Link
          to={backToDirectorHref}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] inline-flex items-center gap-1"
        >
          ← Back to Director HQ
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {mode === 'create' ? 'Create Tournament' : 'Tournament Wizard'}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {mode === 'create'
            ? 'Fill out each step to set up your tournament.'
            : 'Update your tournament settings using the wizard. All fields are prefilled from the current saved data.'}
        </p>
      </div>

      <div className="wizard-card mb-6">
        <WizardProgress currentStep={currentStep} onGoToStep={goToStep} />
      </div>

      {isDirty && (
        <div className="mb-4 text-xs text-amber-600 flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
          Unsaved changes
        </div>
      )}

      <div className="wizard-card">
        {CurrentStep && (
          <CurrentStep
            mode={mode}
            onNext={nextStep}
            onBack={prevStep}
            isFirst={currentStep === 1}
            isLast={currentStep === STEP_COMPONENTS.length}
          />
        )}
      </div>

      {mode === 'create' && currentStep === 1 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => reset()}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
          >
            Clear draft and start over
          </button>
        </div>
      )}
    </div>
  )
}

function parseRequestedStep(raw) {
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) return null
  return parsed
}

function formatTimeValue(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    return value.slice(0, 5)
  }

  try {
    const dt = new Date(value)
    return dt.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}