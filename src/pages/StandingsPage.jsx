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

  async function refreshAll() {
    await Promise.all([loadStandings(), loadTeams()])
  }

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, teams_advance_per_pool, tiebreaker_order, tournament:tournaments(id, name, slug, primary_color, tiebreaker_order)')
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

    return () => {
      supabase.removeChannel(standingsChannel)
      supabase.removeChannel(teamsChannel)
    }
  }, [divisionId])

  if (loading) return <PageLoader />

  const tournament = division?.tournament
  const tiebreakerOrder = division?.tiebreaker_order ?? tournament?.tiebreaker_order ?? []
  const brandColor = tournament?.primary_color ?? '#8b5cf6'

  // Use standings rows only for stats, not for pool membership
  const standingsByTeamId = Object.fromEntries(
    standings.map(row => [row.team_id, row])
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Header */}
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

      {/* Pools */}
      {pools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No pools yet</p>
        </div>
      ) : (
        pools.map(pool => {
          // Membership comes from tournament_teams.pool_id
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
                point_diff: stats?.point_diff ?? 0,
                points_scored: stats?.points_scored ?? 0,
                points_against: stats?.points_against ?? 0,
                games_played: stats?.games_played ?? 0,
                rank: stats?.rank ?? null,
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
              {/* Pool header */}
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

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Team', 'W', 'L', '+/-', 'PF', 'PA', 'GP'].map((h, i) => (
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
                          colSpan={9}
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
                              }}
                            >
                              {idx + 1}
                            </td>

                            <td style={{ padding: '11px 14px' }}>
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
                            </td>

                            <td
                              style={{
                                padding: '11px 14px',
                                textAlign: 'center',
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
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
                              }}
                            >
                              {row.losses ?? 0}
                            </td>

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
                              }}
                            >
                              {row.games_played ?? 0}
                            </td>

                            <td style={{ padding: '11px 14px' }}>
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

      {/* Tournament format note */}
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

      {/* Tiebreaker note */}
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
  point_diff: 'Most wins',
  points_scored: 'Least points against',
  points_against: 'Points for',
  sotg: 'Disk flip',
}