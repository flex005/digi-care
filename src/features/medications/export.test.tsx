import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { residents } from '@/data/fixtures/residents'
import { sites } from '@/data/fixtures/organisation'
import { MarChartRoute } from './MarChartRoute'
import { MedicationsTab } from './MedicationsTab'
import { PrescriptionsTab } from './PrescriptionsTab'

/**
 * MAR PDF export, stubbed. PRD §6.4.
 *
 * **Never a silent no-op** — pressing it says that nothing was produced.
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
    expect(dialog.textContent).toMatch(/cannot be exported yet/)
    expect(dialog.textContent).toMatch(/Nothing has been produced/)
  })
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
})
