import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, PanelRightClose, PanelRightOpen, Activity, Tv2 } from 'lucide-react'

export function WatchPage() {
  const { matchId }             = useParams()
  const [match, setMatch]       = useState(null)
  const [events, setEvents]     = useState([])
  const [elapsed, setElapsed]   = useState(0)
  const [loading, setLoading]   = useState(true)
  const [statsOpen, setStatsOpen] = useState(true)
  const [splitPct, setSplitPct] = useState(70) // percent of width for video
  const dragging                = useRef(false)
  const containerRef            = useRef(null)

  // Load match + venue stream URL
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
        id, stat_id, sequence, event_timestamp, score_a_after, score_b_after,
        team:tournament_teams!team_id(id, name, short_name, primary_color),
        player:tournament_players!player_id(id, name, number)
      `).eq('match_id', matchId)
        .not('stat_id', 'in', '("game_end","period_end")')
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

  // Realtime
  useEffect(() => {
    if (!match) return
    const channel = supabase.channel('watch-' + matchId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'id=eq.' + matchId },
        payload => setMatch(prev => ({ ...prev, ...payload.new })))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: 'match_id=eq.' + matchId },
        async payload => {
          const { data: ev } = await supabase.from('game_events').select(`
            id, stat_id, sequence, score_a_after, score_b_after,
            team:tournament_teams!team_id(id, name, short_name, primary_color),
            player:tournament_players!player_id(id, name, number)
          `).eq('id', payload.new.id).single()
          if (ev) setEvents(prev => [ev, ...prev].slice(0, 30))
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [match?.id])

  // Drag to resize
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.min(85, Math.max(40, ((e.clientX - rect.left) / rect.width) * 100))
      setSplitPct(pct)
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Touch resize
  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    const onMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.min(85, Math.max(40, ((e.touches[0].clientX - rect.left) / rect.width) * 100))
      setSplitPct(pct)
    }
    const onEnd = () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
  }, [])

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

  const color = match.tournament?.primary_color ?? '#8b5cf6'

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          {match.tournament && (
            <Link to={'/score/' + matchId} style={{ color:'var(--text-muted)', display:'flex', flexShrink:0 }}>
              <ChevronLeft size={18} />
            </Link>
          )}
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {match.team_a?.name} vs {match.team_b?.name}
            </p>
            <p style={{ fontSize:11, color:'var(--text-muted)' }}>
              {match.tournament?.name}
              {match.round_label && ' - ' + match.round_label}
              {match.venue && ' - ' + (match.venue.short_name ?? match.venue.name)}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {isLive && <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, color:'var(--live)' }}>
            <span className="live-dot" /> LIVE
          </span>}
          {isDone && <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em' }}>FINAL</span>}
          <button onClick={() => setStatsOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', fontSize:12, fontWeight:500, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
            {statsOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            {statsOpen ? 'Hide stats' : 'Show stats'}
          </button>
        </div>
      </div>

      {/* Score bar - always visible */}
      <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <TeamScoreBlock team={match.team_a} score={match.score_a ?? 0} />
        <div style={{ textAlign:'center' }}>
          {clockStr
            ? <span style={{ fontFamily:'DM Mono, monospace', fontSize:26, fontWeight:600, color:'var(--text-primary)', letterSpacing:'0.05em', display:'block' }}>{clockStr}</span>
            : isDone
              ? <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em' }}>FINAL</span>
              : <span style={{ fontSize:22, color:'var(--text-muted)' }}>-</span>
          }
          {isLive && <span style={{ fontSize:10, fontWeight:700, color:'var(--live)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Live</span>}
        </div>
        <TeamScoreBlock team={match.team_b} score={match.score_b ?? 0} right />
      </div>

      {/* Main resizable layout */}
      <div ref={containerRef} style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Video panel */}
        <div style={{ width: statsOpen ? splitPct + '%' : '100%', display:'flex', flexDirection:'column', background:'#000', transition: dragging.current ? 'none' : 'width 0.2s ease', flexShrink:0 }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              style={{ width:'100%', height:'100%', border:'none', display:'block' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#0a0a0c' }}>
              <Tv2 size={40} style={{ color:'var(--text-muted)', opacity:0.25 }} />
              <p style={{ fontSize:14, color:'var(--text-muted)', textAlign:'center' }}>No stream configured for this venue</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', opacity:0.6, textAlign:'center' }}>Director can add a YouTube URL in Director HQ</p>
            </div>
          )}
        </div>

        {/* Drag handle */}
        {statsOpen && (
          <div
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{ width:5, background:'var(--border)', cursor:'col-resize', flexShrink:0, transition:'background 0.15s', zIndex:10, position:'relative' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--accent)'}
            onMouseLeave={e => { if (!dragging.current) e.currentTarget.style.background='var(--border)' }}>
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:3, height:32, borderRadius:2, background:'var(--border-mid)' }} />
          </div>
        )}

        {/* Stats panel */}
        {statsOpen && (
          <div style={{ flex:1, background:'var(--bg-surface)', display:'flex', flexDirection:'column', overflow:'hidden', minWidth:220 }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
              <Activity size={13} style={{ color:'var(--accent)' }} />
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-secondary)' }}>Live feed</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>{events.length} events</span>
            </div>

            <div style={{ flex:1, overflowY:'auto' }}>
              {events.length === 0 ? (
                <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                  {isLive ? 'Waiting for first event...' : 'No events recorded'}
                </div>
              ) : events.filter(ev => !['game_end','period_end','game_start'].includes(ev.stat_id)).map(ev => (
                <EventRow key={ev.id} event={ev} matchTeamA={match.team_a} matchTeamB={match.team_b} />
              ))}
            </div>

            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)' }}>
              <Link to={'/score/' + matchId}
                style={{ display:'block', textAlign:'center', fontSize:12, color:'var(--text-muted)', textDecoration:'none', padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-raised)' }}>
                Full scoreboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamScoreBlock({ team, score, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexDirection: right ? 'row-reverse' : 'row' }}>
      <div style={{ width:10, height:10, borderRadius:'50%', background: team?.primary_color ?? 'var(--border-mid)', flexShrink:0 }} />
      <div style={{ textAlign: right ? 'right' : 'left' }}>
        <p style={{ fontSize:12, color:'var(--text-muted)' }}>{team?.short_name ?? team?.name ?? 'TBD'}</p>
        <p style={{ fontFamily:'DM Mono, monospace', fontSize:34, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{score}</p>
      </div>
    </div>
  )
}

function EventRow({ event: ev, matchTeamA, matchTeamB }) {
  const isScore = ev.score_a_after !== null && ev.score_b_after !== null
  const teamColor = ev.team?.primary_color ?? 'var(--border-mid)'
  const statLabel = {
    goal: 'Goal', assist: 'Assist', block: 'Block', turnover: 'Turnover',
    foul: 'Foul', timeout: 'Timeout'
  }[ev.stat_id] ?? (ev.stat_id?.replace(/_/g, ' ') ?? '-')

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:teamColor, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight: isScore ? 500 : 400, color: isScore ? 'var(--text-primary)' : 'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {ev.player?.name ?? ev.team?.short_name ?? ev.team?.name ?? '-'}
        </p>
        <p style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>{statLabel}</p>
      </div>
      {isScore && (
        <span style={{ fontFamily:'DM Mono, monospace', fontSize:13, fontWeight:600, color:'var(--text-primary)', flexShrink:0 }}>
          {ev.score_a_after}-{ev.score_b_after}
        </span>
      )}
    </div>
  )
}
