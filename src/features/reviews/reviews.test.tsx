import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDate, IsoDateTime, Resident } from '@/data/types'
import { CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import {
  resetSessionWholePlanReviews,
  withSessionWholePlanReview,
} from '@/data/access/whole-plan-review-store'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { CarePlanQueueRoute } from '@/features/care-plan/CarePlanQueueRoute'
import { ReviewQueueRoute } from './ReviewQueueRoute'
import { WholePlanReviewRoute } from './WholePlanReviewRoute'
import { projectReviews } from './projection'
import { MIN_POPULATION_FOR_A_RATE } from '@/data/types'
import { coverageOver } from './coverage'

/**
 * Reviews. PRD §6.7.
 *
 * The module's own hazard is that it is a queue over records three other
 * modules already own. **Every figure here is a count across three
 * populations**, so the ways to be wrong are arithmetic rather than visual:
 * summing two findings that answer different questions, counting a record that
 * does not exist, or dropping one that does and calling the remainder
 * complete.
 *
 * Pinned to the instant the fixtures were generated against — never scheduled,
 * overdue, due soon and "was it late" are all arithmetic on today (§8).
 */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime
const TODAY = NOW_ISO.slice(0, 10) as IsoDate

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
})

afterAll(() => {
  vi.useRealTimers()
})

afterEach(() => {
  resetSessionWholePlanReviews()
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'reviews', element: <ReviewQueueRoute /> },
      { path: 'care-plans', element: <CarePlanQueueRoute /> },
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'care-plan/review', element: <WholePlanReviewRoute /> }],
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
      container.querySelector('[data-row], [data-domain], [data-finding]'),
    ).toBeTruthy(),
  )

/* ------------------------------------------------------------- projection */

describe('three populations behind one projection', () => {
  const projection = projectReviews(residents, NOW_ISO)

  it('counts every record that could carry a review date, and nothing twice', () => {
    /*
     * Derived from the record rather than from the projection, so the test
     * asks what could be reviewed rather than what the code decided to build.
     */
    const assessed = residents.flatMap((resident) =>
      RISK_ASSESSMENT_TEMPLATES.filter(
        (template) => resident.risks[template.id].kind === 'assessed',
      ),
    ).length
    const written = residents.flatMap((resident) =>
      resident.carePlan.filter(
        (domain) =>
          domain.status.kind === 'complete' || domain.status.kind === 'review_due',
      ),
    ).length
    const wholePlans = residents.length

    expect(projection.items.length).toBe(assessed + written + wholePlans)
    expect(new Set(projection.items.map((item) => item.id)).size).toBe(
      projection.items.length,
    )
  })

  it('excludes both empty slots by the same rule, and names both', () => {
    /*
     * **Reviewability is the property, and it applies to both the same way.**
     * All ten domains and all nine templates are slots that exist for every
     * resident; neither is more of a record than the other, and counting one
     * and not the other was an asymmetry with no rule behind it.
     *
     * Asserted as a pair rather than one at a time, because the defect was
     * that the two were treated differently — a test for each in isolation
     * would have passed on the asymmetry.
     */
    const notAssessed = residents.flatMap((resident) =>
      RISK_ASSESSMENT_TEMPLATES.filter(
        (template) => resident.risks[template.id].kind !== 'assessed',
      ),
    ).length
    const notWritten = residents.flatMap((resident) =>
      resident.carePlan.filter(
        (domain) =>
          domain.status.kind === 'not_started' || domain.status.kind === 'in_progress',
      ),
    ).length

    expect(projection.neverAssessed).toBe(notAssessed)
    expect(projection.neverWritten).toBe(notWritten)
    expect(notAssessed).toBeGreaterThan(0)
    expect(notWritten).toBeGreaterThan(0)

    // And neither appears as a row. A queue about reviews does not carry a row
    // saying a review cannot exist — that is another screen's finding wearing
    // this screen's shape.
    const written = new Set(
      residents.flatMap((resident) =>
        resident.carePlan
          .filter(
            (domain) =>
              domain.status.kind === 'complete' || domain.status.kind === 'review_due',
          )
          .map((domain) => `${resident.id}|domain|${domain.domainId}`),
      ),
    )
    for (const item of projection.items) {
      if (item.kind !== 'care_plan_domain') continue
      expect(written.has(item.id), item.id).toBe(true)
    }
  })

  it('derives overdue from the date rather than trusting a stored kind', () => {
    // `ReviewState.overdue` stores `daysOverdue`, which was right when it was
    // written and wrong the next morning. A record still reading `scheduled`
    // with a date in the past is overdue, and the projection says so.
    const stale = residents.find((resident) =>
      RISK_ASSESSMENT_TEMPLATES.some((template) => {
        const risk = resident.risks[template.id]
        return (
          risk.kind === 'assessed' &&
          (risk.reviewState.kind === 'scheduled' || risk.reviewState.kind === 'due') &&
          risk.reviewState.dueOn < TODAY
        )
      }),
    )
    if (!stale) return

    const items = projectReviews([stale], NOW_ISO).items
    for (const item of items) {
      if (item.standing.kind === 'scheduled') {
        expect(item.standing.dueOn >= TODAY, item.id).toBe(true)
      }
    }
  })

  it('never sums the findings, because they answer different questions', () => {
    const never = projection.items.filter(
      (item) => item.standing.kind === 'never_scheduled',
    )
    const overdue = projection.items.filter((item) => item.standing.kind === 'overdue')
    // Disjoint by construction, and the screen renders them side by side. A
    // record nobody scheduled and a record whose date has passed are different
    // claims, and a total of the two says something neither does.
    const ids = new Set(never.map((item) => item.id))
    expect(overdue.some((item) => ids.has(item.id))).toBe(false)
    expect(never.length).toBeGreaterThan(0)
    expect(overdue.length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------- the queue */

describe('the review queue', () => {
  it('leads on records nobody ever scheduled a review for', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)

    const lead = container.querySelector('[data-finding="never-scheduled"]')
    expect(lead?.textContent).toMatch(/have no review scheduled at all/)
    expect(lead?.textContent).toMatch(/Nobody ever set a date/)
    // The denominator names what it counts, or the figure reads as one kind
    // of thing.
    expect(lead?.textContent).toMatch(/could carry a review date/)
    expect(lead?.textContent).toMatch(/assessed risks/)
    expect(lead?.textContent).toMatch(/written care plan domains/)
    expect(lead?.textContent).toMatch(/whole-plan reviews/)
  })

  it('names both exclusions rather than dropping them silently', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)

    const line = container.querySelector('[data-exclusions]')
    expect(line?.textContent).toMatch(/nobody has done/)
    expect(line?.textContent).toMatch(/nothing signed/)
    // And points at the queue where each one's own claim lives.
    expect(line?.querySelector('a[href="/risk-assessments"]')).toBeTruthy()
    expect(line?.querySelector('a[href="/care-plans"]')).toBeTruthy()
  })

  it('carries the kind on every row, so three populations do not read as one list', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)

    const kinds = new Set(
      [...container.querySelectorAll('[data-row]')].map((row) =>
        row.getAttribute('data-kind'),
      ),
    )
    expect(kinds.size).toBeGreaterThan(1)
    for (const row of container.querySelectorAll('[data-row]')) {
      expect(row.textContent).toMatch(
        /Risk assessment|Care plan domain|Whole care plan review/,
      )
    }
  })

  it('routes each row to the module that owns the act, and builds no third session', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)

    const projection = projectReviews(residents, NOW_ISO)
    const expected = new Map(
      projection.items.map((item) => [item.kind, item.actionLabel]),
    )
    expect(expected.get('risk_assessment')).toBe('Re-score')
    expect(expected.get('care_plan_domain')).toBe('Open domain')
    expect(expected.get('whole_care_plan')).toBe('Start review')

    for (const row of container.querySelectorAll('[data-row]')) {
      const href = row.querySelector('a')?.getAttribute('href') ?? ''
      // Every action lands inside a resident's own record, never on a screen
      // this module invented.
      expect(href, href).toMatch(/^\/residents\//)
    }
  })

  it('sorts never scheduled above overdue, because it has no wait to measure', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(container.querySelector<HTMLButtonElement>('[data-filter="all"]')!)

    await waitFor(() => {
      const states = [...container.querySelectorAll('[data-row]')]
        .slice(0, 12)
        .map((row) => row.textContent ?? '')
      expect(states[0]).toMatch(/Never scheduled/)
    })
  })
})

/* --------------------------------------------------------- the completed filter */

describe('the completed filter', () => {
  const click = async (container: HTMLElement, filter: string) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(
      container.querySelector<HTMLButtonElement>(`[data-filter="${filter}"]`)!,
    )
  }

  it('swaps the lead for an Aggregate, because a completed list has no gap to lead on', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)
    await click(container, 'completed')

    await waitFor(() => expect(container.querySelector('[data-coverage]')).toBeTruthy())
    // The finding cards are gone — there is no gap here to lead on.
    expect(container.querySelector('[data-finding="never-scheduled"]')).toBeNull()

    const coverage = container.querySelector('[data-coverage]')
    // Rule 4: no bare percentage. The denominator is rendered beside it.
    expect(coverage?.textContent).toMatch(/\d+ of \d+/)
    expect(coverage?.textContent).toMatch(/completed after their date/)
  })

  /*
   * The caution fill is below 3:1 by decision, on the condition that it never
   * marks a state alone. This coverage bar was one stacked bar whose late
   * segment was identified by hue and nothing else, so every coloured bar now
   * sits in a row that names its state. Asserted by structure: a bar outside a
   * named row is the defect, whatever colour it is.
   */
  it('names the state beside every coloured coverage bar', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)
    await click(container, 'completed')
    await waitFor(() => expect(container.querySelector('[data-coverage]')).toBeTruthy())

    const coverage = container.querySelector('[data-coverage]')!
    const bars = [...coverage.querySelectorAll('i')]
    expect(bars).toHaveLength(2)
    for (const bar of bars) {
      expect(
        bar.closest('[data-coverage-row]'),
        'a coverage bar outside a named row',
      ).not.toBeNull()
    }
    const name = (row: string) =>
      coverage.querySelector(`[data-coverage-row="${row}"]`)?.firstElementChild
        ?.textContent
    expect(name('on_time')).toBe('On time')
    expect(name('late')).toBe('Late')
  })

  it('renders a completed review as a settled record, author and both dates visible', async () => {
    const { container } = renderAt('/reviews')
    await settled(container)
    await click(container, 'completed')

    const row = await waitFor(() => {
      const found = container.querySelector('[data-row]')
      expect(found).toBeTruthy()
      return found!
    })
    // Quiet is not hidden. This is the evidence a review happened, and until
    // this phase it existed in the data and appeared on no screen at all.
    expect(row.querySelector('[data-completed]')).toBeTruthy()
    expect(row.textContent).toMatch(/Reviewed/)
    expect(row.textContent).toMatch(/next due/)
    expect(row.querySelector('[data-state-chip]')).toBeNull()
  })

  it('says a review was completed late, and the lateness survives the completion', async () => {
    const projection = projectReviews(residents, NOW_ISO)
    const late = projection.items.filter(
      (item) => item.standing.kind === 'completed' && item.standing.late,
    )
    expect(late.length, 'no completed review in the set was done late').toBeGreaterThan(
      0,
    )

    const { container } = renderAt('/reviews')
    await settled(container)
    await click(container, 'completed')

    await waitFor(() => expect(container.querySelector('[data-late]')).toBeTruthy())
    expect(container.querySelector('[data-late]')?.textContent).toMatch(
      /after it was due/,
    )
  })

  it('does not call a review on time when there was no date to be on time for', () => {
    /*
     * A review nobody ever scheduled can still be done, and it had no deadline
     * to beat. Inventing one would produce a lateness nobody can check, so the
     * record says what happened instead of choosing between late and on time.
     */
    const standing = projectReviews(residents, NOW_ISO).items.map(
      (item) => item.standing,
    )
    for (const one of standing) {
      if (one.kind !== 'completed') continue
      if (one.against.kind === 'never_scheduled') expect(one.late).toBe(false)
    }
  })

  it('replaces the rate with Insufficient Evidence below the floor', () => {
    // Never 100% off a denominator of two. Rendering the denominator is
    // necessary and not sufficient — "100% — 2 of 2" is true and still invites
    // a judgement two records cannot support.
    const thin = coverageOver(
      projectReviews(residents.slice(0, 1), NOW_ISO).items.slice(0, 1),
      '2000-01-01' as IsoDate,
    )
    expect(thin.aggregate.kind).toBe('insufficient_evidence')

    const full = coverageOver(
      projectReviews(residents, NOW_ISO).items,
      '2000-01-01' as IsoDate,
    )
    expect(full.aggregate.kind).toBe('measured')
    if (full.aggregate.kind !== 'measured') return
    expect(full.aggregate.coverage.total).toBeGreaterThanOrEqual(
      MIN_POPULATION_FOR_A_RATE,
    )
  })

  it('counts a completed review against the date it was due, not the date it was done', () => {
    /*
     * Otherwise a home that clears a year's backlog in one afternoon makes the
     * year it neglected disappear.
     */
    const items = projectReviews(residents, NOW_ISO).items
    const oldDue = items.filter(
      (item) =>
        item.standing.kind === 'completed' &&
        item.standing.against.kind === 'due_on' &&
        item.standing.against.dueOn < '2026-01-01',
    )
    const recent = coverageOver(items, '2026-01-01' as IsoDate)
    const everything = coverageOver(items, '2000-01-01' as IsoDate)
    if (oldDue.length === 0) return
    expect(everything.onTime + everything.late).toBeGreaterThan(
      recent.onTime + recent.late,
    )
  })
})

/* ------------------------------------------------- the whole-plan session */

describe('the whole care plan review session', () => {
  /** A resident whose plan has gaps — which is the ordinary case, not the rare one. */
  const withGaps = residents.find((resident) =>
    resident.carePlan.some((domain) => domain.status.kind !== 'complete'),
  )!

  it('has a fixture reaching a plan with gaps in it', () => {
    expect(withGaps).toBeDefined()
  })

  it('names each outstanding domain individually, rather than counting them', async () => {
    const { container } = renderAt(`/residents/${withGaps.id}/care-plan/review`)
    await settled(container)

    const block = container.querySelector('[data-will-store]')
    expect(block).toBeTruthy()
    const gaps = withGaps.carePlan.filter((domain) => domain.status.kind !== 'complete')
    for (const gap of gaps) {
      expect(
        container.querySelector(`[data-outstanding="${gap.domainId}"]`),
        gap.domainId,
      ).toBeTruthy()
    }
    // A figure says how much was missing; the names say what.
    expect(block?.textContent).toMatch(
      /the record carries what was outstanding when you signed it/,
    )
  })

  it('can be completed over gaps, and the record carries which ones', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt(`/residents/${withGaps.id}/care-plan/review`)
    await settled(container)

    const gaps = withGaps.carePlan
      .filter((domain) => domain.status.kind !== 'complete')
      .map((domain) => domain.domainId)
    expect(gaps.length).toBeGreaterThan(0)

    await user.click(container.querySelector<HTMLButtonElement>('[data-complete]')!)
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    // The subject is named in the sentence, never "Are you sure?" (§2.4).
    expect(dialog.textContent).toContain(withGaps.fullLegalName)
    await user.click(within(dialog).getByRole('button', { name: /^Complete review$/i }))

    await waitFor(() =>
      expect(container.querySelector('[data-undo-review]')).toBeTruthy(),
    )

    /*
     * The whole point of the phase: the signature stores what was outstanding,
     * so it can never later read as covering more than it did.
     *
     * Read back through the store's own patch — which is what every screen
     * reads the resident through — rather than off the screen that wrote it.
     * The first version of this asserted `after.items.length > 0` on the
     * *unpatched* fixture, which is true before the click and after it: a test
     * that cannot fail is not a test.
     */
    const after = withSessionWholePlanReview(withGaps)
    expect(after.carePlanReview.kind).toBe('completed')
    if (after.carePlanReview.kind !== 'completed') return
    expect(after.carePlanReview.outstanding.kind).toBe('outstanding')
    if (after.carePlanReview.outstanding.kind !== 'outstanding') return
    expect([...after.carePlanReview.outstanding.domains].sort()).toEqual(
      [...gaps].sort(),
    )
    // And it is not silently "on time" against a deadline nobody set.
    expect(after.carePlanReview.against.kind).toBe(
      withGaps.carePlanReview.kind === 'never_scheduled' ||
        withGaps.carePlanReview.kind === 'completed'
        ? 'never_scheduled'
        : 'due_on',
    )

    const foot = container.querySelector('[data-foot-state]')
    expect(foot?.textContent).toMatch(/The review is recorded/)
    expect(foot?.textContent).toMatch(/outstanding domain/)
  })

  it('undoes the completion, because there is no backend to correct a mis-click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt(`/residents/${withGaps.id}/care-plan/review`)
    await settled(container)

    await user.click(container.querySelector<HTMLButtonElement>('[data-complete]')!)
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    await user.click(within(dialog).getByRole('button', { name: /^Complete review$/i }))
    await waitFor(() =>
      expect(container.querySelector('[data-undo-review]')).toBeTruthy(),
    )

    await user.click(container.querySelector<HTMLButtonElement>('[data-undo-review]')!)
    await waitFor(() => expect(container.querySelector('[data-complete]')).toBeTruthy())
  })

  it('is read-only about the plan: the writing belongs to the editor', async () => {
    const { container } = renderAt(`/residents/${withGaps.id}/care-plan/review`)
    await settled(container)

    // Two screens that can both write one domain is two ways to do one thing.
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = container.querySelector(`[data-domain="${domain.id}"]`)
      expect(row?.querySelector('textarea'), domain.id).toBeNull()
      expect(
        row?.querySelector(`[data-open-domain="${domain.id}"]`),
        domain.id,
      ).toBeTruthy()
    }
  })
})

/* ------------------------------------------------------ the care plan queue */

describe('the care plan queue', () => {
  it('leads on domains nobody has written: a different claim from the review queue', async () => {
    const { container } = renderAt('/care-plans')
    await settled(container)

    const lead = container.querySelector('[data-finding="never-written"]')
    expect(lead?.textContent).toMatch(/have never been written down/)
    expect(lead?.textContent).toMatch(/domains the home is expected to hold/)

    // And it says where the other question is answered, rather than answering
    // it twice under two names.
    expect(
      container.querySelector('[data-review-link] a[href="/reviews"]'),
    ).toBeTruthy()
  })

  it('keeps started-and-unsigned as its own finding, never folded into never written', async () => {
    const { container } = renderAt('/care-plans')
    await settled(container)

    const never = container.querySelector('[data-finding="never-written"]')
    const unsigned = container.querySelector('[data-finding="unsigned"]')
    expect(unsigned?.textContent).toMatch(/started and never signed/)
    expect(unsigned?.textContent).toMatch(/staff have nothing to follow/)
    // Two facts, two figures. Somebody who started is not somebody who looked
    // and decided there was nothing to write.
    expect(never?.textContent).not.toMatch(/started/)
  })

  it('states every resident against every domain, from the constant', async () => {
    const { container } = renderAt('/care-plans')
    await settled(container)

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(container.querySelector<HTMLButtonElement>('[data-filter="all"]')!)

    /*
     * The denominator, through the claim the screen makes.
     *
     * Two versions of this have now been wrong in different ways. It began as
     * `rows.length % 10 === 0`, true of ten, of twenty and of an empty list.
     * It was then hardened to count rendered rows against residents × domains,
     * which was correct until the queue was paged — and then it did not fail,
     * it **stopped matching**, which is the harder one to notice: a red test
     * that has stopped being about the thing invites you to adjust the number
     * until it is green again.
     *
     * Counting rows was always a proxy for "the constant is the source". The
     * claim is the thing itself, and it survives any change to how many rows
     * are drawn.
     */
    const expected =
      residents.filter((resident) => resident.siteId === 'site-rosewood-court').length *
      CARE_PLAN_DOMAINS.length

    await waitFor(() => {
      expect(container.querySelector('[data-pager-slice]')?.textContent).toMatch(
        new RegExp(`of\\s*${expected}\\s*care plan domains`),
      )
    })

    // And what is drawn is a page of it, not the whole set — otherwise the
    // assertion above would pass on a screen that never paged at all.
    expect(container.querySelectorAll('[data-row]').length).toBeLessThan(expected)
  })

  /**
   * Paging can bury a finding by ordering alone.
   *
   * If page one holds written domains and the gaps land on page twelve, the
   * screen has hidden them as surely as a green tile would — the same failure
   * reached through sequence rather than colour. So: the default view is the
   * gap, and under "All" the gaps are still on the first page.
   */
  it('keeps the gaps on the first page, not on page twelve', async () => {
    const { container } = renderAt('/care-plans')
    await settled(container)

    const gapsOnPageOne = () =>
      [...container.querySelectorAll('[data-row]')].filter(
        (row) => row.getAttribute('data-state') === 'not_started',
      ).length

    /*
     * The default view is the gap itself — asserted on the control, not on the
     * rows.
     *
     * This first checked that every row on page one was a gap, which passed
     * with the default set to "All": the sort puts gaps first, so page one is
     * all gaps either way. The assertion was satisfied by the mechanism it was
     * meant to be independent of. Ask the filter which one it is.
     */
    await waitFor(() =>
      expect(container.querySelectorAll('[data-row]').length).toBeGreaterThan(0),
    )
    expect(
      container
        .querySelector('[data-filter="never_written"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(gapsOnPageOne()).toBe(container.querySelectorAll('[data-row]').length)

    // And widening to everything does not push them off the first page.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(container.querySelector<HTMLButtonElement>('[data-filter="all"]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-pager-slice]')).toBeTruthy(),
    )
    expect(gapsOnPageOne()).toBeGreaterThan(0)
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the review queue', async () => {
    await check('/reviews')
  }, 20000)

  it('has no violations on the care plan queue', async () => {
    await check('/care-plans')
  }, 20000)

  it('has no violations on the review session', async () => {
    const withGaps = residents.find((resident: Resident) =>
      resident.carePlan.some((domain) => domain.status.kind !== 'complete'),
    )!
    await check(`/residents/${withGaps.id}/care-plan/review`)
  }, 20000)
})
