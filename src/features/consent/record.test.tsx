import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { SignInAs } from '@/test/sign-in-as'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { residentById } from '@/data/fixtures/residents'
import { resetSessionResidents, withResidentEdits } from '@/data/access/resident-store'
import { resetSessionFamilyAccess } from '@/data/access/family-access-store'
import { FamilyTab } from '@/features/family/FamilyTab'
import type { ResidentId } from '@/data/types'
import { CapacityGateRoute } from './CapacityGateRoute'

/**
 * Recording a consent. Phase 10, finished in Phase 25.
 *
 * **The act the module never had.** Until now the capacity gate collected an
 * assessment and its Continue button went nowhere, so a consent could be
 * withdrawn and never recorded, and Family Portal access worked only for
 * residents whose consent the fixtures already held. The assertion that matters
 * most is therefore not that the form renders but that the record changes, and
 * that the Family Portal section opens because of it.
 */

afterEach(() => {
  resetSessionResidents()
  resetSessionFamilyAccess()
})

/** A resident nobody has asked about Family Portal access. */
const UNASKED = 'res-pemberton' as ResidentId
/** A resident with a health and welfare LPA on file, and a consent still pending. */
const WITH_LPA = 'res-wilkinson' as ResidentId

function renderGate(residentId: ResidentId) {
  const router = createMemoryRouter(
    [
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ path: 'consent/:consentType', element: <CapacityGateRoute /> }],
      },
    ],
    { initialEntries: [`/residents/${residentId}/consent/family_portal`] },
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

const current = (id: ResidentId) => withResidentEdits(residentById(id)!)

describe('a consent can be recorded, and the record changes', () => {
  it('records the resident’s own decision and the assessment it rests on', async () => {
    const user = userEvent.setup()
    expect(current(UNASKED).consents.family_portal.kind).toBe('not_sought')

    const { container } = renderGate(UNASKED)
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-capacity="has_capacity"]')!)
    await user.click(container.querySelector('[data-continue]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-decision-step]')).toBeTruthy(),
    )

    // Capacity decided the authority: it is theirs, and nothing else is offered.
    expect(container.querySelector('[data-authority="the_resident"]')).toBeTruthy()
    expect(container.querySelector('[data-authority="best_interests"]')).toBeNull()

    await user.click(container.querySelector('[data-outcome="given"]')!)
    await user.click(container.querySelector('[data-method="verbal"]')!)
    await user.click(container.querySelector('[data-record-consent]')!)

    /*
     * **The assertion this phase exists for.** Read back through the resident
     * store every screen reads, not through the form's own state: a screen that
     * says "recorded" over an unchanged record is exactly the defect found
     * when this was reported as done.
     */
    await waitFor(() =>
      expect(current(UNASKED).consents.family_portal.kind).toBe('given'),
    )
    const consent = current(UNASKED).consents.family_portal
    if (consent.kind !== 'given') throw new Error('not given')
    expect(consent.by.kind).toBe('the_resident')
    expect(consent.method).toBe('verbal')
    expect(consent.by.assessment.covers).toHaveProperty('family_portal', true)
  }, 30000)

  it('opens Family Portal access for a resident whose consent was just recorded', async () => {
    const user = userEvent.setup()
    const { container } = renderGate(UNASKED)
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-capacity="has_capacity"]')!)
    await user.click(container.querySelector('[data-continue]')!)
    await user.click(container.querySelector('[data-outcome="given"]')!)
    await user.click(container.querySelector('[data-method="written"]')!)
    await user.click(container.querySelector('[data-record-consent]')!)
    await waitFor(() =>
      expect(current(UNASKED).consents.family_portal.kind).toBe('given'),
    )

    /*
     * The dependency that made this the first fix. Before, the family tab
     * refused to offer the act for this resident and nothing on any screen
     * could change that. From Phase 27 the act is a button that opens a
     * dialog, so what proves the gate opened is the control being there.
     */
    const tabRouter = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <Outlet context={{ resident: current(UNASKED), refresh: () => {} }} />
          ),
          children: [{ index: true, element: <FamilyTab /> }],
        },
      ],
      { initialEntries: ['/'] },
    )
    const family = render(
      <SessionProvider>
        <TooltipProvider>
          <ToastProvider>
            <SignInAs as="registered_manager" />
            <RouterProvider router={tabRouter} />
          </ToastProvider>
        </TooltipProvider>
      </SessionProvider>,
    )
    await waitFor(() =>
      expect(family.container.querySelector('[data-add-family]')).toBeTruthy(),
    )
    expect(family.container.querySelector('[data-consent-missing]')).toBeNull()
  }, 30000)
})

describe('a decision made for somebody names who made it and on what basis', () => {
  it('requires who was consulted and why before a best-interests decision', async () => {
    const user = userEvent.setup()
    const { container } = renderGate(UNASKED)
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-capacity="lacks_capacity"]')!)
    await user.type(
      container.querySelector('#diagnostic')!,
      'Moderate vascular dementia.',
    )
    await user.type(
      container.querySelector('#functional')!,
      'Could not weigh the options.',
    )
    await user.click(container.querySelector('[data-continue]')!)
    await waitFor(() =>
      expect(container.querySelector('[data-decision-step]')).toBeTruthy(),
    )

    await user.click(container.querySelector('[data-outcome="given"]')!)
    await user.click(container.querySelector('[data-method="verbal"]')!)
    await user.click(container.querySelector('[data-authority="best_interests"]')!)

    const record = () =>
      container.querySelector<HTMLButtonElement>('[data-record-consent]')!.disabled
    expect(record()).toBe(true)

    await user.type(
      container.querySelector('[data-field="consulted"]')!,
      'Her son Tunde',
    )
    expect(record()).toBe(true)
    await user.type(
      container.querySelector('[data-field="rationale"]')!,
      'She has always spoken to her son daily.',
    )
    await waitFor(() => expect(record()).toBe(false))

    await user.click(container.querySelector('[data-record-consent]')!)
    await waitFor(() =>
      expect(current(UNASKED).consents.family_portal.kind).toBe('given'),
    )
    const consent = current(UNASKED).consents.family_portal
    if (consent.kind !== 'given' || consent.by.kind !== 'best_interests')
      throw new Error('not a best-interests decision')
    expect(consent.by.consulted).toEqual(['Her son Tunde'])
    expect(consent.by.assessment.finding.kind).toBe('lacks_capacity')
  }, 30000)

  it('offers the attorney only where a health and welfare LPA is on file', async () => {
    const user = userEvent.setup()

    const without = renderGate(UNASKED)
    await waitFor(() =>
      expect(without.container.querySelector('[data-gate-question]')).toBeTruthy(),
    )
    await user.click(
      without.container.querySelector('[data-capacity="lacks_capacity"]')!,
    )
    await user.type(without.container.querySelector('#diagnostic')!, 'Dementia.')
    await user.type(
      without.container.querySelector('#functional')!,
      'Cannot retain it.',
    )
    await user.click(without.container.querySelector('[data-continue]')!)
    await waitFor(() =>
      expect(without.container.querySelector('[data-no-lpa-route]')).toBeTruthy(),
    )
    expect(without.container.querySelector('[data-authority="lpa_holder"]')).toBeNull()
    without.unmount()

    const withLpa = renderGate(WITH_LPA)
    await waitFor(() =>
      expect(withLpa.container.querySelector('[data-gate-question]')).toBeTruthy(),
    )
    await user.click(
      withLpa.container.querySelector('[data-capacity="lacks_capacity"]')!,
    )
    await user.type(withLpa.container.querySelector('#diagnostic')!, 'Dementia.')
    await user.type(
      withLpa.container.querySelector('#functional')!,
      'Cannot retain it.',
    )
    await user.click(withLpa.container.querySelector('[data-continue]')!)
    await waitFor(() =>
      expect(
        withLpa.container.querySelector('[data-authority="lpa_holder"]'),
      ).toBeTruthy(),
    )
  }, 40000)
})
