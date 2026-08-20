import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/primitives'
import { digiApps, NOT_LINKED } from '@/app/digi-apps'
import { AppSwitcher } from './AppSwitcher'

/**
 * The app switcher.
 *
 * A launcher is a surface that invites invention — a plausible sibling app
 * costs nothing to type and is indistinguishable from a real one to anybody
 * reviewing the screen. These tests hold the two things that stop that: the
 * list is exactly the declared one, and every app with nowhere to go says so
 * in text the reader can actually reach.
 */

function renderSwitcher() {
  return render(
    <TooltipProvider>
      <AppSwitcher />
    </TooltipProvider>,
  )
}

async function openMenu() {
  const user = userEvent.setup()
  renderSwitcher()
  await user.click(screen.getByRole('button', { name: 'diGi apps' }))
  return screen.getByRole('menu')
}

describe('the trigger', () => {
  it('is named, since it is icon-only', () => {
    renderSwitcher()
    // PRD §7: an icon-only control needs an accessible name. The tooltip is
    // the visible half and cannot be asserted without hovering; the name is
    // the half a screen reader depends on.
    expect(screen.getByRole('button', { name: 'diGi apps' })).toBeInTheDocument()
  })
})

describe('the list is the declared list', () => {
  it('shows every declared app and nothing else', async () => {
    const menu = await openMenu()
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(digiApps.length)
    for (const app of digiApps) {
      expect(
        within(menu).getByText(app.name),
        `${app.name} is declared but not rendered`,
      ).toBeVisible()
    }
  })

  it('marks exactly one app as the one you are in', () => {
    // Two current apps, or none, would make the switcher lie about where the
    // reader is standing.
    expect(digiApps.filter((app) => app.isCurrent)).toHaveLength(1)
  })
})

describe('nothing pretends to go anywhere', () => {
  it('says so in visible text on every app that is not linked', async () => {
    const menu = await openMenu()
    for (const app of digiApps.filter((entry) => !entry.isCurrent)) {
      const item = within(menu)
        .getAllByRole('menuitem')
        .find((element) => element.textContent?.includes(app.name))
      expect(item?.textContent, `${app.name} does not say it goes nowhere`).toContain(
        NOT_LINKED,
      )
    }
  })

  it('offers no link, because there is nowhere to send anyone', async () => {
    const menu = await openMenu()
    // A frontend-only build has no sibling app to reach. An anchor here would
    // either 404 or silently do nothing — PRD §6.4: never a silent no-op.
    expect(within(menu).queryAllByRole('link')).toHaveLength(0)
  })
})
