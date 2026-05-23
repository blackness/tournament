import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, ChevronLeft, ZoomIn, ZoomOut, Medal } from 'lucide-react'

function useThemeColors() {
  const [colors, setColors] = useState(() => resolveColors())

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(resolveColors()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return colors
}

function resolveColors() {
  const s = getComputedStyle(document.documentElement)
  const get = v => s.getPropertyValue(v).trim()
  return {
    textMuted: get('--text-muted') || '#55556a',
    textPrimary: get('--text-primary') || '#f0f0f2',
    border: get('--border') || '#2a2a32',
    bgSurface: get('--bg-surface') || '#111114',
  }
}

const NODE_W = 200
const NODE_H = 72
const H_GAP = 80
const V_GAP = 18
const PADDING = 48
const BRACKET_GAP = 180
const TITLE_Y_PAD = 30

export function BracketPage() {
  const { slug, divisionId } = useParams()
  const [division, setDivision] = useState(null)
  const [bracket, setBracket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef(null)

  const themeColors = useThemeColors()

  useEffect(() => {
    window._bracketSlug = slug
    return () => {
      delete window._bracketSlug
    }
  }, [slug])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: div } = await supabase
        .from('divisions')
        .select(`
          id,
          name,
          tournament:tournaments(id, name, slug, primary_color)
        `)
        .eq('id', divisionId)
        .single()

      if (!div) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setDivision(div)

      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          match_code,
          bracket_type,
          round_label,
          display_label,
          placement_min,
          placement_max,
          source_a_type,
          source_a_ref,
          source_b_type,
          source_b_ref,
          score_a,
          score_b,
          status,
          winner_id,
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
          venue:venues(name, short_name),
          time_slot:time_slots(scheduled_start)
        `)
        .eq('division_id', divisionId)
        .in('bracket_type', ['championship', 'consolation'])
        .order('match_code')

      if (error) {
        console.error(error)
        setBracket(null)
        setLoading(false)
        return
      }

      if ((matches ?? []).length > 0) {
        setBracket(layoutDualBracket(matches ?? []))
      } else {
        setBracket(null)
      }

      setLoading(false)
    }

    load()
  }, [divisionId])

  useEffect(() => {
    if (!divisionId) return

    const channel = supabase
      .channel('bracket-live-' + divisionId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'division_id=eq.' + divisionId,
        },
        async () => {
          const { data: matches } = await supabase
            .from('matches')
            .select(`
              id,
              match_code,
              bracket_type,
              round_label,
              display_label,
              placement_min,
              placement_max,
              source_a_type,
              source_a_ref,
              source_b_type,
              source_b_ref,
              score_a,
              score_b,
              status,
              winner_id,
              team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
              team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
              venue:venues(name, short_name),
              time_slot:time_slots(scheduled_start)
            `)
            .eq('division_id', divisionId)
            .in('bracket_type', ['championship', 'consolation'])
            .order('match_code')

          setBracket(layoutDualBracket(matches ?? []))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [divisionId])

  if (loading) return <PageLoader />

  if (notFound) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '64px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Division not found
        </p>
      </div>
    )
  }

  const tournament = division?.tournament
  const color = tournament?.primary_color ?? '#8b5cf6'
  const {
    nodes = [],
    edges = [],
    titles = [],
    svgW = 600,
    svgH = 400,
    champion,
    second,
    third,
  } = bracket ?? {}

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {tournament && (
              <Link to={'/t/' + tournament.slug} style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                <ChevronLeft size={18} />
              </Link>
            )}
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {division?.name} Bracket
              </h1>
              {tournament && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  {tournament.name}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {tournament && (
              <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
                <Link
                  to={'/t/' + tournament.slug + '/schedule'}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-raised)',
                  }}
                >
                  Schedule
                </Link>
                <Link
                  to={'/t/' + tournament.slug + '/standings/' + divisionId}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-raised)',
                  }}
                >
                  Standings
                </Link>
              </div>
            )}

            <button
              onClick={() => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)))}
              style={{
                padding: 6,
                borderRadius: 8,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
              }}
            >
              <ZoomOut size={15} />
            </button>

            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                width: 40,
                textAlign: 'center',
                fontFamily: 'monospace',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))}
              style={{
                padding: 6,
                borderRadius: 8,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
              }}
            >
              <ZoomIn size={15} />
            </button>
          </div>
        </div>
      </div>

      {champion && (
        <div style={{ background: color + '12', borderBottom: '1px solid ' + color + '25', padding: '16px 24px' }}>
          <div
            style={{
              maxWidth: 1400,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trophy size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fbbf24' }}>
                    Champion
                  </p>
                  <Link
                    to={'/t/' + tournament?.slug + '/team/' + champion.id}
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                      textDecoration: 'none',
                    }}
                  >
                    {champion.name}
                  </Link>
                </div>
              </div>

              {second && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Medal size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Runner-up
                    </p>
                    <Link
                      to={'/t/' + tournament?.slug + '/team/' + second.id}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                      }}
                    >
                      {second.name}
                    </Link>
                  </div>
                </div>
              )}

              {third && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Medal size={16} style={{ color: '#b45309', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      3rd Place
                    </p>
                    <Link
                      to={'/t/' + tournament?.slug + '/team/' + third.id}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                      }}
                    >
                      {third.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '28px 20px 48px' }}>
        {!bracket || nodes.length === 0 ? (
          <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Trophy size={40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Bracket not yet available
            </p>
            <p style={{ fontSize: 13 }}>
              The bracket will appear once the championship and consolation brackets are generated.
            </p>
          </div>
        ) : (
          <div
            style={{
              transformOrigin: 'top left',
              transform: 'scale(' + zoom + ')',
              width: svgW,
              height: svgH,
              transition: 'transform 0.15s',
            }}
          >
            <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
              {titles.map(t => (
                <text
                  key={t.id}
                  x={t.x}
                  y={t.y}
                  textAnchor={t.anchor}
                  fontSize={16}
                  fontWeight="700"
                  fill={themeColors.textPrimary}
                  style={{ fontFamily: 'DM Sans, system-ui', letterSpacing: '-0.02em' }}
                >
                  {t.label}
                </text>
              ))}

              {edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke={themeColors.border} strokeWidth={2} />
              ))}

              {nodes.map(node => (
                <BracketNode key={node.id} node={node} primaryColor={color} themeColors={themeColors} />
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

function BracketNode({ node, primaryColor, themeColors }) {
  const { x, y, match, team_a, team_b, team_a_source, team_b_source, label } = node
  const isLive = match?.status === 'in_progress'
  const isDone = match?.status === 'complete' || match?.status === 'forfeit'
  const winnerId = match?.winner_id
  const isFinal = (match?.placement_min === 1 && match?.placement_max === 2) || label === 'Gold Medal Game'
  const isBronze = (match?.placement_min === 3 && match?.placement_max === 4) || label === 'Bronze Medal Game'

  const cardStroke = isLive ? '#22c55e' : isFinal ? primaryColor : themeColors.border
  const cardFill = isLive ? 'rgba(34,197,94,0.06)' : isFinal ? primaryColor + '0d' : themeColors.bgSurface
  const strokeW = isLive || isFinal ? 1.5 : 1

  return (
    <g>
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={11} ry={11} fill={cardFill} stroke={cardStroke} strokeWidth={strokeW} />

      {(isFinal || isBronze) && (
        <text
          x={x + NODE_W / 2}
          y={y - 6}
          textAnchor="middle"
          fontSize={9}
          fontWeight="700"
          fill={isFinal ? primaryColor : '#b45309'}
          style={{ fontFamily: 'DM Sans, system-ui', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {label}
        </text>
      )}

      {isLive && (
        <circle cx={x + NODE_W - 12} cy={y + 12} r={4} fill="#22c55e" opacity={0.9}>
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}

      <NodeTeamRow
        x={x}
        y={y}
        team={team_a}
        source={team_a_source}
        score={match?.score_a}
        isWinner={isDone && winnerId && team_a && winnerId === team_a.id}
        isLoser={isDone && winnerId && team_a && winnerId !== team_a.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
        themeColors={themeColors}
      />

      <line
        x1={x + 8}
        y1={y + NODE_H / 2}
        x2={x + NODE_W - 8}
        y2={y + NODE_H / 2}
        stroke={themeColors.border}
        strokeWidth={1}
      />

      <NodeTeamRow
        x={x}
        y={y + NODE_H / 2}
        team={team_b}
        source={team_b_source}
        score={match?.score_b}
        isWinner={isDone && winnerId && team_b && winnerId === team_b.id}
        isLoser={isDone && winnerId && team_b && winnerId !== team_b.id}
        showScore={isLive || isDone}
        primaryColor={primaryColor}
        themeColors={themeColors}
      />

      {!isLive && !isDone && match?.time_slot?.scheduled_start && (
        <text
          x={x + NODE_W / 2}
          y={y + NODE_H + 13}
          textAnchor="middle"
          fontSize={9}
          fill={themeColors.textMuted}
          style={{ fontFamily: 'DM Sans, system-ui' }}
        >
          {new Date(match.time_slot.scheduled_start).toLocaleTimeString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Toronto',
          })}
          {match?.venue?.short_name ? ' · ' + match.venue.short_name : ''}
        </text>
      )}
    </g>
  )
}

function NodeTeamRow({ x, y, team, source, score, isWinner, isLoser, showScore, primaryColor, themeColors }) {
  const rowH = NODE_H / 2
  const dotColor = team?.primary_color ?? themeColors.textMuted
  const opacity = isLoser ? 0.35 : 1
  const nameStr = team ? team.name ?? team.short_name ?? 'TBD' : prettifySource(source)
  const teamLink = team?.id ? '/t/' + (window._bracketSlug ?? '') + '/team/' + team.id : null
  const truncated = nameStr.length > 18 ? nameStr.slice(0, 17) + '..' : nameStr
  const textColor = isWinner ? primaryColor : themeColors.textPrimary
  const fontWeight = isWinner ? '700' : '500'
  const fontSize = isWinner ? 13 : 12

  return (
    <g opacity={opacity}>
      {isWinner && (
        <rect x={x + 1} y={y + 1} width={NODE_W - 2} height={rowH - 1} rx={10} fill={primaryColor} opacity={0.12} />
      )}

      <circle cx={x + 14} cy={y + rowH / 2} r={4} fill={dotColor} />

      <text
        x={x + 25}
        y={y + rowH / 2 + 1}
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={textColor}
        style={{
          fontFamily: 'DM Sans, system-ui, sans-serif',
          cursor: teamLink ? 'pointer' : 'default',
          textDecoration: teamLink ? 'underline' : 'none',
          textDecorationColor: 'rgba(232,255,71,0.3)',
        }}
        onClick={teamLink ? () => (window.location.href = teamLink) : undefined}
      >
        {truncated}
      </text>

      {showScore && score !== undefined && score !== null && (
        <text
          x={x + NODE_W - 10}
          y={y + rowH / 2 + 1}
          dominantBaseline="middle"
          textAnchor="end"
          fontSize={isWinner ? 15 : 13}
          fontWeight={isWinner ? '800' : '600'}
          fill={isWinner ? primaryColor : themeColors.textMuted}
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          {score}
        </text>
      )}
    </g>
  )
}

function prettifySource(source) {
  if (!source) return 'TBD'

  if (/^1[A-Z]$/.test(source)) return `1st ${source.slice(1)}`
  if (/^2[A-Z]$/.test(source)) return `2nd ${source.slice(1)}`
  if (/^3[A-Z]$/.test(source)) return `3rd ${source.slice(1)}`
  if (/^4[A-Z]$/.test(source)) return `4th ${source.slice(1)}`

  if (/^X\d+$/.test(source)) return source
  if (/^P\d+$/.test(source)) return source
  if (/^C\d+$/.test(source)) return source

  if (source.startsWith('Winner ')) return source
  if (source.startsWith('Loser ')) return source

  return source
}

function sourceLabel(type, ref) {
  if (!type || !ref) return 'TBD'

  if (type === 'pool_place') return prettifySource(ref)
  if (type === 'winner') return `Winner ${ref}`
  if (type === 'loser') return `Loser ${ref}`

  return ref
}

function roundOrder(matchCode) {
  if (!matchCode) return 99

  if (/^P[1-4]$/.test(matchCode)) return 1
  if (/^P[5-8]$/.test(matchCode)) return 2
  if (/^P(9|10|11|12)$/.test(matchCode)) return 3

  if (/^C[1-4]$/.test(matchCode)) return 1
  if (/^C[5-8]$/.test(matchCode)) return 2
  if (/^C(9|10|11|12)$/.test(matchCode)) return 3

  return 99
}

function matchPosition(matchCode) {
  if (!matchCode) return 1

  const n = Number(matchCode.replace(/[^\d]/g, ''))

  if (matchCode.startsWith('P')) {
    if (n >= 1 && n <= 4) return n
    if (n >= 5 && n <= 8) return n - 4
    if (n >= 9 && n <= 12) return n - 8
  }

  if (matchCode.startsWith('C')) {
    if (n >= 1 && n <= 4) return n
    if (n >= 5 && n <= 8) return n - 4
    if (n >= 9 && n <= 12) return n - 8
  }

  return 1
}

function layoutDualBracket(matches) {
  const championshipMatches = matches
    .filter(m => m.bracket_type === 'championship')
    .sort(compareMatches)

  const consolationMatches = matches
    .filter(m => m.bracket_type === 'consolation')
    .sort(compareMatches)

  const roundsCount = 3
  const singleBracketWidth = PADDING * 2 + roundsCount * NODE_W + (roundsCount - 1) * H_GAP
  const totalWidth = singleBracketWidth * 2 + BRACKET_GAP
  const leftOffsetX = 0
  const rightOffsetX = singleBracketWidth + BRACKET_GAP

  const champLayout = layoutSingleBracket({
    matches: championshipMatches,
    offsetX: leftOffsetX,
    offsetY: 0,
    mirrored: false,
    title: 'Championship Bracket',
    titleAlign: 'start',
  })

  const consLayout = layoutSingleBracket({
    matches: consolationMatches,
    offsetX: rightOffsetX,
    offsetY: 0,
    mirrored: true,
    title: 'Consolation Bracket',
    titleAlign: 'end',
  })

  const nodes = [...champLayout.nodes, ...consLayout.nodes]
  const edges = [...champLayout.edges, ...consLayout.edges]
  const titles = [...champLayout.titles, ...consLayout.titles]
  const svgW = totalWidth
  const svgH = Math.max(champLayout.svgH, consLayout.svgH)

  return {
    nodes,
    edges,
    titles,
    svgW,
    svgH,
    champion: champLayout.champion,
    second: champLayout.second,
    third: champLayout.third,
  }
}

function layoutSingleBracket({ matches, offsetX = 0, offsetY = 0, mirrored = false, title = '', titleAlign = 'start' }) {
  const grouped = {
    1: matches.filter(m => roundOrder(m.match_code) === 1),
    2: matches.filter(m => roundOrder(m.match_code) === 2),
    3: matches.filter(m => roundOrder(m.match_code) === 3),
  }

  const rounds = {}
  for (const roundNum of [1, 2, 3]) {
    rounds[roundNum] = grouped[roundNum]
      .sort((a, b) => matchPosition(a.match_code) - matchPosition(b.match_code))
      .map((m, idx) => ({
        id: m.id,
        match: m,
        round: roundNum,
        position: idx + 1,
        team_a: m.team_a,
        team_b: m.team_b,
        team_a_source: sourceLabel(m.source_a_type, m.source_a_ref),
        team_b_source: sourceLabel(m.source_b_type, m.source_b_ref),
        label: m.display_label ?? m.round_label,
        match_code: m.match_code,
      }))
  }

  const flatNodes = Object.values(rounds).flat()

  const nodes = flatNodes.map(n => ({
    ...n,
    x: nodeXForBracket(n.round, offsetX, mirrored),
    y: nodeY(n, rounds) + offsetY + TITLE_Y_PAD,
  }))

  const edges = []
  for (const next of nodes) {
    if (next.round === 1) continue

    const prevRoundNodes = nodes.filter(n => n.round === next.round - 1)
    const pos = next.position
    const src1 = prevRoundNodes.find(n => n.position === (pos - 1) * 2 + 1)
    const src2 = prevRoundNodes.find(n => n.position === (pos - 1) * 2 + 2)

    const tX = mirrored ? next.x + NODE_W : next.x
    const tY = next.y + NODE_H / 2

    for (const src of [src1, src2].filter(Boolean)) {
      const sX = mirrored ? src.x : src.x + NODE_W
      const sY = src.y + NODE_H / 2
      const midX = mirrored ? sX - H_GAP / 2 : sX + H_GAP / 2

      edges.push({
        d: mirrored
          ? `M${sX} ${sY} H${midX} V${tY} H${tX}`
          : `M${sX} ${sY} H${midX} V${tY} H${tX}`,
      })
    }
  }

  let champion = null
  let second = null
  let third = null

  const gold = matches.find(m => m.match_code === 'P9')
  const bronze = matches.find(m => m.match_code === 'P10')

  if (gold?.status === 'complete' && gold.winner_id) {
    champion = gold.team_a?.id === gold.winner_id ? gold.team_a : gold.team_b
    second = gold.team_a?.id === gold.winner_id ? gold.team_b : gold.team_a
  }

  if (bronze?.status === 'complete' && bronze.winner_id) {
    third = bronze.team_a?.id === bronze.winner_id ? bronze.team_a : bronze.team_b
  }

  const maxNodes = Math.max(...Object.values(rounds).map(r => r.length), 0)
  const svgH = offsetY + PADDING * 2 + TITLE_Y_PAD + maxNodes * (NODE_H + V_GAP) - V_GAP

  const titleX =
    titleAlign === 'end'
      ? offsetX + PADDING + (3 * NODE_W + 2 * H_GAP)
      : offsetX + PADDING

  const titles = title
    ? [
        {
          id: `title-${title}`,
          x: titleX,
          y: PADDING,
          label: title,
          anchor: titleAlign === 'end' ? 'end' : 'start',
        },
      ]
    : []

  return { nodes, edges, titles, svgH, champion, second, third }
}

function compareMatches(a, b) {
  const ao = roundOrder(a.match_code)
  const bo = roundOrder(b.match_code)
  if (ao !== bo) return ao - bo
  return matchPosition(a.match_code) - matchPosition(b.match_code)
}

function nodeXForBracket(round, offsetX = 0, mirrored = false) {
  const roundIndex = mirrored ? 3 - round : round - 1
  return offsetX + PADDING + roundIndex * (NODE_W + H_GAP)
}

function nodeY(slot, rounds) {
  const roundNodes = rounds[slot.round] ?? []
  const maxNodes = Math.max(...Object.values(rounds).map(r => r.length), 1)
  const totalH = roundNodes.length * NODE_H + (roundNodes.length - 1) * V_GAP
  const maxH = maxNodes * NODE_H + (maxNodes - 1) * V_GAP
  const startY = PADDING + TITLE_Y_PAD + (maxH - totalH) / 2
  const idx = roundNodes.findIndex(n => n.id === slot.id)
  return startY + idx * (NODE_H + V_GAP)
}