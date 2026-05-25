import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Plus, Trash2, Upload, Users, Save, Edit3, Check, X, Download } from 'lucide-react'

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([k, v]) => [
      String(k).replace(/^\ufeff/, '').trim(),
      typeof v === 'string' ? v.trim() : v,
    ])
  )
}

function firstNonEmpty(obj, keys) {
  for (const key of keys) {
    const val = obj?.[key]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim()
    }
  }
  return ''
}

function getTeamName(row) {
  return firstNonEmpty(row, [
    'Team Name',
    'team_name',
    'Team',
    'team',
    'School',
    'school',
  ])
}

function getPlayerName(row) {
  const direct = firstNonEmpty(row, [
    'Player Name',
    'player_name',
    'Player',
    'player',
    'Name',
    'name',
  ])
  if (direct) return direct

  const first = firstNonEmpty(row, ['First Name', 'first_name', 'First', 'first'])
  const last = firstNonEmpty(row, ['Last Name', 'last_name', 'Last', 'last'])
  return [first, last].filter(Boolean).join(' ').trim()
}

function getPlayerNumber(row) {
  return firstNonEmpty(row, [
    'Player Number',
    'player_number',
    'Number',
    'number',
    '#',
  ])
}

export function RosterManager() {
  const { tournamentId } = useParams()

  const [tournament, setTournament] = useState(null)
  const [teams, setTeams] = useState([])
  const [divisions, setDivisions] = useState([])
  const [players, setPlayers] = useState({})
  const [activeTeam, setActiveTeam] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState(null)

  const [editingTeam, setEditingTeam] = useState(null)
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({
    name: '',
    short_name: '',
    primary_color: '#6366f1',
  })

  const fileRef = useRef(null)
  const allFileRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: t, error: tError } = await db.tournaments.byId(tournamentId)
        if (tError) throw tError
        setTournament(t)

        const { data: divs, error: divError } = await supabase
          .from('divisions')
          .select('id,name')
          .eq('tournament_id', tournamentId)

        if (divError) throw divError
        setDivisions(divs ?? [])

        const { data: tm, error: teamError } = await db.teams.byTournament(tournamentId)
        if (teamError) throw teamError
        setTeams(tm ?? [])

        if (tm?.length > 0) {
          setActiveTeam(tm[0].id)
          await loadPlayers(tm[0].id)
        }
      } catch (err) {
        showMessage(err.message || 'Failed to load roster data', 'error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tournamentId])

  async function refreshTeams() {
    const { data, error } = await db.teams.byTournament(tournamentId)
    if (error) throw error
    setTeams(data ?? [])
    return data ?? []
  }

  async function loadPlayers(teamId) {
    const { data, error } = await supabase
      .from('tournament_players')
      .select('id, name, number, is_eligible, tournament_team_id')
      .eq('tournament_team_id', teamId)
      .order('number')

    if (error) throw error

    setPlayers(prev => ({ ...prev, [teamId]: data ?? [] }))
    return data ?? []
  }

  async function handleTeamSelect(teamId) {
    setActiveTeam(teamId)
    if (!players[teamId]) {
      try {
        await loadPlayers(teamId)
      } catch (err) {
        showMessage(err.message || 'Failed to load players', 'error')
      }
    }
  }

  async function handleAddTeam() {
    if (!newTeam.name.trim()) return
    setSaving(true)

    try {
      const defaultDiv = divisions[0]

      const { data, error } = await supabase
        .from('tournament_teams')
        .insert({
          tournament_id: tournamentId,
          division_id: defaultDiv?.id ?? null,
          name: newTeam.name.trim(),
          short_name: newTeam.short_name.trim() || newTeam.name.trim().slice(0, 4).toUpperCase(),
          primary_color: newTeam.primary_color,
          seed: teams.length + 1,
        })
        .select()
        .single()

      if (error) throw error

      setTeams(prev => [...prev, data])
      setActiveTeam(data.id)
      setPlayers(prev => ({ ...prev, [data.id]: [] }))
      setNewTeam({ name: '', short_name: '', primary_color: '#6366f1' })
      setAddingTeam(false)
      showMessage('Team added')
    } catch (err) {
      showMessage(err.message || 'Failed to add team', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRenameTeam() {
    if (!editingTeam || !editingTeam.name.trim()) return
    setSaving(true)

    try {
      const updates = {
        name: editingTeam.name.trim(),
        short_name:
          editingTeam.short_name.trim() || editingTeam.name.trim().slice(0, 4).toUpperCase(),
      }

      const { error } = await supabase
        .from('tournament_teams')
        .update(updates)
        .eq('id', editingTeam.id)

      if (error) throw error

      setTeams(prev =>
        prev.map(t =>
          t.id === editingTeam.id
            ? { ...t, ...updates }
            : t
        )
      )

      showMessage('Team renamed')
      setEditingTeam(null)
    } catch (err) {
      showMessage(err.message || 'Failed to rename team', 'error')
    } finally {
      setSaving(false)
    }
  }

  function addPlayer(teamId) {
    const temp = {
      id: 'new-' + Date.now(),
      name: '',
      number: '',
      is_eligible: true,
      tournament_team_id: teamId,
      _new: true,
    }

    setPlayers(prev => ({
      ...prev,
      [teamId]: [...(prev[teamId] ?? []), temp],
    }))
  }

  async function savePlayer(teamId, player) {
    if (!player.name?.trim()) return

    setSaving(true)
    try {
      if (player._new) {
        const { data, error } = await supabase
          .from('tournament_players')
          .insert({
            tournament_team_id: teamId,
            name: player.name.trim(),
            number: player.number?.trim() || null,
            is_eligible: player.is_eligible ?? true,
          })
          .select()
          .single()

        if (error) throw error

        setPlayers(prev => ({
          ...prev,
          [teamId]: prev[teamId].map(p => (p.id === player.id ? data : p)),
        }))
      } else {
        const { error } = await supabase
          .from('tournament_players')
          .update({
            name: player.name.trim(),
            number: player.number?.trim() || null,
            is_eligible: player.is_eligible ?? true,
          })
          .eq('id', player.id)

        if (error) throw error

        setPlayers(prev => ({
          ...prev,
          [teamId]: prev[teamId].map(p =>
            p.id === player.id
              ? {
                  ...p,
                  name: player.name.trim(),
                  number: player.number?.trim() || null,
                  is_eligible: player.is_eligible ?? true,
                }
              : p
          ),
        }))
      }

      showMessage('Saved')
    } catch (err) {
      showMessage(err.message || 'Failed to save player', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deletePlayer(teamId, playerId) {
    try {
      if (String(playerId).startsWith('new-')) {
        setPlayers(prev => ({
          ...prev,
          [teamId]: prev[teamId].filter(p => p.id !== playerId),
        }))
        return
      }

      const { error } = await supabase
        .from('tournament_players')
        .delete()
        .eq('id', playerId)

      if (error) throw error

      setPlayers(prev => ({
        ...prev,
        [teamId]: prev[teamId].filter(p => p.id !== playerId),
      }))

      showMessage('Player deleted')
    } catch (err) {
      showMessage(err.message || 'Failed to delete player', 'error')
    }
  }

  function updatePlayer(teamId, playerId, updates) {
    setPlayers(prev => ({
      ...prev,
      [teamId]: prev[teamId].map(p => (p.id === playerId ? { ...p, ...updates } : p)),
    }))
  }

  async function handlePlayerCSV(file, teamId) {
    if (!file || !teamId) return

    setImporting(true)

    try {
      const { default: Papa } = await import('papaparse')

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async ({ data }) => {
          try {
            const parsed = (data ?? []).map(normalizeRow)

            const existingPlayers = players[teamId] ?? (await loadPlayers(teamId))
            const existingNames = new Set(
              existingPlayers.map(p => p.name.toLowerCase().trim())
            )

            const rows = parsed
              .map(r => {
                const name = getPlayerName(r)
                const number = getPlayerNumber(r)

                return {
                  tournament_team_id: teamId,
                  name,
                  number: number || null,
                  is_eligible: true,
                }
              })
              .filter(r => r.name)
              .filter(r => !existingNames.has(r.name.toLowerCase()))

            if (rows.length === 0) {
              showMessage('No new players to import', 'error')
              return
            }

            const { data: inserted, error } = await supabase
              .from('tournament_players')
              .insert(rows)
              .select()

            if (error) throw error

            setPlayers(prev => ({
              ...prev,
              [teamId]: [...(prev[teamId] ?? []), ...(inserted ?? [])],
            }))

            showMessage(`Imported ${inserted?.length ?? 0} new players`)
          } catch (err) {
            showMessage(err.message || 'Import failed', 'error')
          } finally {
            setImporting(false)
            if (fileRef.current) fileRef.current.value = ''
          }
        },
        error: err => {
          showMessage(err?.message || 'Failed to parse CSV', 'error')
          setImporting(false)
          if (fileRef.current) fileRef.current.value = ''
        },
      })
    } catch (err) {
      showMessage(err.message || 'Import failed', 'error')
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleCombinedCSV(file) {
    if (!file) return

    setImporting(true)

    try {
      const { default: Papa } = await import('papaparse')

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async ({ data }) => {
          try {
            const parsed = (data ?? []).map(normalizeRow)

            const currentTeams = await refreshTeams()
            const teamsByName = Object.fromEntries(
              currentTeams.map(t => [t.name.toLowerCase().trim(), t])
            )

            const defaultDiv = divisions[0]
            let teamsAdded = 0
            let teamsUpdated = 0
            let playersAdded = 0
            let duplicatesSkipped = 0

            const grouped = {}
            let lastTeamName = ''

            for (const raw of parsed) {
              const row = normalizeRow(raw)
              const teamName = getTeamName(row) || lastTeamName

              if (!teamName) continue
              lastTeamName = teamName

              const normalizedRow = {
                ...row,
                School: row.School || teamName,
                'Team Name': row['Team Name'] || teamName,
              }

              if (!grouped[teamName]) {
                grouped[teamName] = { meta: normalizedRow, rows: [] }
              }

              grouped[teamName].rows.push(normalizedRow)
            }

            for (const [teamName, group] of Object.entries(grouped)) {
              const meta = group.meta
              let team = teamsByName[teamName.toLowerCase()]

              const shortName =
                firstNonEmpty(meta, ['Short Name', 'short_name', 'Short', 'short']) ||
                teamName.slice(0, 4).toUpperCase()

              const color =
                firstNonEmpty(meta, ['Color', 'color', 'Primary Color', 'primary_color']) ||
                '#6366f1'

              const coach =
                firstNonEmpty(meta, ['Coach', 'coach', 'Head Coach', 'head_coach_name']) || null

              if (!team) {
                const { data: newTeamRow, error: teamInsertError } = await supabase
                  .from('tournament_teams')
                  .insert({
                    tournament_id: tournamentId,
                    division_id: defaultDiv?.id ?? null,
                    name: teamName,
                    short_name: shortName,
                    primary_color: color,
                    head_coach_name: coach,
                    seed: Object.keys(teamsByName).length + teamsAdded + 1,
                  })
                  .select()
                  .single()

                if (teamInsertError) throw teamInsertError

                team = newTeamRow
                teamsByName[teamName.toLowerCase()] = team
                teamsAdded++
              } else {
                const teamUpdates = {}
                if (shortName && shortName !== team.short_name) teamUpdates.short_name = shortName
                if (color && color !== team.primary_color) teamUpdates.primary_color = color
                if (coach !== team.head_coach_name) teamUpdates.head_coach_name = coach

                if (Object.keys(teamUpdates).length > 0) {
                  const { error: updateTeamError } = await supabase
                    .from('tournament_teams')
                    .update(teamUpdates)
                    .eq('id', team.id)

                  if (updateTeamError) throw updateTeamError

                  team = { ...team, ...teamUpdates }
                  teamsByName[teamName.toLowerCase()] = team
                  teamsUpdated++
                }
              }

              const { data: existingPlayers, error: existingPlayersError } = await supabase
                .from('tournament_players')
                .select('name')
                .eq('tournament_team_id', team.id)

              if (existingPlayersError) throw existingPlayersError

              const existingNames = new Set(
                (existingPlayers ?? []).map(p => p.name.toLowerCase().trim())
              )

              const seenInFile = new Set()
              const playerRows = []

              for (const row of group.rows) {
                const playerName = getPlayerName(row)
                const playerNumber = getPlayerNumber(row)

                if (!playerName) continue

                const normalizedName = playerName.toLowerCase().trim()

                if (existingNames.has(normalizedName) || seenInFile.has(normalizedName)) {
                  duplicatesSkipped++
                  continue
                }

                seenInFile.add(normalizedName)

                playerRows.push({
                  tournament_team_id: team.id,
                  name: playerName,
                  number: playerNumber || null,
                  is_eligible: true,
                })
              }

              if (playerRows.length > 0) {
                const { data: insertedPlayers, error: playerInsertError } = await supabase
                  .from('tournament_players')
                  .insert(playerRows)
                  .select()

                if (playerInsertError) throw playerInsertError

                playersAdded += insertedPlayers?.length ?? 0
              }
            }

            const refreshedTeams = await refreshTeams()
            setPlayers({})

            if (activeTeam) {
              await loadPlayers(activeTeam)
            } else if (refreshedTeams.length > 0) {
              setActiveTeam(refreshedTeams[0].id)
              await loadPlayers(refreshedTeams[0].id)
            }

            const msg = [
              teamsAdded > 0 && `${teamsAdded} new team${teamsAdded !== 1 ? 's' : ''} added`,
              teamsUpdated > 0 && `${teamsUpdated} team${teamsUpdated !== 1 ? 's' : ''} updated`,
              playersAdded > 0 && `${playersAdded} new player${playersAdded !== 1 ? 's' : ''} added`,
              duplicatesSkipped > 0 &&
                `${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} skipped`,
            ]
              .filter(Boolean)
              .join(', ')

            showMessage(msg || 'All up to date - no changes needed')
          } catch (err) {
            showMessage(err.message || 'Bulk import failed', 'error')
          } finally {
            setImporting(false)
            if (allFileRef.current) allFileRef.current.value = ''
          }
        },
        error: err => {
          showMessage(err?.message || 'Failed to parse CSV', 'error')
          setImporting(false)
          if (allFileRef.current) allFileRef.current.value = ''
        },
      })
    } catch (err) {
      showMessage(err.message || 'Bulk import failed', 'error')
      setImporting(false)
      if (allFileRef.current) allFileRef.current.value = ''
    }
  }

  async function handleExport() {
    try {
      const allTeams = await refreshTeams()
      const teamIds = (allTeams ?? []).map(t => t.id)

      let allPlayers = []
      if (teamIds.length > 0) {
        const { data, error } = await supabase
          .from('tournament_players')
          .select('name, number, tournament_team_id')
          .in('tournament_team_id', teamIds)

        if (error) throw error
        allPlayers = data ?? []
      }

      const rows = []

      for (const team of allTeams ?? []) {
        const teamPlayers = allPlayers.filter(p => p.tournament_team_id === team.id)

        if (teamPlayers.length === 0) {
          rows.push([
            team.name,
            team.short_name ?? '',
            team.head_coach_name ?? '',
            team.primary_color ?? '',
            '',
            '',
          ])
        } else {
          for (const p of teamPlayers) {
            rows.push([
              team.name,
              team.short_name ?? '',
              team.head_coach_name ?? '',
              team.primary_color ?? '',
              p.name,
              p.number ?? '',
            ])
          }
        }
      }

      const header = 'Team Name,Short Name,Coach,Color,Player Name,Player Number'
      const csv =
        header +
        '\n' +
        rows
          .map(r =>
            r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
          )
          .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        (tournament?.name ?? 'roster').replace(/\s+/g, '-').toLowerCase() + '-roster.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showMessage(err.message || 'Export failed', 'error')
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) return <PageLoader />

  const activeRoster = players[activeTeam] ?? []
  const activeTeamData = teams.find(t => t.id === activeTeam)

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={'/director/' + tournamentId} style={{ color: 'var(--text-muted)', display: 'flex' }}>
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              Roster Manager
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tournament?.name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontFamily: 'inherit',
            }}
          >
            <Download size={13} /> Export CSV
          </button>

          <button
            onClick={() => allFileRef.current?.click()}
            disabled={importing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent-dim)',
              border: '1px solid rgba(232,255,71,0.2)',
              borderRadius: 9,
              cursor: 'pointer',
              color: 'var(--accent)',
              fontFamily: 'inherit',
            }}
          >
            <Upload size={13} /> {importing ? 'Importing...' : 'Import teams + rosters'}
          </button>

          <input
            ref={allFileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => handleCombinedCSV(e.target.files?.[0])}
          />
        </div>
      </div>

      <div
        style={{
          padding: '10px 14px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          marginBottom: 20,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Import CSV columns: </span>
        <span style={{ fontFamily: 'monospace' }}>
          Team Name, Short Name, Coach, Color, Player Name, Player Number
        </span>
        <span style={{ marginLeft: 8 }}>
          - also supports School, First Name, Last Name, and blank repeated school cells
        </span>
      </div>

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color: message.type === 'error' ? '#f87171' : '#4ade80',
            border: `1px solid ${
              message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Teams ({teams.length})
            </span>
            <button
              onClick={() => setAddingTeam(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'var(--accent-dim)',
                border: '1px solid rgba(232,255,71,0.2)',
                borderRadius: 6,
                padding: '3px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {addingTeam && (
            <div
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-mid)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <input
                className="field-input"
                style={{ fontSize: 13 }}
                placeholder="Team name"
                autoFocus
                value={newTeam.name}
                onChange={e => setNewTeam(p => ({ ...p, name: e.target.value }))}
              />
              <input
                className="field-input"
                style={{ fontSize: 13 }}
                placeholder="Short name"
                value={newTeam.short_name}
                onChange={e => setNewTeam(p => ({ ...p, short_name: e.target.value }))}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={newTeam.primary_color}
                  onChange={e => setNewTeam(p => ({ ...p, primary_color: e.target.value }))}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 2,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                  {newTeam.primary_color}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setAddingTeam(false)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: 12,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTeam}
                  disabled={!newTeam.name.trim() || saving}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 7,
                    cursor: 'pointer',
                    color: 'var(--bg-base)',
                    fontFamily: 'inherit',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {teams.map(t => (
              <div key={t.id} style={{ position: 'relative' }}>
                {editingTeam?.id === t.id ? (
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-mid)',
                      borderRadius: 9,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <input
                      className="field-input"
                      style={{ fontSize: 12 }}
                      value={editingTeam.name}
                      onChange={e => setEditingTeam(p => ({ ...p, name: e.target.value }))}
                      autoFocus
                    />
                    <input
                      className="field-input"
                      style={{ fontSize: 12 }}
                      placeholder="Short name"
                      value={editingTeam.short_name}
                      onChange={e => setEditingTeam(p => ({ ...p, short_name: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={() => setEditingTeam(null)}
                        style={{
                          flex: 1,
                          padding: '4px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontFamily: 'inherit',
                        }}
                      >
                        <X size={12} />
                      </button>
                      <button
                        onClick={handleRenameTeam}
                        style={{
                          flex: 1,
                          padding: '4px',
                          background: 'var(--accent)',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--bg-base)',
                          fontFamily: 'inherit',
                        }}
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleTeamSelect(t.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 9,
                      border: `1px solid ${activeTeam === t.id ? 'rgba(232,255,71,0.2)' : 'transparent'}`,
                      background: activeTeam === t.id ? 'var(--accent-dim)' : 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: t.primary_color ?? 'var(--border-mid)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: activeTeam === t.id ? 600 : 400,
                        color: activeTeam === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {players[t.id]?.length ?? ''}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setEditingTeam({
                          id: t.id,
                          name: t.name,
                          short_name: t.short_name ?? '',
                        })
                      }}
                      style={{
                        padding: 3,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        opacity: 0.6,
                        flexShrink: 0,
                      }}
                    >
                      <Edit3 size={11} />
                    </button>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTeam ? (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: activeTeamData?.primary_color ?? 'var(--border-mid)',
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeTeamData?.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {activeRoster.length} players
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Upload size={12} /> Import players
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={e => handlePlayerCSV(e.target.files?.[0], activeTeam)}
                  />
                  <button
                    onClick={() => addPlayer(activeTeam)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: 'var(--bg-base)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Plus size={12} /> Add player
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 64px 64px',
                  gap: 8,
                  padding: '8px 16px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                <span>#</span>
                <span>Name</span>
                <span style={{ textAlign: 'center' }}>Eligible</span>
                <span />
              </div>

              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {activeRoster.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      No players yet
                    </p>
                    <p style={{ fontSize: 12 }}>Add manually or import a CSV</p>
                  </div>
                ) : (
                  activeRoster.map(player => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      onChange={updates => updatePlayer(activeTeam, player.id, updates)}
                      onSave={() => {
                        const latest = players[activeTeam]?.find(p => p.id === player.id) || player
                        savePlayer(activeTeam, latest)
                      }}
                      onDelete={() => deletePlayer(activeTeam, player.id)}
                      saving={saving}
                    />
                  ))
                )}
              </div>

              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                Player CSV supports: <span style={{ fontFamily: 'monospace' }}>Player Name, Player Number</span> or <span style={{ fontFamily: 'monospace' }}>First Name, Last Name, Player Number</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <Users size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Select a team</p>
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr 64px 64px',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(42,42,50,0.4)',
        alignItems: 'center',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <input
        type="text"
        value={player.number ?? ''}
        onChange={e => handleChange('number', e.target.value)}
        placeholder="#"
        maxLength={4}
        style={{
          width: '100%',
          fontSize: 12,
          fontFamily: 'monospace',
          textAlign: 'center',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-muted)',
          padding: '2px 4px',
        }}
      />
      <input
        type="text"
        value={player.name ?? ''}
        onChange={e => handleChange('name', e.target.value)}
        placeholder="Player name"
        autoFocus={player._new}
        style={{
          width: '100%',
          fontSize: 14,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          padding: '2px 4px',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={player.is_eligible ?? true}
          onChange={e => handleChange('is_eligible', e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        {dirty && (
          <button
            onClick={() => {
              onSave()
              setDirty(false)
            }}
            disabled={saving || !player.name?.trim()}
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#4ade80',
            }}
          >
            <Save size={13} />
          </button>
        )}
        <button
          onClick={onDelete}
          style={{
            padding: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}