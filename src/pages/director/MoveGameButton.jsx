import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function MoveGameButton({
  match,
  tournamentId,
  timezone = 'America/Toronto',
  onSuccess,
  onError,
}) {
  const [open, setOpen] = useState(false)
  const [venues, setVenues] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [selectedVenueId, setSelectedVenueId] = useState(match?.venue_id ?? '')
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState(match?.time_slot_id ?? '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !tournamentId) return

    async function load() {
      setLoading(true)

      const [{ data: venueData }, { data: slotData }] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, short_name')
          .eq('tournament_id', tournamentId)
          .order('sort_order', { ascending: true }),

        supabase
          .from('time_slots')
          .select('id, venue_id, scheduled_start')
          .eq('tournament_id', tournamentId)
          .order('scheduled_start', { ascending: true }),
      ])

      setVenues(venueData ?? [])
      setTimeSlots(slotData ?? [])

      if (!selectedVenueId && venueData?.length) {
        setSelectedVenueId(venueData[0].id)
      }

      setLoading(false)
    }

    load()
  }, [open, tournamentId])

  const availableSlots = timeSlots.filter(ts => ts.venue_id === selectedVenueId)

  useEffect(() => {
    if (!selectedVenueId) return
    if (!availableSlots.find(ts => ts.id === selectedTimeSlotId)) {
      setSelectedTimeSlotId(availableSlots[0]?.id ?? '')
    }
  }, [selectedVenueId, timeSlots])

  function formatTime(iso) {
    return new Date(iso).toLocaleString('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
  }

  function currentVenueLabel() {
    if (match?.venue?.name) return match.venue.name
    const venue = venues.find(v => v.id === match?.venue_id)
    return venue?.short_name ? `${venue.short_name} — ${venue.name}` : venue?.name || 'Unassigned'
  }

  function selectedVenueLabel() {
    const venue = venues.find(v => v.id === selectedVenueId)
    return venue?.short_name ? `${venue.short_name} — ${venue.name}` : venue?.name || 'No venue selected'
  }

  function selectedTimeLabel() {
    const slot = timeSlots.find(ts => ts.id === selectedTimeSlotId)
    return slot?.scheduled_start ? formatTime(slot.scheduled_start) : 'No time selected'
  }

  async function handleSave() {
    if (!selectedVenueId || !selectedTimeSlotId) return

    try {
      setSaving(true)

      const { error } = await supabase.rpc('move_match_safe', {
        p_match_id: match.id,
        p_venue_id: selectedVenueId,
        p_time_slot_id: selectedTimeSlotId,
      })

      if (error) throw error

      setOpen(false)
      onSuccess?.()
    } catch (err) {
      console.error('Move game failed', err)
      onError?.(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 14px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          borderRadius: 8,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        Move game
      </button>

      {open && (
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
          onClick={() => !saving && setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
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
                Move game
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
                {match?.status === 'in_progress' && ' is currently in progress.'}
              </p>
            </div>

            <div
              style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                padding: 12,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Current assignment
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{currentVenueLabel()}</strong>
                {' · '}
                {match?.time_slot?.scheduled_start
                  ? formatTime(match.time_slot.scheduled_start)
                  : 'No time assigned'}
              </div>
            </div>

            {match?.status === 'in_progress' && (
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(234,179,8,0.25)',
                  background: 'rgba(234,179,8,0.08)',
                  padding: 12,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  marginBottom: 14,
                }}
              >
                This game has already started. Changing the field/time will update public views immediately.
              </div>
            )}

            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Loading venues and time slots...
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Venue
                  </label>
                  <select
                    value={selectedVenueId}
                    onChange={e => setSelectedVenueId(e.target.value)}
                    className="field-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Select venue</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.short_name ? `${v.short_name} — ${v.name}` : v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Time slot
                  </label>
                  <select
                    value={selectedTimeSlotId}
                    onChange={e => setSelectedTimeSlotId(e.target.value)}
                    className="field-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Select time slot</option>
                    {availableSlots.map(ts => (
                      <option key={ts.id} value={ts.id}>
                        {formatTime(ts.scheduled_start)}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(96,165,250,0.2)',
                    background: 'rgba(96,165,250,0.08)',
                    padding: 12,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#93c5fd',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
                    New assignment
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedVenueLabel()}</strong>
                    {' · '}
                    {selectedTimeLabel()}
                  </div>
                </div>
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
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !selectedVenueId || !selectedTimeSlotId}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(96,165,250,0.25)',
                  background: 'rgba(96,165,250,0.12)',
                  color: '#93c5fd',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}