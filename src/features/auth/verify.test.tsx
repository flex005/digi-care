import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import {
  codeWasChosen,
  resetSessionTeam,
  signingCodeFor,
  teamMembers,
} from '@/data/access/team-store'
import { staffHalloran } from '@/data/fixtures/organisation'
import { InvitationRoute } from './InvitationRoute'
import { VerifyRoute } from './VerifyRoute'
import { SignInRoute } from './SignInRoute'
import { invitations, invitationHasExpired } from '@/data/fixtures/invitations'
import { now as appNow } from '@/data/fixtures/clock'
import { zonedDate } from '@/lib/format'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { configuredSites } from '@/data/access/settings-store'

/**
 * Verification, and the signing code chosen at setup. Phase 19.
 *
 * **Pinned instant.** Whether an invitation has lapsed is derived from `now`,
 * and the live one is two days old — so a suite run against the wall clock is
 * green all day and red once the fixture instant and the test's instant fall
 * on different sides of a date boundary. The clock is the fixtures' own, which
 * is the instant the invitation was generated against.
 */
const TODAY: IsoDate = zonedDate(
  appNow().toISOString() as IsoDateTime,
  configuredSites()[0]!.timeZone,
)

afterEach(() => {
  resetSessionTeam()
  vi.restoreAllMocks()
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/sign-in', element: <SignInRoute /> },
      { path: '/invitation/:staffId', element: <InvitationRoute /> },
      { path: '/verify/:staffId', element: <VerifyRoute /> },
      { path: '/', element: <p>the product</p> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const live = () => invitations().find((entry) => !invitationHasExpired(entry, TODAY))!

describe('the verification step says what it is not doing', () => {
  it('says nothing was sent, on the screen rather than behind a link', async () => {
    const { container } = renderAt(
      `/verify/${staffHalloran.id}?site=site-rosewood-court`,
    )
    await waitFor(() => expect(container.querySelector('[data-verify]')).toBeTruthy())

    /*
     * **Not one click away, which is where every other authentication
     * statement in this build sits.** This screen asks for a code that was
     * never sent anywhere: a reader who is not told will wait for an email
     * that is not coming, which is a different failure from a form that
     * silently accepts anything.
     */
    const notice = container.querySelector('[data-nothing-sent]')!
    expect(notice.textContent).toMatch(/no email was sent/i)
    expect(notice.textContent).toMatch(/any six digits/i)
  })

  it('refuses fewer than six digits, and accepts any six', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(
      `/verify/${staffHalloran.id}?site=site-rosewood-court`,
    )
    await waitFor(() => expect(container.querySelector('[data-verify]')).toBeTruthy())

    const submit = container.querySelector<HTMLButtonElement>('[data-verify-submit]')!
    expect(submit.disabled).toBe(true)

    await user.type(container.querySelector('[data-field="code"]')!, '12345')
    expect(submit.disabled).toBe(true)

    await user.type(container.querySelector('[data-field="code"]')!, '6')
    await waitFor(() => expect(submit.disabled).toBe(false))
  }, 20000)

  it('signs in only after the code, never before it', async () => {
    const user = userEvent.setup()
    const { container } = renderAt(
      `/verify/${staffHalloran.id}?site=site-rosewood-court`,
    )
    await waitFor(() => expect(container.querySelector('[data-verify]')).toBeTruthy())

    // The product is not rendered while the step is on screen: a session made
    // before verification puts the step behind the gate it stands in front of.
    expect(container.textContent).not.toContain('the product')

    await user.type(container.querySelector('[data-field="code"]')!, '123456')
    await user.click(container.querySelector('[data-verify-submit]')!)

    await waitFor(() => expect(container.textContent).toContain('the product'))
  }, 20000)
})

describe('the signing code chosen at setup is the one the product asks for', () => {
  it('replaces the derived code rather than sitting beside it', async () => {
    const user = userEvent.setup()
    const invited = live()
    const member = teamMembers().find((entry) => entry.id === invited.staffId)!

    const derived = signingCodeFor(member.id)
    expect(codeWasChosen(member.id)).toBe(false)

    const { container } = renderAt(`/invitation/${member.id}`)
    await waitFor(() =>
      expect(container.querySelector('[data-invitation]')).toBeTruthy(),
    )

    await user.type(
      container.querySelector('[data-field="password"]')!,
      'Quarter-Tin-Elm-9',
    )
    await user.type(
      container.querySelector('[data-field="confirm"]')!,
      'Quarter-Tin-Elm-9',
    )
    await user.type(container.querySelector('[data-field="pin"]')!, '4071')
    await user.type(container.querySelector('[data-field="pin-confirm"]')!, '4071')
    await user.click(container.querySelector('[data-accept-invitation]')!)

    /*
     * **The whole point of the decision.** A PIN chosen at setup and then
     * ignored is a dead control in front of a clinical signature, on the
     * screen where somebody is most entitled to believe what they typed
     * matters. So the round, the handover and the CD register ask for this.
     */
    await waitFor(() => expect(signingCodeFor(member.id)).toBe('4071'))
    expect(codeWasChosen(member.id)).toBe(true)
    expect(signingCodeFor(member.id)).not.toBe(derived)
  }, 30000)

  it('says on the form that a chosen code can collide, which the derived one cannot', async () => {
    const { container } = renderAt(`/invitation/${live().staffId}`)
    await waitFor(() =>
      expect(container.querySelector('[data-invitation]')).toBeTruthy(),
    )

    const said = container.querySelector('[data-pin-collision]')!
    expect(said.textContent).toMatch(/nothing stops two people choosing the same/i)
    // And what is actually lost: a property held by construction becoming one
    // held by whoever runs the deployment.
    expect(said.textContent).toMatch(/derived from your account/i)
  })
})
