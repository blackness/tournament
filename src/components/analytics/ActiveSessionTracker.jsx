import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function getSessionId() {
  const key = 'aos_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function ActiveSessionTracker({ tournamentId, page, userId = null }) {
  useEffect(() => {
    if (!tournamentId) return

    const sessionId = getSessionId()
    let cancelled = false

async function heartbeat() {
  if (cancelled) return

  try {
    await supabase
      .from('active_sessions')
      .upsert(
        {
          session_id: sessionId,
          tournament_id: tournamentId,
          page,
          user_id: userId,
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      )
  } catch (err) {
    console.error('ActiveSessionTracker heartbeat failed', err)
  }
}
    heartbeat()
    const interval = setInterval(heartbeat, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tournamentId, page, userId])

  return null
}