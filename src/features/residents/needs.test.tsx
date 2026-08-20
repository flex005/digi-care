import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from './ResidentProfileRoute'
import { NeedsTab } from './NeedsTab'
import { NEEDS_SECTIONS, RENDERED_DOMAIN_IDS } from './needs-sections'

/**
 * The Needs tab. PRD §6.2, source PRD §16.2.
 *
 * The failure this screen is most exposed to is not a blank cell — it is a
 * missing row. A Needs tab showing only the domains somebody got round to
 * writing reads as a complete picture of a person's needs, and nothing on the
 * screen says otherwise.
 */

function renderNeeds(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'needs', element: <NeedsTab /> }],
      },
    ],
    { initialEntries: [`/residents/${id}/needs`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('every care plan domain is on the screen', () => {
  /**
   * §16.2's five need groups claim only nine of the ten domains —
   * `end_of_life` belongs to none of them. Rendering the five alone would drop
   * a domain silently, so the leftovers are computed and rendered rather than
   * hardcoded.
   */
  it('renders every domain exactly once across all sections', () => {
    const all = CARE_PLAN_DOMAINS.map((domain) => domain.id).sort()
    expect([...RENDERED_DOMAIN_IDS].sort()).toEqual(all)
    expect(new Set(RENDERED_DOMAIN_IDS).size).toBe(RENDERED_DOMAIN_IDS.length)
  })

  it('keeps the five §16.2 groups, and adds a section only for leftovers', () => {
    // Five groups plus, at most, one catch-all. More than that means the
    // grouping has drifted from the specification.
    expect(NEEDS_SECTIONS.length).toBeGreaterThanOrEqual(5)
    expect(NEEDS_SECTIONS.length).toBeLessThanOrEqual(6)
    const other = NEEDS_SECTIONS.find((section) => section.id === 'other')
    expect(other?.domainIds).toContain('end_of_life')
    // The catch-all explains itself rather than appearing unlabelled.
    expect(other?.note).toMatch(/Future Plans/)
  })

  it.each(residents.map((resident) => [resident.fullLegalName, resident.id] as const))(
    '%s — all ten domains rendered',
    async (name, id) => {
      const { container } = renderNeeds(id)
      await waitFor(() =>
        expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
      )
      for (const domain of CARE_PLAN_DOMAINS) {
        const row = container.querySelector(`[data-domain="${domain.id}"]`)
        expect(
          row,
          `${name}: ${domain.name} is missing from the Needs tab`,
        ).toBeTruthy()
        expect(row?.textContent?.trim()).not.toBe('')
      }
    },
  )
})

describe('a domain with no content says so', () => {
  it('hatches an unwritten domain rather than showing an empty summary', async () => {
    // Ismail Sowande, admitted yesterday: every domain not_started.
    const { container } = renderNeeds('res-sowande')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = container.querySelector(`[data-domain="${domain.id}"]`)
      expect(
        row?.querySelector('[data-state="unrecorded"]'),
        `${domain.name} has no content but did not render the hatch`,
      ).toBeTruthy()
    }
  })

  it('never lets "not assessed" and "Independent" look alike', async () => {
    const { container } = renderNeeds('res-sowande')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    // Support level unassessed is hatched, never rendered as a settled pill.
    const row = container.querySelector('[data-domain="mobility"]')
    expect(row?.textContent).toMatch(/Support level not assessed/)
    expect(row?.textContent).not.toMatch(/Independent/)
  })

  it('offers the write affordance disabled, since the editor is Phase 6', async () => {
    renderNeeds('res-sowande')
    const links = await screen.findAllByRole('link', { name: /coming in Phase 6/i })
    expect(links.length).toBe(CARE_PLAN_DOMAINS.length)
    for (const link of links) {
      expect(link).toHaveAttribute('aria-disabled', 'true')
    }
  })
})

describe('the Stale state', () => {
  it('shows a domain past its review date as overdue, with how long', async () => {
    // Grace Adeyemi's mobility domain was finalised 14 months ago and never
    // reviewed — PRD §5.3 gap 7. Unlike General Information, this tab has a
    // real Stale state, because domains carry review dates.
    const { container } = renderNeeds('res-adeyemi')
    await waitFor(() =>
      expect(container.querySelector('[data-domain="mobility"]')).toBeInTheDocument(),
    )
    const row = container.querySelector('[data-domain="mobility"]')
    expect(row?.textContent).toMatch(/Review due/)
    expect(row?.textContent).toMatch(/days overdue/)
  })
})

describe('the tab within the profile', () => {
  it('keeps the subject header mounted alongside it', async () => {
    renderNeeds('res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Risk badges' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderNeeds('res-adeyemi')
    await waitFor(() =>
      expect(container.querySelector('[data-domain]')).toBeInTheDocument(),
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)
})
