import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, ChevronRight, Heart, BarChart2, Trophy } from 'lucide-react'

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem('fav_teams') ?? '[]') } catch { return [] }
}
export function toggleFavorite(teamId) {
  const favs = getFavorites()
  const next = favs.includes(teamId) ? favs.filter(id => id !== teamId) : [...favs, teamId]
  localStorage.setItem('fav_teams', JSON.stringify(next))
  return next
}
export function isFavorite(teamId) { return getFavorites().includes(teamId) }

export function TeamPage() {
  const { slug, teamId }        = useParams()
  const [team, setTeam]         = useState(null)
  const [matches, setMatches]   = useState([])
  const [players, setPlayers]   = useState([])
  const [events, setEvents]     = useState([])
  const [divTeams, setDivTeams] = useState([])
  const [loading, setLoading]   = useState(true)
  const [faved, setFaved]       = useState(isFavorite(teamId))
  const [activeTab, setActiveTab] = useState('schedule')

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournament_teams')
        .select('id, name, short_name, primary_color, club_name, seed, head_coach_name, head_coach_email, division:divisions(id, name, tournament:tournaments(id, name, slug, primary_color)), pool:pools(id, name)')
        .eq('id', teamId).single()
      if (!t) { setLoading(false); return }
      setTeam(t)

      const { data: m } = await supabase.from('matches')
        .select('id, status, score_a, score_b, winner_id, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), venue:venues(name, short_name), time_slot:time_slots(scheduled_start), division:divisions(name), pool:pools(name)')
        .or('team_a_id.eq.' + teamId + ',team_b_id.eq.' + teamId).neq('status','cancelled').order('time_slot(scheduled_start)')
      setMatches(m ?? [])

      const { data: p } = await supabase.from('tournament_players').select('id, name, number, is_eligible').eq('tournament_team_id', teamId).order('number')
      setPlayers(p ?? [])

      const matchIds = (m ?? []).map(mx => mx.id)
      if (matchIds.length > 0) {
        const { data: ev } = await supabase.from('game_events').select('id, stat_id, player_id, secondary_player_id, team_id, match_id').in('match_id', matchIds).eq('team_id', teamId).is('deleted_at', null)
        setEvents(ev ?? [])
      }

      const { data: dt } = await supabase.from('tournament_teams').select('id, name, short_name, primary_color').eq('division_id', t.division?.id).neq('id', teamId).order('name')
      setDivTeams(dt ?? [])
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) return <PageLoader />
  if (!team) return <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-muted)' }}>Team not found</div>

  const tournament = team.division?.tournament
  const wins   = matches.filter(m => m.winner_id === teamId).length
  const losses = matches.filter(m => m.winner_id && m.winner_id !== teamId).length
  const played = matches.filter(m => ['complete','forfeit'].includes(m.status)).length
  const playerStats = buildPlayerStats(events, players)

  const TABS = [['schedule','Schedule'],['roster','Roster'],['stats','Stats']]

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'32px 20px 80px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        {tournament && <Link to={'/t/' + tournament.slug} style={{ color:'var(--text-muted)', flexShrink:0 }}><ChevronLeft size={20} /></Link>}
        <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
          <div style={{ width:46, height:46, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff', background:team.primary_color ?? '#6b6b80' }}>
            {(team.short_name ?? team.name)[0]}
          </div>
          <div style={{ minWidth:0 }}>
            <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.025em', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{team.name}</h1>
            <div style={{ display:'flex', gap:8, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap' }}>
              {team.division && <span>{team.division.name}</span>}
              {team.pool && <span>- {team.pool.name}</span>}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button onClick={() => setFaved(toggleFavorite(teamId).includes(teamId))}
            style={{ padding:8, borderRadius:9, background:'transparent', border:'1px solid var(--border)', cursor:'pointer', color: faved ? '#f87171' : 'var(--text-muted)', transition:'all 0.15s' }}>
            <Heart size={16} fill={faved ? 'currentColor' : 'none'} />
          </button>
          {divTeams.length > 0 && (
            <div style={{ position:'relative' }} className="group">
              <button style={{ padding:8, borderRadius:9, background:'transparent', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)' }}>
                <BarChart2 size={16} />
              </button>
              <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', width:200, background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:20, overflow:'hidden', display:'none' }} className="group-hover:block group-focus-within:block">
                <p style={{ padding:'10px 14px 6px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>Compare with</p>
                {divTeams.slice(0,8).map(t => (
                  <Link key={t.id} to={'/t/' + tournament?.slug + '/compare/' + teamId + '/' + t.id}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}
                    className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                    <div style={{ width:8, height:8, borderRadius:'50%', background:t.primary_color ?? 'var(--border-mid)' }} />
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
          {[['Wins', wins, '#4ade80'], ['Losses', losses, '#f87171'], ['Played', played, 'var(--text-primary)']].map(([label, val, color]) => (
            <div key={label} style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:12, padding:'14px', textAlign:'center' }}>
              <p style={{ fontFamily:'DM Mono, monospace', fontSize:24, fontWeight:500, color, lineHeight:1 }}>{val}</p>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginTop:5 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', background:'var(--bg-raised)', borderRadius:10, padding:3, gap:2, marginBottom:20 }}>
        {TABS.map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex:1, padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:600, fontFamily:'inherit', border:'none', cursor:'pointer', transition:'all 0.15s',
              background: activeTab === tab ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Schedule */}
      {activeTab === 'schedule' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {matches.length === 0
            ? <p style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'var(--text-muted)' }}>No games scheduled</p>
            : matches.map(m => <MatchCard key={m.id} match={m} teamId={teamId} />)
          }
        </div>
      )}

      {/* Roster */}
      {activeTab === 'roster' && (
        <div>
          {players.length === 0 ? (
            <p style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'var(--text-muted)' }}>No roster added</p>
          ) : (
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              {players.map((p, i) => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderTop: i > 0 ? '1px solid rgba(42,42,50,0.5)' : 'none' }}>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--text-muted)', width:24, textAlign:'right', flexShrink:0 }}>{p.number ?? '-'}</span>
                  <span style={{ fontSize:14, color:'var(--text-primary)', flex:1 }}>{p.name}</span>
                  {!p.is_eligible && <span style={{ fontSize:10, fontWeight:700, color:'#f87171', background:'rgba(239,68,68,0.1)', padding:'2px 8px', borderRadius:20 }}>Ineligible</span>}
                </div>
              ))}
            </div>
          )}
          {team.head_coach_name && <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:12 }}><span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Coach:</span> {team.head_coach_name}</p>}
        </div>
      )}

      {/* Stats */}
      {activeTab === 'stats' && <PlayerStatsTable playerStats={playerStats} players={players} />}
    </div>
  )
}

function MatchCard({ match: m, teamId }) {
  const isTeamA  = m.team_a?.id === teamId
  const opponent = isTeamA ? m.team_b : m.team_a
  const teamScore = isTeamA ? m.score_a : m.score_b
  const oppScore  = isTeamA ? m.score_b : m.score_a
  const isDone    = ['complete','forfeit'].includes(m.status)
  const isLive    = m.status === 'in_progress'
  const won       = isDone && m.winner_id === teamId

  return (
    <Link to={'/score/' + m.id}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg-surface)', border:`1px solid ${isLive ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`, borderRadius:12, textDecoration:'none', transition:'border-color 0.15s, background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isLive ? 'rgba(34,197,94,0.25)' : 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>
      <div style={{ width:48, textAlign:'center', flexShrink:0 }}>
        {m.time_slot?.scheduled_start
          ? <p style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'var(--text-muted)' }}>{formatTime(m.time_slot.scheduled_start)}</p>
          : <p style={{ fontSize:11, color:'var(--text-muted)' }}>TBD</p>
        }
        {isLive && <p style={{ fontSize:10, fontWeight:700, color:'var(--live)' }}>LIVE</p>}
        {isDone && <p style={{ fontSize:11, fontWeight:700, color: won ? '#4ade80' : '#f87171' }}>{won ? 'W' : 'L'}</p>}
      </div>
      <div style={{ width:1, height:28, background:'var(--border)', flexShrink:0 }} />
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:opponent?.primary_color ?? 'var(--border-mid)' }} />
        <span style={{ fontSize:14, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{opponent?.name ?? 'TBD'}</span>
      </div>
      {(isDone || isLive) && teamScore !== null && (
        <span style={{ fontFamily:'DM Mono, monospace', fontSize:14, fontWeight:700, color: won ? '#4ade80' : 'var(--text-muted)', flexShrink:0 }}>
          {teamScore}-{oppScore}
        </span>
      )}
      <ChevronRight size={13} style={{ color:'var(--text-muted)', flexShrink:0 }} />
    </Link>
  )
}

function PlayerStatsTable({ playerStats, players }) {
  const [sortBy, setSortBy] = useState('goal')
  const STAT_COLS = [
    { key:'goal', label:'G', title:'Goals' }, { key:'assist', label:'A', title:'Assists' },
    { key:'callahan', label:'CAL', title:'Callahans' }, { key:'layout_d', label:'LD', title:'Layout D' },
    { key:'d_block', label:'D', title:'D Blocks' }, { key:'turnover', label:'T', title:'Turnovers' },
  ]
  const rows = players.map(p => ({ player:p, stats:playerStats[p.id] ?? {} }))
    .filter(r => Object.keys(r.stats).length > 0)
    .sort((a, b) => (b.stats[sortBy] ?? 0) - (a.stats[sortBy] ?? 0))

  if (rows.length === 0) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
      <Trophy size={28} style={{ margin:'0 auto 12px', opacity:0.3 }} />
      <p style={{ fontSize:13, color:'var(--text-secondary)' }}>No stats recorded yet</p>
    </div>
  )

  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              <th style={{ padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', textAlign:'left', width:24 }}>#</th>
              <th style={{ padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', textAlign:'left' }}>Player</th>
              {STAT_COLS.map(col => (
                <th key={col.key} onClick={() => setSortBy(col.key)} title={col.title}
                  style={{ padding:'10px 10px', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', textAlign:'center', color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)', background: sortBy === col.key ? 'var(--accent-dim)' : 'transparent', width:36 }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player: p, stats }) => (
              <tr key={p.id} style={{ borderBottom:'1px solid rgba(42,42,50,0.5)' }}>
                <td style={{ padding:'11px 14px', fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--text-muted)' }}>{p.number ?? '-'}</td>
                <td style={{ padding:'11px 14px', fontSize:14, fontWeight:500, color:'var(--text-primary)' }}>{p.name}</td>
                {STAT_COLS.map(col => (
                  <td key={col.key} style={{ padding:'11px 10px', textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:13,
                    color: sortBy === col.key ? 'var(--accent)' : stats[col.key] ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: sortBy === col.key ? 700 : 400 }}>
                    {stats[col.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ padding:'8px 14px', fontSize:11, color:'var(--text-muted)', borderTop:'1px solid var(--border)' }}>Click column to sort</p>
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
    if (ev.secondary_player_id) {
      if (!stats[ev.secondary_player_id]) stats[ev.secondary_player_id] = {}
      stats[ev.secondary_player_id]['assist'] = (stats[ev.secondary_player_id]['assist'] ?? 0) + 1
    }
  }
  return stats
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
}
