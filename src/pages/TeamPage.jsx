import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, Calendar, MapPin, Trophy, ChevronRight } from 'lucide-react'

export function TeamPage() {
  const { slug, teamId }          = useParams()
  const [team, setTeam]           = useState(null)
  const [matches, setMatches]     = useState([])
  const [players, setPlayers]     = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('tournament_teams')
        .select(`
          id, name, short_name, primary_color, club_name, seed,
          head_coach_name, head_coach_email,
          division:divisions(id, name, tournament:tournaments(id, name, slug, primary_color)),
          pool:pools(id, name)
        `)
        .eq('id', teamId)
        .single()

      if (!t) { setLoading(false); return }
      setTeam(t)

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, score_a, score_b, winner_id,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start),
          division:divisions(name)
        `)
        .or('team_a_id.eq.' + teamId + ',team_b_id.eq.' + teamId)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')
      setMatches(m ?? [])

      const { data: p } = await supabase
        .from('tournament_players')
        .select('id, name, number')
        .eq('tournament_team_id', teamId)
        .order('number')
      setPlayers(p ?? [])
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) return <PageLoader />
  if (!team) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Team not found</p>
    </div>
  )

  const tournament = team.division?.tournament
  const wins   = matches.filter(m => m.winner_id === teamId).length
  const losses = matches.filter(m => m.winner_id && m.winner_id !== teamId).length
  const played = matches.filter(m => m.status === 'complete' || m.status === 'forfeit').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {tournament && (
          <Link to={'/t/' + tournament.slug} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl"
            style={{ backgroundColor: team.primary_color ?? '#1a56db' }}>
            {(team.short_name ?? team.name)[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{team.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
              {team.division && <span>{team.division.name}</span>}
              {team.pool && <span>- {team.pool.name}</span>}
              {team.club_name && <span>- {team.club_name}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Record */}
      {played > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-green-600">{wins}</p>
            <p className="text-xs text-gray-400">Wins</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-red-500">{losses}</p>
            <p className="text-xs text-gray-400">Losses</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-gray-700">{played}</p>
            <p className="text-xs text-gray-400">Played</p>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Games</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No games scheduled yet</p>
        ) : (
          <div className="space-y-2">
            {matches.map(m => {
              const isTeamA = m.team_a?.id === teamId
              const opponent = isTeamA ? m.team_b : m.team_a
              const teamScore = isTeamA ? m.score_a : m.score_b
              const oppScore  = isTeamA ? m.score_b : m.score_a
              const isDone    = m.status === 'complete' || m.status === 'forfeit'
              const isLive    = m.status === 'in_progress'
              const won       = isDone && m.winner_id === teamId

              return (
                <Link key={m.id} to={'/score/' + m.id}
                  className={'flex items-center gap-3 p-3 bg-white border rounded-xl hover:shadow-sm transition-all ' + (isLive ? 'border-green-200' : 'border-gray-200')}>
                  {/* Time */}
                  <div className="w-14 text-center flex-shrink-0">
                    {m.time_slot?.scheduled_start
                      ? <p className="text-xs font-semibold text-gray-600">{formatTime(m.time_slot.scheduled_start)}</p>
                      : <p className="text-xs text-gray-400">TBD</p>
                    }
                    {isLive && <p className="text-xs text-green-600 font-bold">LIVE</p>}
                    {isDone && (
                      <p className={'text-xs font-bold ' + (won ? 'text-green-600' : 'text-red-500')}>
                        {won ? 'W' : 'L'}
                      </p>
                    )}
                  </div>
                  <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />
                  {/* Opponent */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opponent?.primary_color ?? '#e5e7eb' }} />
                    <span className="text-sm text-gray-700 truncate">{opponent?.name ?? 'TBD'}</span>
                  </div>
                  {/* Score */}
                  {(isDone || isLive) && teamScore !== null && (
                    <span className={'text-sm font-black tabular-nums ' + (won ? 'text-green-600' : 'text-red-500')}>
                      {teamScore}-{oppScore}
                    </span>
                  )}
                  {/* Venue */}
                  {m.venue && (
                    <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">
                      {m.venue.short_name ?? m.venue.name}
                    </span>
                  )}
                  <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Roster */}
      {players.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Roster</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {players.map((p, i) => (
              <div key={p.id} className={'flex items-center gap-3 px-4 py-2.5 ' + (i > 0 ? 'border-t border-gray-50' : '')}>
                <span className="text-xs font-mono text-gray-400 w-6 text-right">{p.number ?? '-'}</span>
                <span className="text-sm text-gray-800">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach */}
      {team.head_coach_name && (
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Coach:</span> {team.head_coach_name}
          {team.head_coach_email && <span className="ml-2 text-gray-400">{team.head_coach_email}</span>}
        </div>
      )}
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
