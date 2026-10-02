import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, TooltipProvider } from '@/components/primitives'
import type { ResidentId, StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { CapacityGateRoute } from './CapacityGateRoute'
import { WithdrawalRoute } from './WithdrawalRoute'

/**
 * Who may record a consent, and who may take one away.
 *
 * **The act this sweep was started for.** An auditor — the role whose own
 * comment in `permissions.ts` reads "Reads everything and writes nothing,
 * which is the point of the role" — could withdraw a resident's consent.
 *
 * The two controls ask different levels, because `/consent` declares two acts:
 * `records: 'seeking and withdrawing consent'` and
 * `approves: 'recording a capacity decision'`.
 */

const MAY_RECORD: StaffRole[] = ['senior_carer', 'care_worker']
const MAY_APPROVE: StaffRole[] = ['registered_manager', 'deputy_manager']
const MAY_NOT_WRITE: StaffRole[] = ['auditor']

/*
 * Both at Rosewood Court, which is the home every signed-in role here is
 * appointed to — a resident at the other home makes `ResidentProfileRoute`
 * refuse first, and the test would then be measuring the wrong refusal.
 */
const HOME = 'site-rosewood-court'
/* The gate asks its question only where nobody has answered it yet. */
const notSought = residents.find(
  (one) => one.siteId === HOME && one.consents.family_portal.kind === 'not_sought',
)!
/* Withdrawal needs something to withdraw. */
const withConsent = residents.find(
  (one) => one.siteId === HOME && one.consents.family_portal.kind === 'given',
)!

function renderAt(
  role: StaffRole,
  path: string,
  entry: string,
  element: React.ReactElement,
) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path, element }],
      },
    ],
    { initialEntries: [entry] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={role} />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const gate = (role: StaffRole, id: ResidentId) =>
  renderAt(
    role,
    'consent/:consentType',
    `/residents/${id}/consent/family_portal`,
    <CapacityGateRoute />,
  )

const withdrawal = (role: StaffRole, id: ResidentId) =>
  renderAt(
    role,
    'consent/:consentType/withdraw',
    `/residents/${id}/consent/family_portal/withdraw`,
    <WithdrawalRoute />,
  )

describe('recording a capacity decision', () => {
  it.each(MAY_NOT_WRITE)('refuses %s, and says why', async (role) => {
    const { container } = gate(role, notSought.id)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
      'record a capacity decision',
    )
    expect(container.querySelector('[data-gate-question]')).toBeNull()
  })

  /*
   * Record-only roles are refused here as well, and that is a finding rather
   * than the design: this screen is a capacity determination, which the table
   * calls an approve act, and it is also the only route to `recordConsent`,
   * which the table calls a record act. The declaration and the screens
   * disagree; the stricter reading is taken because the alternative is a
   * care worker completing an MCA two-stage test.
   */
  it.each(MAY_RECORD)(
    'also refuses %s, which the module table does not expect',
    async (role) => {
      const { container } = gate(role, notSought.id)
      await waitFor(() => {
        expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
      })
    },
  )

  /*
   * Waits for the gate rather than for the refusal to be absent. The refusal
   * is absent before anything has rendered at all, so asserting that first
   * passes on an empty screen — the resident profile loads asynchronously and
   * the gate is its child route.
   */
  it.each(MAY_APPROVE)('lets %s reach the gate', async (role) => {
    const { container } = gate(role, notSought.id)
    await waitFor(
      () => {
        expect(container.querySelector('[data-gate-question]')).toBeTruthy()
      },
      { timeout: 5000 },
    )
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})

describe('withdrawing a consent', () => {
  it.each(MAY_NOT_WRITE)('refuses %s, and says why', async (role) => {
    const { container } = withdrawal(role, withConsent.id)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
      'withdraw it',
    )
    expect(container.querySelector('[data-withdraw]')).toBeNull()
  })

  it.each([...MAY_RECORD, ...MAY_APPROVE])('offers %s the control', async (role) => {
    const { container } = withdrawal(role, withConsent.id)
    await waitFor(() => {
      expect(container.querySelector('[data-withdraw]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})
