import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { CycleRoute } from './CycleRoute'
import { RoundRoute } from './RoundRoute'

/**
 * Who may write a medication record.
 *
 * **Enforcement in this product is UI-only.** No store checks a level — the
 * only reference to permissions anywhere under `src/data/access` is a comment
 * — so a control on screen with nothing in front of it *is* an unguarded
 * write. The shell refuses a module only at `no_access`, and the auditor's
 * baseline is `read`, so an auditor reaches every screen here.
 *
 * That makes the sentence in `permissions.ts` — "Reads everything and writes
 * nothing, which is the point of the role" — a guarantee with nothing behind
 * it until each control asks. §8's entry about a refusal stated in the UI and
 * enforced by nobody.
 *
 * **Both polarities per role**, because a gate that refuses everybody looks
 * exactly like one that works until somebody who should act tries to.
 */

const MAY_WRITE: StaffRole[] = [
  'registered_manager',
  'deputy_manager',
  'senior_carer',
  'care_worker',
]
const MAY_NOT_WRITE: StaffRole[] = ['auditor']

function renderAs(role: StaffRole, element: React.ReactElement) {
  const router = createMemoryRouter([{ path: '/', element }], { initialEntries: ['/'] })
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignInAs as={role} />
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

describe('signing for a round', () => {
  it.each(MAY_NOT_WRITE)('refuses %s, and says why', async (role) => {
    const { container } = renderAs(role, <RoundRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeTruthy()
    })
    expect(container.querySelector('[data-read-only-here]')!.textContent).toContain(
      'sign for a dose',
    )
    // Not merely a disabled button: the round itself is not on screen. Paired
    // with the positive case below, which asserts this same bar IS there for a
    // role that may sign — "absent" on a selector that is never present would
    // assert nothing.
    expect(container.querySelector('[data-round-bar]')).toBeNull()
  })

  it.each(MAY_WRITE)('lets %s reach the round', async (role) => {
    const { container } = renderAs(role, <RoundRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-read-only-here]')).toBeNull()
    })
    await waitFor(() => {
      expect(container.querySelector('[data-round-bar]')).toBeTruthy()
    })
  })
})

describe('the pharmacy cycle', () => {
  it.each(MAY_NOT_WRITE)('offers %s no row action, and says why', async (role) => {
    const { container } = renderAs(role, <CycleRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-cycle-state]')).toBeTruthy()
    })

    expect(container.querySelector('[data-accept]')).toBeNull()
    expect(container.querySelector('[data-query]')).toBeNull()
    expect(container.querySelector('[data-stop]')).toBeNull()
    expect(container.querySelector('[data-close-cycle]')).toBeNull()

    const refusal = container.querySelector('[data-read-only-here]')
    expect(refusal).toBeTruthy()
    expect(refusal!.textContent).toContain('accept a row')

    // The cycle itself is a record, and stays readable.
    expect(container.querySelector('[data-cycle-state]')!.textContent).toContain(
      'handled so far',
    )
  })

  it.each(MAY_WRITE)('offers %s the row actions', async (role) => {
    const { container } = renderAs(role, <CycleRoute />)
    await waitFor(() => {
      expect(container.querySelector('[data-cycle-state]')).toBeTruthy()
    })
    expect(container.querySelector('[data-accept]')).toBeTruthy()
    expect(container.querySelector('[data-close-cycle]')).toBeTruthy()
    expect(container.querySelector('[data-read-only-here]')).toBeNull()
  })
})
