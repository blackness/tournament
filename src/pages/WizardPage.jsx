import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TournamentWizard } from '../../components/tournament/wizard/TournamentWizard'
import { useWizardStore } from '../../store/wizardStore'

export function WizardPage({ mode = "create" }) {
  const { tournamentId } = useParams()
  const reset = useWizardStore(s => s.reset)

  useEffect(() => {
    if (mode === "create") {
      // Only reset if no tournament is in progress
      // If tournamentId exists, the director is resuming — keep their progress
      const { tournamentId } = useWizardStore.getState()
      if (!tournamentId) {
        reset()
      }
    }
  }, [])

  return <TournamentWizard mode={mode} tournamentId={tournamentId} />
}
