import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { AnyConsent, ConsentMethod } from '@/data/types'
import { staffOkonkwo } from '@/data/fixtures/organisation'
import type { IsoDate } from '@/data/types'
import { ConsentBadge } from './ConsentBadge'

/**
 * A consent given by every method says how it was given. Phase 27.
 *
 * **Three rows on the Consent tab read "undefined" where the method belongs.**
 * The label map was `Record<string, string>` keyed `digital`, and the value a
 * record holds is `digital_signature`, so every consent given by signature
 * printed nothing at all beside its date. A `Record<string, …>` accepts any
 * key and returns `undefined` for the ones it has not got, which is why
 * nothing failed and three screens quietly said less than they claimed.
 *
 * The map is now keyed by `ConsentMethod`, so a missing member cannot compile.
 * This asserts the other half: that every member reaches a screen as words.
 * A compile-time guarantee about a map says nothing about what renders.
 */

const METHODS: ConsentMethod[] = ['verbal', 'written', 'digital_signature']

const givenBy = (method: ConsentMethod): AnyConsent => ({
  kind: 'given',
  on: '2026-05-18' as IsoDate,
  method,
  recordedBy: staffOkonkwo,
  by: {
    kind: 'the_resident',
    assessment: {
      id: 'cap-test-method' as never,
      residentId: 'res-okafor' as never,
      finding: { kind: 'has_capacity' },
      covers: {},
      assessedOn: '2026-05-18' as IsoDate,
      assessedBy: staffOkonkwo,
      note: 'Asked her directly; she was clear.',
    },
  },
})

describe('a consent says how it was given, whichever way that was', () => {
  it.each(METHODS)('renders %s as words rather than nothing', (method) => {
    const { container } = render(<ConsentBadge status={givenBy(method)} />)
    const text = container.textContent ?? ''

    expect(text, `${method} renders no label`).not.toMatch(/undefined/i)
    /*
     * Not merely "something is there": the date is there whatever the method
     * does, so a badge printing only a date would pass a presence check. What
     * is asserted is that the method reaches the screen in words of its own.
     */
    expect(
      text.replace('18/05/2026', '').trim(),
      `${method} says only its date`,
    ).not.toBe('·')
  })

  it('names the signature method in words a reader would use', () => {
    const { container } = render(<ConsentBadge status={givenBy('digital_signature')} />)
    // The defect rendered nothing here; an underscored identifier would be the
    // other way of saying nothing.
    expect(container.textContent).toContain('digital signature')
    expect(container.textContent).not.toContain('digital_signature')
  })
})
