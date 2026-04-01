import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/supabase'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { QrCode, Download, ChevronLeft, Printer, ExternalLink } from 'lucide-react'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export function QRManager() {
  const { tournamentId }          = useParams()
  const [tournament, setTournament] = useState(null)
  const [venues, setVenues]       = useState([])
  const [loading, setLoading]     = useState(true)
  const printRef                  = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await db.tournaments.byId(tournamentId)
      setTournament(t)
      const { data: v } = await db.venues.byTournament(tournamentId)
      setVenues(v ?? [])
      setLoading(false)
    }
    load()
  }, [tournamentId])

  function handlePrint() {
    window.print()
  }

  if (loading) return <PageLoader />

  const courtUrl = (venueSlug) =>
    APP_URL + '/court/' + tournamentId + '/' + venueSlug

  const tournamentUrl = APP_URL + '/t/' + tournament?.slug

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={'/director/' + tournamentId} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">QR Codes</h1>
            <p className="text-sm text-[var(--text-muted)]">{tournament?.name}</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary btn no-print">
          <Printer size={16} /> Print all QR cards
        </button>
      </div>

      {/* Tournament master QR */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 no-print">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Tournament QR (spectators)</h2>
        <div className="flex items-center gap-6">
          <QRCodeDisplay url={tournamentUrl} size={120} />
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">Share this with spectators to follow the tournament.</p>
            <p className="text-xs font-mono text-[var(--text-muted)] break-all">{tournamentUrl}</p>
            <a href={tournamentUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              <ExternalLink size={11} /> Open
            </a>
          </div>
        </div>
      </div>

      {/* Field QR cards */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 no-print">
          Field QR Codes ({venues.length} fields)
        </h2>

        {venues.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-xl">
            <QrCode size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No fields added yet</p>
          </div>
        ) : (
          <div ref={printRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4 print-grid">
            {venues.map(v => (
              <QRCard
                key={v.id}
                venue={v}
                url={courtUrl(v.qr_slug)}
                tournament={tournament}
              />
            ))}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-grid, .print-grid * { visibility: visible; }
          .print-grid { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function QRCard({ venue, url, tournament }) {
  return (
    <div className="qr-card bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
      {/* Brand header */}
      <div className="w-full py-2 rounded-xl text-white text-xs font-bold tracking-wide"
        style={{ backgroundColor: tournament?.primary_color ?? '#1a56db' }}>
        {tournament?.name ?? 'Tournament'}
      </div>

      {/* Field name */}
      <h3 className="text-2xl font-black text-[var(--text-primary)]">{venue.name}</h3>
      {venue.short_name && venue.short_name !== venue.name && (
        <p className="text-sm text-[var(--text-muted)] -mt-2">{venue.short_name}</p>
      )}

      {/* QR code */}
      <QRCodeDisplay url={url} size={160} />

      {/* URL hint */}
      <p className="text-xs text-[var(--text-muted)] font-mono break-all leading-tight">{url}</p>

      <p className="text-xs text-[var(--text-muted)]">
        Scan to open scorekeeper
      </p>
    </div>
  )
}

// QR code using Google Charts API (no dependency needed)
function QRCodeDisplay({ url, size = 150 }) {
  const encoded = encodeURIComponent(url)
  const src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encoded + '&margin=1&format=png'

  return (
    <div className="bg-white p-2 rounded-lg">
      <img
        src={src}
        alt={'QR code for ' + url}
        width={size}
        height={size}
        className="block"
      />
    </div>
  )
}
