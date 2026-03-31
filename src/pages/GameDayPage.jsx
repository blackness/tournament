import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, Play, Clock, MapPin, CheckCircle } from 'lucide-react'

export function GameDayPage() {
  const { slug }                    = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [loading, setLoading]       = useState(true)

  async function loadMatches(tournamentId) {
    const { data } = await supabase.from('matches').select(`
      id, status, score_a, score_b, round_label,
      team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
      team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
      venue:venues(id, name, short_name),
      time_slot:time_slots(scheduled_start),
      division:divisions(name), pool:pools(name)
    `).eq('tournament_id', tournamentId).in('status', ['scheduled','in_progress']).order('time_slot(scheduled_start)')
    setMatches(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournaments').select('id, name, slug, primary_color, status').eq('slug', slug).single()
      if (!t) { setLoading(false); return }
      setTournament(t)
      await loadMatches(t.id)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!tournament) return
    const channel = supabase.channel('gameday-' + tournament.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'tournament_id=eq.' + tournament.id }, () => loadMatches(tournament.id))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  if (loading) return <PageLoader />
  if (!tournament) return <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-muted)' }}>Tournament not found</div>

  const live     = matches.filter(m => m.status === 'in_progress')
  const upcoming = matches.filter(m => m.status === 'scheduled')

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'32px 20px 80px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <Link to={'/t/' + slug} style={{ color:'var(--text-muted)' }}><ChevronLeft size={20} /></Link>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>Scorekeeper</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>{tournament.name}</p>
        </div>
      </div>

      <div style={{ padding:'12px 16px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, fontSize:13, color:'#a5b4fc', marginBottom:24 }}>
        Select a game to open the scorekeeper console.
      </div>

      {live.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'3px 10px', borderRadius:20 }}>
              <span className="live-dot" /> Live
            </span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{live.length} in progress</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {live.map(m => <GameCard key={m.id} match={m} isLive />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div style={{ marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
              <Clock size={11} /> Upcoming ({upcoming.length})
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcoming.map(m => <GameCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {live.length === 0 && upcoming.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <CheckCircle size={32} style={{ margin:'0 auto 12px', opacity:0.3 }} />
          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>All games complete</p>
        </div>
      )}
    </div>
  )
}

function GameCard({ match: m, isLive }) {
  const teamA  = m.team_a
  const teamB  = m.team_b
  const hasTBD = !teamA?.id || !teamB?.id
  const time   = m.time_slot?.scheduled_start
    ? new Date(m.time_slot.scheduled_start).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true })
    : null

  return (
    <div style={{ background:'var(--bg-surface)', border:`1px solid ${isLive ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, fontSize:12, color:'var(--text-muted)' }}>
          {time && <span style={{ fontFamily:'DM Mono, monospace' }}>{time}</span>}
          {m.venue && <span style={{ display:'flex', alignItems:'center', gap:3 }}><MapPin size={10} /> {m.venue.short_name ?? m.venue.name}</span>}
          {m.pool && <span>{m.pool.name}</span>}
          {isLive && (
            <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'var(--live)' }}>
              <span className="live-dot" /> LIVE
            </span>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <TeamPill team={teamA} />
          {isLive ? (
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:20, fontWeight:500, color:'var(--text-primary)', flexShrink:0 }}>
              {m.score_a ?? 0} - {m.score_b ?? 0}
            </span>
          ) : (
            <span style={{ fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>vs</span>
          )}
          <TeamPill team={teamB} />
        </div>
      </div>

      <Link to={'/scorekeeper/' + m.id}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 16px', fontSize:13, fontWeight:700, fontFamily:'inherit', cursor:'pointer', textDecoration:'none', borderTop:'1px solid var(--border)', transition:'background 0.15s',
          background: isLive ? 'rgba(34,197,94,0.1)' : hasTBD ? 'rgba(234,179,8,0.08)' : 'var(--bg-raised)',
          color: isLive ? 'var(--live)' : hasTBD ? '#fde047' : 'var(--text-primary)' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
        <Play size={14} fill="currentColor" />
        {isLive ? 'Continue scoring' : hasTBD ? 'Teams TBD' : 'Start scoring'}
      </Link>
    </div>
  )
}

function TeamPill({ team }) {
  if (!team?.id) return <span style={{ fontSize:13, color:'#fde047', fontStyle:'italic', flex:1 }}>TBD</span>
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0 }}>
      <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background:team.primary_color ?? 'var(--border-mid)' }} />
      <span style={{ fontSize:14, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {team.short_name ?? team.name}
      </span>
    </div>
  )
}
