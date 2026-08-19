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
