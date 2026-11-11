import { X } from 'lucide-react'
import { useId, useRef, type RefObject } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'

export function ConfirmationDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel, returnFocusRef,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useModalDialog<HTMLDivElement>({ open, onClose: onCancel, initialFocusRef: cancelRef, returnFocusRef })
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="dialog" ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <button className="icon-button dialog-close" aria-label="Close" onClick={onCancel}><X /></button>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="dialog-actions">
          <button className="button secondary" ref={cancelRef} onClick={onCancel}>Cancel</button>
          <button className={`button ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

