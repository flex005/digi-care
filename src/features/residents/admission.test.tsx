import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
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
import { residentDocuments } from '@/data/access/document-store'
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
  /**
   * **This asserted that no clinical field existed, and the rule changed.**
   *
   * It was the six-field principle in test form: anything past a name and a
   * home asks somebody to guess on the day they know least, so the fields were
   * absent and the guard held them absent. AM v2.0's five steps overrule that
   * and Frank approved it, so the assertion had to move — and the §8 rule
   * about a test edited to let a change land applies with full force here.
   *
   * So it is not edited to pass. **The reasoning did not disappear when the
   * fields arrived; it became a different rule**, and that rule is what is
   * asserted now: nothing past step 1 is required. (It said step 2 until
   * Phase 25, beside a strip labelling step 2 required, and neither was true
   * of the form: nothing on step 2 was ever required.) A form that required a
   * diagnosis on admission day would get one invented, and an invented
   * diagnosis is indistinguishable from a recorded one for as long as the
   * record lasts. The new assertion is stronger than the old one, because the
   * old one would have passed on a form that had the fields and demanded them
   * in some other way.
   */
  it('requires nothing past step 1, whatever it now asks', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)

    const page = container.querySelector('[data-admission]') as HTMLElement

    // Answering only step 1 and the allergies question is enough to admit.
    await answerStepOne(user, page, 'Ada Nwosu')
    await waitFor(() =>
      expect(page.querySelector<HTMLButtonElement>('[data-admit]')!.disabled).toBe(
        false,
      ),
    )

    // And the five steps' own fields are there, each on its own step.
    for (const [stepId, field] of [
      ['who', 'pronouns'],
      ['contact', 'kin-name'],
      ['contact', 'gp-name'],
      ['clinical', 'primary-diagnosis'],
    ] as const) {
      await goToStep(user, page, stepId)
      expect(page.querySelector(`[data-field="${field}"]`), field).toBeTruthy()
    }
  }, 20000)

  it('says on the step that filing a DNAR does not record the decision', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement
    await answerStepOne(user, page, 'Ada Nwosu')
    await goToStep(user, page, 'flags')

    /*
     * On the step rather than after it. A resident admitted with a DNAR filed
     * still renders "no decision recorded" on their header, and that will look
     * wrong to somebody who has just uploaded one unless they are told first.
     */
    const flags = page.querySelector('[data-section="flags"]') as HTMLElement
    const said = flags.querySelector('[data-dnar-note]')!
    expect(said.textContent).toMatch(/does not record the decision/i)
    expect(said.textContent).toMatch(/signature of the clinician/i)
    /*
     * **And the control the sentence names is beside it.** This test asserted
     * the sentence alone from Phase 24, and it passed over a step with no way
     * to file anything: the sentence was a claim, and finding it confirmed
     * only that the claim was made.
     */
    expect(flags.querySelector('[data-choose-dnar="PDF"]')).toBeTruthy()
  }, 20000)

  it('sets no target date, and says why that is stronger than one', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement
    await answerStepOne(user, page, 'Ada Nwosu')
    await goToStep(user, page, 'plan')

    const said = page.querySelector('[data-no-dates]')!
    expect(said.textContent).toMatch(/stronger than a date/i)
    // The gap is visible everywhere until somebody does it, which is the
    // argument for not adding a deadline nothing enforces.
    expect(said.textContent).toMatch(/for as long as they last/i)
  }, 20000)
})

/**
 * The steps, Phase 25. **The strip said five steps, two of them required, over
 * one long form that gated nothing and required nothing on step 2.** Every
 * test passed, because every test read what the page rendered and the page
 * rendered the claim. So these assert behaviour, never a label's text.
 */
describe('the steps gate, and say truthfully which are required', () => {
  it('shows one step at a time, and opens the rest once step 1 is answered', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement

    expect(page.querySelector('[data-section="who"]')).toBeTruthy()
    expect(page.querySelector('[data-section="contact"]')).toBeNull()
    expect(page.querySelector('[data-section="flags"]')).toBeNull()
    expect(page.querySelector<HTMLButtonElement>('[data-step-next]')!.disabled).toBe(
      true,
    )
    expect(
      page.querySelector<HTMLButtonElement>('[data-step="contact"] button')!.disabled,
    ).toBe(true)

    await answerStepOne(user, page, 'Ada Nwosu')
    await user.click(page.querySelector('[data-step-next]')!)
    await waitFor(() =>
      expect(page.querySelector('[data-section="contact"]')).toBeTruthy(),
    )
    expect(page.querySelector('[data-section="who"]')).toBeNull()
  }, 20000)

  it('labels a step required only when it cannot be left blank', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement

    const steps = [...page.querySelectorAll('[data-step]')].map((node) => ({
      id: node.getAttribute('data-step')!,
      required: node.getAttribute('data-required') === 'yes',
    }))
    expect(steps).toHaveLength(5)
    const unreachable = (index: number) =>
      page.querySelector<HTMLButtonElement>(`[data-step="${steps[index]!.id}"] button`)!
        .disabled

    // Nothing answered: a required step holds back the one after it.
    steps.forEach((step, index) => {
      if (step.required && index + 1 < steps.length)
        expect(unreachable(index + 1), `${step.id} is labelled required`).toBe(true)
    })

    /*
     * Step 1 answered and every other field blank. A step still labelled
     * required must still hold back what follows; a step labelled as able to
     * wait must let somebody past it and leave admission possible.
     */
    await answerStepOne(user, page, 'Ada Nwosu')
    for (const [index, step] of steps.entries()) {
      if (step.id === 'who') continue
      if (step.required) {
        expect(unreachable(index), `${step.id} is labelled required`).toBe(true)
        continue
      }
      await goToStep(user, page, step.id)
      expect(page.querySelector<HTMLButtonElement>('[data-admit]')!.disabled).toBe(
        false,
      )
      if (index + 1 < steps.length) expect(unreachable(index + 1), step.id).toBe(false)
    }
  }, 30000)

  it('files a DNAR form on admission, and leaves the decision unrecorded', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement

    await answerStepOne(user, page, 'Bisi Adeyemi-Clarke')
    await goToStep(user, page, 'flags')
    await user.click(page.querySelector('[data-choose-dnar="PDF"]')!)
    expect(page.querySelector('[data-dnar-chosen]')).toBeTruthy()
    await user.click(page.querySelector('[data-admit]')!)

    // Read back through the document store the resident's library reads.
    const admitted = () =>
      admittedThisSession().find(
        (entry) => entry.fullLegalName === 'Bisi Adeyemi-Clarke',
      )
    await waitFor(() => expect(admitted()).toBeTruthy())
    await waitFor(() =>
      expect(
        residentDocuments(admitted()!.id).filter(
          (document) => document.category === 'legal_authority',
        ),
      ).toHaveLength(1),
    )
    const [filed] = residentDocuments(admitted()!.id)
    expect(filed!.title).toBe('DNAR form')
    expect(filed!.file).toEqual({ kind: 'not_retrievable', format: 'PDF' })

    // The document is on file and the decision is not: that needs a signature.
    expect(admitted()!.futurePlans.resuscitation.kind).toBe('no_decision_recorded')
  }, 30000)

  it('files nothing when no form was chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await settled(container)
    const page = container.querySelector('[data-admission]') as HTMLElement

    await answerStepOne(user, page, 'Tomasz Wierzbicki')
    await user.click(page.querySelector('[data-admit]')!)
    const admitted = () =>
      admittedThisSession().find((entry) => entry.fullLegalName === 'Tomasz Wierzbicki')
    await waitFor(() => expect(admitted()).toBeTruthy())
    await waitFor(() => expect(container.textContent).toContain('profile'))
    expect(residentDocuments(admitted()!.id)).toHaveLength(0)
  }, 30000)
})

async function answerStepOne(
  user: ReturnType<typeof userEvent.setup>,
  page: HTMLElement,
  fullLegalName: string,
) {
  await user.type(page.querySelector('[data-field="full-legal-name"]')!, fullLegalName)
  await user.type(page.querySelector('[data-field="date-of-birth"]')!, '1939-04-02')
  await user.click(page.querySelector('[data-allergy-choice="not_known"] input')!)
}

async function goToStep(
  user: ReturnType<typeof userEvent.setup>,
  page: HTMLElement,
  id: string,
) {
  await user.click(page.querySelector(`[data-step="${id}"] button`)!)
  await waitFor(() =>
    expect(
      page.querySelector(`[data-step="${id}"]`)!.getAttribute('data-current'),
    ).toBe('yes'),
  )
}
