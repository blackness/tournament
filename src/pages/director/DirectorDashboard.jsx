import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { db, supabase } from '../../lib/supabase'
import { TOURNAMENT_STATUS_LABELS } from '../../lib/constants'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { Plus, Trash2, AlertTriangle, X, ChevronRight, Calendar, MapPin } from 'lucide-react'

export function DirectorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => {
    if (!user) return
    db.tournaments.mine(user.id).then(({ data }) => {
      setTournaments(data ?? [])
      setLoading(false)
    })
  }, [user])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('tournaments').update({ deleted_at: new Date().toISOString() })
      .eq('id', deleteTarget.id).eq('director_id', user.id)
    setTournaments(prev => prev.filter(t => t.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  if (loading) return <PageLoader />

  const STATUS_COLOR = {
    draft:'var(--text-muted)', published:'#a5b4fc', live:'var(--live)', review:'#fde047', archived:'var(--text-muted)'
  }

  const formatDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-CA', { month:'short', day:'numeric', year:'numeric' }) : ''

  return (
    <div style={{ maxWidth:800 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>My Tournaments</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Manage your tournaments and create new ones.</p>
        </div>
        <Link to="/director/new" className="btn btn-primary">
          <Plus size={15} /> New tournament
        </Link>
      </div>

      {/* Tournament list */}
      {tournaments.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 20px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:16 }}>
          <div style={{ fontSize:36, marginBottom:16 }}></div>
          <p style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)', marginBottom:8 }}>No tournaments yet</p>
          <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:20 }}>Create your first tournament to get started.</p>
          <Link to="/director/new" className="btn btn-primary">Create tournament</Link>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {tournaments.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', transition:'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-mid)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              {/* Color bar */}
              <div style={{ width:4, background:t.primary_color ?? 'var(--border-mid)', alignSelf:'stretch', flexShrink:0 }} />

              <Link to={'/director/' + t.id} style={{ flex:1, padding:'14px 18px', textDecoration:'none', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:t.primary_color ?? 'var(--bg-hover)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {(t.name ?? '?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.name}
                  </div>
                  <div style={{ display:'flex', gap:12, marginTop:3, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap' }}>
                    {t.start_date && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Calendar size={11} />{formatDate(t.start_date)}</span>}
                    <span style={{ color: STATUS_COLOR[t.status] ?? 'var(--text-muted)', fontWeight:600, fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                      {t.status === 'live' && <span className="live-dot" style={{ marginRight:4 }} />}
                      {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color:'var(--text-muted)', flexShrink:0 }} />
              </Link>

              <button onClick={() => setDeleteTarget(t)}
                style={{ padding:'0 16px', alignSelf:'stretch', background:'transparent', border:'none', borderLeft:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)', transition:'color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
          <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:16, width:'100%', maxWidth:400, padding:24 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <AlertTriangle size={18} style={{ color:'#f87171' }} />
                </div>
                <div>
                  <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Delete tournament?</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>This cannot be undone.</p>
                </div>
              </div>
              <button onClick={() => setDeleteTarget(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background:'var(--bg-hover)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
              <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{deleteTarget.name}</p>
              {deleteTarget.start_date && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{formatDate(deleteTarget.start_date)}</p>}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn btn-ghost" style={{ flex:1 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger" style={{ flex:1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
