import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft } from 'lucide-react'

export function TeamComparePage() {
  const { slug, teamIdA, teamIdB } = useParams()
  const [teams, setTeams]          = useState([null, null])
  const [stats, setStats]          = useState([{}, {}])
  const [players, setPlayers]      = useState([[], []])
  const [standings, setStandings]  = useState([null, null])
  const [loading, setLoading]      = useState(true)

  useEffect(() => {
    async function load() {
      const ids = [teamIdA, teamIdB]

      // Load both teams
      const { data: teamsData } = await supabase
        .from('tournament_teams')
        .select(`
          id, name, short_name, primary_color, club_name,
          division:divisions(id, name, tournament:tournaments(name, slug, primary_color)),
          pool:pools(name)
        `)
        .in('id', ids)
      setTeams([
        teamsData?.find(t => t.id === teamIdA) ?? null,
        teamsData?.find(t => t.id === teamIdB) ?? null,
      ])

      // Load matches and events for each team
      for (let i = 0; i < 2; i++) {
        const teamId = ids[i]
        const { data: m } = await supabase
          .from('matches')
          .select('id, status, score_a, score_b, winner_id, team_a_id, team_b_id')
          .or('team_a_id.eq.' + teamId + ',team_b_id.eq.' + teamId)
          .in('status', ['complete', 'forfeit'])
        const matchIds = (m ?? []).map(mx => mx.id)

        if (matchIds.length > 0) {
          const { data: ev } = await supabase
            .from('game_events')
            .select('stat_id, player_id, secondary_player_id, team_id')
            .in('match_id', matchIds)
            .eq('team_id', teamId)
            .is('deleted_at', null)

          // Aggregate team stats
          const teamStats = {}
          for (const e of ev ?? []) {
            teamStats[e.stat_id] = (teamStats[e.stat_id] ?? 0) + 1
          }

          // W/L record
          const wins   = (m ?? []).filter(mx => mx.winner_id === teamId).length
          const losses = (m ?? []).filter(mx => mx.winner_id && mx.winner_id !== teamId).length
          const pf     = (m ?? []).reduce((s, mx) => s + (mx.team_a_id === teamId ? (mx.score_a ?? 0) : (mx.score_b ?? 0)), 0)
          const pa     = (m ?? []).reduce((s, mx) => s + (mx.team_a_id === teamId ? (mx.score_b ?? 0) : (mx.score_a ?? 0)), 0)

          setStats(prev => {
            const next = [...prev]
            next[i] = { ...teamStats, wins, losses, played: (m ?? []).length, pf, pa, pointDiff: pf - pa }
            return next
          })
        }

        // Standings
        const { data: st } = await supabase
          .from('pool_standings_display')
          .select('rank, wins, losses, point_diff, points_scored, points_against, games_played')
          .eq('team_id', teamId)
          .maybeSingle()
        setStandings(prev => { const next = [...prev]; next[i] = st; return next })

        // Top players
        const { data: p } = await supabase
          .from('tournament_players')
          .select('id, name, number')
          .eq('tournament_team_id', teamId)
          .order('number')
          .limit(10)
        setPlayers(prev => { const next = [...prev]; next[i] = p ?? []; return next })
      }

      setLoading(false)
    }
    load()
  }, [teamIdA, teamIdB])

  if (loading) return <PageLoader />

  const [teamA, teamB]     = teams
  const [statsA, statsB]   = stats
  const tournament = teamA?.division?.tournament ?? teamB?.division?.tournament

  const COMPARE_ROWS = [
    { label: 'Record',        a: statsA.wins + '-' + statsA.losses,  b: statsB.wins + '-' + statsB.losses,  better: null },
    { label: 'Games played',  a: statsA.played ?? 0,     b: statsB.played ?? 0,     better: null },
    { label: 'Points scored', a: statsA.pf ?? 0,         b: statsB.pf ?? 0,         better: 'higher' },
    { label: 'Points against',a: statsA.pa ?? 0,         b: statsB.pa ?? 0,         better: 'lower' },
    { label: 'Point diff',    a: statsA.pointDiff ?? 0,  b: statsB.pointDiff ?? 0,  better: 'higher' },
    { label: 'Pool rank',     a: standings[0]?.rank ?? '-', b: standings[1]?.rank ?? '-', better: 'lower' },
    { label: 'Goals',         a: statsA.goal ?? 0,       b: statsB.goal ?? 0,       better: 'higher' },
    { label: 'Assists',       a: statsA.assist ?? 0,     b: statsB.assist ?? 0,     better: 'higher' },
    { label: 'Callahans',     a: statsA.callahan ?? 0,   b: statsB.callahan ?? 0,   better: 'higher' },
    { label: 'Layout D',      a: statsA.layout_d ?? 0,   b: statsB.layout_d ?? 0,   better: 'higher' },
    { label: 'D Blocks',      a: statsA.d_block ?? 0,    b: statsB.d_block ?? 0,    better: 'higher' },
    { label: 'Turnovers',     a: statsA.turnover ?? 0,   b: statsB.turnover ?? 0,   better: 'lower' },
    { label: 'Drops',         a: statsA.drop ?? 0,       b: statsB.drop ?? 0,       better: 'lower' },
    { label: 'Throwaways',    a: statsA.throwaway ?? 0,  b: statsB.throwaway ?? 0,  better: 'lower' },
  ].filter(r => r.a !== 0 || r.b !== 0 || r.label === 'Record' || r.label === 'Pool rank')

  return (
    <div style={{maxWidth:640, margin:"0 auto", padding:"32px 20px 80px"}}>
      {/* Header */}
      <div className="flex items-center gap-3">
        {tournament && (
          <Link to={'/t/' + tournament.slug} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
        )}
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Team Comparison</h1>
      </div>

      {/* Team headers */}
      <div className="grid grid-cols-2 gap-3">
        {[teamA, teamB].map((t, i) => (
          <Link key={i} to={'/t/' + tournament?.slug + '/team/' + t?.id}
            className="flex flex-col items-center gap-2 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl hover: text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl"
              style={{ backgroundColor: t?.primary_color ?? '#6b7280' }}>
              {(t?.short_name ?? t?.name ?? '?')[0]}
            </div>
            <p className="font-bold text-[var(--text-primary)] text-sm leading-tight">{t?.name ?? 'TBD'}</p>
            {t?.pool && <p className="text-xs text-[var(--text-muted)]">{t.pool.name}</p>}
          </Link>
        ))}
      </div>

      {/* Comparison table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {COMPARE_ROWS.map((row, i) => {
          const numA = typeof row.a === 'number' ? row.a : null
          const numB = typeof row.b === 'number' ? row.b : null
          const aWins = row.better === 'higher' ? numA > numB : row.better === 'lower' ? numA < numB : false
          const bWins = row.better === 'higher' ? numB > numA : row.better === 'lower' ? numB < numA : false

          return (
            <div key={i} className={'grid grid-cols-3 items-center ' + (i > 0 ? 'border-t border-gray-50' : '')}>
              <div className={'py-3 px-4 text-right text-sm tabular-nums font-semibold ' + (aWins ? 'text-green-600' : 'text-gray-700')}>
                {String(row.a)}
              </div>
              <div className="py-3 px-2 text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {row.label}
              </div>
              <div className={'py-3 px-4 text-left text-sm tabular-nums font-semibold ' + (bWins ? 'text-green-600' : 'text-gray-700')}>
                {String(row.b)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Head to head */}
      <HeadToHead teamIdA={teamIdA} teamIdB={teamIdB} teamA={teamA} teamB={teamB} />
    </div>
  )
}

function HeadToHead({ teamIdA, teamIdB, teamA, teamB }) {
  const [h2h, setH2h] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('id, score_a, score_b, winner_id, status, time_slot:time_slots(scheduled_start), team_a_id, team_b_id')
        .or('and(team_a_id.eq.' + teamIdA + ',team_b_id.eq.' + teamIdB + '),and(team_a_id.eq.' + teamIdB + ',team_b_id.eq.' + teamIdA + ')')
        .in('status', ['complete', 'forfeit', 'in_progress'])
      setH2h(data ?? [])
    }
    load()
  }, [teamIdA, teamIdB])

  if (h2h.length === 0) return (
    <div className="text-center py-4 text-[var(--text-muted)] text-sm">No head-to-head games yet</div>
  )

  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Head to head</h2>
      <div className="space-y-2">
        {h2h.map(m => {
          const aIsTeamA = m.team_a_id === teamIdA
          const scoreA = aIsTeamA ? m.score_a : m.score_b
          const scoreB = aIsTeamA ? m.score_b : m.score_a
          const aWon   = m.winner_id === teamIdA
          const bWon   = m.winner_id === teamIdB

          return (
            <Link key={m.id} to={'/score/' + m.id}
              className="flex items-center justify-between p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover: text-sm">
              <span className={'font-semibold ' + (aWon ? 'text-green-600' : bWon ? 'text-gray-400' : 'text-gray-700')}>
                {teamA?.short_name ?? teamA?.name}
              </span>
              <span className="font-black tabular-nums text-[var(--text-primary)]">{scoreA ?? '-'} - {scoreB ?? '-'}</span>
              <span className={'font-semibold ' + (bWon ? 'text-green-600' : aWon ? 'text-gray-400' : 'text-gray-700')}>
                {teamB?.short_name ?? teamB?.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
