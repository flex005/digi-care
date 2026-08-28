import type {
  CarePlanReviewState,
  CompletedAgainst,
  IsoDate,
  IsoDateTime,
  Resident,
  ReviewState,
  StaffRef,
} from '@/data/types'
import { CARE_PLAN_DOMAINS, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { wholeDaysBetween } from '@/lib/review-interval'
import { dueSoonDays } from '@/data/access/settings-store'

/**
 * Three populations behind one shape. PRD §6.7.
 *
 * A risk assessment review, a care plan domain review and a whole-plan review
 * are different acts done by different screens, and this is the only place
 * they are the same kind of thing. **The projection is the whole module** —
 * the queue is a rendering of it, and the two sessions it routes to already
 * exist.
 *
 * ## The denominator names what it counts, or 533 reads as one kind of thing
 *
 * Every row carries its `kind` above what is being reviewed, and every finding
 * carries the composition. A count over three populations that does not say so
 * is a figure nobody can check.
 *
 * ## The denominator is records that could carry a review date
 *
 * **Reviewability is the property, and it applies to both populations the
 * same way.** A care plan domain nobody has written has nothing to review,
 * exactly as a risk assessment nobody has done has nothing to review. All ten
 * domains and all nine templates are slots that exist for every resident;
 * neither is more of a record than the other, and counting one and not the
 * other was an asymmetry with no rule behind it.
 *
 * So both are out: the denominator is **written domains, assessed risks, and
 * the whole-plan reviews**. Counting the empty slots would inflate it with
 * things that cannot be reviewed and make this screen a partial duplicate of
 * two others — `/care-plans` already leads on domains never written, and the
 * assessment list on risks never assessed.
 *
 * It also sharpens the lead. *"Nobody scheduled a review for a record that
 * exists"* is a cleaner finding than one mixed with records that do not.
 *
 * **Both exclusions are named on the screen**, never silently dropped: a home
 * that has written nothing would otherwise read as a home with nothing
 * overdue.
 */

export type ReviewableKind = 'risk_assessment' | 'care_plan_domain' | 'whole_care_plan'

export const KIND_LABEL: Record<ReviewableKind, string> = {
  risk_assessment: 'Risk assessment',
  care_plan_domain: 'Care plan domain',
  whole_care_plan: 'Whole care plan review',
}

/**
 * Where a review has got to, across all three populations.
 *
 * Deliberately **not** `ReviewState`: that is a stored lifecycle, and two of
 * the three populations do not store one. `due_soon` is arithmetic on a date
 * and `late` on a completion is arithmetic on two, so neither is a member of
 * anything anybody wrote down.
 */
export type ReviewStanding =
  | { kind: 'never_scheduled' }
  | { kind: 'overdue'; dueOn: IsoDate; daysOverdue: number }
  | { kind: 'due_soon'; dueOn: IsoDate; daysUntil: number }
  | { kind: 'scheduled'; dueOn: IsoDate }
  | {
      kind: 'completed'
      on: IsoDate
      by: StaffRef
      against: CompletedAgainst
      nextDueOn: IsoDate
      /** Derived from `on > dueOn`, so doing the work cannot erase it. */
      late: boolean
    }

export interface Reviewable {
  /** Stable across renders and unique across the three populations. */
  id: string
  resident: Resident
  kind: ReviewableKind
  /** "Falls risk", "Mobility and moving and handling", "All ten domains". */
  label: string
  standing: ReviewStanding
  /** The module that owns the act. This phase builds no third session. */
  to: string
  actionLabel: string
}

export interface Projection {
  items: Reviewable[]
  /**
   * The two exclusions, named in the finding and never silently dropped.
   *
   * Neither is in the denominator, for the same reason: there is no review to
   * schedule for a record that does not exist. Both are real gaps and both
   * have a queue that leads on them — the assessment list and `/care-plans`.
   */
  neverAssessed: number
  neverWritten: number
}

export function projectReviews(residents: Resident[], now: IsoDateTime): Projection {
  const today = now.slice(0, 10) as IsoDate
  const items: Reviewable[] = []
  let neverAssessed = 0
  let neverWritten = 0

  for (const resident of residents) {
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      const risk = resident.risks[template.id]
      if (risk.kind !== 'assessed') {
        neverAssessed += 1
        continue
      }
      items.push({
        id: `${resident.id}|risk|${template.id}`,
        resident,
        kind: 'risk_assessment',
        label: template.name,
        standing: fromReviewState(risk.reviewState, today),
        to: `/residents/${resident.id}/risk-assessments/${template.id}`,
        actionLabel: 'Re-score',
      })
    }

    const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
    for (const domain of CARE_PLAN_DOMAINS) {
      const standing = domainStanding(byDomain.get(domain.id), today)
      if (standing === 'not_reviewable') {
        neverWritten += 1
        continue
      }
      items.push({
        id: `${resident.id}|domain|${domain.id}`,
        resident,
        kind: 'care_plan_domain',
        label: domain.name,
        standing,
        to: `/residents/${resident.id}/care-plan/${domain.id}`,
        actionLabel: 'Open domain',
      })
    }

    items.push({
      id: `${resident.id}|plan`,
      resident,
      kind: 'whole_care_plan',
      label: `All ${CARE_PLAN_DOMAINS.length} domains`,
      standing: fromReviewState(resident.carePlanReview, today),
      to: `/residents/${resident.id}/care-plan/review`,
      actionLabel: 'Start review',
    })
  }

  return { items, neverAssessed, neverWritten }
}

/**
 * A stored review lifecycle, placed against today.
 *
 * `scheduled` and `due` both become `due_soon` inside the threshold: the
 * difference between them is where the fixture put the date, not something
 * anybody recorded, and a reader deciding what to do this month does not need
 * two words for it.
 */
function fromReviewState(
  state: ReviewState | CarePlanReviewState,
  today: IsoDate,
): ReviewStanding {
  switch (state.kind) {
    case 'never_scheduled':
      return { kind: 'never_scheduled' }

    case 'overdue':
      return {
        kind: 'overdue',
        dueOn: state.dueOn,
        daysOverdue: state.daysOverdue,
      }

    case 'scheduled':
    case 'due': {
      const daysUntil = wholeDaysBetween(today, state.dueOn)
      if (daysUntil < 0) {
        // Recorded as scheduled and the date has passed. Derived rather than
        // trusted: `overdue` is a stored member and a stored one goes stale.
        return { kind: 'overdue', dueOn: state.dueOn, daysOverdue: -daysUntil }
      }
      return daysUntil <= dueSoonDays()
        ? { kind: 'due_soon', dueOn: state.dueOn, daysUntil }
        : { kind: 'scheduled', dueOn: state.dueOn }
    }

    case 'completed':
      return {
        kind: 'completed',
        on: state.completedOn,
        by: state.completedBy,
        against: state.against,
        nextDueOn: state.nextDueOn,
        // Nothing stores "this was late". Comparing the completion against the
        // date it was due keeps it true rather than true until somebody
        // overwrites it — the same shape as `wasClearedLate`. A review that
        // was never scheduled has nothing to be late against, and saying it
        // was on time would be a claim about a deadline nobody set.
        late:
          state.against.kind === 'due_on' && state.completedOn > state.against.dueOn,
      }

    default:
      return assertNever(state)
  }
}

/**
 * A care plan domain, which carries its dates on the plan rather than on a
 * review — or `not_reviewable` where there is nothing to review.
 *
 * A sentinel rather than a member of `ReviewStanding`, because it is not a
 * standing: it is the reason the record is not in this population at all. As a
 * member it would be a row on a queue about reviews that says a review cannot
 * exist, which is a different screen's finding wearing this screen's shape.
 */
function domainStanding(
  record: Resident['carePlan'][number] | undefined,
  today: IsoDate,
): ReviewStanding | 'not_reviewable' {
  if (!record) return 'not_reviewable'

  switch (record.status.kind) {
    case 'not_started':
    case 'in_progress':
      // Nothing signed, so there is nothing under review. Its own gap, on its
      // own queue — see the docblock above.
      return 'not_reviewable'

    case 'review_due':
      return {
        kind: 'overdue',
        dueOn: record.status.dueOn,
        daysOverdue: record.status.daysOverdue,
      }

    case 'complete': {
      const daysUntil = wholeDaysBetween(today, record.status.nextReviewOn)
      if (daysUntil < 0) {
        return {
          kind: 'overdue',
          dueOn: record.status.nextReviewOn,
          daysOverdue: -daysUntil,
        }
      }
      return daysUntil <= dueSoonDays()
        ? { kind: 'due_soon', dueOn: record.status.nextReviewOn, daysUntil }
        : { kind: 'scheduled', dueOn: record.status.nextReviewOn }
    }

    default:
      return assertNever(record.status)
  }
}

/**
 * Never scheduled first, then longest overdue.
 *
 * The same order as every other queue, and for the same reason: a record
 * nobody set a date for has **no wait to measure**, so it sorts above the ones
 * that do rather than among them.
 */
export function byUrgency(a: Reviewable, b: Reviewable): number {
  const rank = (item: Reviewable) => {
    switch (item.standing.kind) {
      case 'never_scheduled':
        return 0
      case 'overdue':
        return 1
      case 'due_soon':
        return 2
      case 'scheduled':
        return 3
      case 'completed':
        return 4
      default:
        return assertNever(item.standing)
    }
  }

  const difference = rank(a) - rank(b)
  if (difference !== 0) return difference

  const lateness = (item: Reviewable) =>
    item.standing.kind === 'overdue' ? item.standing.daysOverdue : 0
  return lateness(b) - lateness(a)
}

/** Most recent first — the completed list is a record, not a queue of work. */
export function byMostRecent(a: Reviewable, b: Reviewable): number {
  const on = (item: Reviewable) =>
    item.standing.kind === 'completed' ? item.standing.on : ''
  return on(b).localeCompare(on(a))
}
