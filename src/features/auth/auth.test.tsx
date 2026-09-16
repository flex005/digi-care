import { afterEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { RequireSignIn } from '@/app/session/RequireSignIn'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { CareNote } from '@/data/types'
import { careNotes } from '@/data/fixtures/care-notes'
import { appendNote } from '@/data/access/note-store'
import { memberById, teamMembers } from '@/data/access/team-store'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { addressFor } from './addresses'
import { endSession } from '@/data/access/session-losses'
import { invitationHasExpired, invitations } from '@/data/fixtures/invitations'
import { now as appNow } from '@/data/fixtures/clock'
import { configuredSites } from '@/data/access/settings-store'
import { zonedDate } from '@/lib/format'
import type { IsoDateTime } from '@/data/types'
import { PERMISSION_MODULES, levelFor } from '@/features/team/permissions'
import { SignInRoute } from './SignInRoute'
import { SignOutRoute } from './SignOutRoute'
import { InvitationRoute, PASSWORD_RULES } from './InvitationRoute'
import { InvitationIndexRoute } from './InvitationIndexRoute'
import { InvitationAccessRoute } from './InvitationAccessRoute'
import { VerifyRoute } from './VerifyRoute'

/**
 * Sign in, invitation, sign out. PRD §6.7.
 *
 * The load-bearing property across all three: **the screens say plainly that
 * nothing is checked.** A sign-in form that silently accepts anything is worse
 * than no sign-in form, because the form is itself the claim that a check is
 * happening.
 */

afterEach(() => {
  endSession()
})

/**
 * A password meeting every rule, built to be read against the list.
 *
 * Twelve characters, a capital, a number and a symbol, and nothing resembling
 * anybody's name. It was `'quarter-tin-elm'`, which met the only three rules
 * that existed when it was written and silently stopped meeting the set when
 * AM v2.0's complexity rules landed.
 */
const GOOD_PASSWORD = 'Quarter-Tin-Elm-9'

function makeRouter(path: string) {
  return createMemoryRouter(
    [
      { path: '/sign-in', element: <SignInRoute /> },
      { path: '/sign-out', element: <SignOutRoute /> },
      { path: '/invitation', element: <InvitationIndexRoute /> },
      { path: '/invitation/:staffId', element: <InvitationRoute /> },
      { path: '/invitation/:staffId/access', element: <InvitationAccessRoute /> },
      // Phase 19: verification sits between the credentials and the session on
      // both paths in, so a router without it 404s where the product navigates.
      { path: '/verify/:staffId', element: <VerifyRoute /> },
      {
        path: '/',
        element: (
          <RequireSignIn>
            <p>the product</p>
          </RequireSignIn>
        ),
      },
      {
        /*
         * A real protected route rather than an arbitrary one. This was `/me`,
         * which stopped existing when the shift dashboard was deleted, and a
         * gate test naming a screen that is not there proves the redirect for
         * a path nobody can reach either way.
         */
        path: '/me/permissions',
        element: (
          <RequireSignIn>
            <p>a screen behind the gate</p>
          </RequireSignIn>
        ),
      },
    ],
    { initialEntries: [path] },
  )
}

function renderAt(path: string) {
  const router = makeRouter(path)
  const view = render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
  return { ...view, router }
}

/**
 * Signs in through the screen, then goes where the test is about.
 *
 * Through the form rather than by pinning a session: the sign-out screen only
 * exists for somebody who is signed in, and a test that fabricated a session
 * would not notice the day signing in stopped producing one.
 */
/**
 * Signed in the way a person is, which from Phase 19 is two screens.
 *
 * **It clicks through verification rather than skipping it**, because the
 * session is created there and not on the sign-in form: AM v2.0's OTP sits
 * between the credentials and the product, and putting it after the session
 * would put the step behind the gate it exists to be in front of. A helper
 * that reached past it would be signing in by a route no person has.
 */
async function signedInAt(path: string) {
  const user = userEvent.setup()
  const view = renderAt('/sign-in')
  await waitFor(() =>
    expect(view.container.querySelector('[data-sign-in]')).toBeTruthy(),
  )
  await user.click(view.container.querySelector('[data-sign-in-submit]')!)

  await waitFor(() =>
    expect(view.container.querySelector('[data-verify]')).toBeTruthy(),
  )
  await user.type(view.container.querySelector('[data-field="code"]')!, '123456')
  await user.click(view.container.querySelector('[data-verify-submit]')!)

  await act(async () => {
    await view.router.navigate(path)
  })
  return view
}

/**
 * The site's day, which is what an expiry is compared against.
 *
 * Pinned to the app's generation clock rather than the wall clock, for the
 * reason every date-dependent guard here is: the two part company the moment
 * the clock is not real time, and a suite that is green for you and red at
 * 00:02 reads as flakiness and gets retried rather than read.
 */
const TODAY = zonedDate(
  appNow().toISOString() as IsoDateTime,
  configuredSites()[0]!.timeZone,
)

/**
 * Chosen by what it is, never by its position.
 *
 * `invitations()[0]` was the lapsed one until a live invitation was added to
 * the fixtures and sorted ahead of it, at which point the guard for the
 * expired screen was quietly pointing at a form.
 */
const liveInvitation = () =>
  invitations().find((entry) => !invitationHasExpired(entry, TODAY))!
const lapsedInvitation = () =>
  invitations().find((entry) => invitationHasExpired(entry, TODAY))!

const settled = (container: HTMLElement, selector: string) =>
  // selector-ok: the marker is the caller’s own attribute selector, chosen per test
  waitFor(() => expect(container.querySelector(selector)).toBeTruthy())

describe('what this build does not do is said on the control that cannot do it', () => {
  /*
   * **It was a banner across the top of all three screens and is now one
   * sentence on two controls**: the recovery link, which sends nothing, and
   * the end of setting up, which creates no account.
   *
   * Which means the screens themselves no longer carry it, and this suite says
   * so rather than quietly dropping the assertion.
   */
  it('is on no authentication screen as a banner any more', async () => {
    for (const [path, marker] of [
      ['/sign-in', '[data-sign-in]'],
      [`/invitation/${lapsedInvitation().staffId}`, '[data-invitation]'],
      [`/invitation/${lapsedInvitation().staffId}/access`, '[data-invitation-access]'],
      ['/invitation', '[data-invitation-index]'],
    ] as const) {
      const { container } = renderAt(path)
      await settled(container, marker)
      expect(container.querySelector('[data-prototype-notice]'), path).toBeNull()
    }
  })

  it('is behind the last step of setting up, which creates no account', async () => {
    /*
     * **The statement moved with the act.** It was on the invitation's Accept
     * button, which was the end of the flow until AM v2.0's verification
     * landed in front of the product. A statement placed at the moment of the
     * act has to move when the act does, or it warns about a step that is no
     * longer the end of anything — so this walks to the end rather than
     * asserting where the end used to be.
     */
    const user = userEvent.setup()
    const invited = liveInvitation()
    const { container } = renderAt(`/invitation/${invited.staffId}`)
    await settled(container, '[data-invitation]')

    await user.type(container.querySelector('[data-field="password"]')!, GOOD_PASSWORD)
    await user.type(container.querySelector('[data-field="confirm"]')!, GOOD_PASSWORD)
    await user.type(container.querySelector('[data-field="pin"]')!, '4071')
    await user.type(container.querySelector('[data-field="pin-confirm"]')!, '4071')
    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-accept-invitation]')!
          .disabled,
      ).toBe(false),
    )
    await user.click(container.querySelector('[data-accept-invitation]')!)

    await waitFor(() => expect(container.querySelector('[data-verify]')).toBeTruthy())
    await user.type(container.querySelector('[data-field="code"]')!, '123456')
    await user.click(container.querySelector('[data-verify-submit]')!)

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/no account to sign in to/i)
  })
})

describe('signing in chooses the home, because the home decides the clock', () => {
  it('asks which home before anything is signed into', async () => {
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    /*
     * The site decides the timezone every record written today carries.
     * Choosing it afterwards means the first screen somebody read was
     * rendered in the wrong zone.
     */
    const options = container.querySelectorAll('[data-site-option]')
    expect(options.length).toBeGreaterThan(1)
    for (const option of options) {
      expect(option.textContent).toMatch(/Europe\/|UTC|America\//)
    }
  })

  it('offers nothing to remember, because there is no session to remember', async () => {
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    expect(container.textContent).not.toMatch(/remember me/i)
  })

  it('says what the recovery link cannot do, on the link itself', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    /*
     * A control that appears to send a reset and sends nothing is the failure
     * this build refuses everywhere else, so the link opens one sentence
     * saying there is nothing to reset.
     */
    await user.click(container.querySelector('[data-forgotten-password]')!)

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/nothing to reset/i)
  })

  it('leaves the form to be a form', async () => {
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    /*
     * Nothing between the title and the first field except the one line saying
     * what to type. The screen had five paragraphs of explanation on it and
     * they were read as a wall rather than as five statements.
     */
    const form = container.querySelector('[data-sign-in] form, [class*="form"]')!
    expect(form.querySelectorAll('p').length).toBeLessThan(3)
    expect(container.querySelector('[data-prototype-notice]')).toBeNull()
  })

  it('signs in only somebody whose access is on the team record', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    const field = container.querySelector<HTMLInputElement>('[data-field="email"]')!
    const submit = container.querySelector<HTMLButtonElement>('[data-sign-in-submit]')!

    /*
     * Somebody suspended, or on the team with access never set up, is not a
     * person who can sign in — and offering them would be the screen making an
     * access decision the team record already made.
     */
    const denied = teamMembers().filter(
      (member) => member.standing.kind !== 'has_access',
    )
    expect(denied.length).toBeGreaterThan(0)

    /*
     * Somebody suspended, or on the team with access never set up, has an
     * address that reads exactly like everybody else's. The screen does not
     * take that decision again — it reads the one the team record already
     * holds, and the button stays down.
     */
    for (const member of denied) {
      const site = configuredSites().find((entry) => member.siteIds.includes(entry.id))!
      await user.clear(field)
      await user.type(field, addressFor(member, site))
      await waitFor(() =>
        expect(
          container.querySelector('[data-no-such-account]'),
          member.ref.fullName,
        ).toBeTruthy(),
      )
      expect(submit.disabled, member.ref.fullName).toBe(true)
    }

    // And somebody who does have access gets in.
    const allowed = teamMembers().find((entry) => entry.standing.kind === 'has_access')!
    const site = configuredSites().find((entry) => allowed.siteIds.includes(entry.id))!
    await user.clear(field)
    await user.type(field, addressFor(allowed, site))
    await waitFor(() => expect(submit.disabled).toBe(false))
    expect(container.querySelector('[data-no-such-account]')).toBeNull()
  })

  it('refuses an address that belongs to nobody', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    /*
     * Any password signs you in and none is checked, and the person is still
     * real: a session belonging to nobody in particular would put a name on
     * every record written afterwards that nobody could be asked about.
     */
    const field = container.querySelector<HTMLInputElement>('[data-field="email"]')!
    await user.clear(field)
    await user.type(field, 'someone@nowhere.example')
    await waitFor(() =>
      expect(container.querySelector('[data-no-such-account]')).toBeTruthy(),
    )
    expect(
      container.querySelector<HTMLButtonElement>('[data-sign-in-submit]')!.disabled,
    ).toBe(true)
  })

  it('accepts any password, and checks none', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    // Nothing typed here changes anything, which is the whole point of the
    // statement behind the recovery link.
    const submit = container.querySelector<HTMLButtonElement>('[data-sign-in-submit]')!
    expect(submit.disabled).toBe(false)
    await user.type(container.querySelector('[data-field="password"]')!, 'wrong')
    expect(submit.disabled).toBe(false)
  })

  it('lets the product render only once somebody has signed in', async () => {
    const { container } = renderAt('/me/permissions')
    // Redirected, and nothing of the product rendered on the way.
    await waitFor(() => expect(container.querySelector('[data-sign-in]')).toBeTruthy())
    /*
     * A string nothing else on the sign-in screen can contain. "my account"
     * was the first try and it matched "I have been invited and need to set up
     * my account" in the real copy: a substring assertion naming a value the
     * way `querySelector('ul')` names an element.
     */
    expect(container.textContent).not.toContain('a screen behind the gate')
  })
})

describe('both invitation states are reachable from a fresh load', () => {
  it('holds one invitation somebody can accept and one that has lapsed', () => {
    /*
     * **A branch nobody can reach without first doing something else is not
     * built.** Until Funke Adeyinka was added to the fixtures the only
     * invitation had expired a month ago, so the live screen existed solely
     * for a reviewer who went to Team and added a person first — which is to
     * say for nobody.
     */
    const all = invitations()
    expect(all.length).toBeGreaterThan(1)

    const live = all.filter((entry) => !invitationHasExpired(entry, TODAY))
    const lapsed = all.filter((entry) => invitationHasExpired(entry, TODAY))
    expect(live.length, 'no invitation anybody could accept').toBeGreaterThan(0)
    expect(lapsed.length, 'no invitation that has run out').toBeGreaterThan(0)
  })

  it('renders the live one as a form and the lapsed one as a refusal', async () => {
    const live = liveInvitation()
    const lapsed = lapsedInvitation()

    const first = renderAt(`/invitation/${live.staffId}`)
    await settled(first.container, '[data-invitation]')
    expect(first.container.querySelector('[data-invitation-expired]')).toBeNull()
    expect(first.container.querySelector('[data-field="password"]')).toBeTruthy()

    const second = renderAt(`/invitation/${lapsed.staffId}`)
    await settled(second.container, '[data-invitation]')
    expect(second.container.querySelector('[data-invitation-expired]')).toBeTruthy()
    expect(second.container.querySelector('[data-field="password"]')).toBeNull()
  })
})

describe('onboarding has a way in that is not a typed URL', () => {
  it('links to it from the sign-in screen', async () => {
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')

    /*
     * In a real deployment this link does not exist: the invitation arrives as
     * a link in an email addressed to one person. Nothing here sends email, so
     * without it the whole onboarding path is reachable only by knowing a URL,
     * which is the same as not having built it.
     */
    const link = container.querySelector('[data-invited-link]')!
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/invitation')
  })

  it('lists everybody waiting, live and lapsed, each linking to their own', async () => {
    const { container } = renderAt('/invitation')
    await settled(container, '[data-invitation-index]')

    const rows = [...container.querySelectorAll('[data-invitation-link]')]
    expect(rows).toHaveLength(invitations().length)
    for (const invitation of invitations()) {
      const row = container.querySelector(
        `[data-invitation-link="${invitation.staffId}"]`,
      )
      expect(row, invitation.staffId).toBeTruthy()
      expect(row!.getAttribute('href')).toBe(`/invitation/${invitation.staffId}`)
    }
  })

  it('shows the lapsed one rather than only what can be acted on', async () => {
    const { container } = renderAt('/invitation')
    await settled(container, '[data-invitation-index]')

    /*
     * An invitation that ran out is a finding about a home — somebody was
     * added over a month ago and nobody followed it up — and a list showing
     * only the live one would report that as nothing to do.
     */
    const states = [...container.querySelectorAll('[data-invite-state]')].map((one) =>
      one.getAttribute('data-invite-state'),
    )
    expect(states).toContain('live')
    expect(states).toContain('expired')
  })

  it('names the person, the role and the home on every row', async () => {
    const { container } = renderAt('/invitation')
    await settled(container, '[data-invitation-index]')

    // A row that is only a name is a row somebody has to open to understand.
    for (const invitation of invitations()) {
      const member = teamMembers().find((one) => one.id === invitation.staffId)!
      const row = container.querySelector(
        `[data-invitation-link="${invitation.staffId}"]`,
      )!
      expect(row.textContent, member.ref.fullName).toContain(member.ref.fullName)
      expect(row.textContent).toContain(STAFF_ROLE_NAMES[member.role])
      expect(row.textContent).toContain(invitation.invitedBy.fullName)
    }
  })
})

describe('an invitation states what is being accepted, before the password', () => {
  const invitation = lapsedInvitation()
  const member = teamMembers().find((entry) => entry.id === invitation.staffId)!

  it('names the role, home and access above the password fields', async () => {
    /*
     * Against a live invitation, and it has to be built here: the only one in
     * the fixtures lapsed a month ago, so an expired screen has no password
     * field and the ordering assertion this test exists for would have been
     * skipped by its own null check — an assertion that cannot run reads as
     * coverage and is not.
     */
    const invited = liveInvitation()

    const { container } = renderAt(`/invitation/${invited.staffId}`)
    await settled(container, '[data-invitation]')
    expect(container.querySelector('[data-invitation-expired]')).toBeNull()

    const access = container.querySelector('[data-invited-access]')!
    expect(access.textContent).toBeTruthy()

    /*
     * Somebody accepting an invitation should be able to see what they are
     * accepting. A password field above the description is a form asking for a
     * decision before it says what the decision is.
     */
    const password = container.querySelector('[data-field="password"]')!
    expect(password).toBeTruthy()
    expect(
      access.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('ticks each password rule as it is met, and hides none of them', async () => {
    const invited = liveInvitation()
    const user = userEvent.setup()
    const { container } = renderAt(`/invitation/${invited.staffId}`)
    await settled(container, '[data-invitation]')

    // Every rule is on screen before anybody types. A rule somebody only
    // learns about by breaking it wasted their time on purpose.
    const rules = container.querySelectorAll('[data-rule]')
    expect(rules.length).toBe(PASSWORD_RULES.length)
    for (const rule of rules) expect(rule.getAttribute('data-met')).toBe('no')

    await user.type(container.querySelector('[data-field="password"]')!, GOOD_PASSWORD)
    await waitFor(() =>
      expect(
        container.querySelector('[data-rule="length"]')!.getAttribute('data-met'),
      ).toBe('yes'),
    )
    /*
     * Every rule but the match, which needs the second field. Asserted across
     * the whole list rather than on the one that changed, because a checklist
     * that ticks one row and quietly leaves another unchecked is the thing
     * this screen exists to prevent.
     */
    for (const rule of container.querySelectorAll('[data-rule]')) {
      const expected = rule.getAttribute('data-rule') === 'match' ? 'no' : 'yes'
      expect(rule.getAttribute('data-met'), rule.getAttribute('data-rule')!).toBe(
        expected,
      )
    }
    // And the checklist is checked rather than described: the rule that is not
    // met yet still says so.
    expect(
      container.querySelector('[data-rule="match"]')!.getAttribute('data-met'),
    ).toBe('no')
    expect(
      container.querySelector<HTMLButtonElement>('[data-accept-invitation]')!.disabled,
    ).toBe(true)

    await user.type(container.querySelector('[data-field="confirm"]')!, GOOD_PASSWORD)

    /*
     * **Still disabled, because a password is not the whole of setting an
     * account up.** AM v2.0's AUTH-03 asks for a signing code too, and it is
     * the half with clinical consequence: it goes on a medication round. A
     * form that enabled here would let somebody finish without one.
     */
    expect(
      container.querySelector<HTMLButtonElement>('[data-accept-invitation]')!.disabled,
    ).toBe(true)

    await user.type(container.querySelector('[data-field="pin"]')!, '4071')
    await user.type(container.querySelector('[data-field="pin-confirm"]')!, '4071')

    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-accept-invitation]')!
          .disabled,
      ).toBe(false),
    )
  })

  it('refuses a password containing their own name, and says which rule', async () => {
    const invited = liveInvitation()
    const user = userEvent.setup()
    const { container } = renderAt(`/invitation/${invited.staffId}`)
    await settled(container, '[data-invitation]')

    /*
     * **Their name, read from the record rather than typed.** This was the
     * literal `'AdeyinkaAdeyinka'`, which is the surname of whoever the live
     * invitation happened to belong to, and it went red the moment the
     * fixtures gained a governance invitation that sorted ahead of hers. The
     * rule under test is "a password may not contain your own name"; a
     * surname typed into the assertion tests one person's name instead, and
     * passes or fails on which fixture came first.
     */
    const surname = memberById(invited.staffId)!.ref.fullName.split(/\s+/).pop()!
    await user.type(
      container.querySelector('[data-field="password"]')!,
      `${surname}${surname}`,
    )
    await waitFor(() =>
      expect(
        container.querySelector('[data-rule="not-name"]')!.getAttribute('data-met'),
      ).toBe('no'),
    )
    // Long enough, and still refused: the rules are checked separately rather
    // than one of them standing in for the rest.
    expect(
      container.querySelector('[data-rule="length"]')!.getAttribute('data-met'),
    ).toBe('yes')
  })

  it('names when it expires, because an invitation with no expiry is an open door', async () => {
    const { container } = renderAt(`/invitation/${invitation.staffId}`)
    await settled(container, '[data-invitation]')

    const expiresOn = invitation.expiresOn.split('-').reverse().join('/')
    expect(container.textContent).toContain(expiresOn)
  })

  it('describes access from the matrix rather than in its own words', async () => {
    const { container } = renderAt(`/invitation/${invitation.staffId}/access`)
    await settled(container, '[data-invitation-access]')

    /*
     * The same component the signed-in person sees. An invitation describing
     * access in its own sentence is a second owner of that fact, and the one
     * somebody accepts on is the one nobody updates.
     */
    for (const module of PERMISSION_MODULES) {
      const row = container.querySelector(`[data-module="${module.id}"]`)
      expect(row, module.id).toBeTruthy()
      expect(row!.querySelector('[data-level]')!.getAttribute('data-level')).toBe(
        levelFor(member.role, module.id),
      )
    }
  })

  it('refuses an expired invitation on the screen, not on submit', async () => {
    const { container } = renderAt(`/invitation/${invitation.staffId}`)
    await settled(container, '[data-invitation]')

    /*
     * Laura Bennett was added over a month ago and her invitation lapsed. A
     * form that takes a password and then says no is a form that wasted
     * somebody's time to enforce itself.
     */
    expect(container.querySelector('[data-invitation-expired]')).toBeTruthy()
    expect(container.querySelector('[data-field="password"]')).toBeNull()
    expect(
      container.querySelector<HTMLButtonElement>('[data-accept-invitation]')!.disabled,
    ).toBe(true)
  })
})

describe('signing out names what it would destroy', () => {
  it('says there is nobody to sign out when nobody is signed in', async () => {
    const { container } = renderAt('/sign-out')
    await settled(container, '[data-already-signed-out]')
    /*
     * "Sign out, Adaeze?" asked of somebody who is not signed in names a
     * person the session does not have — the wrong-subject failure on the one
     * screen whose whole job is being checkable against what is there.
     */
    expect(container.querySelector('[data-loss-box]')).toBeNull()
    expect(container.textContent).not.toMatch(/Sign out, \w+\?/)
  })

  it('lists nothing, and says so, when nothing was written', async () => {
    const { container } = await signedInAt('/sign-out')
    await settled(container, '[data-sign-out]')

    /*
     * A loss box listing nothing teaches a reader to click past the one that
     * lists something.
     */
    expect(container.querySelector('[data-loss-box]')).toBeNull()
    expect(container.querySelector('[data-nothing-to-lose]')).toBeTruthy()
    expect(container.textContent).not.toMatch(/discard \d/)
  })

  it('names each kind of writing, with its count, and puts the total on the button', async () => {
    appendNote({ ...careNotes[0]!, id: 'note-signout-a' as CareNote['id'] })
    appendNote({ ...careNotes[0]!, id: 'note-signout-b' as CareNote['id'] })

    const { container } = await signedInAt('/sign-out')
    await settled(container, '[data-sign-out]')

    const rows = [...container.querySelectorAll('[data-loss]')]
    expect(rows.length).toBeGreaterThan(0)
    const notes = container.querySelector('[data-loss="care notes you wrote"]')!
    expect(notes.textContent).toContain('2')

    /*
     * The count is in the sentence on the button rather than beside it,
     * because this is the click that does it — and it is the sum of the rows
     * above, from one derivation, so the two cannot disagree.
     */
    const confirm = container.querySelector('[data-confirm-sign-out]')!
    expect(confirm.textContent).toMatch(/discard 2 records/)
  })

  it('actually destroys it, and returns to sign in', async () => {
    appendNote({ ...careNotes[0]!, id: 'note-signout-c' as CareNote['id'] })
    const user = userEvent.setup()
    const { container } = await signedInAt('/sign-out')
    await settled(container, '[data-sign-out]')
    expect(container.querySelector('[data-loss-box]')).toBeTruthy()

    await user.click(container.querySelector('[data-confirm-sign-out]')!)

    await waitFor(() => expect(container.querySelector('[data-sign-in]')).toBeTruthy())
    // Not a screen that says it destroyed something and did not.
    const { container: second } = await signedInAt('/sign-out')
    await settled(second, '[data-sign-out]')
    expect(second.querySelector('[data-loss-box]')).toBeNull()
  })
})

describe('accessibility', () => {
  it('has no violations on sign in', async () => {
    const { container } = renderAt('/sign-in')
    await settled(container, '[data-sign-in]')
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)

  it('has no violations on an invitation', async () => {
    const { container } = renderAt(`/invitation/${invitations()[0]!.staffId}`)
    await settled(container, '[data-invitation]')
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})
