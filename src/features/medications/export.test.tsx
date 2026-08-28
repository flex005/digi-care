import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { residentById, residents } from '@/data/fixtures/residents'
import { sites } from '@/data/fixtures/organisation'
import { MarChartRoute } from './MarChartRoute'
import { MedicationsTab } from './MedicationsTab'
import { PrescriptionsTab } from './PrescriptionsTab'

/**
 * MAR PDF export, stubbed. PRD §6.4.
 *
 * Two things under test, and the second is the one that matters.
 *
 * **Never a silent no-op** — pressing it says something. And **it names what
 * it would produce**, because a disabled capability that does not say what it
 * does cannot be planned around: a manager deciding whether an inspector's
 * request can be met needs to know this button means the chart itself, not a
 * summary of it.
 */

const RESIDENT = 'res-okafor'

function renderChart() {
  return renderChartFor(RESIDENT)
}

function renderChartFor(residentId: string) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          {
            path: 'medications',
            element: <MedicationsTab />,
            children: [
              { index: true, element: <MarChartRoute /> },
              { path: 'prescriptions', element: <PrescriptionsTab /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [`/residents/${residentId}/medications`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const charted = async (container: HTMLElement) => {
  await screen.findByRole('table')
  return container
}

describe('the export is present and does something', () => {
  it('offers the control on the chart', async () => {
    const { container } = renderChart()
    await charted(container)
    expect(screen.getByRole('button', { name: /Export PDF/ })).toBeEnabled()
  })

  it('says plainly that nothing was produced', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const dialog = await screen.findByRole('dialog')

    // A button that appears to have exported and did not is a record somebody
    // believes exists.
    expect(dialog.textContent).toMatch(/not available in this build/i)
    expect(dialog.textContent).toMatch(/Nothing has been produced/)
    expect(dialog.textContent).toMatch(/nothing has been sent/)
  })
})

describe('it says what it would contain', () => {
  it('names the resident and the range on screen', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    const heading = container.querySelector('[class*="chartTitle"]')!.textContent!
    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const dialog = await screen.findByRole('dialog')

    const resident = residentById(RESIDENT as never)!
    expect(dialog.textContent).toContain(resident.fullLegalName)
    // The range it would export is the range being looked at, said in the same
    // words the chart says above the grid.
    expect(dialog.textContent).toContain(heading)
  })

  it('names the shape of the record, not just its title', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const stub = (await screen.findByRole('dialog')).querySelector(
      '[data-export-stub]',
    )!

    expect(stub.textContent).toMatch(/medications? down the page/)
    expect(stub.textContent).toMatch(/rounds? a day/)
    expect(stub.textContent).toMatch(/cells in all/)
  })

  it('promises every cell in its state, and no blanks', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const stub = (await screen.findByRole('dialog')).querySelector(
      '[data-export-stub]',
    )!

    // The Evidence Invariant survives the export or the export is a different
    // document from the screen.
    expect(stub.textContent).toMatch(/given, not given with its reason, omitted/)
    expect(stub.textContent).toMatch(/Never a blank/)
    expect(stub.textContent).toMatch(/author and the time/)
    expect(stub.textContent).toMatch(/second signature/)
    expect(stub.textContent).toMatch(/it is the chart, not a summary of it/i)
  })

  it('follows the range control rather than describing a fixed month', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    const open = async () => {
      await user.click(screen.getByRole('button', { name: /Export PDF/ }))
      const text = (await screen.findByRole('dialog')).textContent!
      await user.click(screen.getByRole('button', { name: 'Close' }))
      // selector-ok: the claim is that no dialog is open anywhere, which is
      // what closing one means — there is nothing narrower to scope it to.
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      return text
    }

    const week = await open()
    await user.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() =>
      expect(container.querySelector('[class*="chartTitle"]')!.textContent).toMatch(
        /Month of/,
      ),
    )
    const month = await open()

    // A stub that describes a month while the reader is looking at a week is
    // a claim about a document nobody asked for.
    expect(week).not.toBe(month)
    expect(month).toMatch(/Month of/)
  }, 30000)
})

describe('accessibility', () => {
  it('has no axe violations on the export dialog', async () => {
    const user = userEvent.setup()
    const { container } = renderChart()
    await charted(container)

    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const dialog = await screen.findByRole('dialog')
    expect((await axe(dialog)).violations).toEqual([])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy()
  }, 60000)
})

describe('the zone is named after the site whose clock it is', () => {
  it("names the resident's own site, not the one being browsed", async () => {
    // The profile renders its times in `profile.site`'s zone while the chart
    // labelled them with `activeSite` — so a manager looking at a resident
    // from another site would have read one site's name over another site's
    // clock. A wrong label on a clinical timestamp, which §6 treats as a
    // wrong timestamp.
    const elsewhere = residents.find(
      (person) => person.siteId !== 'site-rosewood-court',
    )!
    expect(elsewhere, 'no resident outside the default site').toBeTruthy()

    const { container } = renderChartFor(elsewhere.id)
    await charted(container)

    const site = sites.find((entry) => entry.id === elsewhere.siteId)!
    const facts = container.querySelector('[class*="chartFacts"]')!
    expect(facts.textContent).toContain(site.name)
    expect(facts.textContent).not.toContain('Rosewood Court')
  })

  it('says the same site in the export as on the chart', async () => {
    const user = userEvent.setup()
    const elsewhere = residents.find(
      (person) => person.siteId !== 'site-rosewood-court',
    )!
    const { container } = renderChartFor(elsewhere.id)
    await charted(container)

    const site = sites.find((entry) => entry.id === elsewhere.siteId)!
    await user.click(screen.getByRole('button', { name: /Export PDF/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(`${site.name}’s zone`)
  })
})
