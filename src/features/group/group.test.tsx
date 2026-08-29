import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDateTime } from '@/data/types'
import { NOW, toIsoDateTime } from '@/data/fixtures/generate'
import { sites } from '@/data/fixtures/organisation'
import {
  changedFigures,
  configuredSites,
  figures,
  minPopulationForARate,
  setFigure,
  setSiteTimeZone,
} from '@/data/access/settings-store'
import { GroupOverviewRoute } from './GroupOverviewRoute'
import { SettingsRoute } from './SettingsRoute'
import { ChangedFiguresBanner } from './ChangedFiguresBanner'
import { loadGroup } from './group-figures'

/**
 * Multi-site. PRD §6.7, Phase 15.
 *
 * **The module's hazard is a group figure that hides a thin home inside a
 * healthy one.** Everything here is about keeping the two homes' standings
 * apart: per-site figures, a spread in the same sentence as any group number,
 * and no group rating at all.
 */

/** Pinned, and every date-dependent assertion is written against it. */
const NOW_ISO = toIsoDateTime(NOW) as IsoDateTime

/** Put every figure back, so one test's change cannot colour the next. */
afterEach(() => {
  for (const figure of figures()) {
    if (!figure.fixedAtGeneration) setFigure(figure.id, figure.fallback)
  }
})

/**
 * Stands in for the Dashboard at `/`.
 *
 * The index route IS the Dashboard (routes.tsx), so "open this home" means
 * "go to `/`". What is under test is that the button switches the session and
 * moves the reader; the Dashboard's own content is tested by its own suite, and
 * mounting it here would make this file pay for that too.
 *
 * It prints the active site, so one assertion can check both halves of the act.
 */
function DashboardStandIn() {
  const { activeSite } = useSession()
  return <div data-dashboard-standin>{activeSite.name}</div>
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      // Without this the click below navigated into a router that had no `/`,
      // react-router resolved against an undefined match, and the resulting
      // unhandled rejection failed the file while every assertion passed.
      { path: '/', element: <DashboardStandIn /> },
      { path: 'group', element: <GroupOverviewRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
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
        container.querySelector('[data-group-overview], [data-settings]'),
      ).toBeTruthy(),
    { timeout: 20000 },
  )

describe('a group figure never hides a thin home', () => {
  it('keeps each home’s own standing rather than averaging it away', async () => {
    const data = await loadGroup(configuredSites(), NOW_ISO)

    for (const row of data.rows) {
      expect(row.perSite, row.id).toHaveLength(sites.length)
      for (const figure of row.perSite) {
        // Each home keeps its own column and its own standing.
        expect(figure.site.id, row.id).toBeTruthy()
      }
    }
  }, 30000)

  it('renders a home below the floor as the hatch, never as a zero', async () => {
    const { container } = renderAt('/group')
    await settled(container)

    const insufficient = container.querySelector('[data-figure="insufficient"]')
    expect(insufficient).toBeTruthy()
    expect(insufficient!.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  }, 30000)

  it('gives the group no figure where no home has one', async () => {
    /*
     * A figure assembled from two unusable ones is not usable. Summing two
     * populations that each fall below the floor produces one that clears it,
     * arithmetically, and it is the defect this whole screen exists against.
     */
    setFigure('min-population-for-a-rate', 100_000)
    const data = await loadGroup(configuredSites(), NOW_ISO)

    for (const row of data.rows) {
      expect(row.group, row.id).toBeUndefined()
      expect(row.spread, row.id).toContain('the group has none either')
    }
  }, 30000)

  it('carries the spread in the same sentence as the number', async () => {
    const data = await loadGroup(configuredSites(), NOW_ISO)
    const withFigure = data.rows.filter((row) => row.group !== undefined)
    expect(withFigure.length).toBeGreaterThan(0)

    for (const row of withFigure) {
      // How many homes are inside it, and both homes named with their own.
      expect(row.spread, row.id).toContain('across')
      for (const site of sites) {
        expect(row.spread, `${row.id} does not name ${site.name}`).toContain(site.name)
      }
    }
  }, 30000)

  it('says a home is too small once, in its head', async () => {
    const { container } = renderAt('/group')
    await settled(container)

    const tags = container.querySelectorAll('[data-thin-tag]')
    expect(tags.length).toBe(1)
    // In the card head, not on the rows it affects.
    expect(tags[0]?.closest('[data-site-row]')).toBeNull()
  }, 30000)
})

describe('there is no group rating', () => {
  it('renders none, and says why', async () => {
    const { container } = renderAt('/group')
    await settled(container)

    const page = container.querySelector('[data-group-overview]')!
    expect(page.querySelector('[data-rating]')).toBeNull()
    expect(page.textContent).not.toMatch(/\bGreen\b|\bAmber\b|\bRed\b/)

    const note = page.querySelector('[data-no-rating]')!
    expect(note.textContent).toContain('there will not be one')
    // Inert: nothing here is a gap anybody can close.
    expect(note.querySelector('[data-state="unrecorded"]')).toBeNull()
  }, 30000)

  it('shows counts on the site cards rather than rates', async () => {
    const { container } = renderAt('/group')
    await settled(container)

    for (const row of container.querySelectorAll('[data-site-row]')) {
      // A count needs no population floor, and counts are what a manager acts
      // on. A percentage on a four-resident card would need one.
      expect(row.textContent).not.toMatch(/%/)
    }
  }, 30000)
})

describe('settings change what a screen says, or they are not offered', () => {
  it('offers a control only for a figure read at render', () => {
    for (const figure of figures()) {
      if (!figure.fixedAtGeneration) continue
      // A setter that silently ignores its argument is a control that does
      // nothing, one layer down.
      expect(() => setFigure(figure.id, 99)).toThrow()
    }
  })

  it('renders a generation-fixed figure read-only, with the reason', async () => {
    const { container } = renderAt('/settings')
    await settled(container)

    const fixed = container.querySelector('[data-fixed="medication-lookahead-hours"]')!
    expect(fixed.textContent).toContain('regenerating')
    expect(within(fixed as HTMLElement).queryByRole('spinbutton')).toBeNull()
    expect(within(fixed as HTMLElement).queryByRole('textbox')).toBeNull()
  }, 30000)

  it('changes what a figure means everywhere it is read', async () => {
    const before = minPopulationForARate()
    setFigure('min-population-for-a-rate', before + 1)
    expect(minPopulationForARate()).toBe(before + 1)

    // Read at render: the group rows recompute against the new value.
    const data = await loadGroup(configuredSites(), NOW_ISO)
    expect(data.cards.some((card) => card.thin)).toBe(true)
  }, 30000)

  it('changes a site’s zone, which decides what its timestamps say', () => {
    const site = sites[0]!
    setSiteTimeZone(site.id, 'Europe/Madrid')
    expect(configuredSites().find((entry) => entry.id === site.id)?.timeZone).toBe(
      'Europe/Madrid',
    )
    setSiteTimeZone(site.id, site.timeZone)
  })
})

describe('a changed figure is announced on every screen', () => {
  it('renders nothing while everything is at its default', () => {
    const { container } = render(<ChangedFiguresBanner />)
    expect(changedFigures()).toHaveLength(0)
    expect(container.querySelector('[data-changed-figures]')).toBeNull()
  })

  it('names which figure moved, and what it was', () => {
    setFigure('due-soon-days', 45)

    const { container } = render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', element: <ChangedFiguresBanner /> }], {
          initialEntries: ['/'],
        })}
      />,
    )

    const rendered = container.querySelector('[data-changed-figures]')!
    // "Something has changed" is a signal with nothing behind it — it says
    // which figure, what it is now, and what it was.
    expect(rendered.textContent).toContain('45')
    expect(rendered.textContent).toContain('30')
  })
})

describe('accessibility', () => {
  it('has no violations on the group overview', async () => {
    const { container } = renderAt('/group')
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 40000)

  it('has no violations on settings', async () => {
    const { container } = renderAt('/settings')
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 40000)
})

describe('the cross-site banner', () => {
  it('offers the switch rather than performing it', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/group')
    await settled(container)

    // The group card's own switch is the same act, and it is a control the
    // reader presses rather than something the app does to them.
    //
    // **This asserted the opposite until 29/08/2026.** It checked the overview
    // was still on screen after the click, which was true only because the
    // navigation was crashing: the router had no `/`, so nothing moved. With
    // the route present the button does what it says, and the assertion now
    // reads the act rather than the wreckage of it.
    const ashgrove = sites.find((site) => site.id === 'site-ashgrove-lodge')!
    const open = container.querySelector('[data-open-site="site-ashgrove-lodge"]')!
    await user.click(open)

    const landed = await waitFor(() => {
      const standIn = container.querySelector('[data-dashboard-standin]')
      expect(standIn).toBeTruthy()
      return standIn!
    })
    // Both halves of one act: the session moved, and so did the reader.
    expect(landed.textContent).toBe(ashgrove.name)
    expect(container.querySelector('[data-group-overview]')).toBeNull()
  }, 30000)
})
