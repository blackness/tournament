import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { Trophy, LogOut, ChevronLeft, LayoutDashboard } from 'lucide-react'

function LogoMark() {
  return (
    <div style={{ width:26, height:26, background:'#e8ff47', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 12H2L8 2Z" fill="#0a0a0c"/>
      </svg>
    </div>
  )
}

export function DirectorLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Director'
  const initials    = displayName.slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)' }}>
      {/* Director nav */}
      <header style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:30 }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6" style={{ height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Link to="/tournaments" style={{ display:'flex', alignItems:'center', gap:9, textDecoration:'none' }}>
              <LogoMark />
              <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.025em' }}>athleteOS</span>
            </Link>
            <div style={{ width:1, height:18, background:'var(--border)', margin:'0 4px' }} />
            <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>Director</span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Link to="/tournaments" style={{ fontSize:13, color:'var(--text-muted)', padding:'5px 10px', borderRadius:7, textDecoration:'none' }}
              className="hover:text-[var(--text-secondary)] transition-colors">
              Public view
            </Link>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', borderRadius:9, background:'var(--bg-raised)', border:'1px solid var(--border)' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--accent)' }}>
                {initials}
              </div>
              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{displayName}</span>
            </div>
            <button onClick={handleSignOut}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-muted)', fontFamily:'inherit' }}
              className="hover:text-[var(--text-secondary)] transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex:1 }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6" style={{ padding:'32px 24px 80px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
