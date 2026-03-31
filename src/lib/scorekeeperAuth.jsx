import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Lock, ChevronLeft, Eye, EyeOff } from 'lucide-react'

const SCREEN = { PRE: 'pre', LIVE: 'live', POST: 'post' }
const PIN_STORAGE_PREFIX = 'sk_pin_'

// --- Auth check helper --------------------------------------------------------
async function checkScorekeeperAuth(matchId, tournamentId, scorekeeperPin) {
  // 1. Check if logged-in user is director or assigned scorekeeper
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: t } = await supabase
      .from('tournaments').select('director_id')
      .eq('id', tournamentId).single()
    if (t?.director_id === user.id) return { authed: true, method: 'director' }

    const { data: role } = await supabase
      .from('tournament_roles').select('id, assigned_match_ids')
      .eq('user_id', user.id).eq('tournament_id', tournamentId)
      .in('role', ['scorekeeper', 'co_director', 'director'])
      .maybeSingle()
    if (role) {
      const assigned = !role.assigned_match_ids
        || role.assigned_match_ids.length === 0
        || role.assigned_match_ids.includes(matchId)
      if (assigned) return { authed: true, method: 'role' }
    }
  }

  // 2. Check PIN stored in localStorage
  if (scorekeeperPin) {
    const stored = localStorage.getItem(PIN_STORAGE_PREFIX + matchId)
               || localStorage.getItem(PIN_STORAGE_PREFIX + tournamentId)
    if (stored === scorekeeperPin) return { authed: true, method: 'pin' }
  }

  return { authed: false, method: null }
}

// --- PIN Gate component -------------------------------------------------------
function PinGate({ match, onSuccess }) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState(null)
  const [show, setShow]       = useState(false)
  const [checking, setChecking] = useState(false)

  function handleDigit(d) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError(null)
    if (next.length >= (match.scorekeeper_pin?.length ?? 4)) {
      verify(next)
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1))
    setError(null)
  }

  async function verify(attempt) {
    setChecking(true)
    const p = attempt ?? pin
    if (!match.scorekeeper_pin) {
      setError('No PIN set for this game. Ask the tournament director.')
      setChecking(false)
      setPin('')
      return
    }
    if (p === match.scorekeeper_pin) {
      // Store PIN so they don't need to re-enter in same session
      localStorage.setItem(PIN_STORAGE_PREFIX + match.id, p)
      onSuccess()
    } else {
      setError('Incorrect PIN')
      setPin('')
    }
    setChecking(false)
  }

  const teamA = match.team_a
  const teamB = match.team_b

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 gap-6">
      {/* Back */}
      <div className="absolute top-4 left-4">
        <Link to={'/t/' + match.tournament?.slug + '/gameday'} className="text-gray-600 hover:text-gray-400">
          <ChevronLeft size={20} />
        </Link>
      </div>

      {/* Game info */}
      <div className="text-center space-y-1">
        <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Lock size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-400 text-xs uppercase tracking-widest">Scorekeeper access</p>
        <p className="text-white font-bold text-lg">
          {teamA?.name ?? 'TBD'} vs {teamB?.name ?? 'TBD'}
        </p>
        {match.venue && (
          <p className="text-gray-500 text-sm">{match.venue?.name}</p>
        )}
      </div>

      {/* PIN display */}
      <div className="flex items-center gap-3">
        {Array.from({ length: match.scorekeeper_pin?.length ?? 4 }).map((_, i) => (
          <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-colors ${
            i < pin.length
              ? 'border-blue-500 bg-blue-500/10 text-white'
              : 'border-gray-700 bg-gray-900 text-gray-700'
          }`}>
            {i < pin.length ? (show ? pin[i] : '*') : ''}
          </div>
        ))}
        <button onClick={() => setShow(s => !s)} className="ml-2 text-gray-600 hover:text-gray-400 p-1">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {checking && <p className="text-gray-500 text-sm">Checking...</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {[1,2,3,4,5,6,7,8,9,'',0,'DEL'].map((d, i) => (
          <button
            key={i}
            onClick={() => d === 'DEL' ? handleBackspace() : d !== '' ? handleDigit(String(d)) : null}
            disabled={d === ''}
            className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
              d === '' ? 'invisible' :
              d === 'DEL' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' :
              'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <p className="text-gray-600 text-xs text-center max-w-xs">
        Enter the scorekeeper PIN provided by the tournament director
      </p>
    </div>
  )
}

// --- Main ScorekeeperPage export ----------------------------------------------
export { PinGate, checkScorekeeperAuth, PIN_STORAGE_PREFIX, SCREEN }
