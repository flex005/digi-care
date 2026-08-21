/**
 * The 32 residents. PRD §5.2, §5.3.
 *
 * Generated deterministically from a fixed seed, then the ten deliberate gaps
 * from §5.3 are applied by name on top. **The fixtures are not tidy, and that
 * is the point** — every screen is built against messy data by default, so the
 * messy cases show up in review rather than in production. Nothing here is to
 * be cleaned up to make a screen look better.
 *
 * Names are clearly fictional and distinctly Nigerian, British and mixed,
 * reflecting the actual market.
 */

import type {
  Allergy,
  AllergyStatus,
  CarePlanDomainRecord,
  ConsentStatus,
  ConsentTypeId,
  EolcStatus,
  ImportantPeople,
  IsolationStatus,
  IsoDate,
  FuturePlans,
  Recorded,
  RecordedList,
  ResidentId,
  Resident,
  ResuscitationStatus,
  ReviewState,
  RiskStatus,
  RiskTemplateId,
  SiteId,
  StaffRef,
  SupportLevel,
} from '../types'
import { CARE_PLAN_DOMAINS, CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from '../types'
import {
  NOW,
  daysAgo,
  daysAhead,
  daysBetween,
  makeRandom,
  monthsAgo,
  toIsoDate,
  toIsoDateTime,
} from './generate'
import {
  carersAndSeniors,
  managers,
  staffDeactivated,
  staffHalloran,
  staffNwosu,
  staffOkonkwo,
} from './organisation'

const UNRECORDED = { kind: 'unrecorded' } as const

function recorded<T>(value: T, by: StaffRef, at: Date): Recorded<T> {
  return { kind: 'recorded', value, recordedBy: by, recordedAt: toIsoDateTime(at) }
}

const NOT_RECORDED_LIST = { kind: 'not_recorded' } as const

/**
 * A list in one of its three states.
 *
 * `soughtChance` decides whether anybody asked at all. If they did, an empty
 * result becomes `none_involved` — a positive claim with an author — rather
 * than an empty array, which would say nothing about whether anybody looked.
 */
function makeRecordedList<T>(
  rng: Rng,
  soughtChance: number,
  build: () => T[],
  by: StaffRef,
  at: Date,
): RecordedList<T> {
  if (!rng.chance(soughtChance)) return NOT_RECORDED_LIST
  const [first, ...rest] = build()
  if (first === undefined) {
    return { kind: 'none_involved', recordedBy: by, recordedAt: toIsoDateTime(at) }
  }
  return {
    kind: 'recorded',
    items: [first, ...rest],
    recordedBy: by,
    recordedAt: toIsoDateTime(at),
  }
}

// ---------------------------------------------------------------------------
// Content pools — realistic care content, never lorem. CLAUDE.md §6.
// ---------------------------------------------------------------------------

interface Person {
  id: string
  full: string
  preferred: string
  pronouns: string
}

const ROSEWOOD_PEOPLE: Person[] = [
  { id: 'okafor', full: 'Emmanuel Okafor', preferred: 'Emmanuel', pronouns: 'he/him' },
  {
    id: 'pemberton',
    full: 'Arthur Pemberton',
    preferred: 'Arthur',
    pronouns: 'he/him',
  },
  { id: 'adeyemi', full: 'Grace Adeyemi', preferred: 'Grace', pronouns: 'she/her' },
  {
    id: 'hutchinson',
    full: 'Beryl Hutchinson',
    preferred: 'Beryl',
    pronouns: 'she/her',
  },
  { id: 'nwachukwu', full: 'Adaeze Nwachukwu', preferred: 'Ada', pronouns: 'she/her' },
  { id: 'kavanagh', full: 'Doris Kavanagh', preferred: 'Doris', pronouns: 'she/her' },
  { id: 'obi', full: 'Chukwuemeka Obi', preferred: 'Emeka', pronouns: 'he/him' },
  { id: 'bello', full: 'Folasade Bello', preferred: 'Sade', pronouns: 'she/her' },
  { id: 'ashworth', full: 'Ronald Ashworth', preferred: 'Ron', pronouns: 'he/him' },
  { id: 'chukwu', full: 'Ngozi Chukwu', preferred: 'Ngozi', pronouns: 'she/her' },
  {
    id: 'braithwaite',
    full: 'Edith Braithwaite',
    preferred: 'Edie',
    pronouns: 'she/her',
  },
  { id: 'fashola', full: 'Olusegun Fashola', preferred: 'Segun', pronouns: 'he/him' },
  {
    id: 'castledine',
    full: 'Winifred Castledine',
    preferred: 'Winnie',
    pronouns: 'she/her',
  },
  { id: 'anyanwu', full: 'Ifeoma Anyanwu', preferred: 'Ify', pronouns: 'she/her' },
  { id: 'broadbent', full: 'Cyril Broadbent', preferred: 'Cyril', pronouns: 'he/him' },
  {
    id: 'ogunleye',
    full: 'Yetunde Ogunleye',
    preferred: 'Yetunde',
    pronouns: 'she/her',
  },
  { id: 'merrivale', full: 'Joan Merrivale', preferred: 'Joan', pronouns: 'she/her' },
  { id: 'salami', full: 'Babatunde Salami', preferred: 'Tunde', pronouns: 'he/him' },
  {
    id: 'pennington',
    full: 'Hilda Pennington',
    preferred: 'Hilda',
    pronouns: 'she/her',
  },
  { id: 'umeh', full: 'Chinyere Umeh', preferred: 'Chinyere', pronouns: 'she/her' },
  { id: 'kirkbride', full: 'Stanley Kirkbride', preferred: 'Stan', pronouns: 'he/him' },
  {
    id: 'ogundipe',
    full: 'Abimbola Ogundipe',
    preferred: 'Bimbo',
    pronouns: 'she/her',
  },
  { id: 'lonsdale', full: 'Vera Lonsdale', preferred: 'Vera', pronouns: 'she/her' },
  { id: 'amadi', full: 'Kelechi Amadi', preferred: 'Kelechi', pronouns: 'he/him' },
  { id: 'thorne', full: 'Reginald Thorne', preferred: 'Reg', pronouns: 'he/him' },
  { id: 'ezeh', full: 'Amara Ezeh', preferred: 'Amara', pronouns: 'she/her' },
  {
    id: 'gallagher',
    full: 'Maureen Gallagher',
    preferred: 'Maureen',
    pronouns: 'she/her',
  },
  { id: 'wilkinson', full: 'Harold Wilkinson', preferred: 'Harry', pronouns: 'he/him' },
]

const ASHGROVE_PEOPLE: Person[] = [
  { id: 'brennan', full: 'Nathaniel Brennan', preferred: 'Nat', pronouns: 'he/him' },
  { id: 'adigun', full: 'Oluwaseun Adigun', preferred: 'Seun', pronouns: 'she/her' },
  {
    id: 'hargreaves',
    full: 'Patricia Hargreaves',
    preferred: 'Pat',
    pronouns: 'she/her',
  },
  { id: 'sowande', full: 'Ismail Sowande', preferred: 'Ismail', pronouns: 'he/him' },
]

const DIAGNOSES = [
  'Alzheimer’s disease',
  'Vascular dementia',
  'Parkinson’s disease',
  'Chronic obstructive pulmonary disease',
  'Type 2 diabetes mellitus',
  'Congestive heart failure',
  'Osteoarthritis',
  'Stroke with left-sided weakness',
  'Chronic kidney disease, stage 3',
  'Rheumatoid arthritis',
]

const SECONDARY_DIAGNOSES = [
  'Hypertension',
  'Atrial fibrillation',
  'Hypothyroidism',
  'Macular degeneration',
  'Osteoporosis',
  'Depression',
  'Benign prostatic hyperplasia',
  'Recurrent urinary tract infections',
]

const ALLERGY_POOL: Allergy[] = [
  // The reaction describes what happens; the severity grades it. This one read
  // "Anaphylaxis · anaphylaxis" on every profile carrying it — the most common
  // allergy in these fixtures — because the reaction had been filled in with
  // the severity's own word.
  {
    substance: 'Penicillin',
    reaction: 'Throat swelling and collapse',
    severity: 'anaphylaxis',
  },
  { substance: 'Codeine', reaction: 'Nausea and confusion', severity: 'moderate' },
  { substance: 'Latex', reaction: 'Contact dermatitis', severity: 'mild' },
  { substance: 'Shellfish', reaction: 'Facial swelling', severity: 'severe' },
  { substance: 'Ibuprofen', reaction: 'Gastric bleeding', severity: 'severe' },
  { substance: 'Sulfonamides', reaction: 'Widespread rash', severity: 'moderate' },
]

const DIETS = [
  'Soft diet, level 5 minced and moist (IDDSI). Thickened fluids, level 2.',
  'Diabetic diet. No added sugar. Small portions, frequent snacks.',
  'Vegetarian. Dislikes mushrooms. Prefers a hot meal at midday.',
  'Halal. No pork or alcohol in cooking. Fortified milkshakes twice daily.',
  'Normal diet, cut up small. Needs prompting to finish meals.',
  'Gluten-free. Coeliac disease confirmed 2019.',
  'Pureed diet, level 4 (IDDSI), following speech and language therapy review.',
]

const LANGUAGES = ['English', 'English', 'English', 'Igbo', 'Yoruba', 'Polish', 'Welsh']

const COMMUNICATION_NEEDS = [
  'Hard of hearing on the left. Sit on his right and speak clearly, do not shout.',
  'Wears reading glasses, kept in the bedside drawer. Large print preferred.',
  'Understands more than she can say. Give time and use short sentences.',
  'Uses a communication board for meals and personal care choices.',
  'Speaks English and Igbo; reverts to Igbo when tired or distressed.',
  'Prefers written notes for anything important — hearing aid whistles.',
]

const RELIGIONS = [
  'Church of England',
  'Roman Catholic',
  'Pentecostal',
  'Muslim',
  'Methodist',
  'No religion',
  'Jewish',
]

const CULTURES = [
  'British',
  'Nigerian — Igbo',
  'Nigerian — Yoruba',
  'Irish',
  'British Caribbean',
  'Polish',
  'Welsh',
]

const GP_PRACTICES = [
  { name: 'Dr S. Achebe', practice: 'Rosewood Medical Centre' },
  { name: 'Dr H. Lindqvist', practice: 'Ashgrove Surgery' },
  { name: 'Dr P. Ramanathan', practice: 'Thornfield Health Partnership' },
  { name: 'Dr O. Balogun', practice: 'Eastgate Family Practice' },
]

const PHARMACIES = [
  { name: 'Thornfield Community Pharmacy' },
  { name: 'Ashgrove Dispensing Chemist' },
]

const RELATIONSHIPS = [
  'Daughter',
  'Son',
  'Niece',
  'Nephew',
  'Sister',
  'Brother',
  'Wife',
  'Husband',
]

const FAMILY_SURNAMES = [
  'Okafor',
  'Adeyemi',
  'Whitcombe',
  'Hargreaves',
  'Nwosu',
  'Bellamy',
  'Okonjo',
  'Fairhurst',
  'Adeleke',
  'Marsden',
  'Ibekwe',
  'Rowntree',
]
const FAMILY_FORENAMES = [
  'Chioma',
  'Daniel',
  'Ruth',
  'Olumide',
  'Sarah',
  'Ekene',
  'Margaret',
  'Tobias',
  'Ifeanyi',
  'Helen',
  'Adaeze',
  'Colin',
]

// ---------------------------------------------------------------------------
// Field generators
// ---------------------------------------------------------------------------

type Rng = ReturnType<typeof makeRandom>

function makeReviewState(rng: Rng, hasBeenDone: boolean): ReviewState {
  if (!hasBeenDone) return { kind: 'never_scheduled' }
  const roll = rng.int(1, 100)
  if (roll <= 55) {
    const completedOn = daysAgo(rng.int(5, 60))
    return {
      kind: 'completed',
      completedOn: toIsoDate(completedOn),
      completedBy: rng.pick(managers),
      // Next review dated from completion and comfortably ahead, which is
      // what a home that is keeping up looks like.
      nextDueOn: toIsoDate(daysAhead(rng.int(90, 240), completedOn)),
    }
  }
  if (roll <= 85)
    return { kind: 'scheduled', dueOn: toIsoDate(daysAhead(rng.int(7, 90))) }
  if (roll <= 95) return { kind: 'due', dueOn: toIsoDate(daysAhead(rng.int(0, 3))) }
  const dueOn = daysAgo(rng.int(4, 95))
  return {
    kind: 'overdue',
    dueOn: toIsoDate(dueOn),
    daysOverdue: daysBetween(dueOn, NOW),
  }
}

function makeRiskStatus(rng: Rng, assessedChance: number): RiskStatus {
  if (!rng.chance(assessedChance)) return { kind: 'not_assessed' }
  const level = rng.pick(['low', 'low', 'moderate', 'moderate', 'high'] as const)
  const assessedAt = daysAgo(rng.int(5, 200))
  return {
    kind: 'assessed',
    level,
    score:
      level === 'low'
        ? rng.int(0, 24)
        : level === 'moderate'
          ? rng.int(25, 44)
          : rng.int(45, 90),
    assessedAt: toIsoDateTime(assessedAt),
    assessedBy: rng.pick(managers),
    reviewState: makeReviewState(rng, true),
  }
}

function makeRisks(
  rng: Rng,
  assessedChance: number,
): Record<RiskTemplateId, RiskStatus> {
  const risks = {} as Record<RiskTemplateId, RiskStatus>
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    // Falls and pressure ulcer are assessed far more often in practice than
    // COSHH or environmental risk; the fixture reflects that so "not assessed"
    // shows up where it plausibly would.
    const weight = ['falls', 'pressure_ulcer', 'nutrition', 'choking'].includes(
      template.id,
    )
      ? assessedChance
      : assessedChance * 0.55
    risks[template.id] = makeRiskStatus(rng, weight)
  }
  return risks
}

function makeAllergies(rng: Rng): AllergyStatus {
  const roll = rng.int(1, 100)
  if (roll <= 14) return { kind: 'not_recorded' }
  const at = daysAgo(rng.int(10, 300))
  if (roll <= 52) {
    return {
      kind: 'none_known',
      recordedBy: rng.pick(managers),
      recordedAt: toIsoDateTime(at),
    }
  }
  const [first, ...rest] = rng.sample(ALLERGY_POOL, rng.int(1, 2))
  if (!first)
    return {
      kind: 'none_known',
      recordedBy: rng.pick(managers),
      recordedAt: toIsoDateTime(at),
    }
  return {
    kind: 'allergies',
    items: [first, ...rest],
    recordedBy: rng.pick(managers),
    recordedAt: toIsoDateTime(at),
  }
}

function makeResuscitation(rng: Rng): ResuscitationStatus {
  const roll = rng.int(1, 100)
  if (roll <= 18) return { kind: 'no_decision_recorded' }
  if (roll <= 60) {
    return {
      kind: 'dnar_in_place',
      signedBy: `${rng.pick(GP_PRACTICES).name}, GP`,
      signedOn: toIsoDate(daysAgo(rng.int(30, 500))),
      documentId: `doc-dnar-${rng.int(1000, 9999)}`,
    }
  }
  return {
    kind: 'for_resuscitation',
    recordedBy: rng.pick(managers),
    recordedAt: toIsoDateTime(daysAgo(rng.int(20, 400))),
  }
}

function makeEolc(rng: Rng): EolcStatus {
  const roll = rng.int(1, 100)
  if (roll <= 35) return { kind: 'not_recorded' }
  const at = daysAgo(rng.int(10, 300))
  if (roll <= 88) {
    return {
      kind: 'not_applicable',
      recordedBy: rng.pick(managers),
      recordedAt: toIsoDateTime(at),
    }
  }
  return {
    kind: 'in_place',
    startedOn: toIsoDate(at),
    recordedBy: rng.pick(managers),
    recordedAt: toIsoDateTime(at),
  }
}

function makeIsolation(rng: Rng): IsolationStatus {
  const roll = rng.int(1, 100)
  if (roll <= 30) return { kind: 'not_recorded' }
  const at = daysAgo(rng.int(1, 60))
  if (roll <= 93) {
    return {
      kind: 'not_isolating',
      recordedBy: rng.pick(carersAndSeniors),
      recordedAt: toIsoDateTime(at),
    }
  }
  return {
    kind: 'isolating',
    reason: rng.pick([
      'Suspected norovirus',
      'Confirmed influenza A',
      'Awaiting MRSA screening result',
    ]),
    since: toIsoDate(at),
    recordedBy: rng.pick(carersAndSeniors),
    recordedAt: toIsoDateTime(at),
  }
}

function makeSupportLevel(rng: Rng, assessed: boolean): SupportLevel {
  if (!assessed) return { kind: 'not_assessed' }
  return rng.pick([
    { kind: 'independent' },
    { kind: 'prompting_only' },
    { kind: 'prompting_only' },
    { kind: 'partial_assistance' },
    { kind: 'partial_assistance' },
    { kind: 'full_assistance' },
  ] as const)
}

const DOMAIN_SUMMARIES: Record<string, string[]> = {
  personal_care: [
    'I like to wash at the sink in the morning and prefer a shower on Tuesdays and Fridays.',
    'I need support with my back and feet but I can manage my face and hands myself.',
  ],
  nutrition: [
    'I eat better when someone sits with me. I do not like being rushed.',
    'I take my main meal at midday and only want a light supper.',
  ],
  mobility: [
    'I use my frame indoors and a wheelchair for longer distances. Two staff for transfers.',
    'I can walk to the dining room if someone walks beside me.',
  ],
  continence: [
    'I manage with prompting every two hours. I would rather ask than be asked.',
    'I need help at night. Continence products are in the wardrobe.',
  ],
  communication: [
    'Speak to my right side. I understand everything, I just cannot always find the word.',
    'I like to be called by my first name, not Mr.',
  ],
  cognitive: [
    'I get muddled in the late afternoon. A familiar face and a cup of tea settles me.',
    'I know where I am in the morning. By evening I sometimes think I am at home.',
  ],
  social_emotional: [
    'I like company but not crowds. I enjoy the gardening group.',
    'I miss my late partner. I like to talk about them and I do not want that avoided.',
  ],
  end_of_life: [
    'I want to stay here. I do not want to go back into hospital.',
    'My family should be called straight away and my pastor after that.',
  ],
  physical_health: [
    'My chest is worse in cold weather. I use my inhaler before I get up.',
    'My blood sugar is checked twice a day and I like to see the reading.',
  ],
  medication: [
    'I take my tablets with yoghurt. I cannot swallow them with water.',
    'I want to know what each tablet is for before I take it.',
  ],
}

function makeCarePlan(rng: Rng, completeness: number): CarePlanDomainRecord[] {
  return CARE_PLAN_DOMAINS.map((domain) => {
    const roll = rng.int(1, 100)
    const started = roll <= completeness
    if (!started) {
      return {
        domainId: domain.id,
        status: { kind: 'not_started' },
        supportLevel: { kind: 'not_assessed' },
        summary: '',
      }
    }
    const finalisedOn = daysAgo(rng.int(20, 300))
    // 4% of domains are genuinely past their review date. Higher than that and
    // "Review Due" stops meaning anything, which is the failure mode the Stale
    // state exists to catch.
    const nextReviewOn = rng.chance(0.04)
      ? daysAgo(rng.int(3, 90))
      : daysAhead(rng.int(20, 240))
    const overdue = nextReviewOn < NOW
    const summaries = DOMAIN_SUMMARIES[domain.id] ?? []
    return {
      domainId: domain.id,
      status: overdue
        ? {
            kind: 'review_due',
            finalisedBy: rng.pick(managers),
            finalisedOn: toIsoDate(finalisedOn),
            dueOn: toIsoDate(nextReviewOn),
            daysOverdue: daysBetween(nextReviewOn, NOW),
          }
        : {
            kind: 'complete',
            finalisedBy: rng.pick(managers),
            finalisedOn: toIsoDate(finalisedOn),
            nextReviewOn: toIsoDate(nextReviewOn),
          },
      supportLevel: makeSupportLevel(rng, true),
      summary: summaries.length > 0 ? rng.pick(summaries) : '',
    }
  })
}

function makeConsents(
  rng: Rng,
  soughtChance: number,
): Record<ConsentTypeId, ConsentStatus> {
  const consents = {} as Record<ConsentTypeId, ConsentStatus>
  for (const type of CONSENT_TYPES) {
    if (!rng.chance(soughtChance)) {
      consents[type.id] = { kind: 'not_sought' }
      continue
    }
    const roll = rng.int(1, 100)
    const on = toIsoDate(daysAgo(rng.int(20, 500)))
    if (roll <= 60) {
      consents[type.id] = {
        kind: 'consented',
        method: rng.pick(['written', 'verbal', 'digital_signature'] as const),
        on,
        by: rng.pick(managers),
      }
    } else if (roll <= 72) {
      consents[type.id] = {
        kind: 'pending',
        requestedOn: toIsoDate(daysAgo(rng.int(2, 30))),
        requestedBy: rng.pick(managers),
      }
    } else if (roll <= 82) {
      consents[type.id] = {
        kind: 'refused',
        on,
        note: 'Declined after discussion with family.',
        recordedBy: rng.pick(managers),
      }
    } else {
      consents[type.id] = {
        kind: 'best_interest',
        decidedOn: on,
        consulted: ['Dr S. Achebe', 'Next of kin', 'Senior carer on duty'],
        rationale:
          'Lacks capacity for this decision; agreed as being in their best interests.',
        decidedBy: staffOkonkwo,
      }
    }
  }
  return consents
}

function makeImportantPeople(rng: Rng, richness: number): ImportantPeople {
  const person = (isPrimary: boolean) => ({
    name: `${rng.pick(FAMILY_FORENAMES)} ${rng.pick(FAMILY_SURNAMES)}`,
    relationship: rng.pick(RELATIONSHIPS),
    contact: {
      phone: `07${rng.int(100, 999)} ${rng.int(100000, 999999)}`,
      email: 'family@example.invalid',
    },
    address: `${rng.int(1, 90)} ${rng.pick(['Elm', 'Chapel', 'Station', 'Mill', 'Orchard'])} ${rng.pick(['Road', 'Lane', 'Street'])}, Thornfield`,
    isPrimaryContact: isPrimary,
    communicationPreference: rng.chance(0.7)
      ? recorded(
          {
            method: rng.pick(['phone', 'email', 'letter', 'in_person'] as const),
            language: rng.pick(['English', 'English', 'Igbo', 'Yoruba']),
          },
          rng.pick(managers),
          daysAgo(rng.int(30, 300)),
        )
      : UNRECORDED,
  })

  return {
    nextOfKin: rng.chance(richness)
      ? recorded(person(true), rng.pick(managers), daysAgo(60))
      : UNRECORDED,
    emergencyContact: rng.chance(richness * 0.7)
      ? recorded(person(false), rng.pick(managers), daysAgo(60))
      : UNRECORDED,
    lpaHolder: rng.chance(richness * 0.45)
      ? recorded(
          {
            ...person(false),
            lpaType: rng.pick(['health_and_welfare', 'financial'] as const),
            documentId: `doc-lpa-${rng.int(1000, 9999)}`,
          },
          staffOkonkwo,
          daysAgo(120),
        )
      : UNRECORDED,
    socialWorker: rng.chance(richness * 0.6)
      ? recorded(
          {
            name: `${rng.pick(FAMILY_FORENAMES)} ${rng.pick(FAMILY_SURNAMES)}`,
            localAuthority: 'Thornfield Metropolitan Borough Council',
            contact: {
              phone: `0161 ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
              email: 'asc@example.invalid',
            },
            reviewState: makeReviewState(rng, true),
            communicationPreference: recorded(
              { method: 'email', language: 'English' },
              staffOkonkwo,
              daysAgo(90),
            ),
          },
          staffOkonkwo,
          daysAgo(90),
        )
      : UNRECORDED,
    advocate: rng.chance(richness * 0.2)
      ? recorded(person(false), staffOkonkwo, daysAgo(150))
      : UNRECORDED,
    familyWithVisitingRights: makeRecordedList(
      rng,
      richness,
      () => Array.from({ length: rng.int(0, 2) }, () => person(false)),
      rng.pick(managers),
      daysAgo(rng.int(30, 300)),
    ),
    otherProfessionals: makeRecordedList(
      rng,
      richness * 0.9,
      () =>
        Array.from({ length: rng.int(0, 3) }, () => ({
          name: `${rng.pick(FAMILY_FORENAMES)} ${rng.pick(FAMILY_SURNAMES)}`,
          role: rng.pick([
            'Occupational therapist',
            'Physiotherapist',
            'Dietitian',
            'Speech and language therapist',
            'Community psychiatric nurse',
          ]),
          organisation: 'Thornfield Community Health',
          contact: {
            phone: `0161 ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
            email: 'chs@example.invalid',
          },
        })),
      rng.pick(managers),
      daysAgo(rng.int(30, 300)),
    ),
  }
}

function makeFuturePlans(
  rng: Rng,
  resuscitation: ResuscitationStatus,
  richness: number,
): FuturePlans {
  const signed = <T>(value: T, version = 1) =>
    recorded(
      {
        value,
        signedBy: rng.pick(managers),
        signedOn: toIsoDate(daysAgo(rng.int(30, 400))),
        version,
      },
      rng.pick(managers),
      daysAgo(rng.int(30, 400)),
    )

  return {
    preferredPlaceOfCare: rng.chance(richness * 0.7)
      ? signed(rng.pick(['Here at the home', 'Hospice', 'Home with family']))
      : UNRECORDED,
    preferredPlaceOfDeath: rng.chance(richness * 0.55)
      ? signed(rng.pick(['Here at the home', 'Hospice', 'Not hospital']))
      : UNRECORDED,
    resuscitation,
    advanceCarePlan: rng.chance(richness * 0.5)
      ? signed(
          'I do not want to go back into hospital. I want to stay where people know me.',
        )
      : UNRECORDED,
    adrt: rng.chance(richness * 0.25)
      ? signed({
          text: 'Refuses artificial ventilation and CPR.',
          documentId: `doc-adrt-${rng.int(1000, 9999)}`,
        })
      : UNRECORDED,
    funeralPreferences: rng.chance(richness * 0.4)
      ? signed(
          rng.pick([
            'Burial, plot already purchased',
            'Cremation, no service',
            'Church service then cremation',
          ]),
        )
      : UNRECORDED,
    religiousPreferences: rng.chance(richness * 0.45)
      ? signed(
          rng.pick([
            'Pastor to be called before the family',
            'Last rites requested',
            'Imam to be called; burial within 24 hours',
          ]),
        )
      : UNRECORDED,
    contactOnDeath: rng.chance(richness * 0.5)
      ? signed('Next of kin first, then the GP practice.')
      : UNRECORDED,
  }
}

// ---------------------------------------------------------------------------
// Residents
// ---------------------------------------------------------------------------

function makeResident(person: Person, siteId: SiteId, index: number): Resident {
  const rng = makeRandom(0x51d1ca2e + index * 7919)
  const admittedOn = daysAgo(rng.int(40, 1500))
  const dob = new Date(NOW)
  dob.setFullYear(dob.getFullYear() - rng.int(68, 96))
  dob.setMonth(rng.int(0, 11))
  dob.setDate(rng.int(1, 28))

  // Ashgrove is deliberately thin — that is what makes its Key Questions
  // render Insufficient Evidence in Phase 12. PRD §5.3.
  const thin = siteId === 'site-ashgrove-lodge'
  const richness = thin ? 0.4 : 0.93
  const assessedChance = thin ? 0.35 : 0.89

  const resuscitation = makeResuscitation(rng)
  const gp = rng.pick(GP_PRACTICES)

  return {
    id: `res-${person.id}` as ResidentId,
    siteId,
    fullLegalName: person.full,
    preferredName: person.preferred,
    dateOfBirth: toIsoDate(dob),
    admittedOn: toIsoDate(admittedOn),

    // No resident has a photograph on file yet. The union is real, so the
    // moment images arrive the on_file branch lights up with no code change.
    photo: { kind: 'not_on_file' },

    pronouns: rng.chance(richness)
      ? recorded(person.pronouns, rng.pick(managers), admittedOn)
      : UNRECORDED,
    nhsNumber: rng.chance(richness)
      ? recorded(
          `${rng.int(400, 799)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,
    room: recorded(
      `${rng.int(1, 4)}${`${rng.int(1, 20)}`.padStart(2, '0')}`,
      rng.pick(managers),
      admittedOn,
    ),
    anticipatedLengthOfStay: rng.chance(richness * 0.6)
      ? recorded(
          rng.pick([
            'Permanent placement',
            'Respite — 4 weeks',
            'Permanent, under review at 6 months',
          ]),
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,
    fundingSource: rng.chance(richness)
      ? recorded(
          rng.pick([
            'local_authority',
            'nhs_continuing_care',
            'self_funded',
            'insurance',
          ] as const),
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,

    allergies: makeAllergies(rng),
    primaryDiagnosis: rng.chance(richness)
      ? recorded(rng.pick(DIAGNOSES), rng.pick(managers), admittedOn)
      : UNRECORDED,
    secondaryDiagnoses: makeRecordedList(
      rng,
      richness * 0.9,
      // Zero is a real outcome here: plenty of residents genuinely have no
      // secondary diagnosis, and that is a different fact from nobody asking.
      () => rng.sample(SECONDARY_DIAGNOSES, rng.int(0, 3)),
      rng.pick(managers),
      admittedOn,
    ),
    medicalHistory: rng.chance(richness * 0.7)
      ? recorded(
          'Admitted following a fall at home and a short hospital stay. Mobility has declined gradually since.',
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,

    risks: makeRisks(rng, assessedChance),
    resuscitation,
    eolc: makeEolc(rng),
    isolation: makeIsolation(rng),

    gp: rng.chance(richness)
      ? recorded(
          {
            name: gp.name,
            practice: gp.practice,
            contact: {
              phone: `0161 ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
              email: 'surgery@example.invalid',
            },
          },
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,
    pharmacy: rng.chance(richness * 0.8)
      ? recorded(
          {
            name: rng.pick(PHARMACIES).name,
            contact: {
              phone: `0161 ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
              email: 'pharmacy@example.invalid',
            },
          },
          rng.pick(managers),
          admittedOn,
        )
      : UNRECORDED,
    consultants: makeRecordedList(
      rng,
      richness * 0.85,
      () =>
        Array.from({ length: rng.int(0, 2) }, () => ({
          name: `Dr ${rng.pick(FAMILY_SURNAMES)}`,
          role: rng.pick([
            'Consultant geriatrician',
            'Consultant cardiologist',
            'Old age psychiatrist',
          ]),
          organisation: 'Thornfield General Hospital',
          contact: {
            phone: `0161 ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
            email: 'secretary@example.invalid',
          },
        })),
      rng.pick(managers),
      admittedOn,
    ),

    primaryLanguage: rng.chance(richness)
      ? recorded(rng.pick(LANGUAGES), rng.pick(managers), admittedOn)
      : UNRECORDED,
    communicationNeeds: rng.chance(richness * 0.75)
      ? recorded(
          rng.pick(COMMUNICATION_NEEDS),
          rng.pick(carersAndSeniors),
          daysAgo(rng.int(10, 200)),
        )
      : UNRECORDED,
    religion: rng.chance(richness * 0.8)
      ? recorded(rng.pick(RELIGIONS), rng.pick(managers), admittedOn)
      : UNRECORDED,
    culturalBackground: rng.chance(richness * 0.7)
      ? recorded(rng.pick(CULTURES), rng.pick(managers), admittedOn)
      : UNRECORDED,
    dietaryRequirements: rng.chance(richness * 0.9)
      ? recorded(rng.pick(DIETS), rng.pick(carersAndSeniors), daysAgo(rng.int(10, 250)))
      : UNRECORDED,

    importantPeople: makeImportantPeople(rng, richness),
    futurePlans: makeFuturePlans(rng, resuscitation, richness),
    carePlan: makeCarePlan(rng, thin ? 45 : 82),
    consents: makeConsents(rng, thin ? 0.4 : 0.85),
    carePlanReview: makeReviewState(rng, rng.chance(richness)),
  }
}

const generated: Resident[] = [
  ...ROSEWOOD_PEOPLE.map((person, index) =>
    makeResident(person, 'site-rosewood-court', index),
  ),
  ...ASHGROVE_PEOPLE.map((person, index) =>
    makeResident(person, 'site-ashgrove-lodge', index + 100),
  ),
]

// ---------------------------------------------------------------------------
// PRD §5.3 — the ten deliberate gaps, applied by name.
//
// These are not decoration and they are not to be tidied away. Each one is a
// test that a specific screen cannot quietly pass. The Fixture Audit panel on
// /dev/states asserts every one of them is still present.
// ---------------------------------------------------------------------------

function patch(id: string, change: (resident: Resident) => Resident): void {
  const index = generated.findIndex((resident) => resident.id === `res-${id}`)
  const existing = generated[index]
  if (index < 0 || !existing)
    throw new Error(`Fixture patch target res-${id} does not exist`)
  generated[index] = change(existing)
}

/** Gap 1 — no falls risk assessment ever completed. The header must not read
 *  as safe. Beryl also has pressure ulcer risk unassessed, so the profile
 *  shows more than one hole. */
patch('hutchinson', (resident) => ({
  ...resident,
  risks: {
    ...resident.risks,
    falls: { kind: 'not_assessed' },
    pressure_ulcer: { kind: 'not_assessed' },
  },
}))

/** Gap 2 — no resuscitation decision recorded, alongside one DNAR in place
 *  and one explicitly for resuscitation. Three residents, three states. */
patch('pemberton', (resident) => ({
  ...resident,
  resuscitation: { kind: 'no_decision_recorded' },
  futurePlans: {
    ...resident.futurePlans,
    resuscitation: { kind: 'no_decision_recorded' },
  },
}))

const okaforDnar: ResuscitationStatus = {
  kind: 'dnar_in_place',
  signedBy: 'Dr S. Achebe, GP',
  signedOn: toIsoDate(daysAgo(180)),
  documentId: 'doc-dnar-0041',
}
patch('okafor', (resident) => ({
  ...resident,
  resuscitation: okaforDnar,
  futurePlans: { ...resident.futurePlans, resuscitation: okaforDnar },
  // The running example in the source PRD — kept complete enough to be the
  // Populated state, with the medication gaps applied in medications.ts.
  allergies: {
    kind: 'allergies',
    items: [ALLERGY_POOL[0] as Allergy],
    recordedBy: staffOkonkwo,
    recordedAt: toIsoDateTime(daysAgo(200)),
  } satisfies AllergyStatus,
  room: recorded('14', staffOkonkwo, daysAgo(400)),
}))

const adeyemiForResus: ResuscitationStatus = {
  kind: 'for_resuscitation',
  recordedBy: staffOkonkwo,
  recordedAt: toIsoDateTime(daysAgo(120)),
}
patch('adeyemi', (resident) => ({
  ...resident,
  resuscitation: adeyemiForResus,
  futurePlans: { ...resident.futurePlans, resuscitation: adeyemiForResus },
}))

/** Gap 3 — admitted yesterday, almost nothing filled in. The Partial state
 *  incarnate: a real resident about whom almost nothing is yet known, which
 *  must never render as a resident with nothing wrong. */
patch('sowande', (resident) => ({
  ...resident,
  admittedOn: toIsoDate(daysAgo(1)),
  allergies: { kind: 'not_recorded' },
  resuscitation: { kind: 'no_decision_recorded' },
  eolc: { kind: 'not_recorded' },
  isolation: { kind: 'not_recorded' },
  pronouns: UNRECORDED,
  nhsNumber: UNRECORDED,
  fundingSource: UNRECORDED,
  anticipatedLengthOfStay: UNRECORDED,
  primaryDiagnosis: UNRECORDED,
  secondaryDiagnoses: NOT_RECORDED_LIST,
  medicalHistory: UNRECORDED,
  gp: UNRECORDED,
  pharmacy: UNRECORDED,
  consultants: NOT_RECORDED_LIST,
  primaryLanguage: UNRECORDED,
  communicationNeeds: UNRECORDED,
  religion: UNRECORDED,
  culturalBackground: UNRECORDED,
  dietaryRequirements: UNRECORDED,
  risks: Object.fromEntries(
    RISK_ASSESSMENT_TEMPLATES.map((template) => [
      template.id,
      { kind: 'not_assessed' },
    ]),
  ) as Record<RiskTemplateId, RiskStatus>,
  carePlan: CARE_PLAN_DOMAINS.map((domain) => ({
    domainId: domain.id,
    status: { kind: 'not_started' } as const,
    supportLevel: { kind: 'not_assessed' } as const,
    summary: '',
  })),
  consents: Object.fromEntries(
    CONSENT_TYPES.map((type) => [type.id, { kind: 'not_sought' }]),
  ) as Record<ConsentTypeId, ConsentStatus>,
  carePlanReview: { kind: 'never_scheduled' },
  importantPeople: {
    ...resident.importantPeople,
    lpaHolder: UNRECORDED,
    socialWorker: UNRECORDED,
    advocate: UNRECORDED,
    familyWithVisitingRights: NOT_RECORDED_LIST,
    otherProfessionals: NOT_RECORDED_LIST,
  },
}))

/** Gap 6 — withdrawn photography consent with existing photos still on file.
 *  The downstream-effects case: withdrawing consent does not retroactively
 *  delete what was taken while it was given. */
patch('brennan', (resident) => ({
  ...resident,
  consents: {
    ...resident.consents,
    photography: {
      kind: 'withdrawn',
      on: toIsoDate(daysAgo(28)),
      note: 'Family requested removal. 14 photographs remain on file and in the Family Portal.',
      previouslyConsentedOn: toIsoDate(daysAgo(420)),
      recordedBy: staffOkonkwo,
    },
  },
}))

/** Gap 7 — a care plan domain finalised 14 months ago and never reviewed.
 *  The Stale state: complete, signed, and long out of date. */
const fourteenMonthsAgo = monthsAgo(14)
const reviewWasDue = monthsAgo(2)
patch('adeyemi', (resident) => ({
  ...resident,
  carePlan: resident.carePlan.map((domain) =>
    domain.domainId === 'mobility'
      ? {
          ...domain,
          status: {
            kind: 'review_due' as const,
            finalisedBy: staffHalloran,
            finalisedOn: toIsoDate(fourteenMonthsAgo),
            dueOn: toIsoDate(reviewWasDue),
            daysOverdue: daysBetween(reviewWasDue, NOW),
          },
          supportLevel: { kind: 'partial_assistance' as const },
          summary: 'I can walk to the dining room if someone walks beside me.',
        }
      : domain,
  ),
}))

/** Gap 9 — Ashgrove thin enough that Key Questions render Insufficient
 *  Evidence. Enforced by the `thin` branch in makeResident and asserted by
 *  the Fixture Audit rather than left to chance. */

/**
 * Coverage for the three-state lists.
 *
 * Every `RecordedList` field must have at least one resident in each of its
 * three states, or a screen built on it is reviewed against two thirds of the
 * shape. The generator makes all three likely; these patches make them
 * certain, and `fixtures.test.ts` asserts it rather than trusting the odds.
 *
 * `none_involved` is the one that would otherwise go missing, and it is the
 * whole reason the type exists — "we asked, there is nobody" is a positive
 * claim, not an absence.
 */
const listCoverageAuthor = staffOkonkwo
const listCoverageAt = toIsoDateTime(daysAgo(45))

patch('adeyemi', (resident) => ({
  ...resident,
  // All four lists answered, and the answer is "none".
  secondaryDiagnoses: {
    kind: 'none_involved',
    recordedBy: listCoverageAuthor,
    recordedAt: listCoverageAt,
  },
  consultants: {
    kind: 'none_involved',
    recordedBy: listCoverageAuthor,
    recordedAt: listCoverageAt,
  },
  importantPeople: {
    ...resident.importantPeople,
    familyWithVisitingRights: {
      kind: 'none_involved',
      recordedBy: listCoverageAuthor,
      recordedAt: listCoverageAt,
    },
    otherProfessionals: {
      kind: 'none_involved',
      recordedBy: listCoverageAuthor,
      recordedAt: listCoverageAt,
    },
  },
}))

patch('okafor', (resident) => ({
  ...resident,
  // All four lists answered, and the answer is a real list.
  secondaryDiagnoses: {
    kind: 'recorded',
    items: ['Hypertension', 'Atrial fibrillation'],
    recordedBy: listCoverageAuthor,
    recordedAt: listCoverageAt,
  },
  consultants: {
    kind: 'recorded',
    items: [
      {
        name: 'Dr I. Farooq',
        role: 'Consultant geriatrician',
        organisation: 'Thornfield General Hospital',
        contact: { phone: '0161 413 3366', email: 'secretary@example.invalid' },
      },
    ],
    recordedBy: listCoverageAuthor,
    recordedAt: listCoverageAt,
  },
  importantPeople: {
    ...resident.importantPeople,
    familyWithVisitingRights: {
      kind: 'recorded',
      items: [
        {
          name: 'Grace Adeyemi',
          relationship: 'Daughter',
          contact: { phone: '07678 478100', email: 'family@example.invalid' },
          address: '12 Chapel Road, Thornfield',
          isPrimaryContact: false,
          communicationPreference: {
            kind: 'recorded',
            value: { method: 'phone', language: 'English' },
            recordedBy: listCoverageAuthor,
            recordedAt: listCoverageAt,
          },
        },
      ],
      recordedBy: listCoverageAuthor,
      recordedAt: listCoverageAt,
    },
    otherProfessionals: {
      kind: 'recorded',
      items: [
        {
          name: 'Helen Rowntree',
          role: 'Speech and language therapist',
          organisation: 'Thornfield Community Health',
          contact: { phone: '0161 204 7781', email: 'chs@example.invalid' },
        },
      ],
      recordedBy: listCoverageAuthor,
      recordedAt: listCoverageAt,
    },
  },
}))

// res-sowande already carries `not_recorded` on all four — admitted yesterday,
// nobody has asked anything yet.

/**
 * One resident with an entirely settled risk picture.
 *
 * The residents list claims "All assessed — no flags" when nothing is
 * unrecorded and nothing needs attention. If no resident is ever in that
 * state the claim is dead code — and it went dead once already, silently,
 * when a change elsewhere shifted the generator's random stream. So it is
 * pinned rather than left to probability, and `fixtures.test.ts` asserts it.
 *
 * The reassuring case has to exist for the same reason the alarming ones do:
 * a screen reviewed only against gaps is a screen nobody has seen working.
 */
patch('broadbent', (resident) => ({
  ...resident,
  risks: {
    ...resident.risks,
    falls: {
      kind: 'assessed',
      level: 'low',
      score: 10,
      assessedAt: toIsoDateTime(daysAgo(40)),
      assessedBy: staffOkonkwo,
      reviewState: { kind: 'scheduled', dueOn: toIsoDate(daysAhead(140)) },
    },
    choking: {
      kind: 'assessed',
      level: 'low',
      score: 5,
      assessedAt: toIsoDateTime(daysAgo(40)),
      assessedBy: staffOkonkwo,
      reviewState: { kind: 'scheduled', dueOn: toIsoDate(daysAhead(140)) },
    },
  },
  allergies: {
    kind: 'none_known',
    recordedBy: staffOkonkwo,
    recordedAt: toIsoDateTime(daysAgo(40)),
  },
  resuscitation: {
    kind: 'for_resuscitation',
    recordedBy: staffOkonkwo,
    recordedAt: toIsoDateTime(daysAgo(40)),
  },
}))

export const residents: Resident[] = generated

export const residentsBySite = (siteId: SiteId): Resident[] =>
  residents.filter((resident) => resident.siteId === siteId)

export function residentById(id: ResidentId): Resident | undefined {
  return residents.find((resident) => resident.id === id)
}

/** Exported so the Fixture Audit can name the resident carrying each gap. */
export const GAP_RESIDENTS = {
  noFallsAssessment: 'res-hutchinson',
  noResuscitationDecision: 'res-pemberton',
  dnarInPlace: 'res-okafor',
  forResuscitation: 'res-adeyemi',
  admittedYesterday: 'res-sowande',
  medicationOmissions: 'res-okafor',
  controlledDrugDiscrepancy: 'res-okafor',
  withdrawnPhotographyConsent: 'res-brennan',
  staleCarePlanDomain: 'res-adeyemi',
  flaggedAndCorrectionNote: 'res-okafor',
  deactivatedStaffAuthor: 'res-pemberton',
} as const

export { staffDeactivated, staffNwosu }
export type { IsoDate }
