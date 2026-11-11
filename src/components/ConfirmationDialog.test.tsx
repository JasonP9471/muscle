import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'

afterEach(cleanup)

function DialogHarness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false)
  return <div>
    <button onClick={() => setOpen(true)}>Open dialog</button>
    <ConfirmationDialog
      open={open}
      title="End workout?"
      message="Your active session will be discarded."
      confirmLabel="End workout"
      onCancel={() => setOpen(false)}
      onConfirm={onConfirm}
    />
  </div>
}

describe('ConfirmationDialog', () => {
  it('traps focus, makes the background inert, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)

    const dialog = screen.getByRole('alertdialog', { name: 'End workout?' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'End workout' })
    const close = screen.getByRole('button', { name: 'Close' })
    await waitFor(() => expect(cancel).toHaveFocus())
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)).toHaveTextContent('End workout?')
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)).toHaveTextContent('Your active session will be discarded.')
    expect(trigger).toHaveAttribute('aria-hidden', 'true')
    expect(trigger).toHaveProperty('inert', true)

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).not.toHaveAttribute('aria-hidden')
    expect(trigger).not.toHaveProperty('inert', true)
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the confirmation action functional', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DialogHarness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await user.click(screen.getByRole('button', { name: 'End workout' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('generates unique title and description IDs for multiple instances', () => {
    render(<>
      <ConfirmationDialog open title="First" message="First description" onCancel={() => {}} onConfirm={() => {}} />
      <ConfirmationDialog open title="Second" message="Second description" onCancel={() => {}} onConfirm={() => {}} />
    </>)
    const dialogs = Array.from(document.querySelectorAll('[role="alertdialog"]'))
    const titleIds = dialogs.map((dialog) => dialog.getAttribute('aria-labelledby'))
    const descriptionIds = dialogs.map((dialog) => dialog.getAttribute('aria-describedby'))
    expect(new Set(titleIds).size).toBe(2)
    expect(new Set(descriptionIds).size).toBe(2)
  })
})
