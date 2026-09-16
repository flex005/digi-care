import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
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

  it('is linked from the Settings screen for the person who holds it', async () => {
    const router = createMemoryRouter(
      [{ path: '/settings/figures', element: <SettingsRoute /> }],
      { initialEntries: ['/settings/figures'] },
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
    expect(container.querySelector('[data-open-setup]')!.getAttribute('href')).toBe(
      '/settings/setup',
    )
  }, 20000)
})
