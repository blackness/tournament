import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useAdmin } from '../../lib/AdminContext'
import { supabase } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { Shield, Users, Trophy, Trash2, ExternalLink, Eye, X, Search, AlertTriangle } from 'lucide-react'

export function AdminDashboard() {
  const { user, profile }                         = useAuth()
  const { startSimulation, isSimulating, simulatedUser, stopSimulation } = useAdmin()
  const [tournaments, setTournaments]             = useState([])
  const [users, setUsers]                         = useState([])
  const [loading, setLoading]                     = useState(true)
  const [tab, setTab]                             = useState('tournaments')
  const [search, setSearch]                       = useState('')
  const [deleteTarget, setDeleteTarget]           = useState(null)
  const [deleting, setDeleting]                   = useState(false)
  const navigate                                  = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('tournaments').select('id, slug, name, status, primary_color, start_date, director_id, created_at')
        .is('deleted_at', null).order('created_at', { ascending: false })
      setTournaments(t ?? [])
      const { data: u } = await supabase
        .from('user_profiles').select('id, email, display_name, role, club_name, created_at')
        .order('created_at', { ascending: false })
      setUsers(u ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(tournament) {
    setDeleting(true)
    await supabase.from('tournaments').update({ deleted_at: new Date().toISOString() }).eq('id', tournament.id)
    setTournaments(prev => prev.filter(t => t.id !== tournament.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  async function handleRoleChange(userId, newRole) {
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  function simulateAs(simulatedProfile) {
    startSimulation(simulatedProfile)
    navigate('/tournaments')
  }

  if (loading) return <PageLoader />

  const filteredTournaments = tournaments.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()))
  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  const STATUS_COLOR = { draft:'var(--text-muted)', published:'#a78bfa', live:'var(--live)', review:'#fde047', archived:'var(--text-muted)' }
  const ROLE_COLOR   = { admin:'var(--accent)', director:'#a78bfa', scorekeeper:'#60a5fa' }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'var(--accent-dim)', border:'1px solid rgba(232,255,71,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Shield size={18} style={{ color:'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>Admin</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>Full platform access</p>
        </div>
      </div>

      {/* Simulation banner */}
      {isSimulating && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.25)', borderRadius:10, marginBottom:20 }}>
          <span style={{ fontSize:13, color:'#fde047', fontWeight:500 }}>
            Simulating: <strong>{simulatedUser?.display_name ?? 'Anonymous'}</strong> ({simulatedUser?.role ?? 'public'})
          </span>
          <button onClick={() => { stopSimulation(); navigate('/admin') }}
            style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#fde047', background:'transparent', border:'1px solid rgba(234,179,8,0.3)', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>
            <X size={12} /> Exit
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:24 }}>
        {[['Tournaments', tournaments.length], ['Users', users.length], ['Live', tournaments.filter(t => t.status === 'live').length]].map(([label, val]) => (
          <div key={label} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <p style={{ fontFamily:'DM Mono, monospace', fontSize:26, fontWeight:500, color:'var(--text-primary)', lineHeight:1 }}>{val}</p>
            <p style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)', marginTop:5 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Simulate buttons */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        <p style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center', marginRight:4 }}>View as:</p>
        <button onClick={() => simulateAs({ role:'public', display_name:'Anonymous visitor' })}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', fontSize:12, fontWeight:600, background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
          <Eye size={12} /> Public
        </button>
        <button onClick={() => simulateAs({ role:'scorekeeper', display_name:'Scorekeeper' })}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', fontSize:12, fontWeight:600, background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:8, cursor:'pointer', color:'#60a5fa', fontFamily:'inherit' }}>
          <Eye size={12} /> Scorekeeper
        </button>
        {users.filter(u => u.role === 'director' && u.id !== user?.id).map(u => (
          <button key={u.id} onClick={() => simulateAs(u)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', fontSize:12, fontWeight:600, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:8, cursor:'pointer', color:'#a78bfa', fontFamily:'inherit' }}>
            <Eye size={12} /> {u.display_name ?? u.email}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'var(--bg-raised)', borderRadius:10, padding:3, gap:2, marginBottom:16 }}>
        {[['tournaments','Tournaments'], ['users','Users']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex:1, padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:600, fontFamily:'inherit', border:'none', cursor:'pointer',
              background: tab === t ? 'var(--bg-surface)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ position:'relative', marginBottom:14 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
        <input className="field-input" style={{ paddingLeft:36 }} placeholder="Search..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tournaments */}
      {tab === 'tournaments' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filteredTournaments.map(t => {
            const director = users.find(u => u.id === t.director_id)
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ width:4, background:t.primary_color ?? 'var(--border-mid)', alignSelf:'stretch', flexShrink:0 }} />
                <div style={{ flex:1, padding:'12px 16px', minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.name}</span>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color: STATUS_COLOR[t.status], flexShrink:0 }}>
                      {t.status === 'live' && <span className="live-dot" style={{ marginRight:3 }} />}
                      {t.status}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--text-muted)' }}>{director?.display_name ?? 'Unknown'} &middot; {director?.email}</p>
                </div>
                <div style={{ display:'flex', gap:6, padding:'0 14px', flexShrink:0 }}>
                  <Link to={'/t/' + t.slug}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', fontSize:11, fontWeight:600, color:'var(--text-secondary)', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:7, textDecoration:'none' }}>
                    <ExternalLink size={11} /> View
                  </Link>
                  <Link to={'/director/' + t.id}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', fontSize:11, fontWeight:600, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(232,255,71,0.2)', borderRadius:7, textDecoration:'none' }}>
                    <Shield size={11} /> Manage
                  </Link>
                  <button onClick={() => setDeleteTarget(t)}
                    style={{ padding:'5px 8px', color:'#f87171', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, cursor:'pointer', fontFamily:'inherit' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
          {filteredTournaments.length === 0 && <p style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'var(--text-muted)' }}>No tournaments</p>}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filteredUsers.map(u => (
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-hover)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: ROLE_COLOR[u.role] ?? 'var(--text-secondary)', flexShrink:0 }}>
                {(u.display_name ?? u.email ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{u.display_name}</p>
                  {u.id === user?.id && <span style={{ fontSize:10, color:'var(--accent)', background:'var(--accent-dim)', padding:'1px 7px', borderRadius:10, fontWeight:700 }}>You</span>}
                </div>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                  disabled={u.id === user?.id}
                  style={{ fontSize:12, fontWeight:600, padding:'5px 10px', borderRadius:8, border:'1px solid var(--border-mid)', background:'var(--bg-raised)', color: ROLE_COLOR[u.role] ?? 'var(--text-secondary)', fontFamily:'inherit', cursor: u.id === user?.id ? 'not-allowed' : 'pointer' }}>
                  <option value="director">Director</option>
                  <option value="scorekeeper">Scorekeeper</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== user?.id && (
                  <button onClick={() => simulateAs(u)}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', fontSize:11, fontWeight:600, color:'#a78bfa', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:7, cursor:'pointer', fontFamily:'inherit' }}>
                    <Eye size={11} /> Simulate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
          <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:16, width:'100%', maxWidth:360, padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <AlertTriangle size={18} style={{ color:'#f87171' }} />
              </div>
              <div>
                <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Delete tournament?</h2>
                <p style={{ fontSize:13, color:'var(--text-muted)' }}>{deleteTarget.name}</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost" style={{ flex:1 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting} className="btn btn-danger" style={{ flex:1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
