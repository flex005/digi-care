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
 * **Every form is declared, none derived**, and the argument for that is the
 * plural rather than the capitalisation. "person supported" pluralises to
 * "people supported", which no `s` append reaches, and "next of kin" does not
 * pluralise at all — facts about English that no transform knows.
 *
 * The capitalisation used to carry the argument too, and it no longer does:
 * while these forms were title case, "Service Users" was not the naive
 * capitalise of "service users". **Sentence case made it one.** The claim is
 * recorded as retired rather than left standing, because a justification that
 * has quietly stopped holding is how the next person is persuaded of something
 * untrue. Capitalising a first letter is still not done at the call site — §8
 * records `.toLowerCase()` destroying a label twice, and the same transform
 * run the other way would title-case a term that must not be — but that is a
 * one-owner rule, not an impossibility proof.
 *
 * **The forms are sentence case**, matching `STAFF_ROLE_NAMES` ("Registered
 * manager") and the sidebar's section headings ("Planning and risk"). `label`
 * is title case and deliberately separate: it is the name somebody picks in
 * Settings, not a word in a sentence.
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
 * Which forms are plural, declared so a guard can read it.
 *
 * `check-plural-agreement.mjs` needs to know which properties of a `Term` are
 * plurals, and guessing from the name is the derivation this whole module
 * refuses. A form added later is plural when this says so.
 */
export const PLURAL_FORMS = ['many', 'Many'] as const

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
    term: withForms('service user', 'service users', 'Service user', 'Service users'),
  },
  {
    id: 'person_supported',
    label: 'Person Supported',
    term: withForms(
      'person supported',
      'people supported',
      'Person supported',
      'People supported',
    ),
  },
]

/**
 * The other eight terms a service may name differently.
 *
 * **Declared exactly as the subject is**, four forms each, because the two
 * cases that prove derivation impossible are both here: "Next of Kin" is
 * invariant — it is "Next of Kin" in the plural too — and "Care & Support
 * Plan" carries an ampersand no transform should ever touch.
 *
 * **A configurable word must never reach a proper noun**, and three kinds are
 * deliberately out of reach. **Statutory titles**: `STAFF_ROLE_NAMES` holds
 * 'Registered manager' and 'Deputy manager', CQC terms naming who is legally
 * accountable, and the permission system keys off those roles — the generic
 * word "manager" in prose is configurable, those names are not. **Published
 * instruments**: the Morse Fall Scale, the Waterlow Score and their question
 * wording belong to the scales. **Standard document names**: checked one at a
 * time rather than assumed — the MAR is safe to vary because "Medicines
 * Administration Record" is also real UK usage, which had to be established
 * rather than generalised from.
 */
export const TERM_IDS = [
  'subject',
  'carePlan',
  'staff',
  'manager',
  'admission',
  'incidentReport',
  'medication',
  'assessment',
  'family',
] as const

export type TermId = (typeof TERM_IDS)[number]

/** Every term in force at once. */
export type Vocabulary = Record<TermId, Term>

interface TermChoice {
  id: string
  label: string
  term: Term
}

/** The options offered per term. The first is that term's default. */
export const TERM_OPTIONS: Record<TermId, TermChoice[]> = {
  subject: SUBJECT_TERMS,
  carePlan: [
    {
      id: 'care_plan',
      label: 'Care Plan',
      term: withForms('care plan', 'care plans', 'Care plan', 'Care plans'),
    },
    {
      id: 'support_plan',
      label: 'Support Plan',
      term: withForms('support plan', 'support plans', 'Support plan', 'Support plans'),
    },
    {
      id: 'treatment_plan',
      label: 'Treatment Plan',
      term: withForms(
        'treatment plan',
        'treatment plans',
        'Treatment plan',
        'Treatment plans',
      ),
    },
    {
      id: 'care_and_support_plan',
      label: 'Care & Support Plan',
      term: withForms(
        'care & support plan',
        'care & support plans',
        'Care & support plan',
        'Care & support plans',
      ),
    },
  ],
  staff: [
    {
      id: 'staff',
      label: 'Staff',
      term: withForms('staff member', 'staff', 'Staff member', 'Staff'),
    },
    {
      id: 'care_staff',
      label: 'Care Staff',
      term: withForms(
        'care staff member',
        'care staff',
        'Care staff member',
        'Care staff',
      ),
    },
    {
      id: 'team_member',
      label: 'Team Member',
      term: withForms('team member', 'team members', 'Team member', 'Team members'),
    },
    {
      id: 'healthcare_professional',
      label: 'Healthcare Professional',
      term: withForms(
        'healthcare professional',
        'healthcare professionals',
        'Healthcare professional',
        'Healthcare professionals',
      ),
    },
  ],
  manager: [
    {
      id: 'manager',
      label: 'Manager',
      term: withForms('manager', 'managers', 'Manager', 'Managers'),
    },
    {
      id: 'care_manager',
      label: 'Care Manager',
      term: withForms('care manager', 'care managers', 'Care manager', 'Care managers'),
    },
    {
      id: 'clinical_manager',
      label: 'Clinical Manager',
      term: withForms(
        'clinical manager',
        'clinical managers',
        'Clinical manager',
        'Clinical managers',
      ),
    },
    {
      id: 'administrator',
      label: 'Administrator',
      term: withForms(
        'administrator',
        'administrators',
        'Administrator',
        'Administrators',
      ),
    },
  ],
  admission: [
    {
      id: 'admission',
      label: 'Admission',
      term: withForms('admission', 'admissions', 'Admission', 'Admissions'),
    },
    {
      id: 'intake',
      label: 'Intake',
      term: withForms('intake', 'intakes', 'Intake', 'Intakes'),
    },
    {
      id: 'placement',
      label: 'Placement',
      term: withForms('placement', 'placements', 'Placement', 'Placements'),
    },
    {
      id: 'registration',
      label: 'Registration',
      term: withForms('registration', 'registrations', 'Registration', 'Registrations'),
    },
  ],
  incidentReport: [
    {
      id: 'incident_report',
      label: 'Incident Report',
      term: withForms(
        'incident report',
        'incident reports',
        'Incident report',
        'Incident reports',
      ),
    },
    {
      id: 'incident_record',
      label: 'Incident Record',
      term: withForms(
        'incident record',
        'incident records',
        'Incident record',
        'Incident records',
      ),
    },
    {
      id: 'clinical_incident',
      label: 'Clinical Incident',
      term: withForms(
        'clinical incident',
        'clinical incidents',
        'Clinical incident',
        'Clinical incidents',
      ),
    },
  ],
  medication: [
    {
      id: 'medication',
      label: 'Medication',
      term: withForms('medication', 'medications', 'Medication', 'Medications'),
    },
    {
      id: 'medicines',
      label: 'Medicines',
      term: withForms('medicine', 'medicines', 'Medicine', 'Medicines'),
    },
    {
      id: 'medication_record',
      label: 'Medication Record',
      term: withForms(
        'medication record',
        'medication records',
        'Medication record',
        'Medication records',
      ),
    },
  ],
  assessment: [
    {
      id: 'assessment',
      label: 'Assessment',
      term: withForms('assessment', 'assessments', 'Assessment', 'Assessments'),
    },
    {
      id: 'clinical_assessment',
      label: 'Clinical Assessment',
      term: withForms(
        'clinical assessment',
        'clinical assessments',
        'Clinical assessment',
        'Clinical assessments',
      ),
    },
    {
      id: 'care_assessment',
      label: 'Care Assessment',
      term: withForms(
        'care assessment',
        'care assessments',
        'Care assessment',
        'Care assessments',
      ),
    },
  ],
  family: [
    {
      id: 'family',
      label: 'Family',
      term: withForms('family', 'families', 'Family', 'Families'),
    },
    /*
     * **Invariant in the plural.** "Next of Kin" is "Next of Kin" both ways,
     * and appending an s gives "Next of Kins", which nobody writes. The second
     * case proving these forms cannot be derived.
     */
    {
      id: 'next_of_kin',
      label: 'Next of Kin',
      term: withForms('next of kin', 'next of kin', 'Next of kin', 'Next of kin'),
    },
    {
      id: 'contact',
      label: 'Contact',
      term: withForms('contact', 'contacts', 'Contact', 'Contacts'),
    },
    {
      id: 'relative',
      label: 'Relative',
      term: withForms('relative', 'relatives', 'Relative', 'Relatives'),
    },
  ],
}

/**
 * Terms whose capitalised forms carry a capital after the first word.
 *
 * **Sentence case is this build's convention, and the vocabulary was the one
 * place that broke it.** `STAFF_ROLE_NAMES` reads "Registered manager" and
 * "Deputy manager"; the sidebar's section headings read "Care delivery" and
 * "Planning and risk". `One` and `Many` were written title case — "Care Plan",
 * "Service Users" — and nothing noticed, because the only term that existed
 * when the rule was set was "Resident", which is the same string either way.
 * A one-word term cannot distinguish the two conventions, so the first
 * multi-word term was the first case that could, and by then the shape was
 * already in place. §8's entry about a rule that was right for every case it
 * had met.
 *
 * This list is for a term that genuinely contains a proper noun — a product
 * name, a statutory title — where the inner capital is correct. **It is empty,
 * and that is the claim being made** rather than an omission: none of the
 * twenty-nine offered terms contains one. `vocabulary.test.ts` reads it in
 * both directions, so an entry that stops being needed fails as loudly as a
 * capital that was never declared.
 *
 * `label` is deliberately not covered. It is a name being chosen from a list
 * in Settings, not a word in a sentence, and the two fields exist separately
 * for exactly this reason: "Care & Support Plan" is the option somebody picks,
 * "Care & support plan" is what the heading then reads.
 */
export const TERMS_WITH_A_PROPER_NOUN: readonly string[] = []

/**
 * The terms whose plural really is the same word as their singular.
 *
 * **Declared, because nothing else can tell a correct invariant from a plural
 * somebody forgot.** "Next of Kin" is "Next of Kin" in the plural, and that is
 * a fact about English rather than about this list — so a check asking only
 * "does any plural equal its singular" cannot fire without a way to say which
 * ones are meant to.
 *
 * It exists because of a mutation: `care_assessment`'s plural was set to its
 * singular and **34 tests passed**, including the one asserting every term
 * declares every form. A form that is present and wrong is exactly what the
 * truthiness check cannot see, and this build would then have printed "252
 * care assessment" on the risk queue.
 *
 * Read bidirectionally by `vocabulary.test.ts`: a term invariant without being
 * named here fails, and a term named here that has a distinct plural fails
 * too, so an entry cannot go stale and keep excusing something.
 */
export const INVARIANT_PLURALS = ['next_of_kin'] as const

/**
 * **Discharge is deferred, and this is the reason rather than an oversight.**
 *
 * There is no discharge feature in this build. The word appears about 35
 * times and every one is prose inside a clinical question or recorded free
 * text — nothing a label change would reach. A term whose control changes
 * nothing visible is a dead control, so it waits for the feature. The crawl
 * treats a term reaching zero screens as a finding for the same reason.
 */
export const DEFERRED_TERMS = ['discharge'] as const

/** The vocabulary in force: each chosen option, or that term's default. */
export function vocabularyFor(
  type: OrganisationType,
  chosen: Partial<Record<TermId, string>>,
): Vocabulary {
  const out = {} as Vocabulary
  for (const id of TERM_IDS) {
    if (id === 'subject') {
      out.subject = subjectTerm(type, chosen.subject)
      continue
    }
    const options = TERM_OPTIONS[id]
    out[id] = options.find((entry) => entry.id === chosen[id])?.term ?? options[0]!.term
  }
  return out
}

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
