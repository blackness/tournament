import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Trophy, AlertTriangle, Check, Zap, Users } from 'lucide-react'

export function BracketGenerator() {
  const { tournamentId }              = useParams()
  const navigate                      = useNavigate()
  const [tournament, setTournament]   = useState(null)
  const [divisions, setDivisions]     = useState([])
  const [standings, setStandings]     = useState([])
  const [venues, setVenues]           = useState([])
  const [slots, setSlots]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(null) // divisionId
  const [generated, setGenerated]     = useState({})  // divisionId -> true
  const [error, setError]             = useState(null)
  const [bracketConfig, setBracketConfig] = useState({}) // divisionId -> { startSlotIdx }

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)

      const { data: divs } = await db.divisions.byTournament(tournamentId)
      setDivisions(divs ?? [])

      const { data: st } = await supabase
        .from('pool_standings_display')
        .select('*')
        .in('division_id', (divs ?? []).map(d => d.id))
        .order('pool_id, rank')
      setStandings(st ?? [])

      const { data: v } = await db.venues.byTournament(tournamentId)
      setVenues(v ?? [])

      // Only unassigned future slots
      const { data: s } = await supabase
        .from('time_slots')
        .select('*, venue:venues(id, name, short_name)')
        .eq('tournament_id', tournamentId)
        .order('scheduled_start')
      setSlots(s ?? [])

      setLoading(false)
    }
    load()
  }, [tournamentId])

  async function generateBracket(division) {
    setGenerating(division.id)
    setError(null)

    try {
      const divStandings = standings.filter(s => s.division_id === division.id)
      const advance = division.teams_advance_per_pool ?? 2

      // Group by pool, take top N
      const byPool = {}
      for (const s of divStandings) {
        if (!byPool[s.pool_id]) byPool[s.pool_id] = []
        byPool[s.pool_id].push(s)
      }

      // Serpentine seed: Pool A 1st, Pool B 1st, Pool B 2nd, Pool A 2nd...
      const poolList = Object.values(byPool)
      const seeds = []
      for (let i = 0; i < advance; i++) {
        for (let j = 0; j < poolList.length; j++) {
          const team = poolList[i % 2 === 0 ? j : poolList.length - 1 - j]?.[i]
          if (team) seeds.push(team)
        }
      }

      const n    = seeds.length
      const size = Math.pow(2, Math.ceil(Math.log2(n)))
      const numRounds = Math.log2(size)

      // Check for completed bracket matches before overwriting
      const { data: completedBracketMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('division_id', division.id)
        .eq('phase', 2)
        .eq('status', 'complete')

      if (completedBracketMatches?.length > 0) {
        const confirmed = window.confirm(
          'This division already has ' + completedBracketMatches.length + ' completed bracket game(s). ' +
          'Regenerating will delete all bracket results. Continue?'
        )
        if (!confirmed) return
      }

      // Delete existing bracket slots for this division
      await supabase.from('bracket_slots').delete().eq('division_id', division.id)

      // Delete existing phase-2 matches for this division
      await supabase.from('matches').delete()
        .eq('division_id', division.id)
        .eq('phase', 2)

      const crypto = globalThis.crypto
      const bracketSlots = []
      const matchRows = []

      // Build all rounds
      // Round 1: real matchups from seeding
      const seeded = [...seeds]
      while (seeded.length < size) seeded.push(null) // byes

      // Available slots for bracket games
      const startIdx = bracketConfig[division.id]?.startSlotIdx ?? 0
      const availableSlots = slots.slice(startIdx)
      let slotCursor = 0

      for (let i = 0; i < size / 2; i++) {
        const teamA = seeded[i]
        const teamB = seeded[size - 1 - i]
        const isBye = !teamB
        const nextSlot = availableSlots[slotCursor]
        slotCursor++

        const matchId = crypto.randomUUID()
        matchRows.push({
          id:            matchId,
          tournament_id: tournamentId,
          division_id:   division.id,
          phase:         2,
          round:         1,
          match_number:  i + 1,
          round_label:   size <= 4 ? 'Semi-final' : size <= 8 ? 'Quarter-final' : 'Round of ' + size,
          team_a_id:     teamA?.team_id ?? null,
          team_b_id:     isBye ? null : (teamB?.team_id ?? null),
          is_bye:        isBye,
          time_slot_id:  nextSlot?.id ?? null,
          venue_id:      nextSlot?.venue?.id ?? null,
          status:        isBye ? 'complete' : 'scheduled',
          winner_id:     isBye ? (teamA?.team_id ?? null) : null,
          score_a:       0,
          score_b:       0,
        })

        bracketSlots.push({
          id:            crypto.randomUUID(),
          division_id:   division.id,
          phase:         2,
          round:         1,
          position:      i + 1,
          bracket_side:  'winners',
          team_a_id:     teamA?.team_id ?? null,
          team_b_id:     isBye ? null : (teamB?.team_id ?? null),
          team_a_source: teamA ? ('Seed ' + (i + 1)) : 'TBD',
          team_b_source: isBye ? 'BYE' : (teamB ? ('Seed ' + (size - i)) : 'TBD'),
          label:         size <= 4 ? 'Semi-final ' + (i + 1) : null,
        })
      }

      // Subsequent rounds - empty slots
      for (let r = 2; r <= numRounds; r++) {
        const count = size / Math.pow(2, r)
        const label = r === numRounds ? 'Final' : r === numRounds - 1 ? 'Semi-final' : 'Quarter-final'

        for (let i = 0; i < count; i++) {
          const nextSlot = availableSlots[slotCursor]
          slotCursor++
          const matchId = crypto.randomUUID()

          matchRows.push({
            id:            matchId,
            tournament_id: tournamentId,
            division_id:   division.id,
            phase:         2,
            round:         r,
            match_number:  i + 1,
            round_label:   label,
            team_a_id:     null,
            team_b_id:     null,
            is_bye:        false,
            time_slot_id:  nextSlot?.id ?? null,
            venue_id:      nextSlot?.venue?.id ?? null,
            status:        'scheduled',
          })

          bracketSlots.push({
            id:           crypto.randomUUID(),
            division_id:  division.id,
            phase:        2,
            round:        r,
            position:     i + 1,
            bracket_side: 'winners',
            team_a_id:    null,
            team_b_id:    null,
            team_a_source: 'Winner G' + (i * 2 + 1),
            team_b_source: 'Winner G' + (i * 2 + 2),
            label,
          })
        }
      }

      // Third place game
      if (division.third_place_game && numRounds >= 2) {
        const nextSlot = availableSlots[slotCursor]
        const matchId = crypto.randomUUID()
        matchRows.push({
          id: matchId, tournament_id: tournamentId, division_id: division.id,
          phase: 2, round: numRounds, match_number: 2,
          round_label: '3rd Place', team_a_id: null, team_b_id: null,
          is_bye: false, time_slot_id: nextSlot?.id ?? null,
          venue_id: nextSlot?.venue?.id ?? null, status: 'scheduled',
        })
        bracketSlots.push({
          id: crypto.randomUUID(), division_id: division.id, phase: 2,
          round: numRounds, position: 2, bracket_side: 'consolation',
          team_a_id: null, team_b_id: null,
          team_a_source: 'Loser SF1', team_b_source: 'Loser SF2', label: '3rd Place',
        })
      }

      // Wire up winner_next_match_id on matches
      for (let r = 1; r < numRounds; r++) {
        const thisRoundMatches = matchRows.filter(m => m.round === r && m.phase === 2 && m.round_label !== '3rd Place')
        const nextRoundMatches = matchRows.filter(m => m.round === r + 1 && m.phase === 2 && m.round_label !== '3rd Place')
        for (const m of thisRoundMatches) {
          const nextIdx   = Math.ceil(m.match_number / 2) - 1
          const nextMatch = nextRoundMatches[nextIdx]
          if (nextMatch) {
            m.winner_next_match_id = nextMatch.id
            m.winner_next_slot     = m.match_number % 2 === 1 ? 'team_a' : 'team_b'
          }
        }
      }

      // Wire up loser_next_match_id for semi-finalists -> 3rd place game
      if (division.third_place_game && numRounds >= 2) {
        const thirdPlaceMatch = matchRows.find(m => m.round_label === '3rd Place')
        const semiFinalsRound = numRounds - 1
        const semiMatches = matchRows
          .filter(m => m.round === semiFinalsRound && m.phase === 2 && m.round_label !== '3rd Place')
          .sort((a, b) => a.match_number - b.match_number)

        if (thirdPlaceMatch && semiMatches.length >= 2) {
          semiMatches[0].loser_next_match_id = thirdPlaceMatch.id
          semiMatches[0].loser_next_slot     = 'team_a'
          semiMatches[1].loser_next_match_id = thirdPlaceMatch.id
          semiMatches[1].loser_next_slot     = 'team_b'
        }
      }

      // Insert bracket slots
      if (bracketSlots.length > 0) {
        const { error: bErr } = await supabase.from('bracket_slots').insert(bracketSlots)
        if (bErr) throw bErr
      }

      // Insert matches
      if (matchRows.length > 0) {
        const { error: mErr } = await supabase.from('matches').insert(matchRows)
        if (mErr) throw mErr
      }

      setGenerated(prev => ({ ...prev, [division.id]: { rounds: numRounds, teams: seeds.length, matches: matchRows.length } }))
    } catch (err) {
      setError('Failed to generate bracket for ' + division.name + ': ' + err.message)
      console.error(err)
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{maxWidth:720}}>
      <div className="flex items-center gap-3">
        <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Generate Brackets</h1>
          <p className="text-sm text-[var(--text-muted)]">{tournament?.name}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
        <div>
          Generate brackets after pool play is complete. This creates bracket matches seeded from current standings.
          Existing bracket games for a division will be replaced.
        </div>
      </div>

      {divisions.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p>No divisions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {divisions.map(div => {
            const divStandings = standings.filter(s => s.division_id === div.id)
            const advance = div.teams_advance_per_pool ?? 2
            const byPool  = {}
            for (const s of divStandings) {
              if (!byPool[s.pool_id]) byPool[s.pool_id] = []
              byPool[s.pool_id].push(s)
            }
            const numPools     = Object.keys(byPool).length
            const advancers    = Object.values(byPool).flatMap(p => p.slice(0, advance))
            const isReady      = advancers.length >= 2
            const result       = generated[div.id]
            const poolsComplete = Object.values(byPool).every(p =>
              p.length > 0 && p.every(t => t.games_played > 0)
            )

            return (
              <div key={div.id} className=" border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-[var(--text-primary)]">{div.name}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                      {div.format_type?.replace(/_/g, ' ')} - {numPools} pool{numPools !== 1 ? 's' : ''}, top {advance} advance
                    </p>
                  </div>
                  {result ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <Check size={16} />
                      Generated ({result.teams} teams, {result.matches} games)
                    </div>
                  ) : (
                    <button
                      onClick={() => generateBracket(div)}
                      disabled={!isReady || generating === div.id}
                      className="btn-primary btn btn-sm disabled:opacity-40"
                    >
                      {generating === div.id ? (
                        <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                      ) : (
                        <><Zap size={14} /> Generate bracket</>
                      )}
                    </button>
                  )}
                </div>

                {/* Standings preview */}
                <div className="px-5 py-3">
                  {!isReady ? (
                    <p className="text-sm text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Need at least 2 teams with standings to generate
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {!poolsComplete && (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-2">
                          <AlertTriangle size={11} /> Some pool games not yet complete - bracket will use current standings
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(byPool).map(([poolId, teams]) => (
                          <div key={poolId}>
                            <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">{teams[0]?.pool_name}</p>
                            {teams.slice(0, advance + 1).map((t, idx) => (
                              <div key={t.team_id} className={`flex items-center gap-2 py-1 text-xs ${idx < advance ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                                <span className="w-4 text-right text-[var(--text-muted)]">{idx + 1}</span>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.primary_color ?? '#e5e7eb' }} />
                                <span className={idx < advance ? 'font-semibold' : ''}>{t.team_short_name ?? t.team_name}</span>
                                <span className="text-[var(--text-muted)] ml-auto">{t.wins}-{t.losses}</span>
                                {idx === advance - 1 && (
                                  <div className="w-full border-t border-dashed border-[var(--border)] absolute" />
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Slot picker */}
                      <div className="mt-3 flex items-center gap-2">
                        <p className="text-xs text-[var(--text-muted)]">Start bracket from slot:</p>
                        <select
                          className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)]"
                          value={bracketConfig[div.id]?.startSlotIdx ?? 0}
                          onChange={e => setBracketConfig(prev => ({ ...prev, [div.id]: { startSlotIdx: Number(e.target.value) } }))}
                        >
                          {slots.map((s, idx) => (
                            <option key={s.id} value={idx}>
                              {formatTime(s.scheduled_start)} - {s.venue?.short_name ?? s.venue?.name}
                            </option>
                          ))}
                          <option value={slots.length}>No auto-schedule</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Link to bracket view */}
                {result && (
                  <div className="px-5 py-3 border-t border-[var(--border)] ">
                    <Link
                      to={'/t/' + tournament?.slug + '/bracket/' + div.id}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Trophy size={13} /> View bracket
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
