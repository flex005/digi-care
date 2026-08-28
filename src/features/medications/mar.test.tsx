import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { MarChartRoute } from './MarChartRoute'
import { daysIn } from './mar-grid'
import type { IsoDate } from '@/data/types'
import { NOW, atTime, daysAgo } from '@/data/fixtures/generate'

/**
 * The clock is pinned, and the chart is why.
 *
 * **Every cell on this screen is derived from now.** The default range is the
 * current week, and the fixtures stop at `NOW` — so in the small hours of a
 * Monday the visible week holds one part-finished day and every cell is `due`
 * or `not_due`. A test that clicks a `given` cell then has nothing to click.
 *
 * That is what happened: the suite was green all day and failed at 00:13 on a
 * Monday with "Cannot read properties of null". The screen was right; the test
 * was reading the calendar (§8).
 *
 * Pinned to the afternoon of the last day of the previous full week, where the
 * grid is a complete week of recorded doses whatever day the suite runs.
 */
const PINNED = atTime(daysAgo(((NOW.getDay() + 6) % 7) + 1, NOW), 15, 0)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: PINNED })
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * The MAR chart. PRD §6.4.
 *
 * The screen the Evidence Invariant was designed around. What is under test is
 * not that a grid renders — it is that the five states stay apart, that no
 * intersection is ever a missing cell, and that the screen states its finding
 * before a reader has to look for it.
 */

function renderMar(id = 'res-okafor') {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'medications', element: <MarChartRoute /> }],
      },
    ],
    { initialEntries: [`/residents/${id}/medications`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const ready = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-mar]')).toBeTruthy())
  return container
}

describe('the grid says its finding before it shows its evidence', () => {
  it('states the omissions figure above the grid, with its denominator', async () => {
    const { container } = renderMar()
    await ready(container)

    // A week is 168 cells and all but a handful say "given". A screen that
    // makes somebody scan for the holes has buried its own finding.
    const banner = container.querySelector('[data-omissions]')
    expect(banner).toBeTruthy()
    expect(banner?.textContent).toMatch(/doses with no record/i)
    expect(banner?.textContent).toMatch(/across \d+ doses due this week/i)

    // Above the grid, not beside or below it.
    const grid = screen.getByRole('table')
    expect(
      banner!.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('does not dress a measured count in the unrecorded treatment', async () => {
    const { container } = renderMar()
    await ready(container)

    // The hatch is the absence of a finding (§2.3, §4.5). A count of omissions
    // is a finding. The same rule ruled the handover's lead card unhatched,
    // and one concept cannot have two answers.
    const banner = container.querySelector('[data-omissions]')
    expect(banner?.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('every intersection is a cell', () => {
  it('renders one cell per medication, day and round: never a gap in the table', async () => {
    const { container } = renderMar()
    await ready(container)

    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)

    const rounds = container.querySelectorAll('thead tr:nth-child(2) th').length
    for (const row of rows) {
      // A missing <td> is the blank §2.1 is about, and it breaks the column
      // associations a screen reader depends on.
      expect(row.querySelectorAll('[data-mar]').length).toBe(rounds)
    }
  })

  it('gives every cell a full-sentence accessible name', async () => {
    const { container } = renderMar()
    await ready(container)

    // PRD §6.4: "08:00, 5 April, Amlodipine 5mg — given by C. Nwosu at 08:04".
    // A cell read out of context still has to be unambiguous.
    const grid = screen.getByRole('table')
    for (const cell of [...grid.querySelectorAll('[data-mar]')].slice(0, 40)) {
      const name = cell.getAttribute('aria-label') ?? ''
      // DD/MM/YYYY: the ISO form is the grid's lookup key, not what a person hears.
      expect(name).toMatch(/^\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}, /)
      expect(name.length).toBeGreaterThan(30)
    }
  })
})

describe('the five states stay apart', () => {
  it('separates given from not given by glyph, not tint alone', async () => {
    const { container } = renderMar()
    await ready(container)

    // The pair most at risk in greyscale, and the one that matters most.
    const given = container.querySelector('[data-mar="given"]')
    const notGiven = container.querySelector('[data-mar="not_given"]')
    expect(given?.querySelector('svg')).toBeTruthy()
    expect(notGiven?.querySelector('svg')).toBeTruthy()
    expect(given?.querySelector('svg')?.innerHTML).not.toBe(
      notGiven?.querySelector('svg')?.innerHTML,
    )
  })

  it('hatches exactly one state, so it survives desaturation', async () => {
    const { container } = renderMar()
    await ready(container)

    for (const cell of container.querySelectorAll('[data-mar]')) {
      const hatched = cell.className.includes('unrecorded')
      expect(hatched).toBe(cell.getAttribute('data-mar') === 'omitted')
    }
  })

  it('leaves not-due empty, and nothing else', async () => {
    const { container } = renderMar()
    await ready(container)

    for (const cell of container.querySelectorAll('[data-mar]')) {
      const kind = cell.getAttribute('data-mar')
      const empty = cell.querySelector('svg') === null
      // not_due is empty because nothing is scheduled. omitted is empty of
      // glyph deliberately — every closed shape means somebody acted — but it
      // carries the hatch, so it is not an empty cell.
      if (!empty) expect(['due', 'given', 'not_given', 'omitted']).toContain(kind)
      if (kind === 'not_due') expect(empty).toBe(true)
    }
  })

  it('marks an escalated omission with a glyph, not hue alone', async () => {
    const { container } = renderMar()
    await ready(container)

    // Hue does not survive greyscale and a 5px dot is not reliably visible at
    // this size. A glyph is the carrier every other distinction here uses.
    const escalated = container.querySelector(
      '[data-mar="omitted"][data-escalated="true"]',
    )
    const plain = container.querySelector(
      '[data-mar="omitted"][data-escalated="false"]',
    )
    if (escalated) expect(escalated.querySelector('svg')).toBeTruthy()
    if (plain) expect(plain.querySelector('svg')).toBeNull()
  })

  it('keeps a missing second signature as a second fact on the same cell', async () => {
    const { container } = renderMar()
    await ready(container)

    // Rule 3a. Given AND missing its required witness is two facts: the cell
    // stays settled green and takes a dashed underline. Never a third fill.
    const cell = container.querySelector(
      '[data-mar="given"][data-witness="required_not_recorded"]',
    )
    if (cell) {
      expect(cell.className).toMatch(/cellGiven/)
      expect(cell.getAttribute('aria-label')).toMatch(/second signature not recorded/i)
    }
  })
})

describe('the legend is permanent', () => {
  it('is on the page, not behind a tooltip', async () => {
    const { container } = renderMar()
    await ready(container)

    const legend = screen.getByLabelText('What each cell means')
    expect(legend).toBeVisible()
    expect(legend.textContent).toMatch(/not due/i)
    expect(legend.textContent).toMatch(/no record/i)
  })

  it('draws its swatches with the real cell, so it cannot drift', async () => {
    const { container } = renderMar()
    await ready(container)

    const legend = screen.getByLabelText('What each cell means')
    // Every one of the five states, rendered by the same component the grid
    // uses. A legend that disagrees with the thing it explains is worse than
    // none.
    for (const kind of ['not_due', 'due', 'given', 'not_given', 'omitted']) {
      expect(legend.querySelector(`[data-mar="${kind}"]`)).toBeTruthy()
    }
  })
})

describe('the range', () => {
  it('opens on a week, not a month', async () => {
    const { container } = renderMar()
    await ready(container)
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(container.querySelectorAll('thead tr:first-child th[colspan]').length).toBe(
      7,
    )
  })

  it('names the arrows, since they carry no text', async () => {
    renderMar()
    await waitFor(() => expect(screen.getByLabelText('Previous week')).toBeVisible())

    // §7: an icon-only control needs an accessible name. It names the unit as
    // well as the direction, because an arrow alone does not say whether it
    // moves a week or a month — and the same control does both.
    expect(screen.getByLabelText('Previous week')).toBeVisible()
    expect(screen.getByLabelText('Next week')).toBeVisible()
  })

  it('renames the arrows when the range changes', async () => {
    const user = userEvent.setup()
    renderMar()
    await waitFor(() => expect(screen.getByLabelText('Previous week')).toBeVisible())
    await user.click(screen.getByRole('button', { name: 'Month' }))

    await waitFor(() => expect(screen.getByLabelText('Previous month')).toBeVisible())
    expect(screen.queryByLabelText('Previous week')).toBeNull()
  }, 30000)

  it('reaches a month', async () => {
    const user = userEvent.setup()
    const { container } = renderMar()
    await ready(container)
    await user.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() =>
      expect(
        container.querySelectorAll('thead tr:first-child th[colspan]').length,
      ).toBeGreaterThan(27),
    )
  }, 30000)

  it('runs weeks Monday to Sunday', () => {
    // A Sunday-first grid splits a weekend across two screens.
    const days = daysIn('2026-08-19' as IsoDate, 'week')
    expect(days[0]?.weekday).toBe('Mon')
    expect(days[6]?.weekday).toBe('Sun')
    expect(days).toHaveLength(7)
  })
})

describe('the detail area', () => {
  it('shows the same sentence the screen reader announces', async () => {
    const user = userEvent.setup()
    const { container } = renderMar()
    await ready(container)

    // Scoped to the grid: the legend renders the same visual as a non-focusable
    // swatch, and a swatch has no sentence to announce.
    const grid = screen.getByRole('table')
    const cell = grid.querySelector('[data-mar="given"]') as HTMLElement | null
    // Asserted rather than assumed. Reading `aria-label` off null threw
    // "Cannot read properties of null", which named the symptom and not the
    // cause — the week on screen had no recorded dose in it.
    expect(cell, 'no given dose in the week on screen').toBeTruthy()
    const spoken = cell!.getAttribute('aria-label')!
    await user.click(cell!)

    // One string for both, so the two can never disagree about what a cell
    // says.
    const detail = container.querySelector('[aria-live="polite"]')
    await waitFor(() => expect(detail?.textContent).toContain(spoken))
  }, 20000)

  it('says an omission is not a record that the dose was withheld', async () => {
    const user = userEvent.setup()
    const { container } = renderMar()
    await ready(container)

    const grid = screen.getByRole('table')
    const omitted = grid.querySelector('[data-mar="omitted"]') as HTMLElement | null
    if (!omitted) return
    await user.click(omitted)

    const detail = container.querySelector('[aria-live="polite"]')
    await waitFor(() =>
      expect(detail?.textContent).toMatch(/not a record that the dose was withheld/i),
    )
  }, 20000)
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderMar()
    await ready(container)
    /**
     * Scoped to the panel under test, not the whole rendered page.
     *
     * These tests mount the profile route, so `container` also holds the
     * subject header, the tab strip and the shell — dragged through axe on
     * every pass by every tab. `profile.test.tsx` axes that shell once,
     * because it is the test that is about it; this one is about this tab.
     */
    const panel = container.querySelector('[class*="tabPanel"]') ?? container
    expect(await axe(panel)).toHaveNoViolations()
  }, 60000)
})
