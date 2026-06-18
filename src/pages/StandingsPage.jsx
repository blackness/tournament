import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, RefreshCw, Heart } from 'lucide-react'
import { isFavorite, toggleFavorite } from './TeamPage'

export function StandingsPage() {
  const { slug, divisionId } = useParams()
  const [division, setDivision] = useState(null)
  const [standings, setStandings] = useState([])
  const [teams, setTeams] = useState([])
  const [pools, setPools] = useState([])
  const [crossoverMatches, setCrossoverMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadStandings() {
    const { data } = await supabase
      .from('pool_standings_display')
      .select('*')
      .eq('division_id', divisionId)
      .order('pool_id')
      .order('rank')

    setStandings(data ?? [])
    setLastUpdated(new Date())
  }

  async function loadTeams() {
    const { data } = await supabase
      .from('tournament_teams')
      .select('id, name, short_name, primary_color, pool_id, seed')
      .eq('division_id', divisionId)
      .order('seed', { ascending: true })

    setTeams(data ?? [])
  }

  async function loadCrossovers() {
    const { data } = await supabase
      .from('matches')
      .select(`
        id,
        match_code,
        round_label,
        status,
        winner_id,
        team_a_id,
        team_b_id
      `)
      .eq('division_id', divisionId)
      .neq('status', 'cancelled')

    const xoMatches = (data ?? []).filter(
      m =>
        (m.match_code && /^XO-\d+$/.test(m.match_code)) ||
        (m.round_label && m.round_label.toLowerCase().includes('crossover'))
    )

    setCrossoverMatches(xoMatches)
  }

  async function refreshAll() {
    await Promise.all([loadStandings(), loadTeams(), loadCrossovers()])
  }

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, teams_advance_per_pool, tiebreaker_order, tournament:tournaments(id, name, slug, primary_color, tiebreaker_order, allow_ties)')
        .eq('id', divisionId)
        .single()

      setDivision(div)

      const { data: poolData } = await supabase
        .from('pools')
        .select('id, name, short_name')
        .eq('division_id', divisionId)
        .order('sort_order')

      setPools(poolData ?? [])
      await refreshAll()
      setLoading(false)
    }

    load()
  }, [divisionId])

  useEffect(() => {
    if (!divisionId) return

    const standingsChannel = supabase
      .channel('standings-' + divisionId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pool_standings' },
        refreshAll
      )
      .subscribe()

    const teamsChannel = supabase
      .channel('teams-' + divisionId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_teams' },
        refreshAll
      )
      .subscribe()

    const matchesChannel = supabase
      .channel('matches-' + divisionId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: 'division_id=eq.' + divisionId },
        refreshAll
      )
      .subscribe()

    return () => {
      supabase.removeChannel(standingsChannel)
      supabase.removeChannel(teamsChannel)
      supabase.removeChannel(matchesChannel)
    }
  }, [divisionId])

  if (loading) return <PageLoader />

  const tournament = division?.tournament
  const allowTies = tournament?.allow_ties === true
  const tiebreakerOrder = division?.tiebreaker_order ?? tournament?.tiebreaker_order ?? []
  const brandColor = tournament?.primary_color ?? '#8b5cf6'

  const standingsByTeamId = Object.fromEntries(
    standings.map(row => [row.team_id, row])
  )

  const poolNameById = Object.fromEntries(
    pools.map(p => [p.id, p.short_name ?? p.name])
  )

  const crossoverSlotMap = {
    'XO-1': { winner: 'B2', loser: 'A3' },
    'XO-2': { winner: 'A2', loser: 'B3' },
    'XO-3': { winner: 'D2', loser: 'C3' },
    'XO-4': { winner: 'C2', loser: 'D3' },
  }

  const crossoverByTeamId = {}

  for (const match of crossoverMatches) {
    const isComplete = match.status === 'complete' || match.status === 'forfeit'
    if (!isComplete || !match.winner_id) continue

    const teamA = teams.find(t => t.id === match.team_a_id)
    const teamB = teams.find(t => t.id === match.team_b_id)

    const statsA = standingsByTeamId[match.team_a_id]
    const statsB = standingsByTeamId[match.team_b_id]

    const rankA = statsA?.rank ?? null
    const rankB = statsB?.rank ?? null

    const poolA = poolNameById[teamA?.pool_id]
    const poolB = poolNameById[teamB?.pool_id]

    const teamAOriginal = formatPoolRank(poolA, rankA)
    const teamBOriginal = formatPoolRank(poolB, rankB)

    const originalSecond =
      rankA === 2 ? { id: match.team_a_id, team: teamA, pool: poolA, original: teamAOriginal } :
      rankB === 2 ? { id: match.team_b_id, team: teamB, pool: poolB, original: teamBOriginal } :
      null

    const originalThird =
      rankA === 3 ? { id: match.team_a_id, team: teamA, pool: poolA, original: teamAOriginal } :
      rankB === 3 ? { id: match.team_b_id, team: teamB, pool: poolB, original: teamBOriginal } :
      null

    if (!originalSecond || !originalThird) continue

    const secondSlot = `Pool ${originalSecond.pool}'s playoff 2nd seed slot`
    const thirdSlot = `Pool ${originalThird.pool}'s playoff 3rd seed slot`

    const secondWon = match.winner_id === originalSecond.id

    if (secondWon) {
      crossoverByTeamId[originalSecond.id] = {
        result: 'won',
        text: `Won crossover • Remains in ${secondSlot}`,
      }

      crossoverByTeamId[originalThird.id] = {
        result: 'lost',
        text: `Lost crossover • Remains in ${thirdSlot}`,
      }
    } else {
      crossoverByTeamId[originalThird.id] = {
        result: 'won',
        text: `Won crossover • Moves from ${originalThird.original} to ${secondSlot}`,
      }

      crossoverByTeamId[originalSecond.id] = {
        result: 'lost',
        text: `Lost crossover • Drops from ${originalSecond.original} to ${thirdSlot}`,
      }
    }
  }

  const completedCrossovers = crossoverMatches.filter(
    m => (m.status === 'complete' || m.status === 'forfeit') && m.winner_id
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tournament && (
            <Link
              to={'/t/' + tournament.slug}
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={20} />
            </Link>
          )}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              {division?.name} Standings
            </h1>
            {tournament && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {tournament.name}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={refreshAll}
          style={{
            padding: 8,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {pools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No pools yet</p>
        </div>
      ) : (
        pools.map(pool => {
          const columns = allowTies
            ? ['#', 'Team', 'W', 'L', 'T', '+/-', 'PF', 'PA', 'GP']
            : ['#', 'Team', 'W', 'L', '+/-', 'PF', 'PA', 'GP']

          const poolTeams = teams
            .filter(team => team.pool_id === pool.id)
            .map(team => {
              const stats = standingsByTeamId[team.id]

              return {
                team_id: team.id,
                team_name: team.name,
                team_short_name: team.short_name,
                primary_color: team.primary_color,
                seed: team.seed ?? null,
                wins: stats?.wins ?? 0,
                losses: stats?.losses ?? 0,
                ties: stats?.ties ?? stats?.draws ?? 0,
                point_diff: stats?.point_diff ?? 0,
                points_scored: stats?.points_scored ?? 0,
                points_against: stats?.points_against ?? 0,
                games_played: stats?.games_played ?? 0,
                rank: stats?.rank ?? null,
                crossover: crossoverByTeamId[team.id] ?? null,
              }
            })
            .sort((a, b) => {
              if (a.rank != null && b.rank != null) return a.rank - b.rank
              if (a.rank != null) return -1
              if (b.rank != null) return 1
              return (a.team_name || '').localeCompare(b.team_name || '')
            })

          return (
            <div
              key={pool.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: brandColor + '12',
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {pool.name}
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {poolTeams.length} teams
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {columns.map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 14px',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                            textAlign: i < 2 ? 'left' : 'center',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolTeams.length === 0 ? (
                      <tr>
                        <td
                          colSpan={allowTies ? 10 : 9}
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 13,
                            fontStyle: 'italic',
                          }}
                        >
                          No teams in this pool
                        </td>
                      </tr>
                    ) : (
                      poolTeams.map((row, idx) => {
                        const diff = row.point_diff ?? 0

                        return (
                          <tr
                            key={row.team_id}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                          >
                            <td
                              style={{
                                padding: '11px 14px',
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                fontFamily: 'DM Mono, monospace',
                                verticalAlign: 'top',
                              }}
                            >
                              {idx + 1}
                            </td>

                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      background: row.primary_color ?? '#8a8a9a',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Link
                                    to={'/t/' + slug + '/team/' + row.team_id}
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 500,
                                      color: 'var(--text-primary)',
                                      textDecoration: 'none',
                                    }}
                                    className="hover:text-[var(--accent)]"
                                  >
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>
                                      ({row.seed ?? '-'})
                                    </span>
                                    {row.team_short_name ?? row.team_name}
                                  </Link>
                                </div>

                                {row.crossover && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: row.crossover.result === 'won' ? '#4ade80' : '#f59e0b',
                                      marginLeft: 16,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {row.crossover.text}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.wins ?? 0}
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.losses ?? 0}
                            </td>

                            {allowTies && (
                              <td
                                style={{
                                  padding: '11px 14px',
                                  textAlign: 'center',
                                  fontFamily: 'DM Mono, monospace',
                                  fontSize: 13,
                                  color: 'var(--text-secondary)',
                                  verticalAlign: 'top',
                                }}
                              >
                                {row.ties ?? 0}
                              </td>
                            )}

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                fontWeight: 600,
                                color:
                                  diff > 0
                                    ? '#4ade80'
                                    : diff < 0
                                      ? '#f87171'
                                      : 'var(--text-muted)',
                                verticalAlign: 'top',
                              }}
                            >
                              {diff > 0 ? '+' + diff : diff}
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.points_scored ?? 0}
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.points_against ?? 0}
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                color: 'var(--text-muted)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.games_played ?? 0}
                            </td>

                            <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                              <FavButton teamId={row.team_id} />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      <div
        style={{
          marginTop: 16,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '14px 16px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Advancement
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          1st place advances to Championship. 4th place advances to Consolation.
          2nd and 3rd place play a crossover; winner advances to Championship and loser advances to Consolation.
        </p>
      </div>

      {completedCrossovers.length > 0 && (
        <div
          style={{
            marginTop: 12,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '14px 16px',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}
          >
            Crossover Results
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completedCrossovers.map(match => {
              const loserId =
                match.team_a_id === match.winner_id ? match.team_b_id :
                match.team_b_id === match.winner_id ? match.team_a_id :
                null

              const winner = teams.find(t => t.id === match.winner_id)
              const loser = teams.find(t => t.id === loserId)

              const winnerStats = standingsByTeamId[match.winner_id]
              const loserStats = loserId ? standingsByTeamId[loserId] : null

              const slotInfo = crossoverSlotMap[match.match_code]

              const winnerOriginal = formatPoolRank(
                poolNameById[winner?.pool_id],
                winnerStats?.rank ?? null
              )

              const loserOriginal = formatPoolRank(
                poolNameById[loser?.pool_id],
                loserStats?.rank ?? null
              )

              const winnerDest = formatPlayoffSlot(slotInfo?.winner)
              const loserDest = formatPlayoffSlot(slotInfo?.loser)

              return (
                <div key={match.id} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <div>
                    <strong style={{ color: '#4ade80' }}>
                      {winner?.short_name ?? winner?.name ?? 'Winner'}
                    </strong>
                    {' '}defeated{' '}
                    <strong>
                      {loser?.short_name ?? loser?.name ?? 'Loser'}
                    </strong>
                    {' '}in {match.match_code ?? 'crossover'}
                    {winnerOriginal && winnerDest
                      ? winnerStats?.rank === 2
                        ? ` and remains in ${winnerDest}.`
                        : ` and moves from ${winnerOriginal} to ${winnerDest}.`
                      : '.'}
                  </div>

                  {loser && loserOriginal && loserDest && (
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {loser.short_name ?? loser.name}
                      {loserStats?.rank === 3
                        ? ` remains in ${loserDest}.`
                        : ` drops from ${loserOriginal} to ${loserDest}.`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '14px 16px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Tiebreakers
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {tiebreakerOrder.length > 0
            ? tiebreakerOrder.map(t => TIEBREAKER_LABELS[t] ?? t).join(' > ')
            : 'Tiebreakers will be applied according to tournament rules.'}
        </p>
      </div>

      {lastUpdated && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 10 }}>
          Updated{' '}
          {lastUpdated.toLocaleTimeString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

function formatPoolRank(poolName, rank) {
  if (!poolName || !rank) return null

  const rankText =
    rank === 1 ? '1st' :
    rank === 2 ? '2nd' :
    rank === 3 ? '3rd' :
    rank === 4 ? '4th' :
    `${rank}th`

  return `${poolName} ${rankText}`
}

function formatPlayoffSlot(slot) {
  if (!slot || slot.length < 2) return slot

  const pool = slot[0]
  const rank = Number(slot.slice(1))

  const rankText =
    rank === 1 ? '1st' :
    rank === 2 ? '2nd' :
    rank === 3 ? '3rd' :
    rank === 4 ? '4th' :
    `${rank}th`

  return `Pool ${pool}'s playoff ${rankText} seed slot`
}

function FavButton({ teamId }) {
  const [faved, setFaved] = useState(isFavorite(teamId))

  return (
    <button
      onClick={e => {
        e.preventDefault()
        setFaved(toggleFavorite(teamId).includes(teamId))
      }}
      style={{
        padding: 4,
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: faved ? '#f87171' : 'var(--text-muted)',
      }}
    >
      <Heart size={12} fill={faved ? 'currentColor' : 'none'} />
    </button>
  )
}

const TIEBREAKER_LABELS = {
  head_to_head: 'Head-to-head',
  wins: 'Most wins',
  point_diff: 'Point differential',
  points_scored: 'Points for',
  points_against: 'Least points against',
  sotg: 'Spirit of the Game',
  disc_flip: 'Disc flip',
}