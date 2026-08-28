import type { CarePlanDomainId } from './reference'
import type {
  GoalId,
  GoalProgressNoteId,
  IsoDate,
  IsoDateTime,
  ResidentId,
  StaffRef,
} from './primitives'

/**
 * Goals. PRD §6.7, Phase 8.
 *
 * **The first record in this build whose subject is the resident's own
 * intention rather than a clinical account of them.** Everything else — a care
 * note, an assessment, an incident — is somebody's account of a resident. A
 * goal is what the resident says they want, so the questions this module can
 * get wrong are questions about a person rather than about a home.
 *
 * ## A goal is not an agreed action, and the difference is three things
 *
 * The care plan's third field is what staff will do; a goal is what the
 * resident is trying to become.
 *
 *  - **A care plan action is standing; a goal is finite.** "Offer an arm on
 *    the corridor" is done every shift, forever. "Walk to the dining room
 *    without my frame by Christmas" happens once or not at all.
 *  - **An action is the home's method; a goal is the resident's intention.**
 *  - **An action cannot fail.** Whether it was followed is a compliance
 *    question about the home. Whether a goal was achieved is a question about
 *    a person, and the answer may be no for reasons that are nobody's failure.
 *
 * So a goal that reads "staff will offer an arm" is a mis-filed care plan
 * action, and `statement` is written in the first person to make that visible.
 * The link to a domain is deliberately **thin**: the goal is the outcome, the
 * domain holds the method, and a goal that restates the domain's agreed
 * actions is the same record in two places.
 */

/**
 * What the resident said about the decision to close their goal.
 *
 * **`not_asked` is a real member and it is the default.** Every other record in
 * this build is somebody's account of a resident; this one is a claim about
 * whether a person got what *they* wanted, and staff marking a goal achieved
 * over somebody who does not think they did is the invariant failing in the
 * one place where the subject is the person themselves.
 *
 * It applies to **every** closing state, not only `achieved`. "Stopped by the
 * service" with the resident not asked is the sharpest version of it: somebody
 * decided to stop working on what this person wanted, and nobody put it to
 * them. A family reading the record later is entitled to know which.
 *
 * Not asked is not the same as agreed, and it renders as the gap it is.
 */
export type ResidentView =
  { kind: 'agreed' } | { kind: 'disagreed'; note: string } | { kind: 'not_asked' }

/**
 * When the goal is meant to be reached by.
 *
 * A union, because **a goal with no date can never be late** — and a screen
 * that leads on "passed its date with nothing recorded" would silently never
 * show it. "No date set" must read as the gap it is rather than as "not yet
 * due", which is the same blank meaning two things that every other date field
 * in this build refuses.
 */
export type GoalTarget = { kind: 'by_date'; on: IsoDate } | { kind: 'no_target_date' }

/** Which part of the care plan holds the method for this goal. */
export type GoalDomainLink =
  | { kind: 'domain'; domainId: CarePlanDomainId }
  /** Nobody filed it under one. A real state, never defaulted to a domain. */
  | { kind: 'not_linked' }

/** The record of a goal ending: when, who wrote it down, and what happened. */
export interface GoalEnding {
  on: IsoDate
  by: StaffRef
  /** What happened, in a sentence. Never blank on a closed goal. */
  note: string
}

/**
 * An ending somebody decided *about* the resident, so it carries their view.
 *
 * Four of the five closures are decisions taken about a person's goal —
 * achieved, not achieved, stopped by the service — and each of them can be
 * made without asking them. That is what `residentView` is for.
 */
export interface GoalClosure extends GoalEnding {
  residentView: ResidentView
}

/**
 * What somebody decided about this goal — and nothing else.
 *
 * **There is no `in_progress` member, deliberately.** As a stored status it is
 * the stalest claim in the product: set once, never revisited, and a goal
 * nobody has touched in eight months still saying somebody is working on it.
 * Progress is derived from the progress notes, which carry their own dates and
 * authors, so it cannot go stale — and the module's lead finding is derived
 * with it.
 *
 * **`abandoned` is two states wearing one word**, and they are opposite in the
 * way that matters to the person. `withdrawn_by_resident` is somebody
 * exercising a right over their own life; `stopped_by_service` is something
 * that happened to them. Merged, a family cannot be told which it was — the
 * collapse this build exists to prevent, applied to somebody's own intention
 * rather than to a clinical record.
 */
export type GoalOutcome =
  | { kind: 'open' }
  | { kind: 'achieved'; closed: GoalClosure }
  | { kind: 'not_achieved'; closed: GoalClosure }
  /**
   * **No `residentView`, because the withdrawal *is* the resident's view.**
   *
   * Asking "and what did the resident think of that?" about their own decision
   * is incoherent whichever value it takes — `not_asked` is impossible, and
   * `agreed` is a person agreeing with themselves. The type says so rather
   * than a fixture guard saying so, because making the illegal state
   * unrepresentable is the stronger form of the same claim: a guard reports
   * the mistake after somebody writes it, and this stops them writing it.
   */
  | { kind: 'withdrawn_by_resident'; closed: GoalEnding }
  | { kind: 'stopped_by_service'; closed: GoalClosure }

/**
 * One entry on a goal's timeline.
 *
 * **Its own record rather than a filtered view of care notes.** A timeline
 * built from filtered care notes would inherit Rule 3c and start making claims
 * it did not mean to: a gap in "notes about this goal" is not a gap in the
 * care record, and a screen that renders one as the other is asserting an
 * absence that is an artefact of the filter. Two note-shaped things is the
 * smaller cost.
 *
 * Immutable like a care note, for the same reason: it is somebody's account of
 * a moment, and editing it rewrites what they saw.
 */
export interface GoalProgressNote {
  id: GoalProgressNoteId
  goalId: GoalId
  body: string
  recordedBy: StaffRef
  recordedAt: IsoDateTime
}

export interface Goal {
  id: GoalId
  residentId: ResidentId
  /**
   * What this person wants, **in their own words**. First person.
   *
   * "I want to get to the garden on my own" — not "resident to mobilise
   * independently to the garden". A goal written about somebody in clinical
   * language is one they cannot recognise as theirs, and this is the one
   * record in the build that is theirs.
   */
  statement: string
  /** Why it matters to them. Also their words. */
  whyItMatters: string
  /**
   * How anybody will know it has happened — the one field written to staff.
   *
   * Without it "achieved" is an opinion. It is the goal's equivalent of the
   * care plan's agreed actions: the same three-field shape, two in the
   * resident's voice and one in the home's.
   */
  howWeWillKnow: string
  target: GoalTarget
  domain: GoalDomainLink
  setBy: StaffRef
  setOn: IsoDate
  outcome: GoalOutcome
}
