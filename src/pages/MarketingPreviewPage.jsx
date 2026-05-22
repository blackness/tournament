import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Trophy,
  BarChart3,
  Radio,
  QrCode,
  Settings,
  ArrowRight,
  CheckCircle2,
  Users,
  MonitorPlay,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react'

const VARIANTS = [
  { id: 'A', name: 'A · Balanced' },
  { id: 'B', name: 'B · Chaos Reducer' },
  { id: 'C', name: 'C · Premium' },
  { id: 'D', name: 'D · Live Experience' },
  { id: 'E', name: 'E · Guided Launch' },
]

export function MarketingPreviewPage() {
  const [active, setActive] = useState('A')

  const activeIndex = VARIANTS.findIndex(v => v.id === active)

  const ActiveVariant = useMemo(() => {
    switch (active) {
      case 'B':
        return MarketingHomeB
      case 'C':
        return MarketingHomeC
      case 'D':
        return MarketingHomeD
      case 'E':
        return MarketingHomeE
      case 'A':
      default:
        return MarketingHomeA
    }
  }, [active])

  function goPrev() {
    const nextIndex = activeIndex === 0 ? VARIANTS.length - 1 : activeIndex - 1
    setActive(VARIANTS[nextIndex].id)
  }

  function goNext() {
    const nextIndex = activeIndex === VARIANTS.length - 1 ? 0 : activeIndex + 1
    setActive(VARIANTS[nextIndex].id)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-base)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-base)]/85">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Marketing Homepage Preview
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Review all five versions, then complete the feedback form.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goPrev}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-mid)]"
            >
              Prev
            </button>

            <span className="text-xs text-[var(--text-muted)] px-1">
              {activeIndex + 1} of {VARIANTS.length}
            </span>

            <button
              onClick={goNext}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-mid)]"
            >
              Next
            </button>

            <div className="hidden md:flex flex-wrap gap-2 ml-2">
              {VARIANTS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActive(v.id)}
                  className={
                    'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
                    (
                      active === v.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-mid)]'
                    )
                  }
                >
                  {v.name}
                </button>
              ))}
            </div>

            <a
              href="https://forms.gle/k4yqpyYgbtyTDDms5"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Feedback form
            </a>
          </div>

          <div className="flex md:hidden flex-wrap gap-2">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => setActive(v.id)}
                className={
                  'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
                  (
                    active === v.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-mid)]'
                  )
                }
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
          <p className="font-semibold">Stakeholder review</p>
          <p className="mt-1 text-blue-800">
            Please click through all homepage versions before submitting feedback. We’re evaluating
            messaging direction, clarity, credibility, and audience fit — not final design polish.
          </p>
          <p className="mt-2 text-blue-800">
            Estimated review time: 3–5 minutes.
          </p>
          <div className="mt-3">
            <a
              href="https://forms.gle/k4yqpyYgbtyTDDms5"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Open feedback form
            </a>
          </div>
        </div>
      </div>

      <ActiveVariant />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared pieces
────────────────────────────────────────────────────────────────────────── */

function PageShell({ badge, title, subtitle, primaryCta, secondaryCta, highlights, children }) {
  return (
    <div className="text-[var(--text-primary)]">
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_45%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            {badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 mb-5">
                {badge}
              </div>
            )}

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
              {title}
            </h1>

            <p className="mt-5 text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              {subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={primaryCta.to} className="btn-primary btn px-5 py-3 text-sm">
                {primaryCta.label}
                <ArrowRight size={16} />
              </Link>
              <Link to={secondaryCta.to} className="btn-secondary btn px-5 py-3 text-sm">
                {secondaryCta.label}
              </Link>
            </div>

            {highlights?.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
                {highlights.map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-green-500" />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {children}
    </div>
  )
}

function ValueCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-5">
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  )
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-5">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  )
}

function StepCard({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-5">
      <div className="text-xs font-bold tracking-wider text-blue-600">{number}</div>
      <h3 className="mt-3 font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  )
}

function AudienceCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-5">
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  )
}

function CommonFeatureGrid() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Everything you need to run tournament day</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            Built for organizers who need structure before the event and control during the event.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Settings size={18} />}
            title="Tournament setup"
            text="Create tournaments, divisions, venues, teams, pools, and schedules in one place."
          />
          <FeatureCard
            icon={<CalendarDays size={18} />}
            title="Schedule publishing"
            text="Share clear public schedules and update games as the day changes."
          />
          <FeatureCard
            icon={<Radio size={18} />}
            title="Live scoring"
            text="Post scores in real time so everyone can follow games as they happen."
          />
          <FeatureCard
            icon={<BarChart3 size={18} />}
            title="Standings and tiebreakers"
            text="Keep rankings transparent with structured standings and tiebreak logic."
          />
          <FeatureCard
            icon={<Trophy size={18} />}
            title="Brackets and finals"
            text="Show championship and consolation paths with a clear visual playoff experience."
          />
          <FeatureCard
            icon={<QrCode size={18} />}
            title="Field QR access"
            text="Let people scan a field and instantly see game info, status, and upcoming action."
          />
        </div>
      </div>
    </section>
  )
}

function CommonFooterCta({ title, text }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-raised)] p-8 md:p-12 text-center">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
          {title}
        </h2>
        <p className="mt-4 text-[var(--text-secondary)] max-w-2xl mx-auto">
          {text}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/tournaments" className="btn-primary btn px-5 py-3 text-sm">
            View active tournaments
          </Link>
          <Link to="/login" className="btn-secondary btn px-5 py-3 text-sm">
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Variant A · Balanced
────────────────────────────────────────────────────────────────────────── */

function MarketingHomeA() {
  return (
    <PageShell
      badge="Built for school and multi-field tournaments"
      title="Schedules, scores, standings, and brackets — all in one place."
      subtitle="AthleteOS helps tournament directors set up events faster, manage changes live, and give coaches, players, and spectators a better tournament-day experience."
      primaryCta={{ label: 'View active tournaments', to: '/tournaments' }}
      secondaryCta={{ label: 'Book a demo', to: '/login' }}
      highlights={[
        'Tournament setup wizard',
        'Live score updates',
        'Public standings and brackets',
      ]}
    >
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          <ValueCard
            title="Run your event from one system"
            text="Stop juggling spreadsheets, group chats, score updates, and bracket confusion."
          />
          <ValueCard
            title="Keep everyone on the same page"
            text="Directors, coaches, players, and spectators all see the same live information."
          />
          <ValueCard
            title="Make the tournament feel professional"
            text="Clear schedules, live standings, polished pages, and a modern event experience."
          />
        </div>
      </section>

      <CommonFeatureGrid />

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            AthleteOS helps you from initial setup through the final whistle.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <StepCard
            number="01"
            title="Set up your tournament"
            text="Import teams, assign pools, create venues, and build the initial schedule."
          />
          <StepCard
            number="02"
            title="Run the event live"
            text="Update scores, adjust schedules, and manage the day from Director HQ."
          />
          <StepCard
            number="03"
            title="Publish the full experience"
            text="Give coaches, players, and spectators access to schedules, standings, and brackets."
          />
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Built for the people who actually run tournaments</h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              Designed to reduce confusion, improve communication, and make events easier to manage.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <AudienceCard title="Tournament directors" text="Manage schedules, results, and live changes from one place." />
            <AudienceCard title="Athletic departments" text="Present a more organized, professional event experience." />
            <AudienceCard title="Coaches and teams" text="See where to be, who is playing, and what every result means." />
            <AudienceCard title="Fans and spectators" text="Follow live scores, standings, and brackets without confusion." />
          </div>
        </div>
      </section>

      <CommonFooterCta
        title="Ready to modernize your tournament?"
        text="Launch a cleaner, more professional tournament experience for directors, coaches, players, and spectators."
      />
    </PageShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Variant B · Chaos Reducer
────────────────────────────────────────────────────────────────────────── */

function MarketingHomeB() {
  return (
    <PageShell
      badge="Tournament day is chaotic. AthleteOS helps fix that."
      title="Less confusion. Better communication. Smoother tournament days."
      subtitle="AthleteOS gives directors, coaches, players, and spectators one clear source of truth for schedules, live scores, standings, and brackets."
      primaryCta={{ label: 'View active tournaments', to: '/tournaments' }}
      secondaryCta={{ label: 'Book a demo', to: '/login' }}
      highlights={[
        'Reduce schedule confusion',
        'Keep score updates visible',
        'Make standings easier to trust',
      ]}
    >
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Tournament pain points add up fast</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            When information is scattered, everyone asks the same questions — and directors carry the burden.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ValueCard title="Schedules change" text="But people keep checking outdated screenshots and old messages." />
          <ValueCard title="Scores come in late" text="Which makes it hard to trust standings and next-game scenarios." />
          <ValueCard title="Brackets get confusing" text="Especially when formats include crossover games and consolation paths." />
          <ValueCard title="Everyone asks the director" text="Creating stress exactly when live decisions matter most." />
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">AthleteOS keeps everyone aligned</h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              Replace scattered communication with one live tournament experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
            <FeatureCard icon={<CalendarDays size={18} />} title="Live schedules" text="Publish the latest game times and fields in one place." />
            <FeatureCard icon={<Radio size={18} />} title="Visible scoring" text="Show results quickly so coaches and spectators can keep up." />
            <FeatureCard icon={<BarChart3 size={18} />} title="Trusted standings" text="Make rankings easier to follow with structured updates." />
            <FeatureCard icon={<Trophy size={18} />} title="Clear playoff paths" text="Show who advances, where they go next, and what’s at stake." />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-5">
          <StepCard number="01" title="Set it up once" text="Build your event structure before tournament day gets busy." />
          <StepCard number="02" title="Run it live" text="Update scores and changes as the event unfolds." />
          <StepCard number="03" title="Answer fewer questions" text="Because the information is already visible to the people who need it." />
        </div>
      </section>

      <CommonFooterCta
        title="Bring order to tournament day"
        text="AthleteOS helps reduce confusion and make live tournament operations easier to manage."
      />
    </PageShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Variant C · Premium / Professional
────────────────────────────────────────────────────────────────────────── */

function MarketingHomeC() {
  return (
    <PageShell
      badge="A more polished tournament experience"
      title="Deliver a tournament that feels organized, modern, and credible."
      subtitle="AthleteOS helps schools and event organizers present schedules, standings, and playoff results in a way that feels clear, professional, and trustworthy."
      primaryCta={{ label: 'View active tournaments', to: '/tournaments' }}
      secondaryCta={{ label: 'Book a demo', to: '/login' }}
      highlights={[
        'Professional public-facing pages',
        'Modern live event experience',
        'Cleaner communication across the event',
      ]}
    >
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          <ValueCard title="Elevate your event" text="Create a better experience for teams, schools, families, and guests." />
          <ValueCard title="Present information clearly" text="Replace ad hoc communication with polished, structured pages." />
          <ValueCard title="Build confidence" text="Help everyone feel the event is being run with clarity and control." />
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Designed for events that want to look and feel better</h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              AthleteOS supports both the operational side and the public-facing side of tournament day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            <FeatureCard icon={<MonitorPlay size={18} />} title="Clean event presentation" text="Give your tournament a more modern digital experience." />
            <FeatureCard icon={<ShieldCheck size={18} />} title="Credible live information" text="Let people see schedules, standings, and brackets in a consistent format." />
            <FeatureCard icon={<Users size={18} />} title="Better stakeholder experience" text="Support players, coaches, families, and administrators with better visibility." />
            <FeatureCard icon={<ClipboardList size={18} />} title="Structured operations" text="Keep setup and live management more organized behind the scenes." />
            <FeatureCard icon={<Trophy size={18} />} title="Polished playoff display" text="Show clear placement paths through finals and medal games." />
            <FeatureCard icon={<QrCode size={18} />} title="On-site access" text="Let visitors quickly access what’s happening from the field or venue." />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Built for schools, departments, and event organizers</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            A better digital layer around your event can improve both operations and perception.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <AudienceCard title="Athletic departments" text="Run events that feel better organized and easier to follow." />
          <AudienceCard title="Tournament hosts" text="Support live operations without sacrificing presentation." />
          <AudienceCard title="Coaches and teams" text="Provide reliable information without constant back-and-forth." />
          <AudienceCard title="Families and spectators" text="Give people a better way to follow the event live." />
        </div>
      </section>

      <CommonFooterCta
        title="Give your tournament a more professional digital experience"
        text="AthleteOS helps events feel clearer, more modern, and easier to follow for everyone involved."
      />
    </PageShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Variant D · Live Experience / Spectator-first
────────────────────────────────────────────────────────────────────────── */

function MarketingHomeD() {
  return (
    <PageShell
      badge="Built for the full live event experience"
      title="Help players, coaches, and spectators follow every game."
      subtitle="AthleteOS makes tournament day easier to follow with live schedules, standings, scores, and playoff brackets that keep everyone connected to the action."
      primaryCta={{ label: 'View active tournaments', to: '/tournaments' }}
      secondaryCta={{ label: 'Book a demo', to: '/login' }}
      highlights={[
        'Follow games live',
        'See standings clearly',
        'Track playoff paths in real time',
      ]}
    >
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          <ValueCard title="Know where to be" text="Schedules and fields stay visible in one place." />
          <ValueCard title="Know what changed" text="Live results and updates help everyone stay current." />
          <ValueCard title="Know what it means" text="Standings and brackets make tournament scenarios easier to understand." />
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">A better experience for everyone following the tournament</h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              AthleteOS turns live event information into a clear, accessible experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            <FeatureCard icon={<CalendarDays size={18} />} title="Public schedule pages" text="Find the next game, location, and matchup without asking around." />
            <FeatureCard icon={<Radio size={18} />} title="Live score visibility" text="See results update as games are completed." />
            <FeatureCard icon={<BarChart3 size={18} />} title="Readable standings" text="Understand how teams are performing and where they rank." />
            <FeatureCard icon={<Trophy size={18} />} title="Visual brackets" text="Follow championship and consolation paths more easily." />
            <FeatureCard icon={<QrCode size={18} />} title="QR field access" text="Scan and instantly see what’s happening at a field or venue." />
            <FeatureCard icon={<Users size={18} />} title="Shared source of truth" text="Everyone looks at the same up-to-date tournament information." />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-5">
          <StepCard number="01" title="Find the tournament" text="Open the event and see the day’s structure clearly." />
          <StepCard number="02" title="Follow it live" text="Track scores, standings, and playoff movement as results come in." />
          <StepCard number="03" title="Stay connected" text="Use one clean public experience instead of scattered updates." />
        </div>
      </section>

      <CommonFooterCta
        title="Make your tournament easier to follow"
        text="AthleteOS gives players, coaches, and spectators a better live view of the event."
      />
    </PageShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Variant E · Guided Launch / Director-first
────────────────────────────────────────────────────────────────────────── */

function MarketingHomeE() {
  return (
    <PageShell
      badge="Guided launch for tournament directors"
      title="Plan and launch your tournament with support."
      subtitle="AthleteOS helps tournament directors set up events with structure, guidance, and live tools that make tournament day easier to run."
      primaryCta={{ label: 'Book a demo', to: '/login' }}
      secondaryCta={{ label: 'View active tournaments', to: '/tournaments' }}
      highlights={[
        'Guided onboarding',
        'Director-focused setup tools',
        'Support before tournament day',
      ]}
    >
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Early success matters</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            AthleteOS is designed to help directors launch tournaments properly — not just hand over software and hope for the best.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <ValueCard title="Get the structure right" text="Work through divisions, pools, teams, and schedule design with more clarity." />
          <ValueCard title="Prepare before game day" text="Catch setup issues before they become live event problems." />
          <ValueCard title="Run with confidence" text="Use one operational system instead of trying to improvise across tools." />
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Director-first workflow</h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              Built to support the people making the event happen behind the scenes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            <FeatureCard icon={<Settings size={18} />} title="Guided setup" text="Build the tournament structure with more confidence before launch." />
            <FeatureCard icon={<ClipboardList size={18} />} title="Team and pool management" text="Import teams, assign pools, and organize the event logically." />
            <FeatureCard icon={<CalendarDays size={18} />} title="Schedule generation" text="Create an initial schedule and refine it before tournament day." />
            <FeatureCard icon={<Radio size={18} />} title="Live operations" text="Manage score updates and changes as the day unfolds." />
            <FeatureCard icon={<BarChart3 size={18} />} title="Standings transparency" text="Show rankings and progression more clearly." />
            <FeatureCard icon={<Trophy size={18} />} title="Bracket publishing" text="Present playoff paths and finals in a cleaner public format." />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-5">
          <StepCard number="01" title="Plan the format" text="Review divisions, pools, schedule needs, and bracket structure." />
          <StepCard number="02" title="Launch the event" text="Set up the tournament with support and publish the public-facing experience." />
          <StepCard number="03" title="Run the day" text="Use AthleteOS live to manage updates, results, and playoff flow." />
        </div>
      </section>

      <CommonFooterCta
        title="Launch your tournament with more confidence"
        text="AthleteOS supports directors with a more guided path from setup through live event operations."
      />
    </PageShell>
  )
}