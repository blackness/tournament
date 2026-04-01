import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, ChevronLeft, ZoomIn, ZoomOut, Medal } from 'lucide-react'

const NODE_W  = 200
const NODE_H  = 72
const H_GAP   = 80
const V_GAP   = 18
const PADDING = 48

export function BracketPage() {
  const { slug, divisionId }    = useParams()
  const [division, setDivision] = useState(null)
  const [bracket, setBracket]   = useState(null)
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
        .select('id, round, position, label, bracket_side, phase, team_a_source, team_b_source, team_a:tournament_teams!team_a_id(id, name, short_name, primary_color), team_b:tournament_teams!team_b_id(id, name, short_name, primary_color), match:matches!match_id(id, score_a, score_b, status, winner_id)')
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
        setBracket(buildFullPreviewBracket(Object.values(pools).flatMap(p => p.slice(0, advance)), div))
      }
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

  if (loading) return <PageLoader />
  if (notFound) return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'64px 20px', textAlign:'center', color:'var(--text-muted)' }}>
      <p style={{ fontSize:16, fontWeight:600, color:'var(--text-secondary)' }}>Division not found</p>
    </div>
  )

  const tournament = division?.tournament
  const { nodes = [], edges = [], svgW = 600, svgH = 400, numRounds = 1, champion, second, third } = bracket ?? {}
  const color = tournament?.primary_color ?? '#8b5cf6'

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
                {division?.name} Bracket
              </h1>
              {tournament && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>{tournament.name}</p>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <button onClick={() => setZoom(z => Math.max(0.3, +(z-0.15).toFixed(2)))}
              style={{ padding:6, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize:12, color:'var(--text-muted)', width:40, textAlign:'center', fontFamily:'monospace' }}>{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, +(z+0.15).toFixed(2)))}
              style={{ padding:6, borderRadius:8, background:'var(--bg-raised)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
              <ZoomIn size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Champion podium */}
      {champion && (
        <div style={{ background: color + '12', borderBottom:'1px solid ' + color + '25', padding:'16px 24px' }}>
          <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            {/* Champion */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Trophy size={20} style={{ color:'#fbbf24', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#fbbf24' }}>Champion</p>
                <p style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{champion.name}</p>
              </div>
            </div>

            {second && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Medal size={18} style={{ color:'#94a3b8', flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>Runner-up</p>
                  <p style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)' }}>{second.name}</p>
                </div>
              </div>
            )}

            {third && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Medal size={16} style={{ color:'#b45309', flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>3rd Place</p>
                  <p style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)' }}>{third.name}</p>
                </div>
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
        ) : (
          <div style={{ transformOrigin:'top left', transform:'scale('+zoom+')', width:svgW, height:svgH, transition:'transform 0.15s' }}>
            <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
              {/* Round labels */}
              {getRoundLabels(nodes, numRounds).map(({ round, x, label }) => (
                <text key={round} x={x + NODE_W/2} y={PADDING - 16}
                  textAnchor="middle" fontSize={10} fontWeight="700"
                  fill="#55556a" style={{ fontFamily:'DM Sans, system-ui', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                  {label}
                </text>
              ))}

              {/* Connector lines */}
              {edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke="#2a2a32" strokeWidth={2} />
              ))}

              {/* Nodes */}
              {nodes.map(node => (
                <BracketNode key={node.id} node={node} primaryColor={color} />
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

function BracketNode({ node, primaryColor }) {
  const { x, y, match, team_a, team_b, team_a_source, team_b_source, label } = node
  const isLive   = match?.status === 'in_progress'
  const isDone   = match?.status === 'complete' || match?.status === 'forfeit'
  const winnerId = match?.winner_id
  const isBye    = !team_b && team_b_source === 'BYE'
  const isFinal  = label === 'Final'
  const is3rd    = label === '3rd Place'

  const cardStroke = isLive ? '#22c55e' : isFinal ? primaryColor : '#2a2a32'
  const cardFill   = isLive ? 'rgba(34,197,94,0.06)' : isFinal ? primaryColor + '0d' : '#111114'
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
        primaryColor={primaryColor} />

      {/* Divider */}
      <line x1={x+8} y1={y+NODE_H/2} x2={x+NODE_W-8} y2={y+NODE_H/2}
        stroke="#2a2a32" strokeWidth={1} />

      {/* Team B row */}
      <NodeTeamRow x={x} y={y+NODE_H/2} rowIndex={1}
        team={team_b} source={isBye ? 'BYE' : team_b_source}
        score={match?.score_b}
        isWinner={isDone && winnerId && team_b && winnerId === team_b.id}
        isLoser={isDone && winnerId && team_b && winnerId !== team_b.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
        isBye={isBye} />
    </g>
  )
}

function NodeTeamRow({ x, y, team, source, score, isWinner, isLoser, showScore, primaryColor, isBye }) {
  const rowH     = NODE_H / 2
  const dotColor = team?.primary_color ?? (isBye ? '#3a3a44' : '#55556a')
  const opacity  = isLoser ? 0.35 : isBye ? 0.4 : 1
  const nameStr  = team ? (team.name ?? team.short_name ?? 'TBD') : (source ?? 'TBD')
  const truncated = nameStr.length > 18 ? nameStr.slice(0, 17) + '..' : nameStr
  const textColor = isWinner ? primaryColor : isBye ? '#3a3a44' : '#f0f0f2'
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
        style={{ fontFamily:'DM Sans, system-ui, sans-serif' }}>
        {truncated}
      </text>
      {/* Score */}
      {showScore && score !== undefined && score !== null && (
        <text x={x+NODE_W-10} y={y+rowH/2+1}
          dominantBaseline="middle" textAnchor="end"
          fontSize={isWinner ? 15 : 13}
          fontWeight={isWinner ? '800' : '600'}
          fill={isWinner ? primaryColor : '#55556a'}
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
  const thirdSlot = slots.find(s => s.label === '3rd Place' || s.bracket_side === 'consolation')
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

function buildFullPreviewBracket(advancers, div) {
  const n = advancers.length
  if (n < 2) return null
  const size = Math.pow(2, Math.ceil(Math.log2(n)))
  const numRounds = Math.log2(size)
  const slots = []
  const seeded = [...advancers]
  while (seeded.length < size) seeded.push(null)

  for (let i = 0; i < size/2; i++) {
    const a = seeded[i], b = seeded[size-1-i]
    slots.push({
      id: 'pre-1-'+(i+1), round: 1, position: i+1, bracket_side: 'winners',
      team_a: a ? { id:a.team_id, name:a.team_name, short_name:a.team_short_name, primary_color:a.primary_color } : null,
      team_b: b ? { id:b.team_id, name:b.team_name, short_name:b.team_short_name, primary_color:b.primary_color } : null,
      team_a_source: a ? ((i+1)+' seed') : 'TBD',
      team_b_source: b ? ((size-i)+' seed') : 'BYE',
      match: null, matchNum: i+1,
    })
  }

  let gameNum = size/2 + 1
  for (let r = 2; r <= numRounds; r++) {
    const count = size / Math.pow(2, r)
    const isFinal = r === numRounds
    for (let i = 0; i < count; i++) {
      slots.push({
        id: 'pre-'+r+'-'+(i+1), round: r, position: i+1, bracket_side: 'winners',
        team_a: null, team_b: null,
        team_a_source: 'Winner G'+(i*2+1),
        team_b_source: 'Winner G'+(i*2+2),
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
