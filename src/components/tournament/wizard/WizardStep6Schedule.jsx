import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useWizardStore } from '../../../store/wizardStore'
import { ScheduleEditor } from '../../../pages/director/ScheduleEditor'
import { WizardNavButtons } from './WizardNavButtons'

export function WizardStep6Schedule({ onNext, onBack }) {
  const tournamentId = useWizardStore(s => s.tournamentId)
  const [persistedMatchCount, setPersistedMatchCount] = useState(0)
  const [checkingPersisted, setCheckingPersisted] = useState(false)
  const [persistError, setPersistError] = useState(null)

  async function refreshPersistedCount() {
    if (!tournamentId) {
      setPersistedMatchCount(0)
      return
    }

    setCheckingPersisted(true)
    setPersistError(null)

    try {
      const { count, error } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')

      if (error) throw error
      setPersistedMatchCount(count || 0)
    } catch (err) {
      console.error('[WizardStep6Schedule] persisted count failed', err)
      setPersistError(err.message || 'Failed to verify saved schedule.')
      setPersistedMatchCount(0)
    } finally {
      setCheckingPersisted(false)
    }
  }

  useEffect(() => {
    refreshPersistedCount()
  }, [tournamentId])

  const nextDisabled = checkingPersisted || persistedMatchCount === 0

  return (
    <ScheduleEditor
      embedded
      tournamentId={tournamentId}
      onSchedulePersisted={refreshPersistedCount} // call this from ScheduleEditor after successful save
      footer={
        <div className="space-y-2">
          {persistError && (
            <div className="text-xs text-red-600">
              {persistError}
            </div>
          )}

          {!checkingPersisted && persistedMatchCount === 0 && (
            <div className="text-xs text-amber-700">
              Generate and save at least one game before continuing.
            </div>
          )}

          <WizardNavButtons
            onNext={onNext}
            onBack={onBack}
            nextLabel={persistedMatchCount > 0 ? `Continue (${persistedMatchCount} games saved)` : 'Continue'}
            nextDisabled={nextDisabled}
          />
        </div>
      }
    />
  )
}