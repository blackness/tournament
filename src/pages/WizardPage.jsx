import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { TournamentWizard } from '../../components/tournament/wizard/TournamentWizard'
import { useWizardStore } from '../../store/wizardStore'

export function WizardPage({ mode = 'create' }) {
  const { tournamentId: routeTournamentId } = useParams()

  const reset = useWizardStore(s => s.reset)
  const setTournamentId = useWizardStore(s => s.setTournamentId)

  const prevRouteTournamentIdRef = useRef(null)

  useEffect(() => {
    const routeId = routeTournamentId ? String(routeTournamentId) : null
    const storeId = useWizardStore.getState().tournamentId
      ? String(useWizardStore.getState().tournamentId)
      : null

    // CREATE MODE:
    // If no route id, this is a fresh wizard shell. Reset once to avoid stale persisted data.
    if (mode === 'create' && !routeId) {
      if (storeId) {
        // optional: clear persisted wizard cache too
        // localStorage.removeItem('athleteos-wizard')
      }
      reset()
      return
    }

    // EDIT/RESUME MODE OR CREATE WITH ROUTE ID:
    // If route tournament changes, reset to prevent cross-tournament bleed.
    const prevRouteId = prevRouteTournamentIdRef.current
    if (prevRouteId !== null && prevRouteId !== routeId) {
      reset()
    }

    prevRouteTournamentIdRef.current = routeId

    if (routeId) {
      setTournamentId(routeId)
    }
  }, [mode, routeTournamentId, reset, setTournamentId])

  return <TournamentWizard mode={mode} tournamentId={routeTournamentId} />
}