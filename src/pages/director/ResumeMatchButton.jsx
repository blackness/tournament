import { useState } from 'react'

export function ResumeMatchButton({
  match,
  canResume = false,
  onResume,
  onPrecheck,
  onSuccess,
  onError,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('simple') // simple | requires_cleanup | blocked
  const [blockedReason, setBlockedReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [prechecking, setPrechecking] = useState(false)

  if (!canResume) return null

  async function handleOpen() {
    if (!match?.id) return

    setBlockedReason('')
    setMode('simple')

    if (!onPrecheck) {
      setOpen(true)
      return
    }

    try {
      setPrechecking(true)

      const result = await onPrecheck(match)

      if (result?.status === 'blocked') {
        setMode('blocked')
        setBlockedReason(
          result?.reason ||
            'A downstream match affected by this result is already in progress or complete.'
        )
      } else if (result?.status === 'requires_cleanup') {
        setMode('requires_cleanup')
      } else {
        setMode('simple')
      }

      setOpen(true)
    } catch (err) {
      console.error('Resume precheck failed', err)
      setMode('blocked')
      setBlockedReason('Could not verify whether this game can be resumed right now.')
      setOpen(true)
    } finally {
      setPrechecking(false)
    }
  }

  async function handleConfirm() {
    if (!match?.id || !onResume) return

    try {
      setLoading(true)

      const result = await onResume(match)

      setOpen(false)
      onSuccess?.(result)
    } catch (err) {
      console.error('Resume match failed', err)
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={prechecking}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: prechecking ? 'default' : 'pointer',
          opacity: prechecking ? 0.7 : 1,
        }}
      >
        {prechecking ? 'Checking...' : 'Resume Game'}
      </button>

      {open && (
        <ResumeMatchModal
          match={match}
          mode={mode}
          blockedReason={blockedReason}
          loading={loading}
          onClose={() => {
            if (loading) return
            setOpen(false)
          }}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}

function ResumeMatchModal({
  match,
  mode,
  blockedReason,
  loading,
  onClose,
  onConfirm,
}) {
  const isBlocked = mode === 'blocked'
  const requiresCleanup = mode === 'requires_cleanup'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          padding: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {isBlocked
              ? "This game can't be resumed yet"
              : requiresCleanup
              ? 'Resume this game and clear downstream assignments?'
              : 'Resume this game?'}
          </h3>

          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginTop: 8,
              lineHeight: 1.45,
            }}
          >
            {match?.match_code ? `Match ${match.match_code}` : 'This match'}
          </p>
        </div>

        {isBlocked ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.08)',
              padding: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            {blockedReason ||
              'A downstream match affected by this result is already in progress or complete.'}
          </div>
        ) : (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              padding: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div>This will:</div>
            <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
              <li>return the game to <strong>In Progress</strong></li>
              <li>keep the current score</li>
              <li>clear the final winner</li>
              {requiresCleanup && (
                <li>remove downstream assignments created by this result</li>
              )}
            </ul>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 18,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>

          {!isBlocked && (
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                border: '1px solid rgba(250,204,21,0.25)',
                background: 'rgba(250,204,21,0.12)',
                color: '#fbbf24',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading
                ? 'Resuming...'
                : requiresCleanup
                ? 'Resume and Clear Downstream'
                : 'Resume Game'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}