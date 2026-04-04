import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, MapPin, ChevronRight } from 'lucide-react'

const TABS = [
  { key:'live',      label:'Live' },
  { key:'unplayed',  label:'Unplayed' },
  { key:'finished',  label:'Finished' },
  { key:'all',       label:'All' },
]

export function SchedulePage() {
  const { slug }                    = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [venues, setVenues]         = useState([])
  const [divisions, setDivisions]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('unplayed')
  const [filterVenue, setFilterVenue]       = useState('all')
  const [filterDivision, setFilterDivision] = useState('all')
  const [search, setSearch]                 = useState('')

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournaments')
        .select('id, name, slug, primary_color, status')
        .eq('slug', slug).is('deleted_at', null).single()
      if (!t) { setLoading(false); return }
      setTournament(t)

      const { data: m } = await supabase.from('matches').select(`
        id, status, score_a, score_b, winner_id, round_label,
        team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
        team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
        venue:venues(id, name, short_name),
        division:divisions(id, name),
        pool:pools(id, name),
        time_slot:time_slots(scheduled_start)
      `).eq('tournament_id', t.id).neq('status', 'cancelled').order('time_slot(scheduled_start)')
      setMatches(m ?? [])

      // Smart default tab: live > unplayed > finished
      const liveCount     = (m ?? []).filter(x => x.status === 'in_progress').length
      const unplayedCount = (m ?? []).filter(x => x.status === 'scheduled').length
      if (liveCount > 0)          setTab('live')
      else if (unplayedCount > 0) setTab('unplayed')
      else                        setTab('finished')

      const { data: v } = await supabase.from('venues').select('id, name, short_name').eq('tournament_id', t.id).order('sort_order')
      setVenues(v ?? [])

      const { data: d } = await supabase.from('divisions').select('id, name').eq('tournament_id', t.id)
      setDivisions(d ?? [])

      setLoading(false)
    }
    load()
  }, [slug])

  // Realtime score updates
  useEffect(() => {
    if (!tournament) return
    const channel = supabase.channel('schedule-' + tournament.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'tournament_id=eq.' + tournament.id }, payload => {
        setMatches(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (!tournament) return <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-muted)' }}>Tournament not found</div>

  // Filter by tab
  const byTab = {
    live:     matches.filter(m => m.status === 'in_progress'),
    unplayed: matches.filter(m => m.status === 'scheduled'),
    finished: matches.filter(m => ['complete','forfeit'].includes(m.status)),
    all:      matches,
  }

  // Apply venue/division/search filters
  let filtered = byTab[tab] ?? []
  if (filterVenue !== 'all')    filtered = filtered.filter(m => m.venue?.id === filterVenue)
  if (filterDivision !== 'all') filtered = filtered.filter(m => m.division?.id === filterDivision)
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter(m =>
      m.team_a?.name?.toLowerCase().includes(q) ||
      m.team_b?.name?.toLowerCase().includes(q) ||
      m.team_a?.short_name?.toLowerCase().includes(q) ||
      m.team_b?.short_name?.toLowerCase().includes(q)
    )
  }

  // Group by time for unplayed/all, reverse for finished
  const groups = groupByTime(filtered, tab === 'finished')

  const counts = {
    live:     byTab.live.length,
    unplayed: byTab.unplayed.length,
    finished: byTab.finished.length,
    all:      byTab.all.length,
  }

  const color = tournament.primary_color ?? '#8b5cf6'

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:700, margin:'0 auto', padding:'20px 20px 0' }}>
          <Link to={'/t/' + slug} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-muted)', textDecoration:'none', marginBottom:12 }}
            className="hover:text-[var(--text-secondary)]">
            <ChevronLeft size={13} /> {tournament.name}
          </Link>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', marginBottom:16 }}>Schedule</h1>

          {/* Status tabs */}
          <div style={{ display:'flex', gap:0, borderTop:'1px solid var(--border)', overflowX:'auto' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', fontSize:13, fontWeight:500, fontFamily:'inherit', background:'transparent', border:'none', cursor:'pointer', whiteSpace:'nowrap',
                  borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)', transition:'color 0.15s' }}>
                {t.key === 'live' && counts.live > 0 && <span className="live-dot" />}
                {t.label}
                <span style={{ fontSize:11, fontWeight:700, padding:'1px 6px', borderRadius:20,
                  background: tab === t.key ? 'var(--accent-dim)' : 'var(--bg-hover)',
                  color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ maxWidth:700, margin:'0 auto', padding:'16px 20px' }}>
        {(venues.length > 1 || divisions.length > 1) && (
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            {divisions.length > 1 && (
              <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)}
                className="field-input" style={{ flex:1, minWidth:120, fontSize:13 }}>
                <option value="all">All divisions</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {venues.length > 1 && (
              <select value={filterVenue} onChange={e => setFilterVenue(e.target.value)}
                className="field-input" style={{ flex:1, minWidth:120, fontSize:13 }}>
                <option value="all">All fields</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.short_name ?? v.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom:12 }}>
          <input
            type="text"
            placeholder="Search by team name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input"
            style={{ width:'100%', fontSize:14 }}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
            <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>
              {tab === 'live' ? 'No games live right now' :
               tab === 'unplayed' ? 'No upcoming games' :
               tab === 'finished' ? 'No completed games yet' : 'No games'}
            </p>
            {tab === 'live' && counts.unplayed > 0 && (
              <button onClick={() => setTab('unplayed')}
                style={{ fontSize:13, color:'var(--accent)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', marginTop:8 }}>
                View upcoming games
              </button>
            )}
          </div>
        )}

        {/* Game groups */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {groups.map(group => (
            <div key={group.key}>
              {/* Time header */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', flexShrink:0 }}>
                  {group.label}
                </span>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>
                  {group.matches.length} game{group.matches.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {group.matches.map(m => <GameCard key={m.id} match={m} tab={tab} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GameCard({ match: m, tab }) {
  const isLive = m.status === 'in_progress'
  const isDone = ['complete','forfeit'].includes(m.status)
  const teamA  = m.team_a
  const teamB  = m.team_b

  return (
    <Link to={'/score/' + m.id}
      style={{ display:'block', background:'var(--bg-surface)', border:`1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius:14, overflow:'hidden', textDecoration:'none', transition:'border-color 0.15s, background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = isLive ? 'rgba(34,197,94,0.5)' : 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isLive ? 'rgba(34,197,94,0.3)' : 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>

      {/* Live accent bar */}
      {isLive && <div style={{ height:2, background:'var(--live)' }} />}

      <div style={{ padding:'14px 16px' }}>
        {/* Meta row */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
          {m.time_slot?.scheduled_start && (
            <span style={{ fontFamily:'DM Mono, monospace', color:'var(--text-muted)', flexShrink:0 }}>
              {formatTime(m.time_slot.scheduled_start)}
            </span>
          )}
          {m.venue && (
            <span style={{ display:'flex', alignItems:'center', gap:3, color:'var(--text-muted)' }}>
              <MapPin size={10} /> {m.venue.short_name ?? m.venue.name}
            </span>
          )}
          {m.pool && <span style={{ color:'var(--text-muted)' }}>{m.pool.name}</span>}
          <div style={{ flex:1 }} />
          {isLive && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)' }}>
              <span className="live-dot" /> Live
            </span>
          )}
          {isDone && <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Final</span>}
        </div>

        {/* Teams + scores */}
        {isDone || isLive ? (
          // Score layout
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:12 }}>
            <TeamScore team={teamA} score={m.score_a} winner={isDone && m.winner_id === teamA?.id} />
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'var(--text-muted)', fontWeight:400 }}> - </span>
            <TeamScore team={teamB} score={m.score_b} winner={isDone && m.winner_id === teamB?.id} right />
          </div>
        ) : (
          // Upcoming layout
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <TeamPill team={teamA} />
            <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>vs</span>
            <TeamPill team={teamB} />
            <ChevronRight size={13} style={{ color:'var(--text-muted)', flexShrink:0, marginLeft:'auto' }} />
          </div>
        )}
      </div>
    </Link>
  )
}

function TeamScore({ team, score, winner, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection: right ? 'row-reverse' : 'row' }}>
      <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background:team?.primary_color ?? 'var(--border-mid)' }} />
      <span style={{ fontSize:14, fontWeight: winner ? 700 : 400, color: winner ? 'var(--text-primary)' : 'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign: right ? 'right' : 'left' }}>
        {team?.name ?? 'TBD'}
      </span>
      <span style={{ fontFamily:'DM Mono, monospace', fontSize:20, fontWeight:700, color: winner ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink:0 }}>
        {score ?? 0}
      </span>
    </div>
  )
}

function TeamPill({ team }) {
  if (!team?.id) return <span style={{ fontSize:13, color:'var(--text-muted)', fontStyle:'italic', flex:1 }}>TBD</span>
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:team.primary_color ?? 'var(--border-mid)' }} />
      <span style={{ fontSize:14, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {team.name}
      </span>
    </div>
  )
}

function groupByTime(matches, reverse = false) {
  const groups = {}
  for (const m of matches) {
    const start = m.time_slot?.scheduled_start
    const key   = start ? new Date(start).toISOString().slice(0, 13) : 'unscheduled'
    if (!groups[key]) groups[key] = { key, label: key === 'unscheduled' ? 'Unscheduled' : formatGroupTime(new Date(start)), matches: [] }
    groups[key].matches.push(m)
  }
  return Object.values(groups).sort((a, b) => {
    if (a.key === 'unscheduled') return 1
    if (b.key === 'unscheduled') return -1
    return reverse ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
}

function formatGroupTime(d) {
  const now     = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time    = d.toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
  const date    = d.toLocaleDateString('en-CA', { weekday:'short', month:'short', day:'numeric' })
  return isToday ? time : date + ' \u00b7 ' + time
}
