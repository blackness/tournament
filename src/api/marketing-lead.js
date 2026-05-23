import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const INTEREST_LABELS = {
  run_tournament: 'Running my tournament on AthleteOS',
  live_scores: 'Live scores, standings, and brackets',
  scorekeeping: 'Better scorekeeping workflow',
  qr_codes: 'QR code field setup',
  demo: 'Seeing a demo',
  other: 'Something else',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, email, organization, interest, message } = req.body ?? {}

    if (!name || !email || !interest) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const interestLabel = INTEREST_LABELS[interest] || interest
    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeOrg = escapeHtml(organization || '-')
    const safeInterest = escapeHtml(interestLabel)
    const safeMessage = escapeHtml(message || '-').replace(/\n/g, '<br/>')

    const subject = `New AthleteOS lead: ${interestLabel}`

    const text = [
      `New marketing lead submitted`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      `Organization: ${organization || '-'}`,
      `Interest: ${interestLabel}`,
      `Message: ${message || '-'}`,
    ].join('\n')

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <h2 style="margin-bottom: 16px;">New marketing lead submitted</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Organization:</strong> ${safeOrg}</p>
        <p><strong>Interest:</strong> ${safeInterest}</p>
        <p><strong>Message:</strong><br/>${safeMessage}</p>
      </div>
    `

    const result = await resend.emails.send({
      from: process.env.MARKETING_LEADS_FROM_EMAIL,
      to: process.env.MARKETING_LEADS_TO_EMAIL,
      reply_to: email,
      subject,
      text,
      html,
    })

    return res.status(200).json({
      ok: true,
      id: result.data?.id ?? null,
    })
  } catch (err) {
    console.error('marketing-lead email failed', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}