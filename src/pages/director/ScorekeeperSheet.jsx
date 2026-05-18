import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { Printer, X } from 'lucide-react'
import QRCode from 'qrcode'

// ─── Printable Scorekeeper Sheet ─────────────────────────────────────────────
// Route: /director/:tournamentId/scorekeeper-sheet
// Shows all non-completed matches grouped by time slot, each with a QR code
// pointing to the scorekeeper URL. Print-optimized via @media print CSS.

export function ScorekeeperSheet() {
  const { tournamentId } = useParams()
  const [matches, setMatches] = useState([])
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from('tournaments').select('name, start_date').eq('id', tournamentId).single(),
        supabase
          .from('matches')
          .select(`
            id, status, scorekeeper_pin, round_label, notes,
            team_a:tournament_teams!team_a_id(name, short_name),
            team_b:tournament_teams!team_b_id(name, short_name),
            venue:venues(name, short_name),
            time_slot:time_slots(scheduled_start)
          `)
          .eq('tournament_id', tournamentId)
          .not('status', 'in', '(complete,forfeit,cancelled)')
          .order('time_slot(scheduled_start)'),
      ])

      setTournament(t)
      setMatches(m ?? [])
      // Use first found PIN as the tournament PIN
      const foundPin = m?.find(x => x.scorekeeper_pin)?.scorekeeper_pin
      setPin(foundPin ?? null)
      setLoading(false)
    }
    load()
  }, [tournamentId])

  if (loading) return <PageLoader />

  // Group by time slot
  const grouped = {}
  for (const m of matches) {
    const key = m.time_slot?.scheduled_start ?? 'TBD'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }
  const slots = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  const formatDate = d => d
    ? new Date(d + 'T12:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const formatTime = iso => new Date(iso).toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto'
  })

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Screen-only controls */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg text-gray-900">{tournament?.name}</h1>
          <p className="text-sm text-gray-500">Scorekeeper sheet · {matches.length} games</p>
        </div>
        <div className="flex items-center gap-3">
          {pin && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-blue-600 font-medium">Tournament PIN: </span>
              <span className="font-bold text-blue-900 font-mono tracking-widest">{pin}</span>
            </div>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Printer size={15} /> Print sheet
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block px-8 pt-6 pb-4 border-b-2 border-gray-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{tournament?.name}</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{formatDate(tournament?.start_date)} · Scorekeeper Reference</p>
          </div>
          {pin && (
            <div style={{ border: '2px solid #1e40af', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1e40af', marginBottom: 2 }}>Tournament PIN</p>
              <p style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.15em', color: '#1e3a8a' }}>{pin}</p>
            </div>
          )}
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
          Scan the QR code for your game · Enter PIN {pin ? `(${pin})` : ''} when prompted · Questions? Find the tournament director.
        </p>
      </div>

      {/* Game cards */}
      <div className="px-6 py-6 print:px-8 print:py-4">
        {slots.map(([timeKey, slotMatches]) => (
          <div key={timeKey} className="mb-8 print:mb-6 print:break-inside-avoid">
            {/* Time header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-bold font-mono print:bg-gray-900 print:text-white">
                {timeKey !== 'TBD' ? formatTime(timeKey) : 'TBD'}
              </div>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Match cards grid — 2 per row */}
            <div className="grid grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
              {slotMatches.map(m => (
                <MatchCard key={m.id} match={m} pin={pin} />
              ))}
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-semibold">No upcoming games</p>
            <p className="text-sm mt-1">All games are complete or cancelled.</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function MatchCard({ match: m, pin }) {
  const canvasRef = useRef(null)
  const url = window.location.origin + '/scorekeeper/' + m.id

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 96,
        margin: 1,
        color: { dark: '#111827', light: '#ffffff' },
      })
    }
  }, [url])

  const teamA = m.team_a?.name ?? 'TBD'
  const teamB = m.team_b?.name ?? 'TBD'
  const isBracket = m.notes?.startsWith('bracket:') || !m.team_a?.name

  return (
    <div style={{
      border: '1.5px solid #e5e7eb',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: isBracket ? '#f9fafb' : '#ffffff',
      pageBreakInside: 'avoid',
    }}>
      {/* QR code */}
      <div style={{ flexShrink: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Court */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: '#111827', color: '#fff', borderRadius: 4, padding: '2px 6px'
          }}>
            {m.venue?.short_name ?? m.venue?.name ?? 'Court TBD'}
          </span>
          {m.round_label && (
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{m.round_label}</span>
          )}
        </div>

        {/* Teams */}
        {isBracket ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', fontStyle: 'italic' }}>
            {bracketLabel(m.notes, m.round_label)}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.2, marginBottom: 2 }}>
              {teamA}
            </p>
            <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>VS</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
              {teamB}
            </p>
          </>
        )}

        {/* PIN reminder */}
        {pin && (
          <p style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>
            PIN: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af', letterSpacing: '0.1em' }}>{pin}</span>
          </p>
        )}

        {/* URL (small, for manual entry) */}
        <p style={{ fontSize: 8, color: '#d1d5db', marginTop: 3, wordBreak: 'break-all', lineHeight: 1.3 }}>
          {url}
        </p>

        {/* Does not count notice */}
        {m.notes === 'does_not_count_team_b' && (
          <p style={{ fontSize: 9, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
            ⚠ Result does not count for {m.team_b?.name}
          </p>
        )}
      </div>
    </div>
  )
}

function bracketLabel(notes, roundLabel) {
  if (roundLabel) return roundLabel
  if (!notes) return 'TBD vs TBD'
  // Convert notes like 'bracket:1A-vs-2D' → '1st Pool A vs 2nd Pool D'
  const map = {
    '1A': '1st Pool A', '2A': '2nd Pool A', '3A': '3rd Pool A', '4A': '4th Pool A',
    '1B': '1st Pool B', '2B': '2nd Pool B', '3B': '3rd Pool B', '4B': '4th Pool B', '5B': '5th Pool B',
    '1C': '1st Pool C', '2C': '2nd Pool C', '3C': '3rd Pool C', '4C': '4th Pool C',
    '1D': '1st Pool D', '2D': '2nd Pool D', '3D': '3rd Pool D', '4D': '4th Pool D',
    'winG1': 'Winner G1', 'winG2': 'Winner G2', 'winG3': 'Winner G3', 'winG4': 'Winner G4',
    'winnerV': 'Winner Game V', 'winY': 'Winner Y', 'winZ': 'Winner Z',
    'winW': 'Winner W', 'winX': 'Winner X',
  }
  const inner = notes.replace('bracket:', '')
  const [a, b] = inner.split('-vs-')
  return (map[a] ?? a) + ' vs ' + (map[b] ?? b)
}
