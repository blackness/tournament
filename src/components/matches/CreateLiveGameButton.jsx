import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { CreateLiveGameModal } from './CreateLiveGameModal'

export function CreateLiveGameButton({
  tournamentId,
  label = 'Create Live Game',
  defaultDivisionId = '',
  defaultVenueId = '',
  className = '',
  buildScoreUrl,
  onCreated,
  divisions = [],
  venues = [],
  teams = [],
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function handleCreated(match) {
    onCreated?.(match)
    setOpen(false)

    const nextUrl = buildScoreUrl
      ? buildScoreUrl(match)
      : `/scorekeeper/${match.id}`

    navigate(nextUrl)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'btn-primary btn'}
      >
        <Play size={16} />
        {label}
      </button>

      <CreateLiveGameModal
        isOpen={open}
        onClose={() => setOpen(false)}
        tournamentId={tournamentId}
        onCreated={handleCreated}
        defaultDivisionId={defaultDivisionId}
        defaultVenueId={defaultVenueId}
        divisions={divisions}
        venues={venues}
        teams={teams}
      />
    </>
  )
}