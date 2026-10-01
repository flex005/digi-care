import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { StaffRole } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { incidents } from '@/data/fixtures/incidents'
import { resetSessionIncidents } from '@/data/access/incident-store'
import { IncidentDetailRoute } from './IncidentDetailRoute'
import { CorrectReportForm } from './CorrectReportForm'

/**
 * Who may rewrite somebody else's account of what happened.
 *
 * **Gated in the page, not at the route.** `/incidents/:id` is a page every
 * role reads, and `correct_incident_report` carries `route: undefined` for
 * exactly that reason: refusing the whole page would take the incident away
 * from the people who need to read it. So the assertion is that the *control*
 * is absent, on a screen that otherwise renders in full.
 *
 * The negative case matters more than the positive one here. A control that
 * appears for everybody is a control that works, and nothing about the screen
 * would look wrong — the only thing that would be wrong is who can use it.
 */
afterEach(() => {
  resetSessionIncidents()
})

const subject = incidents[0]!

function renderAs(role: StaffRole) {
  const router = createMemoryRouter(
    [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
    { initialEntries: [`/incidents/${subject.id}`] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <SignInAs as={role} />
        <RouterProvider router={router} />
      </TooltipProvider>
    </SessionProvider>,
  )
}

const loaded = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())
  return container
}

describe('correcting a report is an admin act', () => {
  it('offers it to the registered manager', async () => {
    const { container } = renderAs('registered_manager')
    await loaded(container)
    expect(container.querySelector('[data-correct-report]')).toBeTruthy()
  })

  it.each(['deputy_manager', 'senior_carer', 'care_worker', 'auditor'] as const)(
    'offers it to nobody signed in as %s',
    async (role) => {
      const { container } = renderAs(role)
      await loaded(container)

      // The control is gone, and the page is not.
      expect(container.querySelector('[data-correct-report]')).toBeNull()
      expect(container.querySelector('[data-subject]')).toBeTruthy()
      expect(container.textContent).toContain(subject.description)
    },
  )

  it('shows nobody the form itself without the act', async () => {
    const { container } = renderAs('care_worker')
    await loaded(container)
    expect(container.querySelector('[data-section="correct-report"]')).toBeNull()
    expect(container.querySelector('[data-correct-save]')).toBeNull()
  })
})

describe('the record says it was changed', () => {
  it('carries no edit stamp until something is edited', async () => {
    const { container } = renderAs('registered_manager')
    await loaded(container)
    expect(container.querySelector('[data-edited]')).toBeNull()
  })
})

/**
 * The form's own gate, asked separately from the trigger's.
 *
 * **The trigger being hidden is not the form being refused.** Every test above
 * asserts the control is absent from the page, which is a fact about
 * `CorrectReportTrigger`. The form asks `mayCorrectReport` a second time, and
 * until this block nothing checked that it does — so the gate could have been
 * deleted from the form and the whole suite would have stayed green, because
 * no test ever renders the form with `open` set by anything other than the
 * trigger that is already hidden.
 *
 * Rendered directly, with `open` forced, which is the state a second route to
 * the form would produce.
 */
describe('the form refuses on its own, not only because the trigger is hidden', () => {
  function renderFormAs(role: StaffRole) {
    return render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as={role} />
          <CorrectReportForm
            incident={subject}
            subjectName="Emmanuel Okafor"
            open
            onClose={() => undefined}
            onCorrected={() => undefined}
          />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it.each<StaffRole>(['care_worker', 'senior_carer', 'deputy_manager', 'auditor'])(
    'renders nothing for %s even with open forced',
    async (role) => {
      renderFormAs(role)
      await waitFor(() => {
        expect(document.querySelector('[data-section="correct-report"]')).toBeNull()
      })
      expect(document.querySelector('[data-correct-description]')).toBeNull()
    },
  )

  it('renders the form for the role that may correct one', async () => {
    renderFormAs('registered_manager')
    await waitFor(() => {
      expect(document.querySelector('[data-section="correct-report"]')).toBeTruthy()
    })
  })
})
