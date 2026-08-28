import { describe, expect, it } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
} from '@/data/types'
import type { IsoDate } from '@/data/types'
import { residentById } from '@/data/fixtures/residents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  ADMISSION_GAPS,
  admitResident,
  admittedThisSession,
} from '@/data/access/resident-store'
import { AdmissionRoute } from './AdmissionRoute'

/**
 * Admission. PRD §6.7, Phase 16.
 *
 * **The hazard is a record that looks complete on the day it is emptiest.**
 * Admission creates a person and a set of gaps, and every guard here is about
 * the form saying so rather than filling anything in on somebody's behalf.
 */

const admit = (over: Partial<Parameters<typeof admitResident>[0]> = {}) =>
  admitResident({
    fullLegalName: 'Ruth Ogunlesi',
    preferredName: 'Ruth',
    dateOfBirth: '1938-11-02' as IsoDate,
    admittedOn: '2026-08-25' as IsoDate,
    siteId: 'site-rosewood-court',
    room: '221',
    allergies: { kind: 'not_recorded' },
    admittedBy: staffOkonkwo,
    ...over,
  })

function renderForm() {
  const router = createMemoryRouter(
    [
      { path: 'residents/new', element: <AdmissionRoute /> },
      { path: 'residents/:residentId', element: <p>profile</p> },
    ],
    { initialEntries: ['/residents/new'] },
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
  waitFor(() => expect(container.querySelector('[data-admission]')).toBeTruthy())

describe('admission creates a person and a set of gaps', () => {
  it('produces a resident indistinguishable from the one already in the fixtures', () => {
    /*
     * Ismail Sowande was admitted yesterday and has been that resident since
     * Phase 0. If admission produced anything different from him, one of the
     * two would be wrong — and every module already renders him correctly.
     */
    const admitted = admit()
    const sowande = residentById('res-sowande')!

    for (const field of [
      'pronouns',
      'nhsNumber',
      'fundingSource',
      'primaryDiagnosis',
      'medicalHistory',
      'gp',
      'pharmacy',
    ] as const) {
      expect(admitted[field].kind, field).toBe(sowande[field].kind)
    }
    expect(admitted.resuscitation.kind).toBe(sowande.resuscitation.kind)
    expect(admitted.carePlanReview.kind).toBe('never_scheduled')
  })

  it('cannot create a record missing a consent, a template or a domain', () => {
    const admitted = admit()

    // The type enforces this and the guard states it: a resident with no
    // consent record is exactly the record this product exists to flag.
    expect(Object.keys(admitted.consents)).toHaveLength(CONSENT_TYPES.length)
    expect(Object.keys(admitted.risks)).toHaveLength(RISK_ASSESSMENT_TEMPLATES.length)
    expect(admitted.carePlan).toHaveLength(CARE_PLAN_DOMAINS.length)

    for (const type of CONSENT_TYPES) {
      expect(admitted.consents[type.id].kind, type.id).toBe('not_sought')
    }
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      expect(admitted.risks[template.id].kind, template.id).toBe('not_assessed')
    }
    for (const domain of admitted.carePlan) {
      expect(domain.status.kind, domain.domainId).toBe('not_started')
      expect(domain.versions.kind, domain.domainId).toBe('never_finalised')
    }
  })

  it('leaves a blank preferred name unrecorded rather than copying the legal one', () => {
    const admitted = admit({ preferredName: '' })
    /*
     * A default here would be the system putting a name in somebody's mouth on
     * their first day — and it would be indistinguishable from somebody having
     * said it.
     */
    expect(admitted.preferredName).toBe('')
    expect(admitted.fullLegalName).not.toBe(admitted.preferredName)
  })

  it('appears in this session and never in the fixtures', () => {
    const before = admittedThisSession().length
    const admitted = admit({ fullLegalName: 'Someone Else' })
    expect(admittedThisSession()).toHaveLength(before + 1)
    // The fixtures are never mutated.
    expect(residentById(admitted.id)).toBeUndefined()
  })
})

describe('the form asks six things and one question', () => {
  it('waits on the allergies question before anything can be admitted', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    await user.type(container.querySelector('[data-field="full-legal-name"]')!, 'Ruth')
    await user.type(
      container.querySelector('[data-field="date-of-birth"]')!,
      '1938-11-02',
    )

    const state = container.querySelector('[data-admission-state]')!
    expect(state.textContent).toContain('the allergies question')
    expect(container.querySelector<HTMLButtonElement>('[data-admit]')!.disabled).toBe(
      true,
    )
  })

  it('offers no default answer on allergies', async () => {
    const { container } = renderForm()
    await settled(container)

    for (const choice of ['recorded', 'none_known', 'not_known']) {
      const input = container.querySelector<HTMLInputElement>(
        `[data-allergy-choice="${choice}"] input`,
      )!
      expect(input.checked, choice).toBe(false)
    }
  })

  it('requires a source before a recorded negative', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    await user.type(container.querySelector('[data-field="full-legal-name"]')!, 'Ruth')
    await user.type(
      container.querySelector('[data-field="date-of-birth"]')!,
      '1938-11-02',
    )
    await user.click(
      container.querySelector('[data-allergy-choice="none_known"] input')!,
    )

    /*
     * "No known allergies" with nobody's name on it is a guess wearing a
     * record, and the source is what stops the field becoming pressure to
     * answer.
     */
    await waitFor(() =>
      expect(container.querySelector('[data-admission-state]')!.textContent).toContain(
        'who said there are none',
      ),
    )
  })

  it('asks how bad an allergy gets, because the reaction alone is half a record', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    await user.click(container.querySelector('[data-allergy-choice="recorded"] input')!)
    await waitFor(() =>
      expect(container.querySelector('[data-field="allergy-severity"]')).toBeTruthy(),
    )
  })

  it('says what starts unrecorded, and where each of them is recorded', async () => {
    const { container } = renderForm()
    await settled(container)

    for (const gap of ADMISSION_GAPS) {
      const row = container.querySelector(`[data-gap="${gap.what}"]`)!
      expect(row.textContent, gap.what).toContain(gap.where)
    }
    // Medication's destination is not a screen in this product.
    expect(container.textContent).toContain('Prescriber, not here')
  })

  it('does not soften what admitting does to every figure in the product', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    await user.type(
      container.querySelector('[data-field="full-legal-name"]')!,
      'Ruth Ogunlesi',
    )
    await user.type(
      container.querySelector('[data-field="date-of-birth"]')!,
      '1938-11-02',
    )
    await user.click(
      container.querySelector('[data-allergy-choice="not_known"] input')!,
    )

    await waitFor(() => {
      const state = container.querySelector('[data-admission-state]')!
      expect(state.textContent).toContain('almost entirely gaps')
      expect(state.textContent).toContain('coverage just fell')
    })
  })

  it('admits, and lands on the record it created', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    await user.type(
      container.querySelector('[data-field="full-legal-name"]')!,
      'Nkechi Umeh',
    )
    await user.type(
      container.querySelector('[data-field="date-of-birth"]')!,
      '1941-04-19',
    )
    await user.click(
      container.querySelector('[data-allergy-choice="not_known"] input')!,
    )
    await user.click(container.querySelector('[data-admit]')!)

    await waitFor(() => expect(container.textContent).toContain('profile'))
    expect(
      admittedThisSession().some((entry) => entry.fullLegalName === 'Nkechi Umeh'),
    ).toBe(true)
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderForm()
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})

describe('the form offers nothing it cannot honestly record', () => {
  it('asks for no clinical field except allergies', async () => {
    const { container } = renderForm()
    await settled(container)

    const page = container.querySelector('[data-admission]') as HTMLElement
    for (const word of [/diagnos/i, /medication/i, /resuscitation/i, /next of kin/i]) {
      // Each of these appears in the gap list and nowhere as a control.
      expect(
        within(page).queryByRole('textbox', { name: word }),
        String(word),
      ).toBeNull()
    }
  })
})
