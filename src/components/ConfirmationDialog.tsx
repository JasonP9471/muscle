import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function ConfirmationDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) cancelRef.current?.focus() }, [open])
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <button className="icon-button dialog-close" aria-label="Close" onClick={onCancel}><X /></button>
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="button secondary" ref={cancelRef} onClick={onCancel}>Cancel</button>
          <button className={`button ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

