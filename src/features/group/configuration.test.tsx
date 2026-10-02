import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import {
  configuredState,
  countsTowardsExpected,
  isActive,
  resetSessionSiteConfig,
  setActive,
} from '@/data/access/site-config-store'
import { figures, resetSessionSettings } from '@/data/access/settings-store'
import { nextReviewFrom } from '@/lib/review-interval'
import { AssessmentListTab } from '@/features/risk/AssessmentListTab'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { residents } from '@/data/fixtures/residents'
import type { IsoDate } from '@/data/types'
import { navItems, navLabel } from '@/app/nav-items.icons'
import { vocabularyFor } from '@/lib/vocabulary'

/**
 * The configuration model. AM v2.0 SETT-01, Phase 22.
 *
 * **The subject is which settings reach back.** A setting is either a claim
 * about the future or a term in a claim the record already makes, and only the
 * second needs a second rendering rule. These assert both halves: that the
 * first kind moves nothing already written, and that the second renders all
 * four states of the pair.
 */

afterEach(() => {
  resetSessionSiteConfig()
  resetSessionSettings()
})

const subject = residents.find((r) => r.siteId === 'site-rosewood-court')!

function renderRisks(residentId: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'risk-assessments', element: <AssessmentListTab /> }],
      },
    ],
    { initialEntries: [`/residents/${residentId}/risk-assessments`] },
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

describe('a setting that reaches back renders all four states', () => {
  it('names every combination of what the home asks and what the record says', () => {
    const site = 'site-rosewood-court'

    expect(configuredState(site, 'falls', true)).toBe('in_use')
    expect(configuredState(site, 'falls', false)).toBe('in_use_unanswered')

    setActive(site, 'falls', false)
    expect(configuredState(site, 'falls', true)).toBe('retired_answered')
    expect(configuredState(site, 'falls', false)).toBe('retired_unanswered')
  })

  it('counts only what the home asks, and says the rest are not counted', async () => {
    const site = 'site-rosewood-court'
    setActive(site, 'coshh', false)

    const { container } = renderRisks(subject.id)
    await waitFor(() =>
      expect(container.querySelector('[data-never-assessed]')).toBeTruthy(),
    )

    /*
     * Counting a retired template would report a gap that is an artefact of a
     * setting rather than of the record — the filtered-set rule arriving
     * through a configuration instead of a control. So the claim carries it.
     */
    expect(container.querySelector('[data-retired-note]')!.textContent).toMatch(
      /not carried out at this home and are not counted/i,
    )
  }, 20000)

  it('renders a retired unanswered template plain, and never hatched', async () => {
    const site = 'site-rosewood-court'
    const never = Object.entries(subject.risks).find(
      ([, status]) => status.kind === 'not_assessed',
    )!
    setActive(site, never[0], false)

    const { container } = renderRisks(subject.id)
    await waitFor(() =>
      expect(container.querySelector(`[data-template="${never[0]}"]`)).toBeTruthy(),
    )

    const row = container.querySelector(`[data-template="${never[0]}"]`)!
    expect(row.getAttribute('data-configured')).toBe('retired_unanswered')
    /*
     * **The assertion this setting exists for.** The hatch says nobody has
     * looked, and it invites completion; here the home has decided there is
     * nothing to look at, which is a different fact and not a gap anybody can
     * close.
     */
    expect(row.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(row.querySelector('[data-not-carried-out]')).toBeTruthy()
  }, 20000)

  it('keeps a record on a retired template, with its score and its date', async () => {
    const site = 'site-rosewood-court'
    const assessed = Object.entries(subject.risks).find(
      ([, status]) => status.kind === 'assessed',
    )
    if (assessed === undefined) return
    setActive(site, assessed[0], false)

    const { container } = renderRisks(subject.id)
    await waitFor(() =>
      expect(container.querySelector(`[data-template="${assessed[0]}"]`)).toBeTruthy(),
    )

    const row = container.querySelector(`[data-template="${assessed[0]}"]`)!
    expect(row.getAttribute('data-configured')).toBe('retired_answered')
    // Somebody did this, with their name and the date on it. Hiding it would
    // delete work; the note beside it says why nobody is asked to redo it.
    expect(row.querySelector('[data-retired]')).toBeTruthy()
    expect(row.textContent).toMatch(/record stays/i)
  }, 20000)
})

describe('a setting that is a claim about the future moves nothing already written', () => {
  it('applies the review interval to new dates, and the control now applies at all', () => {
    const from = '2026-01-15' as IsoDate

    /*
     * **This was the finding that came out of asking.** `nextReviewFrom` read
     * the constant directly and `reviewIntervalMonths()` had no readers, so
     * the settings card said "applies to reviews completed from now on" and
     * applied to nothing. A control that claims a specific effect and has none
     * is worse than a dead one: the specificity is what makes it trusted.
     */
    expect(nextReviewFrom(from, 6)).toBe('2026-07-15')
    expect(nextReviewFrom(from, 3)).toBe('2026-04-15')
    expect(nextReviewFrom(from)).toBe(nextReviewFrom(from, 6))
  })

  it('offers no control for a figure the records were generated against', () => {
    const rounds = figures().find((entry) => entry.id === 'round-times')!
    expect(rounds.fixedAtGeneration).toBe(true)
    // And the reason is on the card rather than in a comment.
    expect(rounds.effect).toMatch(/produced against these four times/i)
  })
})

describe('turning something off changes no record', () => {
  it('leaves every assessment exactly as it was', () => {
    const before = JSON.stringify(subject.risks)
    setActive('site-rosewood-court', 'falls', false)
    expect(JSON.stringify(subject.risks)).toBe(before)
    expect(isActive('site-rosewood-court', 'falls')).toBe(false)
    expect(
      countsTowardsExpected(configuredState('site-rosewood-court', 'falls', true)),
    ).toBe(false)
  })
})

/**
 * The module names this screen restates, held against the one that owns them.
 *
 * **A guard rather than a comment, because a comment did not hold.** The
 * staff activity log and the document library each carried their own copies of
 * five sidebar labels, each with a docblock saying `nav-items.icons.ts` owned
 * the wording — true while every label was fixed, and silently false the
 * moment Care Plans started taking a configured term. Both were found by the
 * terminology crawl rather than by reading those comments.
 *
 * `settings-store` is the one place that cannot read `navLabel`: nothing else
 * in `src/data` reaches into `src/app`, so it composes from the term instead.
 * That is a second producer of one name, and this is what stops the two
 * disagreeing — a nav item that drops its term, or changes form, fails here.
 */
describe('a figure says where it shows in the words the sidebar uses', () => {
  const carePlans = navItems.find((item) => item.path === '/care-plans')!

  it.each([
    ['care_plan', 'Care Plans'],
    ['care_and_support_plan', 'Care & Support Plans'],
  ])('names the Care Plans module as %s renders it', (choice, expected) => {
    const terms = vocabularyFor('care_home', { carePlan: choice })
    // The sidebar's own label, through the owner of that resolution.
    expect(navLabel(carePlans, terms)).toBe(expected)

    /*
     * The two figures held by id, not by a pattern over their text. Selecting
     * on `includes('Reviews')` picked up a third figure that lists Reviews and
     * not the plan — the §8 specificity defect, in a guard written to catch a
     * naming one. A figure that stops naming the module fails the first
     * assertion rather than quietly dropping out of the set.
     */
    const named = ['due-soon-days', 'review-interval-months']
    for (const id of named) {
      const figure = figures().find((entry) => entry.id === id)
      expect(figure, id).toBeTruthy()
      expect(figure!.seenOn(terms), id).toContain(navLabel(carePlans, terms))
    }
  })
})
