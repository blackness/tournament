import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export function WizardNavButtons({
  onNext,
  onBack,
  isFirst = false,
  isLast  = false,
  saving  = false,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-6">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        disabled={isFirst || saving}
        className="btn-secondary btn flex items-center gap-1 disabled:opacity-0"
      >
        <ChevronLeft size={16} />
        {backLabel}
      </button>

      {/* Next / Publish */}
      <button
        type="button"
        onClick={onNext}
        disabled={saving || nextDisabled}
        className={`btn flex items-center gap-1 ${isLast ? 'btn-primary btn-lg' : 'btn-primary'}`}
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {nextLabel}
            {!isLast && <ChevronRight size={16} />}
          </>
        )}
      </button>
    </div>
  )
}
