import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { db } from '../../lib/supabase'
import { TOURNAMENT_STATUS_LABELS } from '../../lib/constants'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { PlusCircle, Trophy, ChevronRight, Calendar } from 'lucide-react'

export function DirectorDashboard() {
  const { user }                    = useAuth()
  const navigate                    = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!user) return
    db.tournaments.mine(user.id).then(({ data }) => {
      setTournaments(data ?? [])
      setLoading(false)
    })
  }, [user])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tournaments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/director/new" className="btn-primary btn">
          <PlusCircle size={16} />
          New tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <Trophy size={36} className="mx-auto mb-3 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-700">No tournaments yet</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">Create your first tournament to get started.</p>
          <Link to="/director/new" className="btn-primary btn">
            <PlusCircle size={16} />
            Create tournament
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ tournament: t }) {
  const statusBadge = {
    draft:     'badge-gray',
    published: 'badge-blue',
    live:      'badge-green',
    review:    'badge-yellow',
    archived:  'badge-gray',
  }[t.status] ?? 'badge-gray'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:border-gray-300 transition-colors">
      {/* Colour strip */}
      <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: t.primary_color ?? '#1a56db' }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{t.name}</h3>
          <span className={`badge ${statusBadge}`}>{TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
          <Calendar size={11} />
          {t.start_date === t.end_date
            ? formatDate(t.start_date)
            : `${formatDate(t.start_date)} – ${formatDate(t.end_date)}`
          }
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {t.status === 'draft' && (
          <Link to={`/director/new`} state={{ resume: t.id }} className="btn-secondary btn btn-sm">
            Continue setup
          </Link>
        )}
        <Link to={`/director/${t.id}`} className="btn-ghost btn btn-sm">
          HQ <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}
