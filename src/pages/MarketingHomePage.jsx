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
} from 'lucide-react'

export function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_45%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 mb-5">
              Built for school and multi-field tournaments
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
              Schedules, scores, standings, and brackets — all in one place.
            </h1>

            <p className="mt-5 text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              AthleteOS helps tournament directors set up events faster, manage changes live,
              and give coaches, players, and spectators a better tournament-day experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/director/new" className="btn-primary btn px-5 py-3 text-sm">
                Start a tournament
                <ArrowRight size={16} />
              </Link>
              <Link to="/tournaments" className="btn-secondary btn px-5 py-3 text-sm">
                View live tournaments
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-500" />
                Tournament setup wizard
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-500" />
                Live score updates
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-500" />
                Public standings and brackets
              </div>
            </div>
          </div>
        </div>
      </section>

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

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-raised)] p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            Ready to modernize your tournament?
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] max-w-2xl mx-auto">
            Launch a cleaner, more professional tournament experience for directors, coaches, players, and spectators.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/director/new" className="btn-primary btn px-5 py-3 text-sm">
              Start a tournament
            </Link>
            <Link to="/tournaments" className="btn-secondary btn px-5 py-3 text-sm">
              See live tournaments
            </Link>
          </div>
        </div>
      </section>
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