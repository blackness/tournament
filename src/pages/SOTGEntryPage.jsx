import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Star, ChevronLeft, Check } from 'lucide-react'

const SOTG_CATEGORIES = ['Knowledge of Rules','Fouls and Body Contact','Fair Mindedness','Attitude and Self-Control','Communication']
const SCORE_LABELS = { 0:'Very Poor', 1:'Poor', 2:'Acceptable', 3:'Good', 4:'Excellent' }

export function SOTGEntryPage() {
  const { matchId }               = useParams()
  const navigate                  = useNavigate()
  const [match, setMatch]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [scoringTeamId, setScoringTeamId] = useState(null)
  const [scoredTeamId, setScoredTeamId]   = useState(null)
  const [scores, setScores]       = useState(SOTG_CATEGORIES.map(() => 2))
  const [comments, setComments]   = useState('')

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from('matches').select(`
        id, status, score_a, score_b,
        tournament:tournaments(id, sotg_enabled, sport_template:sport_templates(config)),
        team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
        team_b:tournament_teams!team_b_id(id, name, short_name, primary_color)
      `).eq('id', matchId).single()
      setMatch(m)
      setLoading(false)
    }
    load()
  }, [matchId])

  async function handleSubmit() {
    if (!scoringTeamId || !scoredTeamId) { setError('Select your team'); return }
    setSubmitting(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const total = scores.reduce((a, b) => a + b, 0)
    const { error } = await supabase.from('sotg_scores').insert({
      match_id: matchId, scoring_team_id: scoringTeamId, scored_team_id: scoredTeamId,
      category_scores: scores, total_score: total, comments: comments.trim() || null, submitted_by: user?.id,
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    setSubmitted(true); setSubmitting(false)
  }

  if (loading) return <PageLoader />
  if (!match) return <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-muted)' }}>Game not found</div>
  if (match.status !== 'complete') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'64px 20px', textAlign:'center', color:'var(--text-muted)' }}>
      <p style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Game not finished yet</p>
      <p style={{ fontSize:13 }}>SOTG can only be submitted after the game is complete.</p>
    </div>
  )

  const cats  = match.tournament?.sport_template?.config?.sotg_categories ?? SOTG_CATEGORIES
  const scale = match.tournament?.sport_template?.config?.sotg_scale ?? { min:0, max:4 }
  const total = scores.reduce((a, b) => a + b, 0)

  if (submitted) return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'64px 20px', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(34,197,94,0.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <Check size={28} style={{ color:'#4ade80' }} />
      </div>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Spirit score submitted!</h2>
      <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24 }}>Total: {total} / {cats.length * scale.max}</p>
      <button onClick={() => navigate(-1)} className="btn btn-secondary">Back to game</button>
    </div>
  )

  return (
    <div style={{ maxWidth:540, margin:'0 auto', padding:'32px 20px 80px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => navigate(-1)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.025em', color:'var(--text-primary)' }}>Spirit of the Game</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>{match.team_a?.name} vs {match.team_b?.name}</p>
        </div>
      </div>

      {error && <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9, fontSize:13, color:'#f87171', marginBottom:20 }}>{error}</div>}

      {/* Team selector */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:10 }}>Your team</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[match.team_a, match.team_b].map(team => (
            <button key={team.id} onClick={() => { setScoringTeamId(team.id); setScoredTeamId(team.id === match.team_a?.id ? match.team_b?.id : match.team_a?.id) }}
              style={{ padding:'12px 14px', borderRadius:12, border: scoringTeamId === team.id ? '1.5px solid var(--accent)' : '1px solid var(--border-mid)',
                background: scoringTeamId === team.id ? 'var(--accent-dim)' : 'var(--bg-raised)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, transition:'all 0.15s' }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:team.primary_color ?? 'var(--border-mid)', flexShrink:0 }} />
              <span style={{ fontSize:13, fontWeight:500, color: scoringTeamId === team.id ? 'var(--accent)' : 'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{team.name}</span>
            </button>
          ))}
        </div>
        {scoredTeamId && (
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:8 }}>
            Scoring spirit of: <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>
              {(scoredTeamId === match.team_a?.id ? match.team_a : match.team_b)?.name}
            </span>
          </p>
        )}
      </div>

      {/* Categories */}
      <div style={{ display:'flex', flexDirection:'column', gap:20, marginBottom:24 }}>
        {cats.map((cat, idx) => (
          <div key={idx}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{cat}</p>
              <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20,
                color: scores[idx] <= 1 ? '#f87171' : scores[idx] === 2 ? '#fde047' : '#4ade80',
                background: scores[idx] <= 1 ? 'rgba(239,68,68,0.1)' : scores[idx] === 2 ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)' }}>
                {scores[idx]} - {SCORE_LABELS[scores[idx]]}
              </span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => i + scale.min).map(val => (
                <button key={val} onClick={() => setScores(prev => { const n = [...prev]; n[idx] = val; return n })}
                  style={{ flex:1, padding:'12px 8px', borderRadius:10, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, transition:'all 0.15s',
                    borderColor: scores[idx] === val ? (val <= 1 ? '#ef4444' : val === 2 ? '#eab308' : '#22c55e') : 'var(--border)',
                    background: scores[idx] === val ? (val <= 1 ? 'rgba(239,68,68,0.2)' : val === 2 ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)') : 'var(--bg-raised)',
                    color: scores[idx] === val ? (val <= 1 ? '#f87171' : val === 2 ? '#fde047' : '#4ade80') : 'var(--text-muted)' }}>
                  {val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:12, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Star size={16} style={{ color:'#fde047' }} />
          <span style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)' }}>Total spirit score</span>
        </div>
        <span style={{ fontFamily:'DM Mono, monospace', fontSize:24, fontWeight:500, color:'var(--text-primary)' }}>
          {total}<span style={{ fontSize:14, color:'var(--text-muted)' }}>/{cats.length * scale.max}</span>
        </span>
      </div>

      {/* Comments */}
      <div style={{ marginBottom:24 }}>
        <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>
          Comments <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(optional)</span>
        </label>
        <textarea className="field-input" rows={3} style={{ resize:'none' }}
          placeholder="Any specific feedback for the other team..."
          value={comments} onChange={e => setComments(e.target.value)} maxLength={500} />
      </div>

      <button onClick={handleSubmit} disabled={submitting || !scoringTeamId} className="btn btn-primary btn-lg" style={{ width:'100%' }}>
        {submitting ? 'Submitting...' : 'Submit spirit score'}
      </button>
    </div>
  )
}
