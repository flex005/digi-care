import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionContext, type Session } from '@/app/session/context'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDateTime, StaffMember } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { organisation, staffOkonkwo } from '@/data/fixtures/organisation'
import { configuredSites } from '@/data/access/settings-store'
import { memberById, teamMembers } from '@/data/access/team-store'
import { endSession } from '@/data/access/session-losses'
import { PERMISSION_MODULES, levelFor } from '@/features/team/permissions'
import { MyDashboardRoute } from './MyDashboardRoute'
import { MyPermissionsRoute } from './MyPermissionsRoute'

/**
 * One person's own screens. PRD §6.7.
 *
 * **The load-bearing refusal: no counts of their own work.** diGi-Care has no
 * rota, so a count of what somebody recorded has no honest denominator, and a
 * figure about a person without what it is out of is an accusation rather than
 * a measurement. Phase 14 refused it on the manager's screen; it applies with
 * more force where the person reading it is the person being counted.
 */

afterEach(() => {
  endSession()
})

/** A pinned session, so "who is signed in" is a fact of the test. */
function signedInAs(member: StaffMember) {
  const sites = configuredSites()
  const site = sites.find((entry) => member.siteIds.includes(entry.id)) ?? sites[0]!
  return function Provider({ children }: { children: React.ReactNode }) {
    const value: Session = {
      organisation,
      sites,
      reloadSites: () => {},
      activeSite: site,
      setActiveSite: () => {},
      signIn: {
        kind: 'signed_in',
        member,
        at: appNow().toISOString() as IsoDateTime,
      },
      signInAs: () => {},
      signOut: () => {},
      currentUser: member.ref,
    }
    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  }
}

function renderMe(member: StaffMember, path = '/me') {
  const Provider = signedInAs(member)
  const router = createMemoryRouter(
    [
      { path: '/me', element: <MyDashboardRoute /> },
      { path: '/me/permissions', element: <MyPermissionsRoute /> },
      { path: '/sign-out', element: <p>sign out</p> },
      { path: '/medications/round', element: <p>the round</p> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <Provider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </Provider>,
  )
}

const carer = teamMembers().find(
  (member) => member.role === 'care_worker' && member.standing.kind === 'has_access',
)!
const manager = memberById(staffOkonkwo.id)!

const settled = (container: HTMLElement, selector = '[data-my-dashboard]') =>
  // selector-ok: the marker is the caller’s own attribute selector, chosen per test
  waitFor(() => expect(container.querySelector(selector)).toBeTruthy())

describe('the screen is one person’s, and it is not a score', () => {
  it('carries no count of what this person recorded', async () => {
    const { container } = renderMe(carer)
    await settled(container)

    /*
     * The three tiles are: the home's next round, what this person flagged and
     * did not get an answer to, and what nobody has written up. None of them
     * is a total of their output, and there is no fourth.
     */
    const tiles = [...container.querySelectorAll('[data-tile]')].map((tile) =>
      tile.getAttribute('data-tile'),
    )
    expect(tiles).toEqual(['next-round', 'waiting', 'not-written-up'])

    // And the list of what they did carries no total above or below it.
    const panel = container.querySelector('[data-not-held="no-counts"]')!
    expect(panel.textContent).toMatch(/no counts of your work/i)
    expect(panel.textContent).toMatch(/no rota/i)
  })

  it('lists what they recorded, each linking to the record itself', async () => {
    const { container } = renderMe(manager)
    await settled(container)

    const acts = [...container.querySelectorAll('[data-act]')]
    if (acts.length === 0) {
      // A real state, and it says what it means: this build holds only what was
      // written here, and it has no rota to say whether anybody was on.
      expect(container.querySelector('[data-nothing-today]')).toBeTruthy()
      return
    }
    for (const act of acts) {
      const link = within(act as HTMLElement).getByRole('link')
      expect(link.getAttribute('href')).toMatch(/^\/residents\//)
    }
  })

  it('shows this person, never whoever was last looked at', async () => {
    const { container } = renderMe(carer)
    await settled(container)

    /*
     * Subject identity comes from the session, not from navigation history.
     * The screen is named for one person and everything on it is theirs.
     */
    const page = container.querySelector('[data-my-dashboard]')!
    expect(page.getAttribute('data-my-dashboard')).toBe(carer.id)

    /*
     * Whose screen this is, read off the line that says so rather than off the
     * page text: Adaeze Okonkwo appears further down as the person who granted
     * this carer access, which is a standing carrying its author and not the
     * subject of the screen.
     */
    const whose = page.querySelector('[data-my-dashboard] > div, header') ?? page
    expect(whose.textContent).toContain(carer.ref.fullName)
    expect(page.querySelector('[data-standing]')!.textContent).toContain(
      staffOkonkwo.fullName,
    )
  })
})

describe('the only tile counting an absence takes the hatch', () => {
  it('hatches what nobody has written up, and carries its denominator', async () => {
    const { container } = renderMe(carer)
    await settled(container)

    const gap = container.querySelector('[data-tile="not-written-up"]')!
    expect(gap.getAttribute('data-state')).toBe('unrecorded')
    expect(gap.className).toMatch(/unrecorded/)

    // Rule 4: no bare count. The figure names what it is out of.
    expect(gap.textContent).toMatch(/of \d+ residents/)
  })

  it('does not claim the residents are anybody’s in particular', async () => {
    const { container } = renderMe(carer)
    await settled(container)

    /*
     * There is no rota in this build, so a tile saying "your residents" would
     * be inventing an allocation nobody made — and putting somebody's name
     * against a gap they were never given.
     */
    const gap = container.querySelector('[data-tile="not-written-up"]')!
    expect(gap.textContent).toMatch(/not allocated to anybody/i)
    expect(gap.textContent).not.toMatch(/your residents|on your list/i)

    const round = container.querySelector('[data-tile="next-round"]')!
    expect(round.querySelector('[data-no-allocation]')).toBeTruthy()
  })
})

describe('what I can do is one row of the manager’s matrix', () => {
  it('reads every level through the same function the matrix does', async () => {
    const { container } = renderMe(carer, '/me/permissions')
    await settled(container, '[data-my-permissions]')

    /*
     * Not a second table describing the same access. A hand-written copy is a
     * second rule, and the one nobody updates is whichever a reader happens to
     * be looking at.
     */
    for (const module of PERMISSION_MODULES) {
      const row = container.querySelector(`[data-module="${module.id}"]`)
      expect(row, module.id).toBeTruthy()
      expect(row!.querySelector('[data-level]')!.getAttribute('data-level')).toBe(
        levelFor(carer.role, module.id),
      )
    }
  })

  it('lists every module, including the ones this role cannot open', async () => {
    const { container } = renderMe(carer, '/me/permissions')
    await settled(container, '[data-my-permissions]')

    // Absence from a list is the same bug as a blank cell: a module missing
    // from this list reads as one that does not exist.
    expect(container.querySelectorAll('[data-module]')).toHaveLength(
      PERMISSION_MODULES.length,
    )
    const denied = PERMISSION_MODULES.filter(
      (module) => levelFor(carer.role, module.id) === 'no_access',
    )
    expect(denied.length).toBeGreaterThan(0)
    for (const module of denied) {
      expect(
        container.querySelector(`[data-module="${module.id}"] [data-level]`)!
          .textContent,
      ).toBe('No access')
    }
  })

  it('says nothing is enforced before the first row', async () => {
    const { container } = renderMe(carer, '/me/permissions')
    await settled(container, '[data-my-permissions]')

    const order = [...container.querySelectorAll('[data-not-enforced], [data-module]')]
    expect(order[0]?.hasAttribute('data-not-enforced')).toBe(true)
    expect(order.length).toBeGreaterThan(PERMISSION_MODULES.length)
  })

  it('says plainly that staff records are not held here, in both places', async () => {
    /*
     * Twice on purpose. Somebody looking for their own training record should
     * be told rather than left to conclude it is empty — which is the same
     * failure as a blank cell, one level up.
     */
    const dashboard = renderMe(carer)
    await settled(dashboard.container)
    expect(
      dashboard.container.querySelector('[data-not-held="no-counts"]'),
    ).toBeTruthy()

    const permissions = renderMe(carer, '/me/permissions')
    await settled(permissions.container, '[data-my-permissions]')
    const block = permissions.container.querySelector(
      '[data-not-held="staff-records"]',
    )!
    expect(block.textContent).toMatch(/training, supervision, appraisal and induction/i)
    expect(block.textContent).toMatch(/not held in diGi-Care/i)
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderMe(carer)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})

describe('the provider agrees with the pinned session', () => {
  it('starts signed out, so nothing renders under a default identity', () => {
    let seen: Session | undefined
    render(
      <SessionProvider>
        <SessionContext.Consumer>
          {(value) => {
            seen = value
            return null
          }}
        </SessionContext.Consumer>
      </SessionProvider>,
    )
    /*
     * Signed out, and the gate is what keeps that from mattering: no product
     * screen renders while it holds, so the manager fallback on `currentUser`
     * is never what a reader is looking at.
     */
    expect(seen?.signIn.kind).toBe('signed_out')
    expect(seen?.currentUser.id).toBe(staffOkonkwo.id)
  })
})
