import { held, type SessionHolding } from './session-holding'
import { PLAN_FIELDS } from '@/features/care-plan/plan-fields'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  AllergyStatus,
  IsoDateTime,
  CarePlanDomainRecord,
  ConsentRecord,
  GenderAnswer,
  IsoDate,
  Recorded,
  CarePlanDomainId,
  CarePlanText,
  CustomCarePlanDomain,
  CustomDomainId,
  CustomRisk,
  CustomRiskId,
  Resident,
  ResidentId,
  RiskAction,
  RiskFinding,
  RiskLevel,
  RiskScore,
  RiskStatus,
  RiskTemplateId,
  SiteId,
  StaffRef,
} from '../types'
import { CARE_PLAN_DOMAINS, CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from '../types'
import { residents as fixtureResidents } from '../fixtures/residents'

/**
 * Residents admitted this session, and fields edited on any of them. Phase 16.
 *
 * **Admission cannot create less than a complete set of gaps**, and the type is
 * what enforces it rather than a review. `consents` is a mapped type over eight
 * keys, `risks` a `Record` over nine templates, `carePlan` an array the screens
 * iterate from a constant — a resident missing any of them does not compile,
 * and a resident missing any of them is precisely the record this product
 * exists to flag.
 *
 * So what admission produces is Ismail Sowande: a person with a name, a room
 * and a set of gaps that every module already renders correctly. That is not a
 * shortfall of the form; it is the whole of what admitting somebody is.
 *
 * In memory and nowhere else, and the fixtures are never mutated.
 */

const admitted: Resident[] = []

/** Field-level edits, per resident. Never applied to the fixture object. */
const edits = new Map<ResidentId, Partial<Resident>>()

let sequence = 0

const nextResidentId = (): ResidentId => {
  sequence += 1
  return `res-admitted-${String(sequence).padStart(3, '0')}` as ResidentId
}

/** A resident as they stand now: the record, plus anything edited since. */
export function withResidentEdits(resident: Resident): Resident {
  const patch = edits.get(resident.id)
  return patch === undefined ? resident : { ...resident, ...patch }
}

export function allResidents(): Resident[] {
  return [...fixtureResidents, ...admitted]
}

export function admittedThisSession(): Resident[] {
  return [...admitted]
}

/**
 * One field, changed, with who changed it.
 *
 * **Field by field, never a form.** A bulk save attributing six changes to one
 * act is the wrong shape for a clinical record: each change has its own author,
 * its own moment and its own reason, and a form invites somebody to sweep four
 * corrections and a clinical decision into one signature.
 */
/**
 * What this store would lose.
 *
 * An admission and an edit are counted apart: one created a person who exists
 * nowhere else, and the other changed a field on somebody the fixtures already
 * hold. Losing the first loses the whole record.
 */
export function residentHoldings(): SessionHolding[] {
  return [
    ...held('residents you admitted', admitted.length),
    ...held('resident records you edited', edits.size),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionResidents(): void {
  admitted.length = 0
  edits.clear()
  sequence = 0
}

export function editResidentField(id: ResidentId, patch: Partial<Resident>): void {
  edits.set(id, { ...edits.get(id), ...patch })
}

export function editedThisSession(id: ResidentId): boolean {
  return edits.has(id)
}

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

export interface AdmissionInput {
  fullLegalName: string
  /**
   * Blank is a real answer.
   *
   * **It renders as not recorded rather than defaulting to the legal name.**
   * A default here would be the system putting a name in somebody's mouth on
   * their first day.
   */
  preferredName: string
  dateOfBirth: IsoDate
  admittedOn: IsoDate
  siteId: SiteId
  room: string
  allergies: AllergyStatus
  admittedBy: StaffRef

  /*
   * ---------------------------------------------------------------------
   * Everything below is steps 2 to 5, and every one of them is optional.
   *
   * **Steps 1 and 2 are required and the rest are not, which is the PRD's
   * shape and also the honest one.** The six-field form this replaces was
   * built on the argument that anything more asks somebody to guess on the
   * day they know least. The five steps overrule that and the reasoning
   * does not disappear: it becomes the rule that no field past step 2 is
   * required, and that a blank is recorded as unrecorded rather than as an
   * empty string, so every screen renders it as the gap it is from the
   * first minute.
   * ---------------------------------------------------------------------
   */
  gender?: GenderAnswer
  nhsNumber?: string
  pronouns?: string
  primaryLanguage?: string
  /** Step 3. The field a form will get a guess for, if it insists. */
  primaryDiagnosis?: string
  dietaryRequirements?: string
  nextOfKin?: { name: string; relationship: string; phone: string }
  gp?: { name: string; practice: string; phone: string }
  /**
   * Step 3. Risk assessments answered on the day, by template id.
   *
   * **A partial record, and the gap is the point.** Every template not named
   * here stays `not_assessed`, which is what the resident's own tab, the risk
   * queue and the badge strip already render as the gap it is. Somebody
   * arriving at nine in the evening from hospital comes with two answers and
   * seven unknowns, and the form has to be able to hold exactly that.
   */
  risks?: Partial<Record<RiskTemplateId, AdmissionRiskEntry>>
  /** Step 3. Risks this home identified for this resident, outside the nine. */
  customRisks?: (AdmissionRiskEntry & { name: string })[]
  /**
   * Step 4. Care plan domains somebody can write on the day, by domain id.
   *
   * **Drafts, and only drafts.** A domain not named here stays never started,
   * and one named here reads as part-written until somebody finalises it from
   * the resident's own tab. Signing a plan on the day somebody arrives would
   * claim staff are following something nobody has worked from yet.
   */
  carePlan?: Partial<Record<CarePlanDomainId, CarePlanText>>
  /** Step 4. Domains this home wrote for this resident, outside the ten. */
  customCarePlan?: (CarePlanText & { name: string })[]
}

/**
 * One risk answered at admission, whichever list it belongs to.
 *
 * The same fields a templated assessment carries, because it becomes one: the
 * admission form is a second way into the record the assessment screen writes,
 * never a second record.
 */
export interface AdmissionRiskEntry {
  level: RiskLevel
  score: RiskScore
  description: string
  actions: RiskAction[]
  /** When somebody looked, which is not always the day they typed it in. */
  assessedOn: IsoDate
  /** When the next one falls due. Defaulted from the review interval. */
  reviewDueOn: IsoDate
}

/**
 * The two unrecorded members, and they are not the same word.
 *
 * `Recorded<T>` says `unrecorded` and `RecordedList<T>` says `not_recorded` —
 * a difference the compiler catches and a reader would not. Both are declared
 * rather than inferred, because `as const` makes them readonly and every field
 * here expects the mutable member.
 */
const UNRECORDED: { kind: 'unrecorded' } = { kind: 'unrecorded' }
const NO_LIST: { kind: 'not_recorded' } = { kind: 'not_recorded' }

/** The moment of admission, stamped once so every field on it agrees. */
const now = () => appNow().toISOString() as IsoDateTime

/**
 * An optional answer, recorded with its author or left as the gap.
 *
 * **Blank and absent are the same thing here and that is deliberate.** A field
 * somebody skipped and a field somebody cleared are both "nobody has recorded
 * this", which is one fact; the distinction a form could draw between them is
 * about the form rather than about the resident.
 */
function said<T extends string>(value: T | undefined, by: StaffRef): Recorded<T> {
  if (value === undefined || value.trim() === '') return UNRECORDED
  return { kind: 'recorded', value, recordedBy: by, recordedAt: now() }
}

/**
 * What an entry on the form becomes on the record.
 *
 * **Stamped with whoever is admitting, on both lists.** They are the person
 * assessing and the person typing, so there is no second "assessed by" to
 * capture — the same rule `recordAssessment` has always followed.
 */
function asFinding(entry: AdmissionRiskEntry, by: StaffRef): RiskFinding {
  return {
    level: entry.level,
    score: entry.score,
    description: entry.description.trim(),
    actions: entry.actions.filter(
      (action) => action.description.trim() !== '' || action.responsible.trim() !== '',
    ),
    assessedAt: `${entry.assessedOn}T09:00:00+01:00` as IsoDateTime,
    assessedBy: by,
    reviewState: { kind: 'scheduled', dueOn: entry.reviewDueOn },
  }
}

function asCustomRisk(
  entry: AdmissionRiskEntry & { name: string },
  index: number,
  by: StaffRef,
): CustomRisk {
  return {
    id: `risk-admitted-${String(sequence)}-${String(index + 1)}` as CustomRiskId,
    name: entry.name.trim(),
    ...asFinding(entry, by),
  }
}

function admittedRisks(
  answered: Partial<Record<RiskTemplateId, AdmissionRiskEntry>>,
  by: StaffRef,
): Record<RiskTemplateId, RiskStatus> {
  const risks = blankRisks()
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    const entry = answered[template.id]
    if (entry !== undefined)
      risks[template.id] = { kind: 'assessed', ...asFinding(entry, by) }
  }
  return risks
}

function blankRisks(): Record<RiskTemplateId, RiskStatus> {
  const risks = {} as Record<RiskTemplateId, RiskStatus>
  for (const template of RISK_ASSESSMENT_TEMPLATES) {
    risks[template.id] = { kind: 'not_assessed' }
  }
  return risks
}

function blankConsents(): ConsentRecord {
  /*
   * Built by mutation and cast once at the end. `ConsentRecord` is a mapped
   * type whose eight members each carry their own type parameter, and building
   * it by spread produces a union the compiler declines to represent — which
   * is the type doing its job rather than a defect: the whole point of the
   * mapped type is that each key knows its own consent.
   */
  const consents: Record<string, { kind: 'not_sought' }> = {}
  for (const type of CONSENT_TYPES) {
    // A consent nobody has sought is neither refusal nor permission.
    consents[type.id] = { kind: 'not_sought' }
  }
  return consents as ConsentRecord
}

/**
 * A draft as the record holds it: part-written, with whoever wrote it.
 *
 * Trimmed field by field from `PLAN_FIELDS` rather than named one at a time —
 * this listed three while `CarePlanText` had four, so a new field arrived
 * untrimmed and, worse, absent from the draft the editor reads back.
 */
function asDraft(text: CarePlanText, by: StaffRef) {
  const trimmed = Object.fromEntries(
    PLAN_FIELDS.map((field) => [field.id, text[field.id].trim()]),
  ) as CarePlanText
  return {
    kind: 'draft' as const,
    ...trimmed,
    updatedBy: by,
    updatedAt: now(),
  }
}

const written = (text: CarePlanText): boolean =>
  PLAN_FIELDS.some((field) => text[field.id].trim() !== '')

function admittedCarePlan(
  answered: Partial<Record<CarePlanDomainId, CarePlanText>>,
  by: StaffRef,
): CarePlanDomainRecord[] {
  return blankCarePlan().map((domain) => {
    const text = answered[domain.domainId]
    if (text === undefined || !written(text)) return domain
    return {
      ...domain,
      status: { kind: 'in_progress', updatedBy: by, updatedAt: now() },
      draft: asDraft(text, by),
    }
  })
}

function asCustomDomain(
  entry: CarePlanText & { name: string },
  index: number,
  by: StaffRef,
): CustomCarePlanDomain {
  return {
    id: `domain-admitted-${String(sequence)}-${String(index + 1)}` as CustomDomainId,
    name: entry.name.trim(),
    status: { kind: 'in_progress', updatedBy: by, updatedAt: now() },
    supportLevel: { kind: 'not_assessed' },
    summary: '',
    versions: { kind: 'never_finalised' },
    draft: asDraft(entry, by),
  }
}

function blankCarePlan(): CarePlanDomainRecord[] {
  return CARE_PLAN_DOMAINS.map((domain) => ({
    domainId: domain.id,
    status: { kind: 'not_started' },
    supportLevel: { kind: 'not_assessed' },
    summary: '',
    versions: { kind: 'never_finalised' },
    draft: { kind: 'none' },
  }))
}

export function admitResident(input: AdmissionInput): Resident {
  const resident: Resident = {
    id: nextResidentId(),
    siteId: input.siteId,
    fullLegalName: input.fullLegalName.trim(),
    preferredName: input.preferredName.trim(),
    dateOfBirth: input.dateOfBirth,
    admittedOn: input.admittedOn,
    photo: { kind: 'not_on_file' },
    /*
     * **One helper for every optional field, and a blank is `unrecorded`.**
     * The alternative is an empty string, which renders as a filled field
     * containing nothing and is the blank this product exists to refuse: a
     * reader cannot tell it from a value somebody typed and deleted.
     */
    gender: said(input.gender, input.admittedBy),
    pronouns: said(input.pronouns, input.admittedBy),
    nhsNumber: said(input.nhsNumber, input.admittedBy),
    room:
      input.room.trim() === ''
        ? UNRECORDED
        : {
            kind: 'recorded',
            value: input.room.trim(),
            recordedBy: input.admittedBy,
            recordedAt: now(),
          },
    anticipatedLengthOfStay: UNRECORDED,
    fundingSource: UNRECORDED,
    allergies: input.allergies,
    primaryDiagnosis: UNRECORDED,
    secondaryDiagnoses: NO_LIST,
    medicalHistory: UNRECORDED,
    risks: admittedRisks(input.risks ?? {}, input.admittedBy),
    customRisks: (input.customRisks ?? []).map((entry, index) =>
      asCustomRisk(entry, index, input.admittedBy),
    ),
    resuscitation: { kind: 'no_decision_recorded' },
    eolc: NO_LIST,
    isolation: NO_LIST,
    gp: UNRECORDED,
    pharmacy: UNRECORDED,
    consultants: NO_LIST,
    primaryLanguage: UNRECORDED,
    communicationNeeds: UNRECORDED,
    religion: UNRECORDED,
    culturalBackground: UNRECORDED,
    dietaryRequirements: UNRECORDED,
    importantPeople: {
      nextOfKin: UNRECORDED,
      emergencyContact: UNRECORDED,
      lpaHolder: UNRECORDED,
      socialWorker: UNRECORDED,
      advocate: UNRECORDED,
      familyWithVisitingRights: NO_LIST,
      otherProfessionals: NO_LIST,
    },
    futurePlans: {
      preferredPlaceOfCare: UNRECORDED,
      preferredPlaceOfDeath: UNRECORDED,
      resuscitation: { kind: 'no_decision_recorded' },
      advanceCarePlan: UNRECORDED,
      adrt: UNRECORDED,
      funeralPreferences: UNRECORDED,
      religiousPreferences: UNRECORDED,
      contactOnDeath: UNRECORDED,
    },
    carePlan: admittedCarePlan(input.carePlan ?? {}, input.admittedBy),
    /*
     * **Drafts, never signed versions.** Finalising is what makes a version
     * what staff follow, and nobody can say that on the day somebody arrives:
     * it is signed later from the resident's own tab, by whoever has worked
     * with them. What admission writes reads as part-written everywhere,
     * which is what it is.
     */
    customCarePlan: (input.customCarePlan ?? []).map((entry, index) =>
      asCustomDomain(entry, index, input.admittedBy),
    ),
    consents: blankConsents(),
    // Nobody has scheduled a review for somebody admitted today, and a date
    // invented here would be a deadline nobody set.
    carePlanReview: { kind: 'never_scheduled' },
  }

  admitted.push(resident)
  return resident
}

/**
 * What starts unrecorded, and where each of them is recorded.
 *
 * **This list is the phase's argument rather than a courtesy.** Admission does
 * not create a complete record; it creates a person and a set of gaps, and the
 * form saying so is what stops a manager expecting otherwise.
 *
 * Medication's destination is not a module in this product. Prescribing is a
 * clinical act by a prescriber, and naming a screen for it would be the same
 * mistake as offering a control that does nothing.
 */
export const ADMISSION_GAPS: { what: string; where: string }[] = [
  { what: 'Resuscitation decision', where: 'Future plans' },
  {
    what: `${RISK_ASSESSMENT_TEMPLATES.length} risk assessments`,
    where: 'Risk assessments',
  },
  { what: `${CARE_PLAN_DOMAINS.length} care plan domains`, where: 'Care plan' },
  { what: `${CONSENT_TYPES.length} consents`, where: 'Consent' },
  { what: 'GP, pharmacy and consultants', where: 'General information' },
  { what: 'Next of kin and important people', where: 'Important people' },
  { what: 'Diagnoses and medical history', where: 'General information' },
  { what: 'Medication', where: 'Prescriber, not here' },
]

/** Where a recorded negative on allergies can honestly have come from. */
export const ALLERGY_SOURCES = [
  'the resident themselves',
  'family',
  'a GP letter',
  'a hospital discharge summary',
  'a care home transfer summary',
] as const
