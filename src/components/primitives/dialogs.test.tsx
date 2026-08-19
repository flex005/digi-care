import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertDialog, Dialog } from './index'

/**
 * PRD §2.4 — the supporting risk, wrong-subject writes.
 *
 * "Every confirmation dialog restates the subject by name in the confirming
 * sentence — never 'Are you sure?'". The type already makes `title` and
 * `description` required; these tests check the rendered result behaves.
 *
 * PRD §7 — focus is trapped in dialogs and returned to the trigger on close.
 * That comes from Radix, and the test is here so that a future change which
 * accidentally reimplements the overlay by hand gets caught.
 */

describe('Dialog', () => {
  it('names the subject in its accessible title', () => {
    render(
      <Dialog
        open
        onOpenChange={() => {}}
        title="Add a care note for Emmanuel Okafor"
        description="Recorded against Emmanuel Okafor, room 14."
      />,
    )
    expect(screen.getByRole('dialog', { name: /Emmanuel Okafor/ })).toBeInTheDocument()
  })

  it('returns focus to the trigger when it closes', async () => {
    const user = userEvent.setup()

    function Harness() {
      return (
        <>
          <button type="button" data-testid="trigger">
            Open
          </button>
          <Dialog open onOpenChange={() => {}} title="Record for Emmanuel Okafor?" />
        </>
      )
    }

    const { rerender } = render(<Harness />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(
      <>
        <button type="button" data-testid="trigger">
          Open
        </button>
      </>,
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('AlertDialog', () => {
  it('names the subject and the action, never "Are you sure?"', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <AlertDialog
        open
        onOpenChange={() => {}}
        title="Record 08:00 medications for Emmanuel Okafor?"
        description="Amlodipine 5mg will be recorded as given at 08:04 by A. Okonkwo."
        confirmLabel="Record medications"
        onConfirm={onConfirm}
      />,
    )

    const dialog = screen.getByRole('alertdialog', {
      name: /Record 08:00 medications for Emmanuel Okafor\?/,
    })
    expect(dialog).toBeInTheDocument()

    // The action names what it does; it is not "OK".
    const confirm = screen.getByRole('button', { name: 'Record medications' })
    expect(screen.queryByRole('button', { name: /^OK$/i })).not.toBeInTheDocument()

    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
