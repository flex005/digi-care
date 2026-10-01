import { describe, expect, it } from 'vitest'
import type { CarePlanText } from '@/data/types'
import { PLAN_FIELDS } from './plan-fields'
import { isWritten } from './CarePlanTextFields'
import { written } from '@/data/access/resident-store'

/**
 * Has anybody written anything into this domain yet.
 *
 * **One rule, implemented twice, so both are asserted here side by side.**
 * `isWritten` answers it for the editor and `written` for admission, and both
 * had to change from three named fields to every declared one when
 * `expectedOutcome` landed. Neither had a test. A domain whose only filled
 * field was the new one would have read as **never started** — a gap on the
 * screen over a plan somebody had written, which is the Evidence Invariant
 * inverted: not a blank meaning two things, but a written record rendering as
 * a blank.
 *
 * Tested at the source rather than through a screen, because it is a one-line
 * rule and a render test would be asserting it through three other components.
 *
 * The cases run **both ways round the new field** on purpose. Only the first
 * was broken, and a test for only the broken direction is a test of the fix
 * rather than of the rule.
 */
describe('a domain counts as written if anything in it is', () => {
  const blank = (): CarePlanText =>
    Object.fromEntries(PLAN_FIELDS.map((field) => [field.id, ''])) as CarePlanText

  const filled = (): CarePlanText =>
    Object.fromEntries(
      PLAN_FIELDS.map((field) => [field.id, `Something for ${field.id}.`]),
    ) as CarePlanText

  /** Both implementations, named, so a failure says which one drifted. */
  const predicates = [
    ['isWritten, the editor’s', isWritten],
    ['written, admission’s', written],
  ] as const

  it.each(predicates)('%s says nothing written when every field is blank', (_, of) => {
    expect(of(blank())).toBe(false)
    // Whitespace is not writing. A space bar is not a care plan.
    expect(of({ ...blank(), expectedOutcome: '   ' })).toBe(false)
  })

  it.each(predicates)('%s says written when every field is filled', (_, of) => {
    expect(of(filled())).toBe(true)
  })

  /*
   * The case the change was made for: the expected outcome is the only thing
   * anybody has typed.
   */
  it.each(predicates)(
    '%s counts a domain whose only filled field is the outcome',
    (_, of) => {
      expect(
        of({ ...blank(), expectedOutcome: 'Walking to meals without a fall.' }),
      ).toBe(true)
    },
  )

  /*
   * And the reverse: the outcome is the only thing *missing*. This direction
   * was never broken, which is exactly why it is here — a rule covered only
   * where it failed is covered on one side.
   */
  it.each(predicates)(
    '%s counts a domain whose only blank field is the outcome',
    (_, of) => {
      expect(of({ ...filled(), expectedOutcome: '' })).toBe(true)
    },
  )

  /*
   * Over the declaration rather than a list of four. A fifth field added to
   * `PLAN_FIELDS` and forgotten in either predicate fails here without
   * anybody editing this file.
   */
  it.each(predicates)('%s reaches every declared field, one at a time', (_, of) => {
    for (const field of PLAN_FIELDS) {
      expect(of({ ...blank(), [field.id]: 'Written.' }), field.id).toBe(true)
    }
  })

  it('has both implementations agreeing, which is the only reason two are safe', () => {
    const cases: CarePlanText[] = [
      blank(),
      filled(),
      { ...blank(), expectedOutcome: 'Only the outcome.' },
      { ...filled(), expectedOutcome: '' },
      { ...blank(), currentNeeds: '  ' },
    ]
    for (const text of cases) {
      expect(written(text), JSON.stringify(text)).toBe(isWritten(text))
    }
  })
})
