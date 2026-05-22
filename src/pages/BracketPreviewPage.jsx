import { useParams } from 'react-router-dom'
import { Trophy, Shield, Clock, MapPin } from 'lucide-react'

const mockBracket = {
  championship: [
    {
      key: 'round1',
      title: 'Championship Round 1',
      matches: [
        {
          id: 'p1',
          label: 'P1',
          teamAName: '1st A',
          teamBName: 'Winner X2',
          status: 'scheduled',
          time: '9:45 AM',
          field: 'Mikmac A',
        },
        {
          id: 'p2',
          label: 'P2',
          teamAName: '1st B',
          teamBName: 'Winner X1',
          status: 'scheduled',
          time: '9:45 AM',
          field: 'Mikmac B',
        },
        {
          id: 'p3',
          label: 'P3',
          teamAName: '1st C',
          teamBName: 'Winner X4',
          status: 'scheduled',
          time: '9:45 AM',
          field: 'Richardson A',
        },
        {
          id: 'p4',
          label: 'P4',
          teamAName: '1st D',
          teamBName: 'Winner X3',
          status: 'scheduled',
          time: '9:45 AM',
          field: 'Richardson B',
        },
      ],
    },
    {
      key: 'round2',
      title: 'Classification Round',
      matches: [
        {
          id: 'p5',
          label: 'P5',
          teamAName: 'Winner P1',
          teamBName: 'Winner P2',
          status: 'scheduled',
          time: '12:15 PM',
          field: 'Mikmac A',
        },
        {
          id: 'p6',
          label: 'P6',
          teamAName: 'Winner P3',
          teamBName: 'Winner P4',
          status: 'scheduled',
          time: '12:15 PM',
          field: 'Mikmac B',
        },
        {
          id: 'p7',
          label: 'P7',
          teamAName: 'Loser P1',
          teamBName: 'Loser P2',
          status: 'scheduled',
          time: '12:15 PM',
          field: 'Richardson A',
        },
        {
          id: 'p8',
          label: 'P8',
          teamAName: 'Loser P3',
          teamBName: 'Loser P4',
          status: 'scheduled',
          time: '12:15 PM',
          field: 'Richardson B',
        },
      ],
    },
    {
      key: 'round3',
      title: 'Placement Finals',
      matches: [
        {
          id: 'p9',
          label: 'Gold Medal Game',
          teamAName: 'WW Team 1',
          teamBName: 'WW Team 2',
          status: 'scheduled',
          time: '2:45 PM',
          field: 'Richardson A',
        },
        {
          id: 'p10',
          label: 'Bronze Medal Game',
          teamAName: 'WL Team 1',
          teamBName: 'WL Team 2',
          status: 'scheduled',
          time: '2:45 PM',
          field: 'Richardson B',
        },
        {
          id: 'p11',
          label: '5th Place Game',
          teamAName: 'LW Team 1',
          teamBName: 'LW Team 2',
          status: 'scheduled',
          time: '2:45 PM',
          field: 'Mikmac A',
        },
        {
          id: 'p12',
          label: '7th Place Game',
          teamAName: 'LL Team 1',
          teamBName: 'LL Team 2',
          status: 'scheduled',
          time: '2:45 PM',
          field: 'Mikmac B',
        },
      ],
    },
  ],
  consolation: [
    {
      key: 'round1',
      title: 'Consolation Round 1',
      matches: [
        {
          id: 'c1',
          label: 'C1',
          teamAName: '4th A',
          teamBName: 'Loser X2',
          status: 'scheduled',
          time: '8:30 AM',
          field: 'Mikmac A',
        },
        {
          id: 'c2',
          label: 'C2',
          teamAName: '4th B',
          teamBName: 'Loser X1',
          status: 'scheduled',
          time: '8:30 AM',
          field: 'Mikmac B',
        },
        {
          id: 'c3',
          label: 'C3',
          teamAName: '4th C',
          teamBName: 'Loser X4',
          status: 'scheduled',
          time: '8:30 AM',
          field: 'Richardson A',
        },
        {
          id: 'c4',
          label: 'C4',
          teamAName: '4th D',
          teamBName: 'Loser X3',
          status: 'scheduled',
          time: '8:30 AM',
          field: 'Richardson B',
        },
      ],
    },
    {
      key: 'round2',
      title: 'Classification Round',
      matches: [
        {
          id: 'c5',
          label: 'C5',
          teamAName: 'Winner C1',
          teamBName: 'Winner C2',
          status: 'scheduled',
          time: '11:00 AM',
          field: 'Mikmac A',
        },
        {
          id: 'c6',
          label: 'C6',
          teamAName: 'Winner C3',
          teamBName: 'Winner C4',
          status: 'scheduled',
          time: '11:00 AM',
          field: 'Mikmac B',
        },
        {
          id: 'c7',
          label: 'C7',
          teamAName: 'Loser C1',
          teamBName: 'Loser C2',
          status: 'scheduled',
          time: '11:00 AM',
          field: 'Richardson A',
        },
        {
          id: 'c8',
          label: 'C8',
          teamAName: 'Loser C3',
          teamBName: 'Loser C4',
          status: 'scheduled',
          time: '11:00 AM',
          field: 'Richardson B',
        },
      ],
    },
    {
      key: 'round3',
      title: 'Placement Finals',
      matches: [
        {
          id: 'c9',
          label: '9th Place Game',
          teamAName: 'WW Team 1',
          teamBName: 'WW Team 2',
          status: 'scheduled',
          time: '1:30 PM',
          field: 'Mikmac A',
        },
        {
          id: 'c10',
          label: '11th Place Game',
          teamAName: 'WL Team 1',
          teamBName: 'WL Team 2',
          status: 'scheduled',
          time: '1:30 PM',
          field: 'Mikmac B',
        },
        {
          id: 'c11',
          label: '13th Place Game',
          teamAName: 'LW Team 1',
          teamBName: 'LW Team 2',
          status: 'scheduled',
          time: '1:30 PM',
          field: 'Richardson A',
        },
        {
          id: 'c12',
          label: '15th Place Game',
          teamAName: 'LL Team 1',
          teamBName: 'LL Team 2',
          status: 'scheduled',
          time: '1:30 PM',
          field: 'Richardson B',
        },
      ],
    },
  ],
}

export function BracketPage() {
  const { slug, divisionId } = useParams()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-title">Playoff Bracket</h1>
        <p className="section-subtitle">
          Division {divisionId} • Championship and consolation bracket view
        </p>
      </div>

      <BracketSection
        title="Championship Bracket"
        icon={<Trophy size={16} />}
        rounds={mockBracket.championship}
      />

      <BracketSection
        title="Consolation Bracket"
        icon={<Shield size={16} />}
        rounds={mockBracket.consolation}
      />
    </div>
  )
}

function BracketSection({ title, icon, rounds }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-[var(--accent)]">{icon}</div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {rounds.map(round => (
            <BracketRoundColumn
              key={round.key}
              title={round.title}
              matches={round.matches}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function BracketRoundColumn({ title, matches }) {
  return (
    <div className="w-[280px] flex-shrink-0">
      <div className="mb-3 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {title}
        </h3>
      </div>

      <div className="space-y-3">
        {matches.map(match => (
          <BracketMatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  )
}

function BracketMatchCard({ match }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {match.label}
        </span>
        <StatusBadge status={match.status} />
      </div>

      <div className="space-y-2">
        <TeamLine name={match.teamAName} score={match.teamAScore} />
        <TeamLine name={match.teamBName} score={match.teamBScore} />
      </div>

      <div className="mt-3 flex flex-col gap-1 text-[11px] text-[var(--text-muted)]">
        {match.time && (
          <div className="flex items-center gap-1.5">
            <Clock size={11} />
            <span>{match.time}</span>
          </div>
        )}
        {match.field && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} />
            <span>{match.field}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamLine({ name, score }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-surface)] px-3 py-2">
      <span className="text-sm truncate text-[var(--text-secondary)]">
        {name || 'TBD'}
      </span>
      {score !== undefined && score !== null && (
        <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
          {score}
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'in_progress') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
        Live
      </span>
    )
  }

  if (status === 'complete') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
        Final
      </span>
    )
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
      Scheduled
    </span>
  )
}