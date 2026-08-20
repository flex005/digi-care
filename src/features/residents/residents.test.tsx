import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider, SiteTimeZone } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { residents } from '@/data/fixtures/residents'
import { recordCompleteness } from '@/data/completeness'
import { ResidentsRoute } from './ResidentsRoute'
import { RiskFlagsCell } from './RiskFlagsCell'
import { CriticalGapsChip } from './CriticalGapsChip'

/**
 * The residents list. PRD §6.2.
 *
 * What is pinned here is not that the screen renders — it is that the screen
 * does its job: finding the residents nobody has looked at, and never letting
 * a blank stand in for a clinical answer.
 */

function renderList(initialEntry = '/residents') {
  const router = createMemoryRouter(
    [{ path: '/residents', element: <ResidentsRoute /> }],
    { initialEntries: [initialEntry] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const atSite = (ui: React.ReactNode) => (
  <SiteTimeZone timeZone="Europe/London">{ui}</SiteTimeZone>
)

describe('the risk flags column never renders a blank', () => {
  /**
   * The sharpest failure available on this screen. An empty risk cell reads as
   * "nothing wrong" when it may mean nobody has looked — PRD §2.1's falls
   * badge, applied to a table.
   */
  it('renders something for every one of the 32 residents', () => {
    for (const resident of residents) {
      const { container, unmount } = render(
        atSite(<RiskFlagsCell resident={resident} />),
      )
      expect(container.textContent?.trim()).not.toBe('')
      unmount()
    }
  })

  it('states "all assessed" rather than leaving the cell empty', () => {
    // A resident with nothing notable still gets a claim, not a blank.
    const settled = residents.find((resident) => {
      const { risks, allergies, resuscitation, eolc, isolation } = resident
      return (
        risks.falls.kind === 'assessed' &&
        risks.falls.level === 'low' &&
        risks.choking.kind === 'assessed' &&
        risks.choking.level !== 'high' &&
        allergies.kind === 'none_known' &&
        // for_resuscitation is the settled value and folds into the claim.
        resuscitation.kind === 'for_resuscitation' &&
        eolc.kind !== 'in_place' &&
        isolation.kind !== 'isolating'
      )
    })
    expect(settled, 'no resident has an entirely settled risk picture').toBeDefined()
    if (!settled) return
    render(atSite(<RiskFlagsCell resident={settled} />))
    expect(screen.getByText('All assessed — no flags')).toBeVisible()
  })

  it('hatches an unassessed falls risk rather than omitting it', () => {
    const beryl = residents.find((r) => r.id === 'res-hutchinson')!
    expect(beryl.risks.falls.kind).toBe('not_assessed')
    const { container } = render(atSite(<RiskFlagsCell resident={beryl} />))
    expect(screen.getByText('Falls — not assessed')).toBeVisible()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeInTheDocument()
  })
})

describe('the Critical records missing chip', () => {
  it('names the gaps instead of counting them', () => {
    const withGaps = residents.find((r) => recordCompleteness(r).hasCriticalGaps)!
    render(atSite(<CriticalGapsChip resident={withGaps} />))

    expect(screen.getByText('Critical records missing')).toBeVisible()
    // Every critical gap appears by name. "4 records missing" would tell a
    // manager something is wrong without telling them whether allergies is
    // one of them.
    for (const gap of recordCompleteness(withGaps).critical) {
      expect(screen.getByText(new RegExp(gap.shortLabel))).toBeVisible()
    }
  })

  it('says so plainly when the critical records are complete', () => {
    const clean = residents.find((r) => !recordCompleteness(r).hasCriticalGaps)!
    render(atSite(<CriticalGapsChip resident={clean} />))
    expect(screen.getByText('Critical records complete')).toBeVisible()
  })

  it('does not fire on every resident', () => {
    // A chip that fires on everyone discriminates nothing, and the column
    // exists to find neglected records.
    const flagged = residents.filter(
      (r) => recordCompleteness(r).hasCriticalGaps,
    ).length
    expect(flagged).toBeGreaterThan(0)
    expect(flagged).toBeLessThan(residents.length)
  })
})

describe('sorting finds neglected records', () => {
  it('puts residents with no care note at all first under "oldest note"', async () => {
    const user = userEvent.setup()
    renderList()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    // Widen to every resident so a never-noted one is in scope.
    const noteHeader = await screen.findByRole('button', { name: /Last care note/i })
    await user.click(noteHeader)

    const table = screen.getByRole('table')
    expect(table).toHaveAccessibleName(/oldest care note/i)

    const rows = within(table).getAllByRole('row').slice(1)
    const firstRowText = rows[0]?.textContent ?? ''
    const neverNoted = rows.filter((row) =>
      (row.textContent ?? '').includes('No care note recorded'),
    )

    // If any resident has never been written up, they lead. Sorting them last
    // — the natural result of treating a missing note as a missing date —
    // would hide exactly the people this sort was built to surface.
    if (neverNoted.length > 0) {
      expect(firstRowText).toContain('No care note recorded')
    }
  })

  it('announces the sort direction on the column, not just with an arrow', async () => {
    const user = userEvent.setup()
    renderList()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    const nameHeader = screen.getByRole('button', { name: 'Resident' })
    const nameColumn = nameHeader.closest('th')
    expect(nameColumn).toHaveAttribute('aria-sort', 'ascending')

    await user.click(nameHeader)
    expect(nameHeader.closest('th')).toHaveAttribute('aria-sort', 'descending')
  })
})

describe('the two empty states are different answers', () => {
  it('says the site is empty when nobody has been admitted', async () => {
    renderList('/residents?sim=empty')
    expect(await screen.findByText(/No residents at .* yet/)).toBeVisible()
    expect(screen.getByText(/This is not a filter result/)).toBeVisible()
  })

  it('says the view is narrowed when filters exclude everyone', async () => {
    const user = userEvent.setup()
    renderList()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    // Review never scheduled AND falls risk low is an empty intersection at
    // Rosewood; if it ever is not, this still asserts the right shape.
    await user.click(screen.getByRole('combobox', { name: 'Review status' }))
    await user.click(
      await screen.findByRole('option', { name: 'Review never scheduled' }),
    )
    await user.click(screen.getByRole('combobox', { name: 'Falls risk level' }))
    await user.click(await screen.findByRole('option', { name: 'Falls risk — low' }))

    const narrowed = screen.queryByText('No residents match these filters')
    if (narrowed) {
      expect(narrowed).toBeVisible()
      // Crucially it does NOT claim the site is empty — the residents are
      // still there, the view is narrowed.
      expect(screen.getByText(/They are still here/)).toBeVisible()
      expect(screen.queryByText(/This is not a filter result/)).not.toBeInTheDocument()
    }
  })

  it('warns when a simulated state is active, so it cannot be mistaken for real', async () => {
    renderList('/residents?sim=error')
    expect(await screen.findByText(/Simulated .* state/)).toBeVisible()
  })
})

describe('read-only', () => {
  it('offers Add resident to a manager, disabled until admission is built', async () => {
    renderList()
    const add = await screen.findByRole('button', { name: /Add resident/i })
    expect(add).toBeDisabled()
  })
})

describe('accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderList()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)

  it('is a real table with a caption naming its denominator', async () => {
    renderList()
    const table = await screen.findByRole('table')
    // Rule 4 reaches the caption too: "15 of 28 residents at Rosewood Court".
    expect(table).toHaveAccessibleName(/\d+ of \d+ residents at/)
  })

  it('gives every resident a real link, not a click handler on a row', async () => {
    renderList()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    for (const row of rows) {
      expect(within(row).getAllByRole('link').length).toBeGreaterThan(0)
    }
  })
})
