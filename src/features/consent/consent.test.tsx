import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import type { AnyConsent, ConsentTypeId } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { ConsentTab } from './ConsentTab'
import { CapacityGateRoute } from './CapacityGateRoute'
import { WithdrawalRoute } from './WithdrawalRoute'
import { ConsentDashboardRoute } from './ConsentDashboardRoute'
import { CONSENT_MEANS } from './consent-meaning'

/**
 * Consent. PRD §6.7, Phase 10.
 *
 * **The module's hazard is that a signature looks like consent.** Everything
 * here is about the difference: a plain-English line saying what was actually
 * permitted, a gate asking whether the person could decide at all, and a
 * second column saying who decided when they could not.
 */

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'consent', element: <ConsentDashboardRoute /> },
      {
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [
          { path: 'consent', element: <ConsentTab /> },
          { path: 'consent/:consentType', element: <CapacityGateRoute /> },
          { path: 'consent/:consentType/withdraw', element: <WithdrawalRoute /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

const settled = (container: HTMLElement) =>
  waitFor(() =>
    expect(
      container.querySelector('[data-consent], [data-gate-question], [data-row]'),
    ).toBeTruthy(),
  )

const brennan = residents.find((entry) => entry.id === 'res-brennan')!
const withNeverSought = residents.find((entry) =>
  CONSENT_TYPES.some((type) => entry.consents[type.id].kind === 'not_sought'),
)!

/* ------------------------------------------------------------- the tab */

describe('the consent tab', () => {
  it('lists all eight types, from the constant', async () => {
    const { container } = renderAt(`/residents/${withNeverSought.id}/consent`)
    await settled(container)

    const rows = container.querySelectorAll('[data-consent]')
    expect(rows.length).toBe(CONSENT_TYPES.length)
    for (const type of CONSENT_TYPES) {
      expect(
        container.querySelector(`[data-consent="${type.id}"]`),
        type.id,
      ).toBeTruthy()
    }
  })

  it('says in plain English what consenting to each one permits', async () => {
    /*
     * **A consent nobody can explain is not informed**, and this line is the
     * difference between a record of consent and a record of a signature.
     */
    const { container } = renderAt(`/residents/${withNeverSought.id}/consent`)
    await settled(container)

    for (const type of CONSENT_TYPES) {
      const row = container.querySelector(`[data-consent="${type.id}"]`)
      expect(row?.querySelector('[data-means]')?.textContent, type.id).toBe(
        CONSENT_MEANS[type.id as ConsentTypeId],
      )
    }
  })

  it('renders outcome and authority as two columns, because they are two questions', async () => {
    const { container } = renderAt(`/residents/${brennan.id}/consent`)
    await settled(container)

    const row = container.querySelector('[data-consent="photography"]')
    expect(row?.querySelector('[data-outcome="withdrawn"]')).toBeTruthy()
    expect(row?.querySelector('[data-authority="the_resident"]')).toBeTruthy()
    // The assessment that authorised it, named rather than implied.
    expect(row?.querySelector('[data-authority]')?.textContent).toMatch(
      /Capacity assessed/,
    )
  })

  it('gives a never-sought consent the hatch in both columns', async () => {
    const type = CONSENT_TYPES.find(
      (entry) => withNeverSought.consents[entry.id].kind === 'not_sought',
    )!
    const { container } = renderAt(`/residents/${withNeverSought.id}/consent`)
    await settled(container)

    const row = container.querySelector(`[data-consent="${type.id}"]`)
    // Nothing has been decided, so there is nobody who decided it — the hatch
    // rather than a blank, which would read as an authority nobody recorded.
    expect(row?.querySelector('[data-authority="none"]')).toBeTruthy()
    expect(
      row?.querySelector('[data-authority] [data-state="unrecorded"]'),
    ).toBeTruthy()
    expect(row?.textContent).toMatch(/Nobody has decided/)
  })

  it('does not give a refusal a failure treatment', async () => {
    /*
     * A resident refusing is them exercising a right. Caution or critical
     * would make the record disapprove of them — the same reason a goal that
     * was not achieved renders quietly.
     */
    const subject = residents.find((entry) =>
      CONSENT_TYPES.some((type) => entry.consents[type.id].kind === 'refused'),
    )!
    const type = CONSENT_TYPES.find(
      (entry) => subject.consents[entry.id].kind === 'refused',
    )!

    const { container } = renderAt(`/residents/${subject.id}/consent`)
    await settled(container)

    const outcome = container.querySelector(
      `[data-consent="${type.id}"] [data-outcome="refused"]`,
    )
    expect(outcome?.textContent).toMatch(/Refused/)
    expect(outcome?.querySelector('[data-refused]')).toBeTruthy()
    expect(outcome?.querySelector('[data-tone="critical"]')).toBeNull()
    expect(outcome?.querySelector('[data-tone="caution"]')).toBeNull()
  })
})

/* ------------------------------------------- the pinned gap reaches a screen */

describe('the withdrawal that did not undo what it could not', () => {
  it('renders the effects as data with counts, not as a sentence', async () => {
    const status = brennan.consents.photography as AnyConsent
    expect(status.kind).toBe('withdrawn')
    if (status.kind !== 'withdrawn') return

    const { container } = renderAt(`/residents/${brennan.id}/consent`)
    await settled(container)

    const remains = container.querySelector(
      '[data-consent="photography"] [data-remains]',
    )
    expect(remains?.textContent).toMatch(/What withdrawing did not undo/)
    // Every effect on the record is on the screen. A prose note could omit one
    // and look identical; this cannot.
    for (const effect of status.remains) {
      expect(
        remains?.querySelector(`[data-effect="${effect.name}"]`),
        effect.name,
      ).toBeTruthy()
    }
  })

  it('renders an uncounted effect as a gap, never as zero', async () => {
    // Nobody knowing how many prints are on the corridor noticeboards is not
    // the same as there being none.
    const { container } = renderAt(`/residents/${brennan.id}/consent`)
    await settled(container)

    const uncounted = container.querySelector(
      '[data-consent="photography"] [data-count="not_counted"]',
    )
    expect(uncounted?.textContent).toMatch(/Not counted/)
    expect(uncounted?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('names every effect in the confirmation, from the record', async () => {
    const subject = residents.find(
      (entry) => entry.consents.photography.kind === 'given',
    )
    if (!subject) return

    const user = userEvent.setup()
    const { container } = renderAt(
      `/residents/${subject.id}/consent/photography/withdraw`,
    )
    await waitFor(() => expect(container.querySelector('[data-remains]')).toBeTruthy())

    const onScreen = [...container.querySelectorAll('[data-effect]')].map((node) =>
      node.getAttribute('data-effect'),
    )
    expect(onScreen.length).toBeGreaterThan(0)

    await user.click(container.querySelector<HTMLButtonElement>('[data-withdraw]')!)
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role="alertdialog"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })

    // The dialog is rendering the record, not remembering it.
    expect(dialog.textContent).toContain(subject.fullLegalName)
    for (const name of onScreen) {
      expect(
        dialog.querySelector(`[data-confirm-effect="${name}"]`),
        name ?? 'effect',
      ).toBeTruthy()
    }
  })
})

/* ----------------------------------------------------------- the gate */

describe('the capacity gate is a gate, not a field', () => {
  const gateAt = () =>
    renderAt(`/residents/${withNeverSought.id}/consent/medical_treatment`)

  it('asks the question first and offers no default answer', async () => {
    const { container } = gateAt()
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    // A pre-selected answer is an answer nobody gave, and here it is a legal
    // finding about somebody's mind.
    for (const option of container.querySelectorAll('[data-capacity]')) {
      expect(option.getAttribute('aria-checked')).toBe('false')
    }
    expect(container.querySelector('[data-unanswered]')).toBeTruthy()
    expect(
      container.querySelector<HTMLButtonElement>('[data-continue]')?.disabled,
    ).toBe(true)
  })

  it('keeps everything else unreachable until it is answered', async () => {
    const user = userEvent.setup()
    const { container } = gateAt()
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    expect(container.querySelector('[data-scope-section]')).toBeNull()
    expect(container.querySelector('[data-stage="diagnostic"]')).toBeNull()

    await user.click(
      container.querySelector<HTMLButtonElement>('[data-capacity="has_capacity"]')!,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-scope-section]')).toBeTruthy(),
    )
  })

  it('requires both MCA stages before a lacks-capacity finding can be recorded', async () => {
    /*
     * A conclusion with no impairment recorded and no functional finding is
     * not an assessment. Both fields are named individually while empty.
     */
    const user = userEvent.setup()
    const { container } = gateAt()
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )

    await user.click(
      container.querySelector<HTMLButtonElement>('[data-capacity="lacks_capacity"]')!,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-stage="functional"]')).toBeTruthy(),
    )

    const foot = container.querySelector('[data-foot-state]')
    expect(foot?.textContent).toMatch(/stage 1/i)
    expect(foot?.textContent).toMatch(/stage 2/i)
    expect(
      container.querySelector<HTMLButtonElement>('[data-continue]')?.disabled,
    ).toBe(true)

    await user.type(
      container.querySelector<HTMLTextAreaElement>('#diagnostic')!,
      'Moderate vascular dementia.',
    )
    await user.type(
      container.querySelector<HTMLTextAreaElement>('#functional')!,
      'Could not hold the options together long enough to compare.',
    )
    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('[data-continue]')?.disabled,
      ).toBe(false),
    )
  })

  it('names the decisions the assessment covers, and always includes this one', async () => {
    const user = userEvent.setup()
    const { container } = gateAt()
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )
    await user.click(
      container.querySelector<HTMLButtonElement>('[data-capacity="has_capacity"]')!,
    )

    await waitFor(() =>
      expect(container.querySelector('[data-scope="medical_treatment"]')).toBeTruthy(),
    )
    // This decision is in scope by construction and cannot be taken out — an
    // assessment that did not name it could not have authorised it.
    const own = container.querySelector<HTMLButtonElement>(
      '[data-scope="medical_treatment"]',
    )
    expect(own?.disabled).toBe(true)
    expect(own?.getAttribute('aria-pressed')).toBe('true')

    // And every other type is offered, because one conversation can cover
    // several — but never all by default.
    for (const type of CONSENT_TYPES) {
      const chip = container.querySelector(`[data-scope="${type.id}"]`)
      expect(chip, type.id).toBeTruthy()
      if (type.id !== 'medical_treatment') {
        expect(chip?.getAttribute('aria-pressed'), type.id).toBe('false')
      }
    }
  })
})

/* ------------------------------------------------------ the dashboard */

describe('the consent dashboard', () => {
  it('counts residents times types, never consents on record', async () => {
    const { container } = renderAt('/consent')
    await settled(container)

    const lead = container.querySelector('[data-never-sought]')
    expect(lead?.textContent).toMatch(/have never been sought/)
    // Counting what exists would make a home that has asked nobody look
    // complete — the denominator mistake the risk queue names.
    expect(lead?.textContent).toMatch(/decisions the home is expected to hold/)
  })

  it('says how many decisions were made for somebody rather than by them', async () => {
    const { container } = renderAt('/consent')
    await settled(container)

    const line = container.querySelector('[data-decided-for]')
    expect(line?.textContent).toMatch(/rather than/)
    expect(line?.textContent).toMatch(/best-interests process or an attorney/)
  })

  it('can be filtered to the decisions somebody else made', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/consent')
    await settled(container)

    await user.click(
      container.querySelector<HTMLButtonElement>('[data-filter="best_interests"]')!,
    )
    await waitFor(() => {
      const rows = container.querySelectorAll('[data-row]')
      expect(rows.length).toBeGreaterThan(0)
    })
  })
})

describe('accessibility', () => {
  const check = async (path: string) => {
    const { container } = renderAt(path)
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }

  it('has no violations on the consent tab', async () => {
    await check(`/residents/${brennan.id}/consent`)
  }, 20000)

  it('has no violations on the dashboard', async () => {
    await check('/consent')
  }, 20000)
})

/** The gate renders inside the profile layout, so the subject is never inferred. */
describe('the subject is never inferred', () => {
  it('names the resident in the gate question', async () => {
    const { container } = renderAt(
      `/residents/${withNeverSought.id}/consent/medical_treatment`,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-gate-question]')).toBeTruthy(),
    )
    expect(container.querySelector('[data-gate-question]')?.textContent).toContain(
      withNeverSought.preferredName,
    )
  })
})
