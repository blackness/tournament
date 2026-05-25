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
    bgBase: get('--bg-base') || '#0a0a0c',
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
  const [mobileFocusedRound, setMobileFocusedRound] = useState(null)
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

      const nextBracket = await loadBestBracketForDivision(divisionId)
      setBracket(nextBracket)
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
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: 'division_id=eq.' + divisionId,
        },
        async () => {
          const nextBracket = await loadBestBracketForDivision(divisionId)
          setBracket(nextBracket)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [divisionId])

  if (loading) return <PageLoader />

  if (notFound) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
    championshipLayout = null,
    consolationLayout = null,
  } = bracket ?? {}

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
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
              {tournament && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{tournament.name}</p>}
            </div>
          </div>

          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 40, textAlign: 'center', fontFamily: 'monospace' }}>
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
                    style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', textDecoration: 'none' }}
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
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}
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
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}
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
          <>
            <div className="md:hidden">
              {mobileFocusedRound ? (
                <MobileFocusedRoundView
                  focusedRound={mobileFocusedRound}
                  tournamentSlug={tournament?.slug}
                  onBack={() => setMobileFocusedRound(null)}
                />
              ) : (
                <MobileOverviewView
                  championshipLayout={championshipLayout}
                  consolationLayout={consolationLayout}
                  themeColors={themeColors}
                  primaryColor={color}
                  onSelectRound={setMobileFocusedRound}
                />
              )}
            </div>

            <div className="hidden md:block">
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}

async function loadBestBracketForDivision(divisionId) {
  const { data: bracketMatches, error } = await supabase
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
      round,
      match_number,
      team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
      team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
      venue:venues(name, short_name),
      time_slot:time_slots(scheduled_start)
    `)
    .eq('division_id', divisionId)
    .in('bracket_type', ['championship', 'consolation'])
    .order('match_number')

  if (error) {
    console.error(error)
    return null
  }

  if ((bracketMatches ?? []).length > 0) {
    return layoutDualBracket(bracketMatches ?? [])
  }

  const { data: legacyMatches, error: legacyError } = await supabase
    .from('matches')
    .select(`
      id,
      round_label,
      score_a,
      score_b,
      status,
      winner_id,
      phase,
      match_number,
      team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
      team_b:tournament_teams!team_b_id(id, name, short_name, primary_color),
      venue:venues(name, short_name),
      time_slot:time_slots(scheduled_start)
    `)
    .eq('division_id', divisionId)
    .eq('phase', 2)
    .is('bracket_type', null)
    .neq('status', 'cancelled')

  if (legacyError) {
    console.error(legacyError)
    return null
  }

  if ((legacyMatches ?? []).length > 0) {
    return layoutLegacyBracket(legacyMatches ?? [])
  }

  return null
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
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={11}
        ry={11}
        fill={cardFill}
        stroke={cardStroke}
        strokeWidth={strokeW}
      />

      {node.match_code && (
        <g>
          <rect
            x={x + 10}
            y={y - 10}
            rx={8}
            ry={8}
            width={34}
            height={18}
            fill={themeColors.bgBase}
            stroke={themeColors.border}
            strokeWidth={1}
          />
          <text
            x={x + 27}
            y={y + 2}
            textAnchor="middle"
            fontSize={9}
            fontWeight="700"
            fill={themeColors.textMuted}
            style={{ fontFamily: 'DM Sans, system-ui', letterSpacing: '0.08em' }}
          >
            {node.match_code}
          </text>
        </g>
      )}

      {(isFinal || isBronze || label) && (
        <text
          x={x + NODE_W / 2}
          y={y - 6}
          textAnchor="middle"
          fontSize={9}
          fontWeight="700"
          fill={isFinal ? primaryColor : isBronze ? '#b45309' : themeColors.textMuted}
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

function normalizeLayoutForMobile(layout) {
  if (!layout?.nodes?.length) return layout

  const minX = Math.min(...layout.nodes.map(n => n.x))
  const minY = Math.min(...layout.nodes.map(n => n.y))

  const shiftX = minX - PADDING
  const shiftY = minY - (PADDING + TITLE_Y_PAD)

  const nodes = layout.nodes.map(node => ({
    ...node,
    x: node.x - shiftX,
    y: node.y - shiftY,
  }))

  const edges = layout.edges.map(edge => ({
    ...edge,
    d: shiftPath(edge.d, shiftX, shiftY),
  }))

  const maxRight = Math.max(...nodes.map(n => n.x + NODE_W))
  const maxBottom = Math.max(...nodes.map(n => n.y + NODE_H))

  return {
    ...layout,
    nodes,
    edges,
    svgW: maxRight + PADDING,
    svgH: maxBottom + PADDING,
  }
}

function shiftPath(path, shiftX, shiftY) {
  return path
    .replace(/M([0-9.-]+) ([0-9.-]+)/g, (_, x, y) => `M${Number(x) - shiftX} ${Number(y) - shiftY}`)
    .replace(/H([0-9.-]+)/g, (_, x) => `H${Number(x) - shiftX}`)
    .replace(/V([0-9.-]+)/g, (_, y) => `V${Number(y) - shiftY}`)
}

function MobileOverviewView({ championshipLayout, consolationLayout, themeColors, primaryColor, onSelectRound }) {
  return (
    <div className="space-y-5">
      <MobileOverviewBracket
        title="Championship Bracket"
        layout={championshipLayout}
        themeColors={themeColors}
        primaryColor={primaryColor}
        bracketType="championship"
        onSelectRound={onSelectRound}
      />

      <MobileOverviewBracket
        title="Consolation Bracket"
        layout={consolationLayout}
        themeColors={themeColors}
        primaryColor={primaryColor}
        bracketType="consolation"
        onSelectRound={onSelectRound}
      />
    </div>
  )
}

function MobileOverviewBracket({ title, layout, themeColors, primaryColor, bracketType, onSelectRound }) {
  if (!layout?.nodes?.length) return null

  const mobileLayout = normalizeLayoutForMobile(layout)
  const rounds = getRoundsFromNodes(mobileLayout.nodes)
  const scale = 0.32
  const scaledW = mobileLayout.svgW * scale
  const scaledH = mobileLayout.svgH * scale

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        <span className="text-[11px] text-[var(--text-muted)]">Tap a round</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {rounds.map(round => (
          <button
            key={round.round}
            onClick={() =>
              onSelectRound({
                bracketType,
                round: round.round,
                title: round.title,
                matches: round.matches,
              })
            }
            className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
          >
            {round.title}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-2">
        <div style={{ width: scaledW, height: scaledH, minWidth: scaledW }}>
          <div
            style={{
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
              width: mobileLayout.svgW,
              height: mobileLayout.svgH,
            }}
          >
            <svg width={mobileLayout.svgW} height={mobileLayout.svgH} xmlns="http://www.w3.org/2000/svg">
              {mobileLayout.edges.map((e, i) => (
                <path key={i} d={e.d} fill="none" stroke={themeColors.border} strokeWidth={2} />
              ))}

              {mobileLayout.nodes.map(node => (
                <BracketNode key={node.id} node={node} primaryColor={primaryColor} themeColors={themeColors} />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

function MobileFocusedRoundView({ focusedRound, tournamentSlug, onBack }) {
  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]"
      >
        ← Back to full bracket
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {focusedRound.bracketType === 'championship' ? 'Championship Bracket' : 'Consolation Bracket'}
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
          {focusedRound.title}
        </h2>
      </div>

      <div className="space-y-3">
        {focusedRound.matches.map(node => (
          <MobileFocusedMatchCard key={node.id} node={node} tournamentSlug={tournamentSlug} />
        ))}
      </div>
    </div>
  )
}

function MobileFocusedMatchCard({ node, tournamentSlug }) {
  const { match, team_a, team_b, team_a_source, team_b_source, label, match_code } = node
  const isDone = match?.status === 'complete' || match?.status === 'forfeit'
  const winnerId = match?.winner_id

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      {match_code && (
        <div className="absolute -top-2 left-3 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--text-muted)]">
          {match_code}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </div>
        <MobileStatusBadge status={match?.status} />
      </div>

      <div className="space-y-2">
        <MobileTeamRow
          team={team_a}
          source={team_a_source}
          score={match?.score_a}
          isWinner={isDone && winnerId && team_a && winnerId === team_a.id}
          isLoser={isDone && winnerId && team_a && winnerId !== team_a.id}
          tournamentSlug={tournamentSlug}
        />
        <MobileTeamRow
          team={team_b}
          source={team_b_source}
          score={match?.score_b}
          isWinner={isDone && winnerId && team_b && winnerId === team_b.id}
          isLoser={isDone && winnerId && team_b && winnerId !== team_b.id}
          tournamentSlug={tournamentSlug}
        />
      </div>

      {match?.time_slot?.scheduled_start && (
        <div className="mt-3 text-[11px] text-[var(--text-muted)]">
          {new Date(match.time_slot.scheduled_start).toLocaleTimeString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Toronto',
          })}
          {match?.venue?.short_name ? ' · ' + match.venue.short_name : ''}
        </div>
      )}
    </div>
  )
}

function MobileTeamRow({ team, source, score, isWinner, isLoser, tournamentSlug }) {
  const name = team ? team.short_name ?? team.name ?? 'TBD' : prettifySource(source)
  const href = team?.id ? `/t/${tournamentSlug}/team/${team.id}` : null

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2"
      style={{ opacity: isLoser ? 0.45 : 1 }}
    >
      <div className="min-w-0 flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: team?.primary_color ?? 'var(--text-muted)' }}
        />
        {href ? (
          <a
            href={href}
            className="truncate text-sm font-medium text-[var(--text-primary)] underline decoration-[rgba(232,255,71,0.3)]"
          >
            {name}
          </a>
        ) : (
          <span className={`truncate text-sm font-medium ${isWinner ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
            {name}
          </span>
        )}
      </div>

      {score !== undefined && score !== null && (
        <span className={`text-sm font-bold tabular-nums ${isWinner ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

function MobileStatusBadge({ status }) {
  if (status === 'in_progress') {
    return (
      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-500">
        Live
      </span>
    )
  }

  if (status === 'complete' || status === 'forfeit') {
    return (
      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
        Final
      </span>
    )
  }

  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
      Scheduled
    </span>
  )
}

function getRoundsFromNodes(nodes) {
  const grouped = {}

  for (const node of nodes) {
    if (!node?.round) continue
    if (!grouped[node.round]) grouped[node.round] = []
    grouped[node.round].push(node)
  }

  return Object.entries(grouped)
    .map(([round, matches]) => ({
      round: Number(round),
      title: mobileRoundTitle(Number(round)),
      matches: matches.sort((a, b) => matchPosition(a.match) - matchPosition(b.match)),
    }))
    .sort((a, b) => a.round - b.round)
}

function mobileRoundTitle(round) {
  if (round === 1) return 'Quarter-finals'
  if (round === 2) return 'Semi-finals'
  if (round === 3) return 'Finals'
  return `Round ${round}`
}

function prettifySource(source) {
  if (!source) return 'TBD'

  if (/^[A-Z][1-4]$/.test(source)) {
    const pool = source[0]
    const place = source[1]
    const placeText =
      place === '1' ? '1st' :
      place === '2' ? '2nd' :
      place === '3' ? '3rd' :
      place === '4' ? '4th' :
      place

    return `${placeText} ${pool}`
  }

  if (/^P\d+$/.test(source)) return source
  if (/^X\d+$/.test(source)) return source
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

function friendlyMatchLabel(match) {
  const code = match?.match_code
  if (!code) return match?.display_label ?? match?.round_label ?? 'Match'

  const custom = {
    P17: '5th Place Game',
    P18: '7th Place Game',
    P19: '11th Place Game',
    P20: '9th Place Game',
    P21: '13th Place Game',
    P22: '15th Place Game',
    P23: 'Bronze Medal Game',
    P24: 'Gold Medal Game',
  }

  return custom[code] ?? match?.round_label ?? match?.display_label ?? code
}

function roundOrder(match) {
  const code = match?.match_code
  if (!code) return match?.round ?? 99

  if (['P1','P2','P3','P4','P5','P6','P7','P8'].includes(code)) return 1
  if (['P9','P10','P11','P12','P13','P14','P15','P16'].includes(code)) return 2
  if (['P17','P18','P19','P20','P21','P22','P23','P24'].includes(code)) return 3

  return match?.round ?? 99
}

function matchPosition(match) {
  const code = match?.match_code
  if (!code) return match?.match_number ?? 999

  const order = {
    // Consolation quarterfinals
    P1: 1, P2: 2, P3: 3, P4: 4,

    // Championship quarterfinals
    P5: 1, P6: 2, P7: 3, P8: 4,

    // Consolation semis
    P9: 1, P10: 2, P11: 3, P12: 4,

    // Championship semis
    P13: 1, P14: 2, P15: 3, P16: 4,

    // Consolation finals
    P20: 1, P19: 2, P21: 3, P22: 4,

    // Championship finals
    P24: 1, P23: 2, P17: 3, P18: 4,
  }

  return order[code] ?? match?.match_number ?? 999
}

function compareMatches(a, b) {
  const ao = roundOrder(a)
  const bo = roundOrder(b)
  if (ao !== bo) return ao - bo
  return matchPosition(a) - matchPosition(b)
}

function layoutDualBracket(matches) {
  const championshipMatches = matches
    .filter(m => ['P5','P6','P7','P8','P13','P14','P15','P16','P17','P18','P23','P24'].includes(m.match_code))
    .sort(compareMatches)

  const consolationMatches = matches
    .filter(m => ['P1','P2','P3','P4','P9','P10','P11','P12','P19','P20','P21','P22'].includes(m.match_code))
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
    bracketType: 'championship',
  })

  const consLayout = layoutSingleBracket({
    matches: consolationMatches,
    offsetX: rightOffsetX,
    offsetY: 0,
    mirrored: true,
    title: 'Consolation Bracket',
    titleAlign: 'end',
    bracketType: 'consolation',
  })

  const nodes = [...champLayout.nodes, ...consLayout.nodes]
  const edges = [...champLayout.edges, ...consLayout.edges]
  const titles = [...champLayout.titles, ...consLayout.titles]
  const svgW = totalWidth
  const svgH = Math.max(champLayout.svgH, consLayout.svgH)

  const gold = matches.find(m => m.match_code === 'P24')
  const bronze = matches.find(m => m.match_code === 'P23')

  let champion = null
  let second = null
  let third = null

  if (gold?.status === 'complete' && gold.winner_id) {
    champion = gold.team_a?.id === gold.winner_id ? gold.team_a : gold.team_b
    second = gold.team_a?.id === gold.winner_id ? gold.team_b : gold.team_a
  }

  if (bronze?.status === 'complete' && bronze.winner_id) {
    third = bronze.team_a?.id === bronze.winner_id ? bronze.team_a : bronze.team_b
  }

  return {
    nodes,
    edges,
    titles,
    svgW,
    svgH,
    champion,
    second,
    third,
    championshipNodes: champLayout.nodes,
    consolationNodes: consLayout.nodes,
    championshipLayout: champLayout,
    consolationLayout: consLayout,
  }
}

function layoutSingleBracket({ matches, offsetX = 0, offsetY = 0, mirrored = false, title = '', titleAlign = 'start', bracketType = null }) {
  const grouped = {
    1: matches.filter(m => roundOrder(m) === 1).sort(compareMatches),
    2: matches.filter(m => roundOrder(m) === 2).sort(compareMatches),
    3: matches.filter(m => roundOrder(m) === 3).sort(compareMatches),
  }

  const rounds = {}
  for (const roundNum of [1, 2, 3]) {
    rounds[roundNum] = grouped[roundNum].map((m, idx) => ({
      id: m.id,
      match: m,
      round: roundNum,
      position: idx + 1,
      team_a: m.team_a,
      team_b: m.team_b,
      team_a_source: sourceLabel(m.source_a_type, m.source_a_ref),
      team_b_source: sourceLabel(m.source_b_type, m.source_b_ref),
      label: friendlyMatchLabel(m),
      match_code: m.match_code,
      bracket_type: bracketType ?? m.bracket_type,
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
        d: `M${sX} ${sY} H${midX} V${tY} H${tX}`,
      })
    }
  }

  const maxNodes = Math.max(...Object.values(rounds).map(r => r.length), 0)
  const svgH = offsetY + PADDING * 2 + TITLE_Y_PAD + maxNodes * (NODE_H + V_GAP) - V_GAP
  const svgW = PADDING * 2 + 3 * NODE_W + 2 * H_GAP

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

  return { nodes, edges, titles, svgH, svgW, bracketType }
}

function layoutLegacyBracket(matches) {
  const semiMatches = matches.filter(m =>
    (m.round_label ?? '').toLowerCase().includes('semi')
  )

  const goldMatch = matches.find(m =>
    (m.round_label ?? '').toLowerCase().includes('gold')
  )

  const bronzeMatch = matches.find(m =>
    (m.round_label ?? '').toLowerCase().includes('bronze')
  )

  const fifthMatch = matches.find(m =>
    (m.round_label ?? '').toLowerCase().includes('5th')
  )

  const leftX = PADDING
  const midX = PADDING + (NODE_W + H_GAP)

  const topY = PADDING + TITLE_Y_PAD + 20
  const gapY = NODE_H + 42

  const semi1 = semiMatches[0]
  const semi2 = semiMatches[1]

  const nodes = []
  const edges = []

  if (semi1) {
    nodes.push({
      id: semi1.id,
      x: leftX,
      y: topY,
      match: semi1,
      team_a: semi1.team_a,
      team_b: semi1.team_b,
      team_a_source: null,
      team_b_source: null,
      label: 'Semi Final',
    })
  }

  if (semi2) {
    nodes.push({
      id: semi2.id,
      x: leftX,
      y: topY + gapY * 2,
      match: semi2,
      team_a: semi2.team_a,
      team_b: semi2.team_b,
      team_a_source: null,
      team_b_source: null,
      label: 'Semi Final',
    })
  }

  if (goldMatch) {
    nodes.push({
      id: goldMatch.id,
      x: midX,
      y: topY + gapY,
      match: goldMatch,
      team_a: goldMatch.team_a,
      team_b: goldMatch.team_b,
      team_a_source: semi1 ? 'Winner SF1' : null,
      team_b_source: semi2 ? 'Winner SF2' : null,
      label: 'Gold Medal Game',
    })
  }

  if (bronzeMatch) {
    nodes.push({
      id: bronzeMatch.id,
      x: midX,
      y: topY + gapY * 2.2,
      match: bronzeMatch,
      team_a: bronzeMatch.team_a,
      team_b: bronzeMatch.team_b,
      team_a_source: semi1 ? 'Loser SF1' : null,
      team_b_source: semi2 ? 'Loser SF2' : null,
      label: 'Bronze Medal Game',
    })
  }

  if (semi1 && goldMatch) {
    const sX = leftX + NODE_W
    const sY = topY + NODE_H / 2
    const tX = midX
    const tY = topY + gapY + NODE_H / 2
    const mid = sX + H_GAP / 2
    edges.push({ d: `M${sX} ${sY} H${mid} V${tY} H${tX}` })
  }

  if (semi2 && goldMatch) {
    const sX = leftX + NODE_W
    const sY = topY + gapY * 2 + NODE_H / 2
    const tX = midX
    const tY = topY + gapY + NODE_H / 2
    const mid = sX + H_GAP / 2
    edges.push({ d: `M${sX} ${sY} H${mid} V${tY} H${tX}` })
  }

  if (fifthMatch) {
    nodes.push({
      id: fifthMatch.id,
      x: midX,
      y: topY + gapY * 3.5,
      match: fifthMatch,
      team_a: fifthMatch.team_a,
      team_b: fifthMatch.team_b,
      team_a_source: null,
      team_b_source: null,
      label: '5th Place Game',
    })
  }

  let champion = null
  let second = null
  let third = null

  if (goldMatch?.status === 'complete' && goldMatch.winner_id) {
    champion = goldMatch.team_a?.id === goldMatch.winner_id ? goldMatch.team_a : goldMatch.team_b
    second = goldMatch.team_a?.id === goldMatch.winner_id ? goldMatch.team_b : goldMatch.team_a
  }

  if (bronzeMatch?.status === 'complete' && bronzeMatch.winner_id) {
    third = bronzeMatch.team_a?.id === bronzeMatch.winner_id ? bronzeMatch.team_a : bronzeMatch.team_b
  }

  return {
    nodes,
    edges,
    titles: [
      {
        id: 'legacy-title',
        x: PADDING,
        y: PADDING,
        label: 'Legacy Bracket',
        anchor: 'start',
      },
    ],
    svgW: midX + NODE_W + PADDING,
    svgH: topY + gapY * 5 + NODE_H + PADDING,
    champion,
    second,
    third,
  }
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