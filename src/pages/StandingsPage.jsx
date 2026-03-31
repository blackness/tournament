import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, ChevronRight, RefreshCw, Heart } from 'lucide-react'
import { isFavorite, toggleFavorite } from './TeamPage'

export function StandingsPage() {
  const { slug, divisionId }          = useParams()
  const [division, setDivision]       = useState(null)
  const [standings, setStandings]     = useState([])
  const [pools, setPools]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadStandings() {
    const { data } = await supabase
      .from('pool_standings_display')
      .select('*')
      .eq('division_id', divisionId)
      .order('pool_id').order('rank')
    setStandings(data ?? [])
    setLastUpdated(new Date())
  }

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, teams_advance_per_pool, tiebreaker_order, tournament:tournaments(id, name, slug, primary_color, tiebreaker_order)')
        .eq('id', divisionId).single()
      setDivision(div)
      const { data: poolData } = await supabase
        .from('pools').select('id, name, short_name')
        .eq('division_id', divisionId).order('sort_order')
      setPools(poolData ?? [])
      await loadStandings()
      setLoading(false)
    }
    load()
  }, [divisionId])

  useEffect(() => {
    if (!divisionId) return
    const channel = supabase.channel('standings-' + divisionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_standings' }, loadStandings)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [divisionId])

  if (loading) return <PageLoader />

  const tournament = division?.tournament
  const tiebreakerOrder = division?.tiebreaker_order ?? tournament?.tiebreaker_order ?? []
  const advancesPerPool = division?.teams_advance_per_pool ?? 2
  const byPool = {}
  for (const row of standings) {
    if (!byPool[row.pool_id]) byPool[row.pool_id] = []
    byPool[row.pool_id].push(row)
  }
  const brandColor = tournament?.primary_color ?? '#8b5cf6'

  return (
    <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 20px 80px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {tournament && (
            <Link to={'/t/' + tournament.slug} style={{ color:'var(--text-muted)', display:'flex', alignItems:'center' }}>
              <ChevronLeft size={20} />
            </Link>
          )}
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>{division?.name} Standings</h1>
            {tournament && <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{tournament.name}</p>}
          </div>
        </div>
        <button onClick={loadStandings} style={{ padding:8, borderRadius:8, background:'transparent', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Pools */}
      {pools.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>No pools yet</p>
        </div>
      ) : pools.map(pool => {
        const poolRows = byPool[pool.id] ?? []
        return (
          <div key={pool.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
            {/* Pool header */}
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background: brandColor + '12' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{pool.name}</h2>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{poolRows.length} teams</span>
            </div>

            {/* Table */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:480 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['#','Team','W','L','+/-','PF','PA','GP'].map((h, i) => (
                      <th key={h} style={{ padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', textAlign: i < 2 ? 'left' : 'center' }}>{h}</th>
                    ))}
                    <th style={{ width:32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {poolRows.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:13, fontStyle:'italic' }}>No results yet</td></tr>
                  ) : poolRows.map((row, idx) => {
                    const advances = idx < advancesPerPool
                    const diff = row.point_diff ?? 0
                    return (
                      <tr key={row.team_id} style={{ borderBottom:'1px solid rgba(42,42,50,0.5)', background: advances ? brandColor + '08' : 'transparent' }}>
                        <td style={{ padding:'11px 14px', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Mono, monospace' }}>{idx + 1}</td>
                        <td style={{ padding:'11px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:row.primary_color ?? '#8a8a9a', flexShrink:0 }} />
                            <Link to={'/t/' + slug + '/team/' + row.team_id}
                              style={{ fontSize:14, fontWeight: advances ? 600 : 500, color:'var(--text-primary)', textDecoration:'none' }}
                              className="hover:text-[var(--accent)]">
                              {row.team_short_name ?? row.team_name}
                            </Link>
                            {advances && idx === advancesPerPool - 1 && (
                              <ChevronRight size={11} style={{ color: brandColor, marginLeft:2 }} />
                            )}
                          </div>
                        </td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{row.wins ?? 0}</td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-secondary)' }}>{row.losses ?? 0}</td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:600, color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'var(--text-muted)' }}>
                          {diff > 0 ? '+' + diff : diff}
                        </td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-secondary)' }}>{row.points_scored ?? 0}</td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-secondary)' }}>{row.points_against ?? 0}</td>
                        <td style={{ padding:'11px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-muted)' }}>{row.games_played ?? 0}</td>
                        <td style={{ padding:'11px 14px' }}>
                          <FavButton teamId={row.team_id} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {poolRows.length > 0 && (
              <div style={{ padding:'8px 18px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
                <ChevronRight size={11} style={{ color: brandColor }} />
                Top {advancesPerPool} advance to bracket
              </div>
            )}
          </div>
        )
      })}

      {lastUpdated && (
        <p style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right', marginTop:8 }}>
          Updated {lastUpdated.toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', second:'2-digit' })}
        </p>
      )}

      {tiebreakerOrder.length > 0 && (
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:12 }}>
          <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Tiebreakers: </span>
          {tiebreakerOrder.map(t => TIEBREAKER_LABELS[t] ?? t).join(' > ')}
        </p>
      )}
    </div>
  )
}

function FavButton({ teamId }) {
  const [faved, setFaved] = useState(isFavorite(teamId))
  return (
    <button onClick={e => { e.preventDefault(); setFaved(toggleFavorite(teamId).includes(teamId)) }}
      style={{ padding:4, borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color: faved ? '#f87171' : 'var(--text-muted)' }}>
      <Heart size={12} fill={faved ? 'currentColor' : 'none'} />
    </button>
  )
}

const TIEBREAKER_LABELS = {
  head_to_head:'Head-to-head', point_diff:'Point diff',
  points_scored:'Points scored', points_against:'Points against',
  sotg:'SOTG', director:'Director',
}
