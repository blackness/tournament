import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, RefreshCw, Heart } from 'lucide-react'
import { isFavorite, toggleFavorite } from './TeamPage'

const TIEBREAKER_LABELS = {
  head_to_head:   'Head-to-head',
  wins:           'Most wins',
  point_diff:     'Point differential',
  points_scored:  'Points for',
  points_against: 'Least points against',
  sotg:           'Spirit of the Game',
  disc_flip:      'Disc flip',
  director:       'Director decision',
}

export function StandingsPage() {
  const { slug } = useParams()

  const [tournament,  setTournament]  = useState(null)
  const [divisions,   setDivisions]   = useState([])
  const [poolsByDiv,  setPoolsByDiv]  = useState({})   // divisionId → pools[]
  const [teamsByPool, setTeamsByPool] = useState({})   // poolId → teams[]
  const [standings,   setStandings]   = useState({})   // teamId → stats row
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error,       setError]       = useState(null)

  // ── Step 1: load tournament + divisions once ──────────────
  useEffect(() => {
    if (!slug) return

    async function bootstrap() {
      try {
        // Tournament
        const { data: t, error: tErr } = await supabase
          .from('tournaments')
          .select('id, name, slug, primary_color, allow_ties, tiebreaker_order')
          .eq('slug', slug)
          .single()

        if (tErr) throw tErr
        setTournament(t)

        // All published divisions for this tournament
        const { data: divs, error: dErr } = await supabase
          .from('divisions')
          .select('id, name, slug, teams_advance_per_pool, tiebreaker_order, format_type, sort_order')
          .eq('tournament_id', t.id)
          .eq('status', 'published')
          .not('slug', 'in', '("girls-po","boys-po")')  // exclude playoff divisions
          .order('sort_order')

        if (dErr) throw dErr
        setDivisions(divs ?? [])

        if (!divs?.length) { setLoading(false); return }

        const divIds = divs.map(d => d.id)

        // All pools across all divisions
        const { data: pools, error: pErr } = await supabase
          .from('pools')
          .select('id, name, short_name, division_id, sort_order')
          .in('division_id', divIds)
          .order('sort_order')

        if (pErr) throw pErr

        // Group pools by division
        const grouped = {}
        for (const p of pools ?? []) {
          if (!grouped[p.division_id]) grouped[p.division_id] = []
          grouped[p.division_id].push(p)
        }
        setPoolsByDiv(grouped)

        const poolIds = (pools ?? []).map(p => p.id)

        // All teams across all pools
        const { data: teams, error: tmErr } = await supabase
          .from('tournament_teams')
          .select('id, name, short_name, primary_color, pool_id, division_id, pool_seed, seed')
          .eq('tournament_id', t.id)
          .in('pool_id', poolIds)
          .order('pool_seed', { ascending: true })

        if (tmErr) throw tmErr

        // Group teams by pool
        const byPool = {}
        for (const tm of teams ?? []) {
          if (!byPool[tm.pool_id]) byPool[tm.pool_id] = []
          byPool[tm.pool_id].push(tm)
        }
        setTeamsByPool(byPool)

        // Load live standings
        await loadStandings(t.id)
        setLoading(false)

      } catch (err) {
        console.error('StandingsPage bootstrap error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    bootstrap()
  }, [slug])

  // ── Step 2: live standings (fast, re-fetched on changes) ──
  const loadStandings = useCallback(async (tid) => {
    const tournamentId = tid ?? tournament?.id
    if (!tournamentId) return

    // Use v_pool_standings view we created — one query for all pools
    const { data, error: err } = await supabase
      .from('v_pool_standings')
      .select('team_id, pool_id, division_id, wins, losses, points_for, points_against, point_differential, games_played')
      .eq('tournament_id', tournamentId)

    if (err) { console.error('Standings load error:', err); return }

    const map = {}
    for (const row of data ?? []) {
      map[row.team_id] = row
    }
    setStandings(map)
    setLastUpdated(new Date())
  }, [tournament?.id])

  // ── Real-time subscription ────────────────────────────────
  useEffect(() => {
    if (!tournament?.id) return

    const channel = supabase
      .channel('standings-tournament-' + tournament.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: 'tournament_id=eq.' + tournament.id,
      }, () => loadStandings())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [tournament?.id, loadStandings])

  // ── Render ────────────────────────────────────────────────
  if (loading) return <PageLoader />

  if (error) return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#f87171', fontWeight: 600 }}>Failed to load standings</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{error}</p>
    </div>
  )

  const brandColor     = tournament?.primary_color ?? '#8b5cf6'
  const allowTies      = tournament?.allow_ties === true
  const tiebreakerOrder = tournament?.tiebreaker_order ?? []

  const columns = allowTies
    ? ['#', 'Team', 'W', 'L', 'T', '+/-', 'PF', 'PA', 'GP']
    : ['#', 'Team', 'W', 'L', '+/-', 'PF', 'PA', 'GP']

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={'/t/' + slug} style={{ color: 'var(--text-muted)', display: 'flex' }}>
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              Pool Standings
            </h1>
            {tournament && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {tournament.name}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => loadStandings()}
          style={{ padding: 8, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Divisions → Pools */}
      {divisions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No divisions published yet</p>
        </div>
      ) : (
        divisions.map(div => {
          const pools = poolsByDiv[div.id] ?? []
          const divTiebreakers = div.tiebreaker_order ?? tiebreakerOrder

          return (
            <div key={div.id} style={{ marginBottom: 32 }}>

              {/* Division header — only show if more than one division */}
              {divisions.length > 1 && (
                <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {div.name}
                </h2>
              )}

              {pools.map(pool => {
                const poolTeams = (teamsByPool[pool.id] ?? [])
                  .map(team => {
                    const stats = standings[team.id]
                    return {
                      team_id:        team.id,
                      team_name:      team.name,
                      team_short:     team.short_name,
                      primary_color:  team.primary_color,
                      seed:           team.pool_seed ?? team.seed,
                      wins:           stats?.wins            ?? 0,
                      losses:         stats?.losses          ?? 0,
                      point_diff:     stats?.point_differential ?? 0,
                      points_for:     stats?.points_for      ?? 0,
                      points_against: stats?.points_against  ?? 0,
                      games_played:   stats?.games_played    ?? 0,
                    }
                  })
                  .sort((a, b) => {
                    if (b.wins !== a.wins)        return b.wins - a.wins
                    if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff
                    if (b.points_for !== a.points_for) return b.points_for - a.points_for
                    return (a.team_name ?? '').localeCompare(b.team_name ?? '')
                  })

                return (
                  <div
                    key={pool.id}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}
                  >
                    {/* Pool header */}
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: brandColor + '12' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {pool.name}
                      </h3>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {poolTeams.length} teams
                      </span>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {columns.map((h, i) => (
                              <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: i < 2 ? 'left' : 'center' }}>
                                {h}
                              </th>
                            ))}
                            <th style={{ width: 32 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {poolTeams.length === 0 ? (
                            <tr>
                              <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                                No teams in this pool
                              </td>
                            </tr>
                          ) : (
                            poolTeams.map((row, idx) => {
                              const diff = row.point_diff ?? 0
                              return (
                                <tr key={row.team_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  {/* Rank */}
                                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', verticalAlign: 'top' }}>
                                    {idx + 1}
                                  </td>
                                  {/* Team */}
                                  <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.primary_color ?? '#8a8a9a', flexShrink: 0 }} />
                                      <Link
                                        to={'/t/' + slug + '/team/' + row.team_id}
                                        style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
                                      >
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>
                                          ({row.seed ?? '-'})
                                        </span>
                                        {row.team_short ?? row.team_name}
                                      </Link>
                                    </div>
                                  </td>
                                  {/* W */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'top' }}>
                                    {row.wins}
                                  </td>
                                  {/* L */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                    {row.losses}
                                  </td>
                                  {/* T (optional) */}
                                  {allowTies && (
                                    <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                      0
                                    </td>
                                  )}
                                  {/* +/- */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'var(--text-muted)', verticalAlign: 'top' }}>
                                    {diff > 0 ? '+' + diff : diff}
                                  </td>
                                  {/* PF */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                    {row.points_for}
                                  </td>
                                  {/* PA */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                    {row.points_against}
                                  </td>
                                  {/* GP */}
                                  <td style={{ padding: '11px 14px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-muted)', verticalAlign: 'top' }}>
                                    {row.games_played}
                                  </td>
                                  {/* Fav */}
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
              })}

              {/* Tiebreakers per division */}
              {divTiebreakers.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 4 }}>
                  <strong>Tiebreakers:</strong>{' '}
                  {divTiebreakers.map(t => TIEBREAKER_LABELS[t] ?? t).join(' › ')}
                </p>
              )}
            </div>
          )
        })
      )}

      {lastUpdated && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 10 }}>
          Updated {lastUpdated.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        </p>
      )}
    </div>
  )
}

function FavButton({ teamId }) {
  const [faved, setFaved] = useState(isFavorite(teamId))
  return (
    <button
      onClick={e => { e.preventDefault(); setFaved(toggleFavorite(teamId).includes(teamId)) }}
      style={{ padding: 4, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: faved ? '#f87171' : 'var(--text-muted)' }}
    >
      <Heart size={12} fill={faved ? 'currentColor' : 'none'} />
    </button>
  )
}