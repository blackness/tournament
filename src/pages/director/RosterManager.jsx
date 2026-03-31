import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Plus, Trash2, Upload, Users, Save } from 'lucide-react'

export function RosterManager() {
  const { tournamentId }            = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams]           = useState([])
  const [players, setPlayers]       = useState({}) // teamId -> players[]
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState(null)
  const fileRef                     = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)
      const { data: tm } = await db.teams.byTournament(tournamentId)
      setTeams(tm ?? [])
      if (tm?.length > 0) {
        setActiveTeam(tm[0].id)
        await loadPlayers(tm[0].id)
      }
      setLoading(false)
    }
    load()
  }, [tournamentId])

  async function loadPlayers(teamId) {
    const { data } = await supabase
      .from('tournament_players')
      .select('id, name, number, is_eligible')
      .eq('tournament_team_id', teamId)
      .order('number')
    setPlayers(prev => ({ ...prev, [teamId]: data ?? [] }))
  }

  async function handleTeamSelect(teamId) {
    setActiveTeam(teamId)
    if (!players[teamId]) await loadPlayers(teamId)
  }

  async function addPlayer(teamId) {
    const roster = players[teamId] ?? []
    const temp = { id: 'new-' + Date.now(), name: '', number: '', is_eligible: true, _new: true }
    setPlayers(prev => ({ ...prev, [teamId]: [...roster, temp] }))
  }

  async function savePlayer(teamId, player) {
    if (!player.name.trim()) return
    setSaving(true)
    if (player._new) {
      const { data } = await supabase.from('tournament_players').insert({
        tournament_team_id: teamId,
        name: player.name.trim(),
        number: player.number?.trim() || null,
        is_eligible: player.is_eligible ?? true,
      }).select().single()
      if (data) {
        setPlayers(prev => ({
          ...prev,
          [teamId]: prev[teamId].map(p => p.id === player.id ? data : p),
        }))
      }
    } else {
      await supabase.from('tournament_players').update({
        name: player.name.trim(),
        number: player.number?.trim() || null,
        is_eligible: player.is_eligible ?? true,
      }).eq('id', player.id)
    }
    setSaving(false)
    showMessage('Saved')
  }

  async function deletePlayer(teamId, playerId) {
    if (playerId.startsWith('new-')) {
      setPlayers(prev => ({ ...prev, [teamId]: prev[teamId].filter(p => p.id !== playerId) }))
      return
    }
    await supabase.from('tournament_players').delete().eq('id', playerId)
    setPlayers(prev => ({ ...prev, [teamId]: prev[teamId].filter(p => p.id !== playerId) }))
  }

  function updatePlayer(teamId, playerId, updates) {
    setPlayers(prev => ({
      ...prev,
      [teamId]: prev[teamId].map(p => p.id === playerId ? { ...p, ...updates } : p),
    }))
  }

  async function handleCSV(file, teamId) {
    if (!file) return
    const { default: Papa } = await import('papaparse')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows = data.map(r => ({
          tournament_team_id: teamId,
          name:   (r['Name'] || r['name'] || r['Player Name'] || r['player_name'] || '').trim(),
          number: (r['Number'] || r['number'] || r['#'] || '').trim() || null,
          is_eligible: true,
        })).filter(r => r.name)

        if (rows.length === 0) { showMessage('No players found in CSV', 'error'); return }

        const { data: inserted } = await supabase
          .from('tournament_players').insert(rows).select()
        if (inserted) {
          setPlayers(prev => ({
            ...prev,
            [teamId]: [...(prev[teamId] ?? []), ...inserted],
          }))
          showMessage('Imported ' + inserted.length + ' players')
        }
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 2500)
  }

  if (loading) return <PageLoader />

  const activeRoster = players[activeTeam] ?? []
  const activeTeamData = teams.find(t => t.id === activeTeam)

  return (
    <div style={{maxWidth:720}}>
      <div className="flex items-center gap-3">
        <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Roster Manager</h1>
          <p className="text-sm text-[var(--text-muted)]">{tournament?.name}</p>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>{message.text}</div>
      )}

      <div className="flex gap-5">
        {/* Team list sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-2 mb-2">Teams</p>
          {teams.map(t => (
            <button key={t.id} onClick={() => handleTeamSelect(t.id)}
              className={'w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ' + (
                activeTeam === t.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              )}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.primary_color ?? '#6b7280' }} />
              <span className="truncate">{t.name}</span>
              <span className="ml-auto text-xs text-[var(--text-muted)]">{players[t.id]?.length ?? '?'}</span>
            </button>
          ))}
        </div>

        {/* Player roster */}
        <div className="flex-1 min-w-0">
          {activeTeam && (
            <div className=" border border-[var(--border)] rounded-2xl overflow-hidden">
              {/* Roster header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] /50">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{activeTeamData?.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{activeRoster.length} players</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="btn-secondary btn btn-sm">
                    <Upload size={13} /> Import CSV
                  </button>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden"
                    onChange={e => handleCSV(e.target.files?.[0], activeTeam)} />
                  <button onClick={() => addPlayer(activeTeam)}
                    className="btn-primary btn btn-sm">
                    <Plus size={13} /> Add player
                  </button>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-[var(--border)] /30">
                <span className="col-span-1 text-xs font-semibold text-[var(--text-muted)]">#</span>
                <span className="col-span-7 text-xs font-semibold text-[var(--text-muted)]">Name</span>
                <span className="col-span-2 text-xs font-semibold text-[var(--text-muted)]">Eligible</span>
                <span className="col-span-2 text-xs font-semibold text-[var(--text-muted)] text-right">Actions</span>
              </div>

              {/* Players */}
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {activeRoster.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-muted)]">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No players yet</p>
                    <p className="text-xs mt-1">Add manually or import a CSV</p>
                  </div>
                ) : (
                  activeRoster.map(player => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      onChange={updates => updatePlayer(activeTeam, player.id, updates)}
                      onSave={() => savePlayer(activeTeam, { ...player })}
                      onDelete={() => deletePlayer(activeTeam, player.id)}
                      saving={saving}
                    />
                  ))
                )}
              </div>

              {/* CSV hint */}
              <div className="px-4 py-2 border-t border-[var(--border)] /30">
                <p className="text-xs text-[var(--text-muted)]">
                  CSV columns: <span className="font-mono">Name, Number</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ player, onChange, onSave, onDelete, saving }) {
  const [dirty, setDirty] = useState(player._new ?? false)

  function handleChange(field, val) {
    onChange({ [field]: val })
    setDirty(true)
  }

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:/50 group">
      {/* Number */}
      <div className="col-span-1">
        <input
          type="text"
          value={player.number ?? ''}
          onChange={e => handleChange('number', e.target.value)}
          placeholder="#"
          className="w-full text-xs font-mono text-center border-0 bg-transparent outline-none focus: rounded px-1 py-0.5 text-[var(--text-secondary)]"
          maxLength={4}
        />
      </div>

      {/* Name */}
      <div className="col-span-7">
        <input
          type="text"
          value={player.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder="Player name"
          className="w-full text-sm border-0 bg-transparent outline-none focus: rounded px-1 py-0.5 text-[var(--text-primary)]"
          autoFocus={player._new}
        />
      </div>

      {/* Eligible */}
      <div className="col-span-2 flex justify-center">
        <input
          type="checkbox"
          checked={player.is_eligible ?? true}
          onChange={e => handleChange('is_eligible', e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
      </div>

      {/* Actions */}
      <div className="col-span-2 flex items-center justify-end gap-1">
        {dirty && (
          <button onClick={() => { onSave(); setDirty(false) }} disabled={saving || !player.name.trim()}
            className="p-1 text-blue-500 hover:text-blue-700 disabled:opacity-30" title="Save">
            <Save size={13} />
          </button>
        )}
        <button onClick={onDelete}
          className="p-1 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
