import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type {
  CarePlanDomainId,
  CarePlanDomainRecord,
  IsoDateTime,
  Resident,
} from '@/data/types'
import { CARE_PLAN_DOMAINS, subjectResidentId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { incidents } from '@/data/fixtures/incidents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import {
  patchedIncidents,
  resetSessionReviewFlags,
} from '@/data/access/review-flag-store'
import { resetSessionCarePlan } from '@/data/access/care-plan-draft-store'
import { wasClearedLate } from '@/data/access/review-flags'
import { router as appRouter } from '@/app/routes'
import { ResidentProfileRoute, TABS } from '@/features/residents/ResidentProfileRoute'
import { CarePlanTab } from './CarePlanTab'
import { DomainEditorRoute } from './DomainEditorRoute'
import { VersionHistoryRoute } from './VersionHistoryRoute'
import { compareVersions, currentVersion, PLAN_FIELDS } from './plan-fields'
import { DUE_SOON_DAYS, wholeDaysBetween } from '@/lib/review-interval'

/**
 * Care planning. PRD §6.7.
 *
 * The module's own hazard is the one the diff screen is named after: **a plan
 * is a document people believe.** Staff follow what it says, families read it,
 * and inspectors take it as the account of what this home decided to do — so
 * every way of making it look more complete than it is costs somebody
 * something. Most of what is under test is that the gaps survive the arrival
 * of the editor that fills them.
 *
 * **Pinned to the instant the fixtures were generated against.** Three of
 * these states are arithmetic on today's date — due soon, overdue, and whether
 * a 48-hour deadline has passed — so a suite run in the afternoon and a suite
 * run at 00:10 would be asking different questions (§8).
 */
const PINNED = NOW
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: PINNED })
})

afterAll(() => {
  vi.useRealTimers()
})

afterEach(() => {
  resetSessionReviewFlags()
  resetSessionCarePlan()
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { path: 'care-plan', element: <CarePlanTab /> },
          { path: 'care-plan/:domainId', element: <DomainEditorRoute /> },
          { path: 'care-plan/:domainId/history', element: <VersionHistoryRoute /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(() => {
    expect(container.querySelector('[data-domain], [data-field], h2')).toBeTruthy()
    expect(container.textContent).not.toMatch(/Checking post-incident reviews/)
  })

/* ---------------------------------------------------------------- subjects */

/** Every domain and its resident, so a case is found by property not by id. */
const allDomains: { resident: Resident; record: CarePlanDomainRecord }[] =
  residents.flatMap((resident) =>
    resident.carePlan.map((record) => ({ resident, record })),
  )

const find = (
  predicate: (entry: { resident: Resident; record: CarePlanDomainRecord }) => boolean,
  what: string,
) => {
  const entry = allDomains.find(predicate)
  if (!entry) throw new Error(`No fixture reaches ${what}`)
  return entry
}

const nothingWritten = residents.find((resident) =>
  resident.carePlan.every((record) => record.status.kind === 'not_started'),
)!

const draftOverSigned = find(
  ({ record }) => record.versions.kind === 'finalised' && record.draft.kind === 'draft',
  'a signed domain carrying an unsigned draft',
)

const partWritten = find(
  ({ record }) => record.status.kind === 'in_progress',
  'a part-written domain with nothing signed',
)

const overdue = find(
  ({ record }) => record.status.kind === 'review_due',
  'a domain past its review date',
)

const dueSoon = find(({ record }) => {
  if (record.status.kind !== 'complete') return false
  const days = wholeDaysBetween(
    NOW_ISO.slice(0, 10) as `${number}-${number}-${number}`,
    record.status.nextReviewOn,
  )
  return days >= 0 && days <= DUE_SOON_DAYS
}, 'a domain approaching its review date')

const unchangedInDiff = find(({ record }) => {
  if (record.versions.kind !== 'finalised') return false
  if (record.versions.history.length < 2) return false
  const [was, now] = record.versions.history.slice(-2)
  return compareVersions(was!, now!).some((entry) => !entry.changed)
}, 'two versions with a field that did not change')

const firstVersionOnly = find(
  ({ record }) =>
    record.versions.kind === 'finalised' && record.versions.history.length === 1,
  'a domain finalised exactly once',
)

/** The domain that owes an overdue post-incident review — inc-941's other half. */
const owesReview = (() => {
  for (const incident of incidents) {
    const residentId = subjectResidentId(incident)
    if (residentId === 'none') continue
    for (const flag of incident.reviewFlags) {
      if (flag.state.kind !== 'awaiting') continue
      if (flag.target.kind !== 'care_plan_domain') continue
      if (flag.dueBy >= NOW_ISO) continue
      const resident = residents.find((entry) => entry.id === residentId)
      if (resident) {
        return { resident, domainId: flag.target.domainId, incident }
      }
    }
  }
  throw new Error('No fixture reaches a care plan domain owing an overdue review')
})()

/* -------------------------------------------------------------- the list */

describe('the domain list', () => {
  it('renders all ten domains, from the constant and not from the record', async () => {
    // The resident with nothing written is the test: a list built from what
    // exists would render nothing at all for them.
    const { container } = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(container)

    const rows = container.querySelectorAll('[data-domain]')
    expect(rows.length).toBe(CARE_PLAN_DOMAINS.length)
    for (const domain of CARE_PLAN_DOMAINS) {
      expect(
        container.querySelector(`[data-domain="${domain.id}"]`),
        domain.id,
      ).toBeTruthy()
    }
  })

  it('leads with the count of what was never written, carrying its denominator', async () => {
    const { container } = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(container)

    const lead = container.querySelector('[data-never-written]')
    // Counted here rather than read from the screen's own derivation: a test
    // that asks the code what the answer is confirms the code.
    const expected = nothingWritten.carePlan.filter(
      (record) => record.status.kind === 'not_started',
    ).length
    expect(lead?.getAttribute('data-never-written')).toBe(String(expected))
    expect(lead?.textContent).toMatch(new RegExp(`of\\s*${CARE_PLAN_DOMAINS.length}`))
    expect(lead?.textContent).toMatch(/never been written down/)
  })

  it('puts the resident’s own words under the domain name', async () => {
    const { resident, record } = find(
      ({ record }) => record.versions.kind === 'finalised',
      'a signed domain',
    )
    const { container } = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(container)

    const version = currentVersion(record)
    if (version === 'none') throw new Error('expected a signed version')

    const row = container.querySelector(`[data-domain="${record.domainId}"]`)
    const quote = row?.querySelector('[data-quote]')
    // Their sentence, verbatim. A clinical summary of it is a different
    // document, and this line is the only place the resident speaks on a
    // screen a manager scans.
    expect(quote?.textContent).toContain(version.currentNeeds)
  })

  it('leaves the line absent where nothing is signed, rather than filling it', async () => {
    const { container } = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(container)

    for (const domain of CARE_PLAN_DOMAINS) {
      const row = container.querySelector(`[data-domain="${domain.id}"]`)
      expect(row?.querySelector('[data-quote]'), domain.id).toBeNull()
    }
  })

  it('quotes the signed version and never the unsigned draft', async () => {
    // A draft is what somebody intends. The list says what the plan says.
    const { resident, record } = draftOverSigned
    const { container } = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(container)

    const version = currentVersion(record)
    if (version === 'none') throw new Error('expected a signed version')
    if (record.draft.kind !== 'draft') throw new Error('expected a draft')

    const quote = container
      .querySelector(`[data-domain="${record.domainId}"]`)
      ?.querySelector('[data-quote]')
    expect(quote?.textContent).toContain(version.currentNeeds)
    expect(quote?.textContent).not.toContain(record.draft.currentNeeds)
  })

  it('gives due soon no chip at all, only its date', async () => {
    /*
     * The rule this screen exists to keep: a recorded plan approaching a date
     * is the least urgent of the three unsettled states, and the one most
     * likely to crowd the two that matter. Asserted as the *absence* of the
     * treatment the other two get, because that is what would quietly return.
     */
    const { resident, record } = dueSoon
    const { container } = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(container)

    const row = container.querySelector(`[data-domain="${record.domainId}"]`)
    expect(row?.querySelector('[data-due-soon]')).toBeTruthy()
    expect(row?.querySelector('[data-state-chip]')).toBeNull()
    expect(row?.textContent).toMatch(/Signed/)
    expect(row?.textContent).toMatch(/review due/)
  })

  it('gives never written the hatch and overdue a chip, and they do not look alike', async () => {
    const never = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(never.container)
    const neverRow = never.container.querySelector(
      `[data-domain="${CARE_PLAN_DOMAINS[0]!.id}"]`,
    )
    expect(neverRow?.textContent).toMatch(/Never written/)
    expect(neverRow?.textContent).toMatch(/nobody has written what this person needs/)
    expect(neverRow?.querySelector('[data-state-chip]')).toBeNull()
    never.unmount()

    const late = renderAt(`/residents/${overdue.resident.id}/care-plan`)
    await settled(late.container)
    const lateRow = late.container.querySelector(
      `[data-domain="${overdue.record.domainId}"]`,
    )
    expect(lateRow?.querySelector('[data-state-chip]')).toBeTruthy()
    expect(lateRow?.textContent).toMatch(/Review overdue/)
    expect(lateRow?.textContent).toMatch(/last signed/)
  })

  it('renders a signed plan and a draft over it as two facts, not one', async () => {
    /*
     * The compound state, and both halves matter in opposite directions.
     * Rendered as one chip it becomes either "nothing is in force" or "this is
     * settled" — Rule 3a, on the row where a reader decides what to follow.
     */
    const { resident, record } = draftOverSigned
    const { container } = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(container)

    const row = container.querySelector(`[data-domain="${record.domainId}"]`)
    expect(row?.querySelector('[data-draft-over-signed]')).toBeTruthy()
    expect(row?.textContent).toMatch(/Signed/)
    expect(row?.textContent).toMatch(/not signed, and the signed version above/)
  })

  it('says a part-written domain is not signed, without calling it written', async () => {
    const { resident, record } = partWritten
    const { container } = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(container)

    const row = container.querySelector(`[data-domain="${record.domainId}"]`)
    expect(row?.textContent).toMatch(/Draft in progress/)
    expect(row?.textContent).toMatch(/not signed/)
    // Nothing has been signed, so there is no version number to show.
    expect(row?.textContent).not.toMatch(/Version/)
    // And it does not claim to be a gap either — the hatch means nobody looked.
    expect(row?.textContent).not.toMatch(/Never written/)
  })

  it('puts the action in its own column, leaving the gap still reading as one', async () => {
    const { container } = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(container)

    const row = container.querySelector(`[data-domain="${CARE_PLAN_DOMAINS[0]!.id}"]`)
    const action = row?.querySelector('[data-action="write"]')
    expect(action?.textContent).toMatch(/Write this domain/)
    // Separation, not proximity: the action is not inside the hatched cell.
    // Inside it, an action reads as an answer to the gap; in its own column
    // after it, as a response to one.
    expect(row?.querySelector('[data-state-cell] [data-action]')).toBeNull()
    expect(row?.querySelector('[data-state-cell]')?.textContent).toMatch(
      /Never written/,
    )
    expect(row?.textContent).toMatch(/Never written/)
  })
})

/* ------------------------------------------------------------- the editor */

describe('the domain editor', () => {
  it('opens with empty boxes even where a previous version exists', async () => {
    /*
     * The rule the screen is built around. Pre-filling last year's words turns
     * a review into a formality: the plan reads as re-agreed when nobody
     * re-agreed it, and the resident's voice becomes whatever they said the
     * first time somebody asked.
     */
    const { resident, record } = firstVersionOnly
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    for (const field of PLAN_FIELDS) {
      const box = container.querySelector<HTMLTextAreaElement>(`#field-${field.id}`)
      expect(box?.value, field.id).toBe('')
    }
  })

  it('renders the previous version beneath each box, where it can be read while writing', async () => {
    const { resident, record } = firstVersionOnly
    const version = currentVersion(record)
    if (version === 'none') throw new Error('expected a signed version')

    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    for (const field of PLAN_FIELDS) {
      const previous = container.querySelector(`[data-previous="${field.id}"]`)
      expect(previous?.textContent, field.id).toContain(version[field.id])
      expect(previous?.textContent, field.id).toContain('signed')
    }
  })

  it('opens a draft in the boxes, because that is what somebody typed', async () => {
    const { resident, record } = draftOverSigned
    if (record.draft.kind !== 'draft') throw new Error('expected a draft')

    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    const box = container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')
    expect(box?.value).toBe(record.draft.currentNeeds)
  })

  it('hatches an empty field rather than leaving it blank', async () => {
    const { resident, record } = draftOverSigned
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    const empty = PLAN_FIELDS.filter((field) => {
      const box = container.querySelector<HTMLTextAreaElement>(`#field-${field.id}`)
      return (box?.value ?? '').trim() === ''
    })
    expect(empty.length).toBeGreaterThan(0)
    for (const field of empty) {
      const cell = container.querySelector(`[data-field="${field.id}"]`)
      expect(cell?.textContent, field.id).toMatch(/Not written/)
    }
  })

  it('names each field that is outstanding, and will not finalise until none is', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, record } = firstVersionOnly
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    const finalise = container.querySelector<HTMLButtonElement>('[data-finalise]')
    expect(finalise?.disabled).toBe(true)
    for (const field of PLAN_FIELDS) {
      expect(container.textContent).toContain(field.label)
    }

    for (const field of PLAN_FIELDS) {
      const box = container.querySelector<HTMLTextAreaElement>(`#field-${field.id}`)!
      await user.type(box, 'Something this person said.')
    }

    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-finalise]')?.disabled,
      ).toBe(false),
    )
  })

  it('keeps the field labels in the voice they are written in', () => {
    // "What I need help with" became "what i need help with" under a
    // `.toLowerCase()` that looked like tidy sentence case and was removing
    // the pronoun the label exists for.
    const needs = PLAN_FIELDS.find((field) => field.id === 'currentNeeds')!
    expect(needs.label).toContain('I')
    expect(needs.voice).toBe('resident')
    expect(PLAN_FIELDS.find((field) => field.id === 'agreedActions')!.voice).toBe(
      'staff',
    )
  })

  it('names the post-incident review finalising would close, and says it will read as late', async () => {
    const { resident, domainId, incident } = owesReview
    const { container } = renderAt(`/residents/${resident.id}/care-plan/${domainId}`)
    await settled(container)

    const closes = container.querySelector(`[data-closes="${incident.id}"]`)
    expect(closes).toBeTruthy()
    // Named, not counted — and the lateness is stated before it is recorded,
    // because it is the half most likely to be lost in the doing.
    expect(closes?.textContent).toMatch(/past its 48 hours/)
    expect(closes?.textContent).toMatch(/still read as closed late/)
  })

  it('says the plan owes a review at the top, before it says anything else about it', async () => {
    const { resident, domainId } = owesReview
    const { container } = renderAt(`/residents/${resident.id}/care-plan/${domainId}`)
    await settled(container)

    const owed = container.querySelector('[data-owed]')
    expect(owed?.textContent).toMatch(/owes a post-incident review/)
  })

  it('closes the flag on finalising, and it still reads as closed late afterwards', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, domainId, incident } = owesReview
    const { container } = renderAt(`/residents/${resident.id}/care-plan/${domainId}`)
    await settled(container)

    for (const field of PLAN_FIELDS) {
      const box = container.querySelector<HTMLTextAreaElement>(`#field-${field.id}`)!
      await user.type(box, 'Something this person said.')
    }

    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-finalise]')?.disabled,
      ).toBe(false),
    )
    await user.click(container.querySelector<HTMLButtonElement>('[data-finalise]')!)

    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    // The subject is named in the sentence, never "Are you sure?" (§2.4).
    expect(dialog.textContent).toContain(resident.fullLegalName)
    await user.click(within(dialog).getByRole('button', { name: /Sign and close/i }))

    await waitFor(() => {
      const patched = patchedIncidents().find((entry) => entry.id === incident.id)!
      const flag = patched.reviewFlags.find(
        (entry) =>
          entry.target.kind === 'care_plan_domain' &&
          entry.target.domainId === domainId,
      )!
      expect(flag.state.kind).toBe('completed')
      // Derived from the record, so the work does not erase the lateness.
      expect(wasClearedLate(flag)).toBe(true)
    })

    // And the undo is a control that stays, not a five-second toast action.
    const undo = await waitFor(() => {
      const found = container.querySelector<HTMLButtonElement>('[data-undo-clearing]')
      expect(found).toBeTruthy()
      return found!
    })
    await user.click(undo)

    await waitFor(() => {
      const patched = patchedIncidents().find((entry) => entry.id === incident.id)!
      const flag = patched.reviewFlags.find(
        (entry) =>
          entry.target.kind === 'care_plan_domain' &&
          entry.target.domainId === domainId,
      )!
      expect(flag.state.kind).toBe('awaiting')
    })
  })

  it('saves a draft, and says it is not what staff follow', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, record } = firstVersionOnly
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    const box = container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')!
    await user.type(box, 'I get more tired than I did.')
    await user.click(within(container).getByRole('button', { name: /^Save draft$/i }))

    await waitFor(() => expect(document.body.textContent).toMatch(/Draft saved/))
    // A draft is not a version, and the screen says so rather than implying
    // a record staff follow was written.
    expect(document.body.textContent).toMatch(/not signed/)
  })

  it('discards a draft back to exactly what was there before', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, record } = firstVersionOnly
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    await settled(container)

    const box = container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')!
    await user.type(box, 'Something somebody started and did not finish.')
    await user.click(within(container).getByRole('button', { name: /^Save draft$/i }))
    await waitFor(() =>
      expect(container.querySelector('[data-discard-draft]')).toBeTruthy(),
    )

    await user.click(
      container.querySelector<HTMLButtonElement>('[data-discard-draft]')!,
    )
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    // A discard throws away work somebody typed, so it names the subject in
    // the sentence like every other confirmation here.
    expect(dialog.textContent).toContain(resident.fullLegalName)
    await user.click(within(dialog).getByRole('button', { name: /Discard draft/i }))

    await waitFor(() => {
      expect(container.querySelector('[data-discard-draft]')).toBeNull()
      expect(
        container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')?.value,
      ).toBe('')
    })
    // The signed version underneath is untouched.
    const version = currentVersion(record)
    if (version === 'none') throw new Error('expected a signed version')
    expect(
      container.querySelector('[data-previous="currentNeeds"]')?.textContent,
    ).toContain(version.currentNeeds)
  })

  it('makes a never-written domain read as part-written, not as never written', async () => {
    /*
     * The point of the store: a state reachable only from a fixture is one
     * nobody can get to by doing the work.
     */
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const domain = nothingWritten.carePlan[0]!
    const { container } = renderAt(
      `/residents/${nothingWritten.id}/care-plan/${domain.domainId}`,
    )
    await settled(container)

    const box = container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')!
    await user.type(box, 'I can manage most of it myself.')
    await user.click(within(container).getByRole('button', { name: /^Save draft$/i }))
    await waitFor(() => expect(document.body.textContent).toMatch(/Draft saved/))

    const list = renderAt(`/residents/${nothingWritten.id}/care-plan`)
    await settled(list.container)
    const row = list.container.querySelector(`[data-domain="${domain.domainId}"]`)
    expect(row?.textContent).toMatch(/Draft in progress/)
    expect(row?.textContent).toMatch(/not signed/)
    expect(row?.textContent).not.toMatch(/Never written/)
    // And the figure it is counted in moves with it, because it is no longer
    // true that nobody has written anything here.
    const lead = list.container.querySelector('[data-never-written]')
    expect(lead?.getAttribute('data-never-written')).toBe(
      String(nothingWritten.carePlan.length - 1),
    )
  })

  it('makes the signed-plus-draft state reachable by doing the work', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, record } = firstVersionOnly
    const editor = renderAt(`/residents/${resident.id}/care-plan/${record.domainId}`)
    await settled(editor.container)

    const box =
      editor.container.querySelector<HTMLTextAreaElement>('#field-currentNeeds')!
    await user.type(box, 'I get more tired than I did.')
    await user.click(
      within(editor.container).getByRole('button', { name: /^Save draft$/i }),
    )
    await waitFor(() => expect(document.body.textContent).toMatch(/Draft saved/))
    editor.unmount()

    const list = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(list.container)
    const row = list.container.querySelector(`[data-domain="${record.domainId}"]`)
    // Two facts: the instruction staff follow today, and the rewrite nobody
    // has signed.
    expect(row?.querySelector('[data-draft-over-signed]')).toBeTruthy()
    expect(row?.textContent).toMatch(/Signed/)
  })

  it('signs a version, consumes the draft, and undoes both together', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { resident, domainId, incident } = owesReview
    const before = residents
      .find((entry) => entry.id === resident.id)!
      .carePlan.find((entry) => entry.domainId === domainId)!
    const versionsBefore =
      before.versions.kind === 'finalised' ? before.versions.history.length : 0

    const { container } = renderAt(`/residents/${resident.id}/care-plan/${domainId}`)
    await settled(container)

    for (const field of PLAN_FIELDS) {
      const box = container.querySelector<HTMLTextAreaElement>(`#field-${field.id}`)!
      await user.type(box, `Written for ${field.id}.`)
    }
    await user.click(within(container).getByRole('button', { name: /^Save draft$/i }))
    await waitFor(() => expect(document.body.textContent).toMatch(/Draft saved/))

    await user.click(container.querySelector<HTMLButtonElement>('[data-finalise]')!)
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    await user.click(within(dialog).getByRole('button', { name: /Sign and close/i }))

    await waitFor(() => {
      // The draft became the version, so it is not still sitting on top of it.
      expect(container.querySelector('[data-discard-draft]')).toBeNull()
      expect(container.querySelector('[data-history-link]')?.textContent).toContain(
        String(versionsBefore + 1),
      )
    })

    const history = renderAt(`/residents/${resident.id}/care-plan/${domainId}/history`)
    await settled(history.container)
    expect(
      history.container.querySelector(`[data-version="${versionsBefore + 1}"]`),
    ).toBeTruthy()
    expect(history.container.textContent).toContain('Written for currentNeeds.')
    history.unmount()

    // One act, one undo. Half an undo would leave the record holding a
    // version nobody signed, or an obligation met by work that no longer
    // exists.
    await user.click(
      container.querySelector<HTMLButtonElement>('[data-undo-clearing]')!,
    )
    await waitFor(() => {
      const patched = patchedIncidents().find((entry) => entry.id === incident.id)!
      const flag = patched.reviewFlags.find(
        (entry) =>
          entry.target.kind === 'care_plan_domain' &&
          entry.target.domainId === domainId,
      )!
      expect(flag.state.kind).toBe('awaiting')
      expect(container.querySelector('[data-history-link]')?.textContent).toContain(
        String(versionsBefore),
      )
      // And the draft it consumed is back, not lost.
      expect(container.querySelector('[data-discard-draft]')).toBeTruthy()
    })
  }, 20000)
})

/* ------------------------------------------------------- version history */

describe('version history and the diff', () => {
  it('renders the hatched note for version 1, never an empty comparison', async () => {
    const { resident, record } = firstVersionOnly
    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}/history`,
    )
    await settled(container)

    const note = container.querySelector('[data-no-previous]')
    expect(note?.textContent).toMatch(/No previous version/)
    // An empty left column would say "this used to say nothing", which is a
    // claim about a plan that did not exist.
    expect(container.querySelector('[data-was]')).toBeNull()
  })

  it('renders an unchanged field once, full width, labelled unchanged', async () => {
    const { resident, record } = unchangedInDiff
    if (record.versions.kind !== 'finalised') throw new Error('expected versions')
    const [was, now] = record.versions.history.slice(-2)
    const comparison = compareVersions(was!, now!)

    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}/history`,
    )
    await settled(container)

    for (const entry of comparison) {
      const cell = container.querySelector(`[data-diff="${entry.field.id}"]`)
      if (entry.changed) {
        expect(cell?.querySelector('[data-was]'), entry.field.id).toBeTruthy()
        expect(cell?.querySelector('[data-now]'), entry.field.id).toBeTruthy()
      } else {
        // Twice in two columns would read as a change that happens to match.
        expect(cell?.querySelector('[data-unchanged]'), entry.field.id).toBeTruthy()
        expect(cell?.querySelector('[data-was]'), entry.field.id).toBeNull()
        expect(cell?.textContent, entry.field.id).toMatch(/Unchanged/)
      }
    }
  })

  it('names which fields changed rather than counting them', async () => {
    const { resident, record } = unchangedInDiff
    if (record.versions.kind !== 'finalised') throw new Error('expected versions')
    const [was, now] = record.versions.history.slice(-2)
    const changed = compareVersions(was!, now!).filter((entry) => entry.changed)

    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}/history`,
    )
    await settled(container)

    const row = container.querySelector(
      `[data-version="${record.versions.history.length}"]`,
    )
    for (const entry of changed) {
      expect(row?.textContent, entry.field.id).toContain(entry.field.label)
    }
  })

  it('never shows a draft in the history', async () => {
    const { resident, record } = draftOverSigned
    if (record.draft.kind !== 'draft') throw new Error('expected a draft')

    const { container } = renderAt(
      `/residents/${resident.id}/care-plan/${record.domainId}/history`,
    )
    await settled(container)

    // A history of intentions is not a history of instructions. Nobody
    // followed this, so it was never something staff were told to do.
    expect(container.textContent).not.toContain(record.draft.currentNeeds)
    const rows = container.querySelectorAll('[data-version]')
    expect(rows.length).toBe(
      record.versions.kind === 'finalised' ? record.versions.history.length : 0,
    )
  })

  it('says plainly where nothing has ever been signed', async () => {
    const domain = nothingWritten.carePlan[0]!
    const { container } = renderAt(
      `/residents/${nothingWritten.id}/care-plan/${domain.domainId}/history`,
    )
    await settled(container)

    const empty = container.querySelector('[data-no-versions]')
    expect(empty?.textContent).toMatch(/No version has ever been signed/)
    expect(empty?.textContent).toContain(nothingWritten.fullLegalName)
  })
})

/* ------------------------------------------------------------ reachability */

describe('every screen can be reached, and every route has a way in', () => {
  it('gives the care plan a profile tab pointing at a registered route', () => {
    const tab = TABS.find((entry) => entry.path === 'care-plan')
    expect(tab?.built).toBe(true)

    // Found by what it is, not by where it sits: the shell stopped being the
    // first route when the authentication screens landed outside it.
    const shell = appRouter.routes.find(
      (route) => route.path === '/' && (route.children?.length ?? 0) > 0,
    )
    const profile = shell?.children?.find(
      (child) => child.path === 'residents/:residentId',
    )
    const paths = profile?.children?.map((child) => child.path) ?? []
    // Both directions: a route with no tab is unreachable, and a tab pointing
    // at nothing is a dead link. Same defect from opposite ends (§8).
    expect(paths).toContain('care-plan')
    expect(paths).toContain('care-plan/:domainId')
    expect(paths).toContain('care-plan/:domainId/history')
  })

  it('reaches the editor from a row, and the history from the editor', async () => {
    const { resident, record } = firstVersionOnly
    const list = renderAt(`/residents/${resident.id}/care-plan`)
    await settled(list.container)

    const row = list.container.querySelector(`[data-domain="${record.domainId}"]`)
    const link = row?.querySelector('a')
    expect(link?.getAttribute('href')).toBe(
      `/residents/${resident.id}/care-plan/${record.domainId}`,
    )
    list.unmount()

    const editor = renderAt(`/residents/${resident.id}/care-plan/${record.domainId}`)
    await settled(editor.container)
    const history = editor.container.querySelector('[data-history-link]')
    expect(history?.getAttribute('href')).toBe(
      `/residents/${resident.id}/care-plan/${record.domainId}/history`,
    )
  })

  it('links to the history even where nothing has been signed', async () => {
    /*
     * The state that would otherwise be routed, rendered, tested and
     * unreachable — which is not built, however green its tests are.
     */
    const domain = nothingWritten.carePlan[0]!
    const { container } = renderAt(
      `/residents/${nothingWritten.id}/care-plan/${domain.domainId}`,
    )
    await settled(container)

    const history = container.querySelector('[data-history-link]')
    expect(history?.getAttribute('href')).toBe(
      `/residents/${nothingWritten.id}/care-plan/${domain.domainId}/history`,
    )
    expect(history?.textContent).toMatch(/nothing signed yet/)
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the domain list', async () => {
    await check(`/residents/${overdue.resident.id}/care-plan`)
  }, 20000)

  it('has no violations on the editor', async () => {
    await check(
      `/residents/${firstVersionOnly.resident.id}/care-plan/${firstVersionOnly.record.domainId}`,
    )
  }, 20000)

  it('has no violations on the version history', async () => {
    await check(
      `/residents/${unchangedInDiff.resident.id}/care-plan/${unchangedInDiff.record.domainId}/history`,
    )
  }, 20000)
})

/** Every domain id used above is one the constant declares. */
const declared = new Set<CarePlanDomainId>(CARE_PLAN_DOMAINS.map((domain) => domain.id))
describe('the subjects these tests are built on', () => {
  it('are all real domains', () => {
    for (const entry of [
      draftOverSigned,
      partWritten,
      overdue,
      dueSoon,
      firstVersionOnly,
    ])
      expect(declared.has(entry.record.domainId)).toBe(true)
    expect(declared.has(owesReview.domainId)).toBe(true)
  })
})
