import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Search, ChevronRight, MapPin, Calendar } from 'lucide-react'

export function TournamentList() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, slug, name, start_date, end_date, status, logo_url, primary_color, venue_name')
          .is('deleted_at', null)
          .in('status', ['published', 'live', 'review', 'archived'])
          .order('start_date', { ascending: false })
        if (error) console.error('TournamentList query error:', error)
        setTournaments(data ?? [])
      } catch (err) {
        console.error('TournamentList load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = tournaments.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.venue_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const live     = filtered.filter(t => t.status === 'live')
  const upcoming = filtered.filter(t => t.status === 'published')
  const past     = filtered.filter(t => ['review', 'archived'].includes(t.status))

  if (loading) return <PageLoader />

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'40px 20px 80px' }}>

      {/* Hero */}
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontSize:30, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', lineHeight:1.1, marginBottom:6 }}>
          Tournaments
        </h1>
        <p style={{ fontSize:15, color:'var(--text-secondary)' }}>Live scores, schedules, and standings.</p>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:36 }}>
        <Search size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
        <input
          type="text"
          style={{ width:'100%', padding:'10px 14px 10px 38px', fontSize:14, fontFamily:'inherit', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', outline:'none' }}
          placeholder="Search tournaments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = 'var(--border-mid)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {tournaments.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0', color:'var(--text-muted)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}></div>
          <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>No tournaments yet</p>
          <p style={{ fontSize:13 }}>Check back soon, or sign in to create one.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px 0' }}>No tournaments match "{search}"</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:40 }}>
          {live.length > 0 && <TSection title="Live now" tournaments={live} isLive />}
          {upcoming.length > 0 && <TSection title="Upcoming" tournaments={upcoming} />}
          {past.length > 0 && <TSection title="Past" tournaments={past} isPast />}
        </div>
      )}
    </div>
  )
}

function TSection({ title, tournaments, isLive, isPast }) {
  return (
    <div>
      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        {isLive ? (
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'3px 10px', borderRadius:20 }}>
            <span className="live-dot" />
            Live
          </span>
        ) : (
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>{title}</span>
        )}
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
      </div>

      {/* Cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {tournaments.map(t => <TCard key={t.id} tournament={t} isLive={isLive} isPast={isPast} />)}
      </div>
    </div>
  )
}

function TCard({ tournament: t, isLive, isPast }) {
  const color = t.primary_color ?? '#8a8a9a'
  const initial = (t.name ?? '?')[0].toUpperCase()

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <Link to={'/t/' + t.slug} style={{ display:'flex', alignItems:'stretch', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, textDecoration:'none', overflow:'hidden', transition:'border-color 0.15s, background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>

      {/* Color bar */}
      {!isPast && <div style={{ width:4, background:color, flexShrink:0 }} />}

      <div style={{ padding:'15px 18px', display:'flex', alignItems:'center', gap:14, flex:1, opacity: isPast ? 0.6 : 1 }}>
        {/* Icon */}
        <div style={{ width:42, height:42, borderRadius:10, background: isPast ? 'var(--bg-hover)' : color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {initial}
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {t.name}
          </div>
          <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap' }}>
            {t.venue_name && (
              <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                <MapPin size={11} /> {t.venue_name}
              </span>
            )}
            {t.start_date && (
              <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                <Calendar size={11} /> {formatDate(t.start_date)}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {isLive && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--live)', background:'var(--live-dim)', border:'1px solid rgba(34,197,94,0.2)', padding:'3px 9px', borderRadius:20 }}>
              <span className="live-dot" /> Live
            </span>
          )}
          {!isLive && !isPast && t.start_date && (
            <span style={{ fontSize:11, fontWeight:500, color:'#a78bfa', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', padding:'3px 9px', borderRadius:20 }}>
              {formatDate(t.start_date)}
            </span>
          )}
          {isPast && (
            <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg-hover)', padding:'3px 9px', borderRadius:20 }}>
              Final
            </span>
          )}
          <ChevronRight size={15} style={{ color:'var(--text-muted)' }} />
        </div>
      </div>
    </Link>
  )
}
