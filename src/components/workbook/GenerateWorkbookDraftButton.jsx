import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { GenerateWorkbookDraftModal } from './GenerateWorkbookDraftModal'

export function GenerateWorkbookDraftButton({
  label = 'Generate workbook draft',
  className = '',
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className || 'btn-secondary btn'}
        type="button"
      >
        <FileSpreadsheet size={16} />
        {label}
      </button>

      <GenerateWorkbookDraftModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}