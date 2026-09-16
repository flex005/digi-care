import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import type { StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { SessionProvider } from '@/app/session/SessionProvider'
import { SignInAs } from '@/test/sign-in-as'
import { teamMembers } from '@/data/access/team-store'
import { AppShell } from '@/components/shell/AppShell'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { ComplianceOverviewRoute } from '@/features/compliance/ComplianceOverviewRoute'
import { HomeSettingsRoute } from '@/features/group/HomeSettingsRoute'
import { RolePermissions } from '@/features/me/RolePermissions'
import { router } from './routes'
import { navItems } from './nav-items.icons'
import {
  ADMIN_ACTS,
  PERMISSION_MODULES,
  SIGN_IN_ROLES,
  accountabilityOf,
  canSignIn,
  levelFor,
  mayDo,
  moduleForPath,
} from '@/features/team/permissions'

/**
 * Who sees what. Phase 17.
 *
 * **The guard exists because the mechanism it checks replaced one that had
 * gone dead without anybody noticing.** `accessMode` was asserted by four test
 * files and reachable by nobody: every one of those tests passed against a
 * branch no person could get to. So the assertions here are written to fail if
 * the gate stops gating *and* if it gates everybody, because a control absent
 * for every role is a missing button rather than a permission, and no
 * single-role assertion can tell those apart.
 */

const ROLES = Object.keys(STAFF_ROLE_NAMES) as StaffRole[]

/**
 * A role somebody can actually be, on this platform.
 *
 * **Two conditions, and they are different facts.** `SIGN_IN_ROLES` says which
 * roles are viewers of this product at all: three of the six, because care
 * workers, senior carers and activities coordinators use the Care Worker app
 * and appear here only as people an Admin manages. The second condition is
 * whether the fixtures give that role somebody with access, which is the
 * standing check about a branch nothing reaches, applied to a person.
 *
 * The earlier version of this declaration named the activities coordinator as
 * a role nobody could sign in as, and treated it as a finding. It was not one:
 * she is not a user of this platform, and the fixture that looked like a gap
 * was the scope being wrong rather than the data. The finding that remains is
 * the one worth keeping: **a viewer role with nobody to be is a view of the
 * product that nothing can render.**
 */
const signable = (role: StaffRole) =>
  canSignIn(role) &&
  teamMembers().some(
    (member) => member.role === role && member.standing.kind === 'has_access',
  )

const SIGNABLE_ROLES = ROLES.filter(signable)

/** Top-level paths inside the shell, from the router rather than from a list. */
function shellPaths(): string[] {
  const shell = router.routes.find(
    (route: RouteObject) => route.path === '/' && (route.children?.length ?? 0) > 0,
  )
  return (shell?.children ?? [])
    .map((route: RouteObject) => (route.index ? '/' : `/${route.path ?? ''}`))
    .filter((path) => !path.includes(':') && path !== '/*')
}

function renderShellAs(role: StaffRole, path: string) {
  const memory = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <SignInAs as={role} />
            <AppShell />
          </>
        ),
        children: [
          { index: true, element: <p>dashboard</p> },
          { path: '*', element: <p>screen</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <RouterProvider router={memory} />
    </SessionProvider>,
  )
}

describe('the sidebar shows a role what it holds', () => {
  it('leaves out the modules a role has no access to', async () => {
    /*
     * **The auditor is the live case, and after the scope correction it is the
     * only one.** Of the three roles that sign in here, only the auditor has
     * `no_access` to anything: Settings. This was written against a care
     * worker, who cannot sign into this platform at all, so it was asserting
     * the filter through somebody who would never meet it.
     */
    const { container } = renderShellAs('auditor', '/')

    await waitFor(() =>
      expect(container.querySelector('a[href="/settings"]')).toBeNull(),
    )
    // And the items they do hold are there, so the assertion above is about
    // the filter rather than about a rail that failed to render.
    expect(container.querySelector('a[href="/care-notes"]')).toBeTruthy()
    expect(container.querySelector('a[href="/compliance"]')).toBeTruthy()
  })

  it('shows the same modules to the registered manager', async () => {
    const { container } = renderShellAs('registered_manager', '/')

    await waitFor(() =>
      expect(container.querySelector('a[href="/compliance"]')).toBeTruthy(),
    )
    expect(container.querySelector('a[href="/settings"]')).toBeTruthy()
  })

  it('agrees with the levels for every role and every module', async () => {
    for (const role of SIGNABLE_ROLES) {
      const { container, unmount } = renderShellAs(role, '/')
      await waitFor(() =>
        // The rail names itself; a bare `nav` would take whichever one is first.
        expect(
          container.querySelector('nav[aria-label="Main navigation"]'),
        ).toBeTruthy(),
      )

      for (const item of navItems.filter((entry) => entry.enabled)) {
        const link = container.querySelector(`a[href="${item.path}"]`)
        const expected = levelFor(role, item.path) !== 'no_access'
        expect(
          link !== null,
          `${STAFF_ROLE_NAMES[role]} should ${expected ? '' : 'not '}see ${item.label} in the rail`,
        ).toBe(expected)
      }
      unmount()
    }
  }, 30000)
})

describe('a module a role cannot open does not open', () => {
  it('refuses the module rather than rendering it', async () => {
    renderShellAs('auditor', '/settings')

    expect(await screen.findByText(/is not part of your access/i)).toBeVisible()
    // Named, so the reader knows which door they are at.
    expect(screen.getByText(/Settings is not one of the modules/i)).toBeVisible()
  })

  it('opens the same module for a role that holds it', async () => {
    renderShellAs('registered_manager', '/settings')

    await waitFor(() =>
      expect(screen.queryByText(/is not part of your access/i)).toBeNull(),
    )
  })

  it('refuses the act rather than the module it sits in', async () => {
    renderShellAs('deputy_manager', '/compliance/pack')

    /*
     * The distinction this screen exists to make. A deputy manager holds
     * Compliance and does not hold the pack, so telling them Compliance is not
     * theirs would be false, and it is the kind of false that sends somebody
     * to ask for the wrong thing.
     */
    expect(
      /*
       * The sentence form, not the label. A heading reading "Generate an
       * inspection pack is not part of your access" is what sent the act back
       * to its owner for a second phrasing, and asserting the label here would
       * have let the label come back.
       */
      await screen.findByText(/Generating an inspection pack is not part/i),
    ).toBeVisible()
    expect(screen.queryByText(/Compliance is not one of the modules/i)).toBeNull()
  })

  it('opens the pack for the registered person', async () => {
    renderShellAs('registered_manager', '/compliance/pack')

    await waitFor(() =>
      expect(screen.queryByText(/is not part of your access/i)).toBeNull(),
    )
  })
})

describe('the declarations hold together', () => {
  it('gives every act a module the sidebar has', () => {
    const modules = new Set(PERMISSION_MODULES.map((entry) => entry.id))
    for (const act of ADMIN_ACTS) {
      expect(
        modules.has(act.module),
        `${act.id} sits in ${act.module}, which is not a module`,
      ).toBe(true)
    }
  })

  it('gives every act with a route a route that exists', () => {
    const routed = new Set([...shellPaths(), ...routedChildren()])
    for (const act of ADMIN_ACTS) {
      if (act.route === undefined) continue
      expect(
        routed.has(act.route),
        `${act.id} names ${act.route}, which is not a route`,
      ).toBe(true)
    }
  })

  it('leaves no act held by nobody and none held by everybody', () => {
    for (const act of ADMIN_ACTS) {
      const holders = ROLES.filter((role) => mayDo(role, act.id))
      /*
       * Both directions, because each is a way for this to be decoration. An
       * act nobody holds is a control that renders for no one; an act everybody
       * holds is a gate that gates nothing, and both read as a working
       * permission model from inside a single-role test.
       */
      expect(holders.length, `${act.id} is held by nobody`).toBeGreaterThan(0)
      expect(holders.length, `${act.id} is held by every role`).toBeLessThan(
        ROLES.length,
      )
      for (const role of holders) {
        expect(
          accountabilityOf(role),
          `${role} holds ${act.id} without being a registered person`,
        ).toBe('registered_person')
      }
    }
  })

  it('leaves no screen that nobody at all can open', () => {
    /*
     * The MAR chart defect wearing a permission. A route every role is refused
     * is built, routed, tested and openable by nobody, and the existing
     * reachability guard cannot see it: that one reads the router and the
     * sidebar, and both would still agree.
     */
    const orphans = shellPaths().filter((path) => {
      const moduleId = moduleForPath(path)
      if (moduleId === undefined) return false
      return ROLES.every((role) => levelFor(role, moduleId) === 'no_access')
    })

    expect(orphans, `no role can open these: ${orphans.join(', ')}`).toEqual([])
  })

  it('gives every viewer role somebody to be', () => {
    /*
     * A viewer role with no holder is a whole view of the product that nothing
     * can render, and no screen test would ever say so. Stated against its
     * denominator rather than as a tick, because a number falling is the
     * regression somebody has to be able to see.
     */
    const unheld = SIGN_IN_ROLES.filter((role) => !signable(role))
    expect(
      unheld,
      `these roles sign into this platform and nobody holds one: ${unheld.join(', ')}`,
    ).toEqual([])
    expect(SIGNABLE_ROLES.length).toBe(SIGN_IN_ROLES.length)
  })

  it('keeps the roles that are subjects rather than viewers out of sign-in', () => {
    /*
     * **The distinction this platform kept re-deriving wrongly**, asserted in
     * both directions. A care worker is all over this product and never signs
     * into it; the matrix still carries their row, because it is an Admin's
     * view of the people they manage.
     */
    const subjects = ROLES.filter((role) => !canSignIn(role))
    expect(subjects.sort()).toEqual(
      ['activities_coordinator', 'care_worker', 'senior_carer'].sort(),
    )
    for (const role of subjects) {
      expect(
        PERMISSION_MODULES.every((module) => levelFor(role, module.id) !== undefined),
        `${role} is not a viewer and must still have a full matrix row`,
      ).toBe(true)
    }
    // And the viewers are the three the sign-in screen offers.
    expect([...SIGN_IN_ROLES].sort()).toEqual(
      ['auditor', 'deputy_manager', 'registered_manager'].sort(),
    )
  })

  it('gives every role somewhere to land after signing in', () => {
    for (const role of ROLES) {
      const open = navItems.filter(
        (item) => item.enabled && levelFor(role, item.path) !== 'no_access',
      )
      expect(
        open.length,
        `${STAFF_ROLE_NAMES[role]} signs in and can open nothing`,
      ).toBeGreaterThan(0)
    }
  })

  it('maps a path to the module it sits in, longest first', () => {
    expect(moduleForPath('/settings/homes')).toBe('/settings')
    expect(moduleForPath('/residents/res-okafor/care-plan')).toBe('/residents')
    expect(moduleForPath('/')).toBe('/')
    // Belonging to no module is the answer for the screens that are everyone's,
    // and it is what lets /me/permissions be reachable from a refusal.
    expect(moduleForPath('/me/permissions')).toBeUndefined()
    expect(moduleForPath('/dev/states')).toBeUndefined()
  })
})

/** Nested routes, so an act naming one is checked against the real thing. */
function routedChildren(): string[] {
  const shell = router.routes.find(
    (route: RouteObject) => route.path === '/' && (route.children?.length ?? 0) > 0,
  )
  const out: string[] = []
  for (const child of shell?.children ?? []) {
    for (const grand of child.children ?? []) {
      if (grand.index === true || grand.path === undefined) continue
      if (grand.path.includes(':')) continue
      out.push(`/${child.path}/${grand.path}`)
    }
  }
  return out
}

describe('the permission matrix keeps its denominator', () => {
  /**
   * **The rail shrinks and the matrix must not.** A matrix that showed only
   * what the viewer can see could not answer the one question it is for, which
   * is what somebody cannot do. This asserts the two are different lists.
   */
  it('counts every module whatever the viewer holds', () => {
    expect(PERMISSION_MODULES.length).toBe(
      navItems.filter((item) => item.label !== 'Status states').length,
    )

    const careWorkerSees = navItems.filter(
      (item) =>
        item.label !== 'Status states' &&
        levelFor('care_worker', item.path) !== 'no_access',
    )
    expect(careWorkerSees.length).toBeLessThan(PERMISSION_MODULES.length)
  })
})

/** A screen on its own, signed in as a role, without the shell around it. */
function renderScreenAs(role: StaffRole, element: React.ReactNode, path: string) {
  const memory = createMemoryRouter([{ path, element }], { initialEntries: [path] })
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={role} />
          <RouterProvider router={memory} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('the four acts are absent for a manager and present for the registered person', () => {
  it('draws no inspection pack link for a deputy manager, and one for the manager', async () => {
    const withheld = renderScreenAs(
      'deputy_manager',
      <ComplianceOverviewRoute />,
      '/compliance',
    )
    /*
     * **Waits for the screen, then asserts the absence.** Written the other way
     * round first, and it passed on a page that had not finished loading: an
     * assertion that a control is missing is satisfied by every control being
     * missing, which is the "cannot fail" class caught while writing it. The
     * notifications link is the proof the screen is there, and it is also the
     * point: Compliance is entirely this role's, so the pack being absent is a
     * statement about the act rather than about the module.
     */
    await waitFor(() =>
      expect(
        withheld.container.querySelector('[data-notifications-link]'),
      ).toBeTruthy(),
    )
    expect(withheld.container.querySelector('[data-pack-link]')).toBeNull()
    withheld.unmount()

    const held = renderScreenAs(
      'registered_manager',
      <ComplianceOverviewRoute />,
      '/compliance',
    )
    await waitFor(() =>
      expect(held.container.querySelector('[data-pack-link]')).toBeTruthy(),
    )
  }, 30000)

  it('renders settings as values for a deputy manager and as controls for the manager', async () => {
    const reading = renderScreenAs(
      'deputy_manager',
      <HomeSettingsRoute />,
      '/settings/home',
    )
    await waitFor(() =>
      expect(reading.container.querySelector('[data-settings-read-only]')).toBeTruthy(),
    )
    expect(reading.container.querySelector('[data-setting="site-name"]')).toBeNull()
    // The value is still on the page: a manager who cannot read the timezone
    // cannot tell a wrong screen from a configured one.
    expect(
      reading.container.querySelector('[data-setting-value="site-timezone"]'),
    ).toBeTruthy()
    reading.unmount()

    const writing = renderScreenAs(
      'registered_manager',
      <HomeSettingsRoute />,
      '/settings/home',
    )
    await waitFor(() =>
      expect(
        writing.container.querySelector('[data-setting="site-name"]'),
      ).toBeTruthy(),
    )
    expect(writing.container.querySelector('[data-settings-read-only]')).toBeNull()
  }, 30000)

  it('names every act on the screen somebody reads their own access from', () => {
    const { container, unmount } = render(
      <RolePermissions staffRole="deputy_manager" who="Marie Halloran" />,
    )

    for (const act of ADMIN_ACTS) {
      const row = container.querySelector(`[data-act="${act.id}"]`)
      expect(row, `${act.id} is not named on the access screen`).toBeTruthy()
      expect(row?.getAttribute('data-held')).toBe('no')
    }
    unmount()

    const held = render(
      <RolePermissions staffRole="registered_manager" who="Adaeze Okonkwo" />,
    )
    for (const act of ADMIN_ACTS) {
      expect(
        held.container
          .querySelector(`[data-act="${act.id}"]`)
          ?.getAttribute('data-held'),
      ).toBe('yes')
    }
  })
})
