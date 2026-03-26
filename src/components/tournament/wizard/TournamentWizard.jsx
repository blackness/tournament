import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../../../store/wizardStore'
import { useAuth } from '../../../lib/AuthContext'
import { db } from '../../../lib/supabase'
import { WizardProgress } from './WizardProgress'
import { WizardStep1Basics }      from './WizardStep1Basics'
import { WizardStep2Sport }       from './WizardStep2Sport'
import { WizardStep3Divisions }   from './WizardStep3Divisions'
import { WizardStep4Venues }      from './WizardStep4Venues'
import { WizardStep5Teams }       from './WizardStep5Teams'
import { WizardStep6Schedule }    from './WizardStep6Schedule'
import { WizardStep7Constraints } from './WizardStep7Constraints'
import { WizardStep8Preview }     from './WizardStep8Preview'

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

/**
 * TournamentWizard — 8-step director wizard.
 *
 * mode: 'create' | 'edit'
 * tournamentId: required when mode='edit'
 */
export function TournamentWizard({ mode = 'create', tournamentId: existingId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    isDirty,
    tournamentId,
    reset,
  } = useWizardStore()

  // When editing, load the existing tournament into the store
  useEffect(() => {
    if (mode === 'edit' && existingId && !tournamentId) {
      loadExistingTournament(existingId)
    }
  }, [mode, existingId])

  async function loadExistingTournament(id) {
    const { data, error } = await db.tournaments.byId(id)
    if (error || !data) return

    const store = useWizardStore.getState()
    store.setFields({
      tournamentId: data.id,
      name:         data.name,
      description:  data.description ?? '',
      slug:         data.slug,
      startDate:    data.start_date,
      endDate:      data.end_date,
      timezone:     data.timezone,
      venueName:    data.venue_name ?? '',
      venueAddress: data.venue_address ?? '',
      isPublic:     data.is_public,
      primaryColor: data.primary_color,
      logoUrl:      data.logo_url,
      tiebreakerOrder: data.tiebreaker_order,
    })
  }

  const CurrentStep = STEP_COMPONENTS[currentStep - 1]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'create' ? 'Create Tournament' : 'Edit Tournament'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'create'
            ? 'Fill out each step to set up your tournament.'
            : 'Update your tournament settings.'}
        </p>
      </div>

      {/* Step progress */}
      <div className="wizard-card mb-6">
        <WizardProgress currentStep={currentStep} onGoToStep={goToStep} />
      </div>

      {/* Unsaved indicator */}
      {isDirty && (
        <div className="mb-4 text-xs text-amber-600 flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
          Unsaved changes
        </div>
      )}

      {/* Current step */}
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

      {/* Reset draft (create mode only) */}
      {mode === 'create' && currentStep === 1 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => { reset(); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear draft and start over
          </button>
        </div>
      )}
    </div>
  )
}
