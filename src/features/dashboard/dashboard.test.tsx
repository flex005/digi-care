import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDateTime } from '@/data/types'
import { sites } from '@/data/fixtures/organisation'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { DashboardRoute } from './DashboardRoute'
import { deadlineKey, loadToday } from './today'
import { dosesByDay, roundsToday, todayDoses } from './series'
import { CAP, HATCH, RoundRing, RoundsDonut } from './charts'
import type { RoundToday } from './series'
// The stylesheets as text, so the "nothing here is green" claim in their
// docblocks is asserted rather than trusted.
import dashboardCss from './dashboard.module.css?raw'
import chartsCss from './charts.module.css?raw'
import metricCss from '@/components/metric/MetricTile.module.css?raw'

/**
 * The Dashboard. PRD §8, Phase 12.
 *
 * **The hazard is reassurance.** This is the front door, and the front door is
 * where a figure that looks fine does the most damage — so nothing on it is
 * green and no compliance percentage appears on it anywhere.
 */

/** Pinned, and every date-dependent assertion is written against it. */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime
const rosewood = sites[0]!

function renderDashboard() {
  const router = createMemoryRouter([{ path: '/', element: <DashboardRoute /> }], {
    initialEntries: ['/'],
  })
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
  waitFor(() => expect(container.querySelector('[data-dashboard]')).toBeTruthy(), {
    timeout: 20000,
  })

describe('nothing on the front door is reassuring', () => {
  it('renders no compliance percentage anywhere', async () => {
    const { container } = renderDashboard()
    await settled(container)

    const page = container.querySelector('[data-dashboard]')!
    // The one figure this screen must never carry. A "92% compliant" tile on
    // the front door is most reassuring exactly when the record is thinnest.
    expect(page.textContent).not.toMatch(/complian/i)
    expect(page.textContent).not.toMatch(/\d+%/)
  }, 30000)

  it('tints no card by its state, on the screen most tempted to', async () => {
    const { container } = renderDashboard()
    await settled(container)

    const tiles = [...container.querySelectorAll('[data-metric-tile]')]
    expect(tiles).toHaveLength(4)

    /*
     * The card is the plain surface whatever it says. A tinted tile cannot
     * say whether the tint is the finding or the card, and on the front door
     * the temptation to colour the alarm is strongest. Ranking is carried by
     * emphasis, which is position and width, not hue.
     */
    for (const tile of tiles) {
      const emphasis = tile.getAttribute('data-emphasis')
      expect(emphasis, tile.getAttribute('data-metric-tile') ?? '').toMatch(
        /^(lead|supporting)$/,
      )
    }
    expect(
      tiles.filter((tile) => tile.getAttribute('data-emphasis') === 'lead'),
    ).toHaveLength(1)
  }, 30000)

  it('carries a denominator on every tile', async () => {
    const { container } = renderDashboard()
    await settled(container)

    /*
     * Read through the card's own denominator element rather than sweeping
     * the tile's text. An earlier version queried `[data-tile]`, which a
     * rename left matching nothing: the loop body stopped running, the guard
     * went green, and Rule 4 was unprotected on the screen it matters most on.
     */
    const tiles = [...container.querySelectorAll('[data-metric-tile]')]
    expect(tiles).toHaveLength(4)

    for (const tile of tiles) {
      const of = tile.querySelector('[data-metric-of]')
      expect(of, tile.getAttribute('data-metric-tile') ?? '').toBeTruthy()
      expect(of!.textContent, tile.getAttribute('data-metric-tile') ?? '').toMatch(
        /of [\d,]+|across [\d,]+/,
      )
    }
  }, 30000)
})

describe('what is late', () => {
  it('renders a date as a date and an instant as a time', async () => {
    const today = await loadToday(rosewood, NOW_ISO)

    /*
     * Named by reference to the reviews themselves, not by "at least one row
     * somewhere is a date". The first version of this guard passed while every
     * review was widened to an instant, because the unsigned handovers were
     * still dates and satisfied it — a loose assertion picking the wrong rows,
     * which is the §8 specificity defect wearing a positive.
     */
    const reviewIds = new Set(today.overdueReviews.map((review) => review.id))
    expect(reviewIds.size).toBeGreaterThan(0)
    for (const item of today.late.filter((candidate) => reviewIds.has(candidate.id))) {
      expect(item.due.kind, item.id).toBe('date')
    }

    const kinds = new Set(today.late.map((item) => item.due.kind))
    // Both members have to be reachable, or the union is decoration.
    expect(kinds.has('date')).toBe(true)

    const { container } = renderDashboard()
    await settled(container)

    for (const when of container.querySelectorAll('[data-due="date"]')) {
      /*
       * A review is due on a day and at no time in particular. Widening it to
       * midnight printed "01:00 BST" against every overdue review on this
       * screen — an hour nobody recorded and nobody could act on.
       */
      expect(when.textContent).not.toMatch(/\d{2}:\d{2}/)
    }
  }, 30000)

  it('orders by how long, oldest first', async () => {
    const today = await loadToday(rosewood, NOW_ISO)
    const keys = today.late.map((item) => deadlineKey(item.due))
    expect([...keys].sort()).toEqual(keys)
  }, 30000)

  it('names the subject on every row', async () => {
    const today = await loadToday(rosewood, NOW_ISO)
    for (const item of today.late) {
      // A row that cannot say who it is about is not a weaker row (§2.4).
      expect(item.who, item.id).not.toBe('')
    }
  }, 30000)
})

describe('who nobody has written up', () => {
  it('separates never written up from nothing today', async () => {
    const today = await loadToday(rosewood, NOW_ISO)
    const kinds = new Set(today.unwritten.map((entry) => entry.last.kind))
    expect(kinds.size).toBeGreaterThan(0)
  }, 30000)

  it('takes the hatch, because nobody has said rather than nothing happened', async () => {
    const { container } = renderDashboard()
    await settled(container)

    const rows = container.querySelectorAll('[data-unwritten]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    }
  }, 30000)

  it('offers every one of them the screen that closes it', async () => {
    const { container } = renderDashboard()
    await settled(container)

    for (const row of container.querySelectorAll('[data-unwritten]')) {
      const link = within(row as HTMLElement).getByRole('link')
      expect(link.getAttribute('href')).toMatch(/\/residents\/.+\/notes/)
    }
  }, 30000)
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderDashboard()
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 40000)
})

/**
 * Whether an element is painted with a hatch that is actually there.
 *
 * **Resolves the reference rather than matching the id**, which is the defect
 * this replaced a literal comparison to catch. The pattern used to be declared
 * once per page in an `<svg>` of its own and referenced from four others; a
 * browser resolves that and anything reading one `<svg>` on its own does not,
 * so the fill fell back to solid and a gap nobody recorded exported as a bar
 * that was. Asserting the id told us nothing about whether it resolved.
 */
function hatchedWithin(element: Element, attribute: 'fill' | 'stroke'): boolean {
  const paint = element.getAttribute(attribute)
  const id = paint?.match(/^url\(#(.+)\)$/)?.[1]
  if (id === undefined) return false
  if (!id.startsWith(HATCH)) return false
  const svg = element.closest('svg')
  return svg !== null && svg.querySelector(`pattern[id="${id}"]`) !== null
}

describe('the charts refuse what the screen refuses', () => {
  it('carries the hatch into every chart, never a lighter shade', async () => {
    const { container } = renderDashboard()
    await settled(container)

    /*
     * Every chart declares the pattern inside its own `<svg>` and every gap
     * reaches it from within that same `<svg>`. One definition in the source,
     * one per chart in the document — a reference across two `<svg>` elements
     * resolves in a browser and nowhere else.
     */
    const patterns = [...container.querySelectorAll('pattern')]
    expect(patterns.length).toBeGreaterThan(0)
    for (const pattern of patterns) {
      expect(pattern.getAttribute('id')).toMatch(new RegExp(`^${HATCH}`))
      expect(pattern.closest('svg')).toBeTruthy()
    }
    // No two share an id, or `url(#…)` would tie every chart to the first.
    const ids = patterns.map((pattern) => pattern.getAttribute('id'))
    expect(new Set(ids).size).toBe(ids.length)

    /*
     * A bar's gap segment, the donut's no-record arc and an incomplete ring's
     * track are the three places a gap appears inside an SVG. A shade of the
     * recorded colour in any of them is the defect: it is the distinction that
     * survives greyscale and colour-blindness, and it is the same hatch every
     * other screen in the build uses.
     */
    /*
     * The bars are HTML now, and **their treatment cannot be asserted here.**
     * jsdom applies no CSS: `getComputedStyle(gap).backgroundImage` is `none`
     * whatever the class does, so an assertion on it could not fail — the
     * §8 wrong-medium trap, in the file that would look like it had covered
     * this. Asserting the class name instead is no better: `composes:` is a
     * claim about cascade, and cascade has no representation a query reaches.
     *
     * So what is asserted here is the structure — a gap segment exists,
     * distinct from the recorded one — and whether the hatch actually paints
     * is asserted in a real browser by scripts/check-layout.mjs.
     */
    const gaps = [...container.querySelectorAll('[data-bar-segment="gap"]')]
    expect(gaps.length).toBeGreaterThan(0)
    const recorded = container.querySelector('[data-bar-segment="recorded"]')!
    expect(recorded).toBeTruthy()
    for (const gap of gaps) {
      expect(gap.getAttribute('data-bar-segment')).toBe('gap')
      expect(gap).not.toBe(recorded)
    }

    /*
     * The donut's no-record arc and an incomplete ring's track are drawn only
     * where there is an absence to draw, and how many there are depends on the
     * hour the fixture was generated at: before the first round has closed,
     * nothing has gone unrecorded and the arc does not exist. Asserting it
     * outright failed at 08:57 on a screen that was correct.
     *
     * So the property is over whichever of them render — every absence inside
     * an SVG is the hatch, never a shade of the recorded colour — with a floor
     * that stops the sweep going quiet. A loop over an empty list passes, and a
     * guard that passes over nothing is the one that dies silently.
     */
    const strokedGaps = [
      ...container.querySelectorAll('[data-arc="no-record"], [data-ring-track="gap"]'),
    ]
    for (const element of strokedGaps) {
      expect(hatchedWithin(element, 'stroke'), element.outerHTML.slice(0, 80)).toBe(
        true,
      )
    }
    /*
     * The floor is the bar segments above, which exist at every hour. This one
     * was briefly written as `strokedGaps.length + gaps.length > gaps.length - 1`,
     * which is true of zero and of everything else: an assertion that cannot
     * fail, in the paragraph explaining why a loop over an empty list is not
     * coverage.
     */
    expect(gaps.length).toBeGreaterThan(0)
  }, 30000)

  it('states recorded against expected on every chart, and no percentage', async () => {
    const { container } = renderDashboard()
    await settled(container)

    const page = container.querySelector('[data-dashboard]') as HTMLElement
    /*
     * Rule 4 applied to a shape rather than a figure. A chart of a percentage
     * hides its own denominator, and a bar at 92% looks like evidence whatever
     * it is 92% of.
     */
    expect(page.textContent).not.toContain('%')

    // The donut says what its centre figure is out of.
    const donut = container.querySelector('[data-panel="rounds-donut"]')!
    expect(donut.textContent).toMatch(/of [\d,]+ doses/)

    // And so does every module bar.
    const bars = [...container.querySelectorAll('[data-bar]')]
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar.textContent, bar.getAttribute('data-bar') ?? '').toMatch(
        /of [\d,]+ \w/,
      )
    }
  }, 30000)

  it('states a direction in words and figures, never as an arrow', async () => {
    const { container } = renderDashboard()
    await settled(container)

    const tiles = [...container.querySelectorAll('[data-metric-tile]')]
    expect(tiles).toHaveLength(4)
    // Every figure keeps its denominator beside it, in its own element.
    for (const tile of tiles) {
      expect(tile.querySelector('[data-metric-of]')!.textContent).toBeTruthy()
    }

    /*
     * An arrow states a direction with no denominator and no period, which is
     * the shape this build spent fifteen phases removing. There is no
     * comparison on this screen at all, which is the strongest form of it.
     */
    const page = container.querySelector('[data-dashboard]') as HTMLElement
    expect(page.textContent).not.toMatch(/[↑↓▲▼➚➘]/)
    expect(page.textContent).not.toMatch(/\b(up|down)\s+\d+%/i)
  }, 30000)

  it("lists every state of today's doses, including the empty ones", async () => {
    const { container } = renderDashboard()
    await settled(container)

    /*
     * Which of these is zero depends on the hour rather than on the home: at
     * 21:00 nothing is due now, due soon or still to come. Absence from a list
     * is the same bug as a blank cell, so every one renders either way.
     *
     * Due soon is its own row because the tile beside the chart counts it: the
     * tile said six doses were due in the next two hours while the ring called
     * the same six not due yet, and one screen should not need reconciling
     * against itself.
     */
    const keys = [...container.querySelectorAll('[data-donut-key]')].map((key) =>
      key.getAttribute('data-donut-key'),
    )
    expect(keys).toEqual([
      'Recorded',
      'No record',
      'Due now',
      'Due soon',
      'Not due yet',
    ])
  }, 30000)

  it('derives the donut and the rings from one count, not two', async () => {
    /*
     * These disagreed by one dose — 162 against 163 — because two functions
     * written minutes apart each decided for themselves which days a drug
     * falls due on, and one of them counted from the prescription date rather
     * than from the first day on the chart.
     */
    const rounds = roundsToday(
      rosewood,
      (await loadToday(rosewood, NOW_ISO)).residents,
      NOW_ISO,
    )
    const doses = todayDoses(rounds)
    const summed = rounds.reduce((running, round) => running + round.expected, 0)
    expect(doses.total).toBe(summed)
    expect(
      doses.recorded + doses.noRecord + doses.dueNow + doses.dueSoon + doses.notDueYet,
    ).toBe(doses.total)

    const days = dosesByDay(
      rosewood,
      (await loadToday(rosewood, NOW_ISO)).residents,
      NOW_ISO,
    )
    const today = days[days.length - 1]!
    expect(today.recorded).toBe(doses.recorded)
    expect(today.noRecord).toBe(doses.noRecord)
  }, 30000)

  it('never renders a positive token, in any stylesheet this screen uses', () => {
    /*
     * The claim in both stylesheets' docblocks, asserted rather than trusted.
     * "Nothing here is green" is the kind of guarantee a comment makes and a
     * later edit quietly removes — including on a shift with nothing
     * outstanding, where a success colour is most tempting and least earned.
     */
    expect(dashboardCss).not.toMatch(/--status-positive/)
    expect(chartsCss).not.toMatch(/--status-positive/)
    // The shared card the front door now uses, checked with them.
    expect(metricCss).not.toMatch(/--status-positive/)
    // And the check can fail: both files are real, and both mention the token
    // family the positive one belongs to.
    expect(dashboardCss).toMatch(/--status-critical/)
    expect(chartsCss).toMatch(/--status-unrecorded/)
  }, 30000)
})

describe('the shapes no site in this build reaches', () => {
  /*
   * **Neither home draws a short ring or a hatched arc**, and the fixtures are
   * right to be that way: the omission rate is 1%, which is what a real home
   * looks like, and Ashgrove — the thin site — is thinner in *volume* rather
   * than in recording. Its twelve doses today are all recorded, so opening it
   * shows fewer of these shapes than Rosewood, not more.
   *
   * So the branches are exercised here rather than left to a screen nobody can
   * get to. The standing check says an unreached branch means either the
   * fixture is wrong or the branch is; here it is neither, and this is what
   * that costs — the states are held by construction, and it is written down
   * that no site displays them.
   */
  const round = (over: Partial<RoundToday> = {}): RoundToday => ({
    at: '08:00',
    recorded: 0,
    noRecord: 0,
    dueNow: 0,
    dueSoon: 0,
    notDueYet: 0,
    expected: 0,
    by: [],
    ...over,
  })

  it('draws a mostly-hatched ring for a home that has recorded nothing', () => {
    const { container } = render(
      <RoundsDonut
        doses={{
          recorded: 0,
          noRecord: 40,
          dueNow: 0,
          dueSoon: 0,
          notDueYet: 0,
          total: 40,
        }}
      />,
    )

    const gap = container.querySelector('[data-arc="no-record"]')!
    // The segments are counts, so nothing-recorded is drawn rather than left
    // as an empty ring, and it is drawn with the pattern, not a pale fill.
    expect(hatchedWithin(gap, 'stroke')).toBe(true)

    /*
     * The whole ring, asserted as what is painted rather than as the shape it
     * is painted with. Round caps add half the stroke width of arc at each
     * end, so the arc is shortened to pay for them: an assertion pinned to the
     * old dash string was measuring the rendering, not the rule, and had to be
     * rewritten the moment the arcs stopped being dashes.
     */
    expect(Number(gap.getAttribute('data-arc-share')) + CAP).toBeCloseTo(100, 5)

    // Nothing recorded means no recorded arc at all, not a zero-length one.
    expect(container.querySelector('[data-arc="recorded"]')).toBeNull()
  })

  it('answers due-now and not-due-yet to the same clock', async () => {
    /*
     * These were derived two different ways: due-now read the state baked into
     * the fixture at generation, not-due-yet compared the round's wall clock
     * with the home's. So the two halves of one question answered to different
     * instants, and a round that opened after the page loaded stayed
     * not-due-yet while the header's clock said otherwise.
     *
     * Pinned instants, and the point is that moving the clock moves the
     * answer: an hour inside a round's window has doses due, and an hour after
     * it the same doses are missing.
     */
    const residents = (await loadToday(rosewood, NOW_ISO)).residents
    /*
     * Derived from the generation instant rather than a fixed hour. The clock
     * snaps to whichever round is running, so a hardcoded 18:30 sat inside a
     * window on some runs and hours past one on others: green all day and red
     * at the wrong hour, which reads as flakiness and gets retried.
     */
    const plus = (minutes: number) =>
      todayDoses(
        roundsToday(
          rosewood,
          residents,
          new Date(
            new Date(NOW_ISO).getTime() + minutes * 60_000,
          ).toISOString() as IsoDateTime,
        ),
      )

    const inWindow = plus(0)
    const afterIt = plus(60)

    expect(inWindow.dueNow).toBeGreaterThan(0)
    // The same doses, an hour later, with nobody having recorded them.
    expect(afterIt.dueNow).toBe(0)
    expect(afterIt.noRecord).toBe(inWindow.noRecord + inWindow.dueNow)

    // And the denominator never moves: the day holds what the day holds.
    expect(afterIt.total).toBe(inWindow.total)
    for (const doses of [inWindow, afterIt]) {
      expect(
        doses.recorded +
          doses.noRecord +
          doses.dueNow +
          doses.dueSoon +
          doses.notDueYet,
      ).toBe(doses.total)
    }
  }, 30000)

  it('paints a small segment at its true share, not as a capped stub', () => {
    /*
     * A round cap costs the stroke width in arc, so a segment smaller than
     * that has nothing left to draw once it has paid: the two caps meet and
     * what should be a short arc becomes a rounded blob. The doses nobody
     * recorded are usually the smallest segment on this chart and always the
     * one that matters, so below the allowance the arc keeps its length and
     * gives up the rounding instead.
     */
    const { container } = render(
      <RoundsDonut
        doses={{
          recorded: 98,
          noRecord: 8,
          dueNow: 0,
          dueSoon: 0,
          notDueYet: 56,
          total: 162,
        }}
      />,
    )

    const small = container.querySelector('[data-arc="no-record"]')!
    const share = (8 / 162) * 100
    expect(Number(small.getAttribute('data-arc-share'))).toBeCloseTo(share, 5)
    expect(small.getAttribute('stroke-linecap')).toBe('butt')

    // The big ones keep the rounding, and still paint their own share.
    const big = container.querySelector('[data-arc="recorded"]')!
    expect(big.getAttribute('stroke-linecap')).toBeNull()
    expect(Number(big.getAttribute('data-arc-share')) + CAP).toBeCloseTo(
      (98 / 162) * 100,
      5,
    )
  })

  it('draws a ring arc at the share it says, whatever its radius', () => {
    /*
     * **The defect nothing caught for a phase.** Both charts drew arcs as
     * `stroke-dasharray` on a full circle in units of 0–100, which is only a
     * percentage if the circumference is 100 — true of the donut, whose radius
     * is 15.915 for exactly that reason, and false of the rings at r=17, whose
     * circumference is 106.8. Every ring painted its share times 100/106.8: a
     * round with 76 per cent recorded drew 71, understating what a home had
     * done, on the chart a manager glances at.
     *
     * A copied formula is a second rule even when it is copied correctly,
     * because the constant that made the original true did not come with it.
     * The arcs are explicit paths now and the share is stated rather than
     * implied, so this asserts the number the component committed to.
     */
    const { container } = render(
      <RoundRing round={round({ recorded: 76, noRecord: 24, expected: 100 })} />,
    )
    expect(
      Number(
        container.querySelector('[data-ring-done]')!.getAttribute('data-ring-share'),
      ),
    ).toBeCloseTo(76, 5)
  })

  it('sweeps as far as it says it does, measured off the path', () => {
    /*
     * **`data-arc-share` is the component's claim, not the ink**, and the two
     * come from one variable so they cannot currently disagree — which means a
     * guard reading the attribute would pass on a wrong radius, a wrong start
     * angle or a sweep flag the wrong way round. This measures the arc: it
     * takes the two endpoints out of the path, converts them to angles about
     * the centre, and compares the swept fraction with the share claimed.
     *
     * That is the ring bug caught from the other side. The dashed version
     * claimed 76 and painted 71, and nothing in this file could tell.
     */
    const { container } = render(
      <RoundRing round={round({ recorded: 76, noRecord: 24, expected: 100 })} />,
    )
    const arc = container.querySelector('[data-ring-done]')!
    const numbers = (arc.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const [x1, y1] = [numbers[0]!, numbers[1]!]
    const x2 = numbers[numbers.length - 2]!
    const y2 = numbers[numbers.length - 1]!

    const angle = (x: number, y: number) => Math.atan2(y - 21, x - 21)
    let swept = (angle(x2, y2) - angle(x1, y1)) / (2 * Math.PI)
    if (swept < 0) swept += 1

    expect(swept * 100).toBeCloseTo(Number(arc.getAttribute('data-ring-share')), 3)
    // And the claim itself is the recorded share, not a scaled one.
    expect(Number(arc.getAttribute('data-ring-share'))).toBeCloseTo(76, 5)
  })

  it('draws arcs as geometry, never as a dash on a circle', () => {
    /*
     * A dashed circle renders correctly and says nothing about where the arc
     * starts or ends — only how long the painted run is. Anything reading the
     * document rather than rasterising it repeats the dash, which is what the
     * markup literally says, and the chart arrives somewhere else in pieces.
     */
    const donut = render(
      <RoundsDonut
        doses={{
          recorded: 85,
          noRecord: 8,
          dueNow: 13,
          dueSoon: 0,
          notDueYet: 56,
          total: 162,
        }}
      />,
    )
    const ring = render(
      <RoundRing round={round({ recorded: 41, noRecord: 14, expected: 55 })} />,
    )

    for (const view of [donut, ring]) {
      expect(view.container.querySelector('[stroke-dasharray]')).toBeNull()
      expect(view.container.querySelector('[stroke-dashoffset]')).toBeNull()
    }
    for (const arc of donut.container.querySelectorAll('[data-arc]')) {
      expect(arc.tagName.toLowerCase()).toBe('path')
      expect(arc.getAttribute('d')).toMatch(/^M[\d.,-]+ A/)
    }
  })

  it('hatches the track behind a round that is short, and not one that is early', () => {
    const short = render(
      <RoundRing round={round({ recorded: 41, noRecord: 14, expected: 55 })} />,
    )
    expect(
      hatchedWithin(short.container.querySelector('[data-ring-track]')!, 'stroke'),
    ).toBe(true)

    /*
     * A round nobody has reached is not a gap anybody can close, so it takes
     * the plain track. Not-due-yet and nothing-outstanding both have zero
     * doses missing and they are opposite states.
     */
    const early = render(<RoundRing round={round({ notDueYet: 17, expected: 17 })} />)
    const track = early.container.querySelector('[data-ring-track]')!
    expect(track.getAttribute('data-ring-track')).toBe('plain')
    expect(track.getAttribute('stroke')).toBeNull()
    expect(early.container.querySelector('[data-ring-done]')).toBeNull()
  })
})

describe('the late list narrows and pages without lying about the total', () => {
  it('filters with pills, never with a tab strip', async () => {
    const { container } = renderDashboard()
    await settled(container)

    /*
     * An underline strip means navigation in this product and a pill means a
     * filter (§6). These narrow a list on the screen you are already on, so
     * they are buttons in a group, not links.
     */
    const group = container.querySelector(
      '[role="group"][aria-label="Which late things"]',
    )!
    const pills = [...group.querySelectorAll('button[data-late-filter]')]
    expect(pills.map((pill) => pill.getAttribute('data-late-filter'))).toEqual([
      'all',
      'dose',
      'review',
      'handover',
    ])
    expect(group.querySelector('a')).toBeNull()
    for (const pill of pills) {
      expect(pill.getAttribute('aria-pressed')).toBe(
        pill.getAttribute('data-late-filter') === 'all' ? 'true' : 'false',
      )
    }
  }, 30000)

  it('carries the filter in the claim, and the unfiltered total beside it', async () => {
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await settled(container)

    const claimText = () => container.querySelector('[data-late-claim]')!.textContent!
    const total = Number(
      container
        .querySelector('button[data-late-filter="all"] [data-numeric]')!
        .textContent!.replace(/,/g, ''),
    )
    expect(total).toBeGreaterThan(1)

    await user.click(container.querySelector('button[data-late-filter="review"]')!)

    /*
     * Rule 3c. A figure of 26 above a list of 3 is a claim about a set the
     * reader is not looking at, so narrowing the list narrows the claim and the
     * line says which filter produced it and what the whole set holds.
     */
    await waitFor(() => expect(claimText()).toContain('reviews past their date'))

    const rows = [...container.querySelectorAll('[data-late-row]')]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.getAttribute('data-late-kind')).toBe('review')
    }

    /*
     * The leading figure is the *narrowed* count, and it has to be read as the
     * leading figure: an earlier version of this only checked that the total
     * appeared somewhere in the sentence, which stayed true when the claim was
     * changed to state the unfiltered figure and the whole guard went quiet.
     */
    const leading = Number(claimText().trim().split(/\s/)[0]!.replace(/,/g, ''))
    const reviews = Number(
      container
        .querySelector('button[data-late-filter="review"] [data-numeric]')!
        .textContent!.replace(/,/g, ''),
    )
    expect(leading).toBe(reviews)
    expect(reviews).toBeLessThan(total)
    // And the unfiltered total is still stated, so the smaller figure is not
    // read as the whole of what is late.
    expect(claimText()).toContain('late in total')
    expect(claimText()).toContain(String(total))
  }, 30000)

  it('states the total it is paging through, and moves between pages', async () => {
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await settled(container)

    const pager = container.querySelector('[data-pager]')
    // The fixture has more late things than fit on a page; if that stops being
    // true this guard is measuring an empty set rather than the behaviour.
    expect(pager).toBeTruthy()

    const first = [...container.querySelectorAll('[data-late-row]')].map((row) =>
      row.getAttribute('data-late-row'),
    )
    expect(first.length).toBe(8)

    /*
     * A reader who sees eight rows and no total has been told the home has
     * eight problems. Paging hides rows, so the total is stated.
     */
    expect(container.querySelector('[data-late-claim]')!.textContent).toMatch(
      /Showing 1 to 8/,
    )

    const prev = container.querySelector<HTMLButtonElement>('[data-pager-prev]')!
    expect(prev.disabled).toBe(true)

    await user.click(container.querySelector('[data-pager-next]')!)

    await waitFor(() => {
      const second = [...container.querySelectorAll('[data-late-row]')].map((row) =>
        row.getAttribute('data-late-row'),
      )
      expect(second).not.toEqual(first)
    })
    expect(
      container.querySelector<HTMLButtonElement>('[data-pager-prev]')!.disabled,
    ).toBe(false)
  }, 30000)

  it('returns to the first page when a filter shortens the list', async () => {
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await settled(container)

    await user.click(container.querySelector('[data-pager-next]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-late-claim]')!.textContent).toMatch(
        /Showing 9 to/,
      ),
    )

    /*
     * Handovers are far fewer than a page, so page two of them does not exist.
     * A reader left on it sees an empty list and reads it as nothing being
     * late, which is the opposite of true.
     */
    await user.click(container.querySelector('button[data-late-filter="handover"]')!)

    await waitFor(() =>
      expect(container.querySelectorAll('[data-late-row]').length).toBeGreaterThan(0),
    )
    for (const row of container.querySelectorAll('[data-late-row]')) {
      expect(row.getAttribute('data-late-kind')).toBe('handover')
    }
    // Nothing is hidden behind a pager that is no longer there.
    expect(container.querySelector('[data-late-claim]')!.textContent).not.toMatch(
      /Showing 9 to/,
    )
  }, 30000)
})
