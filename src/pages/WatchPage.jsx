import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft } from 'lucide-react'

const TICKER_DURATION = 5000 // ms to show new event

export function WatchPage() {
  const { matchId }               = useParams()
  const [match, setMatch]         = useState(null)
  const [events, setEvents]       = useState([])
  const [elapsed, setElapsed]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [ticker, setTicker]       = useState(null)    // { text, color } latest event
  const [tickerVisible, setTickerVisible] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false) // desktop hover drawer
  const tickerTimer               = useRef(null)
  const isMobile                  = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from('matches').select(`
        id, score_a, score_b, status, started_at, round_label,
        tournament:tournaments(id, name, slug, primary_color),
        division:divisions(name),
        team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
        team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
        venue:venues(id, name, short_name, youtube_url)
      `).eq('id', matchId).single()
      setMatch(m)

      const { data: ev } = await supabase.from('game_events').select(`
        id, stat_id, sequence, score_a_after, score_b_after,
        team:tournament_teams!team_id(id, name, short_name, primary_color),
        player:tournament_players!player_id(id, name, number)
      `).eq('match_id', matchId)
        .not('stat_id', 'in', '("game_end","period_end","game_start")')
        .order('sequence', { ascending: false })
        .limit(30)
      setEvents(ev ?? [])
      setLoading(false)
    }
    load()
  }, [matchId])

  // Game clock
  useEffect(() => {
    if (!match?.started_at || match?.status !== 'in_progress') return
    const startMs = new Date(match.started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [match?.started_at, match?.status])

  // Show ticker for new event
  function flashTicker(ev) {
    const label = { goal:'Goal', assist:'Assist', block:'Block', turnover:'Turnover', foul:'Foul' }[ev.stat_id] ?? ev.stat_id?.replace(/_/g,' ')
    const playerName = ev.player?.name ?? ev.team?.short_name ?? ''
    const scoreStr = ev.score_a_after !== null ? ` - ${ev.score_a_after}-${ev.score_b_after}` : ''
    setTicker({ text: playerName ? `${playerName} - ${label}${scoreStr}` : `${label}${scoreStr}`, color: ev.team?.primary_color ?? '#8b5cf6' })
    setTickerVisible(true)
    clearTimeout(tickerTimer.current)
    tickerTimer.current = setTimeout(() => setTickerVisible(false), TICKER_DURATION)
  }

  // Realtime
  useEffect(() => {
    if (!match) return
    const channel = supabase.channel('watch-' + matchId)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'matches', filter:'id=eq.'+matchId },
        payload => setMatch(prev => ({ ...prev, ...payload.new })))
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'game_events', filter:'match_id=eq.'+matchId },
        async payload => {
          if (['game_end','period_end','game_start'].includes(payload.new.stat_id)) return
          const { data: ev } = await supabase.from('game_events').select(`
            id, stat_id, sequence, score_a_after, score_b_after,
            team:tournament_teams!team_id(id, name, short_name, primary_color),
            player:tournament_players!player_id(id, name, number)
          `).eq('id', payload.new.id).single()
          if (ev) {
            setEvents(prev => [ev, ...prev].slice(0, 30))
            flashTicker(ev)
          }
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [match?.id])

  if (loading) return <PageLoader />
  if (!match) return <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Match not found</div>

  const isLive = match.status === 'in_progress'
  const isDone = match.status === 'complete' || match.status === 'forfeit'
  const clockStr = isLive && match.started_at
    ? String(Math.floor(elapsed/60)).padStart(2,'0') + ':' + String(elapsed%60).padStart(2,'0')
    : null

  const rawUrl = match.venue?.youtube_url
  const embedUrl = rawUrl
    ? rawUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/') + (rawUrl.includes('?') ? '&' : '?') + 'autoplay=1&rel=0'
    : null

  const scoreA = match.score_a ?? 0
  const scoreB = match.score_b ?? 0
  const teamA  = match.team_a
  const teamB  = match.team_b

  // - MOBILE LAYOUT -
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:'#000', display:'flex', flexDirection:'column' }}>
        {/* Video */}
        <div style={{ background:'#000', aspectRatio:'16/9', width:'100%', position:'relative', flexShrink:0 }}>
          {embedUrl ? (
            <iframe src={embedUrl} style={{ width:'100%', height:'100%', border:'none', display:'block', position:'absolute', inset:0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.3)', fontSize:13 }}>
              No stream available
            </div>
          )}
        </div>

        {/* Score bar */}
        <div style={{ background:'#0f0f12', padding:'14px 20px', display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
          <MobileTeamScore team={teamA} score={scoreA} />
          <div style={{ flex:1, textAlign:'center' }}>
            {clockStr
              ? <div style={{ fontFamily:'DM Mono, monospace', fontSize:22, fontWeight:600, color:'#fff', letterSpacing:'0.05em' }}>{clockStr}</div>
              : isDone ? <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em' }}>FINAL</div>
              : <div style={{ fontSize:20, color:'rgba(255,255,255,0.3)' }}>-</div>
            }
            {isLive && <div style={{ fontSize:9, fontWeight:700, color:'#22c55e', letterSpacing:'0.12em', marginTop:2 }}>LIVE</div>}
          </div>
          <MobileTeamScore team={teamB} score={scoreB} right />
        </div>

        {/* Event feed */}
        <div style={{ flex:1, background:'#0a0a0c', overflowY:'auto' }}>
          <div style={{ padding:'10px 16px 4px', display:'flex', alignItems:'center', gap:6 }}>
            {isLive && <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 1.5s infinite' }} />}
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)' }}>Live feed</span>
          </div>
          {events.filter(ev => !['game_end','period_end','game_start'].includes(ev.stat_id)).map(ev => (
            <MobileEventRow key={ev.id} event={ev} />
          ))}
          {events.length === 0 && (
            <div style={{ padding:'24px 16px', textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:13 }}>
              {isLive ? 'Waiting for first event...' : 'No events recorded'}
            </div>
          )}
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    )
  }

  // - DESKTOP LAYOUT -
  return (
    <div style={{ width:'100vw', height:'100vh', background:'#000', position:'relative', overflow:'hidden' }}>
      {/* Full screen video */}
      {embedUrl ? (
        <iframe src={embedUrl} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#0a0a0c' }}>
          <div style={{ fontSize:14, color:'rgba(255,255,255,0.25)' }}>No stream configured for this venue</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.15)' }}>Director can add a YouTube URL in Director HQ</div>
        </div>
      )}

      {/* Top-left: back link */}
      <Link to={'/score/' + matchId} style={{ position:'absolute', top:16, left:16, zIndex:30,
        display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,0.5)', textDecoration:'none', fontSize:12,
        padding:'6px 10px', borderRadius:8, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)',
        transition:'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.9)'}
        onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}>
        <ChevronLeft size={14} /> {match.tournament?.name}
      </Link>

      {/* Top-right: score overlay - always visible */}
      <div style={{ position:'absolute', top:16, right:16, zIndex:30,
        background:'rgba(0,0,0,0.55)', backdropFilter:'blur(12px)',
        borderRadius:14, padding:'12px 16px', border:'1px solid rgba(255,255,255,0.1)',
        minWidth:180 }}>
        {/* Clock */}
        <div style={{ textAlign:'center', marginBottom:10 }}>
          {clockStr
            ? <span style={{ fontFamily:'DM Mono, monospace', fontSize:18, fontWeight:600, color:'#fff', letterSpacing:'0.06em' }}>{clockStr}</span>
            : isDone
              ? <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em' }}>FINAL</span>
              : null
          }
          {isLive && <div style={{ fontSize:8, fontWeight:700, color:'#22c55e', letterSpacing:'0.12em', marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 1.5s infinite' }} /> LIVE
          </div>}
        </div>

        {/* Teams + scores */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <DesktopTeamRow team={teamA} score={scoreA} />
          <DesktopTeamRow team={teamB} score={scoreB} />
        </div>

        {/* Hover hint */}
        <div style={{ marginTop:10, fontSize:10, color:'rgba(255,255,255,0.25)', textAlign:'center', letterSpacing:'0.05em' }}>
          Hover for stats
        </div>
      </div>

      {/* Right drawer - slides in on hover */}
      <div
        onMouseEnter={() => setDrawerOpen(true)}
        onMouseLeave={() => setDrawerOpen(false)}
        style={{ position:'absolute', top:0, right:0, bottom:0, zIndex:20,
          width: drawerOpen ? 300 : 0,
          background:'rgba(0,0,0,0.75)', backdropFilter:'blur(16px)',
          borderLeft:'1px solid rgba(255,255,255,0.08)',
          transition:'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow:'hidden', display:'flex', flexDirection:'column' }}>

        <div style={{ width:300, display:'flex', flexDirection:'column', height:'100%', padding:'80px 0 0' }}>
          <div style={{ padding:'0 16px 10px', display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation: isLive ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' }}>Live feed</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginLeft:'auto' }}>{events.length} events</span>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
            {events.filter(ev => !['game_end','period_end','game_start'].includes(ev.stat_id)).map(ev => (
              <DrawerEventRow key={ev.id} event={ev} />
            ))}
            {events.length === 0 && (
              <div style={{ padding:'24px 16px', textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:13 }}>
                {isLive ? 'Waiting for events...' : 'No events'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover trigger zone (right edge) */}
      <div
        onMouseEnter={() => setDrawerOpen(true)}
        style={{ position:'absolute', top:0, right:0, bottom:0, width:20, zIndex:19 }}
      />

      {/* Bottom ticker - flashes on new event, auto-hides */}
      <div style={{ position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:30,
        opacity: tickerVisible ? 1 : 0,
        transform: tickerVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
        transition:'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents:'none' }}>
        {ticker && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(12px)',
            borderRadius:100, padding:'8px 18px', border:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: ticker.color, flexShrink:0 }} />
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:14, fontWeight:500, color:'#fff', whiteSpace:'nowrap' }}>
              {ticker.text}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:2px}
      `}</style>
    </div>
  )
}

function MobileTeamScore({ team, score, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection: right ? 'row-reverse' : 'row', flex:1 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background: team?.primary_color ?? 'rgba(255,255,255,0.2)', flexShrink:0 }} />
      <div style={{ textAlign: right ? 'right' : 'left' }}>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:80 }}>{team?.short_name ?? team?.name ?? 'TBD'}</div>
        <div style={{ fontFamily:'DM Mono, monospace', fontSize:28, fontWeight:700, color:'#fff', lineHeight:1 }}>{score}</div>
      </div>
    </div>
  )
}

function MobileEventRow({ event: ev }) {
  const isScore = ev.score_a_after !== null
  const label = { goal:'Goal', assist:'Assist', block:'Block', turnover:'Turnover', foul:'Foul' }[ev.stat_id] ?? ev.stat_id?.replace(/_/g,' ')
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background: ev.team?.primary_color ?? 'rgba(255,255,255,0.2)', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight: isScore ? 500 : 400, color: isScore ? '#fff' : 'rgba(255,255,255,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {ev.player?.name ?? ev.team?.short_name ?? '-'}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'capitalize' }}>{label}</div>
      </div>
      {isScore && <span style={{ fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.7)', flexShrink:0 }}>
        {ev.score_a_after}-{ev.score_b_after}
      </span>}
    </div>
  )
}

function DesktopTeamRow({ team, score }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background: team?.primary_color ?? 'rgba(255,255,255,0.3)', flexShrink:0 }} />
      <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {team?.short_name ?? team?.name ?? 'TBD'}
      </span>
      <span style={{ fontFamily:'DM Mono, monospace', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>{score}</span>
    </div>
  )
}

function DrawerEventRow({ event: ev }) {
  const isScore = ev.score_a_after !== null
  const label = { goal:'Goal', assist:'Assist', block:'Block', turnover:'Turnover', foul:'Foul' }[ev.stat_id] ?? ev.stat_id?.replace(/_/g,' ')
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background: ev.team?.primary_color ?? 'rgba(255,255,255,0.2)', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, color: isScore ? '#fff' : 'rgba(255,255,255,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {ev.player?.name ?? ev.team?.short_name ?? '-'}
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'capitalize' }}>{label}</div>
      </div>
      {isScore && <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>
        {ev.score_a_after}-{ev.score_b_after}
      </span>}
    </div>
  )
}
