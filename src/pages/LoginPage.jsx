import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

function LogoMark() {
  return (
    <div style={{ width:40, height:40, background:'#e8ff47', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 12H2L8 2Z" fill="#0a0a0c"/>
      </svg>
    </div>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || '/director'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    if (e?.preventDefault) e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate(from, { replace: true })
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', background:'var(--bg-base)' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <LogoMark />
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', marginBottom:6 }}>Welcome back</h1>
          <p style={{ fontSize:14, color:'var(--text-muted)' }}>Sign in to your athleteOS account</p>
        </div>

        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          {error && (
            <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9, fontSize:13, color:'#f87171' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Email</label>
              <input type="email" className="field-input" autoFocus
                value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="field-input" style={{ paddingRight:40 }}
                  value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width:'100%', marginTop:4 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text-muted)' }}>
          New to athleteOS?{' '}
          <Link to="/signup" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
