import type { CarePlanDomainStatus, IsoDate, IsoDateTime, StaffRef } from '@/data/types'
import { wholeDaysBetween } from '@/lib/review-interval'
import { dueSoonDays } from '@/data/access/settings-store'

/**
 * When a finalised domain is approaching its review date.
 *
 * **Derived, never a member of `CarePlanDomainStatus`.** "Due soon" is not a
 * recorded fact: nobody wrote it down, and it changes on its own as the clock
 * moves. A union member asserts something about the record; this is arithmetic
 * on a date the record already holds. Adding one would also force every
 * existing `complete` branch to decide about a state nobody recorded.
 *
 * ## Why this is not the same as `ReviewState`, and must not be "fixed" into it
 *
 * `ReviewState` has `due` and `overdue` as real members because a *review* has
 * a scheduling lifecycle of its own — never scheduled, scheduled, due,
 * overdue, completed — and each of those is something somebody did or did not
 * do. `CarePlanDomainStatus` is about **the plan**, not about the review of
 * it: not started, in progress, complete, past its date.
 *
 * Two different things, correctly at different granularities. The next person
 * to notice the asymmetry should read this rather than reconcile it.
 */

/**
 * What a domain's review timing is, for display only.
 *
 * `overdue` and `not_started` come straight from the status. `due_soon` is the
 * derived one, and `settled` is everything else.
 */
export type ReviewTiming =
  | { kind: 'not_started' }
  | { kind: 'in_progress'; updatedBy: StaffRef; updatedAt: IsoDateTime }
  | { kind: 'due_soon'; signed: Signature; dueOn: IsoDate; daysUntil: number }
  | { kind: 'overdue'; signed: Signature; dueOn: IsoDate; daysOverdue: number }
  | { kind: 'settled'; signed: Signature; nextReviewOn: IsoDate }

/**
 * Who signed the plan this timing is about, and when.
 *
 * Carried on the timing rather than left on the status, so a screen branches
 * once. Reading the branch from here and the signature from there means two
 * narrowings of the same union in the same cell, and the second one is where
 * a `!` or a fallback gets written.
 */
export interface Signature {
  by: StaffRef
  on: IsoDate
}

export function reviewTiming(
  status: CarePlanDomainStatus,
  now: IsoDateTime,
): ReviewTiming {
  switch (status.kind) {
    case 'not_started':
      return { kind: 'not_started' }

    case 'in_progress':
      return {
        kind: 'in_progress',
        updatedBy: status.updatedBy,
        updatedAt: status.updatedAt,
      }

    case 'review_due':
      return {
        kind: 'overdue',
        signed: { by: status.finalisedBy, on: status.finalisedOn },
        dueOn: status.dueOn,
        daysOverdue: status.daysOverdue,
      }

    case 'complete': {
      const signed = { by: status.finalisedBy, on: status.finalisedOn }
      const days = wholeDaysBetween(now.slice(0, 10) as IsoDate, status.nextReviewOn)
      return days <= dueSoonDays()
        ? { kind: 'due_soon', signed, dueOn: status.nextReviewOn, daysUntil: days }
        : { kind: 'settled', signed, nextReviewOn: status.nextReviewOn }
    }
  }
}

/**
 * How loudly each timing renders.
 *
 * **Due soon is the quietest of the three that are not settled.** It is a
 * recorded plan approaching a date — the least urgent, and the one most likely
 * to crowd the two that matter. Never started is a plan that does not exist;
 * overdue is a plan nobody has revisited past the date they set. Those are the
 * findings; due soon is a diary entry.
 */
export const TIMING_EMPHASIS: Record<
  ReviewTiming['kind'],
  'gap' | 'finding' | 'quiet'
> = {
  not_started: 'gap',
  overdue: 'finding',
  in_progress: 'quiet',
  due_soon: 'quiet',
  settled: 'quiet',
}
