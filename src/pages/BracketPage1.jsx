import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, ChevronLeft, ZoomIn, ZoomOut, Medal } from 'lucide-react'

// Reads live CSS variable values so SVG elements (which can't use var()) get themed colors
function useThemeColors() {
  const [colors, setColors] = useState(() => resolveColors())
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(resolveColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return colors
}
function resolveColors() {
  const s = getComputedStyle(document.documentElement)
  const get = v => s.getPropertyValue(v).trim()
  return {
    textMuted:    get('--text-muted')    || '#55556a',
    textPrimary:  get('--text-primary')  || '#f0f0f2',
    border:       get('--border')        || '#2a2a32',
    bgSurface:    get('--bg-surface')    || '#111114',
  }
}

const NODE_W  = 200
const NODE_H  = 72
const H_GAP   = 80
const V_GAP   = 18
const PADDING = 48

export function BracketPage() {
  const { slug, divisionId }    = useParams()
  const [division, setDivision] = useState(null)
  const [bracket, setBracket]       = useState(null)
  const [isPreview, setIsPreview]   = useState(false)
  const [fifthPlace, setFifthPlace] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [zoom, setZoom]         = useState(1)
  const containerRef            = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, format_type, teams_advance_per_pool, third_place_game, consolation_bracket, tournament:tournaments(id, name, slug, primary_color)')
        .eq('id', divisionId).single()
      if (!div) { setNotFound(true); setLoading(false); return }
      setDivision(div)

      const { data: slots } = await supabase
        .from('bracket_slots')
        .select('id, round, position, label, bracket_side, phase, team_a_source, team_b_source, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), match:matches!match_id(id, score_a, score_b, status, winner_id, time_slot:time_slots(scheduled_start), venue:venues(short_name))')
        .eq('division_id', divisionId).order('round').order('position')

      if (slots?.length > 0) { setBracket(layoutBracket(slots)); setLoading(false); return }

      const { data: matches } = await supabase
        .from('matches')
        .select('id, score_a, score_b, status, winner_id, round, match_number, phase, winner_next_match_id, winner_next_slot, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), time_slot:time_slots(scheduled_start)')
        .eq('division_id', divisionId).eq('phase', 2).neq('status', 'cancelled').order('round').order('match_number')

      if (matches?.length > 0) { setBracket(layoutFromMatches(matches)); setLoading(false); return }

      const { data: standings } = await supabase
        .from('pool_standings_display').select('*').eq('division_id', divisionId).order('pool_id, rank')

      if (standings?.length > 0) {
        const advance = div.teams_advance_per_pool ?? 2
        const pools = {}
        for (const s of standings) { if (!pools[s.pool_id]) pools[s.pool_id] = []; pools[s.pool_id].push(s) }
        setBracket(buildFullPreviewBracket(Object.values(pools).map(p => p.slice(0, advance)), div))
        setIsPreview(true)
      }
      // Fetch 5th place game separately (round 0, bracket_position FIFTH)
      const { data: fifthMatch } = await supabase
        .from('matches')
        .select(`id, status, score_a, score_b, round_label,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start)`)
        .eq('division_id', divisionId)
        .eq('phase', 2)
        .eq('bracket_position', 'FIFTH')
        .maybeSingle()
      if (fifthMatch) setFifthPlace(fifthMatch)

      setLoading(false)
    }
    load()
  }, [divisionId])

  useEffect(() => {
    if (!division) return
    const channel = supabase.channel('bracket-live-' + divisionId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'division_id=eq.' + divisionId }, payload => {
        if (!bracket) return
        setBracket(prev => {
          if (!prev) return prev
          const u = payload.new
          return { ...prev, nodes: prev.nodes.map(n => n.match?.id === u.id ? { ...n, match: { ...n.match, ...u } } : n) }
        })
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [division?.id, !!bracket])

  const themeColors = useThemeColors()

  if (loading) return <PageLoader />
  if (notFound) return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'64px 20px', textAlign:'center', color:'var(--text-muted)' }}>
      <p style={{ fontSize:16, fontWeight:600, color:'var(--text-secondary)' }}>Division not found</p>
    </div>
  )

  const isPlacement = division?.format_type?.toLowerCase() === 'pool_to_placement'
  const tournament = division?.tournament
  const { nodes = [], edges = [], svgW = 600, svgH = 400, numRounds = 1, champion: bracketChampion, second: bracketSecond, third: bracketThird } = bracket ?? {}
  const color = tournament?.primary_color ?? '#8b5cf6'

  // For placement format, derive finishers from placement nodes sorted by position
  const placementFinishers = isPlacement
    ? [...nodes]
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
        .map(node => {
          const isDone = node.match?.status === 'complete' || node.match?.status === 'forfeit'
          const winnerId = node.match?.winner_id
          const winner = isDone && winnerId
            ? (node.team_a?.id === winnerId ? node.team_a : node.team_b)
            : null
          const loser = isDone && winnerId
            ? (node.team_a?.id === winnerId ? node.team_b : node.team_a)
            : null
          return { label: node.label, winner, loser, position: node.position }
        })
    : []

  const champion = isPlacement ? placementFinishers[0]?.winner : bracketChampion
  const second   = isPlacement ? placementFinishers[0]?.loser  : bracketSecond

  // Third — from bracket data or directly from bronze medal game winner
  const thirdFromBracket = isPlacement ? placementFinishers[1]?.winner : bracketThird
  const third = thirdFromBracket ?? (() => {
    const bronzeNode = bracket?.nodes?.find(n =>
      n.label?.toLowerCase().includes('bronze') ||
      n.round_label?.toLowerCase().includes('bronze') ||
      n.match?.round_label?.toLowerCase().includes('bronze')
    )
    if (!bronzeNode?.match) return null
    const m = bronzeNode.match
    if (m.status !== 'complete' && m.status !== 'forfeit') return null
    const winnerId = m.winner_id
    if (!winnerId) return null
    return bronzeNode.team_a?.id === winnerId ? bronzeNode.team_a : bronzeNode.team_b
  })()

  // Fourth place — loser of the bronze medal game
  const fourth = (() => {
    if (!bracket) return null
    const bronzeNode = bracket.nodes?.find(n =>
      n.label?.toLowerCase().includes('bronze') ||
      n.match?.round_label?.toLowerCase().includes('bronze')
    )
    if (!bronzeNode?.match) return null
    const m = bronzeNode.match
    if (m.status !== 'complete' && m.status !== 'forfeit') return null
    const winnerId = m.winner_id
    if (!winnerId) return null
    return bronzeNode.team_a?.id === winnerId ? bronzeNode.team_b : bronzeNode.team_a
  })()

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', padding:'12px 20px', position:'sticky', top:0, zIndex:20, flexShrink:0 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            {tournament && (
              <Link to={'/t/' + tournament.slug} style={{ color:'var(--text-muted)', display:'flex', flexShrink:0 }}>
                <ChevronLeft size={18} />
              </Link>
            )}
            <div style={{ minWidth:0 }}>
              <h1 style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.02em', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {division?.name} {isPlacement ? 'Playoffs' : 'Bracket'}
              </h1>
              {tournament && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>{tournament.name}</p>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {/* Nav links */}
            {tournament && (
              <div style={{ display:'flex', gap:6, marginRight:8 }}>
                <Link to={'/t/' + tournament.slug + '/schedule'}
                  style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-raised)' }}
                  className="hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)]">
                  Schedule
                </Link>
                <Link to={'/t/' + tournament.slug + '/standings/' + divisionId}
                  style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-raised)' }}
                  className="hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)]">
                  Standings
                </Link>
              </div>
            )}
            {/* Zoom controls - only for bracket format */}
            {!isPlacement && <>
            <button onClick={() => setZoom(z => Math.max(0.3, +(z-0.15).toFixed(2)))}
              style={{ padding:6, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize:12, color:'var(--text-muted)', width:40, textAlign:'center', fontFamily:'monospace' }}>{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, +(z+0.15).toFixed(2)))}
              style={{ padding:6, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
              <ZoomIn size={15} />
            </button>
            </>}
          </div>
        </div>
      </div>

      {/* Champion podium — large bold results bar */}
      {champion && (
        <div style={{ background: color + '15', borderBottom:'2px solid ' + color + '30', padding:'20px 24px' }}>
          <div style={{ maxWidth:1400, margin:'0 auto' }}>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color: color, marginBottom:16, textAlign:'center' }}>Final Standings</p>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:12, flexWrap:'wrap' }}>

              {/* 1st */}
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:14, padding:'12px 20px' }}>
                <span style={{ fontSize:28 }}>🥇</span>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#f59e0b', margin:0 }}>1st Place</p>
                  <Link to={'/t/' + tournament?.slug + '/team/' + champion.id}
                    style={{ fontSize:22, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.03em', textDecoration:'none', lineHeight:1.1, display:'block' }}>
                    {champion.name}
                  </Link>
                </div>
              </div>

              {second && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(148,163,184,0.08)', border:'1px solid rgba(148,163,184,0.2)', borderRadius:14, padding:'12px 20px' }}>
                  <span style={{ fontSize:24 }}>🥈</span>
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#94a3b8', margin:0 }}>2nd Place</p>
                    <Link to={'/t/' + tournament?.slug + '/team/' + second.id}
                      style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.02em', textDecoration:'none', lineHeight:1.1, display:'block' }}>
                      {second.name}
                    </Link>
                  </div>
                </div>
              )}

              {third && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(180,83,9,0.08)', border:'1px solid rgba(180,83,9,0.2)', borderRadius:14, padding:'12px 20px' }}>
                  <span style={{ fontSize:22 }}>🥉</span>
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#b45309', margin:0 }}>3rd Place</p>
                    <Link to={'/t/' + tournament?.slug + '/team/' + third.id}
                      style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.02em', textDecoration:'none', lineHeight:1.1, display:'block' }}>
                      {third.name}
                    </Link>
                  </div>
                </div>
              )}

              {fourth && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 20px' }}>
                  <span style={{ fontSize:20, opacity:0.6 }}>4️⃣</span>
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', margin:0 }}>4th Place</p>
                    <Link to={'/t/' + tournament?.slug + '/team/' + fourth.id}
                      style={{ fontSize:16, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'-0.02em', textDecoration:'none', lineHeight:1.1, display:'block' }}>
                      {fourth.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ maxWidth:1400, margin:'0 auto' }}>

            {/* Quick nav links */}
            {tournament && (
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <Link to={'/t/' + tournament.slug}
                  style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', textDecoration:'none', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-raised)' }}
                  className="hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)]">
                  Overview
                </Link>
                <Link to={'/t/' + tournament.slug + '/schedule'}
                  style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', textDecoration:'none', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-raised)' }}
                  className="hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)]">
                  Schedule
                </Link>
                <Link to={'/t/' + tournament.slug + '/standings/' + divisionId}
                  style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', textDecoration:'none', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-raised)' }}
                  className="hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)]">
                  Standings
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} style={{ flex:1, overflow:'auto', padding:'28px 20px 48px' }}>
        {!bracket || nodes.length === 0 ? (
          <div style={{ maxWidth:480, margin:'80px auto', textAlign:'center', color:'var(--text-muted)' }}>
            <Trophy size={40} style={{ margin:'0 auto 16px', opacity:0.2 }} />
            <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Bracket not yet available</p>
            <p style={{ fontSize:13 }}>The bracket will appear once pool play is complete and teams are seeded.</p>
          </div>
        ) : isPlacement ? (
          <PlacementGrid nodes={nodes} color={color} tournament={tournament} />
        ) : (
          <div style={{ transformOrigin:'top left', transform:'scale('+zoom+')', width:svgW, height:svgH, transition:'transform 0.15s' }}>
            <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
              {/* Round labels */}
              {getRoundLabels(nodes, numRounds).map(({ round, x, label }) => (
                <text key={round} x={x + NODE_W/2} y={PADDING - 16}
                  textAnchor="middle" fontSize={10} fontWeight="700"
                  fill={themeColors.textMuted} style={{ fontFamily:'DM Sans, system-ui', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                  {label}
                </text>
              ))}

              {/* Connector lines */}
              {edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke={themeColors.border} strokeWidth={2} />
              ))}

              {/* Nodes */}
              {nodes.map(node => (
                <BracketNode key={node.id} node={node} primaryColor={color} themeColors={themeColors} />
              ))}
            </svg>
          </div>
        )}

      {/* 5th Place consolation game */}
      {fifthPlace && (
        <div style={{ maxWidth:600, margin:'24px auto 0', padding:'0 24px' }}>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:20 }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:12, textAlign:'center' }}>
              Consolation — 5th Place
            </p>
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ flex:1, textAlign:'center' }}>
                <p style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
                  {fifthPlace.team_a?.name ?? '3rd Pool A'}
                </p>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                {(fifthPlace.status === 'in_progress' || fifthPlace.status === 'complete') ? (
                  <p style={{ fontFamily:'DM Mono, monospace', fontSize:24, fontWeight:900, color:'var(--text-primary)', margin:0 }}>
                    {fifthPlace.score_a ?? 0} – {fifthPlace.score_b ?? 0}
                  </p>
                ) : (
                  <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>vs</p>
                )}
                {fifthPlace.time_slot?.scheduled_start && (
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:'4px 0 0' }}>
                    {new Date(fifthPlace.time_slot.scheduled_start).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/Toronto' })}
                    {fifthPlace.venue && ' · ' + (fifthPlace.venue.short_name ?? fifthPlace.venue.name)}
                  </p>
                )}
              </div>
              <div style={{ flex:1, textAlign:'center' }}>
                <p style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
                  {fifthPlace.team_b?.name ?? '3rd Pool B'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

// --- Placement Grid (POOL_TO_PLACEMENT format) --------------------------------
function PlacementGrid({ nodes, color, tournament }) {
  const sorted = [...nodes].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))

  return (
    <div style={{ maxWidth:680, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
      {sorted.map((node, i) => {
        const { team_a, team_b, team_a_source, team_b_source, match, label, position } = node
        const isLive   = match?.status === 'in_progress'
        const isDone   = match?.status === 'complete' || match?.status === 'forfeit'
        const winnerId = match?.winner_id
        const winnerTeam = isDone && winnerId ? (team_a?.id === winnerId ? team_a : team_b) : null
        const loserTeam  = isDone && winnerId ? (team_a?.id === winnerId ? team_b : team_a) : null
        const placeLabel = label ?? ordinal((position - 1) * 2 + 1) + ' Place Game'
        const winnerPlace = label?.replace(' Place', '') ?? ordinal((position - 1) * 2 + 1)
        const loserPlace  = ordinal((position - 1) * 2 + 2)
        const isChampionship = position === 1

        return (
          <div key={node.id} style={{
            background:'var(--bg-surface)',
            border: isLive
              ? '1.5px solid #22c55e'
              : isChampionship
                ? '1.5px solid ' + color + '60'
                : '1px solid var(--border)',
            borderRadius:16, overflow:'hidden',
            boxShadow: isLive
              ? '0 0 0 3px rgba(34,197,94,0.08)'
              : isChampionship
                ? '0 4px 24px ' + color + '18'
                : '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {/* Label bar */}
            <div style={{
              padding:'8px 18px', display:'flex', alignItems:'center', gap:10,
              borderBottom:'1px solid var(--border)',
              background: isLive
                ? 'rgba(34,197,94,0.06)'
                : isChampionship
                  ? color + '0d'
                  : 'var(--bg-raised)',
            }}>
              {isChampionship && !isLive && (
                <Trophy size={13} style={{ color: isDone ? '#fbbf24' : color, flexShrink:0 }} />
              )}
              <span style={{
                fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
                color: isLive ? '#22c55e' : isChampionship ? color : 'var(--text-muted)',
              }}>
                {placeLabel}
              </span>
              {isLive && (
                <span style={{ display:'flex', alignItems:'center', gap:5, marginLeft:'auto' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 1.5s infinite' }} />
                  <span style={{ fontSize:10, fontWeight:700, color:'#22c55e', letterSpacing:'0.1em' }}>LIVE</span>
                </span>
              )}
              {isDone && match?.id && (
                <a href={'/score/' + match.id} style={{
                  marginLeft:'auto', fontSize:11, color:'var(--text-muted)', textDecoration:'none',
                  padding:'2px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-raised)',
                }}>
                  Box score
                </a>
              )}
            </div>

            {/* Teams */}
            <div style={{ display:'flex', flexDirection:'column' }}>
              <PlacementTeamRow
                team={team_a} source={team_a_source}
                score={match?.score_a}
                isWinner={isDone && team_a?.id === winnerId}
                isLoser={isDone && winnerId && team_a && team_a.id !== winnerId}
                showScore={isLive || isDone}
                color={color} tournament={tournament}
                finishPlace={isDone && team_a?.id === winnerId ? winnerPlace : isDone && winnerId ? loserPlace : null}
              />
              <div style={{ height:1, background:'var(--border)', margin:'0 14px' }} />
              <PlacementTeamRow
                team={team_b} source={team_b_source}
                score={match?.score_b}
                isWinner={isDone && team_b?.id === winnerId}
                isLoser={isDone && winnerId && team_b && team_b.id !== winnerId}
                showScore={isLive || isDone}
                color={color} tournament={tournament}
                finishPlace={isDone && team_b?.id === winnerId ? winnerPlace : isDone && winnerId ? loserPlace : null}
              />
            </div>
          </div>
        )
      })}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100
  return n + (s[(v-20)%10] ?? s[v] ?? s[0])
}

function PlacementTeamRow({ team, source, score, isWinner, isLoser, showScore, color, tournament, finishPlace }) {
  const name = team ? (team.short_name ?? team.name ?? 'TBD') : (source ?? 'TBD')
  const dot  = team?.primary_color ?? 'var(--border)'

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 18px',
      background: isWinner ? color + '0e' : 'transparent',
      opacity: isLoser ? 0.42 : 1,
      transition:'opacity 0.2s, background 0.2s',
    }}>
      <div style={{ width:10, height:10, borderRadius:'50%', background:dot, flexShrink:0 }} />
      <span style={{
        flex:1, fontSize:15, fontWeight: isWinner ? 700 : 500,
        color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>
        {team && tournament
          ? <a href={'/t/' + tournament.slug + '/team/' + team.id} style={{ color:'inherit', textDecoration:'none' }}>{name}</a>
          : name}
      </span>
      {finishPlace && (
        <span style={{
          fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
          color: isWinner ? color : 'var(--text-muted)',
          padding:'2px 7px', borderRadius:5,
          background: isWinner ? color + '15' : 'var(--bg-raised)',
          border: '1px solid ' + (isWinner ? color + '30' : 'var(--border)'),
          flexShrink:0,
        }}>
          {finishPlace}
        </span>
      )}
      {showScore && score !== null && score !== undefined && (
        <span style={{
          fontFamily:'DM Mono, monospace',
          fontSize: isWinner ? 24 : 20,
          fontWeight: isWinner ? 800 : 600,
          color: isWinner ? color : 'var(--text-muted)',
          flexShrink:0, minWidth:28, textAlign:'right',
        }}>
          {score}
        </span>
      )}
    </div>
  )
}

function BracketNode({ node, primaryColor, themeColors }) {
  const { x, y, match, team_a, team_b, team_a_source, team_b_source, label } = node
  const isLive   = match?.status === 'in_progress'
  const isDone   = match?.status === 'complete' || match?.status === 'forfeit'
  const winnerId = match?.winner_id
  const isBye    = !team_b && team_b_source === 'BYE'
  const isFinal  = label === 'Final'
  const is3rd    = label === '3rd Place'

  const cardStroke = isLive ? '#22c55e' : isFinal ? primaryColor : themeColors.border
  const cardFill   = isLive ? 'rgba(34,197,94,0.06)' : isFinal ? primaryColor + '0d' : themeColors.bgSurface
  const strokeW    = isLive || isFinal ? 1.5 : 1

  return (
    <g>
      {/* Card background */}
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={11} ry={11}
        fill={cardFill} stroke={cardStroke} strokeWidth={strokeW} />

      {/* Final/3rd badge */}
      {(isFinal || is3rd) && (
        <text x={x + NODE_W/2} y={y - 6} textAnchor="middle" fontSize={9} fontWeight="700"
          fill={isFinal ? primaryColor : '#6b7280'}
          style={{ fontFamily:'DM Sans, system-ui', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {label}
        </text>
      )}

      {/* Live pulse dot */}
      {isLive && (
        <circle cx={x + NODE_W - 12} cy={y + 12} r={4} fill="#22c55e" opacity={0.9}>
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Team A row */}
      <NodeTeamRow x={x} y={y} rowIndex={0}
        team={team_a} source={team_a_source}
        score={match?.score_a}
        isWinner={isDone && winnerId && team_a && winnerId === team_a.id}
        isLoser={isDone && winnerId && team_a && winnerId !== team_a.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor} themeColors={themeColors} />

      {/* Divider */}
      <line x1={x+8} y1={y+NODE_H/2} x2={x+NODE_W-8} y2={y+NODE_H/2}
        stroke={themeColors.border} strokeWidth={1} />

      {/* Team B row */}
      <NodeTeamRow x={x} y={y+NODE_H/2} rowIndex={1}
        team={team_b} source={isBye ? 'BYE' : team_b_source}
        score={match?.score_b}
        isWinner={isDone && winnerId && team_b && winnerId === team_b.id}
        isLoser={isDone && winnerId && team_b && winnerId !== team_b.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
        themeColors={themeColors}
        isBye={isBye} />

      {/* Game time for scheduled matches */}
      {!isLive && !isDone && match?.time_slot?.scheduled_start && (
        <text x={x + NODE_W/2} y={y + NODE_H + 13} textAnchor="middle" fontSize={9}
          fill={themeColors.muted} style={{ fontFamily:'DM Sans, system-ui' }}>
          {new Date(match.time_slot.scheduled_start).toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/Toronto' })}
          {match?.venue?.short_name ? ' · ' + match.venue.short_name : ''}
        </text>
      )}
    </g>
  )
}

function NodeTeamRow({ x, y, team, source, score, isWinner, isLoser, showScore, primaryColor, isBye, themeColors }) {
  const rowH     = NODE_H / 2
  const dotColor = team?.primary_color ?? (isBye ? themeColors.border : themeColors.textMuted)
  const opacity  = isLoser ? 0.35 : isBye ? 0.4 : 1
  const nameStr  = team ? (team.name ?? team.short_name ?? 'TBD') : (source ?? 'TBD')
  const teamLink = team?.id ? ('/t/' + (window._bracketSlug ?? '') + '/team/' + team.id) : null
  const truncated = nameStr.length > 18 ? nameStr.slice(0, 17) + '..' : nameStr
  const textColor = isWinner ? primaryColor : isBye ? themeColors.border : themeColors.textPrimary
  const fontWeight = isWinner ? '700' : '500'
  const fontSize   = isWinner ? 13 : 12

  return (
    <g opacity={opacity}>
      {/* Winner highlight bar */}
      {isWinner && (
        <rect x={x+1} y={y+1} width={NODE_W-2} height={rowH-1} rx={10}
          fill={primaryColor} opacity={0.12} />
      )}
      {/* Color dot */}
      <circle cx={x+14} cy={y+rowH/2} r={4} fill={dotColor} />
      {/* Name */}
      <text x={x+25} y={y+rowH/2+1}
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={textColor}
        style={{ fontFamily:'DM Sans, system-ui, sans-serif', cursor: teamLink ? 'pointer' : 'default', textDecoration: teamLink ? 'underline' : 'none', textDecorationColor: 'rgba(232,255,71,0.3)' }}
        onClick={teamLink ? () => window.location.href = teamLink : undefined}>
        {truncated}
      </text>
      {/* Score */}
      {showScore && score !== undefined && score !== null && (
        <text x={x+NODE_W-10} y={y+rowH/2+1}
          dominantBaseline="middle" textAnchor="end"
          fontSize={isWinner ? 15 : 13}
          fontWeight={isWinner ? '800' : '600'}
          fill={isWinner ? primaryColor : themeColors.textMuted}
          style={{ fontFamily:'DM Mono, monospace' }}>
          {score}
        </text>
      )}
    </g>
  )
}

// --- Layout from bracket_slots ------------------------------------------------
function layoutBracket(slots) {
  const rounds    = groupByRound(slots)
  const numRounds = Object.keys(rounds).length
  const nodes     = slots.map(s => ({
    ...s,
    x: nodeX(s.round),
    y: nodeY(s, rounds),
    matchNum: s.position,
  }))
  const edges = buildEdges(rounds, nodes)
  const svgW  = PADDING * 2 + numRounds * (NODE_W + H_GAP) - H_GAP
  const maxNodes = Math.max(...Object.values(rounds).map(r => r.length))
  const svgH  = PADDING * 2 + 28 + maxNodes * (NODE_H + V_GAP) - V_GAP

  // Determine champion/runner-up/3rd from completed final
  let champion = null, second = null, third = null
  const finalSlot = slots.find(s => {
    const fromEnd = numRounds - s.round
    return fromEnd === 0 && s.bracket_side !== 'consolation'
  })
  if (finalSlot?.match?.status === 'complete' && finalSlot.match.winner_id) {
    const wId = finalSlot.match.winner_id
    champion = (finalSlot.team_a?.id === wId ? finalSlot.team_a : finalSlot.team_b) ?? null
    second   = (finalSlot.team_a?.id === wId ? finalSlot.team_b : finalSlot.team_a) ?? null
  }
  const thirdSlot = slots.find(s => s.label === '3rd Place' || s.bracket_side === 'consolation' || s.label === 'Bronze Medal Game' || s.label?.toLowerCase().includes('bronze'))
  if (thirdSlot?.match?.status === 'complete' && thirdSlot.match.winner_id) {
    const wId = thirdSlot.match.winner_id
    third = (thirdSlot.team_a?.id === wId ? thirdSlot.team_a : thirdSlot.team_b) ?? null
  }

  return { nodes, edges, svgW, svgH, numRounds, champion, second, third }
}

function layoutFromMatches(matches) {
  const byRound = {}
  for (const m of matches) {
    const r = m.round ?? 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(m)
  }
  for (const r of Object.values(byRound)) r.sort((a, b) => (a.match_number??0)-(b.match_number??0))
  const numRounds = Object.keys(byRound).length
  const slots = []
  for (const [round, rMatches] of Object.entries(byRound)) {
    rMatches.forEach((m, idx) => {
      const isLastRound = Number(round) === numRounds
      const is3rd = isLastRound && m.match_number === 2
      slots.push({
        id: m.id, round: Number(round), position: idx+1,
        bracket_side: is3rd ? 'consolation' : 'winners',
        team_a: m.team_a, team_b: m.team_b,
        team_a_source: m.team_a ? null : 'Winner G'+(idx*2+1),
        team_b_source: m.team_b ? null : 'Winner G'+(idx*2+2),
        match: m, matchNum: m.match_number,
        label: is3rd ? '3rd Place' : (isLastRound && m.match_number === 1 ? 'Final' : null),
      })
    })
  }
  return layoutBracket(slots)
}

function buildFullPreviewBracket(poolAdvancers, div) {
  // poolAdvancers is array of pools, each pool is array of standings sorted by rank
  // Build cross-pool matchups: A1 vs B2, B1 vs A2 etc.
  const pools = poolAdvancers.filter(p => p.length > 0)
  if (pools.length < 2) {
    // Fall back to flat seeding if only one pool
    const flat = pools.flat()
    if (flat.length < 2) return null
    poolAdvancers = [flat]
    pools.length === 0 && (pools.push(flat))
  }

  const toTeam = s => s ? { id:s.team_id, name:s.team_name, short_name:s.team_short_name, primary_color:s.primary_color } : null

  const slots = []
  let pos = 1

  if (pools.length === 2) {
    // Cross-pool semis: 1A vs 2B, 1B vs 2A
    const [poolA, poolB] = pools
    const pA = (poolA[0]?.pool_name ?? 'Pool A').replace('Pool ', '')
    const pB = (poolB[0]?.pool_name ?? 'Pool B').replace('Pool ', '')
    // Semi 1 (top): Winner B vs 2nd A  [position 1 renders at bottom, so swap]
    slots.push({
      id: 'pre-1-1', round: 1, position: 1, bracket_side: 'winners',
      team_a: null, team_b: null,
      team_a_source: 'Winner Pool ' + pB,
      team_b_source: '2nd Pool ' + pA,
      match: null, matchNum: 1,
    })
    // Semi 2 (top): Winner A vs 2nd B
    slots.push({
      id: 'pre-1-2', round: 1, position: 2, bracket_side: 'winners',
      team_a: null, team_b: null,
      team_a_source: 'Winner Pool ' + pA,
      team_b_source: '2nd Pool ' + pB,
      match: null, matchNum: 2,
    })
    pos = 3
  } else {
    // More than 2 pools — fall back to flat seeding
    const flat = pools.flat().sort((a,b) => a.rank - b.rank)
    const size = Math.pow(2, Math.ceil(Math.log2(flat.length)))
    const seeded = [...flat]
    while (seeded.length < size) seeded.push(null)
    for (let i = 0; i < size/2; i++) {
      const a = seeded[i], b = seeded[size-1-i]
      slots.push({
        id: 'pre-1-'+(i+1), round: 1, position: i+1, bracket_side: 'winners',
        team_a: toTeam(a), team_b: toTeam(b),
        team_a_source: a ? ((i+1)+' seed') : 'TBD',
        team_b_source: b ? ((size-i)+' seed') : 'BYE',
        match: null, matchNum: i+1,
      })
    }
    pos = size/2 + 1
  }

  // Build subsequent rounds
  let firstRoundCount = slots.filter(s => s.round === 1).length
  let size2 = Math.pow(2, Math.ceil(Math.log2(firstRoundCount * 2)))
  let numRounds = Math.log2(size2)
  if (numRounds < 1) numRounds = 1
  let gameNum = firstRoundCount + 1
  for (let r = 2; r <= numRounds; r++) {
    const count = Math.max(1, firstRoundCount / Math.pow(2, r - 1))
    const isFinal = r === numRounds
    for (let i = 0; i < count; i++) {
      slots.push({
        id: 'pre-'+r+'-'+(i+1), round: r, position: i+1, bracket_side: 'winners',
        team_a: null, team_b: null,
        team_a_source: isFinal ? 'Winner Semi 1' : 'Winner G'+(i*2+1),
        team_b_source: isFinal ? 'Winner Semi 2' : 'Winner G'+(i*2+2),
        match: null, matchNum: gameNum++,
        label: isFinal && i === 0 ? 'Final' : null,
      })
    }
  }

  if (div.third_place_game && numRounds >= 2) {
    slots.push({
      id: 'pre-3rd', round: numRounds, position: 2, bracket_side: 'consolation',
      team_a: null, team_b: null,
      team_a_source: 'Loser SF1', team_b_source: 'Loser SF2',
      match: null, matchNum: gameNum, label: '3rd Place',
    })
  }

  return layoutBracket(slots)
}

function groupByRound(slots) {
  const groups = {}
  for (const s of slots) { if (!groups[s.round]) groups[s.round]=[]; groups[s.round].push(s) }
  for (const r of Object.values(groups)) r.sort((a,b) => a.position-b.position)
  return groups
}
function nodeX(round) { return PADDING + (round-1)*(NODE_W+H_GAP) }
function nodeY(slot, rounds) {
  const roundNodes = rounds[slot.round] ?? []
  const maxNodes = Math.max(...Object.values(rounds).map(r=>r.length))
  const totalH = roundNodes.length*NODE_H + (roundNodes.length-1)*V_GAP
  const maxH = maxNodes*NODE_H + (maxNodes-1)*V_GAP
  const startY = PADDING+28+(maxH-totalH)/2
  const idx = roundNodes.findIndex(n=>n.id===slot.id)
  return startY + idx*(NODE_H+V_GAP)
}
function buildEdges(rounds, nodes) {
  const edges = []
  const nodeMap = Object.fromEntries(nodes.map(n=>[n.id,n]))
  const roundNums = Object.keys(rounds).map(Number).sort((a,b)=>a-b)
  for (let ri = 0; ri < roundNums.length-1; ri++) {
    const curRound = roundNums[ri], nextRound = roundNums[ri+1]
    for (const next of rounds[nextRound] ?? []) {
      if (next.bracket_side === 'consolation') continue
      const src1 = (rounds[curRound]??[]).find(n=>n.position===(next.position-1)*2+1)
      const src2 = (rounds[curRound]??[]).find(n=>n.position===(next.position-1)*2+2)
      const nextNode = nodeMap[next.id]
      if (!nextNode) continue
      const tX = nextNode.x, tY = nextNode.y+NODE_H/2
      for (const src of [src1,src2].filter(Boolean)) {
        const srcNode = nodeMap[src.id]
        if (!srcNode) continue
        const sX = srcNode.x+NODE_W, sY = srcNode.y+NODE_H/2, midX = sX+H_GAP/2
        edges.push({ d:'M'+sX+' '+sY+' H'+midX+' V'+tY+' H'+tX })
      }
    }
  }
  return edges
}
function getRoundLabels(nodes, numRounds) {
  const seen = {}
  for (const n of nodes) { if (!seen[n.round]) seen[n.round]=n.x }
  return Object.entries(seen).map(([round,x])=>({ round:Number(round), x, label:roundLabelStr(Number(round),numRounds) }))
}
function roundLabelStr(round, numRounds) {
  const fromEnd = numRounds - round
  if (fromEnd===0) return 'Final'
  if (fromEnd===1) return 'Semi-finals'
  if (fromEnd===2) return 'Quarters'
  return 'Round '+round
}
