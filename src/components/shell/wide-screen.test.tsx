import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { AppShell } from './AppShell'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useWideScreen } from './wide-screen'

/**
 * A screen that takes the width, and gives it back.
 *
 * The clipping itself cannot be asserted here — jsdom performs no layout, so
 * every width is zero and the assertion would pass on any grid (see
 * `scripts/check-layout.mjs`, which runs in a real browser). What *is* testable is the part that makes
 * taking the width acceptable rather than high-handed: the reader can undo it,
 * and it undoes itself on the way out.
 */

function Wide() {
  useWideScreen()
  return (
    <div>
      <p>the wide screen</p>
      <Link to="/elsewhere">Leave</Link>
    </div>
  )
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Link to="/wide">Go wide</Link> },
          { path: 'wide', element: <Wide /> },
          { path: 'elsewhere', element: <p>somewhere else</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  )
}

const railIsCollapsed = () =>
  screen.queryByRole('button', { name: 'Expand sidebar' }) !== null

describe('a screen that needs the width takes it', () => {
  it('collapses the rail on arrival', async () => {
    renderAt('/')
    expect(railIsCollapsed()).toBe(false)

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Go wide' }))

    await waitFor(() => expect(screen.getByText('the wide screen')).toBeVisible())
    expect(railIsCollapsed()).toBe(true)
  })

  it('keeps the control visible, so the reader can put it back', async () => {
    renderAt('/wide')
    await waitFor(() => expect(screen.getByText('the wide screen')).toBeVisible())

    // Not hidden and not disabled: the screen sets the same state the reader
    // can set, rather than overriding it. Expanding again clips the week,
    // which is theirs to decide.
    const user = userEvent.setup()
    const control = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(control).toBeVisible()
    await user.click(control)
    expect(railIsCollapsed()).toBe(false)
  })

  /*
   * Both of these were written a first time in a way that could not fail.
   *
   * "Arrive open, collapse automatically, expand by hand, leave, expect open"
   * passes whether the restore runs, restores the wrong value, or never runs
   * at all — every path ends open, because the reader's last act already set
   * it there. The mutation is what showed it: removing the restore entirely
   * left all four tests green.
   *
   * A restore is only observable when the state on arrival differs from the
   * state on departure. These two make them differ, in opposite directions.
   */

  it('restores an open rail that this screen collapsed', async () => {
    renderAt('/')
    const user = userEvent.setup()

    // Open on arrival, and untouched by hand from here on — so the only thing
    // that can put it back is the restore.
    expect(railIsCollapsed()).toBe(false)
    await user.click(screen.getByRole('link', { name: 'Go wide' }))
    await waitFor(() => expect(railIsCollapsed()).toBe(true))

    await user.click(screen.getByRole('link', { name: 'Leave' }))
    await waitFor(() => expect(screen.getByText('somewhere else')).toBeVisible())
    expect(railIsCollapsed()).toBe(false)
  })

  it('restores what it was on arrival, not what the reader last set', async () => {
    renderAt('/')
    const user = userEvent.setup()

    // Collapsed on arrival — so "restore" and "leave as the reader left it"
    // now disagree, which is the only condition under which the difference
    // between them is visible.
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(railIsCollapsed()).toBe(true)

    await user.click(screen.getByRole('link', { name: 'Go wide' }))
    await waitFor(() => expect(screen.getByText('the wide screen')).toBeVisible())

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(railIsCollapsed()).toBe(false)

    await user.click(screen.getByRole('link', { name: 'Leave' }))
    await waitFor(() => expect(screen.getByText('somewhere else')).toBeVisible())

    // Collapsed, as it was when they walked in.
    expect(railIsCollapsed()).toBe(true)
  })
})
