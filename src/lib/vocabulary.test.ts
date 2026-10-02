import { describe, expect, it } from 'vitest'
import { SUBJECT_TERMS, subjectTerm, type OrganisationType } from './vocabulary'

/**
 * The term owner, and the derivations it exists to refuse.
 *
 * Every assertion here is about a form being **declared** rather than
 * computed, because the whole argument for this module is that computing them
 * is what goes wrong: §8 records `.toLowerCase()` destroying a label twice,
 * and a two-word term breaks the other direction too.
 */

describe('each type carries its own default', () => {
  it.each<[OrganisationType, string, string]>([
    ['care_home', 'resident', 'Residents'],
    ['hospital', 'patient', 'Patients'],
    ['clinic', 'client', 'Clients'],
  ])('%s defaults to %s', (type, one, Many) => {
    const term = subjectTerm(type, undefined)
    expect(term.one).toBe(one)
    expect(term.Many).toBe(Many)
  })

  it('treats an unknown chosen term as no choice rather than a gap', () => {
    // Not an error state: it means nobody has overridden the default.
    expect(subjectTerm('hospital', 'nothing_like_this').one).toBe('patient')
  })

  it('lets a type be overridden, because a default is not a lock', () => {
    expect(subjectTerm('clinic', 'service_user').One).toBe('Service User')
  })
})

/**
 * **The case that proves the forms cannot be derived.** "Service User"
 * lowercases to "service user" correctly, and its plural is "Service Users" —
 * which no capitalise of "service users" produces, because the second word
 * has to be capitalised too. A term that declares its four forms cannot be
 * wrong about any of them.
 */
describe('a two-word term is right in every form', () => {
  const term = subjectTerm('care_home', 'service_user')

  it('has its own plural rather than one with an s appended to the singular', () => {
    expect(term.one).toBe('service user')
    expect(term.many).toBe('service users')
    expect(term.One).toBe('Service User')
    expect(term.Many).toBe('Service Users')
  })

  it('capitalises both words, which deriving from the lower form would not', () => {
    const naive = term.many.charAt(0).toUpperCase() + term.many.slice(1)
    expect(naive).toBe('Service users')
    expect(term.Many).not.toBe(naive)
  })
})

describe('possessives come from the owner, never from the caller', () => {
  it.each(SUBJECT_TERMS.map((entry) => entry.id))(
    'gives %s a curly apostrophe',
    (id) => {
      const term = subjectTerm('care_home', id)
      expect(term.ones).toBe(`${term.one}’s`)
      expect(term.Ones).toBe(`${term.One}’s`)
      // A straight quote is the thing a call site would produce by hand.
      expect(term.ones).not.toContain("'")
    },
  )
})

describe('every offered term declares every form', () => {
  /*
   * A term added later with a missing form would render `undefined` on a
   * screen — the `Record<string, string>` defect §8 records, where a lookup
   * that cannot miss fails by printing nothing.
   */
  it.each(SUBJECT_TERMS)('$label is complete', ({ term }) => {
    for (const form of ['one', 'many', 'One', 'Many', 'ones', 'Ones'] as const) {
      expect(term[form]).toBeTruthy()
      expect(term[form]).not.toContain('undefined')
    }
  })

  it('never offers two terms under one id', () => {
    const ids = SUBJECT_TERMS.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
