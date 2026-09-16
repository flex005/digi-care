import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import {
  TooltipProvider,
  ToastProvider,
  buttonClassName,
} from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import { mayDo } from '@/features/team/permissions'
import { isActive, resetSessionSiteConfig } from '@/data/access/site-config-store'
import {
  confirmStep,
  resetSessionSetup,
  resumeAt,
  skipStep,
} from '@/data/access/setup-store'
import { resetSessionSettings } from '@/data/access/settings-store'
import { resetSessionTeam, teamMembers } from '@/data/access/team-store'
import { SettingsRoute } from '@/features/group/SettingsRoute'
import { HomeSettingsRoute } from '@/features/group/HomeSettingsRoute'
import { SettingsShellRoute } from './SettingsShellRoute'
import { SetupWizardRoute } from './SetupWizardRoute'

/**
 * The organisation setup wizard. AM v2.0 AUTH-05, Phase 23.
 *
 * **The subject is ownership.** Every value the wizard writes already has an
 * owner — the settings store, the site configuration, the team store — and a
 * wizard holding its own copy would be a second record the Settings screen
 * could disagree with. So the assertions that carry weight read the value back
 * through the owner, never through the wizard.
 */

afterEach(() => {
  resetSessionSetup()
  resetSessionSiteConfig()
  resetSessionSettings()
  resetSessionTeam()
})

/** The organisation name as every other screen reads it: from the session. */
function OrganisationName() {
  const { organisation } = useSession()
  return <p data-session-organisation>{organisation.name}</p>
}

function renderWizard() {
  const router = createMemoryRouter(
    [
      {
        path: '/settings/setup',
        element: (
          <>
            <SetupWizardRoute />
            <OrganisationName />
          </>
        ),
      },
    ],
    { initialEntries: ['/settings/setup'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-setup-wizard]')).toBeTruthy())

describe('the wizard writes through the owners, never its own copy', () => {
  it('names the organisation where every screen reads it', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await settled(container)

    /*
     * **A name the fixture does not already have, and the starting value
     * asserted first.** This test typed "Thornfield Care Group" — the
     * fixture's own name — so it passed with the session still reading the
     * fixture: a mutation that disconnected the wizard from every screen left
     * it green. An assertion is only evidence if its reference could have
     * disagreed with it, and before the act it must.
     */
    const renamed = 'Oakridge Care Partnership'
    const shown = () =>
      container.querySelector('[data-session-organisation]')!.textContent
    expect(shown()).not.toBe(renamed)

    const field = container.querySelector<HTMLInputElement>(
      '[data-field="organisation-name"]',
    )!
    await user.clear(field)
    await user.type(field, renamed)
    await user.click(container.querySelector('[data-confirm-step="organisation"]')!)

    /*
     * **Read back through the session, which is where the team list and the
     * group overview get it.** A name the wizard wrote that nothing then showed
     * would be `review-interval-months` again: a control claiming an effect
     * with none.
     */
    await waitFor(() => expect(shown()).toBe(renamed))
  }, 20000)

  it('turns a template off in the site configuration Settings reads', async () => {
    const user = userEvent.setup()
    confirmStep('organisation')
    confirmStep('site')
    const { container } = renderWizard()
    await settled(container)

    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="templates"]')).toBeTruthy(),
    )
    expect(isActive('site-rosewood-court', 'coshh')).toBe(true)

    await user.click(container.querySelector('[data-template-toggle="coshh"]')!)

    // The Phase 22 owner, read directly. One setting, two moments.
    expect(isActive('site-rosewood-court', 'coshh')).toBe(false)
  }, 20000)

  it('offers the Team Management drawer itself for the first invitation', async () => {
    const user = userEvent.setup()
    confirmStep('organisation')
    confirmStep('site')
    skipStep('templates')
    const before = teamMembers().length
    const { container } = renderWizard()
    await settled(container)

    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="invite"]')).toBeTruthy(),
    )
    await user.click(screen.getByRole('button', { name: /Invite staff member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      dialog.querySelector<HTMLInputElement>('[data-field="full-name"]')!,
      'Priya Raman',
    )
    await user.click(dialog.querySelector('[data-role-option="deputy_manager"] input')!)
    await user.click(dialog.querySelector('[data-invite-submit]')!)

    // On the team record, as the same person Team Management would show.
    await waitFor(() => expect(teamMembers().length).toBe(before + 1))
    const added = teamMembers().find((member) => member.ref.fullName === 'Priya Raman')!
    expect(added.standing.kind).toBe('never_given_access')
  }, 30000)
})

describe('two states at setup, and what retiring one later means', () => {
  it('renders carried out or not, and says the later act reaches back', async () => {
    confirmStep('organisation')
    confirmStep('site')
    const { container } = renderWizard()
    await settled(container)

    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="templates"]')).toBeTruthy(),
    )
    const states = new Set(
      [...container.querySelectorAll('[data-template-state]')].map((node) =>
        node.getAttribute('data-template-state'),
      ),
    )
    /*
     * At setup nobody has an assessment against anything, so only two states
     * exist. Nothing on this step is hatched: an unconfigured template in a
     * home with no residents is not a gap in anybody's record.
     */
    expect([...states].every((state) => state === 'on' || state === 'off')).toBe(true)
    expect(
      container.querySelector(
        '[data-setup-section="templates"] [data-state="unrecorded"]',
      ),
    ).toBeNull()
    expect(container.querySelector('[data-retire-later]')!.textContent).toMatch(
      /nobody here will be asked it/i,
    )
  }, 20000)
})

describe('"first login only" is not claimed, and progress is honest', () => {
  it('picks up at the first step nobody has confirmed', async () => {
    const { container } = renderWizard()
    await settled(container)
    expect(container.querySelector('[data-nothing-remembers]')!.textContent).toMatch(
      /picks up at the first step nobody has confirmed or skipped/i,
    )
  })

  it('refuses to skip a required step', () => {
    expect(() => skipStep('organisation')).toThrow(/is required/i)
    expect(() => skipStep('site')).toThrow(/is required/i)
  })

  it('resumes at the first step nobody confirmed or skipped', () => {
    const order = ['organisation', 'site', 'templates', 'invite'] as const
    expect(resumeAt(order)).toBe('organisation')
    confirmStep('organisation')
    expect(resumeAt(order)).toBe('site')
    confirmStep('site')
    skipStep('templates')
    expect(resumeAt(order)).toBe('invite')
  })
})

describe('who may open it, and where it is reached from', () => {
  it('belongs to the registered person and not to a manager or an auditor', () => {
    expect(mayDo('registered_manager', 'set_up_organisation')).toBe(true)
    expect(mayDo('deputy_manager', 'set_up_organisation')).toBe(false)
    expect(mayDo('auditor', 'set_up_organisation')).toBe(false)
  })

  it('is a button at the top of the organisation tab, for the person who holds it', async () => {
    const router = createMemoryRouter(
      [{ path: '/settings/organisation', element: <SettingsRoute /> }],
      { initialEntries: ['/settings/organisation'] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
    /*
     * A screen with no way in is not built, and this route is a child of the
     * settings shell that the top-level reachability guard does not descend
     * into. So the proof is here: the link exists and points at the route.
     */
    await waitFor(() =>
      expect(container.querySelector('[data-open-setup]')).toBeTruthy(),
    )
    const open = container.querySelector('[data-open-setup]')!
    expect(open.getAttribute('href')).toBe('/settings/setup')

    /*
     * **And it can be seen as a way in, which the href never said.** It was a
     * link inside a grey subtitle, styled as the line above it, and this test
     * passed while the person it was built for could not find it. jsdom
     * applies no CSS, so this holds what a test can hold: the control is the
     * button primitive, and it sits in the tab's header ahead of every
     * section. Whether it reads as a button is a screenshot's question.
     */
    expect(open.className).toBe(buttonClassName())
    expect(open.closest('header')).toBeTruthy()
    const firstSection = container.querySelector('[data-settings-section]')!
    expect(
      open.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  }, 20000)

  it('is not on a home’s own tab, because it sets up the organisation', async () => {
    const router = createMemoryRouter(
      [{ path: '/settings/home', element: <HomeSettingsRoute /> }],
      { initialEntries: ['/settings/home'] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-setting="site-name"]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-open-setup]')).toBeNull()
  }, 20000)
})

describe('the page, the tab and the tab’s heading are three different names', () => {
  it('names the module, then the tab, then what the tab holds', async () => {
    /*
     * The Settings tab read "Settings", under a tab labelled "Settings", under
     * a page titled "Settings": three elements claiming one name, so the
     * screen could not say what it was. The module is Settings, the tab names
     * a scope, and the heading inside names the organisation or the home.
     */
    for (const [path, tabLabel] of [
      ['/settings/organisation', 'Organisation'],
      ['/settings/home', 'This home'],
    ] as const) {
      const router = createMemoryRouter(
        [
          {
            path: '/settings',
            element: <SettingsShellRoute />,
            children: [
              { path: 'organisation', element: <SettingsRoute /> },
              { path: 'home', element: <HomeSettingsRoute /> },
            ],
          },
        ],
        { initialEntries: [path] },
      )
      const { container, unmount } = render(
        <SessionProvider>
          <TooltipProvider>
            <SignInAs as="registered_manager" />
            <RouterProvider router={router} />
          </TooltipProvider>
        </SessionProvider>,
      )
      await waitFor(() =>
        expect(container.querySelector('[data-tab-heading]')).toBeTruthy(),
      )
      const shell = container.querySelector('[data-settings-shell]')!
      const title = shell.querySelector('h1')!.textContent
      const tab = shell.querySelector('[aria-current="page"]')!.textContent
      const heading = shell.querySelector('[data-tab-heading]')!.textContent
      expect(title, path).toBe('Settings')
      expect(tab, path).toBe(tabLabel)
      expect(new Set([title, tab, heading]).size, path).toBe(3)
      unmount()
    }
  }, 30000)
})

describe('the wizard’s way out is true from wherever somebody came', () => {
  function renderFrom(start: string) {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p data-dashboard-standin>the dashboard</p> },
        { path: '/settings/organisation', element: <SettingsRoute /> },
        { path: '/settings/setup', element: <SetupWizardRoute /> },
      ],
      { initialEntries: [start] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <SignInAs as="registered_manager" />
            <RouterProvider router={router} />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('goes back to the organisation for somebody who came from it', async () => {
    const user = userEvent.setup()
    const { container } = renderFrom('/settings/organisation')
    await waitFor(() =>
      expect(container.querySelector('[data-open-setup]')).toBeTruthy(),
    )
    await user.click(container.querySelector('[data-open-setup]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-setup-exit]')).toBeTruthy(),
    )
    const exit = container.querySelector('[data-setup-exit]')!
    expect(exit.textContent).toBe('Back to the organisation')
    expect(exit.getAttribute('href')).toBe('/settings/organisation')
  }, 20000)

  it('offers the dashboard to somebody who did not, such as from sign-in', async () => {
    /*
     * Somebody who arrived from sign-in has not been to the Organisation tab,
     * so going there is not going back. The dashboard is true from either
     * direction, and it is what anything but the Organisation tab gets.
     */
    const { container } = renderFrom('/settings/setup')
    await waitFor(() =>
      expect(container.querySelector('[data-setup-exit]')).toBeTruthy(),
    )
    const exit = container.querySelector('[data-setup-exit]')!
    expect(exit.textContent).toBe('Go to the dashboard')
    expect(exit.getAttribute('href')).toBe('/')
  }, 20000)
})
