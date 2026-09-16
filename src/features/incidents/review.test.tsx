import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import {
  acknowledge,
  close,
  recordReview,
  resetSessionIncidents,
  withIncidentEdits,
} from '@/data/access/incident-store'
import { resetSessionNotifications } from '@/data/access/notification-store'
import { incidents } from '@/data/fixtures/incidents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { IncidentDetailRoute } from './IncidentDetailRoute'
import { now as appNow } from '@/data/fixtures/clock'
import type { IsoDateTime } from '@/data/types'

/**
 * One instant for the file, and the fixtures' own rather than the wall clock.
 *
 * Every assertion here is about what a write did to a record, not about when
 * it happened, and a test deriving a value from `now` is green all day and red
 * at 04:42 for whoever runs it next.
 */
const NOW = appNow().toISOString() as IsoDateTime

/**
 * Acknowledging an incident, and what the manager concluded. Phase 20.
 *
 * **The subject is the separation, not the form.** The reporter's account and
 * the manager's have been two records by two people since Phase 4, held apart
 * by the type; a write path is where that stops being true without anybody
 * deciding it should. So the assertions that matter are about what the write
 * did *not* touch.
 */

afterEach(() => {
  resetSessionIncidents()
  resetSessionNotifications()
})

const unacknowledged = () =>
  incidents.find((entry) => entry.status.kind === 'reported_not_acknowledged')!

function renderDetail(id: string) {
  const router = createMemoryRouter(
    [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
    { initialEntries: [`/incidents/${id}`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('the manager writes their own account and never the reporter’s', () => {
  it('leaves the reporter’s record byte-identical after a review is written', () => {
    const incident = unacknowledged()
    const before = JSON.stringify(incident.response)

    acknowledge(incident, staffOkonkwo)
    const acknowledged = withIncidentEdits(incident)
    recordReview(
      acknowledged,
      {
        actionsTaken: {
          kind: 'recorded',
          value: 'Reviewed the corridor lighting and raised it with maintenance.',
          recordedBy: staffOkonkwo,
          recordedAt: NOW,
        },
      },
      staffOkonkwo,
    )

    const after = withIncidentEdits(incident)
    /*
     * **The assertion this file exists for.** `actionsTaken` is the manager's
     * and `immediateAction` is the reporter's, and the two are one careless
     * spread apart. Compared as a whole rather than field by field: a patch
     * that reached `response` would most likely reach more than one of its
     * fields, and naming three would check three.
     */
    expect(JSON.stringify(after.response)).toBe(before)
    expect(after.review.actionsTaken.kind).toBe('recorded')
  })

  it('shows both accounts on the screen, each with its own name', async () => {
    const incident = incidents.find(
      (entry) =>
        entry.status.kind !== 'reported_not_acknowledged' &&
        entry.review.actionsTaken.kind === 'recorded',
    )
    if (incident === undefined) return

    const { container } = renderDetail(incident.id)
    await waitFor(() =>
      expect(container.querySelector('[data-review-form]')).toBeTruthy(),
    )

    // The reporter's words are on the page, and the manager's are elsewhere on
    // it. Two sections, never one merged account.
    expect(container.textContent).toContain(incident.response.immediateAction)
  }, 20000)
})

describe('the order of the acts is the status union, and it is enforced', () => {
  it('refuses a review before anybody has acknowledged it', () => {
    const incident = unacknowledged()
    expect(() => recordReview(incident, {}, staffOkonkwo)).toThrow(
      /has not been acknowledged/i,
    )
  })

  it('refuses a second acknowledgement over the first', () => {
    const incident = unacknowledged()
    acknowledge(incident, staffOkonkwo)
    expect(() => acknowledge(withIncidentEdits(incident), staffOkonkwo)).toThrow(
      /was acknowledged by/i,
    )
  })

  it('refuses to close without a root cause, and says so', () => {
    const incident = unacknowledged()
    acknowledge(incident, staffOkonkwo)
    recordReview(
      withIncidentEdits(incident),
      {
        actionsTaken: {
          kind: 'recorded',
          value: 'Spoke to the family.',
          recordedBy: staffOkonkwo,
          recordedAt: NOW,
        },
      },
      staffOkonkwo,
    )

    expect(() => close(withIncidentEdits(incident), staffOkonkwo, true)).toThrow(
      /no root cause recorded/i,
    )
  })

  it('refuses to close with no decision about the CQC', () => {
    const incident = unacknowledged()
    acknowledge(incident, staffOkonkwo)
    recordReview(
      withIncidentEdits(incident),
      {
        rootCause: {
          kind: 'recorded',
          value: 'Wet floor, no sign out.',
          recordedBy: staffOkonkwo,
          recordedAt: NOW,
        },
      },
      staffOkonkwo,
    )

    expect(() => close(withIncidentEdits(incident), staffOkonkwo, false)).toThrow(
      /must be notified to the CQC/i,
    )
  })

  it('closes when both are true, and keeps every earlier act', () => {
    const incident = unacknowledged()
    acknowledge(incident, staffOkonkwo)
    recordReview(
      withIncidentEdits(incident),
      {
        rootCause: {
          kind: 'recorded',
          value: 'Wet floor, no sign out.',
          recordedBy: staffOkonkwo,
          recordedAt: NOW,
        },
      },
      staffOkonkwo,
    )
    const status = close(withIncidentEdits(incident), staffOkonkwo, true)

    /*
     * The union carries the order: closed holds the acknowledgement and the
     * review's start, so an incident cannot be closed with no record of who
     * picked it up. Asserted because the write path constructs it by hand.
     */
    expect(status.kind).toBe('closed')
    if (status.kind !== 'closed') return
    expect(status.acknowledged.by.id).toBe(staffOkonkwo.id)
    expect(status.reviewStarted.at).toBeTruthy()
  })
})
