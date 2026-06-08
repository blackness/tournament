import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, MapPin, ChevronRight } from 'lucide-react'
import { buildMatchesByCode, resolveMatchParticipants } from '../lib/matchParticipants'
import { loadStandingsByPool } from '../lib/standingsByPool'
import { getMatchHighlight } from '../lib/highlights/matchHighlights'
import { getMatchSourceLabels } from '../lib/playoffs/matchSourceLabels'

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'unplayed', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
  { key: 'all', label: 'All' },
]

export function SchedulePage() {
  const { slug } = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [venues, setVenues] = useState([])
  const [standingsByPool, setStandingsByPool] = useState({})
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState('unplayed')
  const [quickView, setQuickView] = useState(null)
  const [fieldFilter, setFieldFilter] = useState('all')

  const storageKey = slug ? `schedule-view:${slug}` : null

  useEffect(() => {
    if (!storageKey) return

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      if (saved.tab) setTab(saved.tab)
      if (saved.quickView ?? null) setQuickView(saved.quickView ?? null)
      if (saved.fieldFilter) setFieldFilter(saved.fieldFilter)
    } catch (err) {
      console.warn('Failed to read schedule view state', err)
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          tab,
          quickView,
          fieldFilter,
        })
      )
    } catch (err) {
      console.warn('Failed to save schedule view state', err)
    }
  }, [storageKey, tab, quickView, fieldFilter])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, slug, primary_color, status')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single()

      if (!t) {
        setLoading(false)
        return
      }

      setTournament(t)

      const { data: m } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          score_a,
          score_b,
          winner_id,
          round_label,
          display_label,
          match_code,
          bracket_type,
          phase,
          round,
          match_number,
          source_a_type,
          source_a_ref,
          source_b_type,
          source_b_ref,
          team_a:tournament_teams!team_a_id(id, name, short_name, seed, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, seed, primary_color),
          venue:venues(id, name, short_name, youtube_url),
          division:divisions(id, name),
          pool:pools(id, name),
          time_slot:time_slots(id, scheduled_start, scheduled_end)
        `)
        .eq('tournament_id', t.id)
        .neq('status', 'cancelled')

      const sortedMatches = (m ?? []).slice().sort((a, b) => {
        const aTime = a.time_slot?.scheduled_start ? new Date(a.time_slot.scheduled_start).getTime() : Infinity
        const bTime = b.time_slot?.scheduled_start ? new Date(b.time_slot.scheduled_start).getTime() : Infinity
        if (aTime !== bTime) return aTime - bTime

        const aVenue = a.venue?.name ?? ''
        const bVenue = b.venue?.name ?? ''
        if (aVenue !== bVenue) return aVenue.localeCompare(bVenue)

        const aMatch = a.match_number ?? 9999
        const bMatch = b.match_number ?? 9999
        return aMatch - bMatch
      })

      setMatches(sortedMatches)

      const divisionIds = [...new Set(sortedMatches.map(m => m.division?.id).filter(Boolean))]
      let mergedStandings = {}

      for (const divId of divisionIds) {
        const map = await loadStandingsByPool(divId)
        mergedStandings = { ...mergedStandings, ...map }
      }

      setStandingsByPool(mergedStandings)

      const liveCount = sortedMatches.filter(x => x.status === 'in_progress').length
      const unplayedCount = sortedMatches.filter(x => x.status === 'scheduled' && x.time_slot?.scheduled_start).length

      const hadSavedView = !!localStorage.getItem(`schedule-view:${slug}`)
      if (!hadSavedView) {
        if (liveCount > 0) setTab('live')
        else if (unplayedCount > 0) setTab('unplayed')
        else setTab('finished')
      }

      const { data: v } = await supabase
        .from('venues')
        .select('id, name, short_name')
        .eq('tournament_id', t.id)
        .order('sort_order')

      setVenues(v ?? [])
      setLoading(false)
    }

    load()
  }, [slug])

  useEffect(() => {
    if (!tournament) return

    const channel = supabase
      .channel('schedule-' + tournament.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'tournament_id=eq.' + tournament.id,
        },
        async payload => {
          const updated = payload.new

          const { data: fresh } = await supabase
            .from('matches')
            .select(`
              id,
              status,
              score_a,
              score_b,
              winner_id,
              round_label,
              display_label,
              match_code,
              bracket_type,
              phase,
              round,
              match_number,
              source_a_type,
              source_a_ref,
              source_b_type,
              source_b_ref,
              team_a:tournament_teams!team_a_id(id, name, short_name, seed, primary_color),
              team_b:tournament_teams!team_b_id(id, name, short_name, seed, primary_color),
              venue:venues(id, name, short_name, youtube_url),
              division:divisions(id, name),
              pool:pools(id, name),
              time_slot:time_slots(id, scheduled_start, scheduled_end)
            `)
            .eq('id', updated.id)
            .single()

          if (!fresh) return

          setMatches(prev => {
            const next = prev.some(m => m.id === fresh.id)
              ? prev.map(m => (m.id === fresh.id ? fresh : m))
              : [...prev, fresh]

            return next.slice().sort((a, b) => {
              const aTime = a.time_slot?.scheduled_start ? new Date(a.time_slot.scheduled_start).getTime() : Infinity
              const bTime = b.time_slot?.scheduled_start ? new Date(b.time_slot.scheduled_start).getTime() : Infinity
              if (aTime !== bTime) return aTime - bTime

              const aVenue = a.venue?.name ?? ''
              const bVenue = b.venue?.name ?? ''
              if (aVenue !== bVenue) return aVenue.localeCompare(bVenue)

              const aMatch = a.match_number ?? 9999
              const bMatch = b.match_number ?? 9999
              return aMatch - bMatch
            })
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [tournament?.id])

  const byTab = useMemo(
    () => ({
      live: matches.filter(m => m.status === 'in_progress'),
      unplayed: matches.filter(m => m.status === 'scheduled' && m.time_slot?.scheduled_start),
      finished: matches.filter(m => ['complete', 'forfeit'].includes(m.status)),
      all: matches,
    }),
    [matches]
  )

  const matchesByCode = useMemo(() => buildMatchesByCode(matches), [matches])

  const normalizedTeams = useMemo(
    () =>
      matches.flatMap(m => {
        const arr = []
        if (m.team_a?.id) {
          arr.push({
            id: m.team_a.id,
            name: m.team_a.name,
            short_name: m.team_a.short_name,
          })
        }
        if (m.team_b?.id) {
          arr.push({
            id: m.team_b.id,
            name: m.team_b.name,
            short_name: m.team_b.short_name,
          })
        }
        return arr
      }),
    [matches]
  )

  const counts = {
    live: byTab.live.length,
    unplayed: byTab.unplayed.length,
    finished: byTab.finished.length,
    all: byTab.all.length,
  }

  const availableMatchDates = useMemo(() => {
    return [...new Set(
      matches
        .map(m => getMatchDate(m))
        .filter(Boolean)
    )].sort()
  }, [matches])

  const quickViews = useMemo(() => {
    const views = []

    availableMatchDates.forEach((date, index) => {
      views.push({
        key: `day:${date}`,
        label: `Day ${index + 1}`,
      })
    })

    if (matches.some(m => m.bracket_type === 'championship')) {
      views.push({ key: 'bracket:championship', label: 'Championship' })
    }

    if (matches.some(m => m.bracket_type === 'consolation')) {
      views.push({ key: 'bracket:consolation', label: 'Consolation' })
    }

    if (matches.some(m => m.bracket_type === 'play_in')) {
      views.push({ key: 'bracket:play_in', label: 'Crossover' })
    }

    return views
  }, [availableMatchDates, matches])

  let filtered = byTab[tab] ?? []

  if (quickView?.startsWith('day:')) {
    const selectedDate = quickView.slice(4)
    filtered = filtered.filter(m => getMatchDate(m) === selectedDate)
  } else if (quickView?.startsWith('bracket:')) {
    const selectedBracketType = quickView.slice(8)
    filtered = filtered.filter(m => m.bracket_type === selectedBracketType)
  }

  if (fieldFilter !== 'all') {
    filtered = filtered.filter(m => m.venue?.id === fieldFilter)
  }

  const showFeatured = quickView == null && tab !== 'finished'
  const featuredMatches = showFeatured ? getFeaturedMatches(filtered) : []
  const featuredIds = new Set(featuredMatches.map(m => m.id))

  const groupedMatches = showFeatured
    ? filtered.filter(m => !featuredIds.has(m.id))
    : filtered

  const groups = groupByTime(groupedMatches, tab === 'finished')

  if (loading) return <PageLoader />

  if (!tournament) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)' }}>
        Tournament not found
      </div>
    )
  }

  const currentFieldLabel =
    fieldFilter === 'all'
      ? 'All Fields'
      : venues.find(v => v.id === fieldFilter)?.short_name ||
        venues.find(v => v.id === fieldFilter)?.name ||
        'Field'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
              <Link
                to={'/t/' + slug}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                }}
              >
                <ChevronLeft size={13} />
                {tournament.name}
              </Link>

              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>

              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Schedule
              </h1>
            </div>

            <button
              onClick={() => cycleFieldFilter(fieldFilter, venues, setFieldFilter)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: 'var(--text-secondary)',
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {currentFieldLabel}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CompactControlRow>
              {TABS.map(item => (
                <CompactToggle
                  key={item.key}
                  active={tab === item.key}
                  onClick={() => setTab(item.key)}
                  label={item.label}
                  count={counts[item.key]}
                  showLiveDot={item.key === 'live' && counts.live > 0}
                />
              ))}
            </CompactControlRow>

            <CompactControlRow>
              {quickViews.map(item => (
                <CompactToggle
                  key={item.key}
                  active={quickView === item.key}
                  onClick={() => setQuickView(prev => (prev === item.key ? null : item.key))}
                  label={item.label}
                />
              ))}
            </CompactControlRow>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px' }}>
        {featuredMatches.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Featured
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {featuredMatches.map(m => (
                <GameCard
                  key={'featured-' + m.id}
                  match={m}
                  featured
                  standingsByPool={standingsByPool}
                  matchesByCode={matchesByCode}
                  normalizedTeams={normalizedTeams}
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {tab === 'live'
                ? 'No games live right now'
                : tab === 'unplayed'
                ? 'No upcoming games'
                : tab === 'finished'
                ? 'No completed games yet'
                : 'No games'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(group => (
            <div key={group.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  {group.label}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {group.matches.length} game{group.matches.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.matches.map(m => (
                  <GameCard
                    key={m.id}
                    match={m}
                    standingsByPool={standingsByPool}
                    matchesByCode={matchesByCode}
                    normalizedTeams={normalizedTeams}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompactControlRow({ children }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
}

function CompactToggle({ active, onClick, label, count, showLiveDot = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        padding: '5px 8px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      {showLiveDot && <span className="live-dot" />}
      {label}
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 999,
            background: active ? 'rgba(255,255,255,0.16)' : 'var(--bg-hover)',
            color: active ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function cycleFieldFilter(current, venues, setFieldFilter) {
  const values = ['all', ...venues.map(v => v.id)]
  const idx = values.indexOf(current)
  const next = values[(idx + 1) % values.length]
  setFieldFilter(next)
}

function GameCard({
  match: m,
  featured = false,
  standingsByPool = {},
  matchesByCode = {},
  normalizedTeams = [],
}) {
  const isLive = m.status === 'in_progress'
  const isDone = ['complete', 'forfeit'].includes(m.status)
  const teamA = m.team_a
  const teamB = m.team_b
  const hasStream = !!m.venue?.youtube_url
  const hasAssignedTeams = !!(m.team_a?.id && m.team_b?.id)
  const specialHighlight = getMatchHighlight(m.match_code)

  const sourceLabels = getMatchSourceLabels({
    match: m,
    teams: normalizedTeams,
    pools: [],
  })

  const isBracketMatch = !!m.match_code || !!m.bracket_type

  const bracketBadge =
    m.bracket_type === 'play_in'
      ? 'Crossover'
      : m.bracket_type === 'championship'
      ? 'Championship'
      : m.bracket_type === 'consolation'
      ? 'Consolation'
      : null

  const resolved = hasAssignedTeams
    ? null
    : resolveMatchParticipants({
        match: m,
        standingsByPool,
        matchesByCode,
        seedsLocked: false,
      })

  const displayTeams = hasAssignedTeams
    ? {
        a: formatSeedName(m.team_a),
        b: formatSeedName(m.team_b),
        subA: null,
        subB: null,
      }
    : {
        a: resolved?.a?.primary || sourceLabels.aPrimary,
        b: resolved?.b?.primary || sourceLabels.bPrimary,
        subA: resolved?.a?.secondary,
        subB: resolved?.b?.secondary,
      }

  const isProjectedMatch = hasAssignedTeams ? false : !!resolved?.isProjected

  return (
    <div style={{ position: 'relative' }}>
      {hasStream && isLive && (
        <Link
          to={'/watch/' + m.id}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 20,
            background: '#dc2626',
            boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#fff',
              animation: 'pulse 1.5s infinite',
              display: 'inline-block',
            }}
          />
          Watch live
        </Link>
      )}

      <Link
        to={'/score/' + m.id}
        style={{
          display: 'block',
          background: specialHighlight
            ? specialHighlight.bg
            : isProjectedMatch
            ? 'rgba(245,158,11,0.06)'
            : featured
            ? 'var(--bg-raised)'
            : 'var(--bg-surface)',
          border: `1px solid ${
            isLive
              ? 'rgba(34,197,94,0.3)'
              : specialHighlight
              ? specialHighlight.border
              : isProjectedMatch
              ? 'rgba(245,158,11,0.45)'
              : featured
              ? 'var(--accent)'
              : 'var(--border)'
          }`,
          borderRadius: 14,
          overflow: 'hidden',
          textDecoration: 'none',
          boxShadow: specialHighlight ? `0 6px 20px ${specialHighlight.shadow}` : 'none',
        }}
      >
        {isLive ? (
          <div style={{ height: 2, background: 'var(--live)' }} />
        ) : specialHighlight ? (
          <div style={{ height: 2, background: specialHighlight.color }} />
        ) : null}

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12 }}>
            {(m.venue?.name || m.time_slot?.scheduled_start) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', minWidth: 0 }}>
                <MapPin size={10} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatVenueTime(m)}
                </span>
              </span>
            )}

            {m.pool && <span style={{ color: 'var(--text-muted)' }}>{m.pool.name}</span>}
            <div style={{ flex: 1 }} />

            {isLive && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--live)',
                }}
              >
                <span className="live-dot" /> Live
              </span>
            )}

            {isDone && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Final
              </span>
            )}
          </div>

          {specialHighlight && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: specialHighlight.color,
                  background: specialHighlight.badgeBg,
                  border: `1px solid ${specialHighlight.border}`,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                {specialHighlight.label}
              </span>
            </div>
          )}

          {isProjectedMatch && (
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#f59e0b',
                  background: 'rgba(245,158,11,0.12)',
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                {m.bracket_type === 'play_in' ? 'Projected Crossover' : 'Projected'}
              </span>
            </div>
          )}

          {isBracketMatch && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: hasAssignedTeams ? 0 : 4 }}>
                {bracketBadge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: specialHighlight ? specialHighlight.color : 'var(--accent)',
                      background: specialHighlight ? specialHighlight.badgeBg : 'var(--accent-dim)',
                      padding: '3px 8px',
                      borderRadius: 999,
                      border: specialHighlight ? `1px solid ${specialHighlight.border}` : 'none',
                    }}
                  >
                    {bracketBadge}
                  </span>
                )}

                {m.round_label && !hasAssignedTeams && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {m.round_label}
                  </span>
                )}
              </div>

              {m.display_label && !hasAssignedTeams && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {m.display_label}
                </div>
              )}
            </div>
          )}

          {isDone || isLive ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
              <TeamScore team={teamA} score={m.score_a} winner={isDone && m.winner_id === teamA?.id} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}> - </span>
              <TeamScore team={teamB} score={m.score_b} winner={isDone && m.winner_id === teamB?.id} right />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DisplayTeamPill
                primary={displayTeams.a}
                secondary={displayTeams.subA}
                color={hasAssignedTeams ? m.team_a?.primary_color : resolved?.a?.team?.primary_color}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>vs</span>
              <DisplayTeamPill
                primary={displayTeams.b}
                secondary={displayTeams.subB}
                color={hasAssignedTeams ? m.team_b?.primary_color : resolved?.b?.team?.primary_color}
              />
              <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }} />
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}

function TeamScore({ team, score, winner, right }) {
  const label = formatSeedName(team)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: right ? 'row-reverse' : 'row' }}>
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          flexShrink: 0,
          background: team?.primary_color ?? 'var(--border-mid)',
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: winner ? 700 : 400,
          color: winner ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: right ? 'right' : 'left',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 20,
          fontWeight: 700,
          color: winner ? 'var(--text-primary)' : 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        {score ?? 0}
      </span>
    </div>
  )
}

function DisplayTeamPill({ primary, secondary, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1, minWidth: 0 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: color ?? 'var(--border-mid)',
          marginTop: 5,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {primary || 'TBD'}
        </div>
        {secondary && secondary !== primary && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}

function formatSeedName(team) {
  if (!team) return 'TBD'
  const base = team.name ?? team.short_name ?? 'TBD'
  return team.seed != null ? `(${team.seed}) ${base}` : base
}

function groupByTime(matches, reverse = false) {
  const groups = {}

  for (const m of matches) {
    const start = m.time_slot?.scheduled_start

    let key = 'unscheduled'
    let label = 'Unscheduled'
    let sortValue = Number.MAX_SAFE_INTEGER

    if (start) {
      const date = new Date(start)

      const localDate = date.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Toronto',
      })

      const localHour = date.toLocaleTimeString('en-CA', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'America/Toronto',
      })

      key = `${localDate}-${localHour}`
      label = formatGroupTime(date)
      sortValue = date.getTime()
    }

    if (!groups[key]) {
      groups[key] = {
        key,
        label,
        sortValue,
        matches: [],
      }
    }

    groups[key].matches.push(m)
  }

  return Object.values(groups).sort((a, b) => {
    if (a.key === 'unscheduled') return 1
    if (b.key === 'unscheduled') return -1
    return reverse ? b.sortValue - a.sortValue : a.sortValue - b.sortValue
  })
}

function formatVenueTime(match) {
  const venue = match?.venue?.name ?? null
  const time = match?.time_slot?.scheduled_start ? formatTime(match.time_slot.scheduled_start) : null

  if (venue && time) return `${venue} @ ${time}`
  if (venue) return venue
  if (time) return time
  return 'TBD'
}

function formatTime(iso) {
  return new Date(iso)
    .toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto',
    })
    .replace(' AM', 'am')
    .replace(' PM', 'pm')
}

function formatGroupTime(d) {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  const time = d
    .toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto',
    })
    .replace(' AM', 'am')
    .replace(' PM', 'pm')

  const date = d.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Toronto',
  })

  return isToday ? time : date + ' · ' + time
}

function getMatchDate(match) {
  if (!match?.time_slot?.scheduled_start) return null
  return new Date(match.time_slot.scheduled_start).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Toronto',
  })
}

function getFeaturedMatches(matches) {
  const featuredCodes = ['P24', 'P23', 'P20', 'P21']
  return matches.filter(m => featuredCodes.includes(m.match_code))
}