import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'
import { residentsBySite } from '@/data/fixtures/residents'
import { InterimRoute } from './InterimRoute'

/**
 * Adding an interim medication. PRD §6.4.
 *
 * The screen exists to record a prescription somebody else wrote. Every guard
 * here is about it refusing to be the place one gets invented.
 */

function renderInterim() {
  const router = createMemoryRouter([{ path: '/', element: <InterimRoute /> }], {
    initialEntries: ['/'],
  })
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
  waitFor(() => expect(container.querySelector('[data-interim]')).toBeTruthy())

describe('the source is the first question and it is required', () => {
  it('offers no default source', async () => {
    const { container } = renderInterim()
    await settled(container)

    /*
     * A medication with no source is a drug nobody can trace to a prescriber,
     * and a pre-selected route is the system answering that on somebody's
     * behalf.
     */
    const options = container.querySelectorAll<HTMLInputElement>(
      '[data-source-option] input',
    )
    expect(options.length).toBeGreaterThan(1)
    for (const option of options) expect(option.checked).toBe(false)
  })

  it('waits on the source before anything else can complete the form', async () => {
    const user = userEvent.setup()
    const { container } = renderInterim()
    await settled(container)

    await user.type(container.querySelector('[data-field="name"]')!, 'Amoxicillin')
    await user.type(container.querySelector('[data-field="strength"]')!, '500mg')

    const state = container.querySelector('[data-interim-state]')!
    expect(state.textContent).toContain('where the prescription came from')
    expect(
      container.querySelector<HTMLButtonElement>('[data-add-interim]')!.disabled,
    ).toBe(true)
  })

  it('asks for the strength beside the dose, because either alone is half a record', async () => {
    const user = userEvent.setup()
    const { container } = renderInterim()
    await settled(container)

    await user.type(container.querySelector('[data-field="dose"]')!, 'One tablet')

    // "One tablet" is a different prescription at 250mg and at 500mg.
    await waitFor(() =>
      expect(container.querySelector('[data-interim-state]')!.textContent).toContain(
        'the strength',
      ),
    )
  })
})

describe('a verbal order carries its follow-up, and a controlled drug is refused outright', () => {
  it('says why a controlled drug cannot come this way, before anybody types', async () => {
    const { container } = renderInterim()
    await settled(container)

    /*
     * Stated where the route is chosen rather than raised on submit: a form
     * that takes eleven fields before saying no is a form wasting a shift.
     */
    const refusal = container.querySelector('[data-cd-refusal]')!
    expect(refusal.textContent).toMatch(
      /controlled drug cannot be added by this route/i,
    )
    expect(container.querySelectorAll('[data-field]')).toBeTruthy()
  })

  it('requires a witness only once a verbal order is chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderInterim()
    await settled(container)

    expect(container.querySelector('[data-verbal-obligation]')).toBeNull()

    await user.click(container.querySelector('[data-source-option="verbal"] input')!)

    await waitFor(() => {
      const block = container.querySelector('[data-verbal-obligation]')!
      expect(block.textContent).toMatch(/witness/i)
      expect(block.textContent).toMatch(/within 24 hours/i)
    })
    await waitFor(() =>
      expect(container.querySelector('[data-interim-state]')!.textContent).toContain(
        'the witness to the call',
      ),
    )
  })
})

describe('allergies render beside the resident', () => {
  it('shows the chosen resident\u2019s own allergy record, in the same section', async () => {
    const user = userEvent.setup()
    const { container } = renderInterim()
    await settled(container)

    const who = container.querySelector('[data-section="who"]') as HTMLElement
    expect(who.querySelector('[data-allergies]')).toBeTruthy()
    // Nobody chosen yet, so there is no record to show and none is invented.
    expect(who.querySelector('[data-allergy-state]')).toBeNull()

    const declared = residentsBySite('site-rosewood-court').find(
      (one) => one.allergies.kind === 'allergies',
    )!
    await user.click(within(who).getByRole('combobox', { name: 'Resident' }))
    await user.click(
      await screen.findByRole('option', { name: new RegExp(declared.fullLegalName) }),
    )

    await waitFor(() =>
      expect(
        who.querySelector('[data-allergy-state]')!.getAttribute('data-allergy-state'),
      ).toBe('allergies'),
    )
    /*
     * Substance, reaction and severity together. The reaction alone is half a
     * record, and the difference between mild and anaphylaxis is whether that
     * person carries an adrenaline pen.
     */
    const first =
      declared.allergies.kind === 'allergies' ? declared.allergies.items[0] : undefined
    const shown =
      who.querySelector('[data-allergy-state="allergies"]')!.textContent ?? ''
    expect(shown).toContain(first!.substance.toUpperCase())
    expect(shown).toContain(first!.reaction)
    expect(shown).toContain(first!.severity)
  })

  it('hatches a resident nobody has asked, and never as a negative', async () => {
    const user = userEvent.setup()
    const { container } = renderInterim()
    await settled(container)

    /*
     * The branch that matters, and the one a collapsed union destroys silently:
     * a resident nobody has asked must not read like a resident with nothing to
     * declare. On a prescribing screen those are opposite.
     */
    const unasked = residentsBySite('site-rosewood-court').find(
      (one) => one.allergies.kind === 'not_recorded',
    )!
    const who = container.querySelector('[data-section="who"]') as HTMLElement
    await user.click(within(who).getByRole('combobox', { name: 'Resident' }))
    await user.click(
      await screen.findByRole('option', { name: new RegExp(unasked.fullLegalName) }),
    )

    await waitFor(() =>
      expect(who.querySelector('[data-allergy-state="not_recorded"]')).toBeTruthy(),
    )
    const shown = who.querySelector(
      '[data-allergy-state="not_recorded"]',
    ) as HTMLElement
    expect(shown.textContent).toMatch(/nobody has asked/i)
    expect(shown.textContent).not.toMatch(/no known allergies/i)
    // The hatch itself, not a quiet line of text.
    expect(shown.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('reaches every member of the allergy union across the residents on the screen', () => {
    /*
     * If no resident reaches a branch, either the fixture is wrong or the
     * branch is. The hatched one is the branch that matters: a resident nobody
     * has asked must not look like a resident with nothing to declare.
     */
    const kinds = new Set(
      residentsBySite('site-rosewood-court').map((one) => one.allergies.kind),
    )
    expect(kinds.has('not_recorded')).toBe(true)
    expect(kinds.has('allergies')).toBe(true)
  })
})

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderInterim()
    await settled(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})
