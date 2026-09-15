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
  CarePlanDomainId,
  CarePlanDomainRecord,
  DocumentId,
  DownstreamEffect,
  CapacityAssessmentId,
  DecisionAuthority,
  ConsentRecord,
  CapacityFinding,
  CapacityAssessment,
  CarePlanReviewState,
  CarePlanVersion,
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
import {
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  GENDER_ANSWERS,
  RISK_ASSESSMENT_TEMPLATES,
} from '../types'
import { SCORED_TEMPLATES } from '@/features/risk/instrument'
import { pronounise } from './pronouns'
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
  'Hard of hearing on the left. Sit on {their} right and speak clearly, do not shout.',
  'Wears reading glasses, kept in the bedside drawer. Large print preferred.',
  'Understands more than {they} can say. Give time and use short sentences.',
  'Uses a communication board for meals and personal care choices.',
  'Speaks English and Igbo; reverts to Igbo when tired or distressed.',
  'Prefers written notes for anything important; the hearing aid whistles.',
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
  'Nigerian, Igbo',
  'Nigerian, Yoruba',
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

/**
 * A review's scheduling state.
 *
 * **`never_scheduled` is reachable from a record that exists**, and it was
 * not. The old shape returned it only where the thing had never been done at
 * all, so of 180 assessed risks not one had "assessed, and nobody set a date
 * to look again" — the branch `AssessmentListTab` renders for exactly that
 * case had no fixture reaching it, which is §8's first standing check with a
 * screen already written against it.
 *
 * It is the gap Phase 5 found and the one the review queue leads on: somebody
 * looked once, formed a judgement, and nothing says when anybody will look
 * again. A small band rather than a large one — it is a real failure, not the
 * ordinary case.
 */
function makeReviewState(rng: Rng, hasBeenDone: boolean): ReviewState {
  if (!hasBeenDone) return { kind: 'never_scheduled' }
  const roll = rng.int(1, 100)
  // Done, and nobody set a date to look again.
  if (roll <= 6) return { kind: 'never_scheduled' }
  if (roll <= 58) {
    const completedOn = daysAgo(rng.int(5, 60))
    /*
     * The date it had been due, so lateness survives the completion.
     *
     * Most reviews land on or before their date; a minority land after it, and
     * those must still read as late afterwards. Nothing records "this was
     * late" — it is `completedOn > dueOn` at the point of reading, so there is
     * nothing for a later write to overwrite.
     */
    const dueOn =
      rng.int(1, 100) <= 18
        ? daysAgo(rng.int(1, 30), completedOn)
        : daysAhead(rng.int(0, 10), completedOn)
    return {
      kind: 'completed',
      completedOn: toIsoDate(completedOn),
      completedBy: rng.pick(managers),
      against: { kind: 'due_on', dueOn: toIsoDate(dueOn) },
      // Next review dated from completion and comfortably ahead, which is
      // what a home that is keeping up looks like.
      nextDueOn: toIsoDate(daysAhead(rng.int(90, 240), completedOn)),
    }
  }
  if (roll <= 86)
    return { kind: 'scheduled', dueOn: toIsoDate(daysAhead(rng.int(7, 90))) }
  if (roll <= 95) return { kind: 'due', dueOn: toIsoDate(daysAhead(rng.int(0, 3))) }
  const dueOn = daysAgo(rng.int(4, 95))
  return {
    kind: 'overdue',
    dueOn: toIsoDate(dueOn),
    daysOverdue: daysBetween(dueOn, NOW),
  }
}

/**
 * The whole-plan review, which carries what was outstanding when it was signed.
 *
 * Derived from the plan rather than drawn, because that is the property that
 * matters: **18 of 32 residents had a care plan review reading `completed` or
 * `scheduled` while a domain of that plan was unwritten or past its date.**
 * Grace Adeyemi's read *completed* over a mobility domain two months overdue.
 * A queue built on that field would have reported all eighteen as reviewed.
 */
function makeCarePlanReview(
  rng: Rng,
  hasBeenDone: boolean,
  carePlan: CarePlanDomainRecord[],
): CarePlanReviewState {
  const state = makeReviewState(rng, hasBeenDone)
  if (state.kind !== 'completed') return state

  const gaps = carePlan
    .filter(
      (domain) =>
        domain.status.kind === 'not_started' || domain.status.kind === 'review_due',
    )
    .map((domain) => domain.domainId)

  return {
    ...state,
    outstanding:
      gaps.length === 0
        ? { kind: 'none_outstanding' }
        : {
            kind: 'outstanding',
            domains: gaps as [CarePlanDomainId, ...CarePlanDomainId[]],
          },
  }
}

function makeRiskStatus(
  rng: Rng,
  assessedChance: number,
  templateId: RiskTemplateId,
): RiskStatus {
  if (!rng.chance(assessedChance)) return { kind: 'not_assessed' }
  const level = rng.pick(['low', 'low', 'moderate', 'moderate', 'high'] as const)
  const assessedAt = daysAgo(rng.int(5, 200))
  /*
   * Drawn before the instrument is consulted, and discarded for the unscored
   * ones.
   *
   * **The draw has to happen either way**, because skipping it for four of the
   * nine templates shifts every later value in the stream — every resident's
   * remaining assessments, and then everything generated after them. Two
   * unrelated tests went red the first time, in a file about LPA holders.
   * Same discipline as the pronoun substitution: decide after the draw, never
   * instead of it.
   */
  const value =
    level === 'low'
      ? rng.int(0, 24)
      : level === 'moderate'
        ? rng.int(25, 49)
        : rng.int(50, 90)

  return {
    kind: 'assessed',
    level,
    // An unscored instrument still reaches a level — somebody looked and
    // formed a judgement. What it does not produce is a number.
    score: SCORED_TEMPLATES.has(templateId)
      ? { kind: 'scored', value }
      : { kind: 'unscored' },
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
    risks[template.id] = makeRiskStatus(rng, weight, template.id)
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

/**
 * The second field, and it needed its own pool.
 *
 * Preferences were drawn from `DOMAIN_SUMMARIES` — so a plan's needs and its
 * preferences came out as **the same sentence**, and the editor's second box
 * repeated the first. A field that always echoes another is not a second fact
 * about somebody; it is one fact rendered twice, which is the diff screen's
 * failure mode arriving early.
 *
 * Same voice as the summaries: first person, what they say, not what a nurse
 * would write about them.
 */
const DOMAIN_PREFERENCES: Record<CarePlanDomainId, string[]> = {
  personal_care: [
    'I like to be washed and dressed before breakfast, not after.',
    'I would rather one person helped me than two, if it can be done that way.',
  ],
  nutrition: [
    'I take my tea strong with two sugars and I like it in my own cup.',
    'I would rather eat in my room than in the dining room.',
  ],
  mobility: [
    'I would rather walk than be pushed, even if it takes a while.',
    'Do not take my arm without asking me first.',
  ],
  continence: [
    'Ask me quietly, and not in front of anybody else.',
    'I would rather use the toilet than a commode, however long it takes.',
  ],
  communication: [
    'Give me time to find the word. Do not finish it for me.',
    'Write it down for me if I have not understood.',
  ],
  cognitive: [
    'Do not argue with me about where I am. Sit down with me instead.',
    'I like the radio on in the afternoon, not the television.',
  ],
  social_emotional: [
    'Ask me before you bring anybody into my room.',
    'I would rather be asked twice than left out.',
  ],
  end_of_life: [
    'I want my own clothes on and the window open.',
    'I would rather have quiet than a room full of people.',
  ],
  physical_health: [
    'Tell me what you are checking before you check it.',
    'I would rather see the doctor in the morning.',
  ],
  medication: [
    'Bring them to me one at a time, not all together in the pot.',
    'I like to take them sitting up, never lying down.',
  ],
}

const DOMAIN_SUMMARIES: Record<CarePlanDomainId, string[]> = {
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

/**
 * What staff will do about it — the third field, and the only one written in
 * the second person about staff rather than the first person about the
 * resident.
 */
const AGREED_ACTIONS: Record<CarePlanDomainId, string[]> = {
  personal_care: [
    'Offer a wash at the basin before breakfast. Lay out clothes and let them choose.',
    'Two staff for the shower on Tuesdays and Fridays. Do not rush the drying.',
  ],
  nutrition: [
    'Sit with them at lunch. Offer a second helping rather than asking if they want one.',
    'Fortified milk at breakfast and supper. Weigh weekly and record it.',
  ],
  mobility: [
    'Frame within reach whenever they are in the chair. Two staff for transfers.',
    'Walk beside them to the dining room at every meal.',
  ],
  continence: [
    'Offer the toilet every two hours during the day and on every night check.',
    'Continence products in the wardrobe. Check discreetly, never in front of others.',
  ],
  communication: [
    'Approach from their right. Give them time to find the word: do not finish it.',
    'Use their first name. Face them when you speak.',
  ],
  cognitive: [
    'From mid-afternoon, keep the same carer with them where the rota allows.',
    'Do not correct them about where they are. Redirect with a cup of tea.',
  ],
  social_emotional: [
    'Invite them to the gardening group each week. Accept a no without pressing.',
    'Talk about their partner when they raise it. Do not change the subject.',
  ],
  end_of_life: [
    'Do not call an ambulance without speaking to the GP first, except in an emergency.',
    'Call the family first, then the pastor. Numbers are in the front of the file.',
  ],
  physical_health: [
    'Inhaler before they get up on cold mornings. Report any change in the chest.',
    'Blood sugar twice daily. Show them the reading each time.',
  ],
  medication: [
    'Tablets with yoghurt, never with water alone.',
    'Say what each tablet is for before offering it.',
  ],
}

/**
 * The care plan, and the reason its history has a shape.
 *
 * The volume is aimed at the spread PRD §5.2 asks for across 32 residents and
 * ten domains: most complete and in date, a band approaching review, a smaller
 * band past it, a few part-written, and the rest never written down at all.
 *
 * **Never written down is this module's "never assessed."** It needs a
 * resident carrying it, not only a scattering of domains.
 */
function makeCarePlan(rng: Rng, completeness: number): CarePlanDomainRecord[] {
  return CARE_PLAN_DOMAINS.map((domain) => {
    const roll = rng.int(1, 100)
    const started = roll <= completeness
    /*
     * All three pools are complete records over the domain constant, so a
     * domain added later is a compile error rather than a plan with a blank
     * field in it.
     */
    const summaries = DOMAIN_SUMMARIES[domain.id]
    const preferences = DOMAIN_PREFERENCES[domain.id]
    const actions = AGREED_ACTIONS[domain.id]

    if (!started) {
      return {
        domainId: domain.id,
        status: { kind: 'not_started' },
        supportLevel: { kind: 'not_assessed' },
        summary: '',
        versions: { kind: 'never_finalised' },
        draft: { kind: 'none' },
      }
    }

    /*
     * A part-written domain: somebody started and has not signed.
     *
     * Its draft is deliberately **not** in the history. An abandoned or
     * unsigned edit leaves no trace there, because nobody followed it — the
     * history is what staff were told to do, not what somebody intended.
     */
    if (rng.chance(0.05)) {
      const updatedAt = daysAgo(rng.int(1, 40))
      return {
        domainId: domain.id,
        status: {
          kind: 'in_progress',
          updatedBy: rng.pick(managers),
          updatedAt: toIsoDateTime(updatedAt),
        },
        supportLevel: makeSupportLevel(rng, true),
        summary: '',
        versions: { kind: 'never_finalised' },
        draft: {
          kind: 'draft',
          currentNeeds: rng.pick(summaries),
          preferences: '',
          agreedActions: '',
          updatedBy: rng.pick(managers),
          updatedAt: toIsoDateTime(updatedAt),
        },
      }
    }

    const finalisedOn = daysAgo(rng.int(20, 300))
    // A band approaching review, a smaller band past it, the rest in date.
    const timing = rng.int(1, 100)
    const nextReviewOn =
      timing <= 7
        ? daysAgo(rng.int(3, 90))
        : timing <= 17
          ? daysAhead(rng.int(1, 30))
          : daysAhead(rng.int(31, 240))
    const overdue = nextReviewOn < NOW

    // One or two finalised versions, current last. A second version is a
    // revision — the previous one becomes history rather than a correction.
    const revised = rng.chance(0.35)
    const previousOn = daysAgo(rng.int(320, 700))
    const current: CarePlanVersion = {
      currentNeeds: rng.pick(summaries),
      preferences: rng.pick(preferences),
      agreedActions: rng.pick(actions),
      finalisedBy: rng.pick(managers),
      finalisedOn: toIsoDate(finalisedOn),
    }
    /*
     * A previous version fills all three fields, like any other.
     *
     * Its `preferences` used to be the empty string, which said a manager had
     * signed a plan with a blank in it — and the editor refuses to finalise on
     * exactly that. A fixture that holds a record the product will not let
     * anybody create is wrong on the facts, not merely thin, and this one
     * would have rendered as an empty box in the middle of the diff: a blank
     * that reads as "she had no preferences" rather than "nobody wrote them".
     */
    const history: [CarePlanVersion, ...CarePlanVersion[]] = revised
      ? [
          {
            currentNeeds: rng.pick(summaries),
            preferences: rng.pick(preferences),
            agreedActions: rng.pick(actions),
            finalisedBy: rng.pick(managers),
            finalisedOn: toIsoDate(previousOn),
          },
          current,
        ]
      : [current]

    return {
      domainId: domain.id,
      status: overdue
        ? {
            kind: 'review_due',
            finalisedBy: current.finalisedBy,
            finalisedOn: current.finalisedOn,
            dueOn: toIsoDate(nextReviewOn),
            daysOverdue: daysBetween(nextReviewOn, NOW),
          }
        : {
            kind: 'complete',
            finalisedBy: current.finalisedBy,
            finalisedOn: current.finalisedOn,
            nextReviewOn: toIsoDate(nextReviewOn),
          },
      supportLevel: makeSupportLevel(rng, true),
      summary: current.currentNeeds,
      versions: { kind: 'finalised', history },
      draft: { kind: 'none' },
    }
  })
}

/**
 * The eight consents, and the capacity assessments that authorise them.
 *
 * **Every recorded decision names an assessment, and every assessment names
 * the decisions it covers.** One conversation can produce one assessment
 * covering several consents — which is what a manager sitting down with
 * somebody actually does — and the compiler refuses a consent recorded against
 * an assessment that does not name its type.
 *
 * `not_sought` and `pending` carry no authority. Nothing has been decided, so
 * there is nobody who decided it.
 */
function makeConsents(
  rng: Rng,
  soughtChance: number,
  residentId: ResidentId,
  hasHealthLpa: boolean,
): ConsentRecord {
  const consents = {} as Record<string, unknown>

  /*
   * One sitting, one assessment.
   *
   * The assessment covers everything decided that day, which is why it is
   * drawn once rather than per type — and the fixtures then look like a
   * conversation rather than like eight unrelated events.
   */
  const assessedOn = toIsoDate(daysAgo(rng.int(20, 500)))
  const assessedBy = rng.pick(managers)
  const lacks = rng.chance(0.22)
  const finding: CapacityFinding = lacks
    ? {
        kind: 'lacks_capacity',
        diagnosticTest: rng.pick(DIAGNOSTIC_FINDINGS),
        functionalTest: rng.pick(FUNCTIONAL_FINDINGS),
      }
    : { kind: 'has_capacity' }

  const assessment: CapacityAssessment = {
    id: `cap-${residentId.replace('res-', '')}` as CapacityAssessmentId,
    residentId,
    finding,
    covers: Object.fromEntries(
      CONSENT_TYPES.map((type) => [type.id, true]),
    ) as CapacityAssessment['covers'],
    assessedOn,
    assessedBy,
    note: lacks
      ? 'Went through it twice with a break. Daughter present for the second conversation.'
      : 'Explained it, asked her to tell me back what it meant, and she did.',
  }

  const authority = (): DecisionAuthority => {
    if (lacks && hasHealthLpa && rng.chance(0.4)) {
      return {
        kind: 'lpa_holder',
        assessment,
        who: 'Health and welfare attorney on file',
        documentId: 'doc-lpa-0001' as DocumentId,
      }
    }
    if (lacks) {
      return {
        kind: 'best_interests',
        assessment,
        consulted: ['Dr S. Achebe', 'Next of kin', 'Senior carer on duty'],
        rationale:
          'Agreed as being in their best interests after talking it through with the family.',
      }
    }
    return { kind: 'the_resident', assessment }
  }

  for (const type of CONSENT_TYPES) {
    if (!rng.chance(soughtChance)) {
      consents[type.id] = { kind: 'not_sought' }
      continue
    }
    const roll = rng.int(1, 100)
    const on = toIsoDate(daysAgo(rng.int(20, 500)))
    if (roll <= 60) {
      consents[type.id] = {
        kind: 'given',
        method: rng.pick(['written', 'verbal', 'digital_signature'] as const),
        on,
        recordedBy: assessedBy,
        by: authority(),
      }
    } else if (roll <= 72) {
      consents[type.id] = {
        kind: 'pending',
        requestedOn: toIsoDate(daysAgo(rng.int(2, 30))),
        requestedBy: rng.pick(managers),
      }
    } else if (roll <= 84) {
      consents[type.id] = {
        kind: 'refused',
        on,
        note: rng.pick(REFUSAL_NOTES),
        recordedBy: assessedBy,
        by: authority(),
      }
    } else {
      /*
       * A best-interests decision that concludes **no**.
       *
       * The shape the old union could not express: `best_interest` implied a
       * positive by omission, so a process that decided against something had
       * nowhere to go.
       */
      consents[type.id] = {
        kind: 'refused',
        on,
        note: 'Decided against on their behalf after consulting the family and the GP.',
        recordedBy: assessedBy,
        by: {
          kind: 'best_interests',
          assessment,
          consulted: ['Dr S. Achebe', 'Next of kin', 'Senior carer on duty'],
          rationale:
            'Weighed up and agreed that it would not be in their best interests.',
        },
      }
    }
  }

  return consents as ConsentRecord
}

const DIAGNOSTIC_FINDINGS = [
  'Moderate vascular dementia, diagnosed 2023.',
  'Alzheimer\u2019s disease, diagnosed 2021, moderate stage.',
  'Delirium following a chest infection, not yet resolved.',
]

const FUNCTIONAL_FINDINGS = [
  'Could repeat the options back but could not hold them together long enough to compare.',
  'Understood the question but could not weigh the risks against the benefits.',
  'Could not retain the explanation long enough to reach a decision.',
]

const REFUSAL_NOTES = [
  'Said no, and said why: she does not want her picture anywhere.',
  'Declined after talking it over with her son.',
  'Said he would rather not, and did not want to discuss it further.',
]

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

  /*
   * Only a health-and-welfare LPA can consent to care.
   *
   * `LpaType` already distinguishes it from a financial one, and a financial
   * attorney consenting to photography is a real-world error worth being
   * unable to represent — so the authority is not offered where there is no
   * health-and-welfare LPA on record.
   */
  const hasHealthLpa = rng.chance(richness * 0.35)

  /*
   * The plan is drawn inside the literal and the review after it, in that
   * order, because the review has to be told what was outstanding.
   *
   * Not hoisted: `makeCarePlan` draws from the same stream, and moving the
   * draw earlier would shift every fixture after it. The review was already
   * the last field drawn, so building it one line later costs nothing.
   */
  const built: Omit<Resident, 'carePlanReview'> = {
    id: `res-${person.id}` as ResidentId,
    siteId,
    fullLegalName: person.full,
    preferredName: person.preferred,
    dateOfBirth: toIsoDate(dob),
    admittedOn: toIsoDate(admittedOn),

    // No resident has a photograph on file yet. The union is real, so the
    // moment images arrive the on_file branch lights up with no code change.
    photo: { kind: 'not_on_file' },

    /* Drawn last, below. See the note beside the draw. */
    gender: UNRECORDED,
    pronouns: rng.chance(richness)
      ? recorded(person.pronouns, rng.pick(managers), admittedOn)
      : UNRECORDED,
    nhsNumber: rng.chance(richness)
      ? recorded(
          /*
           * **The 999 range, which NHS Digital reserves for test data and will
           * never issue.** These were drawn at random in the real 400–799
           * shape, and roughly one in eleven random numbers satisfies the
           * Modulus 11 check digit a real NHS number carries — two of the
           * twenty-nine here did, which made them indistinguishable from
           * numbers belonging to somebody. A fixture is not allowed to collide
           * with a real person's identifier, however unlikely the collision.
           */
          /*
           * **Three draws, because the first version took two and reshuffled
           * every fixture after it.** The generator shares one seeded stream,
           * so the *count* of calls is load-bearing even when the values are
           * not: dropping one moved every later draw up a place, repaired the
           * NHS numbers and silently re-paired residents with communication
           * needs — a resident whose pronouns are they/them acquired a need
           * saying "sit on her right". One guard caught it.
           */
          `999 ${`${rng.int(0, 999)}`.padStart(3, '0')} ${`${rng.int(0, 99)}`.padStart(
            2,
            '0',
          )}${`${rng.int(0, 99)}`.padStart(2, '0')}`,
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
            'Respite, 4 weeks',
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
          pronounise(rng.pick(COMMUNICATION_NEEDS), person.pronouns),
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
    consents: makeConsents(
      rng,
      thin ? 0.4 : 0.85,
      `res-${person.id}` as ResidentId,
      hasHealthLpa,
    ),
  }

  /*
   * Built from the plan, not beside it.
   *
   * Drawing them independently is how eighteen residents ended up with a care
   * plan review reading "completed" over domains nobody had written — Grace
   * Adeyemi's read completed over a mobility domain two months overdue.
   */
  const review = makeCarePlanReview(rng, rng.chance(richness), built.carePlan)

  /*
   * **Gender is drawn last, after every other draw, and that is not a style
   * choice.** These fixtures come from one seeded stream, so a draw inserted
   * anywhere shifts every draw after it: putting this beside `pronouns`, where
   * it belongs on the record, moved thirty-two residents' data and two of them
   * ended up with a communication need written in pronouns they do not use.
   * The file already warns about this one function further up, and the warning
   * did not prevent it — the tell was a pronoun guard failing on a change that
   * had nothing to do with pronouns.
   *
   * **All four answers are drawn, "prefers not to say" included, because it is
   * an answer and not a gap.** A fixture set where nobody ever declines leaves
   * unrendered the one branch the type exists to distinguish: a declined
   * answer has to be visible looking settled beside an unasked one looking
   * hatched, or the distinction lives only in the code.
   */
  return {
    ...built,
    gender: rng.chance(richness)
      ? recorded(rng.pick([...GENDER_ANSWERS]).id, rng.pick(managers), admittedOn)
      : UNRECORDED,
    carePlanReview: review,
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
  /*
   * Not one domain written, and that is the pinned case.
   *
   * **"Never written down" is this module's "never assessed"** — and it needs
   * a resident carrying all ten rather than a scattering across the home,
   * because the screen's own finding is a person nobody has planned for.
   */
  carePlan: CARE_PLAN_DOMAINS.map((domain) => ({
    domainId: domain.id,
    status: { kind: 'not_started' } as const,
    supportLevel: { kind: 'not_assessed' } as const,
    summary: '',
    versions: { kind: 'never_finalised' } as const,
    draft: { kind: 'none' } as const,
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
patch('brennan', (resident) => {
  /*
   * The effects are **data with counts**, not a sentence.
   *
   * This used to be prose in a `note`, and a sentence cannot be asserted
   * against: a withdrawal that forgot to mention the photographs would have
   * looked identical to one that did — the product's own failure inside the
   * record written to prevent it.
   *
   * One count is unknown on purpose. Nobody has counted the prints on the
   * corridor noticeboards, and **nobody knowing how many is not the same as
   * none** — a zero there would be a figure nobody measured.
   */
  const remains: DownstreamEffect[] = [
    {
      name: 'Photographs on file',
      explanation:
        'Taken while consent stood. Still in his record and still visible to his daughter in the Family Portal.',
      count: { kind: 'counted', value: 14 },
    },
    {
      name: "Photographs on the home's noticeboards",
      explanation: 'Physical prints in the corridors and the lounge.',
      count: { kind: 'not_counted' },
    },
    {
      name: 'Family Portal access is still given',
      explanation:
        'A separate consent, unaffected by this one. His daughter keeps access unless that is withdrawn too.',
      count: { kind: 'unchanged' },
    },
  ]

  const assessment: CapacityAssessment<'photography'> = {
    id: 'cap-brennan-photography' as CapacityAssessmentId,
    residentId: resident.id,
    finding: { kind: 'has_capacity' },
    covers: { photography: true },
    assessedOn: toIsoDate(daysAgo(28)),
    assessedBy: staffOkonkwo,
    note: 'Asked him directly. He was clear, and repeated it back unprompted.',
  }

  return {
    ...resident,
    consents: {
      ...resident.consents,
      photography: {
        kind: 'withdrawn',
        on: toIsoDate(daysAgo(28)),
        note: 'Asked for his photographs to stop being taken.',
        previouslyGivenOn: toIsoDate(daysAgo(420)),
        recordedBy: staffOkonkwo,
        by: { kind: 'the_resident', assessment },
        remains,
      },
    },
  }
})

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
          /*
           * The version the status is talking about, moved with it.
           *
           * This patch used to rewrite the status alone, leaving the history
           * saying the plan was signed in February by whoever the generator
           * picked while the row above it said June of the year before. The
           * defect only appears once a screen renders both — which is this
           * phase — and it is the shape of a stale record: two halves of the
           * same fact, edited apart.
           */
          versions: {
            kind: 'finalised' as const,
            history: [
              {
                currentNeeds:
                  'I can walk to the dining room if someone walks beside me.',
                preferences:
                  'I would rather walk than be pushed, even if it takes a while.',
                agreedActions: 'Walk beside them to the dining room at every meal.',
                finalisedBy: staffHalloran,
                finalisedOn: toIsoDate(fourteenMonthsAgo),
              },
            ] as [CarePlanVersion, ...CarePlanVersion[]],
          },
        }
      : domain,
  ),
}))

/**
 * A signed plan with an unsigned draft on top of it — the state a care plan
 * *review* is, and the one the generator never produced.
 *
 * It is two facts, not one: there is a current instruction staff are following
 * today, **and** somebody has started rewriting it and has not signed. A row
 * that renders only the draft says nothing is in force; a row that renders
 * only the signature hides that it is being changed. Both are wrong in the
 * direction that matters.
 *
 * Pinned rather than generated, and derived by property rather than by index,
 * so it survives a change to the draw order.
 */
patch('gallagher', (resident) => {
  const target = resident.carePlan.find(
    (domain) =>
      domain.status.kind === 'complete' && domain.versions.kind === 'finalised',
  )
  if (!target) throw new Error('No finalised domain to hold the draft-on-signed case')

  return {
    ...resident,
    carePlan: resident.carePlan.map((domain) =>
      domain.domainId === target.domainId
        ? {
            ...domain,
            draft: {
              kind: 'draft' as const,
              currentNeeds:
                'I get more tired than I did. I can still manage but it takes me longer.',
              preferences: '',
              agreedActions: '',
              updatedBy: staffOkonkwo,
              updatedAt: toIsoDateTime(daysAgo(2)),
            },
          }
        : domain,
    ),
  }
})

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
        contact: { phone: '0161 496 0233', email: 'secretary@example.invalid' },
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
          contact: { phone: '07700 900814', email: 'family@example.invalid' },
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
          contact: { phone: '0161 496 0177', email: 'chs@example.invalid' },
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
      score: { kind: 'scored', value: 10 },
      assessedAt: toIsoDateTime(daysAgo(40)),
      assessedBy: staffOkonkwo,
      reviewState: { kind: 'scheduled', dueOn: toIsoDate(daysAhead(140)) },
    },
    choking: {
      kind: 'assessed',
      level: 'low',
      // Choking is an unscored instrument: findings recorded, level reached.
      score: { kind: 'unscored' },
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

/** Gap 12 — Family Portal consent withdrawn while people are still named.
 *  **A permission outliving its authorisation.** The resident tab only lists
 *  named people while the consent stands, so at the moment somebody needs to
 *  take access away, the people holding it are invisible on the screen that
 *  names them. The module queue exists to make that visible, and it needs a
 *  fixture reaching the state or the finding has nothing to show. */
const withdrawnFamilyPortal = (
  residentId: ResidentId,
  said: string,
  agoDays: number,
  gavenDaysAgo: number,
): ConsentStatus<'family_portal'> => ({
  kind: 'withdrawn',
  on: toIsoDate(daysAgo(agoDays)),
  note: said,
  previouslyGivenOn: toIsoDate(daysAgo(gavenDaysAgo)),
  recordedBy: staffOkonkwo,
  by: {
    kind: 'the_resident',
    assessment: {
      id: `cap-${residentId}-family-portal` as CapacityAssessmentId,
      residentId,
      finding: { kind: 'has_capacity' },
      covers: { family_portal: true },
      assessedOn: toIsoDate(daysAgo(agoDays)),
      assessedBy: staffOkonkwo,
      note: 'Asked her directly, on her own. She was clear and gave her reasons.',
    },
  },
  /*
   * **What the withdrawal did not undo, and not a second copy of the list.**
   * How many people are still named is the family access store's fact, and
   * restating it here would be two owners of one count — the pharmacy-cycle
   * defect in a consent record. What belongs here is the disclosure log, which
   * is append-only by design.
   */
  remains: [
    {
      name: 'Care notes already shared with the family',
      explanation:
        'Sharing decisions recorded before the withdrawal stay in the disclosure log. Withdrawing the consent stops anything new; it does not unsay what was shared.',
      count: { kind: 'unchanged' },
    },
  ],
})

patch('kavanagh', (resident) => ({
  ...resident,
  consents: {
    ...resident.consents,
    family_portal: withdrawnFamilyPortal(
      resident.id,
      'Asked for the portal to be switched off after a family disagreement.',
      9,
      430,
    ),
  },
}))

patch('thorne', (resident) => ({
  ...resident,
  consents: {
    ...resident.consents,
    family_portal: withdrawnFamilyPortal(
      resident.id,
      'Said he would rather his family rang the home than read anything online.',
      21,
      300,
    ),
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
  withdrawnFamilyPortalConsent: 'res-kavanagh',
} as const

export { staffDeactivated, staffNwosu }
export type { IsoDate }
