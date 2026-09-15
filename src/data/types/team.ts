import type { IsoDate, SiteId, StaffId, StaffRef, StaffRole } from './primitives'

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
export interface StaffMember {
  id: StaffId
  /** The same snapshot every record carries, so the two cannot disagree. */
  ref: StaffRef
  role: StaffRole
  siteId: SiteId
  standing: StaffStanding
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
