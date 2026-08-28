import type {
  Goal,
  GoalProgressNote,
  GoalTarget,
  IsoDate,
  IsoDateTime,
  ResidentView,
  StaffRef,
} from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { wholeDaysBetween } from '@/lib/review-interval'

/**
 * Where a goal has got to, derived. PRD §6.7, Phase 8.
 *
 * **Nothing here is stored**, and that is the point: `in_progress` was removed
 * from `GoalOutcome` because as a recorded status it is the stalest claim in
 * the product — set once, never revisited, and a goal nobody has touched in
 * eight months still saying somebody is working on it. Progress is read from
 * the progress notes, which carry their own dates and authors.
 */

/**
 * How long before a review somebody should have been asked.
 *
 * **From admission, and only from admission.** "Past its target date with
 * nothing recorded" needs no constant at all — the date is the threshold, and
 * it is the goal's own. Reusing one number for both because they happen to be
 * the same number is how two meanings end up moving together when only one of
 * them should.
 *
 * Invented, named, and folded under open item §9.2b with the other three.
 */
export const NO_GOALS_ALERT_DAYS = 30

/** The last thing anybody wrote about this goal, or nothing. */
export type GoalProgress =
  { kind: 'none' } | { kind: 'some'; at: IsoDateTime; by: StaffRef; count: number }

/**
 * The chip: what state the *work* is in.
 *
 * Deliberately separate from the target date, which is its own fact rendered
 * in its own place. A goal with no date and no progress has two things to say
 * and Rule 3a says it says both — merged into one chip, whichever word won
 * would hide the other.
 */
export type GoalStanding =
  | {
      /** Open, past its date. Nobody has said whether it happened. */
      kind: 'past_target'
      on: IsoDate
      daysPast: number
      progress: GoalProgress
    }
  /** Open, and somebody is writing about it. */
  | { kind: 'moving'; progress: Extract<GoalProgress, { kind: 'some' }> }
  /** Open, in time or undated, and nobody has written anything yet. */
  | { kind: 'nothing_yet'; setOn: IsoDate; daysSinceSet: number }
  | {
      kind: 'closed'
      outcome: Exclude<Goal['outcome']['kind'], 'open'>
      on: IsoDate
      by: StaffRef
      note: string
      /**
       * Absent on a withdrawal, and the type is why.
       *
       * The withdrawal *is* the resident's view; asking what they thought of
       * their own decision is incoherent whichever value it takes.
       */
      residentView: ResidentView | 'not_applicable'
    }

export function goalStanding(
  goal: Goal,
  progressNotes: GoalProgressNote[],
  now: IsoDateTime,
): GoalStanding {
  const outcome = goal.outcome
  if (outcome.kind !== 'open') {
    return {
      kind: 'closed',
      outcome: outcome.kind,
      on: outcome.closed.on,
      by: outcome.closed.by,
      note: outcome.closed.note,
      residentView:
        outcome.kind === 'withdrawn_by_resident'
          ? 'not_applicable'
          : outcome.closed.residentView,
    }
  }

  const progress = lastProgress(progressNotes)
  const today = now.slice(0, 10) as IsoDate

  if (goal.target.kind === 'by_date') {
    const daysPast = wholeDaysBetween(goal.target.on, today)
    if (daysPast > 0) {
      // The lead finding, and it does not depend on whether anybody has
      // written a progress note: the date passed and nobody said what
      // happened. A trail of notes that stops short of an outcome is still
      // nobody saying.
      return { kind: 'past_target', on: goal.target.on, daysPast, progress }
    }
  }

  if (progress.kind === 'some') return { kind: 'moving', progress }
  return {
    kind: 'nothing_yet',
    setOn: goal.setOn,
    daysSinceSet: wholeDaysBetween(goal.setOn, today),
  }
}

/**
 * The date fact, rendered in its own place.
 *
 * **A goal with no target date can never be late**, so a screen that leads on
 * "past its date" would silently never show it. "No date set" renders as the
 * gap it is and never as "not yet due" — the same blank meaning two things
 * that every other date field in this build refuses.
 */
export type TargetStanding =
  | { kind: 'past'; on: IsoDate; daysPast: number }
  | { kind: 'ahead'; on: IsoDate; daysUntil: number }
  | { kind: 'none' }

export function targetStanding(target: GoalTarget, now: IsoDateTime): TargetStanding {
  switch (target.kind) {
    case 'no_target_date':
      return { kind: 'none' }
    case 'by_date': {
      const today = now.slice(0, 10) as IsoDate
      const daysPast = wholeDaysBetween(target.on, today)
      return daysPast > 0
        ? { kind: 'past', on: target.on, daysPast }
        : { kind: 'ahead', on: target.on, daysUntil: -daysPast }
    }
    default:
      return assertNever(target)
  }
}

/** The most recent note, and how many there are. Oldest-first input. */
export function lastProgress(notes: GoalProgressNote[]): GoalProgress {
  const last = notes.at(-1)
  if (!last) return { kind: 'none' }
  return { kind: 'some', at: last.recordedAt, by: last.recordedBy, count: notes.length }
}

/**
 * Whether "nobody has set a goal" is a claim that can be made about somebody.
 *
 * The same shape as the resident who cannot yet be missing a 48-hour care
 * note: the window has not elapsed, so the answer is not "no problem", it is
 * not yet knowable — and the screen says which.
 */
export function longEnoughToExpectAGoal(
  admittedOn: IsoDate,
  now: IsoDateTime,
): boolean {
  return (
    wholeDaysBetween(admittedOn, now.slice(0, 10) as IsoDate) >= NO_GOALS_ALERT_DAYS
  )
}

/** How long this person has been here, in whole days. */
export function daysSinceAdmission(admittedOn: IsoDate, now: IsoDateTime): number {
  return wholeDaysBetween(admittedOn, now.slice(0, 10) as IsoDate)
}
