import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { seed16TeamClassificationBracket } from '../../lib/bracketSeeder'
import { resolveBracketSources } from '../../lib/bracketResolver'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Trophy, AlertTriangle, Check, Zap } from 'lucide-react'

export function BracketGenerator() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [divisions, setDivisions] = useState([])
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [generated, setGenerated] = useState({})
  const [error, setError] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [resultModal, setResultModal] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)

      const { data: divs } = await db.divisions.byTournament(tournamentId)
      setDivisions(divs ?? [])

      if ((divs ?? []).length > 0) {
        const { data: st } = await supabase
          .from('pool_standings_display')
          .select('*')
          .in('division_id', divs.map(d => d.id))
          .order('pool_id, rank')

        setStandings(st ?? [])
      } else {
        setStandings([])
      }

      setLoading(false)
    }

    load()
  }, [tournamentId])

  async function generateBracket(division, { skipConfirm = false } = {}) {
    setGenerating(division.id)
    setError(null)

    try {
      const divStandings = standings.filter(s => s.division_id === division.id)

      if (divStandings.length === 0) {
        setError('No standings found for ' + division.name + '.')
        setGenerating(null)
        return
      }

      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id, status')
        .eq('division_id', division.id)
        .in('bracket_type', ['play_in', 'championship', 'consolation'])

      const completedCount = (existingMatches ?? []).filter(m => m.status === 'complete').length
      const scheduledCount = (existingMatches ?? []).filter(m => m.status === 'scheduled').length

      if (existingMatches?.length > 0 && !skipConfirm) {
        setGenerating(null)
        setConfirmModal({
          division,
          completedCount,
          scheduledCount,
        })
        return
      }

      await seed16TeamClassificationBracket({
        tournamentId,
        divisionId: division.id,
        clearExisting: true,
      })

      await resolveBracketSources({
        tournamentId,
        divisionId: division.id,
      })

      const { data: seededMatches, error: seededErr } = await supabase
        .from('matches')
        .select('id, bracket_type')
        .eq('division_id', division.id)
        .in('bracket_type', ['play_in', 'championship', 'consolation'])

      if (seededErr) throw seededErr

      const publicBracketMatches = (seededMatches ?? []).filter(
        m => m.bracket_type === 'championship' || m.bracket_type === 'consolation'
      )

      setGenerated(prev => ({
        ...prev,
        [division.id]: {
          rounds: 3,
          teams: 16,
          matches: publicBracketMatches.length,
        },
      }))

      setResultModal({
        division,
        rounds: 3,
        teams: 16,
        matches: publicBracketMatches.length,
      })
    } catch (err) {
      setError('Failed to generate bracket for ' + division.name + ': ' + err.message)
      console.error(err)
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ maxWidth: 720 }}>
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
        <div className="p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg text-sm text-[#f87171] flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
        <div>
          Generate brackets after pool play is complete. This creates play-in, championship, and consolation matches
          seeded from current standings. The public bracket page only shows championship and consolation brackets.
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
            const byPool = {}

            for (const s of divStandings) {
              if (!byPool[s.pool_id]) byPool[s.pool_id] = []
              byPool[s.pool_id].push(s)
            }

            const numPools = Object.keys(byPool).length
            const rankedTeams = Object.values(byPool).flat()
            const isReady = numPools >= 2 && rankedTeams.length >= 8
            const result = generated[div.id]
            const poolsComplete = Object.values(byPool).every(
              p => p.length > 0 && p.every(t => t.games_played > 0)
            )

            return (
              <div key={div.id} className="border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-[var(--text-primary)]">{div.name}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                      {div.format_type?.replace(/_/g, ' ')} · {numPools} pool{numPools !== 1 ? 's' : ''}
                      {' · 1st to championship · 4th to consolation · 2nd/3rd to play-in'}
                    </p>
                  </div>

                  {result ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <Check size={16} />
                      Generated ({result.teams} teams, {result.matches} bracket games)
                    </div>
                  ) : (
                    <button
                      onClick={() => generateBracket(div)}
                      disabled={!isReady || generating === div.id}
                      className="btn-primary btn btn-sm disabled:opacity-40"
                    >
                      {generating === div.id ? (
                        <>
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap size={14} /> Generate bracket
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="px-5 py-3">
                  {!isReady ? (
                    <p className="text-sm text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Need pool standings before generating this bracket
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
                            <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                              {teams[0]?.pool_name}
                            </p>
                            {teams.slice(0, 4).map((t, idx) => (
                              <div
                                key={t.team_id}
                                className={`flex items-center gap-2 py-1 text-xs ${
                                  idx === 0
                                    ? 'text-[var(--text-primary)]'
                                    : idx === 3
                                      ? 'text-[var(--text-primary)]'
                                      : 'text-[var(--text-secondary)]'
                                }`}
                              >
                                <span className="w-4 text-right text-[var(--text-muted)]">{idx + 1}</span>
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: t.primary_color ?? '#e5e7eb' }}
                                />
                                <span className={idx === 0 || idx === 3 ? 'font-semibold' : ''}>
                                  {t.team_short_name ?? t.team_name}
                                </span>
                                <span className="text-[var(--text-muted)] ml-auto">
                                  {t.wins}-{t.losses}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {result && (
                  <div className="px-5 py-3 border-t border-[var(--border)]">
                    <Link
                      to={'/t/' + tournament?.slug + '/bracket/' + div.id}
                      className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
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

      {confirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-mid)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 440,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(234,179,8,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} style={{ color: '#fde047' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Regenerate bracket?
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {confirmModal.division.name}
                </p>
              </div>
            </div>

            {confirmModal.completedCount > 0 ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                  Warning: {confirmModal.completedCount} completed game{confirmModal.completedCount !== 1 ? 's' : ''} will be deleted
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  All scores and results for this play-in / bracket structure will be permanently lost.
                </p>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {confirmModal.scheduledCount} scheduled game{confirmModal.scheduledCount !== 1 ? 's' : ''} will be replaced with a fresh structure seeded from current standings.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const d = confirmModal.division
                  setConfirmModal(null)
                  await generateBracket(d, { skipConfirm: true })
                }}
                className={confirmModal.completedCount > 0 ? 'btn btn-danger' : 'btn btn-primary'}
                style={{ flex: 1 }}
              >
                {confirmModal.completedCount > 0 ? 'Delete & regenerate' : 'Regenerate bracket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-mid)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 400,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(34,197,94,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={20} style={{ color: '#4ade80' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Bracket created!
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {resultModal.division.name}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Teams', resultModal.teams],
                ['Rounds', resultModal.rounds],
                ['Games', resultModal.matches],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--bg-hover)',
                    borderRadius: 10,
                    padding: '12px 8px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 22,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginTop: 5,
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
              Play-in and bracket games are now seeded from current standings.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setResultModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>
                Done
              </button>
              <button
                onClick={() => {
                  setResultModal(null)
                  navigate('/t/' + tournament?.slug + '/bracket/' + resultModal.division.id)
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <Trophy size={14} /> View bracket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}