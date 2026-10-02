import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { residents } from '@/data/fixtures/residents'
import { sites } from '@/data/fixtures/organisation'
import { careNotes } from '@/data/fixtures/care-notes'
import { NoteComposer } from './NoteComposer'
import { CorrectionDialog } from './CorrectionDialog'

/**
 * Who may write a care note, and who may only read them.
 *
 * `/care-notes` declares `records: 'writing a care note, and correcting one'`,
 * so both controls ask `canRecordIn`. Neither asked anything before: an
 * auditor could write a clinical note about a resident under their own name.
 *
 * **Correcting is a write too, and it is the easier one to miss.** Notes are
 * immutable, so a correction is a *new linked note* rather than an edit —
 * which makes it look like a smaller act than it is.
 */

const MAY_WRITE: StaffRole[] = [
  'registered_manager',
  'deputy_manager',
  'senior_carer',
  'care_worker',
]
const MAY_NOT_WRITE: StaffRole[] = ['auditor']

const resident = residents[0]!
const site = sites.find((one) => one.id === resident.siteId)!
const note = careNotes.find((one) => one.residentId === resident.id) ?? careNotes[0]!

function renderAs(role: StaffRole, element: React.ReactElement) {
  return render(
    <SessionProvider>
      <TooltipProvider>
        <SignInAs as={role} />
        {element}
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('writing a care note', () => {
  const composer = (
    <NoteComposer resident={resident} site={site} onWritten={() => undefined} />
  )

  it.each(MAY_NOT_WRITE)('refuses %s, and says why', async (role) => {
    const { container } = renderAs(role, composer)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
      'write one',
    )
    expect(container.textContent).not.toContain('Write a care note')
  })

  it.each(MAY_WRITE)('offers %s the control', async (role) => {
    const { container } = renderAs(role, composer)
    await waitFor(() => {
      expect(container.textContent).toContain('Write a care note')
    })
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})

describe('correcting a care note', () => {
  const dialog = (
    <CorrectionDialog
      original={note}
      resident={resident}
      site={site}
      onWritten={() => undefined}
    />
  )

  it.each(MAY_NOT_WRITE)('refuses %s, and says why', async (role) => {
    const { container } = renderAs(role, dialog)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
      'add a correction',
    )
    expect(container.textContent).not.toContain('Add correction note')
  })

  it.each(MAY_WRITE)('offers %s the control', async (role) => {
    const { container } = renderAs(role, dialog)
    await waitFor(() => {
      expect(container.textContent).toContain('Add correction note')
    })
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})
