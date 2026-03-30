import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { useAuth } from '../../../lib/AuthContext'
import { db, supabase } from '../../../lib/supabase'
import { WizardProgress } from './WizardProgress'
import { WizardStep1Basics }      from './WizardStep1Basics'
import { WizardStep2Sport }       from './WizardStep2Sport'
import { WizardStep3Divisions }   from './WizardStep3Divisions'
import { WizardStep4Venues }      from './WizardStep4Venues'
import { WizardStep5Teams }       from './WizardStep5Teams'
import { WizardStep6Schedule }    from './WizardStep6Schedule'
import { WizardStep7Constraints } from './WizardStep7Constraints'
import { WizardStep8Preview }     from './WizardStep8Preview'
import { PageLoader } from '../../ui/LoadingSpinner'

const STEP_COMPONENTS = [
  WizardStep1Basics,
  WizardStep2Sport,
  WizardStep3Divisions,
  WizardStep4Venues,
  WizardStep5Teams,
  WizardStep6Schedule,
  WizardStep7Constraints,
  WizardStep8Preview,
]

export function TournamentWizard({ mode = 'create', tournamentId: existingId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const {
    currentStep, nextStep, prevStep, goToStep,
    isDirty, tournamentId, reset, setFields,
  } = useWizardStore()

  // Edit mode -- always reload from DB, ignore stale store
  useEffect(() => {
    if (mode === 'edit' && existingId) {
      loadExistingTournament(existingId)
    }
    if (mode === 'create' && !tournamentId) {
      // Fresh create -- already handled by WizardPage reset
    }
  }, [mode, existingId])

  async function loadExistingTournament(id) {
    setLoadingEdit(true)
    try {
      // 1. Tournament basics
      const { data: t } = await supabase
        .from('tournaments')
        .select('*, sport_template:sport_templates(id, slug, display_name, config)')
        .eq('id', id).single()
      if (!t) return

      // 2. Divisions
      const { data: divs } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', id)
        .order('sort_order')

      // 3. Venues
      const { data: venueRows } = await supabase
        .from('venues')
        .select('*')
        .eq('tournament_id', id)
        .order('sort_order')

      // 4. Teams + pools
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

      // 5. Schedule config from existing time slots
      const { data: slotRows } = await supabase
        .from('time_slots')
        .select('*')
        .eq('tournament_id', id)
        .order('scheduled_start')
        .limit(1)

      // Map DB rows -> store shape
      const divisions = (divs ?? []).map(d => ({
        id:                     d.id,
        dbId:                   d.id,
        name:                   d.name,
        slug:                   d.slug,
        formatType:             d.format_type,
        gameDurationMinutes:    d.game_duration_minutes,
        breakBetweenGamesMinutes: d.break_between_games_minutes,
        teamsAdvancePerPool:    d.teams_advance_per_pool,
        consolationBracket:     d.consolation_bracket,
        thirdPlaceGame:         d.third_place_game,
        sortOrder:              d.sort_order,
        tiebreakerOrder:        d.tiebreaker_order,
      }))

      const venues = (venueRows ?? []).map(v => ({
        id:        v.id,
        dbId:      v.id,
        name:      v.name,
        shortName: v.short_name,
        qrSlug:    v.qr_slug,
        sortOrder: v.sort_order,
      }))

      const pools = (poolRows ?? []).map(p => ({
        id:         p.id,
        dbId:       p.id,
        divisionId: p.division_id,
        name:       p.name,
        shortName:  p.short_name,
        sortOrder:  p.sort_order,
      }))

      const poolAssignments = {}
      const teams = (teamRows ?? []).map(tm => {
        if (tm.pool_id) poolAssignments[tm.id] = tm.pool_id
        return {
          id:              tm.id,
          dbId:            tm.id,
          name:            tm.name,
          shortName:       tm.short_name,
          divisionId:      tm.division_id,
          poolId:          tm.pool_id,
          clubName:        tm.club_name,
          seed:            tm.seed,
          primaryColor:    tm.primary_color,
          headCoachName:   tm.head_coach_name,
          headCoachEmail:  tm.head_coach_email,
          constraints:     tm.constraints ?? {},
        }
      })

      // Schedule config from first slot
      const firstSlot = slotRows?.[0]
      const scheduleConfig = firstSlot ? {
        startTime: firstSlot.scheduled_start,
        endTime:   null,
        lunchBreakStart: null,
        lunchBreakEnd:   null,
        gameDurationMinutes:      t.game_duration_minutes ?? 90,
        breakBetweenGamesMinutes: t.break_between_games_minutes ?? 30,
        minRestBetweenTeamGames:  t.min_rest_minutes ?? 90,
      } : useWizardStore.getState().scheduleConfig

      // Sport config
      const sportTemplate = t.sport_template
      const enabledStatIds = t.enabled_stat_ids
        ?? sportTemplate?.config?.stats?.map(s => s.id)
        ?? []

      // Populate store
      setFields({
        tournamentId:    t.id,
        name:            t.name,
        description:     t.description ?? '',
        slug:            t.slug,
        startDate:       t.start_date,
        endDate:         t.end_date,
        timezone:        t.timezone ?? 'America/Toronto',
        venueName:       t.venue_name ?? '',
        venueAddress:    t.venue_address ?? '',
        isPublic:        t.is_public ?? true,
        primaryColor:    t.primary_color ?? '#1a56db',
        logoUrl:         t.logo_url,
        tiebreakerOrder: t.tiebreaker_order ?? [],
        sotgEnabled:     t.sotg_enabled ?? true,
        sportTemplateId: t.sport_template_id,
        sportSlug:       sportTemplate?.slug ?? null,
        sportConfig:     sportTemplate?.config ?? null,
        enabledStatIds,
        divisions,
        venues,
        pools,
        teams,
        poolAssignments,
        scheduleConfig,
        // Clear generated schedule so Step 6 re-generates
        generatedSlots:   [],
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'create' ? 'Create Tournament' : 'Edit Tournament'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'create'
            ? 'Fill out each step to set up your tournament.'
            : 'Update your tournament settings. All fields are prefilled from the current saved data.'}
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
            isLast={currentStep === 8}
          />
        )}
      </div>

      {mode === 'create' && currentStep === 1 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => reset()}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear draft and start over
          </button>
        </div>
      )}
    </div>
  )
}
