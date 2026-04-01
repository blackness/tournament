import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { ChevronLeft, Plus, Trash2, Upload, Users, Save, Edit3, Check, X, Download } from 'lucide-react'

export function RosterManager() {
  const { tournamentId }            = useParams()
  const [tournament, setTournament] = useState(null)
  const [teams, setTeams]           = useState([])
  const [divisions, setDivisions]   = useState([])
  const [players, setPlayers]       = useState({})
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState(null)
  const [editingTeam, setEditingTeam] = useState(null) // { id, name, short_name }
  const [addingTeam, setAddingTeam]   = useState(false)
  const [newTeam, setNewTeam]         = useState({ name:'', short_name:'', primary_color:'#6366f1' })
  const [importing, setImporting]     = useState(false)
  const fileRef     = useRef(null)
  const allFileRef  = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)
      const { data: divs } = await supabase.from('divisions').select('id,name').eq('tournament_id', tournamentId)
      setDivisions(divs ?? [])
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
    const { data } = await supabase.from('tournament_players')
      .select('id, name, number, is_eligible')
      .eq('tournament_team_id', teamId).order('number')
    setPlayers(prev => ({ ...prev, [teamId]: data ?? [] }))
    return data ?? []
  }

  async function handleTeamSelect(teamId) {
    setActiveTeam(teamId)
    if (!players[teamId]) await loadPlayers(teamId)
  }

  // - Add team -
  async function handleAddTeam() {
    if (!newTeam.name.trim()) return
    setSaving(true)
    const defaultDiv = divisions[0]
    const { data, error } = await supabase.from('tournament_teams').insert({
      tournament_id: tournamentId,
      division_id:   defaultDiv?.id ?? null,
      name:          newTeam.name.trim(),
      short_name:    newTeam.short_name.trim() || newTeam.name.trim().slice(0,4).toUpperCase(),
      primary_color: newTeam.primary_color,
      seed:          teams.length + 1,
    }).select().single()
    if (data) {
      setTeams(prev => [...prev, data])
      setActiveTeam(data.id)
      setPlayers(prev => ({ ...prev, [data.id]: [] }))
      setNewTeam({ name:'', short_name:'', primary_color:'#6366f1' })
      setAddingTeam(false)
      showMessage('Team added')
    } else {
      showMessage(error?.message ?? 'Failed to add team', 'error')
    }
    setSaving(false)
  }

  // - Rename team (propagates via DB FK cascade to name display) -
  async function handleRenameTeam() {
    if (!editingTeam || !editingTeam.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('tournament_teams').update({
      name:       editingTeam.name.trim(),
      short_name: editingTeam.short_name.trim() || editingTeam.name.trim().slice(0,4).toUpperCase(),
    }).eq('id', editingTeam.id)
    if (!error) {
      setTeams(prev => prev.map(t => t.id === editingTeam.id ? { ...t, name: editingTeam.name.trim(), short_name: editingTeam.short_name.trim() } : t))
      showMessage('Team renamed - schedule and standings updated')
    } else {
      showMessage(error.message, 'error')
    }
    setEditingTeam(null)
    setSaving(false)
  }

  // - Player CRUD -
  async function addPlayer(teamId) {
    const temp = { id: 'new-' + Date.now(), name: '', number: '', is_eligible: true, _new: true }
    setPlayers(prev => ({ ...prev, [teamId]: [...(prev[teamId] ?? []), temp] }))
  }

  async function savePlayer(teamId, player) {
    if (!player.name.trim()) return
    setSaving(true)
    if (player._new) {
      const { data } = await supabase.from('tournament_players').insert({
        tournament_team_id: teamId,
        name:         player.name.trim(),
        number:       player.number?.trim() || null,
        is_eligible:  player.is_eligible ?? true,
      }).select().single()
      if (data) setPlayers(prev => ({ ...prev, [teamId]: prev[teamId].map(p => p.id === player.id ? data : p) }))
    } else {
      await supabase.from('tournament_players').update({
        name:        player.name.trim(),
        number:      player.number?.trim() || null,
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
    setPlayers(prev => ({ ...prev, [teamId]: prev[teamId].map(p => p.id === playerId ? { ...p, ...updates } : p) }))
  }

  // - Single-team CSV (players only) -
  async function handlePlayerCSV(file, teamId) {
    if (!file) return
    const { default: Papa } = await import('papaparse')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const existingPlayers = players[teamId] ?? await loadPlayers(teamId)
        const existingNames = new Set(existingPlayers.map(p => p.name.toLowerCase().trim()))
        const rows = data.map(r => ({
          tournament_team_id: teamId,
          name:   (r['Player Name'] || r['Name'] || r['name'] || '').trim(),
          number: (r['Player Number'] || r['Number'] || r['#'] || '').trim() || null,
          is_eligible: true,
        })).filter(r => r.name && !existingNames.has(r.name.toLowerCase()))

        if (rows.length === 0) { showMessage('No new players to import', 'error'); return }
        const { data: inserted } = await supabase.from('tournament_players').insert(rows).select()
        if (inserted) {
          setPlayers(prev => ({ ...prev, [teamId]: [...(prev[teamId] ?? []), ...inserted] }))
          showMessage(`Imported ${inserted.length} new players`)
        }
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  // - Combined teams + rosters CSV -
  async function handleCombinedCSV(file) {
    if (!file) return
    setImporting(true)
    const { default: Papa } = await import('papaparse')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        try {
          // Refresh current teams from DB
          const { data: currentTeams } = await db.teams.byTournament(tournamentId)
          const teamsByName = Object.fromEntries((currentTeams ?? []).map(t => [t.name.toLowerCase().trim(), t]))
          const defaultDiv = divisions[0]
          let added = 0, playersAdded = 0, skipped = 0

          // Group rows by team name
          const grouped = {}
          for (const row of data) {
            const teamName = (row['Team Name'] || row['team_name'] || row['Team'] || '').trim()
            if (!teamName) continue
            if (!grouped[teamName]) grouped[teamName] = { rows: [], meta: row }
            grouped[teamName].rows.push(row)
          }

          for (const [teamName, { rows, meta }] of Object.entries(grouped)) {
            // Upsert team
            let team = teamsByName[teamName.toLowerCase()]
            if (!team) {
              const shortName = (meta['Short Name'] || meta['short_name'] || teamName.slice(0,4).toUpperCase()).trim()
              const color     = (meta['Color'] || meta['color'] || '#6366f1').trim()
              const coach     = (meta['Coach'] || meta['coach'] || '').trim()
              const { data: newT } = await supabase.from('tournament_teams').insert({
                tournament_id:    tournamentId,
                division_id:      defaultDiv?.id ?? null,
                name:             teamName,
                short_name:       shortName,
                primary_color:    color,
                head_coach_name:  coach || null,
                seed:             Object.keys(teamsByName).length + added + 1,
              }).select().single()
              if (newT) {
                team = newT
                teamsByName[teamName.toLowerCase()] = newT
                added++
              }
            } else {
              // Update color/short name if provided and different
              const shortName = (meta['Short Name'] || meta['short_name'] || '').trim()
              const color     = (meta['Color'] || meta['color'] || '').trim()
              if ((shortName && shortName !== team.short_name) || (color && color !== team.primary_color)) {
                await supabase.from('tournament_teams').update({
                  ...(shortName ? { short_name: shortName } : {}),
                  ...(color ? { primary_color: color } : {}),
                }).eq('id', team.id)
              }
            }

            if (!team) continue

            // Load existing players for this team to deduplicate
            const { data: existingP } = await supabase.from('tournament_players')
              .select('name').eq('tournament_team_id', team.id)
            const existingNames = new Set((existingP ?? []).map(p => p.name.toLowerCase().trim()))

            // Insert new players
            const playerRows = rows.map(r => {
              const pName = (r['Player Name'] || r['player_name'] || r['Player'] || '').trim()
              const pNum  = (r['Player Number'] || r['player_number'] || r['Number'] || r['#'] || '').trim()
              return pName ? { tournament_team_id: team.id, name: pName, number: pNum || null, is_eligible: true } : null
            }).filter(r => r && !existingNames.has(r.name.toLowerCase()))

            if (playerRows.length > 0) {
              const { data: inserted } = await supabase.from('tournament_players').insert(playerRows).select()
              playersAdded += inserted?.length ?? 0
            } else {
              skipped += rows.filter(r => (r['Player Name'] || '').trim()).length
            }
          }

          // Refresh teams list
          const { data: refreshedTeams } = await db.teams.byTournament(tournamentId)
          setTeams(refreshedTeams ?? [])
          setPlayers({}) // Reset so they reload fresh

          const msg = [
            added > 0 && `${added} new team${added !== 1 ? 's' : ''} added`,
            playersAdded > 0 && `${playersAdded} new player${playersAdded !== 1 ? 's' : ''} added`,
            skipped > 0 && `${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`,
          ].filter(Boolean).join(', ')
          showMessage(msg || 'All up to date - no changes needed')

          // Reload active team
          if (activeTeam) await loadPlayers(activeTeam)
        } catch (err) {
          showMessage('Import failed: ' + err.message, 'error')
        }
        setImporting(false)
        if (allFileRef.current) allFileRef.current.value = ''
      },
      error: () => { showMessage('Failed to parse CSV', 'error'); setImporting(false) }
    })
  }

  // - Export current roster as CSV -
  async function handleExport() {
    const { data: allTeams } = await db.teams.byTournament(tournamentId)
    const { data: allPlayers } = await supabase.from('tournament_players')
      .select('name, number, tournament_team_id').eq('tournament_team_id', allTeams?.map(t => t.id).join(','))
    const rows = []
    for (const team of allTeams ?? []) {
      const teamPlayers = (allPlayers ?? []).filter(p => p.tournament_team_id === team.id)
      if (teamPlayers.length === 0) {
        rows.push([team.name, team.short_name, team.head_coach_name ?? '', team.primary_color ?? '', '', ''])
      } else {
        for (const p of teamPlayers) {
          rows.push([team.name, team.short_name, team.head_coach_name ?? '', team.primary_color ?? '', p.name, p.number ?? ''])
        }
      }
    }
    const header = 'Team Name,Short Name,Coach,Color,Player Name,Player Number'
    const csv = header + '\n' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = (tournament?.name ?? 'roster').replace(/\s+/g,'-').toLowerCase() + '-roster.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) return <PageLoader />

  const activeRoster   = players[activeTeam] ?? []
  const activeTeamData = teams.find(t => t.id === activeTeam)

  return (
    <div style={{ maxWidth:800 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link to={'/director/' + tournamentId} style={{ color:'var(--text-muted)', display:'flex' }}>
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.025em', color:'var(--text-primary)' }}>Roster Manager</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)' }}>{tournament?.name}</p>
          </div>
        </div>

        {/* Top-level actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleExport}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', fontSize:12, fontWeight:600, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:9, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => allFileRef.current?.click()} disabled={importing}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', fontSize:12, fontWeight:600, background:'var(--accent-dim)', border:'1px solid rgba(232,255,71,0.2)', borderRadius:9, cursor:'pointer', color:'var(--accent)', fontFamily:'inherit' }}>
            <Upload size={13} /> {importing ? 'Importing...' : 'Import teams + rosters'}
          </button>
          <input ref={allFileRef} type="file" accept=".csv" style={{ display:'none' }}
            onChange={e => handleCombinedCSV(e.target.files?.[0])} />
        </div>
      </div>

      {/* CSV format hint */}
      <div style={{ padding:'10px 14px', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:10, marginBottom:20, fontSize:12, color:'var(--text-muted)' }}>
        <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Import CSV columns: </span>
        <span style={{ fontFamily:'monospace' }}>Team Name, Short Name, Coach, Color, Player Name, Player Number</span>
        <span style={{ marginLeft:8 }}>- re-import anytime, duplicates are skipped automatically</span>
      </div>

      {/* Message */}
      {message && (
        <div style={{ padding:'10px 14px', borderRadius:9, fontSize:13, fontWeight:500, marginBottom:16,
          background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          color: message.type === 'error' ? '#f87171' : '#4ade80',
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
          {message.text}
        </div>
      )}

      <div style={{ display:'flex', gap:16 }}>
        {/* Team sidebar */}
        <div style={{ width:200, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>
              Teams ({teams.length})
            </span>
            <button onClick={() => setAddingTeam(true)}
              style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, fontWeight:600, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(232,255,71,0.2)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
              <Plus size={11} /> Add
            </button>
          </div>

          {/* Add team form */}
          {addingTeam && (
            <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:10, padding:12, marginBottom:8, display:'flex', flexDirection:'column', gap:8 }}>
              <input className="field-input" style={{ fontSize:13 }} placeholder="Team name" autoFocus
                value={newTeam.name} onChange={e => setNewTeam(p => ({ ...p, name: e.target.value }))} />
              <input className="field-input" style={{ fontSize:13 }} placeholder="Short name (e.g. PHN)"
                value={newTeam.short_name} onChange={e => setNewTeam(p => ({ ...p, short_name: e.target.value }))} />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="color" value={newTeam.primary_color}
                  onChange={e => setNewTeam(p => ({ ...p, primary_color: e.target.value }))}
                  style={{ width:32, height:32, padding:2, borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', background:'transparent' }} />
                <span style={{ fontSize:12, color:'var(--text-muted)', flex:1 }}>{newTeam.primary_color}</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setAddingTeam(false)}
                  style={{ flex:1, padding:'6px', fontSize:12, background:'transparent', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text-muted)', fontFamily:'inherit' }}>
                  Cancel
                </button>
                <button onClick={handleAddTeam} disabled={!newTeam.name.trim() || saving}
                  style={{ flex:1, padding:'6px', fontSize:12, fontWeight:600, background:'var(--accent)', border:'none', borderRadius:7, cursor:'pointer', color:'var(--bg-base)', fontFamily:'inherit' }}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Team list */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {teams.map(t => (
              <div key={t.id} style={{ position:'relative' }}>
                {editingTeam?.id === t.id ? (
                  <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:9, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <input className="field-input" style={{ fontSize:12 }}
                      value={editingTeam.name}
                      onChange={e => setEditingTeam(p => ({ ...p, name: e.target.value }))}
                      autoFocus />
                    <input className="field-input" style={{ fontSize:12 }}
                      placeholder="Short name"
                      value={editingTeam.short_name}
                      onChange={e => setEditingTeam(p => ({ ...p, short_name: e.target.value }))} />
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => setEditingTeam(null)}
                        style={{ flex:1, padding:'4px', background:'transparent', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--text-muted)', fontFamily:'inherit' }}>
                        <X size={12} />
                      </button>
                      <button onClick={handleRenameTeam}
                        style={{ flex:1, padding:'4px', background:'var(--accent)', border:'none', borderRadius:6, cursor:'pointer', color:'var(--bg-base)', fontFamily:'inherit' }}>
                        <Check size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => handleTeamSelect(t.id)}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, border:`1px solid ${activeTeam === t.id ? 'rgba(232,255,71,0.2)' : 'transparent'}`,
                      background: activeTeam === t.id ? 'var(--accent-dim)' : 'transparent', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all 0.15s' }}>
                    <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background:t.primary_color ?? 'var(--border-mid)' }} />
                    <span style={{ fontSize:13, fontWeight: activeTeam === t.id ? 600 : 400, color: activeTeam === t.id ? 'var(--accent)' : 'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {t.name}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{players[t.id]?.length ?? ''}</span>
                    <button onClick={e => { e.stopPropagation(); setEditingTeam({ id:t.id, name:t.name, short_name:t.short_name ?? '' }) }}
                      style={{ padding:3, background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', opacity:0, transition:'opacity 0.15s', flexShrink:0 }}
                      className="group-hover:opacity-100"
                      onMouseEnter={e => e.currentTarget.style.opacity='1'}
                      onMouseLeave={e => e.currentTarget.style.opacity='0'}>
                      <Edit3 size={11} />
                    </button>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Roster panel */}
        <div style={{ flex:1, minWidth:0 }}>
          {activeTeam ? (
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              {/* Panel header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:activeTeamData?.primary_color ?? 'var(--border-mid)' }} />
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{activeTeamData?.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{activeRoster.length} players</span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', fontSize:12, fontWeight:600, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
                    <Upload size={12} /> Import players
                  </button>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
                    onChange={e => handlePlayerCSV(e.target.files?.[0], activeTeam)} />
                  <button onClick={() => addPlayer(activeTeam)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', fontSize:12, fontWeight:600, background:'var(--accent)', border:'none', borderRadius:8, cursor:'pointer', color:'var(--bg-base)', fontFamily:'inherit' }}>
                    <Plus size={12} /> Add player
                  </button>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 64px 64px', gap:8, padding:'8px 16px', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>
                <span>#</span><span>Name</span><span style={{ textAlign:'center' }}>Eligible</span><span />
              </div>

              {/* Players */}
              <div style={{ maxHeight:480, overflowY:'auto' }}>
                {activeRoster.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
                    <Users size={28} style={{ margin:'0 auto 10px', opacity:0.3 }} />
                    <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:4 }}>No players yet</p>
                    <p style={{ fontSize:12 }}>Add manually or import a CSV</p>
                  </div>
                ) : activeRoster.map(player => (
                  <PlayerRow key={player.id} player={player}
                    onChange={updates => updatePlayer(activeTeam, player.id, updates)}
                    onSave={() => savePlayer(activeTeam, { ...player, ...players[activeTeam]?.find(p => p.id === player.id) })}
                    onDelete={() => deletePlayer(activeTeam, player.id)}
                    saving={saving} />
                ))}
              </div>

              <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)' }}>
                Player CSV: <span style={{ fontFamily:'monospace' }}>Player Name, Player Number</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
              <Users size={28} style={{ margin:'0 auto 12px', opacity:0.3 }} />
              <p style={{ fontSize:14, color:'var(--text-secondary)' }}>Select a team</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ player, onChange, onSave, onDelete, saving }) {
  const [dirty, setDirty] = useState(player._new ?? false)

  function handleChange(field, val) { onChange({ [field]: val }); setDirty(true) }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 64px 64px', gap:8, padding:'8px 16px', borderBottom:'1px solid rgba(42,42,50,0.4)', alignItems:'center' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <input type="text" value={player.number ?? ''} onChange={e => handleChange('number', e.target.value)}
        placeholder="#" maxLength={4}
        style={{ width:'100%', fontSize:12, fontFamily:'monospace', textAlign:'center', background:'transparent', border:'none', outline:'none', color:'var(--text-muted)', padding:'2px 4px' }} />
      <input type="text" value={player.name} onChange={e => handleChange('name', e.target.value)}
        placeholder="Player name" autoFocus={player._new}
        style={{ width:'100%', fontSize:14, background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', padding:'2px 4px' }} />
      <div style={{ display:'flex', justifyContent:'center' }}>
        <input type="checkbox" checked={player.is_eligible ?? true}
          onChange={e => handleChange('is_eligible', e.target.checked)}
          style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--accent)' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:4 }}>
        {dirty && (
          <button onClick={() => { onSave(); setDirty(false) }} disabled={saving || !player.name.trim()}
            style={{ padding:4, background:'transparent', border:'none', cursor:'pointer', color:'#4ade80' }}>
            <Save size={13} />
          </button>
        )}
        <button onClick={onDelete}
          style={{ padding:4, background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
