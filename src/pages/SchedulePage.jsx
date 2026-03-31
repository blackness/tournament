import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, MapPin, Clock, ChevronRight } from 'lucide-react'

export function SchedulePage() {
  const { slug }                    = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [venues, setVenues]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [groupBy, setGroupBy]       = useState('time')
  const [filterVenue, setFilterVenue]       = useState('all')
  const [filterDivision, setFilterDivision] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournaments').select('id, name, slug, primary_color, start_date, end_date').eq('slug', slug).is('deleted_at', null).single()
      if (!t) { setLoading(false); return }
      setTournament(t)
      const { data: m } = await supabase.from('matches').select(`
        id, status, score_a, score_b, round_label, phase,
        team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
        team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
        venue:venues(id, name, short_name),
        division:divisions(id, name),
        pool:pools(id, name),
        time_slot:time_slots(scheduled_start, scheduled_end)
      `).eq('tournament_id', t.id).neq('status', 'cancelled').order('time_slot(scheduled_start)')
      setMatches(m ?? [])
      const { data: v } = await supabase.from('venues').select('id, name, short_name').eq('tournament_id', t.id).order('sort_order')
      setVenues(v ?? [])
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!tournament) return
    const channel = supabase.channel('schedule-' + tournament.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'tournament_id=eq.' + tournament.id }, payload => {
        setMatches(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (!tournament) return <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-muted)' }}>Tournament not found</div>

  let filtered = matches
  if (filterVenue !== 'all') filtered = filtered.filter(m => m.venue?.id === filterVenue)
  if (filterDivision !== 'all') filtered = filtered.filter(m => m.division?.id === filterDivision)
  const divisions = [...new Map(matches.map(m => m.division).filter(Boolean).map(d => [d.id, d])).values()]
  const groups = groupMatches(filtered, groupBy)

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'32px 20px 80px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <Link to={'/t/' + slug} style={{ color:'var(--text-muted)' }}><ChevronLeft size={20} /></Link>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>Schedule</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>{tournament.name}</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
        <div style={{ display:'flex', background:'var(--bg-raised)', borderRadius:10, padding:3, gap:2 }}>
          {[['time','Time'],['field','Field'],['division','Division']].map(([val, label]) => (
            <button key={val} onClick={() => setGroupBy(val)}
              style={{ flex:1, padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:600, fontFamily:'inherit', border:'none', cursor:'pointer', transition:'all 0.15s',
                background: groupBy === val ? 'var(--bg-surface)' : 'transparent',
                color: groupBy === val ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>

        {(venues.length > 1 || divisions.length > 1) && (
          <div style={{ display:'flex', gap:8 }}>
            {venues.length > 1 && (
              <select value={filterVenue} onChange={e => setFilterVenue(e.target.value)} className="field-input" style={{ flex:1, fontSize:13 }}>
                <option value="all">All fields</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.short_name ?? v.name}</option>)}
              </select>
            )}
            {divisions.length > 1 && (
              <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="field-input" style={{ flex:1, fontSize:13 }}>
                <option value="all">All divisions</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
        )}

        <p style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Schedule */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <Clock size={32} style={{ margin:'0 auto 12px', opacity:0.3 }} />
          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>No games scheduled</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {groups.map(group => (
            <div key={group.key}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>
                  {group.label}
                </span>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {group.matches.map(m => <MatchCard key={m.id} match={m} showVenue={groupBy !== 'field'} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match: m, showVenue }) {
  const isLive = m.status === 'in_progress'
  const isDone = m.status === 'complete' || m.status === 'forfeit'
  const teamA  = m.team_a
  const teamB  = m.team_b

  return (
    <Link to={'/score/' + m.id}
      style={{ display:'block', padding:14, background:'var(--bg-surface)', border:`1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius:12, textDecoration:'none', transition:'border-color 0.15s, background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = isLive ? 'rgba(34,197,94,0.5)' : 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isLive ? 'rgba(34,197,94,0.3)' : 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>

      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        {m.time_slot?.scheduled_start && (
          <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>
            {formatTime(m.time_slot.scheduled_start)}
          </span>
        )}
        {isLive && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'2px 8px', borderRadius:20 }}>
            <span className="live-dot" /> LIVE
          </span>
        )}
        {isDone && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Final</span>}
        {showVenue && m.venue && (
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}>
            <MapPin size={10} /> {m.venue.short_name ?? m.venue.name}
          </span>
        )}
        {m.pool && !showVenue && (
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>{m.pool.name}</span>
        )}
      </div>

      {/* Teams */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <TeamRow team={teamA} score={isDone || isLive ? m.score_a : null} isWinner={isDone && m.score_a > m.score_b} />
        <TeamRow team={teamB} score={isDone || isLive ? m.score_b : null} isWinner={isDone && m.score_b > m.score_a} />
      </div>
    </Link>
  )
}

function TeamRow({ team, score, isWinner }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background:team?.primary_color ?? 'var(--border-mid)' }} />
      <span style={{ fontSize:14, fontWeight: isWinner ? 600 : 400, color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {team?.short_name ?? team?.name ?? 'TBD'}
      </span>
      {score !== null && score !== undefined && (
        <span style={{ fontFamily:'DM Mono, monospace', fontSize:15, fontWeight:700, color: isWinner ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink:0 }}>
          {score}
        </span>
      )}
    </div>
  )
}

function groupMatches(matches, groupBy) {
  const groups = {}
  for (const m of matches) {
    let key, label
    if (groupBy === 'time') {
      const start = m.time_slot?.scheduled_start
      if (start) { const d = new Date(start); key = d.toISOString().slice(0,13); label = formatGroupTime(d) }
      else { key = 'unscheduled'; label = 'Unscheduled' }
    } else if (groupBy === 'field') {
      key = m.venue?.id ?? 'no-field'; label = m.venue?.name ?? 'No field'
    } else {
      key = m.division?.id ?? 'no-div'; label = m.division?.name ?? 'No division'
    }
    if (!groups[key]) groups[key] = { key, label, matches: [] }
    groups[key].matches.push(m)
  }
  return Object.values(groups).sort((a, b) => {
    if (groupBy === 'time') { if (a.key === 'unscheduled') return 1; if (b.key === 'unscheduled') return -1; return a.key.localeCompare(b.key) }
    return a.label.localeCompare(b.label)
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
}
function formatGroupTime(d) {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
  const date = d.toLocaleDateString('en-CA', { weekday:'short', month:'short', day:'numeric' })
  return isToday ? time : date + ' - ' + time
}
