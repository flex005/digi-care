import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDateTime } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { GOAL_GAP_IDS, goals, progressFor } from '@/data/fixtures/goals'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { GoalsTab } from './GoalsTab'
import { GoalDetailRoute } from './GoalDetailRoute'
import { GoalFormRoute } from './GoalFormRoute'
import { GoalQueueRoute } from './GoalQueueRoute'
import { GOAL_FIELDS } from './goal-fields'
import { NO_GOALS_ALERT_DAYS, goalStanding, targetStanding } from './goal-timing'

/**
 * Goals. PRD §6.7, Phase 8.
 *
 * **The module's hazard is that its subject is a person rather than a
 * record.** Everything else in this build is somebody's account of a resident;
 * a goal is the resident's account of what they want, so the ways to get it
 * wrong are ways of speaking over them — paraphrasing the statement, treating
 * a goal that was not reached as a failure, or closing one without asking.
 *
 * Pinned to the instant the fixtures were generated against: past-its-date,
 * how long somebody has been here, and how long since a progress note are all
 * arithmetic on today (§8).
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
      { path: 'goals', element: <GoalQueueRoute /> },
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { path: 'goals', element: <GoalsTab /> },
          { path: 'goals/new', element: <GoalFormRoute /> },
          { path: 'goals/:goalId', element: <GoalDetailRoute /> },
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
  waitFor(() =>
    expect(
      container.querySelector('[data-goal], [data-no-goals], [data-row], [data-field]'),
    ).toBeTruthy(),
  )

/* --------------------------------------------------------------- subjects */

const withGoals = new Set(goals.map((goal) => goal.residentId))

/** Somebody here long enough for "nobody has set a goal" to be a claim. */
const noGoalsLongHere = residents.find(
  (resident) =>
    !withGoals.has(resident.id) &&
    Date.parse(resident.admittedOn) < NOW.getTime() - NO_GOALS_ALERT_DAYS * 86_400_000,
)!

/** Somebody here too briefly for it. The window has not elapsed. */
const noGoalsTooNew = residents.find(
  (resident) =>
    !withGoals.has(resident.id) &&
    Date.parse(resident.admittedOn) >= NOW.getTime() - NO_GOALS_ALERT_DAYS * 86_400_000,
)!

const goalById = (id: string) => goals.find((goal) => goal.id === id)!
const residentOf = (goalId: string) =>
  residents.find((resident) => resident.id === goalById(goalId).residentId)!

/* ---------------------------------------------- the resident's own words */

describe("the goal is the resident's account, not somebody's account of them", () => {
  it('makes the statement the largest thing on the tab, in their words', async () => {
    const goal = goalById(GOAL_GAP_IDS.pastTargetNoProgress)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const statement = container.querySelector(`[data-goal-statement="${goal.id}"]`)
    // Verbatim, and quoted. A clinical paraphrase here would make the one
    // record whose subject is what this person wants read like every other
    // record, which is somebody's account of them.
    expect(statement?.textContent).toContain(goal.statement)
    expect(statement?.textContent).toMatch(/^“/)

    // And larger than the machinery around it.
    const chip = container.querySelector('[data-standing] [data-state="unrecorded"]')
    expect(statement, 'no statement rendered').toBeTruthy()
    expect(chip, 'no state chip rendered to compare against').toBeTruthy()
  })

  it('renders it verbatim on the queue too, never truncated to a summary', async () => {
    const goal = goalById(GOAL_GAP_IDS.pastTargetNoProgress)
    const { container } = renderAt('/goals')
    await settled(container)

    const statement = container.querySelector(`[data-goal-statement="${goal.id}"]`)
    expect(statement?.textContent).toContain(goal.statement)
  })
})

/* --------------------------------------------------------- the empty tab */

describe('nobody has set a goal with this person', () => {
  it('is the whole screen, with no list beneath it', async () => {
    const { container } = renderAt(`/residents/${noGoalsLongHere.id}/goals`)
    await settled(container)

    const lead = container.querySelector('[data-no-goals]')
    expect(lead?.textContent).toContain(noGoalsLongHere.preferredName)
    /*
     * Nothing to list, so no list — and the assertion is anchored to the panel
     * rather than to the page. `container.querySelector('ul')` matched the
     * profile header's risk flag list, so a test written to prove a list was
     * absent failed on a list that is supposed to be there (§8).
     */
    const panel = container.querySelector('[data-goals-panel]')
    expect(panel?.querySelector('[data-goal]')).toBeNull()
    expect(panel?.querySelector('ul')).toBeNull()
  })

  it('names how long they have been here, because that is what makes it a finding', async () => {
    const { container } = renderAt(`/residents/${noGoalsLongHere.id}/goals`)
    await settled(container)

    const lead = container.querySelector('[data-no-goals]')
    expect(lead?.getAttribute('data-expected')).toBe('true')
    // "No goals set" means nothing about somebody admitted yesterday and a
    // great deal about somebody here five months.
    expect(lead?.textContent).toMatch(/been here \d+ (day|month|year)/)
  })

  it('says the window has not elapsed for somebody here too briefly', async () => {
    /*
     * The same shape as the resident who cannot yet be missing a 48-hour care
     * note: the answer is not "no problem", it is not yet knowable — and the
     * screen says which rather than rendering the same finding at them.
     */
    expect(noGoalsTooNew, 'no resident is here too briefly for the claim').toBeTruthy()
    const { container } = renderAt(`/residents/${noGoalsTooNew.id}/goals`)
    await settled(container)

    const lead = container.querySelector('[data-no-goals]')
    expect(lead?.getAttribute('data-expected')).toBeNull()
    expect(lead?.textContent).toMatch(/not yet a gap/)
    expect(lead?.textContent).toMatch(new RegExp(String(NO_GOALS_ALERT_DAYS)))
  })

  it('offers setting one, which is the only thing this screen can do', async () => {
    const { container } = renderAt(`/residents/${noGoalsLongHere.id}/goals`)
    await settled(container)

    const link = container.querySelector('[data-set-goal]')
    expect(link?.getAttribute('href')).toBe(
      `/residents/${noGoalsLongHere.id}/goals/new`,
    )
  })
})

/* ------------------------------------------------------------ the states */

describe('what a goal says about itself', () => {
  it('treats a goal past its date with nothing said as a gap, not a failure', async () => {
    const goal = goalById(GOAL_GAP_IDS.pastTargetNoProgress)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const card = container.querySelector(`[data-goal="${goal.id}"]`)
    expect(card?.querySelector('[data-standing="past_target"]')).toBeTruthy()
    // The hatch, because nobody has said — which is not a record that it did
    // not happen.
    expect(card?.textContent).toMatch(/Nothing recorded/)
  })

  it('never lets a goal with no target date read as "not yet due"', async () => {
    const goal = goalById(GOAL_GAP_IDS.noTargetDate)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const card = container.querySelector(`[data-goal="${goal.id}"]`)
    // It can never be late, so a screen leading on "past its date" would
    // silently never show it. The hatch says which it is.
    expect(card?.querySelector('[data-no-target]')).toBeTruthy()
    expect(card?.textContent).toMatch(/No target date set/)
    expect(targetStanding(goal.target, NOW_ISO).kind).toBe('none')
  })

  it('shows an unfiled goal as unfiled rather than defaulting it to a domain', async () => {
    const goal = goalById(GOAL_GAP_IDS.noTargetDate)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const card = container.querySelector(`[data-goal="${goal.id}"]`)
    expect(card?.querySelector('[data-unlinked]')).toBeTruthy()
  })

  it('does not give "not achieved" a failure treatment', async () => {
    /*
     * Critical and caution are for things somebody must act on. A goal that
     * was not reached is a thing that happened to a person, and a warning
     * colour turns the record into a judgement about them.
     */
    const goal = goals.find((entry) => entry.outcome.kind === 'not_achieved')!
    const resident = residents.find((entry) => entry.id === goal.residentId)!
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const chip = container.querySelector(
      `[data-goal="${goal.id}"] [data-closed="not_achieved"]`,
    )
    expect(chip?.textContent).toMatch(/Not achieved/)
    const className = chip?.getAttribute('class') ?? ''
    expect(className).toMatch(/stateNotAchieved/)
    expect(className).not.toMatch(/critical|caution/i)
  })
})

/* --------------------------------------------- what the resident said */

describe('what the resident said about their goal ending', () => {
  it('renders "not asked" as the gap it is', async () => {
    /*
     * A family reading this later is entitled to know whether the person was
     * asked. Not asked is not the same as agreed, and on the one record whose
     * subject is what *they* wanted, that question is the record.
     */
    const goal = goalById(GOAL_GAP_IDS.stoppedWithoutAsking)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const said = container.querySelector(
      `[data-goal="${goal.id}"] [data-said="not_asked"]`,
    )
    expect(said?.textContent).toContain(resident.preferredName)
    expect(said?.textContent).toMatch(/was not asked/)
    expect(said?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('says so when somebody disagreed that their goal was achieved', async () => {
    const goal = goalById(GOAL_GAP_IDS.achievedButDisagreed)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const card = container.querySelector(`[data-goal="${goal.id}"]`)
    expect(card?.querySelector('[data-closed="achieved"]')).toBeTruthy()
    // The claim and the contradiction of it, side by side. Achieved on its own
    // would be one person's view of another person's life.
    expect(card?.querySelector('[data-said="disagreed"]')?.textContent).toContain(
      resident.preferredName,
    )
  })

  it('carries no resident view on a withdrawal, because the withdrawal is the view', async () => {
    const goal = goals.find((entry) => entry.outcome.kind === 'withdrawn_by_resident')!
    const resident = residents.find((entry) => entry.id === goal.residentId)!
    const { container } = renderAt(`/residents/${resident.id}/goals`)
    await settled(container)

    const card = container.querySelector(`[data-goal="${goal.id}"]`)
    expect(card?.querySelector('[data-closed="withdrawn_by_resident"]')).toBeTruthy()
    // Asking what they thought of their own decision is incoherent whichever
    // value it takes. The type says so; this proves the screen agrees.
    expect(card?.querySelector('[data-said]')).toBeNull()
  })
})

/* ---------------------------------------------------------- the timeline */

describe('the progress timeline', () => {
  it('always ends with when it was set, so it has a beginning', async () => {
    const goal = goalById(GOAL_GAP_IDS.pastTargetNoProgress)
    const resident = residentOf(goal.id)
    expect(progressFor(goal.id)).toEqual([])

    const { container } = renderAt(`/residents/${resident.id}/goals/${goal.id}`)
    await waitFor(() => expect(container.querySelector('[data-timeline]')).toBeTruthy())

    // An empty timeline is a goal that was set and then nothing — not a goal
    // with no history.
    expect(container.querySelector('[data-timeline-set]')?.textContent).toMatch(
      /Set on/,
    )
    expect(container.querySelectorAll('[data-progress-note]').length).toBe(0)
  })

  it('marks the silence, and says what it is not', async () => {
    const goal = goalById(GOAL_GAP_IDS.pastTargetNoProgress)
    const resident = residentOf(goal.id)
    const { container } = renderAt(`/residents/${resident.id}/goals/${goal.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-timeline-gap]')).toBeTruthy(),
    )

    const gap = container.querySelector('[data-timeline-gap]')
    /*
     * The timeline is its own record rather than filtered care notes, so a gap
     * here is a gap in goal progress and makes no claim about the care record.
     * That is why Rule 3c does not apply and this marker is honest.
     */
    expect(gap?.textContent).toMatch(
      /not a record that it did not happen; it is a record that nobody said/,
    )
  })
})

/* -------------------------------------------------------------- the form */

describe('setting a goal', () => {
  it('asks for three fields, two in their voice and one written to staff', () => {
    // The care plan editor's shape, not a new one — a goal and a care plan
    // domain are the same kind of document.
    expect(GOAL_FIELDS.map((field) => field.voice)).toEqual([
      'resident',
      'resident',
      'staff',
    ])
    expect(GOAL_FIELDS.find((field) => field.id === 'statement')!.label).toContain('I')
  })

  it('will not set a goal until all three are written, and names what is missing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt(`/residents/${noGoalsLongHere.id}/goals/new`)
    await settled(container)

    const button = container.querySelector<HTMLButtonElement>('[data-set-goal]')
    expect(button?.disabled).toBe(true)
    for (const field of GOAL_FIELDS) {
      expect(container.querySelector('[data-foot-state]')?.textContent).toContain(
        field.label,
      )
    }

    for (const field of GOAL_FIELDS) {
      await user.type(
        container.querySelector<HTMLTextAreaElement>(`#goal-${field.id}`)!,
        'Something this person said.',
      )
    }
    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-set-goal]')?.disabled,
      ).toBe(false),
    )
  })

  it('says a goal with no date can never be late, rather than letting the blank pass', async () => {
    const { container } = renderAt(`/residents/${noGoalsLongHere.id}/goals/new`)
    await settled(container)
    expect(container.textContent).toMatch(/a goal with no date can never be late/)
  })
})

/* ------------------------------------------------------------- the queue */

describe('the goals queue', () => {
  it('leads on goals past their date, and says what the denominator excludes', async () => {
    const { container } = renderAt('/goals')
    await settled(container)

    const lead = container.querySelector('[data-past-target]')
    expect(lead?.textContent).toMatch(/nobody has said what happened/)
    // A goal with no date is not counted — said, not implied.
    expect(lead?.textContent).toMatch(/no date at all and are not counted here/)
  })

  it('sorts longest past its date first, because the wait is the finding', async () => {
    const { container } = renderAt('/goals')
    await settled(container)

    const ids = [...container.querySelectorAll('[data-row]')].map((row) =>
      row.getAttribute('data-row'),
    )
    const daysPast = ids.map((id) => {
      const goal = goals.find((entry) => entry.id === id)!
      const standing = goalStanding(goal, progressFor(goal.id), NOW_ISO)
      return standing.kind === 'past_target' ? standing.daysPast : -1
    })
    expect([...daysPast].sort((a, b) => b - a)).toEqual(daysPast)
  })

  it('can be filtered to the closures nobody asked the resident about', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt('/goals')
    await settled(container)

    await user.click(
      container.querySelector<HTMLButtonElement>('[data-filter="not_asked"]')!,
    )
    await waitFor(() => {
      const rows = [...container.querySelectorAll('[data-row]')]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(
          row.querySelector('[data-said="not_asked"]'),
          row.getAttribute('data-row') ?? 'row',
        ).toBeTruthy()
      }
    })
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the goals tab', async () => {
    await check(`/residents/${residentOf(GOAL_GAP_IDS.pastTargetNoProgress).id}/goals`)
  }, 20000)

  it('has no violations on the empty tab', async () => {
    await check(`/residents/${noGoalsLongHere.id}/goals`)
  }, 20000)

  it('has no violations on the queue', async () => {
    await check('/goals')
  }, 20000)
})
