import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDate, IsoDateTime, Period } from '@/data/types'
import { sites } from '@/data/fixtures/organisation'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { router as appRouter } from '@/app/routes'
import { ReportIndexRoute } from './ReportIndexRoute'
import { ReportViewRoute } from './ReportViewRoute'
import { DRILL_DOWNS, REPORTS, reportById } from './catalogue'
import { loadReportData } from './data'
import {
  REPORT_PERIOD_DAYS,
  daysIn,
  describePeriod,
  periodEndingToday,
  previousPeriod,
} from './period'
import { runReport } from './runs'
import { reportHeadline, runAll as runEverything } from './analysis'
import { formatCount } from '@/lib/format'
import hatch from '@/styles/unrecorded.module.css'

/**
 * Reports. PRD §6.7, Phase 13.
 *
 * **The module's hazard is a table that looks like a conclusion.** Everything
 * here is about the finding above it: what the figures are, what they are out
 * of, and where the data is too thin to say anything at all.
 */

/** Pinned, and every date-dependent assertion is written against it. */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime
const rosewood = sites[0]!
const ashgrove = sites[1]!

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'reports', element: <ReportIndexRoute /> },
      { path: 'reports/:reportId', element: <ReportViewRoute /> },
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
  waitFor(
    () =>
      expect(
        container.querySelector('[data-report-index], [data-report-view]'),
      ).toBeTruthy(),
    { timeout: 20000 },
  )

const runAll = async (site = rosewood) => {
  const data = await loadReportData(site, NOW_ISO)
  return REPORTS.map((definition) => {
    const period = periodEndingToday(NOW_ISO, site.timeZone, REPORT_PERIOD_DAYS)
    return {
      definition,
      result: runReport({
        data,
        definition,
        period,
        previous: definition.comparison ? previousPeriod(period) : undefined,
        cut: definition.cuts[0]?.id ?? '',
      }),
    }
  })
}

describe('eight reports, not fifteen', () => {
  it('keeps the seven duplicates as drill-downs from the check they repeat', () => {
    expect(REPORTS).toHaveLength(8)
    expect(DRILL_DOWNS).toHaveLength(7)
  })

  it('points every drill-down at a route that exists', () => {
    // Found by what it is, not by where it sits. See care-plan.test.tsx.
    const shell = appRouter.routes.find(
      (route) => route.path === '/' && (route.children?.length ?? 0) > 0,
    )
    const paths = (shell?.children ?? []).map((route) => `/${route.path ?? ''}`)
    for (const drill of DRILL_DOWNS) {
      // A Key Question route, reached by its id — the same route the compliance
      // overview links to. A drill-down pointing nowhere is worse than a
      // fifteenth screen.
      const base = drill.to.split('/').slice(0, 2).join('/')
      expect(paths, drill.question).toContain(base)
      expect(drill.to.split('/')[2]).toMatch(
        /^(safe|effective|caring|responsive|well_led)$/,
      )
    }
  })

  it('states what every report answers in one line', () => {
    for (const report of REPORTS) {
      // A report whose question cannot be stated in one line is a table
      // looking for a purpose.
      expect(report.answers, report.id).toMatch(/\.$/)
      expect(report.answers.split('. ').length, report.id).toBe(1)
    }
  })

  it('offers a comparison only where a column changes with it', async () => {
    /*
     * A control that changes nothing is worse than no control. Five of the
     * eight have no per-row comparison, and the toggle is absent there rather
     * than present and inert.
     */
    for (const { definition, result } of await runAll()) {
      const hasChangeColumn = result.rows.some((entry) =>
        entry.cells.some((cell) => cell.kind === 'change'),
      )
      if (result.rows.length === 0) continue
      expect(hasChangeColumn, definition.id).toBe(definition.comparison)
    }
  }, 40000)
})

describe('the period', () => {
  it('compares against a window of the same length, immediately before', () => {
    const period = periodEndingToday(NOW_ISO, rosewood.timeZone, REPORT_PERIOD_DAYS)
    const before = previousPeriod(period)

    expect(daysIn(period)).toBe(REPORT_PERIOD_DAYS)
    expect(daysIn(before)).toBe(REPORT_PERIOD_DAYS)
    // Immediately before, with no day counted twice and none skipped.
    expect(before.to < period.from).toBe(true)
    expect(daysIn({ from: before.to, to: period.from, days: 2 })).toBe(2)
  })

  it('names the period it counted in the restated line', async () => {
    const data = await loadReportData(rosewood, NOW_ISO)
    const definition = reportById('medication-omissions')!
    const period: Period = {
      from: '2026-07-27' as IsoDate,
      to: '2026-08-25' as IsoDate,
      days: 30,
    }
    const result = runReport({
      data,
      definition,
      period,
      previous: previousPeriod(period),
      cut: 'drug',
    })

    expect(result.restated).toContain(describePeriod(period))
    expect(result.restated).toContain(rosewood.name)
  }, 40000)
})

describe('a row that cannot support a rate', () => {
  it('keeps its counts and loses only its rate', async () => {
    const rows = (await runAll()).flatMap(({ result }) => result.rows)
    const thin = rows.filter((entry) => entry.thin)
    expect(thin.length).toBeGreaterThan(0)

    for (const entry of thin) {
      // The counts stay — removing the row, or blanking it, would make the
      // table look complete.
      expect(
        entry.cells.some((cell) => cell.kind === 'count'),
        entry.id,
      ).toBe(true)
      expect(
        entry.cells.some((cell) => cell.kind === 'rate'),
        `${entry.id} states a rate it cannot support`,
      ).toBe(false)
      expect(
        entry.cells.some((cell) => cell.kind === 'insufficient'),
        entry.id,
      ).toBe(true)
    }
  }, 40000)

  it('applies the floor to the population, not only to the denominator', async () => {
    /*
     * A staff member who recorded nothing has 0 of 28 residents — a
     * denominator that supports a rate perfectly well, and "0.0%" against
     * somebody who did not work is the accusation the constraint forbids.
     */
    const data = await loadReportData(rosewood, NOW_ISO)
    const definition = reportById('care-note-coverage')!
    const period = periodEndingToday(NOW_ISO, rosewood.timeZone, REPORT_PERIOD_DAYS)
    const result = runReport({
      data,
      definition,
      period,
      previous: undefined,
      cut: 'staff',
    })

    const idle = result.rows.filter(
      (entry) => entry.cells[0]?.kind === 'count' && entry.cells[0].value === 0,
    )
    expect(idle.length).toBeGreaterThan(0)
    for (const entry of idle) {
      expect(entry.thin, entry.name).toBe(true)
      expect(
        entry.cells.some((cell) => cell.kind === 'rate'),
        entry.name,
      ).toBe(false)
    }
  }, 40000)

  it('refuses a comparison where either period is too thin', async () => {
    const rows = (await runAll(ashgrove)).flatMap(({ result }) => result.rows)
    const changes = rows.flatMap((entry) =>
      entry.cells.flatMap((cell) => (cell.kind === 'change' ? [cell.change] : [])),
    )
    if (changes.length === 0) return
    // Reachable, or the member is decoration.
    expect(changes.some((entry) => entry.kind === 'no_comparison')).toBe(true)
  }, 40000)
})

describe('the index', () => {
  it('marks a thin report before anybody opens it', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    const thin = container.querySelectorAll('[data-readiness="too_thin"]')
    expect(thin.length).toBeGreaterThan(0)
    for (const mark of thin) {
      expect(mark.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    }
  }, 40000)

  it('lists every report with the line saying what it answers', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    for (const report of REPORTS) {
      const listed = container.querySelector(`[data-report="${report.id}"]`)!
      expect(listed.querySelector('[data-answers]')?.textContent, report.id).toBe(
        report.answers,
      )
    }
  }, 40000)

  it('says where the seven that are not reports live', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    for (const drill of DRILL_DOWNS) {
      const link = container.querySelector(`[data-drill-down="${drill.question}"]`)!
      expect(link.getAttribute('href')).toBe(drill.to)
    }
  }, 40000)
})

describe('a report view', () => {
  it('renders the finding above the filters and above the table', async () => {
    const { container } = renderAt('/reports/medication-omissions')
    await settled(container)

    const page = container.querySelector('[data-report-view]')!
    const order = [
      ...page.querySelectorAll('[data-finding], [data-restated], table'),
    ].map(
      (node) =>
        node.getAttribute('data-finding') ??
        node.getAttribute('data-restated') ??
        'table',
    )
    expect(order[0]).toMatch(/finding|too_thin/)
    expect(order[order.length - 1]).toBe('table')
  }, 40000)

  it('still renders the table where the data is too thin', async () => {
    const { container } = renderAt('/reports/controlled-drug-reconciliation')
    await settled(container)

    // Refusing to render hides data somebody may still need; the finding above
    // is what stops the table being read as a conclusion.
    expect(container.querySelector('[data-finding="too_thin"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]').length).toBeGreaterThan(0)
  }, 40000)

  it('shows no rating anywhere', async () => {
    for (const path of ['/reports', '/reports/medication-omissions']) {
      const { container } = renderAt(path)
      await settled(container)
      // Judgement stays on the compliance panel. A green rating here would
      // reintroduce the reassurance the Dashboard refuses.
      expect(container.querySelector('[data-rating]'), path).toBeNull()
      expect(container.textContent, path).not.toMatch(/\bGreen\b|\bAmber\b/)
    }
  }, 40000)

  it('offers no download control, and says no file can be produced', async () => {
    const { container } = renderAt('/reports/medication-omissions')
    await settled(container)

    const page = container.querySelector('[data-report-view]') as HTMLElement
    for (const word of [/download/i, /export/i, /csv/i]) {
      expect(within(page).queryByRole('button', { name: word })).toBeNull()
      expect(within(page).queryByRole('link', { name: word })).toBeNull()
    }
    const note = page.querySelector('[data-no-file]')!
    expect(note.textContent).toContain('No file can be produced here')
  }, 40000)

  it('offers no period comparison on a report that is a state', async () => {
    const { container } = renderAt('/reports/consent-coverage')
    await settled(container)

    expect(container.querySelector('[data-comparison]')).toBeNull()
    // Absent with a reason, rather than absent silently.
    expect(container.querySelector('[data-state-note]')?.textContent).toContain(
      'no period to compare',
    )
  }, 40000)

  it('changes the table when the cut changes', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/reports/medication-omissions')
    await settled(container)

    const first = [...container.querySelectorAll('[data-row]')].map((node) =>
      node.getAttribute('data-row'),
    )
    await user.selectOptions(container.querySelector('[data-filter="cut"]')!, 'round')
    await waitFor(() => {
      const second = [...container.querySelectorAll('[data-row]')].map((node) =>
        node.getAttribute('data-row'),
      )
      expect(second).not.toEqual(first)
    })
  }, 40000)
})

describe('the staff report is workload, never a ranking', () => {
  it('orders by name and by nothing else', async () => {
    const data = await loadReportData(rosewood, NOW_ISO)
    const definition = reportById('care-note-coverage')!
    const period = periodEndingToday(NOW_ISO, rosewood.timeZone, REPORT_PERIOD_DAYS)
    const result = runReport({
      data,
      definition,
      period,
      previous: undefined,
      cut: 'staff',
    })

    const names = result.rows.map((entry) => entry.name)
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  }, 40000)

  it('attributes no omission to anybody', async () => {
    const definition = reportById('care-note-coverage')!
    const data = await loadReportData(rosewood, NOW_ISO)
    const period = periodEndingToday(NOW_ISO, rosewood.timeZone, REPORT_PERIOD_DAYS)
    const result = runReport({
      data,
      definition,
      period,
      previous: undefined,
      cut: 'staff',
    })

    /*
     * An omission is a dose nobody recorded, so it carries nobody's name.
     * Attributing one to whoever else was on shift would invent exactly the
     * accusation the note above the table warns against.
     */
    for (const column of result.columns) {
      expect(column.label.toLowerCase()).not.toContain('no record')
      expect(column.label.toLowerCase()).not.toContain('missed')
    }
  }, 40000)

  it('carries the note above the table', async () => {
    const { container } = renderAt('/reports/care-note-coverage')
    await settled(container)

    const note = container.querySelector('[data-staff-note]')!
    expect(note.textContent).toContain('not a ranking')
    expect(note.textContent).toContain('ordered by name')
  }, 40000)

  it('keeps deactivated staff on the table, marked', async () => {
    const { container } = renderAt('/reports/care-note-coverage')
    await settled(container)

    // Records outlive access (§6.7).
    expect(container.querySelector('[data-deactivated]')).toBeTruthy()
  }, 40000)
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the index', async () => {
    await check('/reports')
  }, 40000)

  it('has no violations on a report', async () => {
    await check('/reports/incidents-by-type')
  }, 40000)

  it('has no violations on the staff report', async () => {
    await check('/reports/care-note-coverage')
  }, 40000)
})

describe('the analytical layout carries the same refusals as compliance', () => {
  /*
   * Pinned to the instant the fixtures were generated against, and every
   * expectation computed from the same runner the screen uses — a figure typed
   * here would pass while the screen showed a different one.
   */
  it('leads on the reports that cannot state a finding, not on the findings', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    const data = await loadReportData(rosewood, NOW_ISO)
    const headline = reportHeadline(runEverything(data))

    const hero = container.querySelector('[data-hero]') as HTMLElement
    expect(hero.querySelector('[data-numeric]')!.textContent).toBe(
      formatCount(headline.tooThin),
    )
    expect(headline.tooThin).toBeLessThan(headline.withFinding)
    expect(hero.textContent).toContain(`of ${formatCount(headline.reports)}`)
  }, 30000)

  it('borrows no rating vocabulary, because there are no ratings here', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    /*
     * The dots on the compliance panel mean green, amber and red. A report
     * shows figures and coverage and makes no judgement (PRD §6.6h), so the
     * shape does not travel — one shape, one meaning.
     */
    expect(container.querySelector('[data-dot]')).toBeNull()
    expect(container.querySelector('[data-rating]')).toBeNull()
  }, 30000)

  it('keeps the hatch a bar segment rather than a lighter shade', async () => {
    const { container } = renderAt('/reports')
    await settled(container)

    const bars = [...container.querySelectorAll('[data-bar]')]
    expect(bars).toHaveLength(REPORTS.length)

    const withGap = bars.filter((bar) => {
      const thin = bar.querySelector('[data-bar-segment="thin"]') as HTMLElement
      return Number.parseFloat(thin.style.width) > 0
    })
    // If nothing is below the floor the chart has nothing to say and this
    // guard is measuring an empty set rather than the treatment.
    expect(withGap.length).toBeGreaterThan(0)

    for (const bar of withGap) {
      const thin = bar.querySelector('[data-bar-segment="thin"]')!
      const usable = bar.querySelector('[data-bar-segment="usable"]')!
      expect(thin.className, bar.getAttribute('data-bar') ?? '').toContain(
        hatch.unrecorded,
      )
      expect(usable.className).not.toContain(hatch.unrecorded)
    }
  }, 30000)

  it('names both figures wherever a row states a direction', async () => {
    const { container } = renderAt('/reports/medication-omissions')
    await settled(container)

    const changes = [...container.querySelectorAll('[data-change]')].filter(
      (cell) => cell.getAttribute('data-change') !== 'no_comparison',
    )
    expect(changes.length).toBeGreaterThan(0)

    for (const cell of changes) {
      /*
       * A direction with one figure is a claim nobody can check, and an arrow
       * alone is that claim with the words removed as well.
       */
      expect(cell.textContent).toMatch(/^(worse|better|unchanged), was \S/)
      expect(cell.textContent).not.toMatch(/[↑↓▲▼➚➘]/)
    }
  }, 30000)

  it('puts the coverage the finding rests on beside it, not under the table', async () => {
    const { container } = renderAt('/reports/care-note-coverage')
    await settled(container)

    const view = container.querySelector('[data-report-view]') as HTMLElement
    const finding = view.querySelector('[data-finding]')!
    const thin = view.querySelector('[data-mini="thin"]')!

    // Both above the table, so a reader meets the coverage before the figures
    // rather than after them.
    const table = view.querySelector('table')!
    expect(finding.compareDocumentPosition(table)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(thin.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(thin.getAttribute('data-state')).toBe('unrecorded')
  }, 30000)
})
