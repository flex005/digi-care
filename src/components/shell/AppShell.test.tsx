import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from './AppShell'
import { navItems } from '@/app/nav-items.icons'

/**
 * PRD §4.7 — the shell does not change shape as phases land, and §2.4 — the
 * active site name is permanently visible for every user.
 */

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <div /> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppShell', () => {
  it('shows the active site name, always', async () => {
    renderShell()
    // Read from fixtures, never inferred. PRD §2.4.
    await waitFor(() => expect(screen.getByText('Rosewood Court')).toBeVisible())
  })

  it('lists all sixteen modules, including the ones not yet built', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    expect(navItems).toHaveLength(16)
    for (const item of navItems) {
      // Absence from a list is the same bug as a blank cell. CLAUDE.md §1.
      expect(
        within(nav).getByText(item.label, { selector: 'span' }),
      ).toBeInTheDocument()
    }
  })

  it('marks unbuilt modules disabled rather than hiding them', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    const disabled = within(nav)
      .getAllByRole('link', { hidden: true })
      .filter((el) => el.getAttribute('aria-disabled') === 'true')

    // Every module is unbuilt in Phase 0.
    expect(disabled).toHaveLength(16)
    for (const el of disabled) {
      expect(el).toHaveAccessibleName(/coming in a later phase/i)
    }
  })

  it('offers a skip-to-content link', async () => {
    renderShell()
    expect(await screen.findByText('Skip to content')).toHaveAttribute('href', '#main')
  })
})
