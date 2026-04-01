import { useWizardStore } from '../../../store/wizardStore'
import { WizardNavButtons } from './WizardNavButtons'
import { AlertTriangle, Check, Users, Clock, Home } from 'lucide-react'

const CONFLICT_ICONS = {
  same_club:    <Home size={13} />,
  rest_time:    <Clock size={13} />,
  field_clash:  <AlertTriangle size={13} />,
  default:      <AlertTriangle size={13} />,
}

export function WizardStep7Constraints({ onNext, onBack }) {
  const {
    teams, scheduleConflicts, reviewedTeamIds, acknowledgedConflicts,
    markTeamReviewed, acknowledgeConflict,
  } = useWizardStore()

  const errors   = scheduleConflicts.filter(c => c.severity === 'error')
  const warnings = scheduleConflicts.filter(c => c.severity === 'warning')

  const unacknowledgedErrors = errors.filter(
    c => !acknowledgedConflicts.includes(`${c.type}:${c.teamId}`)
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Constraint Review</h2>
        <p className="section-subtitle">
          Review scheduling conflicts before publishing.
          Conflicts are informational only — you decide how to handle them.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-4 text-center ${errors.length > 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{errors.length}</p>
          <p className={`text-xs mt-0.5 ${errors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>Errors</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${warnings.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${warnings.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{warnings.length}</p>
          <p className={`text-xs mt-0.5 ${warnings.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>Warnings</p>
        </div>
        <div className=" rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text-secondary)]">{teams.length}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Teams</p>
        </div>
      </div>

      {scheduleConflicts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-green-600">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Check size={22} />
          </div>
          <p className="font-medium">No scheduling conflicts found!</p>
          <p className="text-sm text-[var(--text-muted)]">Your schedule looks good. Continue to publish.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Errors first */}
          {errors.map((c, i) => {
            const key = `${c.type}:${c.teamId}`
            const acked = acknowledgedConflicts.includes(key)
            return (
              <ConflictRow
                key={i}
                conflict={c}
                acknowledged={acked}
                onAcknowledge={() => acknowledgeConflict(key)}
              />
            )
          })}

          {/* Then warnings */}
          {warnings.map((c, i) => {
            const key = `${c.type}:${c.teamId}`
            const acked = acknowledgedConflicts.includes(key)
            return (
              <ConflictRow
                key={`w${i}`}
                conflict={c}
                acknowledged={acked}
                onAcknowledge={() => acknowledgeConflict(key)}
              />
            )
          })}
        </div>
      )}

      {unacknowledgedErrors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            {unacknowledgedErrors.length} unacknowledged error{unacknowledgedErrors.length !== 1 ? 's' : ''}.
            Acknowledge each one to proceed — conflicts are <strong>informational only</strong> and won't block publishing.
          </span>
        </div>
      )}

      <WizardNavButtons
        onNext={onNext}
        onBack={onBack}
        nextDisabled={unacknowledgedErrors.length > 0}
        nextLabel="Continue to preview"
      />
    </div>
  )
}

function ConflictRow({ conflict, acknowledged, onAcknowledge }) {
  const isError = conflict.severity === 'error'

  return (
    <div className={`flex gap-3 p-3 rounded-xl border transition-opacity ${
 acknowledged ? 'opacity-50' : ''
 } ${isError
 ? 'bg-red-50 border-red-200'
 : 'bg-yellow-50 border-yellow-200'
 }`}>
      <div className={`flex-shrink-0 mt-0.5 ${isError ? 'text-red-500' : 'text-yellow-600'}`}>
        {CONFLICT_ICONS[conflict.type] ?? CONFLICT_ICONS.default}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isError ? 'text-red-800' : 'text-yellow-800'}`}>
          {conflict.message}
        </p>
        {conflict.matchIds?.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Affects {conflict.matchIds.length} game{conflict.matchIds.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      {!acknowledged ? (
        <button
          onClick={onAcknowledge}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg font-medium ${
 isError
 ? 'bg-red-100 text-red-700 hover:bg-red-200'
 : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
 }`}
        >
          Acknowledge
        </button>
      ) : (
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)] flex items-center gap-1">
          <Check size={12} /> OK
        </span>
      )}
    </div>
  )
}
