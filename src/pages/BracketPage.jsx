import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, ChevronLeft, ZoomIn, ZoomOut } from 'lucide-react'

const NODE_W   = 190
const NODE_H   = 68
const H_GAP    = 72
const V_GAP    = 16
const PADDING  = 40

export function BracketPage() {
  const { slug, divisionId } = useParams()
  const [division, setDivision]   = useState(null)
  const [bracket, setBracket]     = useState(null) // { rounds, nodes, edges }
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [zoom, setZoom]           = useState(1)
  const containerRef              = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, format_type, teams_advance_per_pool, third_place_game, consolation_bracket, tournament:tournaments(id, name, slug, primary_color)')
        .eq('id', divisionId)
        .single()

      if (!div) { setNotFound(true); setLoading(false); return }
      setDivision(div)

      // Try bracket_slots first
      const { data: slots } = await supabase
        .from('bracket_slots')
        .select(`
          id, round, position, label, bracket_side, phase,
          team_a_source, team_b_source,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          match:matches!match_id(id, score_a, score_b, status, winner_id)
        `)
        .eq('division_id', divisionId)
        .order('round').order('position')

      if (slots && slots.length > 0) {
        setBracket(layoutBracket(slots))
        setLoading(false)
        return
      }

      // No bracket_slots -- build full bracket from matches
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          id, score_a, score_b, status, winner_id, round, match_number, phase,
          winner_next_match_id, winner_next_slot,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          time_slot:time_slots(scheduled_start)
        `)
        .eq('division_id', divisionId)
        .eq('phase', 2)
        .neq('status', 'cancelled')
        .order('round').order('match_number')

      if (matches && matches.length > 0) {
        setBracket(layoutFromMatches(matches))
        setLoading(false)
        return
      }

      // Fall back to pool standings preview
      const { data: standings } = await supabase
        .from('pool_standings_display')
        .select('*')
        .eq('division_id', divisionId)
        .order('pool_id, rank')

      if (standings && standings.length > 0) {
        const advance = div.teams_advance_per_pool ?? 2
        const pools   = {}
        for (const s of standings) {
          if (!pools[s.pool_id]) pools[s.pool_id] = []
          pools[s.pool_id].push(s)
        }
        const advancers = Object.values(pools)
          .flatMap(p => p.slice(0, advance))
        setBracket(buildFullPreviewBracket(advancers, div))
      }

      setLoading(false)
    }
    load()
  }, [divisionId])

  // Realtime match updates
  useEffect(() => {
    if (!division) return
    const channel = supabase
      .channel('bracket-live-' + divisionId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: 'division_id=eq.' + divisionId,
      }, payload => {
        if (!bracket) return
        setBracket(prev => {
          if (!prev) return prev
          const updated = payload.new
          return {
            ...prev,
            nodes: prev.nodes.map(n => {
              if (n.match?.id === updated.id) return { ...n, match: { ...n.match, ...updated } }
              return n
            })
          }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [division?.id, !!bracket])

  if (loading) return <PageLoader />
  if (notFound) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg font-semibold text-gray-700">Division not found</p>
    </div>
  )

  const tournament = division?.tournament
  const { nodes = [], edges = [], svgW = 600, svgH = 400 } = bracket ?? {}

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {tournament && (
              <Link to={'/t/' + tournament.slug} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <ChevronLeft size={18} />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{division?.name} Bracket</h1>
              {tournament && <p className="text-xs text-gray-400 truncate">{tournament.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto p-6">
        {!bracket || nodes.length === 0 ? (
          <div className="max-w-lg mx-auto mt-16 text-center text-gray-400 space-y-3">
            <Trophy size={40} className="mx-auto opacity-20" />
            <p className="font-semibold text-gray-600">Bracket not yet available</p>
            <p className="text-sm">The bracket will appear once pool play begins and teams are seeded.</p>
          </div>
        ) : (
          <div style={{ transform: 'scale(' + zoom + ')', transformOrigin: 'top left', width: svgW, height: svgH, transition: 'transform 0.15s' }}>
            <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
                </filter>
              </defs>

              {/* Edges */}
              {edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke="#e2e8f0" strokeWidth={2} />
              ))}

              {/* Round labels */}
              {getRoundLabels(nodes, bracket.numRounds).map(({ round, x, label }) => (
                <text key={round} x={x + NODE_W / 2} y={PADDING - 14}
                  textAnchor="middle" fontSize={11} fontWeight="600"
                  fill="#94a3b8" style={{ fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </text>
              ))}

              {/* Nodes */}
              {nodes.map(node => (
                <BracketNode
                  key={node.id}
                  node={node}
                  primaryColor={tournament?.primary_color ?? '#1a56db'}
                />
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

// --- SVG node ------------------------------------------------------------------
function BracketNode({ node, primaryColor }) {
  const { x, y, match, team_a, team_b, team_a_source, team_b_source } = node
  const isLive    = match?.status === 'in_progress'
  const isDone    = match?.status === 'complete' || match?.status === 'forfeit'
  const winnerId  = match?.winner_id
  const isBye     = !team_b && !team_b_source

  const cardStroke = isLive ? '#22c55e' : '#e2e8f0'
  const cardFill   = isLive ? '#f0fdf4' : '#ffffff'

  return (
    <g filter="url(#shadow)">
      {/* Card */}
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={10} ry={10}
        fill={cardFill} stroke={cardStroke} strokeWidth={isLive ? 2 : 1} />

      {/* Live dot */}
      {isLive && <circle cx={x + NODE_W - 14} cy={y + 14} r={5} fill="#22c55e" opacity={0.9} />}

      {/* Match number label */}
      {node.matchNum && (
        <text x={x + 8} y={y + 10} fontSize={8} fill="#cbd5e1" style={{ fontFamily: 'system-ui' }}>
          {'G' + node.matchNum}
        </text>
      )}

      {/* Team A */}
      <NodeTeamRow
        x={x} y={y} rowIndex={0}
        team={team_a} source={team_a_source}
        score={match?.score_a}
        isWinner={isDone && winnerId && team_a && winnerId === team_a.id}
        isLoser={isDone && winnerId && team_a && winnerId !== team_a.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
      />

      {/* Divider */}
      <line x1={x + 10} y1={y + NODE_H / 2} x2={x + NODE_W - 10} y2={y + NODE_H / 2}
        stroke="#f1f5f9" strokeWidth={1} />

      {/* Team B */}
      <NodeTeamRow
        x={x} y={y + NODE_H / 2} rowIndex={1}
        team={team_b} source={isBye ? 'BYE' : team_b_source}
        score={match?.score_b}
        isWinner={isDone && winnerId && team_b && winnerId === team_b.id}
        isLoser={isDone && winnerId && team_b && winnerId !== team_b.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
        isBye={isBye}
      />
    </g>
  )
}

function NodeTeamRow({ x, y, team, source, score, isWinner, isLoser, showScore, primaryColor, isBye }) {
  const rowH    = NODE_H / 2
  const dotColor = team?.primary_color ?? (isBye ? '#e2e8f0' : '#94a3b8')
  const opacity  = isLoser ? 0.3 : isBye ? 0.4 : 1
  const nameStr  = team
    ? (team.short_name ?? team.name ?? 'TBD')
    : (source ?? 'TBD')
  const truncated = nameStr.length > 17 ? nameStr.slice(0, 16) + '..' : nameStr
  const textColor = isWinner ? primaryColor : (isBye ? '#94a3b8' : '#1e293b')
  const fontWeight = isWinner ? '700' : '500'

  return (
    <g opacity={opacity}>
      {/* Winner highlight */}
      {isWinner && (
        <rect x={x + 1} y={y + 1} width={NODE_W - 2} height={rowH - 1}
          rx={9} fill={primaryColor} opacity={0.07} />
      )}
      {/* Colour dot */}
      <circle cx={x + 14} cy={y + rowH / 2} r={4} fill={dotColor} />
      {/* Name */}
      <text x={x + 24} y={y + rowH / 2 + 1}
        dominantBaseline="middle" fontSize={11.5} fontWeight={fontWeight}
        fill={textColor} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {truncated}
      </text>
      {/* Score */}
      {showScore && score !== undefined && score !== null && (
        <text x={x + NODE_W - 10} y={y + rowH / 2 + 1}
          dominantBaseline="middle" textAnchor="end"
          fontSize={13} fontWeight="800"
          fill={isWinner ? primaryColor : '#64748b'}
          style={{ fontFamily: 'system-ui, sans-serif' }}>
          {score}
        </text>
      )}
    </g>
  )
}

// --- Layout: from bracket_slots -----------------------------------------------
function layoutBracket(slots) {
  const rounds    = groupByRound(slots)
  const numRounds = Object.keys(rounds).length
  const nodes     = slots.map(s => ({
    ...s,
    x: nodeX(s.round),
    y: nodeY(s, rounds),
    matchNum: s.match?.id ? s.position : null,
  }))
  const edges = buildEdges(rounds, nodes)
  const svgW  = PADDING * 2 + numRounds * (NODE_W + H_GAP) - H_GAP
  const maxNodes = Math.max(...Object.values(rounds).map(r => r.length))
  const svgH  = PADDING * 2 + 20 + maxNodes * (NODE_H + V_GAP) - V_GAP
  return { nodes, edges, svgW, svgH, numRounds }
}

// --- Layout: from matches (phase 2) -------------------------------------------
function layoutFromMatches(matches) {
  // Group by round, determine positions
  const byRound = {}
  for (const m of matches) {
    const r = m.round ?? 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(m)
  }
  for (const r of Object.values(byRound)) {
    r.sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
  }

  const numRounds = Object.keys(byRound).length
  const slots = []

  for (const [round, roundMatches] of Object.entries(byRound)) {
    roundMatches.forEach((m, idx) => {
      slots.push({
        id:           m.id,
        round:        Number(round),
        position:     idx + 1,
        bracket_side: 'winners',
        team_a:       m.team_a,
        team_b:       m.team_b,
        team_a_source: m.team_a ? null : ('Winner G' + ((idx * 2) + 1)),
        team_b_source: m.team_b ? null : ('Winner G' + ((idx * 2) + 2)),
        match:        m,
        matchNum:     m.match_number,
      })
    })
  }

  return layoutBracket(slots)
}

// --- Layout: preview from standings -------------------------------------------
function buildFullPreviewBracket(advancers, div) {
  const n    = advancers.length
  if (n < 2) return null

  const size      = Math.pow(2, Math.ceil(Math.log2(n)))
  const numRounds = Math.log2(size)
  const slots     = []

  // Seed: top seed vs bottom seed (1 v N, 2 v N-1, etc.)
  const seeded = [...advancers]
  while (seeded.length < size) seeded.push(null) // byes

  // Round 1
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i]
    const b = seeded[size - 1 - i]
    const aName = a ? (a.team_short_name ?? a.team_name) : null
    const bName = b ? (b.team_short_name ?? b.team_name) : null
    slots.push({
      id:           'pre-1-' + (i + 1),
      round:        1,
      position:     i + 1,
      bracket_side: 'winners',
      team_a:       a ? { id: a.team_id, name: a.team_name, short_name: a.team_short_name, primary_color: a.primary_color } : null,
      team_b:       b ? { id: b.team_id, name: b.team_name, short_name: b.team_short_name, primary_color: b.primary_color } : null,
      team_a_source: a ? ((i + 1) + ' seed') : 'TBD',
      team_b_source: b ? ((size - i) + ' seed') : 'BYE',
      match:        null,
      matchNum:     i + 1,
    })
  }

  // Later rounds - all TBD slots showing "Winner of Game X"
  let gameNum = size / 2 + 1
  for (let r = 2; r <= numRounds; r++) {
    const count = size / Math.pow(2, r)
    for (let i = 0; i < count; i++) {
      const srcA = (i * 2) + 1 + (r === 2 ? 0 : prevRoundStart(r, size))
      const srcB = (i * 2) + 2 + (r === 2 ? 0 : prevRoundStart(r, size))
      slots.push({
        id:           'pre-' + r + '-' + (i + 1),
        round:        r,
        position:     i + 1,
        bracket_side: 'winners',
        team_a:       null,
        team_b:       null,
        team_a_source: 'Winner G' + ((i * 2) + 1),
        team_b_source: 'Winner G' + ((i * 2) + 2),
        match:        null,
        matchNum:     gameNum++,
      })
    }
  }

  // Third place game
  if (div.third_place_game && numRounds >= 2) {
    slots.push({
      id:           'pre-3rd',
      round:        numRounds,
      position:     2,
      bracket_side: 'consolation',
      team_a:       null, team_b: null,
      team_a_source: 'Loser SF1',
      team_b_source: 'Loser SF2',
      match:        null, matchNum: gameNum,
      label:        '3rd Place',
    })
  }

  return layoutBracket(slots)
}

function prevRoundStart(r, size) {
  let total = 0
  for (let i = 1; i < r - 1; i++) total += size / Math.pow(2, i)
  return total
}

// --- Helpers ------------------------------------------------------------------
function groupByRound(slots) {
  const groups = {}
  for (const s of slots) {
    if (!groups[s.round]) groups[s.round] = []
    groups[s.round].push(s)
  }
  for (const r of Object.values(groups)) r.sort((a, b) => a.position - b.position)
  return groups
}

function nodeX(round) {
  return PADDING + (round - 1) * (NODE_W + H_GAP)
}

function nodeY(slot, rounds) {
  const roundNodes = rounds[slot.round] ?? []
  const numNodes   = roundNodes.length
  const maxNodes   = Math.max(...Object.values(rounds).map(r => r.length))
  const totalH     = numNodes * NODE_H + (numNodes - 1) * V_GAP
  const maxH       = maxNodes * NODE_H + (maxNodes - 1) * V_GAP
  const startY     = PADDING + 20 + (maxH - totalH) / 2
  const idx        = roundNodes.findIndex(n => n.id === slot.id)
  return startY + idx * (NODE_H + V_GAP)
}

function buildEdges(rounds, nodes) {
  const edges    = []
  const nodeMap  = Object.fromEntries(nodes.map(n => [n.id, n]))
  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b)

  for (let ri = 0; ri < roundNums.length - 1; ri++) {
    const curRound  = roundNums[ri]
    const nextRound = roundNums[ri + 1]
    const nextNodes = rounds[nextRound] ?? []

    for (const next of nextNodes) {
      // Two sources feed each next-round node
      const srcPos1 = (next.position - 1) * 2 + 1
      const srcPos2 = (next.position - 1) * 2 + 2
      const src1 = (rounds[curRound] ?? []).find(n => n.position === srcPos1)
      const src2 = (rounds[curRound] ?? []).find(n => n.position === srcPos2)

      const nextNode = nodeMap[next.id]
      if (!nextNode) continue
      const tX = nextNode.x
      const tY = nextNode.y + NODE_H / 2

      for (const src of [src1, src2].filter(Boolean)) {
        const srcNode = nodeMap[src.id]
        if (!srcNode) continue
        const sX  = srcNode.x + NODE_W
        const sY  = srcNode.y + NODE_H / 2
        const midX = sX + H_GAP / 2
        edges.push({ d: 'M' + sX + ' ' + sY + ' H' + midX + ' V' + tY + ' H' + tX })
      }
    }
  }
  return edges
}

function getRoundLabels(nodes, numRounds) {
  const roundSet = {}
  for (const n of nodes) {
    if (!roundSet[n.round]) roundSet[n.round] = n.x
  }
  return Object.entries(roundSet).map(([round, x]) => ({
    round: Number(round),
    x,
    label: roundLabelStr(Number(round), numRounds),
  }))
}

function roundLabelStr(round, numRounds) {
  const fromEnd = numRounds - round
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semis'
  if (fromEnd === 2) return 'Quarters'
  return 'Round ' + round
}
