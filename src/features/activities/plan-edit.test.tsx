import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import type { StaffRole } from '@/data/types'
import type { IsoDateTime } from '@/data/types'
import {
  activitiesAt,
  planSession,
  resetSessionActivities,
  withActivityEdits,
} from '@/data/access/activity-store'
import { activitiesForSite } from '@/data/fixtures/activities'
import { residentsBySite } from '@/data/fixtures/residents'
import { sites, staffOkonkwo } from '@/data/fixtures/organisation'
import { now as appNow } from '@/data/fixtures/clock'
import { formatTime, zonedDate } from '@/lib/format'
import { ActivityCalendarRoute } from './ActivityCalendarRoute'
import { AttendanceRoute } from './AttendanceRoute'
import { sessionState } from './session-state'

/**
 * Planning and changing a session. AM v2.0 ACT-01, Phase 25.
 *
 * **`planSession` and `editSession` were written in Phase 20, tested directly,
 * and called by nothing.** The store tests were green and no screen could
 * plan or change a session. So the assertions that carry weight here go
 * through the screen and read the result back through the store every screen
 * reads — never through the dialog's own state.
 *
 * Instants are taken from the fixtures' clock: whether a session has started
 * is arithmetic on now, and a session planned "the day after tomorrow" has to
 * be the day after tomorrow in the home's zone, not the runner's.
 */

const ROSEWOOD = 'site-rosewood-court'
const ZONE = sites.find((site) => site.id === ROSEWOOD)!.timeZone
const NOW = appNow().toISOString() as IsoDateTime

afterEach(() => resetSessionActivities())

function renderAt(path: string, as: StaffRole = 'registered_manager') {
  const router = createMemoryRouter(
    [
      { path: '/activities', element: <ActivityCalendarRoute /> },
      { path: '/activities/:activityId', element: <AttendanceRoute /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={as} />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

/** Two days on, as the home's calendar reads it. */
const inTwoDays = () =>
  zonedDate(
    new Date(appNow().getTime() + 2 * 86_400_000).toISOString() as IsoDateTime,
    ZONE,
  )

describe('a session can be planned from the calendar', () => {
  it('puts it in the store the calendar reads, at the time the home’s clock says', async () => {
    const user = userEvent.setup()
    const before = activitiesAt(ROSEWOOD).length
    const invitee = residentsBySite(ROSEWOOD)[0]!

    const { container } = renderAt('/activities')
    await waitFor(() =>
      expect(container.querySelector('[data-plan-open]')).toBeTruthy(),
    )
    await user.click(container.querySelector('[data-plan-open]')!)
    const dialog = await screen.findByRole('dialog')

    await user.type(
      dialog.querySelector('[data-field="session-name"]')!,
      'Seed planting',
    )
    await user.type(
      dialog.querySelector('[data-field="session-place"]')!,
      'Garden room',
    )
    await user.type(
      dialog.querySelector('[data-field="session-description"]')!,
      'Sowing sweet peas for the front beds.',
    )
    await user.type(dialog.querySelector('[data-field="session-date"]')!, inTwoDays())
    await user.type(dialog.querySelector('[data-field="session-starts"]')!, '14:30')
    await user.type(dialog.querySelector('[data-field="session-ends"]')!, '15:30')

    // Nobody invited yet: the denominator is missing and the save is refused.
    const save = () => dialog.querySelector<HTMLButtonElement>('[data-plan-save]')!
    expect(save().disabled).toBe(true)
    expect(dialog.querySelector('[data-plan-waiting]')!.textContent).toMatch(
      /at least one resident invited/i,
    )

    await user.click(
      dialog.querySelector(`[data-invite-resident="${invitee.id}"] input`)!,
    )
    await waitFor(() => expect(save().disabled).toBe(false))
    await user.click(save())

    /*
     * **The assertion this file exists for.** Through the store, not the
     * dialog: a dialog that closed over an unchanged store is the defect
     * found when this was reported as done.
     */
    await waitFor(() => expect(activitiesAt(ROSEWOOD).length).toBe(before + 1))
    const planned = activitiesAt(ROSEWOOD).find(
      (entry) => entry.name === 'Seed planting',
    )!
    expect(planned.invited.map((entry) => entry.residentId)).toEqual([invitee.id])
    expect(planned.invited[0]!.attendance.kind).toBe('not_recorded')
    expect(planned.plannedBy.id).not.toBe('')
    // 14:30 on the home's wall, whatever zone the runner is in.
    expect(formatTime(planned.startsAt, ZONE)).toBe('14:30')
    expect(zonedDate(planned.startsAt, ZONE)).toBe(inTwoDays())

    // And the calendar says where it went, linked.
    await waitFor(() =>
      expect(container.querySelector('[data-just-planned]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-just-planned] a')!.getAttribute('href')).toBe(
      `/activities/${planned.id}`,
    )
  }, 40000)

  it('refuses a session that would already have started', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/activities')
    await waitFor(() =>
      expect(container.querySelector('[data-plan-open]')).toBeTruthy(),
    )
    await user.click(container.querySelector('[data-plan-open]')!)
    const dialog = await screen.findByRole('dialog')

    await user.type(
      dialog.querySelector('[data-field="session-date"]')!,
      zonedDate(NOW, ZONE),
    )
    await user.type(dialog.querySelector('[data-field="session-starts"]')!, '00:01')
    await user.type(dialog.querySelector('[data-field="session-ends"]')!, '00:30')
    expect(dialog.querySelector('[data-plan-waiting]')!.textContent).toMatch(
      /has not already passed/i,
    )
  }, 30000)

  it('offers no planning control to somebody who cannot record here', async () => {
    const { container } = renderAt('/activities', 'auditor')
    await waitFor(() => expect(container.querySelector('[data-calendar]')).toBeTruthy())
    // Absent, not disabled.
    expect(container.querySelector('[data-plan-open]')).toBeNull()
  }, 20000)
})

describe('a session can be changed before it starts, and only then', () => {
  const future = () =>
    planSession({
      siteId: ROSEWOOD,
      name: 'Knitting group',
      description: 'In the craft room.',
      place: 'Craft room',
      /*
       * On a whole minute, as every session the form can write is. The clock
       * carries seconds while a round is live, and a start with seconds came
       * back from the edit form minute-rounded, so this failed only at those
       * times of day: the test, not the screen.
       */
      startsAt: new Date(
        Math.floor((appNow().getTime() + 2 * 86_400_000) / 60_000) * 60_000,
      ).toISOString() as IsoDateTime,
      endsAt: new Date(
        Math.floor((appNow().getTime() + 2 * 86_400_000) / 60_000) * 60_000 + 3_600_000,
      ).toISOString() as IsoDateTime,
      residentIds: [residentsBySite(ROSEWOOD)[0]!.id],
      by: staffOkonkwo,
    })

  it('changes the name and place, and keeps who planned it', async () => {
    const user = userEvent.setup()
    const session = future()
    const { container } = renderAt(`/activities/${session.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-edit-open]')).toBeTruthy(),
    )
    await user.click(container.querySelector('[data-edit-open]')!)
    const dialog = await screen.findByRole('dialog')

    const name = dialog.querySelector<HTMLInputElement>('[data-field="session-name"]')!
    // Filled from the record, not blank: a blank would re-ask what is known.
    expect(name.value).toBe('Knitting group')
    await user.clear(name)
    await user.type(name, 'Knit and natter')
    const place = dialog.querySelector<HTMLInputElement>(
      '[data-field="session-place"]',
    )!
    await user.clear(place)
    await user.type(place, 'Lounge')
    await user.click(dialog.querySelector('[data-edit-save]')!)

    await waitFor(() => expect(withActivityEdits(session).name).toBe('Knit and natter'))
    const after = withActivityEdits(session)
    expect(after.place).toBe('Lounge')
    expect(after.plannedBy).toEqual(session.plannedBy)
    expect(after.plannedAt).toBe(session.plannedAt)
    // Times untouched by an edit that did not change them.
    expect(after.startsAt).toBe(session.startsAt)

    // And the screen re-read it.
    await waitFor(() =>
      expect(container.querySelector('h1')!.textContent).toBe('Knit and natter'),
    )
  }, 40000)

  it('offers no change to a session that has already started', async () => {
    const started = activitiesForSite(ROSEWOOD).find(
      (entry) =>
        entry.standing.kind === 'planned' &&
        sessionState(entry, NOW).kind !== 'planned',
    )
    expect(started, 'no fixture reaches a session that has started').toBeTruthy()

    const { container } = renderAt(`/activities/${started!.id}`)
    await waitFor(() => expect(container.querySelector('[data-tally]')).toBeTruthy())
    expect(container.querySelector('[data-edit-open]')).toBeNull()
    // Cancelling is a different act and is still offered.
    expect(container.querySelector('[data-cancel-open]')).toBeTruthy()
  }, 20000)
})
