import { useEffect, useMemo, useState } from 'react'
import { X, Play, AlertTriangle } from 'lucide-react'
import { db } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export function CreateLiveGameModal({
  isOpen,
  onClose,
  tournamentId,
  onCreated,
  defaultDivisionId = '',
  defaultVenueId = '',
  divisions = [],
  venues = [],
  teams = [],
}) {
  const { user } = useAuth()

  const [divisionId, setDivisionId] = useState(defaultDivisionId || '')
  const [venueId, setVenueId] = useState(defaultVenueId || '')
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setDivisionId(defaultDivisionId || '')
    setVenueId(defaultVenueId || '')
    setTeamAId('')
    setTeamBId('')
    setNotes('')
    setError('')
    setSaving(false)
  }, [isOpen, defaultDivisionId, defaultVenueId])

  const filteredTeams = useMemo(() => {
    if (!divisionId) return teams

    return teams.filter(team => {
      const possibleDivisionIds = [
        team.divisionId,
        team.division_id,
        team.divisionDbId,
        team.division?.id,
      ].filter(Boolean)

      return possibleDivisionIds.some(id => String(id) === String(divisionId))
    })
  }, [teams, divisionId])

  if (!isOpen) return null

  async function handleCreate() {
    setError('')

    if (!tournamentId) {
      setError('Tournament ID is missing.')
      return
    }

    if (!teamAId || !teamBId) {
      setError('Select both teams.')
      return
    }

    if (teamAId === teamBId) {
      setError('Team A and Team B must be different.')
      return
    }

    setSaving(true)

    try {
      const selectedDivision = divisions.find(
        d => String(d.id) === String(divisionId) || String(d.dbId) === String(divisionId)
      )

      const selectedVenue = venues.find(
        v => String(v.id) === String(venueId) || String(v.dbId) === String(venueId)
      )

      const teamA = teams.find(
        t => String(t.id) === String(teamAId) || String(t.dbId) === String(teamAId)
      )

      const teamB = teams.find(
        t => String(t.id) === String(teamBId) || String(t.dbId) === String(teamBId)
      )

      const payload = {
        tournament_id: tournamentId,
        division_id: selectedDivision?.dbId || selectedDivision?.id || null,
        venue_id: selectedVenue?.dbId || selectedVenue?.id || null,
        team_a_id: teamA?.dbId || teamA?.id || null,
        team_b_id: teamB?.dbId || teamB?.id || null,
        status: 'in_progress',
        is_ad_hoc: true,
        actual_start_time: new Date().toISOString(),
        notes: notes.trim() || null,
        created_by_user_id: user?.id || null,
      }

      const { data, error } = await db.matches.createAdHoc(payload)
      if (error) throw error

      onCreated?.(data)
    } catch (err) {
      setError(err.message || 'Failed to create live game.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              Create Live Game
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Start scoring a real game now, even if the schedule or bracket is wrong.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              borderRadius: 10,
              padding: 8,
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
              color: '#92400e',
              fontSize: 13,
              display: 'flex',
              gap: 8,
            }}
          >
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            Use this when the real game on the field does not match the current schedule or bracket.
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: '#dc2626',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Division">
              <select
                className="field-input"
                value={divisionId}
                onChange={e => {
                  setDivisionId(e.target.value)
                  setTeamAId('')
                  setTeamBId('')
                }}
              >
                <option value="">Select division</option>
                {divisions.map(div => (
                  <option key={div.id || div.dbId} value={div.id || div.dbId}>
                    {div.name || div.division_name || 'Unnamed division'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Venue">
              <select
                className="field-input"
                value={venueId}
                onChange={e => setVenueId(e.target.value)}
              >
                <option value="">Select venue</option>
                {venues.map(venue => (
                  <option key={venue.id || venue.dbId} value={venue.id || venue.dbId}>
                    {venue.shortName || venue.short_name || venue.name || 'Unnamed venue'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Team A *">
              <select
                className="field-input"
                value={teamAId}
                onChange={e => setTeamAId(e.target.value)}
              >
                <option value="">Select team</option>
                {filteredTeams.map(team => (
                  <option key={team.id || team.dbId} value={team.id || team.dbId}>
                    {team.short_name || team.shortName || team.name || team.team_name || 'Unnamed team'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Team B *">
              <select
                className="field-input"
                value={teamBId}
                onChange={e => setTeamBId(e.target.value)}
              >
                <option value="">Select team</option>
                {filteredTeams.map(team => (
                  <option key={team.id || team.dbId} value={team.id || team.dbId}>
                    {team.short_name || team.shortName || team.name || team.team_name || 'Unnamed team'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              className="field-input resize-none"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Wrong bracket advancement -- scoring real game on Field 2"
            />
          </Field>
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button type="button" onClick={onClose} style={secondaryButtonStyle()}>
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            style={primaryButtonStyle(saving)}
          >
            <Play size={15} />
            {saving ? 'Creating...' : 'Create & start game'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function primaryButtonStyle(disabled = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(16,185,129,0.22)',
    background: disabled ? 'rgba(16,185,129,0.35)' : '#10b981',
    color: '#fff',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 170,
  }
}

function secondaryButtonStyle() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    cursor: 'pointer',
  }
}