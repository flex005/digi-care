import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { IsoDateTime } from '@/data/types'
import { GAP_INCIDENT_IDS, incidentById, incidents } from '@/data/fixtures/incidents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { IncidentDetailRoute } from './IncidentDetailRoute'
import { outstandingDecisions } from './decisions'
import {
  clearReviewFlags,
  patchedIncidents,
  resetSessionReviewFlags,
} from '@/data/access/review-flag-store'
import { subjectResidentId } from '@/data/types'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { wasClearedLate } from '@/data/access/review-flags'

/**
 * One incident. PRD §6.5.
 *
 * The screen's argument is structural: **outstanding decisions above the
 * facts**, because a manager should see what is owed before what happened. The
 * two rules carried from earlier phases are the other half — an obligation
 * with nothing against it renders unsettled, and a review flag has no control
 * that clears it without the work.
 */

const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

function renderDetail(id: string) {
  const router = createMemoryRouter(
    [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
    { initialEntries: [`/incidents/${id}`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const loaded = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())
  return container
}

describe('what is owed comes before what happened', () => {
  it('puts the outstanding block above the facts', async () => {
    const { container } = renderDetail(
      GAP_INCIDENT_IDS.closedWithoutNotificationDecision,
    )
    await loaded(container)

    const outstanding = container.querySelector('[data-outstanding]')!
    const facts = container.querySelector('[class*="facts"]')!
    expect(outstanding, 'no outstanding block on an incident with a gap').toBeTruthy()

    // Structural, not a heading further down: a manager opening this should
    // read what is owed before they read the account.
    expect(
      outstanding.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('does not render the block at all when nothing is outstanding', async () => {
    const settled = incidents.find(
      (incident) => outstandingDecisions(incident, NOW_ISO).length === 0,
    )
    expect(settled, 'no incident in the set has nothing outstanding').toBeTruthy()

    const { container } = renderDetail(settled!.id)
    await loaded(container)

    // An empty version would be a claim — "nothing is owed" — drawn in the
    // treatment reserved for gaps. The absence is safe only because everything
    // it would have listed is stated in full below.
    expect(container.querySelector('[data-outstanding]')).toBeNull()
    expect(container.querySelector('[class*="facts"]')).toBeTruthy()
  })

  it('counts what is owed in words, and names each one', async () => {
    const incident = incidentById(GAP_INCIDENT_IDS.notificationRequiredNeverMade)!
    const expected = outstandingDecisions(incident, NOW_ISO)

    const { container } = renderDetail(incident.id)
    await loaded(container)

    const block = container.querySelector('[data-outstanding]')!
    expect(block.getAttribute('data-outstanding')).toBe(String(expected.length))
    for (const decision of expected) {
      expect(block.textContent, decision.name).toContain(decision.name)
    }
  })

  it('names the phase on anything that cannot be done yet', async () => {
    const withFlag = incidents.find((incident) =>
      incident.reviewFlags.some((flag) => flag.state.kind === 'awaiting'),
    )!
    const { container } = renderDetail(withFlag.id)
    await loaded(container)

    // Same honesty as the export stub: a control that clears a clinical
    // obligation without the work records a review that did not happen.
    const deferred = [...container.querySelectorAll('[data-decision^="flag-"] button')]
    expect(deferred.length).toBeGreaterThan(0)
    for (const button of deferred) {
      expect(button).toBeDisabled()
      expect(button.textContent).toMatch(/Phase \d/)
    }
  })
})

describe('an obligation with nothing against it is not settled', () => {
  it('renders “required, not yet notified” as a gap', async () => {
    const { container } = renderDetail(GAP_INCIDENT_IDS.notificationRequiredNeverMade)
    await loaded(container)

    const block = container.querySelector(
      '[data-notification="required_not_yet_notified"]',
    )!
    expect(block).toBeTruthy()
    // The PRN-with-no-maximum shape: a duty accepted and not discharged.
    expect(block.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(block.textContent).toMatch(/nothing in the record to show that it was/)
  })

  it('renders an undecided notification as a gap too', async () => {
    const { container } = renderDetail(
      GAP_INCIDENT_IDS.closedWithoutNotificationDecision,
    )
    await loaded(container)

    const block = container.querySelector('[data-notification="not_yet_decided"]')!
    expect(block.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(block.textContent).toMatch(/cannot be closed until one exists/)
  })

  it('renders a notified decision settled, with a name and a reference', async () => {
    const notified = incidents.find(
      (incident) => incident.notification.kind === 'notified',
    )!
    const { container } = renderDetail(notified.id)
    await loaded(container)

    const block = container.querySelector('[data-notification="notified"]')!
    // Settled means no hatch — and a name, a date and a reference behind it.
    expect(block.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(block.textContent).toMatch(/Reference/)
    expect(block.textContent).toMatch(/notified by/)
  })

  it('renders “not required” settled, with the reason somebody gave', async () => {
    const notRequired = incidents.find(
      (incident) => incident.notification.kind === 'not_required',
    )!
    const { container } = renderDetail(notRequired.id)
    await loaded(container)

    const block = container.querySelector('[data-notification="not_required"]')!
    expect(block.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(block.textContent).toMatch(/Decided by/)
  })
})

describe('review flags', () => {
  it('has no control that marks one as reviewed', async () => {
    const withFlags = incidents.find((incident) => incident.reviewFlags.length > 0)!
    const { container } = renderDetail(withFlags.id)
    await loaded(container)

    // Clearing a flag means doing the work. Anywhere on the screen.
    for (const button of container.querySelectorAll('button')) {
      expect(button.textContent ?? '').not.toMatch(/mark as reviewed/i)
    }
  })

  it('names what would clear an open flag and the phase that builds it', async () => {
    const withOpen = incidents.find((incident) =>
      incident.reviewFlags.some((flag) => flag.state.kind === 'awaiting'),
    )!
    const { container } = renderDetail(withOpen.id)
    await loaded(container)

    const open = container.querySelector(
      '[data-flag="overdue"], [data-flag="awaiting"]',
    )!
    expect(open.textContent).toMatch(/Phase [56]/)
    expect(open.textContent).toMatch(/Cleared by/)
  })

  it('renders a completed flag quietly, not as a green pill', async () => {
    const withDone = incidents.find((incident) =>
      incident.reviewFlags.some((flag) => flag.state.kind === 'completed'),
    )!
    const { container } = renderDetail(withDone.id)
    await loaded(container)

    const done = container.querySelector('[data-flag="completed"]')!
    // Settled and quiet (§3b) — a column of green would drown the ones that
    // are not done.
    expect(done.className).toMatch(/flagDone/)
    expect(done.textContent).toMatch(/done/)
  })
})

describe('the two accounts stay apart', () => {
  it("puts the reporter's words under the reporter's byline", async () => {
    const { container } = renderDetail(GAP_INCIDENT_IDS.notificationRequiredNeverMade)
    const incident = incidentById(GAP_INCIDENT_IDS.notificationRequiredNeverMade)!
    await loaded(container)

    const sections = [...container.querySelectorAll('section')]
    const reporter = sections.find((section) =>
      section.textContent?.startsWith('What the reporter recorded'),
    )!
    const manager = sections.find((section) =>
      section.textContent?.startsWith('Manager review'),
    )!

    // Two records by two people. Merging them attributes one to the other.
    expect(reporter.textContent).toContain(incident.description)
    expect(reporter.textContent).toContain(incident.reported.by.displayName)
    expect(manager.textContent).not.toContain(incident.description)
    expect(manager.textContent).not.toContain(incident.response.immediateAction)
  })

  it('shows an unrecorded review field as a gap rather than as blank', async () => {
    const partial = incidents.find(
      (incident) =>
        incident.review.actionsTaken.kind === 'recorded' &&
        incident.review.rootCause.kind === 'unrecorded',
    )!
    const { container } = renderDetail(partial.id)
    await loaded(container)

    const gaps = container.querySelectorAll('[data-state="unrecorded"]')
    expect(gaps.length).toBeGreaterThan(0)
    expect(container.textContent).toMatch(/nobody has written root cause down/)
  })
})

describe('the subject strip', () => {
  it('never renders empty where no resident was involved', async () => {
    const nobody = incidents.find(
      (incident) => incident.subject.kind === 'no_resident_involved',
    )!
    const { container } = renderDetail(nobody.id)
    await loaded(container)

    const strip = container.querySelector('[data-subject="none"]')!
    expect(strip.textContent).toMatch(/No resident was involved/)
    // A claim somebody made, carrying their name — not an empty strip.
    expect(strip.textContent).toMatch(/Recorded by/)
  })

  it('carries the allergy in all three states, never conditionally', async () => {
    const withResident = incidents.find(
      (incident) => incident.subject.kind === 'resident',
    )!
    const { container } = renderDetail(withResident.id)
    await loaded(container)

    const strip = container.querySelector('[data-subject]')!
    expect(strip.textContent).toMatch(
      /Allerg|No known allergies|not recorded|Not recorded/i,
    )
  })
})

describe('injury, read-only', () => {
  it('renders no map and says so where nobody checked', async () => {
    const { container } = renderDetail(GAP_INCIDENT_IDS.noInjuryCheckRecorded)
    await loaded(container)

    expect(container.querySelector('[data-body-map]')).toBeNull()
    expect(container.textContent).toMatch(/Nobody checked for injury/)
    expect(container.textContent).toMatch(/not the same as no injury found/)
  })

  it('renders the map as a diagram, not as controls', async () => {
    const marked = incidents.find((incident) => incident.injuries.kind === 'marked')!
    const { container } = renderDetail(marked.id)
    await loaded(container)

    const regions = container.querySelectorAll('[data-region]')
    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) {
      // Nobody is marking anything here, and a tab stop on every region would
      // be thirty-six stops through a diagram that does nothing.
      expect(region.getAttribute('role')).toBeNull()
      expect(region.getAttribute('tabindex')).toBeNull()
    }

    // The sites are still listed as text, which is the record.
    expect(container.querySelectorAll('[data-site]').length).toBeGreaterThan(0)
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderDetail(
      GAP_INCIDENT_IDS.closedWithoutNotificationDecision,
    )
    await loaded(container)
    expect((await axe(container)).violations).toEqual([])
  }, 60000)

  it('titles the screen with the incident type, not its reference', async () => {
    const incident = incidentById(GAP_INCIDENT_IDS.closedWithoutNotificationDecision)!
    const { container } = renderDetail(incident.id)
    await loaded(container)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Choking')
    expect(heading.textContent).not.toContain(incident.id)
    // The reference is still on the page, one line down.
    expect(container.textContent).toContain(incident.id.toUpperCase())
  })
})

describe('the outstanding block responds to work being done elsewhere', () => {
  afterEach(() => resetSessionReviewFlags())

  /**
   * An incident owing a risk-assessment review, and the template it owes.
   *
   * Derived rather than named. The first version of these tests hardcoded
   * `falls` and returned early when nothing matched — which made two of the
   * three vacuous, including the one written for the branch nobody had
   * exercised. Probing the fixtures found it before the suite could go green
   * on nothing (§8).
   */
  const owingReview = (mustBeLate = false) => {
    for (const incident of patchedIncidents()) {
      for (const flag of incident.reviewFlags) {
        if (flag.state.kind !== 'awaiting') continue
        if (flag.target.kind !== 'risk_assessment') continue
        if (mustBeLate && flag.dueBy >= NOW_ISO) continue
        return {
          incident,
          templateId: flag.target.templateId,
          residentId: subjectResidentId(incident) as never,
        }
      }
    }
    return undefined
  }

  it('has a fixture owing a review, and one owing a late review', () => {
    expect(owingReview(), 'no incident owes a risk-assessment review').toBeTruthy()
    expect(owingReview(true), 'no incident owes a late one').toBeTruthy()
  })

  it('shows one fewer thing owed once a re-score clears a review', async () => {
    const subject = owingReview()!
    const before = outstandingDecisions(subject.incident, NOW_ISO).length

    clearReviewFlags({
      residentId: subject.residentId,
      target: { kind: 'risk_assessment', templateId: subject.templateId },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = patchedIncidents().find((entry) => entry.id === subject.incident.id)!
    // The incident screen was asserting this was owed. It is not any more —
    // an obligation that has been met still rendering as outstanding is the
    // invariant failing in the mirror.
    expect(outstandingDecisions(after, NOW_ISO).length).toBe(before - 1)
  })

  it('renders one fewer item on the screen, not only in the derivation', async () => {
    const subject = owingReview()!
    const { container } = renderDetail(subject.incident.id)
    await loaded(container)
    const before = container.querySelectorAll('[data-decision]').length

    clearReviewFlags({
      residentId: subject.residentId,
      target: { kind: 'risk_assessment', templateId: subject.templateId },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = renderDetail(subject.incident.id)
    await loaded(after.container)
    expect(after.container.querySelectorAll('[data-decision]').length).toBe(before - 1)
  })

  /**
   * **A re-score alone cannot empty the block, and that is correct.**
   *
   * Every flagged incident in the fixtures owes something a re-score does not
   * touch: a care plan domain review, which arrives in Phase 6, or a root
   * cause nobody recorded. Clearing one obligation of two does not empty a
   * list, so the emptying branch is not reachable from this flow until Phase 6
   * exists.
   *
   * The branch itself is covered — an incident with nothing outstanding
   * renders no block, tested above. What is not reachable yet is arriving
   * there *by doing the work*, and pretending otherwise would need a fixture
   * built to make a test pass.
   */
  it('leaves the block standing while something else is still owed', async () => {
    const subject = owingReview()!
    clearReviewFlags({
      residentId: subject.residentId,
      target: { kind: 'risk_assessment', templateId: subject.templateId },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const after = patchedIncidents().find((entry) => entry.id === subject.incident.id)!
    const remaining = outstandingDecisions(after, NOW_ISO)
    expect(remaining.length).toBeGreaterThan(0)

    const { container } = renderDetail(subject.incident.id)
    await loaded(container)
    expect(container.querySelector('[data-outstanding]')).toBeTruthy()
  })

  it('shows the cleared review as done, and late where it was late', async () => {
    const subject = owingReview(true)!
    clearReviewFlags({
      residentId: subject.residentId,
      target: { kind: 'risk_assessment', templateId: subject.templateId },
      by: staffOkonkwo,
      at: NOW_ISO,
    })

    const { container } = renderDetail(subject.incident.id)
    await loaded(container)

    const done = container.querySelector('[data-flag="completed"]')
    expect(done, 'the cleared flag does not read as completed').toBeTruthy()
    expect(done!.textContent).toMatch(/done/)

    // Doing the work does not make it on time.
    const flag = patchedIncidents()
      .find((entry) => entry.id === subject.incident.id)!
      .reviewFlags.find(
        (entry) =>
          entry.target.kind === 'risk_assessment' &&
          entry.target.templateId === subject.templateId,
      )!
    expect(wasClearedLate(flag)).toBe(true)
  })
})
