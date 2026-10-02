import { describe, expect, it } from 'vitest'
import {
  DEFERRED_TERMS,
  INVARIANT_PLURALS,
  TERMS_WITH_A_PROPER_NOUN,
  SUBJECT_TERMS,
  TERM_IDS,
  TERM_OPTIONS,
  subjectTerm,
  vocabularyFor,
  type OrganisationType,
} from './vocabulary'
import { RISK_ASSESSMENT_TEMPLATES, STAFF_ROLE_NAMES } from '@/data/types'

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
    expect(subjectTerm('clinic', 'service_user').One).toBe('Service user')
  })
})

/**
 * **The cases that prove the forms cannot be derived — and the one that no
 * longer does.**
 *
 * This described "Service User" as the proof: its plural was "Service Users",
 * which no capitalise of "service users" produces, because the second word had
 * to be capitalised too. **Moving the vocabulary to sentence case took that
 * argument away.** "Service users" *is* the naive capitalise of "service
 * users", so for this term the capitalised forms became derivable, and the
 * assertion saying otherwise had to go rather than be quietly weakened.
 *
 * What survives is the half that was always the stronger one: **the plural**.
 * "person supported" pluralises to "people supported", which no `s` append
 * reaches, and "next of kin" does not pluralise at all. Those are facts about
 * English that no transform knows, and they are why the forms are declared.
 */
describe('a two-word term is right in every form', () => {
  const term = subjectTerm('care_home', 'service_user')

  it('has its own plural rather than one with an s appended to the singular', () => {
    expect(term.one).toBe('service user')
    expect(term.many).toBe('service users')
    expect(term.One).toBe('Service user')
    expect(term.Many).toBe('Service users')
  })

  it('pluralises the head noun, which appending an s would not', () => {
    const supported = subjectTerm('care_home', 'person_supported')
    expect(supported.one).toBe('person supported')
    expect(supported.many).toBe('people supported')
    // What a derivation would produce, and it is not a phrase anybody writes.
    expect(supported.many).not.toBe(`${supported.one}s`)
    expect(supported.Many).toBe('People supported')
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

/**
 * **A configurable word must never reach a proper noun.**
 *
 * Three kinds, each for its own reason, and each tempting because the generic
 * word is right there in the term list.
 */
describe('proper nouns stay out of reach of the vocabulary', () => {
  /*
   * "Registered manager" is a CQC term naming who is legally accountable for
   * the service, and the permission system keys off these roles. Routing it
   * through the Manager term would make the product misstate who carries
   * legal responsibility — and would do it silently, because the sentence
   * still reads like English.
   */
  it('leaves the statutory role titles alone under any vocabulary', () => {
    for (const choice of TERM_OPTIONS.manager) {
      void choice
      expect(STAFF_ROLE_NAMES.registered_manager).toBe('Registered manager')
      expect(STAFF_ROLE_NAMES.deputy_manager).toBe('Deputy manager')
    }
  })

  it('offers no manager option that could be mistaken for the statutory title', () => {
    const labels = TERM_OPTIONS.manager.map((entry) => entry.label)
    expect(labels).not.toContain('Registered Manager')
    expect(labels).not.toContain('Deputy Manager')
  })

  /*
   * The Morse Fall Scale and the Waterlow Score are published instruments.
   * "Assessment" as a label is this service's word; the name of a validated
   * scale is not, and neither is its question wording.
   */
  it('names published instruments from the templates, not from a term', () => {
    const named = RISK_ASSESSMENT_TEMPLATES.map((entry) => entry.name).join(' ')
    expect(named).toContain('Falls')
    for (const choice of TERM_OPTIONS.assessment) {
      // No assessment term's word appears inside an instrument's own name.
      expect(named.toLowerCase()).not.toContain(choice.term.one)
    }
  })
})

/**
 * The two terms that prove the forms are declared rather than derived, for a
 * second time — the subject's "Service User" was the first.
 */
describe('the awkward terms in the rest of the vocabulary', () => {
  const nextOfKin = TERM_OPTIONS.family.find(
    (entry) => entry.id === 'next_of_kin',
  )!.term

  it('keeps "Next of Kin" invariant in the plural', () => {
    expect(nextOfKin.one).toBe('next of kin')
    expect(nextOfKin.many).toBe('next of kin')
    expect(nextOfKin.Many).toBe('Next of kin')
    // Appending an s is what a derivation would do, and it is wrong.
    expect(nextOfKin.many).not.toBe('next of kins')
  })

  const andSupport = TERM_OPTIONS.carePlan.find(
    (entry) => entry.id === 'care_and_support_plan',
  )!.term

  it('carries the ampersand through every form of "Care & Support Plan"', () => {
    for (const form of [
      andSupport.one,
      andSupport.many,
      andSupport.One,
      andSupport.Many,
    ]) {
      expect(form).toContain('&')
      // Never an entity: this is text, and React escapes it on the way out.
      expect(form).not.toContain('&amp;')
    }
    expect(andSupport.Many).toBe('Care & support plans')
  })
})

describe('every term declares every form', () => {
  it.each(TERM_IDS)('%s is complete in all of its options', (id) => {
    for (const choice of TERM_OPTIONS[id]) {
      for (const form of ['one', 'many', 'One', 'Many', 'ones', 'Ones'] as const) {
        expect(choice.term[form], `${id}/${choice.id}/${form}`).toBeTruthy()
      }
    }
  })

  it('defaults every term when nothing has been chosen', () => {
    const all = vocabularyFor('care_home', {})
    expect(all.subject.one).toBe('resident')
    expect(all.carePlan.One).toBe('Care plan')
    expect(all.family.Many).toBe('Families')
  })

  it('defers discharge, and says so rather than omitting it', () => {
    // A term whose control changes nothing visible is a dead control.
    expect(DEFERRED_TERMS).toContain('discharge')
    expect(TERM_IDS).not.toContain('discharge')
  })
})

/**
 * A plural that is present and wrong, which truthiness cannot see.
 *
 * `every term declares every form` above asserts each form exists. A plural
 * set to its own singular satisfies that completely — `care_assessment` was
 * mutated that way and all 34 tests passed, which is the §8 class of an
 * assertion that cannot fail arriving through a check that was looking at
 * presence where the question was correctness.
 */
describe('a plural is a different word unless it is declared not to be', () => {
  const invariant = new Set<string>(INVARIANT_PLURALS)

  it.each(TERM_IDS)('%s has a distinct plural in every option', (id) => {
    for (const choice of TERM_OPTIONS[id]) {
      if (invariant.has(choice.id)) continue
      expect(choice.term.many, `${id}/${choice.id}`).not.toBe(choice.term.one)
      expect(choice.term.Many, `${id}/${choice.id}`).not.toBe(choice.term.One)
    }
  })

  /*
   * The other direction, so an entry cannot go stale and keep excusing a term
   * that has since been given a real plural — an exception list nobody checks
   * is how the §8 escape-comment failures start.
   */
  it('names only terms that are genuinely invariant', () => {
    for (const id of INVARIANT_PLURALS) {
      const choice = TERM_IDS.flatMap((term) => TERM_OPTIONS[term]).find(
        (entry) => entry.id === id,
      )
      expect(
        choice,
        `${id} is declared invariant and is not an offered term`,
      ).toBeTruthy()
      expect(choice!.term.many, id).toBe(choice!.term.one)
    }
  })
})

/**
 * Sentence case, which is this build's convention everywhere it can be checked.
 *
 * `STAFF_ROLE_NAMES` reads "Registered manager"; the sidebar's section
 * headings read "Care delivery" and "Planning and risk". The vocabulary was
 * written title case and nothing caught it, because "Resident" is the same
 * string in both and it was the only term there was. **A rule can only be
 * wrong once a case exists that distinguishes it**, and multi-word terms are
 * that case.
 */
describe('a capitalised form is sentence case, not title case', () => {
  const declared = new Set(TERMS_WITH_A_PROPER_NOUN)

  /** Every word after the first, for a form with more than one word. */
  const afterTheFirstWord = (form: string) => form.split(/\s+/).slice(1)

  it.each(TERM_IDS)('%s capitalises only its first word', (id) => {
    for (const choice of TERM_OPTIONS[id]) {
      if (declared.has(choice.id)) continue
      for (const form of [choice.term.One, choice.term.Many, choice.term.Ones]) {
        for (const word of afterTheFirstWord(form)) {
          expect(word, `${id}/${choice.id}: "${form}"`).toBe(word.toLowerCase())
        }
      }
    }
  })

  /*
   * The other direction, so the exception list cannot go stale and keep
   * excusing a term that has since lost its proper noun — the same shape as
   * INVARIANT_PLURALS, and for the same reason.
   */
  it('names only terms that really do carry an inner capital', () => {
    for (const id of TERMS_WITH_A_PROPER_NOUN) {
      const choice = TERM_IDS.flatMap((term) => TERM_OPTIONS[term]).find(
        (entry) => entry.id === id,
      )
      expect(choice, `${id} is declared and is not an offered term`).toBeTruthy()
      const capitalised = [choice!.term.One, choice!.term.Many].some((form) =>
        afterTheFirstWord(form).some((word) => word !== word.toLowerCase()),
      )
      expect(capitalised, `${id} has no inner capital and needs no exception`).toBe(
        true,
      )
    }
  })

  /*
   * The label is the other half of the decision and is asserted here so the
   * separation is a rule rather than a coincidence: the option somebody picks
   * in Settings is a name, and the word the heading renders is not.
   */
  it('leaves the Settings label in title case', () => {
    const plan = TERM_OPTIONS.carePlan.find((e) => e.id === 'care_and_support_plan')!
    expect(plan.label).toBe('Care & Support Plan')
    expect(plan.term.One).toBe('Care & support plan')
  })
})
