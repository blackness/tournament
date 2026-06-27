
import { ScheduleEditor } from '../../../pages/director/ScheduleEditor'
import { WizardNavButtons } from './WizardNavButtons'
import { getDivisionReadiness } from '../../../lib/divisions/getDivisionReadiness'

export function WizardStep6Schedule({ onNext, onBack }) {
  return (
    <ScheduleEditor
      embedded
      footer={
        <WizardNavButtons
          onNext={onNext}
          onBack={onBack}
          nextLabel="Continue"
        />
      }
    />
  )
}