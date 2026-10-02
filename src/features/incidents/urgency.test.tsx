import { afterEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from '@/app/session/SessionProvider'
import { TooltipProvider } from '@/components/primitives'
import type { Incident, IsoDateTime } from '@/data/types'
import { SignInAs } from '@/test/sign-in-as'
import { incidents } from '@/data/fixtures/incidents'
import { now as appNow } from '@/data/fixtures/clock'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import {
  raiseUrgency,
  standDownUrgency,
  resetSessionIncidents,
  withIncidentEdits,
} from '@/data/access/incident-store'
import { vocabularyFor } from '@/lib/vocabulary'
import { outstandingDecisions } from './decisions'
import { incidentPdfContent, type PdfFormat } from './incident-pdf'
import { UNACKNOWLEDGED_INCIDENT } from '@/data/fixtures/incidents'
import { staffHalloran } from '@/data/fixtures/organisation'
import { IncidentDetailRoute } from './IncidentDetailRoute'

/** The default vocabulary, as a screen reading no override would see it. */
const TERMS = vocabularyFor('care_home', {})

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
const appNowIso = () => appNow().toISOString() as IsoDateTime

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

/**
 * The fixtures that make the raised and stood-down states reachable at all.
 *
 * Every one of the ten incident fixtures was `ordinary`, so `UrgencySection`,
 * `outstandingDecisions` and `incident-pdf` all rendered a state nothing in
 * the running product could produce. Three dead render sites, and the feature
 * read as unbuilt to somebody looking for it.
 */
describe('the fixtures reach both raised states', () => {
  const raisedFixture = incidents.find(
    (entry) => entry.urgency.kind === 'needs_attention_now',
  )
  const stoodDownFixture = incidents.find(
    (entry) => entry.urgency.kind === 'stood_down',
  )

  it('has an incident somebody said cannot wait', () => {
    expect(raisedFixture).toBeTruthy()
    expect(raisedFixture!.id).toBe(UNACKNOWLEDGED_INCIDENT)
  })

  it('has an incident that was raised and then stood down', () => {
    expect(stoodDownFixture).toBeTruthy()
    if (stoodDownFixture!.urgency.kind !== 'stood_down')
      throw new Error('not stood down')
    // The raise survives in full. That is the whole reason for the member.
    expect(stoodDownFixture!.urgency.because).not.toBe('')
    expect(stoodDownFixture!.urgency.raised.by.id).toBeTruthy()
    expect(stoodDownFixture!.urgency.why).not.toBe('')
    expect(stoodDownFixture!.urgency.stoodDown.by.id).not.toBe(
      stoodDownFixture!.urgency.raised.by.id,
    )
  })

  it('reaches the reworded case, where the two acts differ', () => {
    if (raisedFixture!.urgency.kind !== 'needs_attention_now') throw new Error('nope')
    expect(raisedFixture!.urgency.worded.at).not.toBe(raisedFixture!.urgency.raised.at)
  })
})

describe('standing an urgency down', () => {
  it('keeps the raise and records the answer beside it', () => {
    raiseUrgency(ordinary, 'The family arrive at four.', staffOkonkwo)
    const raisedAt = (() => {
      const u = read(ordinary).urgency
      if (u.kind !== 'needs_attention_now') throw new Error('not raised')
      return u.raised
    })()

    standDownUrgency(read(ordinary), 'The GP saw her within the hour.', staffHalloran)

    const after = read(ordinary)
    if (after.urgency.kind !== 'stood_down') throw new Error('not stood down')
    // Nothing deleted: both judgements are on the record, with both names.
    expect(after.urgency.because).toBe('The family arrive at four.')
    expect(after.urgency.raised.by.id).toBe(raisedAt.by.id)
    expect(after.urgency.raised.at).toBe(raisedAt.at)
    expect(after.urgency.why).toBe('The GP saw her within the hour.')
    expect(after.urgency.stoodDown.by.id).toBe(staffHalloran.id)
  })

  it('refuses without a reason, and refuses when nothing was raised', () => {
    expect(() => standDownUrgency(ordinary, '  ', staffOkonkwo)).toThrow(/saying why/i)

    raiseUrgency(ordinary, 'Urgent.', staffOkonkwo)
    expect(read(ordinary).urgency.kind).toBe('needs_attention_now')

    resetSessionIncidents()
    expect(() => standDownUrgency(ordinary, 'No longer.', staffOkonkwo)).toThrow(
      /nothing has been raised/i,
    )
  })

  /*
   * The union holds one raise and one answer, not a chain, so re-raising
   * would overwrite who stood it down and why — the erasure this member
   * exists to prevent, arriving from the other direction.
   */
  it('will not re-raise something already stood down', () => {
    raiseUrgency(ordinary, 'Urgent.', staffOkonkwo)
    standDownUrgency(read(ordinary), 'Settled.', staffHalloran)

    expect(() => raiseUrgency(read(ordinary), 'Urgent again.', staffOkonkwo)).toThrow(
      /erase who stood it down/i,
    )
    expect(read(ordinary).urgency.kind).toBe('stood_down')
  })

  /*
   * **A reword keeps the raise.** With one act this had to choose between
   * recording who first raised it and who stands behind the current words,
   * and it also reset the only timestamp there was, so an urgency raised six
   * hours ago and reworded a minute ago read as a minute old.
   */
  it('a reword moves `worded` and leaves `raised` where it was', () => {
    raiseUrgency(ordinary, 'First wording.', staffOkonkwo)
    const first = read(ordinary).urgency
    if (first.kind !== 'needs_attention_now') throw new Error('not raised')

    raiseUrgency(read(ordinary), 'A clearer wording.', staffHalloran)
    const second = read(ordinary).urgency
    if (second.kind !== 'needs_attention_now') throw new Error('not raised')

    expect(second.because).toBe('A clearer wording.')
    expect(second.raised.at).toBe(first.raised.at)
    expect(second.raised.by.id).toBe(first.raised.by.id)
    expect(second.worded.by.id).toBe(staffHalloran.id)
  })
})

describe('what the rest of the product does with a stood-down urgency', () => {
  const stoodDown = incidents.find((entry) => entry.urgency.kind === 'stood_down')!
  const raisedOne = incidents.find(
    (entry) => entry.urgency.kind === 'needs_attention_now',
  )!

  /*
   * **The entire point of the member.** A stood-down incident is not
   * outstanding, and the positive case is asserted beside it so that a
   * predicate refusing everything cannot pass as one that works.
   */
  it('does not report it as something that cannot wait', () => {
    const ids = outstandingDecisions(stoodDown, appNowIso(), TERMS).map(
      (entry) => entry.id,
    )
    expect(ids).not.toContain('urgent')

    const raisedIds = outstandingDecisions(raisedOne, appNowIso(), TERMS).map(
      (entry) => entry.id,
    )
    expect(raisedIds).toContain('urgent')
  })

  /*
   * An export that drops the stand-down lets a reader conclude either that it
   * is still urgent or that nobody ever raised it: opposite mistakes from one
   * omission. The raise is on the page too, because that is what happened.
   */
  it('carries both halves into the PDF', () => {
    const format: PdfFormat = { dateTime: (at) => `[${at}]`, date: (on) => `[${on}]` }
    const text = incidentPdfContent(stoodDown, {
      residentName: 'Emmanuel Okafor',
      siteName: 'Rosewood Court',
      terms: TERMS,
      format,
    })
      .sections.flatMap((section) => section.lines)
      .join('\n')

    if (stoodDown.urgency.kind !== 'stood_down') throw new Error('not stood down')
    expect(text).toContain(stoodDown.urgency.because)
    expect(text).toContain(stoodDown.urgency.why)
    expect(text).toContain(stoodDown.urgency.stoodDown.by.displayName)
    expect(text).toContain('Stood down by')
  })

  it('does not state the wording twice on a first raise', () => {
    const format: PdfFormat = { dateTime: (at) => `[${at}]`, date: (on) => `[${on}]` }
    const firstRaise = {
      ...ordinary,
      urgency: {
        kind: 'needs_attention_now' as const,
        raised: { by: staffOkonkwo, at: ordinary.reported.at },
        because: 'Nobody has looked at her since.',
        worded: { by: staffOkonkwo, at: ordinary.reported.at },
      },
    }
    const text = incidentPdfContent(firstRaise, {
      residentName: 'Emmanuel Okafor',
      siteName: 'Rosewood Court',
      terms: TERMS,
      format,
    })
      .sections.flatMap((section) => section.lines)
      .join('\n')

    expect(text).toContain('Nobody has looked at her since.')
    expect(text).not.toContain('Reworded by')
  })
})
