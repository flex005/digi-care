import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { Activity, IsoDateTime } from '@/data/types'
import { DID_NOT_ATTEND_REASONS } from '@/data/types'
import { activities, activitiesForSite } from '@/data/fixtures/activities'
import { residents } from '@/data/fixtures/residents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { ActivityCalendarRoute } from './ActivityCalendarRoute'
import { AttendanceRoute } from './AttendanceRoute'
import { PlanDrawerRoute } from './PlanDrawerRoute'
import { sessionState, tally } from './session-state'

/**
 * Activities. PRD §6.7, Phase 9.
 *
 * **The first module whose subject is a group**, and the failure changes shape
 * with it. On a grid you do not pick the wrong person from a list — you slip a
 * row, and Doris is marked present while Beryl is marked absent. So most of
 * what is under test is that each row can only be read as one person's, and
 * that nothing lets somebody assert twelve facts at once.
 *
 * Pinned to the fixture instant: which sessions have happened, and therefore
 * which are gaps, is arithmetic on today (§8).
 */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
})

afterAll(() => {
  vi.useRealTimers()
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'activities', element: <ActivityCalendarRoute /> },
      { path: 'activities/:activityId', element: <AttendanceRoute /> },
      { path: 'activities/:activityId/plan', element: <PlanDrawerRoute /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(() =>
    expect(
      container.querySelector('[data-calendar], [data-tally], [data-invitee]'),
    ).toBeTruthy(),
  )

const rosewood = activitiesForSite('site-rosewood-court')
const find = (kind: ReturnType<typeof sessionState>['kind']) => {
  const activity = rosewood.find((entry) => sessionState(entry, NOW_ISO).kind === kind)
  expect(activity, `no fixture reaches a ${kind} session`).toBeTruthy()
  return activity!
}

/* ------------------------------------------------------- the four states */

describe('a session says which of four things it is', () => {
  it('reaches all four, so the screen can be reviewed against all four', () => {
    const kinds = new Set(
      activities.map((activity) => sessionState(activity, NOW_ISO).kind),
    )
    for (const kind of [
      'planned',
      'unrecorded',
      'partly_recorded',
      'fully_recorded',
    ] as const) {
      expect(kinds.has(kind), kind).toBe(true)
    }
  })

  it('gives the hatch to exactly one of them', async () => {
    const { container } = renderAt('/activities')
    await settled(container)

    // Planned is not a gap: nothing has happened, so nobody has failed to
    // record anything. Only "it happened and nobody wrote it up" is an absence.
    for (const block of container.querySelectorAll('[data-session]')) {
      const state = block.getAttribute('data-state')
      const hatched = (block.getAttribute('class') ?? '').includes('unrecorded')
      expect(hatched, `${state} took the hatch`).toBe(state === 'unrecorded')
    }
  })

  it('leads on the sessions nobody wrote up, with their denominator', async () => {
    const { container } = renderAt('/activities')
    await settled(container)

    const lead = container.querySelector('[data-unrecorded]')
    expect(lead?.textContent).toMatch(/nobody recorded who came/)
    expect(lead?.textContent).toMatch(/Of \d+ sessions?/)
    // The people it is a claim about, not just the sessions.
    expect(lead?.textContent).toMatch(/residents were invited to them/)
  })
})

/* -------------------------------------------------- nothing is not zero */

describe('nothing recorded is not zero attended', () => {
  it('renders one hatched row per invited resident, never a count of zero', async () => {
    const activity = find('unrecorded')
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const rows = container.querySelectorAll('[data-attendance-row]')
    expect(rows.length).toBe(activity.invited.length)
    for (const row of rows) {
      expect(row.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    }

    /*
     * Zero attended says nobody came; nothing recorded says nobody wrote it
     * down. The tally's fourth cell carries the whole invitation list, and the
     * attended cell reads zero *beside* it rather than instead of it.
     */
    const gap = container.querySelector('[data-tally-cell="not-recorded"]')
    expect(gap?.textContent).toContain(String(activity.invited.length))
    expect(gap?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(gap?.getAttribute('class') ?? '').toMatch(/unrecorded/)
  })

  it('counts all four cells over the invitation list', async () => {
    const activity = find('fully_recorded')
    const counts = tally(activity)
    expect(counts.attended + counts.didNotAttend + counts.notRecorded).toBe(
      counts.invited,
    )

    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)
    expect(container.querySelector('[data-tally-cell="invited"]')?.textContent).toMatch(
      /the denominator for everything here/,
    )
    expect(
      container.querySelector('[data-tally-cell="attended"]')?.textContent,
    ).toMatch(new RegExp(`of ${counts.invited} invited`))
  })
})

/* ------------------------------------------------------ §2.4 per row */

describe('every row can only be read as one person', () => {
  it('carries the avatar, both names and the room on each row', async () => {
    /*
     * On a grid you do not pick the wrong person from a list, you slip a row.
     * The identity on the row is the only thing standing between Doris being
     * marked present and Beryl being marked absent.
     */
    const activity = find('unrecorded')
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    for (const entry of activity.invited) {
      const resident = byId.get(entry.residentId)!
      const row = container.querySelector(`[data-attendance-row="${entry.residentId}"]`)
      expect(row?.textContent, entry.residentId).toContain(resident.preferredName)
      expect(row?.textContent, entry.residentId).toContain(resident.fullLegalName)
      if (resident.room.kind === 'recorded') {
        expect(row?.textContent, entry.residentId).toContain(resident.room.value)
      }
    }
  })

  it('names the person in each answer control, not just the row', async () => {
    const activity = find('unrecorded')
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    const first = activity.invited[0]!
    const resident = byId.get(first.residentId)!

    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const row = container.querySelector(`[data-attendance-row="${first.residentId}"]`)
    const came = row?.querySelector('[data-answer="came"]')
    expect(came?.getAttribute('aria-label')).toContain(resident.fullLegalName)
  })

  it('gives no row a default answer', async () => {
    // A pre-selected answer is an answer nobody gave, and on a register of who
    // was where it is a claim about somebody's afternoon.
    const activity = find('unrecorded')
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    for (const button of container.querySelectorAll('[data-answer]')) {
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }
  })
})

/* ------------------------------------------ no bulk, and the joiners */

describe('nothing lets somebody assert twelve facts at once', () => {
  it('offers no "mark all attended", and says why', async () => {
    const activity = find('unrecorded')
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    // The claim is that no bulk control exists anywhere on this screen, which
    // is the point; the hook is what keeps it from matching something else.
    expect(container.querySelector('[data-mark-all]')).toBeNull()
    expect(container.querySelector('[data-foot-state]')?.textContent).toMatch(
      /no .mark all attended./i,
    )
  })

  it('names who is still unanswered rather than counting them', async () => {
    const activity = find('unrecorded')
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const foot = container.querySelector('[data-foot-state]')
    for (const entry of activity.invited.slice(0, 3)) {
      expect(foot?.textContent).toContain(byId.get(entry.residentId)!.fullLegalName)
    }
  })

  it('keeps a joiner out of the invitation list', async () => {
    /*
     * Adding them retroactively would rewrite the plan to say they were always
     * expected — a record editing itself to look tidier. Three facts instead:
     * who was invited, who came, and who joined.
     */
    const withJoiner = rosewood.find((activity) => activity.joined.length > 0)
    expect(withJoiner, 'no fixture reaches a session with a joiner').toBeTruthy()
    const activity = withJoiner!

    const invited = new Set(activity.invited.map((entry) => entry.residentId))
    for (const joiner of activity.joined) {
      expect(invited.has(joiner.residentId), joiner.residentId).toBe(false)
    }

    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const section = container.querySelector('[data-joined]')
    expect(section?.textContent).toMatch(/Joined without being invited/)
    for (const joiner of activity.joined) {
      expect(
        section?.querySelector(`[data-joiner="${joiner.residentId}"]`),
      ).toBeTruthy()
      // And the denominator did not move.
      expect(
        container.querySelector(`[data-attendance-row="${joiner.residentId}"]`),
      ).toBeNull()
    }
    expect(tally(activity).invited).toBe(activity.invited.length)
  })
})

/* -------------------------------------------- did not attend is settled */

describe('did not attend is a record, not a failure', () => {
  it('asks why, because a negative with no reason is indistinguishable from a gap', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const activity = find('unrecorded')
    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const first = activity.invited[0]!
    const row = container.querySelector(`[data-attendance-row="${first.residentId}"]`)!
    await user.click(row.querySelector<HTMLButtonElement>('[data-answer="did_not"]')!)

    await waitFor(() => {
      const updated = container.querySelector(
        `[data-attendance-row="${first.residentId}"]`,
      )
      expect(updated?.textContent).toMatch(/Say why|Why /)
    })
  })

  it('renders a recorded refusal as settled, with its reason and author', async () => {
    const activity = rosewood.find((entry) =>
      entry.invited.some((one) => one.attendance.kind === 'did_not_attend'),
    )!
    const entry = activity.invited.find(
      (one) => one.attendance.kind === 'did_not_attend',
    )!
    if (entry.attendance.kind !== 'did_not_attend') return

    const { container } = renderAt(`/activities/${activity.id}`)
    await settled(container)

    const row = container.querySelector(`[data-attendance-row="${entry.residentId}"]`)
    const reason = DID_NOT_ATTEND_REASONS.find(
      (one) => one.id === (entry.attendance as { reason: string }).reason,
    )!
    // A complete record of a person exercising a choice — not the hatch.
    expect(row?.textContent).toContain(reason.name)
    expect(row?.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})

/* ------------------------------------------------------- the drawer */

describe('the plan drawer reads the care plan and duplicates nothing', () => {
  it('shows what somebody said they like, from their own care plan', async () => {
    const activity = find('unrecorded')
    const { container } = renderAt(`/activities/${activity.id}/plan`)
    await settled(container)

    const recorded = container.querySelectorAll('[data-preference="recorded"]')
    expect(recorded.length).toBeGreaterThan(0)
  })

  it('renders an unwritten domain as "never asked", and points at the fix', async () => {
    /*
     * An unwritten social and emotional domain *is* nobody having asked. A
     * field of its own here would be a second place for the same fact, and the
     * two would drift.
     */
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    const activity = rosewood.find((entry) =>
      entry.invited.some((one) => {
        const domain = byId
          .get(one.residentId)
          ?.carePlan.find((each) => each.domainId === 'social_emotional')
        return domain?.versions.kind === 'never_finalised'
      }),
    )!

    const { container } = renderAt(`/activities/${activity.id}/plan`)
    await settled(container)

    const unasked = container.querySelectorAll('[data-preference="never_asked"]')
    expect(unasked.length).toBeGreaterThan(0)
    expect(unasked[0]?.textContent).toMatch(/Never asked what they like/)

    const lead = container.querySelector('[data-never-asked]')
    expect(lead?.textContent).toMatch(/never been asked what they like doing/)
    // The screen that fixes it, rather than a field on this one.
    expect(
      container.querySelector('a[href*="/care-plan/social_emotional"]'),
    ).toBeTruthy()
  })
})

/* ---------------------------------------------- range and arrangement */

describe('range and arrangement use the same shape', () => {
  it('offers both as segmented controls rather than inventing a fourth shape', async () => {
    const { container } = renderAt('/activities')
    await settled(container)

    const groups = container.querySelectorAll('[role="group"]')
    const labels = [...groups].map((group) => group.getAttribute('aria-label'))
    expect(labels).toContain('Range')
    expect(labels).toContain('Arrangement')
  })

  it('shows the same sessions in the list arrangement', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt('/activities')
    await settled(container)

    const inCalendar = container.querySelectorAll('[data-session]').length
    await user.click(
      container.querySelector<HTMLButtonElement>('[data-segment="list"]')!,
    )

    await waitFor(() => {
      expect(container.querySelector('[data-calendar]')).toBeNull()
      expect(container.querySelectorAll('[data-session]').length).toBe(inCalendar)
    })
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the calendar', async () => {
    await check('/activities')
  }, 20000)

  it('has no violations on the recording grid', async () => {
    await check(`/activities/${find('unrecorded').id}`)
  }, 20000)

  it('has no violations on the plan drawer', async () => {
    await check(`/activities/${find('unrecorded').id}/plan`)
  }, 20000)
})

/** Every activity used above belongs to the site the screens are scoped to. */
describe('the subjects these tests are built on', () => {
  it('are all at the active site', () => {
    for (const activity of rosewood as Activity[]) {
      expect(activity.siteId).toBe('site-rosewood-court')
    }
  })
})
