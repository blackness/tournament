import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Star, ChevronLeft, Check } from 'lucide-react'

const SOTG_CATEGORIES = [
  'Knowledge of Rules',
  'Fouls and Body Contact',
  'Fair Mindedness',
  'Attitude and Self-Control',
  'Communication',
]

const SCORE_LABELS = { 0: 'Very Poor', 1: 'Poor', 2: 'Acceptable', 3: 'Good', 4: 'Excellent' }

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
      const { data: m } = await supabase
        .from('matches')
        .select(`
          id, status, score_a, score_b,
          tournament:tournaments(id, sotg_enabled, sport_template:sport_templates(config)),
          team_a:tournament_teams!team_a_id(id, name, short_name, primary_color),
          team_b:tournament_teams!team_b_id(id, name, short_name, primary_color)
        `)
        .eq('id', matchId)
        .single()
      setMatch(m)
      setLoading(false)
    }
    load()
  }, [matchId])

  async function handleSubmit() {
    if (!scoringTeamId || !scoredTeamId) { setError('Select which team you are submitting for'); return }
    setSubmitting(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const total = scores.reduce((a, b) => a + b, 0)
    const { error } = await supabase.from('sotg_scores').insert({
      match_id:        matchId,
      scoring_team_id: scoringTeamId,
      scored_team_id:  scoredTeamId,
      category_scores: scores,
      total_score:     total,
      comments:        comments.trim() || null,
      submitted_by:    user?.id,
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return <PageLoader />
  if (!match) return <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400"><p>Game not found</p></div>

  const sotgEnabled = match.tournament?.sotg_enabled !== false
  if (!sotgEnabled) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
      <p>SOTG is not enabled for this tournament.</p>
    </div>
  )

  if (match.status !== 'complete') return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
      <p className="font-semibold text-gray-700">Game not finished yet</p>
      <p className="text-sm mt-1">SOTG can only be submitted after the game is complete.</p>
    </div>
  )

  const cats = match.tournament?.sport_template?.config?.sotg_categories ?? SOTG_CATEGORIES
  const scale = match.tournament?.sport_template?.config?.sotg_scale ?? { min: 0, max: 4 }

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check size={28} className="text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Spirit score submitted!</h2>
      <p className="text-gray-500 text-sm">Total: {scores.reduce((a, b) => a + b, 0)} / {cats.length * scale.max}</p>
      <button onClick={() => navigate(-1)} className="btn-secondary btn">Back to game</button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Spirit of the Game</h1>
          <p className="text-sm text-gray-400">
            {match.team_a?.name} vs {match.team_b?.name}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Which team are you? */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Your team</p>
        <div className="grid grid-cols-2 gap-3">
          {[match.team_a, match.team_b].map(team => (
            <button
              key={team.id}
              onClick={() => {
                setScoringTeamId(team.id)
                setScoredTeamId(team.id === match.team_a?.id ? match.team_b?.id : match.team_a?.id)
              }}
              className={'flex items-center gap-2 p-3 rounded-xl border-2 transition-all ' + (
                scoringTeamId === team.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.primary_color ?? '#6b7280' }} />
              <span className="text-sm font-medium text-gray-800 truncate">{team.name}</span>
            </button>
          ))}
        </div>
        {scoredTeamId && (
          <p className="text-xs text-gray-400 mt-2">
            Scoring the spirit of: <span className="font-semibold text-gray-600">
              {(scoredTeamId === match.team_a?.id ? match.team_a : match.team_b)?.name}
            </span>
          </p>
        )}
      </div>

      {/* Category scores */}
      <div className="space-y-5">
        {cats.map((cat, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">{cat}</p>
              <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + scoreColor(scores[idx])}>
                {scores[idx]} - {SCORE_LABELS[scores[idx]] ?? scores[idx]}
              </span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => i + scale.min).map(val => (
                <button
                  key={val}
                  onClick={() => setScores(prev => { const n = [...prev]; n[idx] = val; return n })}
                  className={'flex-1 py-3 rounded-xl text-sm font-bold transition-all ' + (
                    scores[idx] === val
                      ? 'text-white shadow-sm scale-105 ' + scoreButtonActive(val)
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="text-sm font-semibold text-gray-700">Total spirit score</span>
        </div>
        <span className="text-2xl font-black text-gray-900 tabular-nums">
          {scores.reduce((a, b) => a + b, 0)}
          <span className="text-sm font-normal text-gray-400">/{cats.length * scale.max}</span>
        </span>
      </div>

      {/* Comments */}
      <div className="field-group">
        <label className="field-label">Comments <span className="text-gray-400">(optional)</span></label>
        <textarea
          className="field-input resize-none"
          rows={3}
          placeholder="Any specific feedback for the other team..."
          value={comments}
          onChange={e => setComments(e.target.value)}
          maxLength={500}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !scoringTeamId}
        className="btn-primary btn w-full btn-lg"
      >
        {submitting ? 'Submitting...' : 'Submit spirit score'}
      </button>
    </div>
  )
}

function scoreColor(val) {
  if (val <= 1) return 'bg-red-100 text-red-700'
  if (val === 2) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function scoreButtonActive(val) {
  if (val <= 1) return 'bg-red-500'
  if (val === 2) return 'bg-yellow-500'
  return 'bg-green-500'
}
