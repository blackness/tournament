import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Trophy, Calendar, MapPin, Search, ChevronRight } from 'lucide-react'

export function TournamentList() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, slug, name, start_date, end_date, status, logo_url, primary_color, venue_name')
          .is('deleted_at', null)
          .in('status', ['published', 'live', 'review', 'archived'])
          .order('start_date', { ascending: false })
        if (error) console.error('TournamentList query error:', error)
        setTournaments(data ?? [])
      } catch (err) {
        console.error('TournamentList load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = tournaments.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.venue_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const live     = filtered.filter(t => t.status === 'live')
  const upcoming = filtered.filter(t => t.status === 'published')
  const past     = filtered.filter(t => ['review', 'archived'].includes(t.status))

  if (loading) return <PageLoader />

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
        <p className="text-gray-500">Live scores, schedules, and standings.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="field-input pl-9"
          placeholder="Search tournaments or venues…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No tournaments yet</p>
          <p className="text-sm mt-1">Check back soon, or sign in to create one.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No tournaments match "{search}"</p>
      ) : (
        <div className="space-y-8">
          {live.length > 0     && <Section title="🔴 Live Now" tournaments={live} />}
          {upcoming.length > 0 && <Section title="Upcoming"   tournaments={upcoming} />}
          {past.length > 0     && <Section title="Past"       tournaments={past} muted />}
        </div>
      )}
    </div>
  )
}

function Section({ title, tournaments, muted = false }) {
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
        {title}
      </h2>
      <div className="space-y-2">
        {tournaments.map(t => <TournamentCard key={t.id} tournament={t} muted={muted} />)}
      </div>
    </div>
  )
}

function TournamentCard({ tournament: t, muted }) {
  const isLive = t.status === 'live'
  return (
    <Link
      to={`/t/${t.slug}`}
      className={[
        'flex items-center gap-4 p-4 bg-white rounded-xl border transition-all hover:shadow-sm hover:border-gray-300',
        muted  ? 'opacity-60 hover:opacity-100' : '',
        isLive ? 'border-green-200 bg-green-50/40' : 'border-gray-200',
      ].join(' ')}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
        style={{ backgroundColor: t.primary_color ?? '#1a56db' }}
      >
        {t.logo_url
          ? <img src={t.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          : <Trophy size={18} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 truncate">{t.name}</span>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDateRange(t.start_date, t.end_date)}
          </span>
          {t.venue_name && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {t.venue_name}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </Link>
  )
}

function formatDateRange(start, end) {
  if (!start) return '—'
  const fmt = d => new Date(d + 'T12:00').toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
