
import { ScheduleEditor } from '../../../pages/director/ScheduleEditor'
import { WizardNavButtons } from './WizardNavButtons'

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