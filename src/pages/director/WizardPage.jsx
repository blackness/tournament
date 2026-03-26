import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TournamentWizard } from '../../components/tournament/wizard/TournamentWizard'
import { useWizardStore } from '../../store/wizardStore'

export function WizardPage({ mode = "create" }) {
  const { tournamentId } = useParams()
  const reset = useWizardStore(s => s.reset)

  useEffect(() => {
    if (mode === "create") {
      reset()
    }
  }, [])

  return <TournamentWizard mode={mode} tournamentId={tournamentId} />
}
