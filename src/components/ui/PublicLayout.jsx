import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { LayoutDashboard, LogOut, Menu, X, User, ChevronDown, Shield, Eye } from 'lucide-react'
import { useAdmin } from '../../lib/AdminContext'
import { useState, useRef, useEffect } from 'react'

function LogoMark() {
  return (
    <div style={{ width:28, height:28, background:'#e8ff47', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 12H2L8 2Z" fill="#0a0a0c"/>
      </svg>
    </div>
  )
}

export function PublicLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { isSimulating, simulatedUser, stopSimulation } = useAdmin()
  const [menuOpen, setMenuOpen]       = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await signOut()
    setProfileOpen(false)
    navigate('/tournaments')
  }

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Account'
  const isDirector  = profile?.role === 'director' || profile?.role === 'admin'
  const initials    = displayName.slice(0,2).toUpperCase()

  return (
    <div className="min-h-screen flex flex-col" style={{ background:'var(--bg-base)' }}>
      {/* Nav */}
      <header style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:30 }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6" style={{ height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link to="/tournaments" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <LogoMark />
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.025em' }}>athleteOS</span>
          </Link>

          {/* Desktop */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link to="/tournaments" style={{ fontSize:13, color:'var(--text-secondary)', padding:'5px 10px', borderRadius:7, textDecoration:'none' }}
              className="hover:text-[var(--text-primary)] transition-colors">
              Tournaments
            </Link>

            {user ? (
              <>
                {isDirector && (
                  <Link to="/director" style={{ fontSize:13, color:'var(--text-secondary)', padding:'5px 10px', borderRadius:7, textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}
                    className="hover:text-[var(--text-primary)] transition-colors">
                    <LayoutDashboard size={13} /> Director
                  </Link>
                )}
                {profile?.role === 'admin' && (
                  <Link to="/admin" style={{ fontSize:13, color:'var(--accent)', padding:'5px 10px', borderRadius:7, textDecoration:'none', display:'flex', alignItems:'center', gap:5, border:'1px solid rgba(232,255,71,0.2)', background:'var(--accent-dim)' }}
                    className="hover:opacity-80 transition-opacity">
                    <Shield size={13} /> Admin
                  </Link>
                )}
                {/* Profile dropdown */}
                <div style={{ position:'relative', marginLeft:4 }} ref={profileRef}>
                  <button onClick={() => setProfileOpen(o => !o)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:9, background:'transparent', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}
                    className="hover:border-[var(--border-mid)] hover:text-[var(--text-primary)] transition-colors">
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--bg-hover)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--accent)' }}>
                      {initials}
                    </div>
                    <span style={{ fontSize:13, fontWeight:500, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</span>
                    <ChevronDown size={12} />
                  </button>

                  {profileOpen && (
                    <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', width:200, background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:50, overflow:'hidden' }}>
                      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
                        <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</p>
                        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis' }}>{user.email}</p>
                        {profile?.role && (
                          <span style={{ display:'inline-block', marginTop:6, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--accent)', background:'var(--accent-dim)', padding:'2px 7px', borderRadius:20 }}>
                            {profile.role}
                          </span>
                        )}
                      </div>
                      {isDirector && (
                        <Link to="/director" onClick={() => setProfileOpen(false)}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}
                          className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                          <LayoutDashboard size={14} /> My tournaments
                        </Link>
                      )}
                      <Link to="/profile" onClick={() => setProfileOpen(false)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', fontSize:13, color:'var(--text-secondary)', textDecoration:'none' }}
                        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                        <User size={14} /> Profile
                      </Link>
                      <div style={{ borderTop:'1px solid var(--border)', marginTop:2 }}>
                        <button onClick={handleSignOut}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', fontSize:13, color:'#f87171', background:'transparent', border:'none', cursor:'pointer', width:'100%', fontFamily:'inherit' }}
                          className="hover:bg-[rgba(239,68,68,0.08)]">
                          <LogOut size={14} /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
              </div>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button className="sm:hidden p-2 rounded-lg" style={{ background:'transparent', border:'none', color:'var(--text-secondary)', cursor:'pointer' }}
            onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg-surface)', padding:'12px 16px', display:'flex', flexDirection:'column', gap:2 }}>
            <Link to="/tournaments" style={{ padding:'10px 8px', fontSize:14, color:'var(--text-secondary)', textDecoration:'none', borderRadius:8 }} onClick={() => setMenuOpen(false)}>
              Tournaments
            </Link>
            {user ? (
              <>
                {isDirector && (
                  <Link to="/director" style={{ padding:'10px 8px', fontSize:14, color:'var(--text-secondary)', textDecoration:'none', borderRadius:8 }} onClick={() => setMenuOpen(false)}>
                    Director dashboard
                  </Link>
                )}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:6 }}>
                  <p style={{ fontSize:11, color:'var(--text-muted)', padding:'0 8px 8px' }}>{user.email}</p>
                  <button onClick={handleSignOut} style={{ padding:'10px 8px', fontSize:14, color:'#f87171', background:'transparent', border:'none', cursor:'pointer', width:'100%', textAlign:'left', fontFamily:'inherit' }}>
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display:'flex', gap:8, paddingTop:10, borderTop:'1px solid var(--border)', marginTop:6 }}>
                <Link to="/login" className="btn btn-ghost btn-sm flex-1 text-center" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm flex-1 text-center" onClick={() => setMenuOpen(false)}>Sign up</Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Simulation banner */}
      {isSimulating && (
        <div style={{ background:'rgba(234,179,8,0.1)', borderBottom:'1px solid rgba(234,179,8,0.2)', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:12, color:'#fde047', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Eye size={13} /> Viewing as: <strong>{simulatedUser?.display_name ?? 'Anonymous'}</strong> ({simulatedUser?.role ?? 'public'})
          </span>
          <button onClick={() => { stopSimulation(); navigate('/admin') }}
            style={{ fontSize:11, fontWeight:600, color:'#fde047', background:'transparent', border:'1px solid rgba(234,179,8,0.3)', borderRadius:6, padding:'3px 9px', cursor:'pointer', fontFamily:'inherit' }}>
            Exit simulation
          </button>
        </div>
      )}
      <main className="flex-1"><Outlet /></main>

      <footer style={{ borderTop:'1px solid var(--border)', padding:'20px 24px' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between" style={{ fontSize:12, color:'var(--text-muted)' }}>
          <span>athleteOS</span>
          <div className="flex gap-4">
            <Link to="/tournaments" style={{ color:'var(--text-muted)', textDecoration:'none' }} className="hover:text-[var(--text-secondary)]">Tournaments</Link>
            {!user && <Link to="/signup" style={{ color:'var(--text-muted)', textDecoration:'none' }} className="hover:text-[var(--text-secondary)]">Sign up</Link>}
          </div>
        </div>
      </footer>
    </div>
  )
}
