import { useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { PlusCircle, Trash2, QrCode } from 'lucide-react'

const crypto = globalThis.crypto

function newVenue(sortOrder) {
  return {
    id: crypto.randomUUID(),
    name: '',
    shortName: '',
    qrSlug: '',
    notes: '',
    sortOrder,
  }
}

function toQrSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
}

export function WizardStep4Venues({ onNext, onBack }) {
  const { venues, addVenue, updateVenue, removeVenue, tournamentId } = useWizardStore()
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  function validate() {
    const e = {}

    if (venues.length === 0) {
      setFormError('Add at least one field or court')
      return false
    }

    venues.forEach(v => {
      if (!v.name.trim()) e[`${v.id}_name`] = 'Name required'
      if (!v.qrSlug.trim()) e[`${v.id}_qrSlug`] = 'QR slug required'
    })

    const slugs = venues.map(v => String(v.qrSlug || '').trim().toLowerCase())
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)

    if (dupes.length > 0) {
      venues
        .filter(v => dupes.includes(v.qrSlug))
        .forEach(v => {
          e[`${v.id}_qrSlug`] = 'Slug must be unique'
        })
    }

    setErrors(e)

    if (Object.keys(e).length > 0) {
      setFormError('Fix venue errors before continuing')
      return false
    }

    setFormError(null)
    return true
  }

async function handleNext() {
    if (!validate()) return
    if (!tournamentId) {
      onNext()
      return
    }

    setSaving(true)

    try {
      const { data: existing, error: existingErr } = await db.venues.byTournament(tournamentId)
      if (existingErr) {
        throw new Error('Failed to load existing venues: ' + existingErr.message)
      }

      const existingVenues = existing ?? []

      const existingById = Object.fromEntries(existingVenues.map(v => [v.id, v]))
      const existingByQrSlug = Object.fromEntries(
        existingVenues.map(v => [String(v.qr_slug ?? '').trim().toLowerCase(), v])
      )
      const existingByName = Object.fromEntries(
        existingVenues.map(v => [String(v.name ?? '').trim().toLowerCase(), v])
      )

      // 1) Reconcile local venues without dbId to existing DB venues
      // Prefer dbId, then qrSlug, then exact name match.
      for (const venue of venues) {
        if (venue.dbId && existingById[venue.dbId]) continue

        const qrSlugKey = String(venue.qrSlug ?? '').trim().toLowerCase()
        const nameKey = String(venue.name ?? '').trim().toLowerCase()

        const matched =
          (qrSlugKey && existingByQrSlug[qrSlugKey]) ||
          (nameKey && existingByName[nameKey]) ||
          null

        if (matched && venue.dbId !== matched.id) {
          updateVenue(venue.id, { dbId: matched.id })
          venue.dbId = matched.id
        }
      }

      // 2) Upsert current venues
      for (const [i, venue] of venues.entries()) {
        const payload = {
          tournament_id: tournamentId,
          name: venue.name.trim(),
          short_name: venue.shortName.trim() || null,
          qr_slug: venue.qrSlug.trim(),
          notes: venue.notes?.trim() || null,
          sort_order: i,
        }

        if (venue.dbId) {
          const { error: updateErr } = await db.venues.update(venue.dbId, payload)
          if (updateErr) {
            throw new Error(`Failed to update venue "${venue.name}": ${updateErr.message}`)
          }
        } else {
          const { data, error: upsertErr } = await db.venues.upsert(payload)
          if (upsertErr) {
            throw new Error(`Failed to save venue "${venue.name}": ${upsertErr.message}`)
          }
          if (data) {
            updateVenue(venue.id, { dbId: data.id })
          }
        }
      }

      // 3) Destructive pre-start sync:
      // Delete DB venues that are no longer present in local wizard state.
      const localDbIds = new Set(venues.map(v => v.dbId).filter(Boolean))

      const venuesToDelete = existingVenues.filter(dbVenue => !localDbIds.has(dbVenue.id))

      for (const dbVenue of venuesToDelete) {
        const { data: linkedMatches, error: linkedMatchesErr } = await supabase
          .from('matches')
          .select('id')
          .eq('venue_id', dbVenue.id)
          .limit(1)

        if (linkedMatchesErr) {
          throw new Error(
            `Failed checking saved schedule references for removed venue "${dbVenue.name}": ${linkedMatchesErr.message}`
          )
        }

        if (Array.isArray(linkedMatches) && linkedMatches.length > 0) {
          throw new Error(
            `Venue "${dbVenue.name}" appears to be removed, but it is still referenced by saved matches. Clear the saved schedule before removing this venue.`
          )
        }

        const { error: deleteVenueErr } = await db.venues.delete(dbVenue.id)
        if (deleteVenueErr) {
          throw new Error(`Failed to delete removed venue "${dbVenue.name}": ${deleteVenueErr.message}`)
        }
      }

      setFormError(null)

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      console.error('[Step4 save] Error:', err)
      setFormError(err.message || 'Failed to save venues')
    } finally {
      setSaving(false)
    }
  }  
  function handleQuickAdd(count) {
    for (let i = 1; i <= count; i++) {
      const n = venues.length + i
      const name = `Field ${n}`
      addVenue({
        ...newVenue(venues.length + i - 1),
        name,
        shortName: `F${n}`,
        qrSlug: `field${n}`,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Fields & Courts</h2>
        <p className="section-subtitle">
          Each field gets a unique QR code. Scorekeepers scan it to auto-detect the active game.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      {venues.length === 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Quick add numbered fields:</p>
          <div className="flex gap-2">
            {[2, 3, 4, 6, 8].map(n => (
              <button key={n} onClick={() => handleQuickAdd(n)} className="btn-secondary btn btn-sm">
                {n} fields
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {venues.map((venue, idx) => (
          <VenueRow
            key={venue.id}
            venue={venue}
            idx={idx}
            errors={errors}
            onUpdate={(u) => updateVenue(venue.id, u)}
            onRemove={() => removeVenue(venue.id)}
          />
        ))}
      </div>

      <button
        onClick={() => {
          addVenue(newVenue(venues.length))
          setFormError(null)
        }}
        className="btn-secondary btn w-full"
      >
        <PlusCircle size={16} />
        Add field / court
      </button>

      {venues.length > 0 && (
        <div className="flex gap-3 p-3 bg-[var(--accent-dim)] border border-blue-100 rounded-lg text-sm text-blue-800">
          <QrCode size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            QR codes are generated after publishing. Each field&apos;s QR links to
            <code className="mx-1 text-xs bg-[var(--accent-dim)] px-1 rounded">
              /court/[tournament]/[slug]
            </code>
            and auto-redirects to the active game.
          </div>
        </div>
      )}

      <WizardNavButtons
        onNext={handleNext}
        onBack={onBack}
        saving={saving}
        nextDisabled={venues.length === 0}
      />
    </div>
  )
}

function VenueRow({ venue, idx, errors, onUpdate, onRemove }) {
  return (
    <div className="flex gap-3 items-start p-3 rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-muted)] flex-shrink-0 mt-1">
        {idx + 1}
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="field-group sm:col-span-1">
          <label className="field-label text-xs">Name *</label>
          <input
            type="text"
            className={`field-input text-sm ${errors[`${venue.id}_name`] ? 'field-input-error' : ''}`}
            placeholder="Field 1"
            value={venue.name}
            onChange={e => {
              const name = e.target.value
              const auto = toQrSlug(name)
              onUpdate({
                name,
                shortName: venue.shortName || name.replace(/[^A-Z0-9]/gi, '').slice(0, 4),
                qrSlug: venue.qrSlug || auto,
              })
            }}
          />
          {errors[`${venue.id}_name`] && <p className="field-error">{errors[`${venue.id}_name`]}</p>}
        </div>

        <div className="field-group">
          <label className="field-label text-xs">Short name</label>
          <input
            type="text"
            className="field-input text-sm"
            placeholder="F1"
            value={venue.shortName}
            onChange={e => onUpdate({ shortName: e.target.value })}
            maxLength={8}
          />
        </div>

        <div className="field-group">
          <label className="field-label text-xs flex items-center gap-1">
            <QrCode size={11} /> QR slug *
          </label>
          <input
            type="text"
            className={`field-input text-sm font-mono ${errors[`${venue.id}_qrSlug`] ? 'field-input-error' : ''}`}
            placeholder="field1"
            value={venue.qrSlug}
            onChange={e =>
              onUpdate({
                qrSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
              })
            }
            maxLength={20}
          />
          {errors[`${venue.id}_qrSlug`] && <p className="field-error">{errors[`${venue.id}_qrSlug`]}</p>}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="p-1 text-[var(--text-muted)] hover:text-red-500 mt-1 flex-shrink-0"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}