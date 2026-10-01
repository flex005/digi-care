import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { Incident, IncidentAct, IsoDateTime } from '@/data/types'
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
  // Unchanged, which is the ordinary case: a correction about the account
  // says nothing new about the body map or who saw it.
  injuries: subject.injuries,
  witnesses: subject.response.witnesses,
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

/**
 * What a correction may now also reach, and whose name ends up on it.
 *
 * **A stamp is a claim that somebody observed something**, so the rule has two
 * halves and both are defects if missed. Leaving the reporter's name on a body
 * map an admin redrew credits an observation to the wrong person. Moving it on
 * a correction that only fixed a typo does the same thing in the other
 * direction — and that one is the easier to ship, because it looks like
 * consistency.
 *
 * `inc-034` is used rather than `incidents[0]` because it carries both a
 * marked body map and a named witness, each recorded by C. Nwosu, so the
 * correcting admin's name appearing where it should not is visible.
 */
describe('a correction reaches the two observations, and only re-stamps what moved', () => {
  const marked = incidents.find((entry) => entry.id === 'inc-034')!
  const read = (): Incident => withIncidentEdits(marked)

  /*
   * **Stamped with the admin, exactly as the form sends it.** The form rebuilds
   * both observations on every save with `currentUser` on them, so the store is
   * what has to notice the fact did not move and keep the original author. An
   * earlier version of this block passed `marked.injuries` straight back —
   * the original object, original stamp and all — and then asserted the
   * original author survived, which is true however the store behaves. It
   * passed against a store that re-stamped unconditionally. The mutation
   * caught it; reading it did not.
   */
  const adminStamp: IncidentAct = {
    by: staffOkonkwo,
    at: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  }
  const asFormSends = {
    injuries:
      marked.injuries.kind === 'marked'
        ? ({
            kind: 'marked',
            regions: marked.injuries.regions,
            recorded: adminStamp,
          } as const)
        : ({ kind: 'not_recorded' } as const),
    witnesses:
      marked.response.witnesses.kind === 'witnessed'
        ? ({
            kind: 'witnessed',
            people: marked.response.witnesses.people,
            recordedBy: staffOkonkwo,
          } as const)
        : ({ kind: 'nobody_witnessed', recordedBy: staffOkonkwo } as const),
  }

  const base = {
    type: marked.type,
    severity: marked.severity,
    occurredAt: marked.occurredAt,
    location: marked.location,
    description: marked.description,
    immediateAction: marked.response.immediateAction,
    ...asFormSends,
  }

  it('leaves both stamps alone when only the description changed', () => {
    if (marked.injuries.kind !== 'marked') throw new Error('fixture lost its body map')
    if (marked.response.witnesses.kind !== 'witnessed')
      throw new Error('fixture lost its witness')
    const injuryAuthor = marked.injuries.recorded.by.id
    const injuryAt = marked.injuries.recorded.at
    const witnessAuthor = marked.response.witnesses.recordedBy.id

    correctReport(
      marked,
      { ...base, description: 'Reworded, and nothing else.' },
      staffOkonkwo,
    )

    const after = read()
    expect(after.description).toBe('Reworded, and nothing else.')
    if (after.injuries.kind !== 'marked') throw new Error('the body map was lost')
    if (after.response.witnesses.kind !== 'witnessed')
      throw new Error('the witness was lost')

    // The assertion this block exists for: the admin's name is NOT on these.
    expect(after.injuries.recorded.by.id).toBe(injuryAuthor)
    expect(after.injuries.recorded.at).toBe(injuryAt)
    expect(after.response.witnesses.recordedBy.id).toBe(witnessAuthor)
    expect(after.injuries.recorded.by.id).not.toBe(staffOkonkwo.id)
    expect(after.response.witnesses.recordedBy.id).not.toBe(staffOkonkwo.id)
  })

  it('does not re-stamp for a reordering, which is not a different observation', () => {
    if (marked.response.witnesses.kind !== 'witnessed')
      throw new Error('fixture lost its witness')
    const people = marked.response.witnesses.people
    correctReport(
      marked,
      {
        ...base,
        witnesses: {
          kind: 'witnessed',
          people: [...people].reverse() as [string, ...string[]],
          recordedBy: staffOkonkwo,
        },
      },
      staffOkonkwo,
    )

    const after = read()
    if (after.response.witnesses.kind !== 'witnessed') throw new Error('witness lost')
    expect(after.response.witnesses.recordedBy.id).not.toBe(staffOkonkwo.id)
  })

  it('puts the admin on the body map when the regions actually change', () => {
    correctReport(
      marked,
      {
        ...base,
        injuries: {
          kind: 'marked',
          regions: ['elbow_right'],
          recorded: {
            by: staffOkonkwo,
            at: '2026-10-02T09:00:00.000Z' as IsoDateTime,
          },
        },
      },
      staffOkonkwo,
    )

    const after = read()
    if (after.injuries.kind !== 'marked') throw new Error('the body map was lost')
    expect(after.injuries.regions).toEqual(['elbow_right'])
    expect(after.injuries.recorded.by.id).toBe(staffOkonkwo.id)
  })

  it('puts the admin on the witnesses when who saw it actually changes', () => {
    correctReport(
      marked,
      {
        ...base,
        witnesses: {
          kind: 'nobody_witnessed',
          recordedBy: staffOkonkwo,
        },
      },
      staffOkonkwo,
    )

    const after = read()
    expect(after.response.witnesses.kind).toBe('nobody_witnessed')
    expect(after.response.witnesses.recordedBy.id).toBe(staffOkonkwo.id)
  })

  /*
   * The resident, the evidence and the family decision are deliberately out of
   * reach. Held by the type rather than by a test asserting a sentence: the
   * fields are not on `ReporterCorrection`, so a form that tried would not
   * compile. What is worth asserting is that a correction does not disturb
   * them in passing.
   */
  it('leaves the subject, the evidence and the family decision alone', () => {
    correctReport(marked, { ...base, description: 'Reworded again.' }, staffOkonkwo)

    const after = read()
    expect(after.subject).toEqual(marked.subject)
    expect(after.evidence).toEqual(marked.evidence)
    expect(after.familyTold).toEqual(marked.familyTold)
    // And the wall this patch type exists to hold.
    expect(after.review).toEqual(marked.review)
  })
})
