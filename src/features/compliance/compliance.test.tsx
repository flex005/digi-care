import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { CheckResult, IsoDateTime, Site } from '@/data/types'
import {
  INSUFFICIENT_EVIDENCE_THRESHOLD,
  MIN_POPULATION_FOR_A_RATE,
} from '@/data/types'
import { sites } from '@/data/fixtures/organisation'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { ComplianceOverviewRoute } from './ComplianceOverviewRoute'
import { KeyQuestionRoute } from './KeyQuestionRoute'
import { InspectionPackRoute } from './InspectionPackRoute'
import { NotificationsRoute } from './NotificationsRoute'
import { loadCompliance } from './data'
import { KEY_QUESTIONS, runPanels } from './key-questions'
import { headlineFor } from './analysis'
import { formatCount } from '@/lib/format'
import hatch from '@/styles/unrecorded.module.css'
import { packContents } from './pack'
import { BANDS, bandFor, reading, verdictFor } from './rating'

/**
 * CQC compliance and the Dashboard. PRD §2.3, §6.7, Phase 12.
 *
 * **The module's hazard is a rating that looks like a finding when it is the
 * absence of one.** Everything here is about keeping three states apart: a
 * finding, a figure too thin to support one, and a thing this product does not
 * record at all.
 */

/** Pinned, and every date-dependent assertion is written against it. */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

const rosewood = sites[0]!
const ashgrove = sites[1]!

/**
 * Switches the session to a named site on mount.
 *
 * The active site comes from the session and never from a route or a prop
 * (PRD §2.4), so a test that wants the thin home has to say so the way the
 * switcher does.
 */
function UseSite({ site }: { site: Site }) {
  const { activeSite, setActiveSite } = useSession()
  useEffect(() => {
    if (activeSite.id !== site.id) setActiveSite(site)
  }, [activeSite, setActiveSite, site])
  return null
}

function renderAt(path: string, site?: Site) {
  const router = createMemoryRouter(
    [
      { path: 'compliance', element: <ComplianceOverviewRoute /> },
      { path: 'compliance/pack', element: <InspectionPackRoute /> },
      { path: 'compliance/notifications', element: <NotificationsRoute /> },
      { path: 'compliance/:keyQuestion', element: <KeyQuestionRoute /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          {site ? <UseSite site={site} /> : null}
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(
    () =>
      expect(
        container.querySelector(
          '[data-panel], [data-check], [data-pack-section], [data-filter-claim]',
        ),
      ).toBeTruthy(),
    { timeout: 20000 },
  )

const derived = (id: string, rating: 'green' | 'amber' | 'red'): CheckResult => ({
  kind: 'derived',
  definition: { kind: 'derived', id, name: id, from: 'test' },
  reading: {
    kind: 'measured',
    aggregate: {
      kind: 'measured',
      unit: 'percentage',
      value: 100,
      coverage: { covered: 10, total: 10 },
    },
    rating,
    detail: id,
  },
})

const thin = (id: string): CheckResult => ({
  kind: 'derived',
  definition: { kind: 'derived', id, name: id, from: 'test' },
  reading: {
    kind: 'insufficient',
    aggregate: {
      kind: 'insufficient_evidence',
      coverage: { covered: 1, total: 2 },
      missingDescription: 'too few',
    },
    detail: id,
  },
})

const absent = (id: string): CheckResult => ({
  kind: 'not_held',
  definition: { kind: 'not_held', id, name: id, statement: `${id} is not recorded.` },
})

describe('a panel is only as good as its worst usable check', () => {
  it('takes the worst rather than an average', () => {
    const verdict = verdictFor([
      derived('a', 'green'),
      derived('b', 'green'),
      derived('c', 'green'),
      derived('d', 'amber'),
    ])
    expect(verdict.kind).toBe('rated')
    if (verdict.kind !== 'rated') return
    expect(verdict.rating).toBe('amber')
    expect(verdict.usable).toBe(4)
    // And it names the check the rating came from, not just the count of them.
    expect(verdict.driver.id).toBe('d')
  })

  it('renders Insufficient Evidence below the threshold, not a milder rating', () => {
    // Two usable of five is 40%, under the 60% floor.
    const verdict = verdictFor([
      derived('a', 'green'),
      derived('b', 'green'),
      thin('c'),
      thin('d'),
      thin('e'),
    ])
    expect(verdict.kind).toBe('insufficient_evidence')
  })

  it('does not let unusable checks count toward the threshold', () => {
    /*
     * The whole argument for the exclusion: five checks none of which can
     * support a figure must not make a panel look measured. If `thin` counted,
     * this panel would be 5/5 usable and rated green off one real check.
     */
    const optimistic = verdictFor([
      derived('a', 'green'),
      thin('b'),
      thin('c'),
      thin('d'),
      thin('e'),
    ])
    expect(optimistic.kind).toBe('insufficient_evidence')
    expect(optimistic.usable).toBe(1)
  })

  it('keeps not-held checks out of both numbers', () => {
    const verdict = verdictFor([
      derived('a', 'amber'),
      derived('b', 'green'),
      absent('c'),
      absent('d'),
    ])
    expect(verdict.kind).toBe('rated')
    if (verdict.kind !== 'rated') return
    expect(verdict.rating).toBe('amber')
    expect(verdict.usable).toBe(2)
    expect(verdict.total).toBe(2)
  })

  it('holds the threshold at its own boundary', () => {
    // Three of five is 60% exactly, which is not below the floor.
    const exact = verdictFor([
      derived('a', 'green'),
      derived('b', 'green'),
      derived('c', 'green'),
      thin('d'),
      thin('e'),
    ])
    expect(3 / 5).toBe(INSUFFICIENT_EVIDENCE_THRESHOLD)
    expect(exact.kind).toBe('rated')
  })

  it('cannot rate a panel with no derived checks at all', () => {
    expect(verdictFor([absent('a')]).kind).toBe('insufficient_evidence')
  })
})

describe('a figure and the reason there is none', () => {
  it('replaces a thin population with Insufficient Evidence, not a rating', () => {
    const result = reading({
      coverage: { covered: 1, total: MIN_POPULATION_FOR_A_RATE - 1 },
      detail: 'one of seven',
      missing: 'too few',
    })
    expect(result.kind).toBe('insufficient')
  })

  it('bands a coverage figure at its own edges', () => {
    expect(bandFor(BANDS.good)).toBe('green')
    expect(bandFor(BANDS.good - 1)).toBe('amber')
    expect(bandFor(BANDS.acceptable)).toBe('amber')
    expect(bandFor(BANDS.acceptable - 1)).toBe('red')
  })

  it('carries a caveat on a reading that cannot support a figure', () => {
    /*
     * Fire and legionella are always below the floor — one document, one site
     * — and they are exactly the checks whose evidence needs qualifying. A
     * caveat only the measured member could hold would never be seen.
     */
    const result = reading({
      coverage: { covered: 1, total: 1 },
      detail: 'a document is on file',
      missing: 'one document cannot support a rate',
      caveat: 'Evidenced by a document existing, not by an assessment record.',
    })
    expect(result.kind).toBe('insufficient')
    expect(result.caveat).toContain('not by an assessment record')
  })
})

describe('the five panels over the real record', () => {
  it('reaches every check state somewhere in the record', async () => {
    const data = await loadCompliance(rosewood, NOW_ISO)
    const readings = runPanels(data)
      .flatMap((panel) => panel.results)
      .filter((result) => result.kind === 'derived')

    const ratings = new Set(
      readings.map((result) =>
        result.reading.kind === 'measured' ? result.reading.rating : 'insufficient',
      ),
    )
    // Every state a component can render needs a fixture that reaches it.
    expect(ratings).toEqual(new Set(['green', 'amber', 'red', 'insufficient']))
  }, 30000)

  it('renders the thin site as Insufficient Evidence rather than as bad', async () => {
    const data = await loadCompliance(ashgrove, NOW_ISO)
    const verdicts = runPanels(data).map((panel) => panel.verdict.kind)
    // Ashgrove exists to be thin. A four-resident home is not a failing home.
    expect(verdicts).toContain('insufficient_evidence')
  }, 30000)

  it('names the check each rating came from, and they are not all the same', async () => {
    const data = await loadCompliance(rosewood, NOW_ISO)
    const rated = runPanels(data)
      .map((panel) => panel.verdict)
      .filter((verdict) => verdict.kind === 'rated')

    expect(rated.length).toBeGreaterThan(1)
    for (const verdict of rated) {
      if (verdict.kind !== 'rated') continue
      expect(verdict.driver.name).not.toBe('')
      expect(verdict.driver.detail).toMatch(/\d/)
    }

    /*
     * The readability argument, asserted rather than assumed: worst-of over a
     * home with real gaps returns red on every panel, and five panels all
     * saying "Red — worst of nine checks" would be five identical sentences.
     * Naming the driving check is what makes them five different ones.
     */
    const drivers = new Set(
      rated.flatMap((verdict) => (verdict.kind === 'rated' ? [verdict.driver.id] : [])),
    )
    expect(drivers.size).toBeGreaterThan(1)
  }, 30000)

  it('gives every Key Question at least one thing this product does not record', () => {
    for (const question of KEY_QUESTIONS) {
      const absent = question.checks.filter((check) => check.kind === 'not_held')
      expect(absent.length, question.name).toBeGreaterThan(0)
    }
  })

  it('never says the home has failed to record what the product does not hold', () => {
    for (const question of KEY_QUESTIONS) {
      for (const check of question.checks) {
        if (check.kind !== 'not_held') continue
        // The wording is the whole point: a gap in the system, not in the home.
        expect(check.statement, check.id).toMatch(/diGi-Care/)
        expect(check.statement, check.id).not.toMatch(
          /the home|nobody has|has not been/i,
        )
      }
    }
  })
})

describe('the compliance overview', () => {
  it('lists the five Key Questions in CQC order, never by rating', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const rendered = [...container.querySelectorAll('[data-panel]')].map((panel) =>
      panel.getAttribute('data-panel'),
    )
    expect(rendered).toEqual(KEY_QUESTIONS.map((question) => question.id))
  }, 30000)

  it('carries the placeholder banner', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const banner = container.querySelector('[data-placeholder-banner]')!
    expect(banner.textContent).toContain('are placeholders')
    expect(banner.textContent).toContain('No regulatory conclusion')
    expect(banner.getAttribute('data-state')).toBe('unrecorded')
  }, 30000)

  it('states how many checks can support a figure on every panel', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    for (const question of KEY_QUESTIONS) {
      const panel = container.querySelector(`[data-panel="${question.id}"]`)!
      const coverage = panel.querySelector('[data-coverage-text]')!
      expect(coverage.textContent, question.id).toMatch(
        /of \d+ checks can support a figure/,
      )
    }
  }, 30000)

  it('renders not-held without the hatch', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const notHeld = container.querySelector('[data-not-held]')!
    /*
     * Its own treatment, deliberately inert. The hatch means "a gap you can
     * close" and Insufficient Evidence already occupies it; a third meaning on
     * one pattern would break it for the other two.
     */
    expect(notHeld.getAttribute('data-state')).not.toBe('unrecorded')
    expect(notHeld.closest('[data-state="unrecorded"]')).toBeNull()
  }, 30000)
})

describe('the analytical layout refuses what it was built to refuse', () => {
  /*
   * Pinned to the instant the fixtures were generated against, and the
   * expectations are computed from the same loader the screen uses rather than
   * from figures typed here — a hardcoded 4 would pass while the screen showed
   * the wrong four.
   */
  const expected = async () =>
    headlineFor(runPanels(await loadCompliance(rosewood, NOW_ISO)))

  it('leads on the checks that cannot support a figure, and nothing green', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const hero = container.querySelector('[data-hero]') as HTMLElement
    const headline = await expected()

    // The largest figure on the screen is the least reassuring one available.
    expect(hero.querySelector('[data-numeric]')!.textContent).toBe(
      formatCount(headline.unusable),
    )
    expect(hero.textContent).toContain(`of ${formatCount(headline.derived)} checks`)

    /*
     * No green in the hero, and no rating vocabulary at all. A rating there
     * would be a judgement over the whole home, which is the figure this
     * screen exists to refuse.
     */
    expect(hero.querySelector('[data-dot]')).toBeNull()
    expect(hero.querySelector('[data-rating]')).toBeNull()
    expect(hero.textContent).not.toMatch(/\bgreen\b/i)
  }, 30000)

  it('names both figures wherever it names a direction, and shows no bare arrow', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const page = container.querySelector('[data-compliance-overview]') as HTMLElement
    /*
     * "Improving" without both figures is a claim nobody can check, and an
     * arrow alone is that claim with the figures removed. There is no
     * comparison on this screen at all, which is the strongest form of it.
     */
    expect(page.textContent).not.toMatch(/[↑↓▲▼➚➘]/)
    expect(page.textContent).not.toMatch(/\b(up|down|improv|worsen|trend)\w*\s+\d/i)
  }, 30000)

  it('keeps the hatch a chart segment rather than a lighter shade of the bar', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const bars = [...container.querySelectorAll('[data-bar]')]
    expect(bars).toHaveLength(KEY_QUESTIONS.length)

    for (const bar of bars) {
      const gap = bar.querySelector('[data-bar-segment="gap"]')!
      const recorded = bar.querySelector('[data-bar-segment="recorded"]')!
      /*
       * The same pattern the rest of the product uses, not a tint of the
       * recorded colour — so the distinction survives greyscale. Asserted
       * against the shared stylesheet rather than a class name typed here.
       */
      expect(gap.className, bar.getAttribute('data-bar') ?? '').toContain(
        hatch.unrecorded,
      )
      expect(recorded.className).not.toContain(hatch.unrecorded)
      // And the bar says what it counts, so "missing" is a number to act on.
      expect(bar.textContent).toMatch(/\d+ of [\d,]+ [a-z]/)
    }
  }, 30000)

  it('states no figure over the whole home outside a Key Question of its own', async () => {
    const { container } = renderAt('/compliance')
    await settled(container)

    const page = container.querySelector('[data-compliance-overview]') as HTMLElement
    for (const row of page.querySelectorAll('[data-panel]')) row.remove()

    /*
     * What is left is the hero, the two minis, the chart and the footer —
     * everything that speaks for the home as a whole. A percentage in any of
     * them is an overall compliance figure however it is labelled.
     */
    expect(page.textContent).not.toContain('%')
    expect(page.querySelector('[data-no-overall]')!.textContent).toContain(
      'no overall compliance figure',
    )
  }, 30000)

  it('keeps Insufficient Evidence a hatched chip and never a fourth dot', async () => {
    const { container } = renderAt('/compliance', ashgrove)
    await settled(container)

    const cells = [...container.querySelectorAll('[data-rating]')]
    const unratable = cells.filter(
      (cell) => cell.getAttribute('data-rating') === 'insufficient_evidence',
    )
    // Ashgrove is the thin site; if this is ever empty the fixture has stopped
    // reaching the branch rather than the branch having stopped existing.
    expect(unratable.length).toBeGreaterThan(0)

    for (const cell of unratable) {
      expect(cell.querySelector('[data-state="unrecorded"]')).toBeTruthy()
      // Beside the dots, never among them: three colours are a scale and
      // Insufficient Evidence is the absence of a finding, not a milder one.
      expect(cell.querySelector('[data-dot]')).toBeNull()
    }

    const dots = [...container.querySelectorAll('[data-dot]')].map((dot) =>
      dot.getAttribute('data-dot'),
    )
    expect(dots.length).toBeGreaterThan(0)
    for (const dot of dots) expect(['green', 'amber', 'red']).toContain(dot)
  }, 30000)
})

describe('a Key Question, every check', () => {
  it('lists every check including the ones with no data', async () => {
    const { container } = renderAt('/compliance/safe')
    await settled(container)

    const safe = KEY_QUESTIONS.find((question) => question.id === 'safe')!
    const rendered = [...container.querySelectorAll('[data-check]')].map((row) =>
      row.getAttribute('data-check'),
    )
    expect(rendered.sort()).toEqual(safe.checks.map((check) => check.id).sort())
  }, 30000)

  it('names the module every figure comes from', async () => {
    const { container } = renderAt('/compliance/safe')
    await settled(container)

    for (const row of container.querySelectorAll('[data-check-kind="derived"]')) {
      expect(row.querySelector('[data-check-from]')?.textContent).toBeTruthy()
    }
  }, 30000)

  it('says so where the evidence is weaker than the figure looks', async () => {
    const { container } = renderAt('/compliance/safe')
    await settled(container)

    const fire = container.querySelector('[data-check="fire-risk-assessment"]')!
    expect(fire.querySelector('[data-check-caveat]')?.textContent).toContain(
      'not by an assessment record',
    )
  }, 30000)

  it('puts findings first and what the product does not hold last', async () => {
    const { container } = renderAt('/compliance/safe')
    await settled(container)

    const kinds = [...container.querySelectorAll('[data-check]')].map((row) =>
      row.getAttribute('data-check-kind'),
    )
    expect(kinds[kinds.length - 1]).toBe('not_held')
  }, 30000)

  it('refuses a Key Question that is not one of the five', async () => {
    const { container } = renderAt('/compliance/kindness')
    await waitFor(() =>
      expect(container.textContent).toContain('That is not a Key Question'),
    )
  }, 30000)
})

describe('the inspection pack', () => {
  it('offers no download control at all, not even a disabled one', async () => {
    const { container } = renderAt('/compliance/pack')
    await settled(container)

    const page = container.querySelector('[data-inspection-pack]') as HTMLElement
    for (const word of [/download/i, /export/i, /generate/i]) {
      expect(within(page).queryByRole('button', { name: word })).toBeNull()
      expect(within(page).queryByRole('link', { name: word })).toBeNull()
    }
    // And it says nothing was generated, rather than leaving that to be noticed.
    expect(page.querySelector('[data-no-file]')?.textContent).toContain(
      'Nothing has been generated',
    )
  }, 30000)

  it('separates a gap the home can close from one it cannot', async () => {
    const { container } = renderAt('/compliance/pack')
    await settled(container)

    const closeable = container.querySelector('[data-pack-section="not-recorded"]')!
    const notHeld = container.querySelector('[data-pack-section="not-held"]')!

    // A gap somebody can close is hatched and links to the screen that closes it.
    expect(closeable.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(
      within(closeable as HTMLElement).getAllByRole('link').length,
    ).toBeGreaterThan(0)

    // A gap nobody can close is inert, and offers nowhere to go.
    expect(notHeld.querySelector('[data-not-held]')).toBeTruthy()
    expect(within(notHeld as HTMLElement).queryAllByRole('link')).toHaveLength(0)
  }, 30000)

  it('reads what the product does not hold from the panels, never a second list', async () => {
    const data = await loadCompliance(rosewood, NOW_ISO)
    const contents = packContents(data)
    const fromPanels = KEY_QUESTIONS.flatMap((question) =>
      question.checks
        .filter((check) => check.kind === 'not_held')
        .map((check) => check.id),
    )
    expect(contents.notHeld.map((entry) => entry.id)).toEqual(fromPanels)
  }, 30000)

  it('makes the second section longer than the first', async () => {
    const data = await loadCompliance(rosewood, NOW_ISO)
    const contents = packContents(data)
    // The useful half. A manager gets more from the gaps than from the list.
    expect(contents.gaps.length + contents.notHeld.length).toBeGreaterThan(
      contents.holds.length,
    )
  }, 30000)
})

describe('statutory notifications', () => {
  it('leads on the incidents nobody has decided about', async () => {
    const { container } = renderAt('/compliance/notifications')
    await settled(container)

    const claim = container.querySelector('[data-filter-claim]')!
    expect(claim.textContent).toContain('nobody has decided')
  }, 30000)

  it('keeps a decision not to notify separate from a decision not yet made', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/compliance/notifications')
    await settled(container)

    await user.click(container.querySelector('[data-filter="not_required"]')!)
    await waitFor(() => {
      const rows = container.querySelectorAll('[data-notification="not_required"]')
      expect(rows.length).toBeGreaterThan(0)
      // A decision not to notify carries the name of whoever made it.
      expect(rows[0]?.textContent).not.toBe('')
    })
    expect(container.querySelector('[data-notification="not_yet_decided"]')).toBeNull()
  }, 30000)
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the overview', async () => {
    await check('/compliance')
  }, 40000)

  it('has no violations on a Key Question', async () => {
    await check('/compliance/well_led')
  }, 40000)

  it('has no violations on the pack', async () => {
    await check('/compliance/pack')
  }, 40000)
})
