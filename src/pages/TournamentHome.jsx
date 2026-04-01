import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronRight, MapPin, Calendar, ChevronLeft, Users, Clock, Trophy } from 'lucide-react'

export function TournamentHome() {
  const { slug }    = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const [tournament, setTournament]           = useState(null)
  const [divisions, setDivisions]             = useState([])
  const [liveMatches, setLiveMatches]         = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [standings, setStandings]             = useState([])
  const [pools, setPools]                     = useState([])
  const [loading, setLoading]                 = useState(true)
  const [notFound, setNotFound]               = useState(false)
  const [activeTab, setActiveTab]             = useState('overview')

  useEffect(() => {
    async function load() {
      try {
        const { data: t, error } = await supabase
          .from('tournaments')
          .select('*, sport_template:sport_templates(slug, display_name), divisions(*)')
          .eq('slug', slug).is('deleted_at', null).single()
        if (error || !t) { setNotFound(true); return }
        setTournament(t)
        setDivisions(t.divisions ?? [])

        const { data: live } = await supabase.from('matches')
          .select('id, score_a, score_b, status, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), venue:venues(name, short_name), time_slot:time_slots(scheduled_start)')
          .eq('tournament_id', t.id).eq('status', 'in_progress').order('time_slot(scheduled_start)')
        setLiveMatches(live ?? [])

        const { data: upcoming } = await supabase.from('matches')
          .select('id, status, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), venue:venues(name, short_name), time_slot:time_slots(scheduled_start), pool:pools(name)')
          .eq('tournament_id', t.id).eq('status', 'scheduled').order('time_slot(scheduled_start)').limit(8)
        setUpcomingMatches(upcoming ?? [])

        // Load standings for all divisions
        if (t.divisions?.length > 0) {
          const divIds = t.divisions.map(d => d.id)
          const { data: st } = await supabase.from('pool_standings_display')
            .select('*').in('division_id', divIds).order('pool_id').order('rank')
          setStandings(st ?? [])
          const { data: poolData } = await supabase.from('pools')
            .select('id, name, division_id').in('division_id', divIds).order('sort_order')
          setPools(poolData ?? [])
        }
      } catch (err) {
        console.error('TournamentHome error:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!tournament) return
    const channel = supabase.channel('tournament-home-' + tournament.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'tournament_id=eq.' + tournament.id }, () => {
        supabase.from('matches').select('id, score_a, score_b, status, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), venue:venues(name, short_name)')
          .eq('tournament_id', tournament.id).eq('status', 'in_progress')
          .then(({ data }) => setLiveMatches(data ?? []))
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (notFound) return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'64px 20px', textAlign:'center', color:'var(--text-muted)' }}>
      <p style={{ fontSize:18, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Tournament not found</p>
      <Link to="/tournaments" className="btn btn-secondary btn-sm">Browse tournaments</Link>
    </div>
  )

  const color      = tournament.primary_color ?? '#8a8a9a'
  const initial    = (tournament.name ?? '?')[0].toUpperCase()
  const isLive     = tournament.status === 'live'
  const isUpcoming = tournament.status === 'published'
  const hasRules   = !!(tournament.rules_text)

  const formatDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-CA', { month:'short', day:'numeric', year:'numeric' }) : ''

  const TABS = [
    ['overview', 'Overview'],
    ['schedule', 'Schedule', '/t/' + slug + '/schedule'],
    ['standings', 'Standings'],
    ['bracket', 'Bracket'],
    ...(hasRules ? [['rules', 'Rules']] : []),
  ]

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)' }}>
      {/* Hero */}
      <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 20px 0' }}>
          <Link to="/tournaments" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-muted)', textDecoration:'none', marginBottom:16 }}
            className="hover:text-[var(--text-secondary)]">
            <ChevronLeft size={13} /> All tournaments
          </Link>

          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:20 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', lineHeight:1.1 }}>{tournament.name}</h1>
                {isLive && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'3px 9px', borderRadius:20 }}>
                    <span className="live-dot" /> Live
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:16, fontSize:13, color:'var(--text-muted)', flexWrap:'wrap' }}>
                {tournament.venue_name && <span style={{ display:'flex', alignItems:'center', gap:4 }}><MapPin size={12} /> {tournament.venue_name}</span>}
                {tournament.start_date && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Calendar size={12} /> {formatDate(tournament.start_date)}</span>}
                {divisions.length > 0 && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Users size={12} /> {divisions.length} division{divisions.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div style={{ width:48, height:48, borderRadius:12, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initial}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0, marginTop:4, borderTop:'1px solid var(--border)', overflowX:'auto' }}>
            {TABS.map(([tab, label, href]) => (
              <button key={tab} onClick={() => href ? navigate(href) : setActiveTab(tab)}
                style={{ padding:'10px 16px', fontSize:13, fontWeight:500, fontFamily:'inherit', background:'transparent', border:'none', cursor:'pointer', whiteSpace:'nowrap',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', transition:'color 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 20px 80px' }}>

        {/* Staff entry */}
        {user && (isLive || isUpcoming) && (
          <Link to={'/t/' + slug + '/gameday'}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', background:'var(--accent-dim)', border:'1px solid rgba(232,255,71,0.15)', borderRadius:12, textDecoration:'none', marginBottom:24 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--accent)' }}>Scorekeeper / Staff entry</span>
            <ChevronRight size={15} style={{ color:'var(--accent)' }} />
          </Link>
        )}

        {/* - OVERVIEW - */}
        {activeTab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {/* Live games inline on overview */}
            {liveMatches.length > 0 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'3px 10px', borderRadius:20 }}>
                    <span className="live-dot" /> Live
                  </span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{liveMatches.length} game{liveMatches.length !== 1 ? 's' : ''} in progress</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {liveMatches.map(m => <LiveMatchCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {/* Description */}
            {tournament.description ? (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
                <h2 style={{ fontSize:13, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:12 }}>About</h2>
                <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{tournament.description}</p>
              </div>
            ) : null}

            {/* Format overview */}
            {divisions.length > 0 && (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
                <h2 style={{ fontSize:13, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:14 }}>Divisions</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {divisions.map(div => {
                    const divPools = pools.filter(p => p.division_id === div.id)
                    const divStandings = standings.filter(s => s.division_id === div.id)
                    const teamCount = [...new Set(divStandings.map(s => s.team_id))].length
                    return (
                      <div key={div.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'14px 16px', background:'var(--bg-raised)', borderRadius:12 }}>
                        <div>
                          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>{div.name}</p>
                          <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap' }}>
                            {teamCount > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Users size={11} /> {teamCount} teams</span>}
                            {divPools.length > 0 && <span>{divPools.length} pool{divPools.length !== 1 ? 's' : ''}</span>}
                            <span style={{ textTransform:'capitalize' }}>{(div.format_type ?? 'pool-bracket').replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                          <button onClick={() => setActiveTab('standings')}
                            style={{ fontSize:12, fontWeight:600, color:'#a78bfa', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>
                            Standings
                          </button>
                          <button onClick={() => setActiveTab('bracket')}
                            style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', background:'var(--bg-hover)', border:'1px solid var(--border)', padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>
                            Bracket
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Up next */}
            {upcomingMatches.length > 0 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
                    <Clock size={11} /> Up next
                  </span>
                  <button onClick={() => setActiveTab('schedule')}
                    style={{ fontSize:12, color:'var(--text-muted)', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'inherit' }}
                    className="hover:text-[var(--text-secondary)]">
                    Full schedule <ChevronRight size={12} />
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {upcomingMatches.slice(0,4).map(m => <UpcomingCard key={m.id} match={m} />)}
                </div>
              </div>
            )}

            {!tournament.description && liveMatches.length === 0 && upcomingMatches.length === 0 && divisions.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
                <Trophy size={32} style={{ margin:'0 auto 12px', opacity:0.3 }} />
                <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>
                  {tournament.status === 'archived' ? 'Tournament complete' : 'Coming soon'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* - SCHEDULE - */}
        {activeTab === 'schedule' && (
          <ScheduleRedirect slug={slug} />
        )}

        {/* - STANDINGS - */}
        {activeTab === 'standings' && (
          <StandingsTab divisions={divisions} standings={standings} pools={pools} slug={slug} advancesPerPool={2} brandColor={color} />
        )}

        {/* - BRACKET - */}
        {activeTab === 'bracket' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {divisions.map(div => (
              <div key={div.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <p style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>{div.name}</p>
                  <Link to={'/t/' + slug + '/bracket/' + div.id} className="btn btn-secondary btn-sm">
                    View bracket <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* - RULES - */}
        {activeTab === 'rules' && tournament.rules_text && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{tournament.rules_text}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveMatchCard({ match: m }) {
  const teamA = m.team_a, teamB = m.team_b
  return (
    <Link to={'/score/' + m.id} style={{ display:'block', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px', textDecoration:'none', transition:'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-mid)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:teamA?.primary_color ?? 'var(--border-mid)', flexShrink:0 }} />
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{teamA?.short_name ?? teamA?.name ?? 'TBD'}</span>
        </div>
        <div style={{ fontFamily:'DM Mono, monospace', fontSize:30, fontWeight:500, color:'var(--text-primary)', textAlign:'center', letterSpacing:'0.04em' }}>
          {m.score_a ?? 0} - {m.score_b ?? 0}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{teamB?.short_name ?? teamB?.name ?? 'TBD'}</span>
          <div style={{ width:10, height:10, borderRadius:'50%', background:teamB?.primary_color ?? 'var(--border-mid)', flexShrink:0 }} />
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>{m.venue?.short_name ?? m.venue?.name ?? ''}</span>
        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'var(--live)' }}><span className="live-dot" /> Live</span>
      </div>
    </Link>
  )
}

function UpcomingCard({ match: m }) {
  const teamA = m.team_a, teamB = m.team_b
  const time = m.time_slot?.scheduled_start
    ? new Date(m.time_slot.scheduled_start).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
    : 'TBD'
  return (
    <Link to={'/score/' + m.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, textDecoration:'none', transition:'border-color 0.15s, background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>
      <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--text-muted)', width:48, flexShrink:0 }}>{time}</span>
      <div style={{ width:1, height:26, background:'var(--border)', flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:500, color:'var(--text-primary)' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:teamA?.primary_color ?? 'var(--border-mid)' }} />
          {teamA?.short_name ?? teamA?.name ?? 'TBD'}
          <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>vs</span>
          <div style={{ width:8, height:8, borderRadius:'50%', background:teamB?.primary_color ?? 'var(--border-mid)' }} />
          {teamB?.short_name ?? teamB?.name ?? 'TBD'}
        </div>
        {m.pool && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{m.pool.name}</div>}
      </div>
      {m.venue && <span style={{ fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>{m.venue.short_name ?? m.venue.name}</span>}
      <ChevronRight size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
    </Link>
  )
}

function ScheduleRedirect({ slug }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px' }}>
      <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:16 }}>
        View the full schedule with live scores, filters, and game results.
      </p>
      <Link to={'/t/' + slug + '/schedule'}
        className="btn btn-primary"
        style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        Open full schedule <ChevronRight size={14} />
      </Link>
    </div>
  )
}

function StandingsTab({ divisions, standings, pools, slug, advancesPerPool, brandColor }) {
  if (divisions.length === 0) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
      <p style={{ fontSize:14, color:'var(--text-secondary)' }}>No divisions yet</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {divisions.map(div => {
        const divPools = pools.filter(p => p.division_id === div.id)
        return (
          <div key={div.id}>
            {divisions.length > 1 && (
              <h2 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:10, letterSpacing:'-0.01em' }}>{div.name}</h2>
            )}
            {divPools.map(pool => {
              const rows = standings.filter(s => s.pool_id === pool.id)
              return (
                <div key={pool.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:10 }}>
                  <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', background: brandColor + '12' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{pool.name}</span>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['#','Team','W','L','+/-','GP'].map((h, i) => (
                          <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', textAlign: i < 2 ? 'left' : 'center' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0
                        ? <tr><td colSpan={6} style={{ padding:'20px', textAlign:'center', fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>No results yet</td></tr>
                        : rows.map((row, idx) => {
                          const advances = idx < advancesPerPool
                          const diff = row.point_diff ?? 0
                          return (
                            <tr key={row.team_id} style={{ borderBottom:'1px solid rgba(42,42,50,0.5)', background: advances ? brandColor + '08' : 'transparent' }}>
                              <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Mono, monospace', textAlign:'center', width:32 }}>{idx+1}</td>
                              <td style={{ padding:'10px 14px' }}>
                                <Link to={'/t/' + slug + '/team/' + row.team_id} style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
                                  <div style={{ width:8, height:8, borderRadius:'50%', background:row.primary_color ?? 'var(--border-mid)', flexShrink:0 }} />
                                  <span style={{ fontSize:14, fontWeight: advances ? 600 : 400, color:'var(--text-primary)' }}>{row.team_short_name ?? row.team_name}</span>
                                </Link>
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{row.wins ?? 0}</td>
                              <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-secondary)' }}>{row.losses ?? 0}</td>
                              <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:600, color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'var(--text-muted)' }}>
                                {diff > 0 ? '+' + diff : diff}
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--text-muted)' }}>{row.games_played ?? 0}</td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                  {rows.length > 0 && (
                    <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)' }}>
                      Top {advancesPerPool} advance to bracket
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
