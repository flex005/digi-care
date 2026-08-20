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
  ConsentStatus,
  DocumentId,
  SiteId,
  StaffRef,
} from './index'
import type {
  AllergyStatus,
  CarePlanDomainRecord,
  EolcStatus,
  IsolationStatus,
  MoodRecord,
  PhotoStatus,
  RecordedList,
} from './clinical'
import type {
  CareNoteCategoryId,
  ConsentTypeId,
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
  shift: 'early' | 'late' | 'night'
  /** Flagged for senior review, and whether that review has happened. */
  review: CareNoteReview
  /** Set when a later correction note supersedes this one. */
  supersededBy: CareNoteId | 'none'
  /** Set when this note is itself a correction of an earlier one. */
  corrects: CareNoteId | 'none'
}

export type CareNoteReview =
  | { kind: 'not_flagged' }
  | { kind: 'flagged_not_reviewed'; flaggedBy: StaffRef; flaggedAt: IsoDateTime }
  | { kind: 'reviewed'; reviewedBy: StaffRef; reviewedAt: IsoDateTime }

export type MedicationId = `med-${string}`

/**
 * A scheduled medication. Phase 1 renders only "due in the next 2 hours" on
 * the profile header; Phase 3 builds the full MAR grid on top of this.
 */
export interface Medication {
  id: MedicationId
  residentId: ResidentId
  name: string
  dose: string
  route: string
  /** 24-hour times, in the SITE's zone: ['08:00', '20:00']. */
  /** Non-empty: a scheduled medication with no rounds is not scheduled. */
  roundTimes: [string, ...string[]]
  isControlledDrug: boolean
  isPrn: boolean
}

/** A controlled drug stock count. A mismatch is a recorded discrepancy. */
export interface StockCount {
  medicationId: MedicationId
  countedAt: IsoDateTime
  countedBy: StaffRef
  expected: number
  counted: number
}

// ---------------------------------------------------------------------------
// The resident
// ---------------------------------------------------------------------------

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
  consents: Record<ConsentTypeId, ConsentStatus>
  carePlanReview: ReviewState
}

/** What `consented` needs; re-exported so fixtures have one import site. */
export type { ConsentMethod }
