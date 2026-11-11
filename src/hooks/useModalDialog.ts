import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type ModalDialogOptions = {
  open: boolean
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
}

const modalStack: HTMLElement[] = []

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
}

export function useModalDialog<T extends HTMLElement>({
  open,
  onClose,
  initialFocusRef,
  returnFocusRef,
}: ModalDialogOptions) {
  const dialogRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const returnFocus = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    modalStack.push(dialog)
    const backgroundState: Array<{ element: HTMLElement; inert: boolean; ariaHidden: string | null }> = []
    let branch: HTMLElement = dialog
    while (branch.parentElement && branch.parentElement !== document.body) {
      const parent: HTMLElement = branch.parentElement
      for (const child of Array.from(parent.children)) {
        if (!(child instanceof HTMLElement) || child === branch) continue
        backgroundState.push({
          element: child,
          inert: child.inert,
          ariaHidden: child.getAttribute('aria-hidden'),
        })
        child.inert = true
        child.setAttribute('aria-hidden', 'true')
      }
      branch = parent
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog
      initialFocus.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown, true)
      const modalIndex = modalStack.lastIndexOf(dialog)
      if (modalIndex >= 0) modalStack.splice(modalIndex, 1)
      document.body.style.overflow = previousOverflow
      backgroundState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    }
  }, [initialFocusRef, open, returnFocusRef])

  return dialogRef
}
