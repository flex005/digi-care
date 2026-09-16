import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionContext, type Session } from '@/app/session/context'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { IsoDateTime, StaffMember } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import {
  organisation,
  staffFitzgerald,
  staffHalloran,
  staffOkonkwo,
} from '@/data/fixtures/organisation'
import { configuredSites } from '@/data/access/settings-store'
import { memberById } from '@/data/access/team-store'
import { endSession } from '@/data/access/session-losses'
import { PERMISSION_MODULES, levelFor } from '@/features/team/permissions'
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

function renderMe(member: StaffMember, path = '/me/permissions') {
  const Provider = signedInAs(member)
  const router = createMemoryRouter(
    [
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

/*
 * **A deputy manager, not a care worker.** This file rendered the account page
 * as a care worker, who does not sign into this platform at all: the Care
 * Worker product is theirs. A screen tested through somebody who could never
 * open it is asserting a rendering rather than a thing anybody sees.
 */
const reader = memberById(staffHalloran.id)!

const settled = (container: HTMLElement, selector = '[data-my-permissions]') =>
  // selector-ok: the marker is the caller’s own attribute selector, chosen per test
  waitFor(() => expect(container.querySelector(selector)).toBeTruthy())

describe('what I can do is one row of the manager’s matrix', () => {
  it('reads every level through the same function the matrix does', async () => {
    const { container } = renderMe(reader, '/me/permissions')
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
        levelFor(reader.role, module.id),
      )
    }
  })

  it('lists every module, including the ones this role cannot open', async () => {
    const subject = memberById(staffFitzgerald.id)!
    const { container } = renderMe(subject, '/me/permissions')
    await settled(container, '[data-my-permissions]')

    // Absence from a list is the same bug as a blank cell: a module missing
    // from this list reads as one that does not exist.
    expect(container.querySelectorAll('[data-module]')).toHaveLength(
      PERMISSION_MODULES.length,
    )
    const denied = PERMISSION_MODULES.filter(
      (module) => levelFor(subject.role, module.id) === 'no_access',
    )
    /*
     * **The auditor, because they are the only viewer this is true of.** A
     * deputy manager has at least read everywhere, so rendering this test
     * through one would assert a list of no-access modules that is empty and
     * pass on a screen showing nothing. Of the three roles that sign into this
     * platform, only the auditor is refused a module: Settings.
     */
    expect(denied.length).toBeGreaterThan(0)
    for (const module of denied) {
      expect(
        container.querySelector(`[data-module="${module.id}"] [data-level]`)!
          .textContent,
      ).toBe('No access')
    }
  })

  it('says plainly that staff records are not held here', async () => {
    /*
     * It was in two places while `/me` existed, because somebody looking for
     * their own training record should be told rather than left to conclude it
     * is empty — the same failure as a blank cell, one level up. One place now,
     * and this is the place: the account page is where somebody comes to read
     * what is held about them.
     */
    const { container } = renderMe(reader)
    await settled(container, '[data-my-permissions]')
    const block = container.querySelector('[data-not-held="staff-records"]')!
    expect(block.textContent).toMatch(/training, supervision, appraisal and induction/i)
    expect(block.textContent).toMatch(/not held in diGi-Care/i)
  })

  it('carries the four facts that came off the deleted dashboard', async () => {
    const { container } = renderMe(reader)
    await settled(container, '[data-my-permissions]')

    /*
     * Unrolled rather than looped over a list of selectors. A query built from
     * a variable is specific to a reader and opaque to the selector guard,
     * which cannot see what the string holds, and the failure now says which
     * fact is missing rather than printing a selector.
     */
    expect(container.querySelector('[data-my-homes]'), 'homes').toBeTruthy()
    expect(container.querySelector('[data-standing]'), 'access standing').toBeTruthy()
    expect(
      container.querySelector('[data-session-started]'),
      'when this session started',
    ).toBeTruthy()
    // And the password control that says why it does nothing, rather than an
    // absent control somebody would go looking for.
    expect(
      container.querySelector<HTMLButtonElement>('[data-no-password]')!.disabled,
    ).toBe(true)
  })

  it("renders no count of the reader's own work, and says so", async () => {
    /*
     * **The refusal and the absence, not the refusal alone.** The `/me` version
     * of this asserted that the sentence was printed; adding a total beside it
     * would have left the test green. What is asserted here is the property:
     * nothing on the page is a figure about this person.
     */
    const { container } = renderMe(reader)
    await settled(container, '[data-my-permissions]')

    const page = container.querySelector('[data-my-permissions]')!
    expect(page.querySelector('[data-numeric]')).toBeNull()
    expect(page.textContent).toMatch(/no counts of your work/i)
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderMe(reader)
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
