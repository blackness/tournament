import { useState } from 'react'
import { useWizardStore } from '../../../store/wizardStore'
import { db, supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/AuthContext'
import { TIMEZONES, BRAND_COLORS } from '../../../lib/constants'
import { WizardNavButtons } from './WizardNavButtons'
import { Calendar, MapPin, Globe, Lock } from 'lucide-react'

// Auto-generate slug from tournament name
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export function WizardStep1Basics({ onNext, isFirst }) {
  const { user } = useAuth()
  const {
    name, description, rulesText, slug, startDate, endDate, timezone,
    venueName, venueAddress, isPublic, primaryColor, logoUrl,
    tournamentId,
    setField, setFields,
  } = useWizardStore()

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  // -- Validation -------------------------------------------------------------
  function validate() {
    const e = {}
    if (!name.trim())       e.name      = 'Tournament name is required'
    if (!slug.trim())       e.slug      = 'URL slug is required'
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Slug can only contain lowercase letters, numbers, and hyphens'
    if (!startDate)         e.startDate = 'Start date is required'
    if (!endDate)           e.endDate   = 'End date is required'
    if (startDate && endDate && endDate < startDate)
      e.endDate = 'End date must be after start date'
    if (!venueName.trim())  e.venueName = 'Venue / location name is required'
    return e
  }

  // -- Save to DB --------------------------------------------------------------
  async function handleNext() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSaving(true)
    try {
      const payload = {
        name:          name.trim(),
        description:   description.trim() || null,
        slug:          slug.trim(),
        start_date:    startDate,
        end_date:      endDate,
        timezone,
        venue_name:    venueName.trim(),
        venue_address: venueAddress.trim() || null,
        is_public:     isPublic,
        primary_color: primaryColor,
        logo_url:      logoUrl || null,
        director_id:   user.id,
      }

      let id = tournamentId

      if (id) {
        // Update existing tournament
        const { error } = await db.tournaments.update(id, payload)
        if (error) throw error
      } else {
        // Check if slug already exists (handles 409 / duplicate key)
        const { data: existing } = await supabase.from('tournaments').select('id').eq('slug', slug.trim()).maybeSingle()

        if (existing) {
          // Resume -- this is our own tournament from a previous attempt
          id = existing.id
          useWizardStore.getState().setTournamentId(id)
          const { error } = await db.tournaments.update(id, payload)
          if (error) throw error
        } else {
          const { data, error } = await db.tournaments.create(payload)
          if (error) throw error
          id = data.id
          useWizardStore.getState().setTournamentId(id)
        }
      }

      useWizardStore.getState().markSaved()
      onNext()
    } catch (err) {
      // 409 or 23505 = unique constraint (slug taken by someone else)
      if (err.code === '23505' || err.status === 409 || err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setErrors({ slug: 'This slug is already taken -- try adding your city or year' })
      } else {
        setErrors({ _form: err.message || 'Something went wrong, please try again' })
      }
    } finally {
      setSaving(false)
    }
  }

  // -- Name change -> auto slug -------------------------------------------------
  function handleNameChange(val) {
    setField('name', val)
    if (!slugManuallyEdited) {
      setField('slug', toSlug(val))
    }
  }

  // -- Render -----------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Tournament Basics</h2>
        <p className="section-subtitle">The essentials -- name, dates, and location.</p>
      </div>

      {errors._form && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errors._form}
        </div>
      )}

      {/* Name */}
      <div className="field-group">
        <label className="field-label">Tournament name *</label>
        <input
          type="text"
          className={`field-input ${errors.name ? 'field-input-error' : ''}`}
          placeholder="e.g. Kingston Ultimate Open 2026"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          maxLength={120}
        />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>

      {/* Description */}
      <div className="field-group">
        <label className="field-label">Description <span className="text-[var(--text-muted)]">(optional)</span></label>
        <textarea
          className="field-input resize-none"
          placeholder="Add any info spectators and teams should know upfront..."
          rows={3}
          value={description}
          onChange={e => setField('description', e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Slug */}
      <div className="field-group">
        <label className="field-label">URL slug *</label>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-[var(--accent)]">
          <span className="px-3 py-2 text-[var(--text-muted)] text-sm border-r border-[var(--border)] whitespace-nowrap">
            /t/
          </span>
          <input
            type="text"
            className={`flex-1 px-3 py-2 text-sm outline-none ${errors.slug ? 'bg-red-50' : ''}`}
            placeholder="kingston-ultimate-open-2026"
            value={slug}
            onChange={e => {
              setSlugManuallyEdited(true)
              setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }}
            maxLength={60}
          />
        </div>
        {errors.slug
          ? <p className="field-error">{errors.slug}</p>
          : <p className="text-xs text-[var(--text-muted)] mt-1">Public URL -- lowercase letters, numbers, and hyphens only</p>
        }
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="field-group">
          <label className="field-label flex items-center gap-1">
            <Calendar size={13} /> Start date *
          </label>
          <input
            type="date"
            className={`field-input ${errors.startDate ? 'field-input-error' : ''}`}
            value={startDate ?? ''}
            onChange={e => setField('startDate', e.target.value)}
          />
          {errors.startDate && <p className="field-error">{errors.startDate}</p>}
        </div>
        <div className="field-group">
          <label className="field-label flex items-center gap-1">
            <Calendar size={13} /> End date *
          </label>
          <input
            type="date"
            className={`field-input ${errors.endDate ? 'field-input-error' : ''}`}
            value={endDate ?? ''}
            onChange={e => setField('endDate', e.target.value)}
          />
          {errors.endDate && <p className="field-error">{errors.endDate}</p>}
        </div>
      </div>

      {/* Timezone */}
      <div className="field-group">
        <label className="field-label">Timezone</label>
        <select
          className="field-input"
          value={timezone}
          onChange={e => setField('timezone', e.target.value)}
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      <div className="divider" />

      {/* Venue */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
          <MapPin size={14} /> Location
        </h3>
        <div className="space-y-4">
          <div className="field-group">
            <label className="field-label">Venue / park name *</label>
            <input
              type="text"
              className={`field-input ${errors.venueName ? 'field-input-error' : ''}`}
              placeholder="e.g. MacDonald Park Fields"
              value={venueName}
              onChange={e => setField('venueName', e.target.value)}
            />
            {errors.venueName && <p className="field-error">{errors.venueName}</p>}
          </div>
          <div className="field-group">
            <label className="field-label">Address <span className="text-[var(--text-muted)]">(optional)</span></label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. 123 Park Rd, Kingston, ON"
              value={venueAddress}
              onChange={e => setField('venueAddress', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* Branding */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Branding</h3>
        <div className="field-group">
          <label className="field-label">Primary colour</label>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            {BRAND_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setField('primaryColor', color)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
 primaryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
 }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            {/* Custom colour input */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setField('primaryColor', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-[var(--border)]"
                title="Custom colour"
              />
              <span className="text-xs text-[var(--text-muted)] font-mono">{primaryColor}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* Visibility */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isPublic
            ? <Globe size={16} className="text-green-600" />
            : <Lock size={16} className="text-[var(--text-muted)]" />
          }
        </div>
        <div className="flex-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setField('isPublic', e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)]"
            />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Public tournament</span>
          </label>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Public tournaments appear on the browse page and spectators can view scores without logging in.
          </p>
        </div>
      </div>

      {/* Nav */}
      <WizardNavButtons
        onNext={handleNext}
        isFirst={isFirst}
        saving={saving}
        nextLabel="Save & continue"
      />
    </div>
  )
}
