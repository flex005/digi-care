export type {
  ConsentMethod,
  DocumentId,
  IsoDate,
  IsoDateTime,
  Organisation,
  OrganisationId,
  ResidentId,
  Site,
  SiteId,
  StaffId,
  StaffRef,
  StaffRole,
} from './primitives'

export type {
  ConsentStatus,
  MarCellState,
  MarEscalation,
  MarWitness,
  NotGivenReason,
  Recorded,
  ResuscitationStatus,
  ReviewState,
  RiskLevel,
  RiskStatus,
} from './state'

export type { Aggregate, Coverage } from './aggregate'
export {
  INSUFFICIENT_EVIDENCE_THRESHOLD,
  coverageRatio,
  isInsufficient,
} from './aggregate'

export type {
  Allergy,
  AllergyStatus,
  CarePlanDomainRecord,
  CarePlanDomainStatus,
  EolcStatus,
  IsolationStatus,
  MoodRecord,
  MoodScore,
  PhotoStatus,
  SupportLevel,
} from './clinical'
export { MOOD_LABELS } from './clinical'

export type {
  CareNote,
  CareNoteId,
  CareNoteReview,
  CommunicationPreference,
  ContactDetails,
  FuturePlans,
  GpRecord,
  ImportantPeople,
  ImportantPerson,
  LpaHolder,
  LpaType,
  Medication,
  MedicationId,
  PharmacyRecord,
  ProfessionalContact,
  Resident,
  SignedEntry,
  SocialWorker,
  StockCount,
} from './resident'

export type {
  CareNoteCategoryId,
  CarePlanDomainId,
  ConsentTypeId,
  ContactMethodId,
  FundingSourceId,
  RiskTemplateId,
} from './reference'
export {
  CARE_NOTE_CATEGORIES,
  CARE_PLAN_DOMAINS,
  CONSENT_TYPES,
  CONTACT_METHODS,
  FUNDING_SOURCES,
  NEED_GROUPS,
  RISK_ASSESSMENT_TEMPLATES,
} from './reference'
