import { held, type SessionHolding } from './session-holding'
import type {
  CarePlanDomainId,
  CarePlanReviewState,
  CompletedAgainst,
  IsoDate,
  Resident,
  ResidentId,
  StaffRef,
} from '../types'

/**
 * Whole care plan reviews completed during this session. PRD §6.7.
 *
 * **The meeting, not the plan.** Finalising a domain is one act; this is the
 * other — sitting down with somebody and going through all ten.
 *
 * ## Why a review can be completed over gaps, and what that costs
 *
 * The handover signature pattern exactly. Signing a handover with six
 * residents nobody looked at is permitted, loudly, and the signature stores
 * the counts so it can never later read as covering more than it did.
 *
 * **Refusing** would mean the meeting happened and the system holds no
 * evidence of it — and a review meeting happens *because* there are gaps, so
 * refusing is refusing to record the normal case. **Permitting it silently**
 * would let "care plan reviewed" sit over three domains nobody has written.
 * Storing the gaps at the moment of signing is the only version that is still
 * true afterwards.
 *
 * Same discipline as the other five stores: in memory, never touching the
 * fixtures, gone on reload, and the screen that writes says so.
 */

interface Completion {
  by: StaffRef
  on: IsoDate
  nextDueOn: IsoDate
  /** What it was completed against — a date, or nothing was ever set. */
  against: CompletedAgainst
  outstanding: CarePlanDomainId[]
}

const completions = new Map<ResidentId, Completion>()

export interface WholePlanReviewToken {
  residentId: ResidentId
}

export function completeWholePlanReview(input: {
  residentId: ResidentId
  by: StaffRef
  on: IsoDate
  nextDueOn: IsoDate
  against: CompletedAgainst
  outstanding: CarePlanDomainId[]
}): WholePlanReviewToken {
  completions.set(input.residentId, {
    by: input.by,
    on: input.on,
    nextDueOn: input.nextDueOn,
    against: input.against,
    outstanding: input.outstanding,
  })
  return { residentId: input.residentId }
}

/** Takes it back. There is no backend to correct a mis-click. */
export function undoWholePlanReview(token: WholePlanReviewToken): void {
  completions.delete(token.residentId)
}

/** One resident, with this session's whole-plan review applied. */
export function withSessionWholePlanReview(resident: Resident): Resident {
  const completion = completions.get(resident.id)
  if (!completion) return resident

  const carePlanReview: CarePlanReviewState = {
    kind: 'completed',
    completedOn: completion.on,
    completedBy: completion.by,
    against: completion.against,
    nextDueOn: completion.nextDueOn,
    outstanding:
      completion.outstanding.length === 0
        ? { kind: 'none_outstanding' }
        : {
            kind: 'outstanding',
            domains: completion.outstanding as [
              CarePlanDomainId,
              ...CarePlanDomainId[],
            ],
          },
  }

  return { ...resident, carePlanReview }
}

/** Test hook. Nothing in the app calls this. */
/** What this store would lose. */
export function wholePlanHoldings(): SessionHolding[] {
  return held('whole care plan reviews you completed', completions.size)
}

export function resetSessionWholePlanReviews(): void {
  completions.clear()
}
