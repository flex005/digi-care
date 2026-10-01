import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { Incident } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { incidents } from '@/data/fixtures/incidents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  correctReport,
  resetSessionIncidents,
  withIncidentEdits,
} from '@/data/access/incident-store'
import { wallClockField } from '@/lib/format'
import { IncidentDetailRoute } from './IncidentDetailRoute'

/**
 * What a correction actually does to the record.
 *
 * **The gating test is not this test.** `correct-report.test.tsx` asserts who
 * can see the control, which is a different question from whether using it
 * changes anything — and the write path had no coverage at all: the form could
 * have saved nothing, or saved to the wrong field, and every existing
 * assertion would have passed.
 *
 * **The second case is the one the UI makes a promise about.** The form warns
 * that the reporter's account is replaced and not kept. That is a claim about
 * the record, so it is asserted against the record rather than taken on the
 * strength of the sentence saying it.
 */
afterEach(() => {
  resetSessionIncidents()
})

/** A fixture incident, read back through the session overlay every screen uses. */
const subject = incidents[0]!
const current = (): Incident => withIncidentEdits(subject)

const correction = {
  type: subject.type,
  severity: subject.severity,
  occurredAt: subject.occurredAt,
  location: subject.location,
  description: 'Found on the floor beside the bed, not beside the chair.',
  immediateAction: 'Checked for injury, helped up with two staff, GP rang.',
}

describe('a correction replaces the reporter’s account', () => {
  it('writes both fields and stamps who changed them', () => {
    const before = current()
    expect(before.edited.kind).toBe('not_edited')

    correctReport(subject, correction, staffOkonkwo)

    const after = current()
    expect(after.description).toBe(correction.description)
    expect(after.response.immediateAction).toBe(correction.immediateAction)

    if (after.edited.kind !== 'edited') throw new Error('no stamp')
    expect(after.edited.edited.by.displayName).toBe(staffOkonkwo.displayName)
    expect(after.edited.edited.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  /*
   * The promise the form makes before somebody saves. Nothing anywhere holds
   * what the reporter wrote: not a field on the incident, not a second record
   * beside it. Asserted over the whole record rather than one field, because
   * "kept somewhere" is a claim about all of it.
   */
  it('keeps the original nowhere, which is what the form warns', () => {
    const original = subject.description
    const originalAction = subject.response.immediateAction

    correctReport(subject, correction, staffOkonkwo)

    const after = current()
    expect(JSON.stringify(after)).not.toContain(original)
    expect(JSON.stringify(after)).not.toContain(originalAction)
  })

  it('leaves the manager’s review alone, which its patch type cannot reach', () => {
    correctReport(subject, correction, staffOkonkwo)
    expect(current().review).toEqual(subject.review)
  })
})

describe('a correction cannot empty the record', () => {
  it.each([
    ['description', { ...correction, description: '   ' }],
    ['immediateAction', { ...correction, immediateAction: '' }],
  ])('throws on a blank %s, and writes nothing', (_, bad) => {
    expect(() => {
      correctReport(subject, bad, staffOkonkwo)
    }).toThrow()

    // Nothing partial landed: the record is untouched and unstamped.
    const after = current()
    expect(after.description).toBe(subject.description)
    expect(after.response.immediateAction).toBe(subject.response.immediateAction)
    expect(after.edited.kind).toBe('not_edited')
  })
})

describe('through the screen somebody actually uses', () => {
  function renderDetail() {
    const router = createMemoryRouter(
      [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
      { initialEntries: [`/incidents/${subject.id}`] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('saves what was typed and shows the stamp afterwards', async () => {
    const user = userEvent.setup()
    const { container } = renderDetail()
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    await user.click(container.querySelector('[data-correct-report]')!)
    const description = container.querySelector<HTMLTextAreaElement>(
      '[data-correct-description]',
    )!
    // The form opens from the record rather than blank: a correction that
    // started empty would delete an account by being saved untouched.
    expect(description.value).toBe(subject.description)

    await user.clear(description)
    await user.type(description, 'Found beside the bed, not the chair.')
    await user.click(container.querySelector('[data-correct-save]')!)

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /Replace it/ }))

    await waitFor(() => expect(container.querySelector('[data-edited]')).toBeTruthy())
    expect(container.querySelector('[data-edited]')!.textContent).toContain(
      staffOkonkwo.displayName,
    )
    expect(current().description).toBe('Found beside the bed, not the chair.')
  }, 30000)
})

/**
 * **Saving a correction must not move when the incident happened.**
 *
 * The field pre-filled from `occurredAt.slice(0, 16)` — raw stored UTC — and
 * saved through `new Date(value)`, which parses a `datetime-local` string as
 * the **viewer's** local time. So opening the form to fix a typo and saving
 * it, with the time field never touched, rewrote the instant.
 *
 * The viewer's zone is pinned away from the site's, because that is the whole
 * mechanism: with both on Europe/London the two wrongs cancel and the test
 * passes on the defect. §8's rule about `now` applied to the environment.
 */
describe('a correction leaves the time alone unless somebody changes it', () => {
  beforeAll(() => {
    vi.stubEnv('TZ', 'Africa/Lagos')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  function renderDetail() {
    const router = createMemoryRouter(
      [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
      { initialEntries: [`/incidents/${subject.id}`] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('comes back as the same instant when only the description changed', async () => {
    const user = userEvent.setup()
    const { container } = renderDetail()
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    await user.click(container.querySelector('[data-correct-report]')!)

    // Untouched: the field is read, never typed into.
    const when = container.querySelector<HTMLInputElement>('[data-correct-occurred]')!
    const asOpened = when.value

    const description = container.querySelector<HTMLTextAreaElement>(
      '[data-correct-description]',
    )!
    await user.clear(description)
    await user.type(description, 'Corrected wording, nothing about the time.')
    await user.click(container.querySelector('[data-correct-save]')!)

    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /Replace it/ }))

    await waitFor(() => expect(container.querySelector('[data-edited]')).toBeTruthy())

    expect(current().description).toBe('Corrected wording, nothing about the time.')
    // The assertion this exists for.
    expect(current().occurredAt).toBe(subject.occurredAt)
    // And the field had been showing the site's wall clock, not raw UTC.
    expect(asOpened).toBe(wallClockField(subject.occurredAt, 'Europe/London'))
  }, 30000)
})
