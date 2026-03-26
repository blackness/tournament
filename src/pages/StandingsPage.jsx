import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

export function StandingsPage() {
  const { slug, divisionId }          = useParams()
  const [division, setDivision]       = useState(null)
  const [standings, setStandings]     = useState([])
  const [pools, setPools]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadStandings() {
    const { data } = await supabase
      .from('pool_standings_display')
      .select('*')
      .eq('division_id', divisionId)
      .order('pool_id').order('rank')
    setStandings(data ?? [])
    setLastUpdated(new Date())
  }

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase
        .from('divisions')
        .select('id, name, teams_advance_per_pool, tiebreaker_order, tournament:tournaments(id, name, slug, primary_color, tiebreaker_order)')
        .eq('id', divisionId)
        .single()
      setDivision(div)

      const { data: poolData } = await supabase
        .from('pools')
        .select('id, name, short_name')
        .eq('division_id', divisionId)
        .order('sort_order')
      setPools(poolData ?? [])

      await loadStandings()
      setLoading(false)
    }
    load()
  }, [divisionId])

  // Realtime
  useEffect(() => {
    if (!divisionId) return
    const channel = supabase
      .channel('standings-' + divisionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_standings' }, () => {
        loadStandings()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [divisionId])

  if (loading) return <PageLoader />

  const tournament = division?.tournament
  const tiebreakerOrder = division?.tiebreaker_order ?? tournament?.tiebreaker_order ?? []

  // Group standings by pool
  const byPool = {}
  for (const row of standings) {
    if (!byPool[row.pool_id]) byPool[row.pool_id] = []
    byPool[row.pool_id].push(row)
  }

  const advancesPerPool = division?.teams_advance_per_pool ?? 2

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {tournament && (
            <Link to={'/t/' + tournament.slug} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft size={20} />
            </Link>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{division?.name} Standings</h1>
            {tournament && <p className="text-sm text-gray-400">{tournament.name}</p>}
          </div>
        </div>
        <button onClick={loadStandings} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium text-gray-600">No pools yet</p>
          <p className="text-sm mt-1">Standings appear once pool play begins.</p>
        </div>
      ) : (
        pools.map(pool => {
          const poolRows = byPool[pool.id] ?? []
          return (
            <div key={pool.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Pool header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
                style={{ backgroundColor: (tournament?.primary_color ?? '#1a56db') + '12' }}>
                <h2 className="font-bold text-gray-900">{pool.name}</h2>
                <span className="text-xs text-gray-400">{poolRows.length} team{poolRows.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left pl-4 pr-2 py-2.5 text-xs font-semibold text-gray-400 w-7">#</th>
                      <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-400">Team</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">W</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">L</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-12">+/-</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">PF</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">PA</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-10">GP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {poolRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                          No results yet
                        </td>
                      </tr>
                    ) : (
                      poolRows.map((row, idx) => (
                        <StandingsRow
                          key={row.team_id}
                          row={row}
                          rank={idx + 1}
                          advances={idx < advancesPerPool}
                          primaryColor={tournament?.primary_color ?? '#1a56db'}
                          slug={slug}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {poolRows.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                  <ChevronRight size={11} className="text-blue-400" />
                  Top {advancesPerPool} advance to bracket
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 text-right">
          Updated {lastUpdated.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        </p>
      )}

      {/* Tiebreaker legend */}
      {tiebreakerOrder.length > 0 && (
        <div className="text-xs text-gray-400">
          <span className="font-semibold text-gray-500">Tiebreakers: </span>
          {tiebreakerOrder.map(t => TIEBREAKER_LABELS[t] ?? t).join(' > ')}
        </div>
      )}
    </div>
  )
}

function StandingsRow({ row, rank, advances, primaryColor, slug }) {
  const diff = row.point_diff ?? 0
  const w    = row.wins          ?? 0
  const l    = row.losses        ?? 0
  const pf   = row.points_scored ?? 0
  const pa   = row.points_against ?? 0
  const gp   = row.games_played  ?? 0

  return (
    <tr className={'hover:bg-gray-50/50 transition-colors ' + (advances ? 'bg-blue-50/30' : '')}>
      {/* Rank */}
      <td className="pl-4 pr-2 py-3 text-xs font-semibold text-gray-400">{rank}</td>

      {/* Team name */}
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.primary_color ?? '#94a3b8' }} />
          <Link
            to={'/t/' + slug + '/team/' + row.team_id}
            className="font-semibold text-gray-900 hover:text-blue-600 hover:underline whitespace-nowrap"
          >
            {row.team_short_name ?? row.team_name}
          </Link>
          {advances && gp > 0 && (
            <span className="hidden sm:inline text-xs text-blue-500 font-medium whitespace-nowrap">
              Advances
            </span>
          )}
        </div>
      </td>

      {/* W */}
      <td className="px-3 py-3 text-center font-bold text-gray-900">{w}</td>
      {/* L */}
      <td className="px-3 py-3 text-center text-gray-600">{l}</td>
      {/* +/- */}
      <td className={'px-3 py-3 text-center font-semibold tabular-nums ' +
        (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400')}>
        {diff > 0 ? '+' + diff : diff === 0 ? '0' : diff}
      </td>
      {/* PF */}
      <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{pf}</td>
      {/* PA */}
      <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{pa}</td>
      {/* GP */}
      <td className="px-3 py-3 text-center text-gray-400 tabular-nums">{gp}</td>
    </tr>
  )
}

const TIEBREAKER_LABELS = {
  head_to_head:   'Head-to-head',
  point_diff:     'Point diff',
  points_scored:  'Points scored',
  points_against: 'Points against',
  sotg:           'SOTG',
  director:       'Director',
}
