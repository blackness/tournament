import { Check } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Basics' },
  { n: 2, label: 'Sport' },
  { n: 3, label: 'Divisions' },
  { n: 4, label: 'Venues' },
  { n: 5, label: 'Teams' },
  { n: 6, label: 'Schedule' },
  { n: 7, label: 'Review' },
  { n: 8, label: 'Publish' },
]

export function WizardProgress({ currentStep, onGoToStep }) {
  return (
    <div className="w-full">
      {/* Desktop: horizontal step row */}
      <div className="hidden sm:flex items-center">
        {STEPS.map((step, idx) => {
          const done    = currentStep > step.n
          const active  = currentStep === step.n
          const future  = currentStep < step.n

          return (
            <div key={step.n} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <button
                onClick={() => done && onGoToStep?.(step.n)}
                disabled={!done}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors',
                  done   ? 'bg-[var(--accent)] text-[var(--bg-base)] cursor-pointer hover:opacity-90' : '',
                  active ? 'bg-[var(--accent)] text-[var(--bg-base)] ring-4 ring-[var(--accent-dim)]' : '',
                  future ? 'bg-gray-200 text-gray-500 cursor-default' : '',
                ].join(' ')}
              >
                {done ? <Check size={14} /> : step.n}
              </button>

              {/* Label */}
              <span className={`ml-2 text-xs font-medium ${active ? 'text-[var(--accent)]' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                {step.label}
              </span>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${done ? 'bg-[var(--accent)]' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: compact "Step X of 8 — Label" */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Step {currentStep} of 8 — {STEPS[currentStep - 1]?.label}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{Math.round((currentStep / 8) * 100)}%</span>
        </div>
        <div className="w-full rounded-full h-1.5">
          <div
            className="bg-[var(--accent)] h-1.5 rounded-full transition-all"
            style={{ width: `${(currentStep / 8) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
