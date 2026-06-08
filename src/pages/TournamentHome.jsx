import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronRight, MapPin, Calendar, ChevronLeft, Clock, Trophy, Search, X } from 'lucide-react'
import { isFavorite, toggleFavorite } from './TeamPage'
import { buildMatchesByCode, resolveMatchParticipants } from '../lib/matchParticipants'
import { loadStandingsByPool } from '../lib/standingsByPool'
import { ActiveSessionTracker } from '../components/analytics/ActiveSessionTracker'
import { getMatchHighlight } from '../lib/highlights/matchHighlights'

const teamKey = slug => `myteam_${slug}`
const browsingKey = slug => `browsing_${slug}`

export function TournamentHome() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [tournament, setTournament] = useState(null)
  const [divisions, setDivisions] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([])
  const [standingsByPool, setStandingsByPool] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [myTeam, setMyTeam] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [isBrowsing, setIsBrowsing] = useState(false)
  const [search, setSearch] = useState('')

useEffect(() => {
    if (authLoading) return

    async function load() {
      try {
        setLoading(true)
        setNotFound(false)

        const { data: t, error } = await supabase
          .from('tournaments')
          .select('*, divisions(*)')
          .eq('slug', slug)
          .is('deleted_at', null)
          .single()

        if (error || !t) {
          setNotFound(true)
          return
        }

        const canViewTournament =
          !!t.is_public ||
          (user && t.director_id === user.id)

        if (!canViewTournament) {
          setNotFound(true)
          return
        }

        setTournament(t)
        setDivisions(t.divisions ?? [])

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
            pool_id,
            phase,
            bracket_position,
            match_code,
            bracket_type,
            source_a_type,
            source_a_ref,
            source_b_type,
            source_b_ref,
            team_a:tournament_teams!team_a_id(id, name, short_name, seed, primary_color),
            team_b:tournament_teams!team_b_id(id, name, short_name, seed, primary_color),
            venue:venues(name, short_name, youtube_url),
            time_slot:time_slots(scheduled_start)
          `)
          .eq('tournament_id', t.id)
          .neq('status', 'cancelled')
          .order('time_slot(scheduled_start)')

        setMatches(m ?? [])

        const { data: tm } = await supabase
          .from('tournament_teams')
          .select('id, name, short_name, seed, primary_color, pool_id, pool:pools(name)')
          .eq('tournament_id', t.id)
          .order('name')

        setTeams(tm ?? [])

        if (t.divisions?.length > 0) {
          const { data: st } = await supabase
            .from('pool_standings_display')
            .select('*')
            .in('division_id', t.divisions.map(d => d.id))
            .order('pool_id')
            .order('rank')

          setStandings(st ?? [])

          let mergedStandings = {}
          for (const div of t.divisions) {
            const map = await loadStandingsByPool(div.id)
            mergedStandings = { ...mergedStandings, ...map }
          }
          setStandingsByPool(mergedStandings)
        }

        if (t.myteam_enabled !== false) {
          const savedTeam = localStorage.getItem(teamKey(slug))
          const savedBrowsing = localStorage.getItem(browsingKey(slug))

          if (savedTeam) {
            try {
              const parsed = JSON.parse(savedTeam)
              const found = (tm ?? []).find(x => x.id === parsed.id)
              if (found) {
                setMyTeam(found)
                return
              } else {
                localStorage.removeItem(teamKey(slug))
              }
            } catch {
              localStorage.removeItem(teamKey(slug))
            }
          }

          if (savedBrowsing) {
            setIsBrowsing(true)
            return
          }

          setShowPicker(true)
        }
      } catch (err) {
        console.error(err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [slug, user?.id, authLoading])
  
  useEffect(() => {
    if (!tournament) return

    const ch = supabase
      .channel('home-rt-' + tournament.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'tournament_id=eq.' + tournament.id,
        },
        async () => {
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
              pool_id,
              phase,
              bracket_position,
              match_code,
              bracket_type,
              source_a_type,
              source_a_ref,
              source_b_type,
              source_b_ref,
              team_a:tournament_teams!team_a_id(id, name, short_name, seed, primary_color),
              team_b:tournament_teams!team_b_id(id, name, short_name, seed, primary_color),
              venue:venues(name, short_name, youtube_url),
              time_slot:time_slots(scheduled_start)
            `)
            .eq('tournament_id', tournament.id)
            .neq('status', 'cancelled')
            .order('time_slot(scheduled_start)')

          setMatches(m ?? [])

          if (divisions?.length > 0) {
            const { data: st } = await supabase
              .from('pool_standings_display')
              .select('*')
              .in('division_id', divisions.map(d => d.id))
              .order('pool_id')
              .order('rank')

            setStandings(st ?? [])
          }

          let mergedStandings = {}
          for (const div of divisions ?? []) {
            const map = await loadStandingsByPool(div.id)
            mergedStandings = { ...mergedStandings, ...map }
          }
          setStandingsByPool(mergedStandings)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [tournament?.id, divisions])

  function pickTeam(team) {
    setMyTeam(team)
    setShowPicker(false)
    setSearch('')
    localStorage.setItem(teamKey(slug), JSON.stringify(team))
    localStorage.removeItem(browsingKey(slug))

    if (tournament?.id && team?.id) {
      supabase
        .from('team_follows')
        .insert({ tournament_id: tournament.id, team_id: team.id })
        .then(() => {})
    }
  }

  function goBrowse() {
    setIsBrowsing(true)
    setShowPicker(false)
    setSearch('')
    localStorage.setItem(browsingKey(slug), '1')
    localStorage.removeItem(teamKey(slug))

    if (tournament?.id) {
      supabase
        .from('team_follows')
        .insert({ tournament_id: tournament.id, is_spectator: true })
        .then(() => {})
    }
  }

  function clearPreference() {
    setMyTeam(null)
    setIsBrowsing(false)
    setShowPicker(true)
    localStorage.removeItem(teamKey(slug))
    localStorage.removeItem(browsingKey(slug))
  }

  if (loading) return <PageLoader />

  if (notFound) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Tournament not found
        </p>
        <Link to="/tournaments" className="btn btn-secondary btn-sm">
          Browse tournaments
        </Link>
      </div>
    )
  }

  const color = tournament.primary_color ?? '#1a56db'
  const divId = divisions[0]?.id
  const myTeamEnabled = tournament.myteam_enabled !== false
  const liveMatches = matches.filter(m => m.status === 'in_progress')
  const tournamentDone = ['review', 'complete', 'archived'].includes(tournament?.status)
  const matchesByCode = buildMatchesByCode(matches)

  if (tournamentDone && divId) {
    window.location.replace('/t/' + slug + '/bracket/' + divId)
    return <PageLoader />
  }

  const resolvedMyMatches = myTeam
    ? matches
        .map(match => {
          const hasAssignedTeams = !!(match.team_a?.id && match.team_b?.id)

          const resolved = hasAssignedTeams
            ? {
                a: { team: match.team_a },
                b: { team: match.team_b },
                isProjected: false,
              }
            : resolveMatchParticipants({
                match,
                standingsByPool,
                matchesByCode,
                seedsLocked: false,
              })

          return { match, resolved }
        })
        .filter(({ resolved }) =>
          resolved.a.team?.id === myTeam.id || resolved.b.team?.id === myTeam.id
        )
    : []

  const myMatches = resolvedMyMatches.map(x => ({
    ...x.match,
    __resolved: x.resolved,
  }))

  const heroMatch =
    myMatches.find(m => m.status === 'in_progress') ??
    myMatches.find(m => m.status === 'scheduled')

  const myStanding = myTeam ? standings.find(s => s.team_id === myTeam.id) : null

  const filteredTeams = teams

console.log('CreateLiveGameModal divisions', divisions)
console.log('CreateLiveGameModal teams', teams)
console.log('filteredTeams', filteredTeams)

  const fmtTime = iso =>
    iso
      ? new Date(iso)
          .toLocaleTimeString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Toronto',
          })
          .replace(' AM', 'am')
          .replace(' PM', 'pm')
      : ''

  const fmtVenueTime = match => {
    const venue = match?.venue?.name ?? null
    const time = match?.time_slot?.scheduled_start ? fmtTime(match.time_slot.scheduled_start) : null

    if (venue && time) return `${venue} @ ${time}`
    if (venue) return venue
    if (time) return time
    return ''
  }

  const fmtDateRange = (start, end) => {
    if (!start) return ''

    const startDate = new Date(start + 'T12:00')
    const endDate = end ? new Date(end + 'T12:00') : null

    const startMonth = startDate.toLocaleDateString('en-CA', { month: 'short' })
    const startDay = startDate.getDate()
    const startYear = startDate.getFullYear()

    if (!endDate || start === end) {
      return `${startMonth} ${startDay}, ${startYear}`
    }

    const endMonth = endDate.toLocaleDateString('en-CA', { month: 'short' })
    const endDay = endDate.getDate()
    const endYear = endDate.getFullYear()

    const sameYear = startYear === endYear
    const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth()

    if (sameMonth) {
      return `${startMonth} ${startDay}–${endDay}, ${startYear}`
    }

    if (sameYear) {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
    }

    return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
  }

  const showMyTeam = myTeamEnabled && !!myTeam
  const showBrowsing = myTeamEnabled && !myTeam && isBrowsing
  const showOverview = !myTeamEnabled

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {tournament?.id && (
        <ActiveSessionTracker
          tournamentId={tournament.id}
          page="tournament_home"
          userId={user?.id ?? null}
        />
      )}

      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 0' }}>
          <Link
            to="/tournaments"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              marginBottom: 14,
            }}
          >
            <ChevronLeft size={13} /> All tournaments
          </Link>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {tournament.name}
                </h1>

                {liveMatches.length > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--live)',
                      background: 'var(--live-dim)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}
                  >
                    <span className="live-dot" /> Live
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Calendar size={11} />
                  {fmtDateRange(tournament.start_date, tournament.end_date)}
                </span>
                {tournament.venue_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={11} />
                    {tournament.venue_name}
                  </span>
                )}
              </p>
            </div>

            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {(tournament.name ?? '?')[0].toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', overflowX: 'auto' }}>
            {[
              myTeamEnabled ? ['My Team', null] : null,
              ['Schedule', `/t/${slug}/schedule`],
              divId ? ['Standings', `/t/${slug}/standings/${divId}`] : null,
              divId ? ['Bracket', `/t/${slug}/bracket/${divId}`] : null,
            ]
              .filter(Boolean)
              .map(([label, href]) =>
                href ? (
                  <Link
                    key={label}
                    to={href}
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      borderBottom: '2px solid transparent',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={label}
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color,
                      borderBottom: `2px solid ${color}`,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                )
              )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px 80px' }}>
        {user && (
          <Link
            to={`/t/${slug}/gameday`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(232,255,71,0.15)',
              borderRadius: 10,
              textDecoration: 'none',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              Scorekeeper / Staff entry
            </span>
            <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
          </Link>
        )}

        {liveMatches.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--live)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span className="live-dot" /> {liveMatches.length} game{liveMatches.length !== 1 ? 's' : ''} live now
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liveMatches.map(m => (
                <LiveMatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {showMyTeam && (
          <MyTeamView
            myTeam={myTeam}
            myStanding={myStanding}
            myMatches={myMatches}
            heroMatch={heroMatch}
            slug={slug}
            divId={divId}
            color={color}
            fmtTime={fmtTime}
            fmtVenueTime={fmtVenueTime}
            onClear={clearPreference}
          />
        )}

        {showBrowsing && (
          <BrowsingView
            matches={matches}
            liveMatches={liveMatches}
            slug={slug}
            divId={divId}
            color={color}
            fmtTime={fmtTime}
            fmtVenueTime={fmtVenueTime}
            onPickTeam={() => {
              setIsBrowsing(false)
              setShowPicker(true)
            }}
          />
        )}

        {showOverview && (
          <OverviewView
            matches={matches}
            slug={slug}
            divId={divId}
            color={color}
            fmtTime={fmtTime}
            fmtVenueTime={fmtVenueTime}
          />
        )}

        {myTeamEnabled && showPicker && !showMyTeam && !showBrowsing && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 14 }}>Select your team to personalize your experience</p>
          </div>
        )}
      </div>

      {showPicker && myTeamEnabled && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-base)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '20px 20px 12px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Which team are you following?
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {tournament.name}
                </p>
              </div>

              {(myTeam || isBrowsing) && (
                <button
                  onClick={() => setShowPicker(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search team or pool..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 10,
                  fontSize: 15,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
            <button
              onClick={goBrowse}
              style={{
                width: '100%',
                marginBottom: 16,
                padding: '16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-mid)',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Just spectating →
            </button>

            {Object.entries(
              filteredTeams.reduce((acc, t) => {
                const pool = t.pool?.name ?? 'Teams'
                if (!acc[pool]) acc[pool] = []
                acc[pool].push(t)
                return acc
              }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([poolName, poolTeams]) => (
                <div key={poolName} style={{ marginBottom: 20 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: 8,
                      paddingLeft: 2,
                    }}
                  >
                    {poolName}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {poolTeams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => pickTeam(team)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 16px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            background: team.primary_color ?? '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {(team.short_name ?? team.name)[0]}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {team.name}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            {team.short_name}
                          </p>
                        </div>

                        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {filteredTeams.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 14 }}>
                No teams found
              </p>
            )}
            
          </div>
        </div>
      )}
    </div>
  )
}

function MyTeamView({ myTeam, myStanding, myMatches, heroMatch, slug, divId, color, fmtTime, fmtVenueTime, onClear }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: myTeam.primary_color ?? color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {(myTeam.short_name ?? myTeam.name)[0]}
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {myTeam.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {myTeam.pool?.name ?? ''}
            </p>
          </div>
        </div>

        {myStanding && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              ['Rank', myStanding.rank ?? '—', null],
              ['W–L', `${myStanding.wins ?? 0}–${myStanding.losses ?? 0}`, null],
              [
                '+/–',
                ((myStanding.point_diff ?? 0) > 0 ? '+' : '') + (myStanding.point_diff ?? 0),
                (myStanding.point_diff ?? 0) > 0
                  ? '#4ade80'
                  : (myStanding.point_diff ?? 0) < 0
                    ? '#f87171'
                    : null,
              ],
            ].map(([label, val, valColor]) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  minWidth: 40,
                }}
              >
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: valColor ?? 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1,
                    fontFamily: 'DM Mono, monospace',
                  }}
                >
                  {val}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {heroMatch && (
        <HeroMatchCard
          match={heroMatch}
          myTeamId={myTeam.id}
          color={color}
          fmtTime={fmtTime}
          fmtVenueTime={fmtVenueTime}
        />
      )}

      <div style={{ marginTop: 18 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          All games
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myMatches.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No games scheduled yet
            </p>
          ) : (
            myMatches.map(m => (
              <MatchRow
                key={m.id}
                match={m}
                myTeamId={myTeam.id}
                fmtTime={fmtTime}
                fmtVenueTime={fmtVenueTime}
                isHero={m.id === heroMatch?.id && m.status !== 'complete' && m.status !== 'forfeit'}
              />
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
        <QuickBtn to={`/t/${slug}/schedule`} label="Schedule" icon={<Clock size={15} />} color={color} />
        {divId && <QuickBtn to={`/t/${slug}/standings/${divId}`} label="Standings" icon={<Trophy size={15} />} color={color} />}
        {divId && <QuickBtn to={`/t/${slug}/bracket/${divId}`} label="Bracket" icon={<ChevronRight size={15} />} color={color} />}
        <QuickBtn to={`/t/${slug}/team/${myTeam.id}`} label="Team page" icon={<ChevronRight size={15} />} color={color} />
      </div>

      <button
        onClick={onClear}
        style={{
          marginTop: 20,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '8px 0',
          textDecoration: 'underline',
          width: '100%',
          textAlign: 'center',
        }}
      >
        Change my team
      </button>
    </>
  )
}

function BrowsingView({ matches, liveMatches, slug, divId, color, fmtTime, fmtVenueTime, onPickTeam }) {
  const display = liveMatches.length > 0 ? liveMatches : matches.filter(m => m.status === 'scheduled').slice(0, 8)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <QuickBtn to={`/t/${slug}/schedule`} label="Schedule" icon={<Clock size={15} />} color={color} />
        {divId && <QuickBtn to={`/t/${slug}/standings/${divId}`} label="Standings" icon={<Trophy size={15} />} color={color} />}
        {divId && <QuickBtn to={`/t/${slug}/bracket/${divId}`} label="Bracket" icon={<ChevronRight size={15} />} color={color} />}
      </div>

      {display.length > 0 && (
        <>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 10,
            }}
          >
            {liveMatches.length > 0 ? 'Live now' : 'Upcoming games'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {display.map(m => (
              <Link
                key={m.id}
                to={`/score/${m.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: `1px solid ${m.status === 'in_progress' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                  borderRadius: 12,
                  textDecoration: 'none',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {m.status === 'in_progress' && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--live)', letterSpacing: '0.08em' }}>
                        LIVE
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtVenueTime(m)}
                    </span>
                  </div>

                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {formatSeedName(m.team_a)} vs {formatSeedName(m.team_b)}
                  </p>

                  {m.round_label && !m.round_label.startsWith('Pool') && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        padding: '2px 6px',
                        borderRadius: 20,
                        marginTop: 2,
                        display: 'inline-block',
                      }}
                    >
                      {m.round_label}
                    </span>
                  )}
                </div>

                {m.status === 'in_progress' && (
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {m.score_a ?? 0}–{m.score_b ?? 0}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      <button
        onClick={onPickTeam}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '8px 0',
          textDecoration: 'underline',
          width: '100%',
          textAlign: 'center',
        }}
      >
        Follow a specific team
      </button>
    </>
  )
}

function OverviewView({ matches, slug, divId, color, fmtTime, fmtVenueTime }) {
  const upcoming = matches.filter(m => m.status === 'scheduled').slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {upcoming.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 10,
            }}
          >
            Upcoming
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcoming.map(m => (
              <Link
                key={m.id}
                to={`/score/${m.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    width: 52,
                    flexShrink: 0,
                  }}
                >
                  {fmtTime(m.time_slot?.scheduled_start)}
                </span>
                <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatSeedName(m.team_a)} vs {formatSeedName(m.team_b)}
                  </p>
                  {m.round_label && !m.round_label.startsWith('Pool') && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        padding: '2px 6px',
                        borderRadius: 20,
                        marginTop: 2,
                        display: 'inline-block',
                      }}
                    >
                      {m.round_label}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.venue?.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <QuickBtn to={`/t/${slug}/schedule`} label="Schedule" icon={<Clock size={15} />} color={color} />
        {divId && <QuickBtn to={`/t/${slug}/standings/${divId}`} label="Standings" icon={<Trophy size={15} />} color={color} />}
        {divId && <QuickBtn to={`/t/${slug}/bracket/${divId}`} label="Bracket" icon={<ChevronRight size={15} />} color={color} />}
      </div>
    </div>
  )
}

function HeroMatchCard({ match: m, myTeamId, color, fmtTime, fmtVenueTime }) {
  const isLive = m.status === 'in_progress'
  const isDone = m.status === 'complete' || m.status === 'forfeit'
  const resolved = m.__resolved
  const resolvedA = resolved?.a?.team ?? m.team_a
  const resolvedB = resolved?.b?.team ?? m.team_b
  const hasAssignedTeams = !!(m.team_a?.id && m.team_b?.id)
  const isProjectedMatch = hasAssignedTeams ? false : !!resolved?.isProjected
  const specialHighlight = getMatchHighlight(m.match_code)

  const isMyA = resolvedA?.id === myTeamId
  const my = isMyA ? (m.score_a ?? 0) : (m.score_b ?? 0)
  const th = isMyA ? (m.score_b ?? 0) : (m.score_a ?? 0)
  const opp = isMyA ? resolvedB : resolvedA
  const won = isDone && my > th
  const lost = isDone && my < th

  return (
    <Link
      to={`/score/${m.id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: specialHighlight
          ? specialHighlight.bg
          : isProjectedMatch
          ? 'rgba(245,158,11,0.06)'
          : 'var(--bg-surface)',
        border: `2px solid ${
          isLive
            ? 'rgba(34,197,94,0.4)'
            : specialHighlight
            ? specialHighlight.border
            : isProjectedMatch
            ? 'rgba(245,158,11,0.45)'
            : color + '40'
        }`,
        borderRadius: 16,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 4,
        boxShadow: specialHighlight ? `0 6px 20px ${specialHighlight.shadow}` : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: isLive ? 'var(--live)' : specialHighlight ? specialHighlight.color : color,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          {isLive ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--live)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span className="live-dot" /> Live now
            </span>
          ) : (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Clock size={11} />
              {fmtVenueTime(m)}
            </span>
          )}

          {specialHighlight && (
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
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
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
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

          {m.round_label && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {m.round_label}
            </p>
          )}

          {isProjectedMatch && m.display_label && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {m.display_label}
            </p>
          )}
        </div>

        {isDone && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: won ? '#4ade80' : lost ? '#f87171' : 'var(--text-muted)',
              background: won ? 'rgba(74,222,128,0.1)' : lost ? 'rgba(248,113,113,0.1)' : 'var(--bg-raised)',
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {won ? 'Win' : lost ? 'Loss' : 'Draw'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 2px' }}>vs</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {formatSeedName(opp)}
          </p>
          {!isLive && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {fmtVenueTime(m)}
            </p>
          )}
        </div>

        {(isLive || isDone) && (
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1,
                fontFamily: 'DM Mono, monospace',
              }}
            >
              <span style={{ color: my > th ? '#4ade80' : 'inherit' }}>{my}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 28 }}> – </span>
              <span style={{ color: th > my ? '#f87171' : 'inherit' }}>{th}</span>
            </p>
            <p
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                margin: '4px 0 0',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              us – them
            </p>
          </div>
        )}
      </div>

      {isLive && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--live)',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          Tap to watch live scores →
        </div>
      )}
    </Link>
  )
}

function MatchRow({ match: m, myTeamId, fmtTime, fmtVenueTime, isHero }) {
  const isLive = m.status === 'in_progress'
  const isDone = m.status === 'complete' || m.status === 'forfeit'
  const resolved = m.__resolved
  const resolvedA = resolved?.a?.team ?? m.team_a
  const resolvedB = resolved?.b?.team ?? m.team_b
  const hasAssignedTeams = !!(m.team_a?.id && m.team_b?.id)
  const isProjectedMatch = hasAssignedTeams ? false : !!resolved?.isProjected
  const specialHighlight = getMatchHighlight(m.match_code)

  const isMyA = resolvedA?.id === myTeamId
  const my = isMyA ? (m.score_a ?? 0) : (m.score_b ?? 0)
  const th = isMyA ? (m.score_b ?? 0) : (m.score_a ?? 0)
  const opp = isMyA ? resolvedB : resolvedA
  const won = isDone && my > th
  const lost = isDone && my < th

  if (isHero) return null

  return (
    <Link
      to={`/score/${m.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: specialHighlight
          ? specialHighlight.bg
          : isProjectedMatch
          ? 'rgba(245,158,11,0.06)'
          : 'var(--bg-surface)',
        border: `1px solid ${
          isLive
            ? 'rgba(34,197,94,0.3)'
            : specialHighlight
            ? specialHighlight.border
            : isProjectedMatch
            ? 'rgba(245,158,11,0.45)'
            : 'var(--border)'
        }`,
        borderRadius: 12,
        textDecoration: 'none',
        gap: 10,
        boxShadow: specialHighlight ? `0 6px 20px ${specialHighlight.shadow}` : 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          {isLive && (
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--live)', letterSpacing: '0.08em' }}>
              LIVE
            </span>
          )}

          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtVenueTime(m)}
          </span>
        </div>

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          vs {formatSeedName(opp)}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {specialHighlight && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: specialHighlight.color,
                background: specialHighlight.badgeBg,
                border: `1px solid ${specialHighlight.border}`,
                padding: '2px 6px',
                borderRadius: 20,
                display: 'inline-block',
              }}
            >
              {specialHighlight.label}
            </span>
          )}

          {isProjectedMatch && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.12)',
                padding: '2px 6px',
                borderRadius: 20,
                display: 'inline-block',
              }}
            >
              {m.bracket_type === 'play_in' ? 'Projected Crossover' : 'Projected'}
            </span>
          )}

          {m.round_label && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: specialHighlight ? specialHighlight.color : 'var(--accent)',
                background: specialHighlight ? specialHighlight.badgeBg : 'var(--accent-dim)',
                border: specialHighlight ? `1px solid ${specialHighlight.border}` : 'none',
                padding: '2px 6px',
                borderRadius: 20,
                display: 'inline-block',
              }}
            >
              {m.round_label}
            </span>
          )}

          {isProjectedMatch && m.display_label && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {m.display_label}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {(isLive || isDone) && (
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            <span style={{ color: my > th ? '#4ade80' : 'inherit' }}>{my}</span>
            <span style={{ color: 'var(--text-muted)' }}>–</span>
            <span style={{ color: th > my ? '#f87171' : 'inherit' }}>{th}</span>
          </span>
        )}

        {isDone && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: won ? '#4ade80' : lost ? '#f87171' : 'var(--text-muted)',
              background: won ? 'rgba(74,222,128,0.1)' : lost ? 'rgba(248,113,113,0.1)' : 'transparent',
              padding: '2px 8px',
              borderRadius: 20,
              border: `1px solid ${
                won
                  ? 'rgba(74,222,128,0.2)'
                  : lost
                    ? 'rgba(248,113,113,0.2)'
                    : 'transparent'
              }`,
            }}
          >
            {won ? 'W' : lost ? 'L' : 'D'}
          </span>
        )}
      </div>
    </Link>
  )
}

function LiveMatchCard({ match: m }) {
  const navigate = useNavigate()
  const teamA = m.team_a
  const teamB = m.team_b

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate('/score/' + m.id)}
      onKeyDown={e => e.key === 'Enter' && navigate('/score/' + m.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-raised)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 12,
        padding: '10px 14px',
        cursor: 'pointer',
        gap: 10,
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 40 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: 'var(--live)', letterSpacing: '0.08em' }}>
          <span className="live-dot" /> LIVE
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          {m.venue?.name ?? ''}
        </span>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: teamA?.primary_color ?? 'var(--border-mid)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {formatSeedName(teamA)}
          </span>
        </div>

        <div
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {m.score_a ?? 0} – {m.score_b ?? 0}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {formatSeedName(teamB)}
          </span>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: teamB?.primary_color ?? 'var(--border-mid)',
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {m.venue?.youtube_url && (
        <Link
          to={'/watch/' + m.id}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 16,
            background: '#dc2626',
          }}
          onClick={e => e.stopPropagation()}
        >
          ▶ Watch
        </Link>
      )}
    </div>
  )
}

function QuickBtn({ to, label, icon, color }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color }}>{icon}</span>
        {label}
      </span>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
    </Link>
  )
}

function formatSeedName(team) {
  if (!team) return 'TBD'
  const base = team.name ?? team.short_name ?? 'TBD'
  return team.seed != null ? `(${team.seed}) ${base}` : base
}