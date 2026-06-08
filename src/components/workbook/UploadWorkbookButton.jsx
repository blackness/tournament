import { useState } from 'react'
import { Upload } from 'lucide-react'
import { UploadWorkbookModal } from './UploadWorkbookModal'

export function UploadWorkbookButton({
  label = 'Upload workbook',
  onValidated,
  className = '',
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'btn-secondary btn'}
      >
        <Upload size={16} />
        {label}
      </button>

      <UploadWorkbookModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onValidated={onValidated}
      />
    </>
  )
}