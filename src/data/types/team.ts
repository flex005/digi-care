import type {
  IsoDate,
  ResidentId,
  SiteId,
  StaffId,
  StaffRef,
  StaffRole,
} from './primitives'

/**
 * Team management — PRD §6.7, Phase 14.
 *
 * **A `StaffRef` is how somebody appeared on a record; a `StaffMember` is the
 * person.** The ref is snapshotted into thousands of records precisely so
 * records outlive access, and the person's standing changes while the
 * snapshot must not: one answers "how did they appear on this record", the
 * other answers "can they still get in".
 *
 * Which is why `isActive` on the ref stopped being the source of
 * "(deactivated)". It was a fact about *now* stored in a record about *then* —
 * reactivate somebody and every historic note would still call them
 * deactivated.
 */

/**
 * Whether somebody can get into the product, and who decided.
 *
 * Four members, and **only one is quiet**. Having access is unremarkable and
 * renders as plain text; the two that took a decision render settled with when,
 * why and who; and **never having been given access takes the hatch**, because
 * somebody who appears on the record and was never set up is a gap rather than
 * a decision anybody made.
 *
 * **Every member carries its author.** A standing with no author is a flag,
 * not a record — including the gap, which carries whoever put them on the team
 * without granting access.
 */
export type StaffStanding =
  | { kind: 'has_access'; since: IsoDate; grantedBy: StaffRef }
  | {
      kind: 'no_longer_has_access'
      on: IsoDate
      /** In words, and never a code: "left the service". */
      reason: string
      by: StaffRef
    }
  | { kind: 'suspended'; on: IsoDate; reason: string; by: StaffRef }
  | {
      kind: 'never_given_access'
      /** When they were put on the team. Access was never set up after it. */
      addedOn: IsoDate
      addedBy: StaffRef
    }

/**
 * The person.
 *
 * **The minimum, deliberately.** Name, role, site, standing — no start date,
 * no contract type, no employment fields. A field nobody has asked for is a
 * field nobody has decided how to protect, and inventing an employment record
 * is how a care system starts holding HR data it was not built to hold.
 */
/**
 * Which residents a care worker has been given. Phase 18.
 *
 * **Three members, and the blank is a member.** AM v2.0's TM-02 says the field
 * is optional and that leaving it blank means the care worker sees everybody
 * at the site. That is a blank meaning two things in a product built to refuse
 * exactly that: "somebody decided they cover the whole home" and "nobody has
 * decided anything" are opposite facts, and the second is a gap that takes the
 * hatch. So the whole-home answer is a decision with a name and a date on it,
 * like every other decision in this record.
 *
 * **No `not_applicable` member, deliberately.** Assignment is meaningful only
 * for a care worker, and a fourth member saying so would be derivable from the
 * role the record already carries — a second owner of a fact, which is what
 * `ReviewState` was fixed for. The rule lives at the call site instead: the
 * field is rendered only where the role takes one, and a guard holds every
 * other role at `never_set`.
 *
 * **Nothing in this platform reads it to decide anything**, and that is worth
 * knowing rather than discovering. Care workers do not sign in here; the
 * scoping it describes happens in the Care Worker product. Here it is written
 * on the invite drawer and read on the staff profile, and nowhere else.
 * `scripts/check-assignment-reach.mjs` is what keeps that true, because a gap
 * that acquires a name stops being a gap and becomes a performance record.
 */
export type ResidentAssignment =
  | { kind: 'never_set' }
  | {
      kind: 'all_residents_at_site'
      decidedBy: StaffRef
      on: IsoDate
    }
  | {
      kind: 'assigned'
      /** Never empty: an empty list is `never_set` wearing a decision. */
      residents: ResidentId[]
      decidedBy: StaffRef
      on: IsoDate
    }

export interface StaffMember {
  id: StaffId
  /** The same snapshot every record carries, so the two cannot disagree. */
  ref: StaffRef
  role: StaffRole
  /**
   * Every home this person works at, never one. Phase 18.
   *
   * **A list because AM v2.0's TM-04 assigns a Manager to several sites**, and
   * because a single `siteId` made Sandra Chen look like a third role. She is
   * an Admin with five homes: multi-site is an assignment, which is this
   * field, rather than a role.
   *
   * **One role across all of them.** AM v2.0 is explicit — a Manager cannot be
   * an Admin at one site and a Manager at another — and v4 §1.2 says the
   * opposite, a role per site. The newer, screen-level document wins, and the
   * disagreement is recorded rather than resolved silently: if it ever goes
   * the other way this becomes a list of pairs, and every per-site filter
   * changes with it.
   *
   * Never empty. Somebody on the team record works somewhere, and an empty
   * list would be a third meaning for a field that already has to say which
   * homes rather than whether any.
   */
  siteIds: SiteId[]
  standing: StaffStanding
  /**
   * Meaningful for a care worker and `never_set` for everybody else, which is
   * held by a guard rather than by the type. See `ResidentAssignment`.
   */
  residentAssignment: ResidentAssignment
}

/**
 * What a role can do in a module.
 *
 * Four members rather than the source PRD's fifty-four flags, because these
 * are distinctions this build already makes: reading a record, recording one,
 * and approving somebody else's — finalising a care plan, countersigning a
 * handover, closing an incident.
 *
 * **These decide what renders, and they are not security.** From Phase 17 the
 * shell reads them: a module a role has no access to does not open and a
 * control a role has no level for is not drawn. Sign-in still checks nothing,
 * so anybody can sign in as anybody, and both screens that render these levels
 * say exactly that before they render a row.
 */
export type PermissionLevel = 'no_access' | 'read' | 'record' | 'approve'

/** What a session write was, for the activity log. */
export interface SessionAct {
  id: string
  at: string
  /** The module, in the words the sidebar uses: "Care Notes". */
  module: string
  /** What happened, naming the subject: "Wrote a care note about …". */
  what: string
  /** Where the record is, so the log is a way in rather than a receipt. */
  to: string
  by: StaffRef
}
