import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import {
  activitiesAt,
  cancelSession,
  planSession,
  resetSessionActivities,
  withActivityEdits,
} from '@/data/access/activity-store'
import { activitiesForSite } from '@/data/fixtures/activities'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import { now as appNow } from '@/data/fixtures/clock'
import type { IsoDateTime } from '@/data/types'
import { AttendanceRoute } from './AttendanceRoute'

/**
 * Cancelling a session. AM v2.0 ACT-01, Phase 20.
 *
 * **The subject is what survives it.** AM v2.0 asks whether to remove
 * attendance recorded before a cancellation; this build refuses the question,
 * because somebody wrote that a resident came with their name and the time on
 * it, and a later decision about the session does not make that untrue.
 *
 * The instant is pinned to the fixtures' clock: every assertion is about what
 * a write kept, not about when it happened.
 */
const NOW = appNow().toISOString() as IsoDateTime

afterEach(() => resetSessionActivities())

const withAttendance = () =>
  activitiesForSite('site-rosewood-court').find((activity) =>
    activity.invited.some((entry) => entry.attendance.kind !== 'not_recorded'),
  )!

function renderSession(id: string) {
  const router = createMemoryRouter(
    [{ path: '/activities/:activityId', element: <AttendanceRoute /> }],
    { initialEntries: [`/activities/${id}`] },
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

describe('a cancellation keeps every attendance already recorded', () => {
  it('leaves the invitation list byte-identical', () => {
    const activity = withAttendance()
    const before = JSON.stringify(activity.invited)
    const joined = JSON.stringify(activity.joined)

    cancelSession(activity, 'The minibus did not arrive.', staffOkonkwo)

    const after = withActivityEdits(activity)
    /*
     * **The assertion this file exists for.** A cancellation that discarded
     * these would be a record editing itself, which is the shape consent
     * withdrawal refused: a withdrawal supersedes a consent and never erases
     * it, because the earlier record is evidence of what somebody did.
     */
    expect(JSON.stringify(after.invited)).toBe(before)
    expect(JSON.stringify(after.joined)).toBe(joined)
    expect(after.standing.kind).toBe('cancelled')
  })

  it('refuses a cancellation with no reason', () => {
    expect(() => cancelSession(withAttendance(), '   ', staffOkonkwo)).toThrow(
      /needs a reason/i,
    )
  })

  it('refuses to overwrite the first reason with a second', () => {
    const activity = withAttendance()
    cancelSession(activity, 'The minibus did not arrive.', staffOkonkwo)
    expect(() =>
      cancelSession(withActivityEdits(activity), 'Something else.', staffOkonkwo),
    ).toThrow(/already cancelled/i)
  })

  it('says how many records stay, before anybody decides', async () => {
    const user = userEvent.setup()
    const activity = withAttendance()
    const recorded = activity.invited.filter(
      (entry) => entry.attendance.kind !== 'not_recorded',
    ).length

    const { container } = renderSession(activity.id)
    await waitFor(() =>
      expect(container.querySelector('[data-cancel-open]')).toBeTruthy(),
    )
    await user.click(container.querySelector('[data-cancel-open]')!)

    const dialog = await screen.findByRole('dialog')
    const said = dialog.querySelector('[data-attendance-kept]')!
    /*
     * Counted rather than described. A reader can hold a number against what
     * they can see on the screen behind the dialog; "some records" cannot be
     * held against anything, which is the sign-out confirmation's argument.
     */
    expect(said.textContent).toContain(String(recorded))
    expect(said.textContent).toMatch(/stay exactly as they are/i)

    // And the act is refused until a reason is typed.
    expect(
      dialog.querySelector<HTMLButtonElement>('[data-confirm-cancel]')!.disabled,
    ).toBe(true)
  }, 30000)

  it('renders a cancelled session settled rather than hatched', async () => {
    const activity = withAttendance()
    cancelSession(activity, 'The minibus did not arrive.', staffOkonkwo)

    const { container } = renderSession(activity.id)
    await waitFor(() =>
      expect(container.querySelector('[data-cancelled]')).toBeTruthy(),
    )

    const block = container.querySelector('[data-cancelled]')!
    // Somebody decided and their name is on it: the record is complete, and
    // the hatch would say nobody had looked.
    expect(block.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(block.textContent).toContain('The minibus did not arrive.')
    expect(block.textContent).toContain(staffOkonkwo.displayName)
  }, 30000)
})

describe('planning a session asks for its denominator', () => {
  it('refuses a session with nobody invited', () => {
    expect(() =>
      planSession({
        siteId: 'site-rosewood-court',
        name: 'Knitting group',
        description: 'In the craft room.',
        place: 'Craft room',
        startsAt: NOW,
        endsAt: NOW,
        residentIds: [],
        by: staffOkonkwo,
      }),
    ).toThrow(/at least one resident invited/i)
  })

  it('puts a planned session on the calendar this session reads', () => {
    const before = activitiesAt('site-rosewood-court').length
    const residentId =
      activitiesForSite('site-rosewood-court')[0]!.invited[0]!.residentId

    const planned = planSession({
      siteId: 'site-rosewood-court',
      name: 'Knitting group',
      description: 'In the craft room.',
      place: 'Craft room',
      startsAt: NOW,
      endsAt: NOW,
      residentIds: [residentId],
      by: staffOkonkwo,
    })

    const after = activitiesAt('site-rosewood-court')
    expect(after.length).toBe(before + 1)
    expect(after.some((entry) => entry.id === planned.id)).toBe(true)
    // Nobody has recorded attendance for a session that has not happened.
    expect(planned.invited.every((e) => e.attendance.kind === 'not_recorded')).toBe(
      true,
    )
  })
})
