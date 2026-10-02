/**
 * What this organisation calls the person it holds records about.
 *
 * **This is the `pluralise` / `quantityWithUnit` / `formatAttributionOn`
 * class** (§6), and it goes wrong the same way: a word whose correct
 * rendering depends on where it appears cannot be rendered by whoever happens
 * to be appending it. "Resident" at the start of a sentence, inside one, as a
 * possessive and as a column heading are four different strings, and a caller
 * that takes one and transforms it will get one of the other three wrong. So
 * the caller asks for a form and this returns it. **Nothing downstream calls
 * `.toLowerCase()`, `.toUpperCase()` or appends an `s`.**
 *
 * **Every form is declared, none derived.** §8 records `.toLowerCase()`
 * destroying a label twice, and here derivation breaks outright rather than
 * subtly: "Service User" lowercases to "service user" correctly, and its
 * plural is "Service Users" — which no naive capitalise of "service users"
 * produces. A term that declares its own four forms cannot be wrong about any
 * of them.
 *
 * **Why this is safe to make configurable at all.** §10's test is whether a
 * record already stored says something different afterwards. It does not: a
 * care plan is the same care plan whether its heading reads Care Plan or
 * Treatment Plan, and **recorded free text is never touched** — a care note
 * that says "the resident was unsettled" goes on saying it, because those are
 * its author's words and not a label. So this is a claim about presentation,
 * not a term inside a claim the record makes, which is what separates it from
 * the settings §10 refuses.
 */

/** What kind of service this is. Picks the default term, and nothing else. */
export type OrganisationType = 'care_home' | 'hospital' | 'clinic'

export const ORGANISATION_TYPES: { id: OrganisationType; name: string }[] = [
  { id: 'care_home', name: 'Care Home' },
  { id: 'hospital', name: 'Hospital' },
  { id: 'clinic', name: 'Clinic' },
]

/**
 * The forms a caller may ask for. Six, taken from real strings in the build
 * rather than invented: every one of these is a sentence that exists today.
 */
export interface Term {
  /** Mid-sentence singular: "the resident’s own room" uses `one`. */
  one: string
  /** Mid-sentence plural: "of 32 residents". */
  many: string
  /** Sentence-initial, or a column heading: "Resident not recorded". */
  One: string
  /** Sentence-initial plural, or a tab label: "Residents". */
  Many: string
  /** Mid-sentence possessive: "held with the resident’s consent". */
  ones: string
  /** Sentence-initial possessive: "Resident’s own room". */
  Ones: string
}

/**
 * A curly apostrophe, matching what the rest of the build prints.
 *
 * Added here rather than at each call site for the same reason the forms are:
 * a caller writing `` `${term.one}'s` `` would get a straight quote, and the
 * difference is invisible in review and obvious on screen.
 */
function withForms(one: string, many: string, One: string, Many: string): Term {
  return { one, many, One, Many, ones: `${one}’s`, Ones: `${One}’s` }
}

/** The default each type carries. A default, never a lock. */
const DEFAULTS: Record<OrganisationType, Term> = {
  care_home: withForms('resident', 'residents', 'Resident', 'Residents'),
  hospital: withForms('patient', 'patients', 'Patient', 'Patients'),
  clinic: withForms('client', 'clients', 'Client', 'Clients'),
}

/**
 * Terms somebody may choose instead of their type's default.
 *
 * **Declared, not parsed.** A free-text term would need its plural and its
 * capitalisation guessed, which is the derivation this module exists to
 * refuse — "Service User" is the case that proves it. Offering a list keeps
 * every form declared by somebody who knows the word.
 */
export const SUBJECT_TERMS: { id: string; label: string; term: Term }[] = [
  { id: 'resident', label: 'Resident', term: DEFAULTS.care_home },
  { id: 'patient', label: 'Patient', term: DEFAULTS.hospital },
  { id: 'client', label: 'Client', term: DEFAULTS.clinic },
  {
    id: 'service_user',
    label: 'Service User',
    term: withForms('service user', 'service users', 'Service User', 'Service Users'),
  },
  {
    id: 'person_supported',
    label: 'Person Supported',
    term: withForms(
      'person supported',
      'people supported',
      'Person Supported',
      'People Supported',
    ),
  },
]

/**
 * The term in force: the chosen one, or this type's default.
 *
 * `subjectTermId` being unset is not a gap — it means nobody has overridden
 * the default, which is the ordinary state and renders as the default rather
 * than as anything missing.
 */
export function subjectTerm(
  type: OrganisationType,
  subjectTermId: string | undefined,
): Term {
  if (subjectTermId === undefined) return DEFAULTS[type]
  return (
    SUBJECT_TERMS.find((entry) => entry.id === subjectTermId)?.term ?? DEFAULTS[type]
  )
}
