import { afterEach, describe, expect, it } from 'vitest'
import {
  brandIdAsConfigured,
  chosenTermsAsConfigured,
  organisationTypeAsConfigured,
  resetSessionSettings,
  subjectTermIdAsConfigured,
} from '@/data/access/settings-store'
import { TERM_IDS, subjectTerm, vocabularyFor } from '@/lib/vocabulary'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { StaffRole } from '@/data/types'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import { brandOptionById, brandRampHex } from '@/lib/brand'
import { mayDo } from '@/features/team/permissions'
import { isActive, resetSessionSiteConfig } from '@/data/access/site-config-store'
import {
  confirmStep,
  resetSessionSetup,
  resumeAt,
  skipStep,
} from '@/data/access/setup-store'
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

/**
 * The router mounts once somebody is signed in, and that is about the gate.
 *
 * `SignInAs` signs in from an effect, so on the very first paint the session
 * is signed out — and the wizard now redirects a signed-out visitor to
 * sign-in, which in a memory router with no such route is an unhandled error.
 * That is the gate working, in a harness that was written when there was none.
 * The gate itself is asserted directly in "who may open it" below; here the
 * router simply waits, so these tests go on being about the wizard.
 */
function AfterSignIn({ children }: { children: ReactNode }) {
  const { signIn } = useSession()
  return signIn.kind === 'signed_out' ? null : <>{children}</>
}

function renderWizard(as: StaffRole = 'registered_manager') {
  const router = createMemoryRouter(
    [
      {
        path: '/setup',
        element: (
          <>
            <SetupWizardRoute />
            <OrganisationName />
          </>
        ),
      },
      { path: '/sign-in', element: <p data-signed-out>Sign in</p> },
      { path: '/', element: <p data-landed>The product</p> },
    ],
    { initialEntries: ['/setup'] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={as} />
          <AfterSignIn>
            <RouterProvider router={router} />
          </AfterSignIn>
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
    /*
     * `vocabulary` is a required step now, so `resumeAt` stops there until it
     * is confirmed. Added rather than the assertion relaxed: the wizard gained
     * a step, which is a change to what the walk is, not to what these tests
     * assert about templates and invitations.
     */
    confirmStep('organisation')
    confirmStep('vocabulary')
    confirmStep('brand')
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
    /*
     * `vocabulary` is a required step now, so `resumeAt` stops there until it
     * is confirmed. Added rather than the assertion relaxed: the wizard gained
     * a step, which is a change to what the walk is, not to what these tests
     * assert about templates and invitations.
     */
    confirmStep('organisation')
    confirmStep('vocabulary')
    confirmStep('brand')
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
    /*
     * `vocabulary` is a required step now, so `resumeAt` stops there until it
     * is confirmed. Added rather than the assertion relaxed: the wizard gained
     * a step, which is a change to what the walk is, not to what these tests
     * assert about templates and invitations.
     */
    confirmStep('organisation')
    confirmStep('vocabulary')
    confirmStep('brand')
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
  /**
   * **No subtitle, ever, and the strip carries the progress instead.**
   *
   * The header had a line reading "It picks up at the first step nobody has
   * confirmed or skipped" — a mechanism rather than a state, describing a
   * resume to somebody it had not happened to. It cannot be made honest here:
   * a reload clears the session, so nothing distinguishes a return from a
   * first pass. A replacement stating what the chips already say was tried and
   * removed; this holds the slot empty so it is not refilled as an oversight.
   */
  it('puts no sentence between the heading and the steps, at any point', async () => {
    const { container } = renderWizard()
    await settled(container)
    expect(container.querySelector('[data-nothing-remembers]')).toBeNull()
    const header = container.querySelector('[data-setup-wizard] header')!
    // The mark and the title. Nothing else.
    expect(header.children).toHaveLength(2)
  }, 20000)

  it('says where somebody is on the strip rather than what each step demands', async () => {
    confirmStep('organisation')
    const { container } = renderWizard()
    await settled(container)
    /*
     * Still no sentence once something is confirmed, which is the state that
     * used to make one appear — and its appearing pushed the card down, which
     * is movement with no meaning above a strip whose job is stability.
     */
    expect(container.querySelector('[data-nothing-remembers]')).toBeNull()

    const confirmed = container.querySelector('[data-setup-step="organisation"]')!
    expect(confirmed.getAttribute('data-state')).toBe('confirmed')
    expect(confirmed.textContent).toContain('Confirmed')
    const current = container.querySelector('[data-current="true"]')!
    expect(current.textContent).toContain('Doing this now')
    // The rule only where it is still a question: a confirmed step has moved on.
    expect(confirmed.textContent).not.toContain('Required')
  }, 20000)

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

  /**
   * **The gate, now that the shell cannot be it.**
   *
   * `set_up_organisation` carried `route: '/settings/setup'` and `AppShell`
   * refused any path matching an act the viewer may not perform. At `/setup`
   * no shell renders, so that refusal cannot run — and a screen that was
   * unreachable for five roles would have been reachable by every role that
   * can sign in. These hold the replacement.
   */
  it.each(['deputy_manager', 'senior_carer', 'care_worker', 'auditor'] as const)(
    'refuses %s the external route, naming the act rather than the module',
    async (role) => {
      const { container } = renderWizard(role)
      await waitFor(() =>
        expect(
          container.querySelector('[data-no-access="set_up_organisation"]'),
        ).toBeTruthy(),
      )
      // Refused, not merely empty: the wizard is not on the page at all.
      expect(container.querySelector('[data-setup-wizard]')).toBeNull()
    },
    20000,
  )

  it('sends somebody who is not signed in to sign in, rather than refusing them', async () => {
    /*
     * Not the same fact as a refusal. Nobody has said who they are yet, so
     * there is nothing to refuse — they go to sign-in the way `RequireSignIn`
     * sends anybody heading for the product.
     */
    const router = createMemoryRouter(
      [
        { path: '/setup', element: <SetupWizardRoute /> },
        { path: '/sign-in', element: <p data-signed-out>Sign in</p> },
      ],
      { initialEntries: ['/setup'] },
    )
    const { container } = render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-signed-out]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-setup-wizard]')).toBeNull()
    expect(container.querySelector('[data-no-access]')).toBeNull()
  }, 20000)

  it('is not reached from the organisation tab any more', async () => {
    /*
     * The button that used to open it is gone: setup happens outside the
     * product, from the offer after verification. What the tab has instead is
     * asserted in "the organisation tab changes what the wizard set" below.
     */
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
    await waitFor(() =>
      expect(container.querySelector('[data-settings-section]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-open-setup]')).toBeNull()
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

/**
 * **The controls the wizard asks once, changeable afterwards.**
 *
 * Before this, the term pickers and the brand picker existed only inside
 * `SetupWizardRoute`. Once setup was done there was no way to change the
 * type, a word or the colour from anywhere in the product — three
 * configurable things with no control behind them, which is the §8 shape of a
 * screen claiming a capability nothing performs, turned the other way round:
 * a capability with no screen.
 */
describe('the organisation tab changes what the wizard set', () => {
  const renderTab = (as: StaffRole = 'registered_manager') => {
    const router = createMemoryRouter(
      [{ path: '/settings/organisation', element: <SettingsRoute /> }],
      { initialEntries: ['/settings/organisation'] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as={as} />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('offers the type, every term and the colour', async () => {
    const { container } = renderTab()
    await waitFor(() =>
      expect(
        container.querySelector('[data-settings-section="vocabulary"]'),
      ).toBeTruthy(),
    )
    // The type.
    expect(container.querySelector('[data-org-type="hospital"]')).toBeTruthy()
    // Every term, counted from the declaration rather than a number typed here.
    expect(container.querySelectorAll('[data-term-choice]')).toHaveLength(
      TERM_IDS.length,
    )
    // The colour, and the ramp it would produce.
    expect(container.querySelector('[data-settings-section="brand"]')).toBeTruthy()
    expect(container.querySelector('[data-brand-choice]')).toBeTruthy()
    expect(
      container.querySelectorAll('[data-brand-preview] [data-swatch]'),
    ).toHaveLength(5)
  }, 20000)

  it('writes a changed term through the owner the screens read', async () => {
    const user = userEvent.setup()
    const { container } = renderTab()
    await waitFor(() =>
      expect(container.querySelector('[data-term-choice="carePlan"]')).toBeTruthy(),
    )
    expect(
      vocabularyFor(organisationTypeAsConfigured(), chosenTermsAsConfigured()).carePlan
        .One,
    ).toBe('Care plan')

    await user.click(
      container.querySelector('[data-term-choice="carePlan"] [role="combobox"]')!,
    )
    await user.click(await screen.findByRole('option', { name: 'Care & Support Plan' }))

    await waitFor(() =>
      expect(
        vocabularyFor(organisationTypeAsConfigured(), chosenTermsAsConfigured())
          .carePlan.One,
      ).toBe('Care & support plan'),
    )
  }, 20000)

  it('writes a changed colour through the owner, and paints it', async () => {
    const user = userEvent.setup()
    const { container } = renderTab()
    await waitFor(() =>
      expect(container.querySelector('[data-brand-choice]')).toBeTruthy(),
    )
    expect(brandIdAsConfigured()).toBeUndefined()

    await user.click(container.querySelector('[data-brand-choice] [role="combobox"]')!)
    await user.click(await screen.findByRole('option', { name: 'Teal' }))

    await waitFor(() => expect(brandIdAsConfigured()).toBe('teal'))
    /*
     * And it reaches `:root`, which is the whole mechanism — every component
     * reads `var(--brand-600)` and nothing else changes.
     */
    expect(document.documentElement.style.getPropertyValue('--brand-600')).toBe(
      brandRampHex(brandOptionById('teal').hue)['600'],
    )
  }, 20000)

  it('shows a role that cannot configure the service none of it', async () => {
    const { container } = renderTab('auditor')
    await waitFor(() =>
      expect(container.querySelector('[data-settings-read-only]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-settings-section="vocabulary"]')).toBeNull()
    expect(container.querySelector('[data-settings-section="brand"]')).toBeNull()
  }, 20000)
})

describe('the wizard finishes by arriving in the product', () => {
  it('offers the dashboard, and no longer a way back into Settings', async () => {
    /*
     * **One exit, because there is only one direction now.** This used to
     * offer "Back to the organisation" to anybody who arrived from that tab,
     * carried in the navigation state by `setup-origin.ts`. With the entry
     * point moved to the post-verification offer there is no such person, so
     * the state had nobody to send it and the helper was deleted rather than
     * left as a branch no route can reach.
     */
    const { container } = renderWizard()
    await settled(container)
    const exit = container.querySelector('[data-setup-exit]')!
    expect(exit.getAttribute('href')).toBe('/')
    expect(exit.textContent).toContain('Go to the dashboard')
  }, 20000)
})

/**
 * The step that chooses what this service calls the people it holds records
 * about.
 *
 * **Required, not optional.** The term reaches every heading in the product,
 * and a default nobody chose is still a default on all of them — asking makes
 * it a decision somebody took.
 */
describe('what kind of service it is', () => {
  it('sets the type, and the type picks the word', async () => {
    const user = userEvent.setup()
    confirmStep('organisation')
    const { container } = renderWizard()
    await settled(container)

    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="vocabulary"]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-org-type="hospital"] input')!)
    await user.click(container.querySelector('[data-confirm-step="vocabulary"]')!)

    expect(organisationTypeAsConfigured()).toBe('hospital')
    // The type picked the default rather than leaving the term unset.
    expect(
      subjectTerm(organisationTypeAsConfigured(), subjectTermIdAsConfigured()).one,
    ).toBe('patient')
  }, 20000)

  /*
   * A default is a default, not a lock: a clinic may well say "Service User",
   * which is also the term whose grammar nothing can derive.
   */
  it('lets the word be chosen separately from the type', async () => {
    const user = userEvent.setup()
    confirmStep('organisation')
    const { container } = renderWizard()
    await settled(container)
    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="vocabulary"]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-org-type="clinic"] input')!)
    await user.click(
      container.querySelector('[data-setup-section="vocabulary"] [role="combobox"]')!,
    )
    await user.click(await screen.findByRole('option', { name: 'Service User' }))
    await user.click(container.querySelector('[data-confirm-step="vocabulary"]')!)

    const term = subjectTerm(
      organisationTypeAsConfigured(),
      subjectTermIdAsConfigured(),
    )
    /*
     * **The option picked is "Service User" and the word rendered is "Service
     * user", and that gap is the design.** `label` is a name in a list, so it
     * is title case; `One` and `Many` are words in sentences, so they are
     * sentence case, matching STAFF_ROLE_NAMES and the sidebar's headings.
     * Asserting both here is what makes the separation a rule rather than two
     * fields that happen to differ.
     */
    expect(term.One).toBe('Service user')
    // Declared, not derived: "service users" is not what an s append gives
    // every term, and this is the one place both halves are read end to end.
    expect(term.Many).toBe('Service users')
  }, 20000)

  it('clears an earlier word when the type changes, so the control does something', async () => {
    const user = userEvent.setup()
    confirmStep('organisation')
    const { container } = renderWizard()
    await settled(container)
    await waitFor(() =>
      expect(container.querySelector('[data-setup-section="vocabulary"]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-org-type="clinic"] input')!)
    await user.click(
      container.querySelector('[data-setup-section="vocabulary"] [role="combobox"]')!,
    )
    await user.click(await screen.findByRole('option', { name: 'Service User' }))
    await user.click(container.querySelector('[data-org-type="hospital"] input')!)
    await user.click(container.querySelector('[data-confirm-step="vocabulary"]')!)

    expect(
      subjectTerm(organisationTypeAsConfigured(), subjectTermIdAsConfigured()).one,
    ).toBe('patient')
  }, 20000)
})
