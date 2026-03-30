import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'

function LogoMark() {
  return (
    <div style={{ width:40, height:40, background:'#e8ff47', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 12H2L8 2Z" fill="#0a0a0c"/>
      </svg>
    </div>
  )
}

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm] = useState({ displayName:'', email:'', password:'', confirmPw:'', role:'director', clubName:'' })
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function update(field, val) { setForm(p => ({ ...p, [field]: val })); setError(null) }

  async function handleSubmit() {
    if (form.password !== form.confirmPw) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(null)
    try {
      const { data, error } = await signUp({
        email:       form.email.trim(),
        password:    form.password,
        displayName: form.displayName.trim(),
        role:        form.role,
        clubName:    form.clubName.trim(),
      })
      console.log('[Signup] result:', { data, error })
      if (error) { setError(error.message); return }
      if (data?.user && !data.session) { setSuccess(true) }
      else { navigate('/director') }
    } catch (err) {
      console.error('[Signup] caught error:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ maxWidth:380, textAlign:'center', width:'100%' }}>
        <div style={{ width:56, height:56, background:'rgba(34,197,94,0.12)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <CheckCircle size={28} style={{ color:'#4ade80' }} />
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Check your email</h2>
        <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:24 }}>
          We sent a confirmation link to <strong style={{ color:'var(--text-primary)' }}>{form.email}</strong>
        </p>
        <Link to="/login" className="btn btn-primary">Back to sign in</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px', background:'var(--bg-base)' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <LogoMark />
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', marginBottom:6 }}>Create account</h1>
          <p style={{ fontSize:14, color:'var(--text-muted)' }}>Join athleteOS to manage tournaments</p>
        </div>

        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          {error && (
            <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9, fontSize:13, color:'#f87171' }}>{error}</div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Your name *</label>
              <input type="text" className="field-input" placeholder="Jane Smith" autoFocus
                value={form.displayName} onChange={e => update('displayName', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Email *</label>
              <input type="email" className="field-input" placeholder="jane@example.com"
                value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Password *</label>
              <div style={{ position:'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="field-input" style={{ paddingRight:40 }} placeholder="8+ characters"
                  value={form.password} onChange={e => update('password', e.target.value)} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Confirm password *</label>
              <input type={showPw ? 'text' : 'password'} className="field-input" placeholder="Repeat password"
                value={form.confirmPw} onChange={e => update('confirmPw', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:8 }}>I am a...</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['director','Tournament Director'], ['scorekeeper','Scorekeeper']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => update('role', val)}
                    style={{ padding:'10px 12px', borderRadius:10, border: form.role === val ? '1.5px solid var(--accent)' : '1px solid var(--border-mid)', background: form.role === val ? 'var(--accent-dim)' : 'var(--bg-raised)', color: form.role === val ? 'var(--accent)' : 'var(--text-secondary)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>Club / org <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(optional)</span></label>
              <input type="text" className="field-input" placeholder="Kingston Ultimate"
                value={form.clubName} onChange={e => update('clubName', e.target.value)} />
            </div>
            <button onClick={handleSubmit} disabled={loading || !form.displayName || !form.email || !form.password} className="btn btn-primary btn-lg" style={{ width:'100%', marginTop:4 }}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </div>
        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
