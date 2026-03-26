import { useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db } from '../../../lib/supabase'
import { WizardNavButtons } from './WizardNavButtons'
import { PlusCircle, Trash2, MapPin, QrCode } from 'lucide-react'

const crypto = globalThis.crypto

function newVenue(sortOrder) {
  return {
    id:        crypto.randomUUID(),
    name:      '',
    shortName: '',
    qrSlug:    '',
    notes:     '',
    sortOrder,
  }
}

function toQrSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
}

export function WizardStep4Venues({ onNext, onBack }) {
  const { venues, addVenue, updateVenue, removeVenue, tournamentId } = useWizardStore()
  const [errors, setErrors]     = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving]     = useState(false)

  function validate() {
    const e = {}
    if (venues.length === 0) { setFormError('Add at least one field or court'); return false }
    venues.forEach(v => {
      if (!v.name.trim())   e[`${v.id}_name`]   = 'Name required'
      if (!v.qrSlug.trim()) e[`${v.id}_qrSlug`] = 'QR slug required'
    })
    // Check for duplicate slugs
    const slugs = venues.map(v => v.qrSlug)
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    if (dupes.length > 0) {
      venues.filter(v => dupes.includes(v.qrSlug)).forEach(v => {
        e[`${v.id}_qrSlug`] = 'Slug must be unique'
      })
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleNext() {
    if (!validate()) return
    if (!tournamentId) { onNext(); return }

    setSaving(true)
    try {
      const { data: existing } = await db.venues.byTournament(tournamentId)

      for (const [i, venue] of venues.entries()) {
        const payload = {
          tournament_id: tournamentId,
          name:          venue.name.trim(),
          short_name:    venue.shortName.trim() || null,
          qr_slug:       venue.qrSlug.trim(),
          notes:         venue.notes?.trim() || null,
          sort_order:    i,
        }
        if (venue.dbId) {
          await db.venues.update(venue.dbId, payload)
        } else {
          // upsert by tournament_id+qr_slug to handle retries
          const { data } = await db.venues.upsert(payload)
          if (data) updateVenue(venue.id, { dbId: data.id })
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      setFormError(err.message || 'Failed to save venues')
    } finally {
      setSaving(false)
    }
  }

  // Quick-add numbered fields
  function handleQuickAdd(count) {
    for (let i = 1; i <= count; i++) {
      const n = venues.length + i
      const name = `Field ${n}`
      addVenue({
        ...newVenue(venues.length + i - 1),
        name,
        shortName: `F${n}`,
        qrSlug:    `field${n}`,
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
      )}

      {/* Quick add */}
      {venues.length === 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Quick add numbered fields:</p>
          <div className="flex gap-2">
            {[2, 3, 4, 6, 8].map(n => (
              <button key={n} onClick={() => handleQuickAdd(n)} className="btn-secondary btn btn-sm">
                {n} fields
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Venue rows */}
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

      <button onClick={() => { addVenue(newVenue(venues.length)); setFormError(null) }} className="btn-secondary btn w-full">
        <PlusCircle size={16} />
        Add field / court
      </button>

      {/* QR info callout */}
      {venues.length > 0 && (
        <div className="flex gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <QrCode size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            QR codes are generated after publishing. Each field's QR links to
            <code className="mx-1 text-xs bg-blue-100 px-1 rounded">/court/[tournament]/[slug]</code>
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
    <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center justify-center w-7 h-7 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 flex-shrink-0 mt-1">
        {idx + 1}
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Name */}
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

        {/* Short name */}
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

        {/* QR slug */}
        <div className="field-group">
          <label className="field-label text-xs flex items-center gap-1">
            <QrCode size={11} /> QR slug *
          </label>
          <input
            type="text"
            className={`field-input text-sm font-mono ${errors[`${venue.id}_qrSlug`] ? 'field-input-error' : ''}`}
            placeholder="field1"
            value={venue.qrSlug}
            onChange={e => onUpdate({ qrSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
            maxLength={20}
          />
          {errors[`${venue.id}_qrSlug`] && <p className="field-error">{errors[`${venue.id}_qrSlug`]}</p>}
        </div>
      </div>

      <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 mt-1 flex-shrink-0">
        <Trash2 size={15} />
      </button>
    </div>
  )
}
