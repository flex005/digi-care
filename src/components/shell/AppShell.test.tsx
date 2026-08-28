import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from './AppShell'
import { SessionProvider } from '@/app/session/SessionProvider'
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
  return render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  )
}

describe('AppShell', () => {
  it('shows the active site name, always', async () => {
    renderShell()
    // Read from fixtures, never inferred. PRD §2.4.
    await waitFor(() => expect(screen.getByText('Rosewood Court')).toBeVisible())
  })

  it('lists every module, including the ones not yet built', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    // Derived from the declaration. A retyped count measures the work, not
    // the rule, and has to be edited every time a module lands (§8).
    expect(navItems.length).toBeGreaterThan(0)
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

    // Sixteen of seventeen. Residents is built and enabled; everything else
    // stays present but disabled so the shell does not change shape as
    // phases land.
    // Derived from the declaration, not a literal. A hardcoded count needs
    // editing every time a phase lands, and an assertion you edit to make it
    // pass is an assertion that has stopped asserting.
    expect(disabled).toHaveLength(navItems.filter((item) => !item.enabled).length)
    for (const el of disabled) {
      expect(el).toHaveAccessibleName(/coming in a later phase/i)
    }
  })

  it('offers a skip-to-content link', async () => {
    renderShell()
    expect(await screen.findByText('Skip to content')).toHaveAttribute('href', '#main')
  })
})
