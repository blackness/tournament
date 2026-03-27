import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, ChevronRight, Heart, BarChart2, Trophy, Users } from 'lucide-react'

// -- Favorites helpers (localStorage, no login needed) ------------------------
export function getFavorites() {
  try { return JSON.parse(localStorage.getItem('fav_teams') ?? '[]') } catch { return [] }
}
export function toggleFavorite(teamId) {
  const favs = getFavorites()
  const next = favs.includes(teamId) ? favs.filter(id => id !== teamId) : [...favs, teamId]
  localStorage.setItem('fav_teams', JSON.stringify(next))
  return next
}
export function isFavorite(teamId) {
  return getFavorites().includes(teamId)
}

export function TeamPage() {
  const { slug, teamId }          = useParams()
  const navigate                  = useNavigate()
  const [team, setTeam]           = useState(null)
  const [matches, setMatches]     = useState([])
  const [players, setPlayers]     = useState([])
  const [events, setEvents]       = useState([])
  const [divTeams, setDivTeams]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [faved, setFaved]         = useState(isFavorite(teamId))
  const [activeTab, setActiveTab] = useState('schedule') // schedule | roster | stats

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
        .eq('id', teamId).single()

      if (!t) { setLoading(false); return }
      setTeam(t)

      // All matches for this team
      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, score_a, score_b, winner_id,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start),
          division:divisions(name), pool:pools(name)
        `)
        .or('team_a_id.eq.' + teamId + ',team_b_id.eq.' + teamId)
        .neq('status', 'cancelled')
        .order('time_slot(scheduled_start)')
      setMatches(m ?? [])

      // Players
      const { data: p } = await supabase
        .from('tournament_players')
        .select('id, name, number, is_eligible')
        .eq('tournament_team_id', teamId)
        .order('number')
      setPlayers(p ?? [])

      // Game events for player stats
      const matchIds = (m ?? []).map(mx => mx.id)
      if (matchIds.length > 0) {
        const { data: ev } = await supabase
          .from('game_events')
          .select('id, stat_id, player_id, secondary_player_id, team_id, match_id')
          .in('match_id', matchIds)
          .eq('team_id', teamId)
          .is('deleted_at', null)
        setEvents(ev ?? [])
      }

      // Other teams in same division for comparison
      const { data: dt } = await supabase
        .from('tournament_teams')
        .select('id, name, short_name, primary_color')
        .eq('division_id', t.division?.id)
        .neq('id', teamId)
        .order('name')
      setDivTeams(dt ?? [])

      setLoading(false)
    }
    load()
  }, [teamId])

  function handleFavorite() {
    const next = toggleFavorite(teamId)
    setFaved(next.includes(teamId))
  }

  if (loading) return <PageLoader />
  if (!team) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Team not found</p>
    </div>
  )

  const tournament = team.division?.tournament
  const wins   = matches.filter(m => m.winner_id === teamId).length
  const losses = matches.filter(m => m.winner_id && m.winner_id !== teamId).length
  const played = matches.filter(m => ['complete','forfeit'].includes(m.status)).length

  // Build player stats map
  const playerStats = buildPlayerStats(events, players)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {tournament && (
          <Link to={'/t/' + tournament.slug} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
        )}
        <div className="flex items-center gap-3 flex-1 min-w-0">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Favorite button */}
          <button onClick={handleFavorite}
            className={'p-2 rounded-xl transition-colors ' + (faved ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-gray-300 hover:text-red-400 hover:bg-red-50')}>
            <Heart size={18} fill={faved ? 'currentColor' : 'none'} />
          </button>
          {/* Compare button */}
          {divTeams.length > 0 && (
            <div className="relative group">
              <button className="p-2 rounded-xl text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                <BarChart2 size={18} />
              </button>
              {/* Compare dropdown */}
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-48 py-1 hidden group-focus-within:block group-hover:block">
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Compare with</p>
                {divTeams.map(t => (
                  <Link key={t.id}
                    to={'/t/' + tournament?.slug + '/compare/' + teamId + '/' + t.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primary_color ?? '#6b7280' }} />
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record */}
      {played > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Wins"   value={wins}   color="green" />
          <StatBox label="Losses" value={losses}  color="red" />
          <StatBox label="Played" value={played}  color="gray" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[['schedule','Schedule'],['roster','Roster'],['stats','Player Stats']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ' + (
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-2">
          {matches.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No games scheduled</p>
            : matches.map(m => <MatchCard key={m.id} match={m} teamId={teamId} />)
          }
        </div>
      )}

      {/* Roster tab */}
      {activeTab === 'roster' && (
        <div>
          {players.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No roster added</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {players.map((p, i) => (
                <div key={p.id} className={'flex items-center gap-3 px-4 py-2.5 ' + (i > 0 ? 'border-t border-gray-50' : '')}>
                  <span className="text-xs font-mono text-gray-400 w-6 text-right">{p.number ?? '-'}</span>
                  <span className="text-sm text-gray-800 flex-1">{p.name}</span>
                  {!p.is_eligible && (
                    <span className="badge badge-red text-xs">Ineligible</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {team.head_coach_name && (
            <p className="text-sm text-gray-500 mt-3">
              <span className="font-medium text-gray-700">Coach:</span> {team.head_coach_name}
            </p>
          )}
        </div>
      )}

      {/* Player stats tab */}
      {activeTab === 'stats' && (
        <PlayerStatsTable playerStats={playerStats} players={players} />
      )}
    </div>
  )
}

function MatchCard({ match: m, teamId }) {
  const isTeamA = m.team_a?.id === teamId
  const opponent = isTeamA ? m.team_b : m.team_a
  const teamScore = isTeamA ? m.score_a : m.score_b
  const oppScore  = isTeamA ? m.score_b : m.score_a
  const isDone    = ['complete','forfeit'].includes(m.status)
  const isLive    = m.status === 'in_progress'
  const won       = isDone && m.winner_id === teamId

  return (
    <Link to={'/score/' + m.id}
      className={'flex items-center gap-3 p-3 bg-white border rounded-xl hover:shadow-sm transition-all ' + (isLive ? 'border-green-200' : 'border-gray-200')}>
      <div className="w-14 text-center flex-shrink-0">
        {m.time_slot?.scheduled_start
          ? <p className="text-xs font-semibold text-gray-600">{formatTime(m.time_slot.scheduled_start)}</p>
          : <p className="text-xs text-gray-400">TBD</p>
        }
        {isLive && <p className="text-xs text-green-600 font-bold animate-pulse">LIVE</p>}
        {isDone && <p className={'text-xs font-bold ' + (won ? 'text-green-600' : 'text-red-500')}>{won ? 'W' : 'L'}</p>}
      </div>
      <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opponent?.primary_color ?? '#e5e7eb' }} />
        <span className="text-sm text-gray-700 truncate">{opponent?.name ?? 'TBD'}</span>
      </div>
      {(isDone || isLive) && teamScore !== null && (
        <span className={'text-sm font-black tabular-nums flex-shrink-0 ' + (won ? 'text-green-600' : 'text-gray-500')}>
          {teamScore}-{oppScore}
        </span>
      )}
      {m.venue && <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">{m.venue.short_name ?? m.venue.name}</span>}
      <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
    </Link>
  )
}

function PlayerStatsTable({ playerStats, players }) {
  const [sortBy, setSortBy] = useState('goals')

  const STAT_COLS = [
    { key: 'goal',      label: 'G',   title: 'Goals' },
    { key: 'assist',    label: 'A',   title: 'Assists' },
    { key: 'callahan',  label: 'CAL', title: 'Callahans' },
    { key: 'layout_d',  label: 'LD',  title: 'Layout D' },
    { key: 'd_block',   label: 'D',   title: 'D Blocks' },
    { key: 'turnover',  label: 'T',   title: 'Turnovers' },
    { key: 'drop',      label: 'DR',  title: 'Drops' },
    { key: 'throwaway', label: 'TA',  title: 'Throwaways' },
  ]

  const rows = players
    .map(p => ({ player: p, stats: playerStats[p.id] ?? {} }))
    .filter(r => Object.keys(r.stats).length > 0)
    .sort((a, b) => (b.stats[sortBy] ?? 0) - (a.stats[sortBy] ?? 0))

  if (rows.length === 0) return (
    <div className="text-center py-8 text-gray-400">
      <Trophy size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No player stats recorded yet</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left pl-4 pr-2 py-2.5 text-xs font-semibold text-gray-500 w-6">#</th>
              <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-500">Player</th>
              {STAT_COLS.map(col => (
                <th key={col.key} onClick={() => setSortBy(col.key)}
                  title={col.title}
                  className={'px-2 py-2.5 text-center text-xs font-semibold cursor-pointer transition-colors w-9 ' + (sortBy === col.key ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600')}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(({ player: p, stats }) => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="pl-4 pr-2 py-2.5 text-xs text-gray-400 font-mono">{p.number ?? '-'}</td>
                <td className="px-2 py-2.5 font-medium text-gray-900">{p.name}</td>
                {STAT_COLS.map(col => (
                  <td key={col.key} className={'px-2 py-2.5 text-center tabular-nums ' + (
                    sortBy === col.key ? 'font-bold text-blue-700' : 'text-gray-600'
                  )}>
                    {stats[col.key] ? stats[col.key] : <span className="text-gray-200">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
        Click a column header to sort
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    red:   'bg-red-50 text-red-600',
    gray:  'bg-gray-50 text-gray-700',
  }
  return (
    <div className={'rounded-xl p-3 text-center border border-gray-100 ' + (colors[color] ?? colors.gray)}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  )
}

function buildPlayerStats(events, players) {
  const stats = {}
  for (const ev of events) {
    if (ev.player_id) {
      if (!stats[ev.player_id]) stats[ev.player_id] = {}
      stats[ev.player_id][ev.stat_id] = (stats[ev.player_id][ev.stat_id] ?? 0) + 1
    }
    // Count assist on secondary player
    if (ev.secondary_player_id) {
      if (!stats[ev.secondary_player_id]) stats[ev.secondary_player_id] = {}
      stats[ev.secondary_player_id]['assist'] = (stats[ev.secondary_player_id]['assist'] ?? 0) + 1
    }
  }
  return stats
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
