import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/primitives'
import { navItems, navSections } from '@/app/nav-items.icons'
import { Sidebar } from './Sidebar'
import type { NavCount } from './NavBadge'

/**
 * The sidebar. PRD §4.7.
 *
 * Two things are load-bearing and easy to break by accident: collapsing must
 * not strip a control's accessible name, and a count badge must never be the
 * whole claim.
 */

const COUNTS: Partial<Record<string, NavCount>> = {
  '/reviews': {
    value: 2,
    description: '2 care plan reviews overdue, of 32 residents.',
  },
}

function renderSidebar(collapsed = false) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Sidebar collapsed={collapsed} onToggleCollapsed={() => {}} counts={COUNTS} />
        ),
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
}

describe('every module stays listed', () => {
  it('renders all seventeen, built or not', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(navItems).toHaveLength(17)
    for (const item of navItems) {
      expect(
        within(nav).getByText(item.label, { selector: 'span' }),
        `${item.label} is missing from the sidebar`,
      ).toBeInTheDocument()
    }
  })

  it('assigns every item to a declared section, and shows every section used', () => {
    const sectionIds = new Set(navSections.map((section) => section.id))
    for (const item of navItems) {
      expect(
        sectionIds.has(item.section),
        `${item.label} is in section "${item.section}", which is not declared`,
      ).toBe(true)
    }
    renderSidebar()
    for (const section of navSections) {
      if (section.label === '') continue
      expect(screen.getByText(section.label)).toBeVisible()
    }
  })
})

describe('count badges are never the whole claim', () => {
  it('puts the denominator in the accessible name, not just the number', () => {
    renderSidebar()
    // PRD §4.7 wants a figure at a glance; CLAUDE.md §1 forbids a bare count.
    // Both hold: the badge is a glyph pointing at a claim carried in full by
    // the accessible name.
    const reviews = screen.getByRole('link', { name: /Reviews/ })
    expect(reviews).toHaveAccessibleName(/of 32 residents/)
    expect(reviews).toHaveAccessibleName(/overdue/)
  })

  it('hides the bare figure from assistive technology', () => {
    const { container } = renderSidebar()
    const badge = container.querySelector('[class*="badge"]')
    expect(badge).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows no badge where there is no evidence, rather than a zero', () => {
    renderSidebar()
    // Incidents has no fixtures yet. A badge reading "0 open incidents" would
    // be a claim nobody has the evidence to make — absent is not zero.
    expect(screen.getByRole('link', { name: /Incidents/ })).not.toHaveAccessibleName(
      /\b0\b/,
    )
  })
})

describe('collapsing never removes an accessible name', () => {
  /**
   * PRD §7 permits an icon-only control only where a visible label sits
   * adjacent, or where there is an aria-label plus a tooltip. Collapsed, the
   * visible labels are gone — so every single item must still be named, or the
   * rail becomes seventeen unlabelled buttons.
   */
  it.each(navItems.map((item) => [item.label, item] as const))(
    '%s keeps its name when collapsed',
    (label) => {
      renderSidebar(true)
      const nav = screen.getByRole('navigation', { name: 'Main navigation' })
      const named = within(nav)
        .getAllByRole('link', { hidden: true })
        .filter((el) => {
          const name = el.getAttribute('aria-label') ?? ''
          return name.startsWith(label)
        })
      expect(
        named.length,
        `${label} has no accessible name in the collapsed rail`,
      ).toBeGreaterThan(0)
    },
  )

  it('keeps the collapse control named in both states', () => {
    const expanded = renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expanded.unmount()

    renderSidebar(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('keeps the count claim in the collapsed rail, where the figure cannot fit', () => {
    renderSidebar(true)
    expect(screen.getByRole('link', { name: /Reviews/ })).toHaveAccessibleName(
      /of 32 residents/,
    )
  })
})
