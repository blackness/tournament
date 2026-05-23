import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const INTEREST_OPTIONS = [
  { value: 'run_tournament', label: 'Running my tournament on AthleteOS' },
  { value: 'live_scores', label: 'Live scores, standings, and brackets' },
  { value: 'scorekeeping', label: 'Better scorekeeping workflow' },
 // { value: 'qr_codes', label: 'QR code field setup' },//
  { value: 'demo', label: 'Seeing a demo' },
  { value: 'other', label: 'Something else' },
]

export function MarketingLeadForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    organization: '',
    interest: 'run_tournament',
    message: '',
    companyWebsite: '', // honeypot
  })

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(false), 5000)
    return () => clearTimeout(t)
  }, [success])

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (form.companyWebsite) {
      setSuccess(true)
      return
    }

    if (!form.name.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!form.email.trim()) {
      setError('Please enter your email.')
      return
    }

    if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    if (!form.interest) {
      setError('Please choose what you are interested in.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        organization: form.organization.trim() || null,
        interest: form.interest,
        message: form.message.trim() || null,
      }

      const { error: insertError } = await supabase
        .from('marketing_leads')
        .insert(payload)

      if (insertError) throw insertError

      try {
        const emailRes = await fetch('/api/marketing-lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!emailRes.ok) {
          const emailData = await emailRes.json().catch(() => ({}))
          console.error('Lead saved but email failed', emailData)
        }
      } catch (emailErr) {
        console.error('Lead saved but email request failed', emailErr)
      }

      setSuccess(true)
      setForm({
        name: '',
        email: '',
        organization: '',
        interest: 'run_tournament',
        message: '',
        companyWebsite: '',
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section
  id="contact"
  className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Bring AthleteOS to your tournament
        </h2>
        <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
          Tell us what you’re planning and we’ll reach out.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        {/* Honeypot */}
        <div className="hidden" aria-hidden="true">
          <label>
            Company website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.companyWebsite}
              onChange={e => updateField('companyWebsite', e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Tournament / organization
          </span>
          <input
            type="text"
            value={form.organization}
            onChange={e => updateField('organization', e.target.value)}
            placeholder="League, club, school, or tournament name"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            What are you interested in?
          </span>

          <div className="grid gap-2 sm:grid-cols-2">
            {INTEREST_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition ${
                  form.interest === option.value
                    ? 'border-[var(--accent)] bg-[rgba(232,255,71,0.08)]'
                    : 'border-[var(--border)] bg-[var(--bg-base)]'
                }`}
              >
                <input
                  type="radio"
                  name="interest"
                  value={option.value}
                  checked={form.interest === option.value}
                  onChange={e => updateField('interest', e.target.value)}
                  className="mt-1"
                />
                <span className="text-sm text-[var(--text-primary)]">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Tell us a bit more
          </span>
          <textarea
            rows={5}
            value={form.message}
            onChange={e => updateField('message', e.target.value)}
            placeholder="What kind of event are you running? What are you looking for?"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
            Thanks — we got your info and will reach out soon.
          </div>
        )}

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
          >
            {saving ? 'Sending...' : 'Contact us'}
          </button>

          <span className="text-xs text-[var(--text-muted)]">
            We’ll only use this to follow up with you.
          </span>
        </div>
      </form>
    </section>
  )
}