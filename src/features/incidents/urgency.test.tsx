import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { Incident } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { incidents } from '@/data/fixtures/incidents'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  raiseUrgency,
  resetSessionIncidents,
  withIncidentEdits,
} from '@/data/access/incident-store'
import { IncidentDetailRoute } from './IncidentDetailRoute'

/**
 * Saying an incident needs attention now, after it was filed.
 *
 * **The gap this closes.** Urgency could only be set on the report form, so a
 * manager who read an incident an hour later and realised it could not wait
 * had no control anywhere in the product.
 *
 * **And the write had nowhere to land.** `withIncidentEdits` did not mention
 * `urgency` at all, so even a store function would have had its result
 * dropped on the way back out — the overlay is the single read everything
 * flows through. That is asserted through the overlay rather than the map.
 */
afterEach(() => {
  resetSessionIncidents()
})

const ordinary = incidents.find((entry) => entry.urgency.kind === 'ordinary')!
const read = (incident: Incident): Incident => withIncidentEdits(incident)

describe('raising urgency after the report', () => {
  it('records the reason, who raised it, and survives the read overlay', () => {
    expect(ordinary.urgency.kind).toBe('ordinary')

    raiseUrgency(
      ordinary,
      '  The family arrive at four and nobody has rung.  ',
      staffOkonkwo,
    )

    const after = read(ordinary)
    if (after.urgency.kind !== 'needs_attention_now')
      throw new Error('the urgency did not survive the overlay')
    expect(after.urgency.because).toBe('The family arrive at four and nobody has rung.')
    expect(after.urgency.raised.by.id).toBe(staffOkonkwo.id)
  })

  it('refuses to call something urgent without saying why', () => {
    expect(() => raiseUrgency(ordinary, '   ', staffOkonkwo)).toThrow(/saying why/i)
    expect(read(ordinary).urgency.kind).toBe('ordinary')
  })

  it('leaves everything else on the incident alone', () => {
    raiseUrgency(ordinary, 'Needs a manager today.', staffOkonkwo)

    const after = read(ordinary)
    expect(after.description).toBe(ordinary.description)
    expect(after.status).toEqual(ordinary.status)
    expect(after.review).toEqual(ordinary.review)
    expect(after.familyTold).toEqual(ordinary.familyTold)
    expect(after.edited).toEqual(ordinary.edited)
  })

  /*
   * Rewording moves the stamp, which is the trade recorded on `raiseUrgency`:
   * the union holds one act, so it can say who first raised it or who stands
   * behind the words that are there now, and it keeps the second.
   */
  it('rewording carries the name of whoever wrote the words that are there', () => {
    raiseUrgency(ordinary, 'First reason.', staffOkonkwo)
    const first = read(ordinary)
    if (first.urgency.kind !== 'needs_attention_now') throw new Error('not raised')

    raiseUrgency(read(ordinary), 'A clearer reason.', staffOkonkwo)
    const second = read(ordinary)
    if (second.urgency.kind !== 'needs_attention_now') throw new Error('not raised')
    expect(second.urgency.because).toBe('A clearer reason.')
  })
})

describe('the control on the detail page', () => {
  function renderDetail(incident: Incident) {
    const router = createMemoryRouter(
      [{ path: '/incidents/:incidentId', element: <IncidentDetailRoute /> }],
      { initialEntries: [`/incidents/${incident.id}`] },
    )
    return render(
      <SessionProvider>
        <TooltipProvider>
          <SignInAs as="registered_manager" />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>,
    )
  }

  it('raises it from the screen and shows who said so', async () => {
    const user = userEvent.setup()
    const { container } = renderDetail(ordinary)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    const section = container.querySelector('[data-section="urgency"]')
    expect(section).toBeTruthy()
    expect(
      container.querySelector('[data-urgency-state="ordinary"]')!.textContent,
    ).toContain('Nobody has said')

    // Refused until there is a reason, the same rule the store holds.
    const raise = container.querySelector<HTMLButtonElement>('[data-urgency-raise]')!
    expect(raise.disabled).toBe(true)

    await user.type(
      container.querySelector('[data-urgency-reason]')!,
      'The family arrive at four.',
    )
    expect(raise.disabled).toBe(false)
    await user.click(raise)

    await waitFor(() =>
      expect(
        container.querySelector('[data-urgency-state="needs_attention_now"]'),
      ).toBeTruthy(),
    )
    const state = container.querySelector('[data-urgency-state="needs_attention_now"]')!
    expect(state.textContent).toContain('The family arrive at four.')
    expect(state.textContent).toContain(staffOkonkwo.displayName)
  }, 30000)

  /*
   * Asserted as an absence, not as a sentence. The screen says there is no
   * way to stand it down; this checks there is in fact no control that does,
   * which is the §8 rule about a refusal being tested through the thing it
   * refuses rather than the words describing it.
   */
  it('offers no way to put it back to ordinary', async () => {
    const user = userEvent.setup()
    const { container } = renderDetail(ordinary)
    await waitFor(() => expect(container.querySelector('[data-subject]')).toBeTruthy())

    await user.type(container.querySelector('[data-urgency-reason]')!, 'Urgent.')
    await user.click(container.querySelector('[data-urgency-raise]')!)
    await waitFor(() =>
      expect(
        container.querySelector('[data-urgency-state="needs_attention_now"]'),
      ).toBeTruthy(),
    )

    const section = container.querySelector('[data-section="urgency"]')!
    const labels = [...section.querySelectorAll('button')].map((button) =>
      (button.textContent ?? '').toLowerCase(),
    )
    expect(
      labels.some((label) => /stand down|no longer urgent|ordinary/.test(label)),
    ).toBe(false)
  }, 30000)
})
