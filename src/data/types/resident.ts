/**
 * The resident record. Fields from source PRD §16.2, verbatim.
 *
 * The rule applied throughout: anything clinical or compliance-related is a
 * closed union with an unrecorded member. Only genuinely-always-present
 * identity facts — id, legal name, date of birth, site — are plain values,
 * because a resident cannot be admitted without them.
 *
 * Everything else a care home might simply not have got round to recording
 * (NHS number, GP, pharmacy, dietary requirements) is `Recorded<T>`, so the
 * screen has to say "not recorded" rather than render an empty row.
 */

import type {
  ConsentMethod,
  IsoDate,
  IsoDateTime,
  Recorded,
  ResidentId,
  ReviewState,
  RiskStatus,
  ResuscitationStatus,
  ConsentRecord,
  DocumentId,
  SiteId,
  StaffRef,
} from './index'
import type {
  AllergyStatus,
  CarePlanDomainRecord,
  CarePlanReviewState,
  EolcStatus,
  IsolationStatus,
  MoodRecord,
  PhotoStatus,
  RecordedList,
} from './clinical'
import type {
  CareNoteCategoryId,
  ContactMethodId,
  FundingSourceId,
  RiskTemplateId,
} from './reference'

// ---------------------------------------------------------------------------
// Supporting records
// ---------------------------------------------------------------------------

export interface ContactDetails {
  phone: string
  email: string
}

/** Source PRD §16.2 — every Important Person carries one of these. */
export interface CommunicationPreference {
  method: ContactMethodId
  language: string
}

export interface GpRecord {
  name: string
  practice: string
  contact: ContactDetails
}

export interface PharmacyRecord {
  name: string
  contact: ContactDetails
}

export interface ProfessionalContact {
  name: string
  role: string
  organisation: string
  contact: ContactDetails
}

export type LpaType = 'health_and_welfare' | 'financial'

export interface ImportantPerson {
  name: string
  relationship: string
  contact: ContactDetails
  address: string
  isPrimaryContact: boolean
  communicationPreference: Recorded<CommunicationPreference>
}

export interface LpaHolder extends ImportantPerson {
  lpaType: LpaType
  documentId: DocumentId
}

export interface SocialWorker {
  name: string
  localAuthority: string
  contact: ContactDetails
  reviewState: ReviewState
  communicationPreference: Recorded<CommunicationPreference>
}

/**
 * Important People. Each category is `Recorded<T>` rather than an optional
 * field or an empty array, so "no LPA holder recorded" is distinguishable
 * from "this resident has no LPA" — which are different legal situations.
 */
export interface ImportantPeople {
  nextOfKin: Recorded<ImportantPerson>
  emergencyContact: Recorded<ImportantPerson>
  lpaHolder: Recorded<LpaHolder>
  socialWorker: Recorded<SocialWorker>
  advocate: Recorded<ImportantPerson>
  familyWithVisitingRights: RecordedList<ImportantPerson>
  otherProfessionals: RecordedList<ProfessionalContact>
}

// ---------------------------------------------------------------------------
// Future plans — source PRD §16.2
// ---------------------------------------------------------------------------

export interface SignedEntry<T> {
  value: T
  signedBy: StaffRef
  signedOn: IsoDate
  version: number
}

export interface FuturePlans {
  preferredPlaceOfCare: Recorded<SignedEntry<string>>
  preferredPlaceOfDeath: Recorded<SignedEntry<string>>
  resuscitation: ResuscitationStatus
  advanceCarePlan: Recorded<SignedEntry<string>>
  adrt: Recorded<SignedEntry<{ text: string; documentId: DocumentId }>>
  funeralPreferences: Recorded<SignedEntry<string>>
  religiousPreferences: Recorded<SignedEntry<string>>
  contactOnDeath: Recorded<SignedEntry<string>>
}

// ---------------------------------------------------------------------------
// Care notes and medication — the parts Phase 1 renders
// ---------------------------------------------------------------------------

export type CareNoteId = `note-${string}`

/**
 * A care note. Immutable after submission (CLAUDE.md §6): there is no edit
 * control, only a correction note that links back and marks the original
 * superseded while leaving it visible.
 */
export interface CareNote {
  id: CareNoteId
  residentId: ResidentId
  category: CareNoteCategoryId
  body: string
  mood: MoodRecord
  recordedBy: StaffRef
  recordedAt: IsoDateTime
  shift: NoteShift
  /** Flagged for senior review, and whether that review has happened. */
  review: CareNoteReview
  /** Set when a later correction note supersedes this one. */
  supersededBy: CareNoteId | 'none'
  /** Set when this note is itself a correction of an earlier one. */
  corrects: CareNoteId | 'none'
}

/**
 * Which shift a note was written on, and whether anybody changed it.
 *
 * PRD §6.3: shift is "auto from diGi-Time fixture, editable with reason".
 *
 * **The union is the shift field itself**, not a second field beside it, so
 * there is no way to record a shift without recording where it came from. A
 * plain `shift: Shift` plus an optional reason would allow a note whose shift
 * had been changed to look identical to one that never was, which is the
 * Evidence Invariant failing in a place nobody would think to look: the
 * evidence missing is not the shift, it is the fact that it was overridden.
 *
 * `clockSaid` is why this is not merely `{ kind: 'overridden'; reason }`. The
 * full fact is "recorded on the late shift, though the clock said night,
 * because handover overran". Without it the record shows a shift and a reason
 * with nothing to compare against, and a reader cannot tell what was actually
 * corrected or by how much.
 *
 * There is no separate author or timestamp: an override happens as the note is
 * written, by whoever is writing it, and the note already carries both.
 * Backdating or reattributing an override would need a correction note, which
 * is the only way anything about a submitted note changes.
 */
export type Shift = 'early' | 'late' | 'night'

export type NoteShift =
  | { kind: 'auto'; value: Shift }
  | {
      kind: 'overridden'
      value: Shift
      /** What the clock said before somebody changed it. */
      clockSaid: Shift
      /** Non-empty by contract: an override with no reason is not editable
       *  with reason, it is just editable. The composer enforces it. */
      reason: string
    }

/**
 * Whether a care note was escalated, and what came of it.
 *
 * **`reviewed` carries the flag as well as the review**, and that is the whole
 * point of the shape. A review that erased who raised it would be half a
 * record rendering as a whole one: "Reviewed by M. Halloran" alone reads as
 * routine sign-off, where "flagged by C. Nwosu on 19/08, reviewed by
 * M. Halloran on 21/08" is the supervision record — and the gap between the
 * two is what an inspector asks about.
 *
 * It also makes two states distinguishable that a single reviewer field
 * cannot tell apart: a second opinion given by somebody else, and a note whose
 * author flagged and then cleared it themselves. Both are legitimate; they are
 * not the same claim.
 */
export type CareNoteReview =
  | { kind: 'not_flagged' }
  | {
      kind: 'flagged_not_reviewed'
      flaggedBy: StaffRef
      flaggedAt: IsoDateTime
      reason: FlagReason
    }
  | {
      kind: 'reviewed'
      /** Who asked for the second opinion, carried forward from the flag. */
      flaggedBy: StaffRef
      flaggedAt: IsoDateTime
      /** Why they asked, carried forward with it. */
      reason: FlagReason
      reviewedBy: StaffRef
      reviewedAt: IsoDateTime
      outcome: ReviewOutcome
    }

/**
 * Why somebody flagged a note, in their own words, or that they gave none.
 *
 * **Optional to give, never optional in the record.** CW PRD CN-02 asks "Why
 * are you flagging this?" and lets it be skipped. Skipping is a fact about the
 * flag: `not_given` renders as "No reason given", never as an empty line that
 * could be a reason nobody loaded.
 */
export type FlagReason = { kind: 'given'; text: string } | { kind: 'not_given' }

/**
 * What the senior who reviewed a flagged note did about it. CW PRD CN-01's
 * "Action taken?", chosen from four.
 *
 * **Recorded, never inferred.** "Care plan updated" and "Incident raised" are
 * what the reviewer said they did; this build does not check the care plan or
 * the incident log to see whether they did, and nothing here raises an incident
 * or edits a plan. `other` carries its words, and cannot be recorded without
 * them.
 */
export type ReviewOutcome =
  | { kind: 'no_further_action' }
  | { kind: 'care_plan_updated' }
  | { kind: 'incident_raised' }
  | { kind: 'other'; text: string }

/**
 * The four, in the order the review control offers them.
 *
 * **Keyed by outcome first, so a fifth outcome without a label is a compile
 * error.** A list checked only with `satisfies` confirms each entry is a real
 * outcome and says nothing about an outcome with no entry.
 */
const REVIEW_OUTCOME_LABELS = {
  no_further_action: 'No further action needed',
  care_plan_updated: 'Care plan updated',
  incident_raised: 'Incident raised',
  other: 'Other',
} as const satisfies Record<ReviewOutcome['kind'], string>

export const REVIEW_OUTCOMES = (
  Object.keys(REVIEW_OUTCOME_LABELS) as ReviewOutcome['kind'][]
).map((id) => ({ id, label: REVIEW_OUTCOME_LABELS[id] }))

export type MedicationId = `med-${string}`

/**
 * A scheduled medication. Phase 1 renders only "due in the next 2 hours" on
 * the profile header; Phase 3 builds the full MAR grid on top of this.
 */
export interface Medication {
  id: MedicationId
  residentId: ResidentId
  name: string
  /** How the dose reads to a person: '2.5mg', '2 puffs', '1g'. */
  dose: string
  /**
   * The same dose as a number, in `stockUnit`.
   *
   * Held beside the display string rather than parsed out of it. '2.5mg', '2
   * puffs' and '1g' cannot be turned into a register quantity without
   * inventing the figure, and a manufactured number in a controlled drug
   * register is worse than no register.
   */
  doseQuantity: number
  /**
   * What the balance is counted in: 'ml', 'tablets', 'patches'.
   *
   * On the drug, not on the count. A count records what was found; the unit is
   * a property of the thing being counted. A balance of 28 that could be
   * millilitres or tablets is a wrong clinical figure, so nothing renders the
   * figure without it.
   */
  stockUnit: string
  /** Form and strength as the register lists it: '10mg/5ml · oral solution'. */
  form: string
  route: string
  /** 24-hour times, in the SITE's zone: ['08:00', '20:00']. */
  /** Non-empty: a scheduled medication with no rounds is not scheduled. */
  roundTimes: [string, ...string[]]
  /**
   * The most a resident may have in 24 hours, counted in `stockUnit`.
   *
   * **`not_applicable` is a claim, not an absence.** It says the schedule is
   * the limit — this drug is given at fixed times and there is no separate
   * ceiling — which is a real statement about a scheduled drug. The field is
   * present on every medication rather than absent for scheduled ones so that
   * giving a scheduled drug its own ceiling later (paracetamol at 4g a day is
   * a real prescription) needs no change to the union.
   *
   * `not_recorded` is the gap that matters, and it is a different kind of gap
   * from a missing field: **the system cannot tell anybody when a further dose
   * would exceed a maximum nobody wrote down.** It is a safety check that
   * cannot run, so the prescription screen turns critical on it.
   *
   * Counted in `stockUnit` because that is the only unit an administered dose
   * can be counted against. "4g" reads better and can be checked against
   * nothing; where the display wants the dose's terms it derives them.
   */
  maximumIn24Hours:
    | { kind: 'not_applicable' }
    | { kind: 'recorded'; quantity: number }
    | { kind: 'not_recorded' }

  /** Who prescribed it, and from where. */
  prescriber: Recorded<{ name: string; organisation: string }>

  /**
   * The day the prescription started. Required, because every real
   * prescription has one — and it is what the MAR history is generated from,
   * so a chart cannot hold a dose from before the drug was prescribed.
   */
  startedOn: IsoDate

  /** Where it is kept. A controlled drug's answer is not the trolley. */
  storage: Recorded<string>

  /** Anything the prescription says about how to give it. */
  instructions: Recorded<string>

  /** The scanned prescription, or the fact that there is not one. */
  prescriptionDocument:
    | { kind: 'not_on_file' }
    | {
        kind: 'on_file'
        documentId: DocumentId
        scannedOn: IsoDate
        scannedBy: StaffRef
      }

  /**
   * How many days apart the doses are. `1` is every day.
   *
   * **A fentanyl patch is changed every third day, and giving one daily would
   * be an overdose.** Without an interval, `roundTimes` said only *what time*
   * a drug runs, so every drug ran every day and the register showed thirty
   * patches administered in thirty days — a clinically wrong record, not a
   * thin one.
   *
   * On the days between, the MAR cell is `not_due`, which is a real state
   * rather than a blank: nobody missed that dose, because there was no dose.
   */
  intervalDays: number
  isControlledDrug: boolean
  isPrn: boolean
}

/**
 * A movement of controlled drug stock that is not an administration and not a
 * count. PRD §6.4.
 *
 * The register's whole purpose is a running total, and a total only runs if
 * everything that moves the stock is on it. Without these a register showing an
 * opening count on 15/08 and a routine count on 22/08 with nothing between
 * asserts that nothing happened — and doses were given.
 *
 * Two signatures on both, for the same reason a count needs two.
 */
export type RegisterMovement =
  | {
      kind: 'received'
      medicationId: MedicationId
      /** Where it came from. A receipt from nobody is not a receipt. */
      from: string
      quantity: number
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
    }
  | {
      kind: 'disposed'
      medicationId: MedicationId
      /** Why it left the cabinet, in words. */
      reason: string
      quantity: number
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
    }

/**
 * A controlled drug stock count. Two signatures, always.
 *
 * A count with one signature is one person's word about a cabinet only they
 * looked in, which is the thing a controlled drug register exists to prevent.
 * `countedBy` and `witnessedBy` are both required, and callers must reject a
 * count where they are the same person.
 */
export interface StockCount {
  medicationId: MedicationId
  countedAt: IsoDateTime
  countedBy: StaffRef
  witnessedBy: StaffRef
  /**
   * What kind of count this is, and — for a routine one — what the register
   * said it should come to.
   *
   * **`expected` lives inside the union because an opening count has nothing
   * to expect, and that absence is what makes it opening rather than routine.**
   * A routine count without an expected figure cannot be constructed, and an
   * opening count carrying one cannot either. It was a bare `expected: number`,
   * which meant the first count of a drug's life had to invent a figure to
   * compare itself against — and any figure it invented would have made the
   * opening count either a false discrepancy or a false reconciliation.
   */
  entry: { kind: 'opening' } | { kind: 'routine'; expected: number }
  counted: number
}

// ---------------------------------------------------------------------------
// The resident
// ---------------------------------------------------------------------------

/**
 * The four answers somebody can give. Never a further list beyond these.
 *
 * "Another way" is deliberately not a taxonomy. A list of further options is
 * something somebody picks from on the day they know least, which puts words
 * in their mouth; a person who wants to say more says it in their own words,
 * in the record rather than in an enum.
 */
export const GENDER_ANSWERS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'another_way', label: 'Another way' },
  { id: 'prefers_not_to_say', label: 'Prefers not to say' },
] as const

export type GenderAnswer = (typeof GENDER_ANSWERS)[number]['id']

export interface Resident {
  id: ResidentId
  siteId: SiteId

  // Identity — always present; a resident cannot be admitted without these.
  fullLegalName: string
  preferredName: string
  dateOfBirth: IsoDate
  admittedOn: IsoDate

  // Identity that may genuinely not have been recorded yet.
  photo: PhotoStatus
  /**
   * Gender. Phase 24.
   *
   * **"Prefers not to say" is a recorded answer and sits beside the other
   * three, never merged with the gap.** Somebody who declined was asked and
   * chose; somebody nobody has asked is a hole in the record. That is Rule 3
   * on the field where conflating them is most tempting, because both render
   * as nothing being known and only one of them is a question still owed.
   *
   * **A closed union rather than free text**, which is what makes that
   * distinction expressible at all: a string cannot tell an empty box from a
   * declined answer.
   *
   * **Separate from `pronouns`, beside it, and separate from sex, which this
   * build does not hold.** Sex has clinical uses — screening, dosing,
   * reference ranges — and no screen here has one. A field nobody has decided
   * how to protect is how a care system starts holding data it was not built
   * for.
   */
  gender: Recorded<GenderAnswer>
  pronouns: Recorded<string>
  nhsNumber: Recorded<string>
  room: Recorded<string>
  anticipatedLengthOfStay: Recorded<string>
  fundingSource: Recorded<FundingSourceId>

  // Clinical
  allergies: AllergyStatus
  primaryDiagnosis: Recorded<string>
  secondaryDiagnoses: RecordedList<string>
  medicalHistory: Recorded<string>

  // Badge strip — every one a closed union, every one always rendered.
  risks: Record<RiskTemplateId, RiskStatus>
  resuscitation: ResuscitationStatus
  eolc: EolcStatus
  isolation: IsolationStatus

  // Professional contacts
  gp: Recorded<GpRecord>
  pharmacy: Recorded<PharmacyRecord>
  consultants: RecordedList<ProfessionalContact>

  // Person
  primaryLanguage: Recorded<string>
  communicationNeeds: Recorded<string>
  religion: Recorded<string>
  culturalBackground: Recorded<string>
  dietaryRequirements: Recorded<string>

  // Related records
  importantPeople: ImportantPeople
  futurePlans: FuturePlans
  carePlan: CarePlanDomainRecord[]
  /**
   * The eight consents, each knowing its own type.
   *
   * A mapped type rather than a `Record`, so a consent of type `K` can only
   * carry an authority whose capacity assessment names `K`. Blanket capacity
   * is not expressible.
   */
  consents: ConsentRecord
  carePlanReview: CarePlanReviewState
}

/** What `consented` needs; re-exported so fixtures have one import site. */
export type { ConsentMethod }
