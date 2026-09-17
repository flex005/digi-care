import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { resetSessionTeam, setStanding } from '@/data/access/team-store'
import { daysAgo, toIsoDate } from '@/data/fixtures/generate'
import { staffMorrison, staffOkonkwo } from '@/data/fixtures/organisation'
import { SignInAs } from '@/test/sign-in-as'
import { PendingInvitations } from './PendingInvitations'

/*
 * The banner counts the invitations nobody has accepted, and at a 72-hour
 * lifetime most of them have expired. Its title said "3 invitations nobody has
 * accepted" over three expired ones. Asserted on the fixtures (all expired) and
 * with one open invitation added (some expired), so both wordings are reached.
 */
const renderBanner = () =>
  render(
    <SessionProvider>
      <SignInAs as="registered_manager" />
      <MemoryRouter>
        <PendingInvitations />
      </MemoryRouter>
    </SessionProvider>,
  )

afterEach(() => resetSessionTeam())

describe('the pending invitations banner', () => {
  it('says all three have expired, and marks each row expired', async () => {
    const { container } = renderBanner()
    await waitFor(() =>
      expect(container.querySelector('[data-pending-invitations]')).not.toBeNull(),
    )
    expect(container.querySelector('[data-pending-expired]')?.textContent).toBe(
      '3 invitations nobody has accepted: all 3 have expired',
    )
    for (const id of ['staff-b-ogundipe', 'staff-h-price', 'staff-l-bennett']) {
      expect(
        container
          .querySelector(`[data-pending="${id}"]`)
          ?.getAttribute('data-invitation'),
      ).toBe('expired')
    }
  })

  it('says how many of them have expired when one is still open', async () => {
    // Three days old: past the banner's two, and open until the end of today.
    setStanding(staffMorrison.id, {
      kind: 'never_given_access',
      addedOn: toIsoDate(daysAgo(3)),
      addedBy: staffOkonkwo,
    })
    const { container } = renderBanner()
    await waitFor(() =>
      expect(container.querySelector('[data-pending-invitations]')).not.toBeNull(),
    )
    expect(container.querySelector('[data-pending-expired]')?.textContent).toBe(
      '4 invitations nobody has accepted: 3 of 4 have expired',
    )
    expect(
      container
        .querySelector(`[data-pending="${staffMorrison.id}"]`)
        ?.getAttribute('data-invitation'),
    ).toBe('open')
  })
})
