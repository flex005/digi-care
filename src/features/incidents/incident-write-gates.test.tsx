import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { incidents } from '@/data/fixtures/incidents'
import { resetSessionIncidents } from '@/data/access/incident-store'
import { IncidentDetailRoute } from './IncidentDetailRoute'
import { IncidentLogRoute } from './IncidentLogRoute'
import { ReportIncidentRoute } from './ReportIncidentRoute'

/**
 * Who may write to an incident, asked of every control that writes to one.
 *
 * **This exists because three of them were asking nobody.** `UrgencySection`,
 * `FamilyDecision` and `ReportIncidentRoute` each wrote to a clinical record
 * with no permission check, while `ManagerReviewForm` on the same page had
 * one. So an `auditor` — a CQC inspector or external reviewer, told on five
 * screens that they read — could raise an urgency, decide whether a
 * resident's family were told, and file a whole incident.
 *
 * That is the product breaking a refusal it states out loud, which is the §8
 * entry about a refusal resting on something that moved. Nothing had moved
 * here; the refusal was simply never enforced on these three.
 *
 * **Both polarities, per role**, because a gate that refuses everybody looks
 * exactly like a gate that works until somebody who should be able to act
 * tries to. And the *state* must stay readable throughout: what is gated is
 * the act, not the record.
 */
afterEach(() => {
  resetSessionIncidents()
})

/*
 * **Chosen by what the test needs, not by position.** `incidents[0]` was the
 * subject here, and the list is sorted by a date computed relative to `now` —
 * so which incident is first changes as the day turns. It became `inc-903`
 * once that fixture gained a stood-down urgency, and `UrgencySection`
 * correctly offers no raise control on one, so these tests passed by day and
 * failed after midnight. §8's rule about anything deriving from `now`, where
 * the `now` is in the fixture rather than the assertion.
 */
const subject = incidents.find(
  (one) =>
    one.siteId === 'site-rosewood-court' &&
    one.urgency.kind === 'ordinary' &&
    one.subject.kind === 'resident',
)!

/** `record` or better at `/incidents`, straight off the permission table. */
const MAY_WRITE: StaffRole[] = [
  'registered_manager',
  'deputy_manager',
  'senior_carer',
  'care_worker',
]
/*
 * **Only `auditor`, and that is a finding rather than a shortcut.**
 * `activities_coordinator` is `read` at `/incidents` in the same table, and
 * no member of staff with access holds it — `SignInAs` refuses outright:
 * "no test can render the product as one". So the read-only half of this
 * table has exactly one reachable role, and a permission written for the
 * other is enforced by nothing anybody can observe. Left as it is and
 * recorded, because adding staff to the fixtures is not this change.
 */
const MAY_NOT_WRITE: StaffRole[] = ['auditor']

function renderAt(role: StaffRole, path: string, element: React.ReactElement) {
  const router = createMemoryRouter([{ path, element }], {
    initialEntries: [path.replace(':incidentId', subject.id)],
  })
  return render(
    <SessionProvider>
      <TooltipProvider>
        <SignInAs as={role} />
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const detail = (role: StaffRole) =>
  renderAt(role, '/incidents/:incidentId', <IncidentDetailRoute />)

describe('raising an urgency', () => {
  it.each(MAY_NOT_WRITE)('is refused for %s, and says why', async (role) => {
    const { container } = detail(role)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    expect(container.querySelector('[data-urgency-raise]')).toBeNull()
    expect(container.querySelector('[data-urgency-reason]')).toBeNull()

    const refusal = container.querySelector('[data-urgency-read-only]')
    expect(refusal).toBeTruthy()
    expect(refusal!.textContent).toContain('does not say')

    // The state is still readable. Gating the act must not hide the record.
    expect(container.querySelector('[data-urgency-state]')).toBeTruthy()
  })

  it.each(MAY_WRITE)('is offered to %s', async (role) => {
    const { container } = detail(role)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    expect(container.querySelector('[data-urgency-raise]')).toBeTruthy()
    expect(container.querySelector('[data-urgency-read-only]')).toBeNull()
  })
})

describe('deciding whether the family are told', () => {
  it.each(MAY_NOT_WRITE)('is refused for %s, and says why', async (role) => {
    const { container } = detail(role)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    expect(container.querySelector('[data-family-should]')).toBeNull()
    expect(container.querySelector('[data-family-not]')).toBeNull()
    expect(container.querySelector('[data-family-reason]')).toBeNull()

    const refusal = container.querySelector('[data-family-read-only]')
    expect(refusal).toBeTruthy()
    expect(refusal!.textContent).toContain('does not decide')

    expect(container.querySelector('[data-family-state]')).toBeTruthy()
    // The instruction to telephone them is not a write, and still shows.
    expect(container.querySelector('[data-nothing-sent]')).toBeTruthy()
  })

  it.each(MAY_WRITE)('is offered to %s', async (role) => {
    const { container } = detail(role)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    expect(container.querySelector('[data-family-should]')).toBeTruthy()
    expect(container.querySelector('[data-family-read-only]')).toBeNull()
  })
})

/**
 * Nothing in `routes.tsx` guards a route by permission level, so every screen
 * is reachable by typing its URL. Hiding the link is therefore not a gate.
 */
describe('filing an incident', () => {
  it.each(MAY_NOT_WRITE)('refuses %s at the route, not just the link', async (role) => {
    const { container } = renderAt(role, '/incidents/new', <ReportIncidentRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-report-read-only]')).toBeTruthy()
    })
    // The form itself is not there to be filled in and submitted. Paired
    // with the positive case below, which asserts this same control IS
    // present for a role that may file one — a "not there" on a selector
    // that is never there would assert nothing at all.
    expect(container.querySelector('[data-report-submit]')).toBeNull()
  })

  it.each(MAY_WRITE)('lets %s reach the form', async (role) => {
    const { container } = renderAt(role, '/incidents/new', <ReportIncidentRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-report-read-only]')).toBeNull()
    })
    expect(container.querySelector('[data-report-submit]')).toBeTruthy()
  })

  it.each(MAY_NOT_WRITE)('does not offer %s the link on the log', async (role) => {
    const { container } = renderAt(role, '/incidents', <IncidentLogRoute />)
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy())
    expect(container.querySelector('a[href="/incidents/new"]')).toBeNull()
  })

  it.each(MAY_WRITE)('offers %s the link on the log', async (role) => {
    const { container } = renderAt(role, '/incidents', <IncidentLogRoute />)
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy())
    expect(container.querySelector('a[href="/incidents/new"]')).toBeTruthy()
  })
})
