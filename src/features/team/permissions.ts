import type { PermissionLevel, StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { navItems } from '@/app/nav-items.icons'

/**
 * What each role would be able to do in each module. PRD §6.7, Phase 14.
 *
 * **Declared, and enforced by nothing.** Signing in sets who somebody is and
 * checks nothing about them: any details are accepted, and no screen anywhere
 * checks a level set here. The matrix says what a real deployment would
 * enforce; the screen that renders it says so before it renders a cell.
 *
 * **Four levels rather than the source PRD's fifty-four flags.** Fifty-four is
 * a number inherited from a product that has a permission model, and it counts
 * nine modules where this build has sixteen — a matrix that does not match the
 * product is worse than no matrix. These four are distinctions the build
 * already makes: reading a record, recording one, and approving somebody
 * else's, which is finalising a care plan, countersigning a handover, closing
 * an incident.
 *
 * **The modules come from the sidebar**, so the matrix cannot describe a
 * product other than this one. A module added without a level for every role
 * is a compile error.
 */

export const PERMISSION_LEVELS: PermissionLevel[] = [
  'no_access',
  'read',
  'record',
  'approve',
]

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  no_access: 'No access',
  read: 'Read',
  record: 'Record',
  approve: 'Approve',
}

export const PERMISSION_MEANS: Record<PermissionLevel, string> = {
  no_access: 'The module does not appear for this role.',
  read: 'Can open every screen and change nothing.',
  record: 'Can write what this module records.',
  approve: "Can sign off somebody else's work here.",
}

/** The modules a permission can be about: the sidebar, minus the dev route. */
export const PERMISSION_MODULES = navItems
  .filter((item) => item.label !== 'Status states')
  .map((item) => ({ id: item.path, label: item.label }))

export type PermissionModuleId = (typeof PERMISSION_MODULES)[number]['id']

const ALL: StaffRole[] = Object.keys(STAFF_ROLE_NAMES) as StaffRole[]

/**
 * How each role reads the product.
 *
 * A shape rather than a table of exceptions: a level per role, and then the
 * modules that differ from it. Written this way because the differences are
 * the interesting part and a 112-cell literal hides them.
 */
const BASE: Record<StaffRole, PermissionLevel> = {
  organisation_admin: 'read',
  registered_manager: 'approve',
  deputy_manager: 'approve',
  senior_carer: 'record',
  care_worker: 'record',
  activities_coordinator: 'read',
  auditor: 'read',
}

/**
 * Where a role differs from its own baseline, and only there.
 *
 * **Every key here has to be a module the sidebar has.** Five entries named
 * `/team`, which was a sidebar item until Phase 15 folded Team, homes and
 * figures into three tabs under Settings — after which they narrowed nothing,
 * for nobody, and still read as rules. A dead exception is worse than a
 * missing one: it looks like a decision somebody took.
 */
const EXCEPTIONS: Partial<Record<StaffRole, Partial<Record<string, PermissionLevel>>>> =
  {
    organisation_admin: { '/settings': 'approve' },
    care_worker: {
      /*
       * Editing a resident's record is a manager act. The baseline said
       * `record` here because nothing narrowed it, which put "Record" against
       * Residents for somebody who cannot admit or edit one.
       */
      '/residents': 'read',
      '/care-plans': 'read',
      '/reviews': 'read',
      '/compliance': 'no_access',
      '/reports': 'no_access',
      '/settings': 'no_access',
      '/documents': 'read',
    },
    senior_carer: {
      // Same act, same reason: admitting and editing are manager-level.
      '/residents': 'read',
      '/care-plans': 'read',
      '/compliance': 'read',
      '/reports': 'read',
      '/settings': 'no_access',
    },
    activities_coordinator: {
      '/activities': 'record',
      '/goals': 'record',
      '/care-notes': 'record',
      '/medications': 'no_access',
      '/compliance': 'no_access',
      '/reports': 'no_access',
      '/settings': 'no_access',
    },
    auditor: {
      // Reads everything and writes nothing, which is the point of the role.
      '/settings': 'no_access',
    },
    deputy_manager: { '/settings': 'read' },
  }

/**
 * What each module actually offers, which caps what any role can have in it.
 *
 * **The matrix was wrong for fifteen phases and nothing could have caught it,
 * because every cell was plausible on its own.** A care worker read "Record"
 * against Dashboard — a screen on which nobody writes anything — and a manager
 * read "Approve" against Reports, where there is no work of anybody else's to
 * sign off. Both were the role's baseline applied to a module that has no such
 * act, and a table of 112 hand-written cells has no way to notice.
 *
 * So the level is the lower of two things: what the role is allowed, and what
 * the module has. This is the cap, and each entry names the act that justifies
 * it — a ceiling with no act named would be the same guess one level up.
 *
 * `record` is a write this build actually performs. `approve` is signing off
 * somebody else's work: countersigning, finalising, closing, witnessing.
 */
const OFFERS: Record<string, { records: string | false; approves: string | false }> = {
  '/': {
    // Nothing is written on the Dashboard. It reads other modules and that is all.
    records: false,
    approves: false,
  },
  '/residents': {
    records: 'admitting a resident, and editing their record',
    approves: false,
  },
  '/care-notes': {
    records: 'writing a care note, and correcting one',
    approves: 'marking a flagged note reviewed',
  },
  '/handover': {
    records: 'marking a resident on the board',
    approves: 'signing the handover',
  },
  '/medications': {
    records: 'signing for a dose, a PRN dose, a controlled drug count',
    approves: 'witnessing a controlled drug',
  },
  '/incidents': {
    records: 'reporting an incident',
    approves: 'deciding whether the CQC must be told',
  },
  '/risk-assessments': {
    // Completing an assessment is the write; there is no separate sign-off.
    records: 'completing an assessment',
    approves: false,
  },
  '/care-plans': {
    records: 'saving a draft of a domain',
    approves: 'finalising and signing a domain',
  },
  '/reviews': {
    records: 'completing a review',
    approves: 'closing a post-incident review flag',
  },
  '/goals': {
    records: 'setting a goal and recording progress',
    approves: false,
  },
  '/activities': {
    records: 'recording attendance',
    approves: false,
  },
  '/consent': {
    records: 'seeking and withdrawing consent',
    approves: 'recording a capacity decision',
  },
  '/documents': {
    records: 'filing a document and deciding its expiry',
    approves: false,
  },
  '/compliance': {
    records: 'recording that the CQC was notified',
    approves: 'deciding a notification is not required',
  },
  '/reports': {
    // A report is a view over records written elsewhere.
    records: false,
    approves: false,
  },
  '/settings': {
    records: 'changing a figure, a home name or a timezone',
    approves: false,
  },
}

const RANK: Record<PermissionLevel, number> = {
  no_access: 0,
  read: 1,
  record: 2,
  approve: 3,
}

/** The highest level this module can honestly carry. */
export function ceilingFor(moduleId: string): PermissionLevel {
  const offers = OFFERS[moduleId]
  if (offers === undefined) {
    throw new Error(
      `No acts declared for ${moduleId}. A module with no entry cannot be capped, and an uncapped module is how "Record" got onto the Dashboard.`,
    )
  }
  if (offers.approves !== false) return 'approve'
  if (offers.records !== false) return 'record'
  return 'read'
}

/** What the module offers, in words, for a screen that wants to say why. */
export const actsIn = (moduleId: string) => OFFERS[moduleId]

export function levelFor(role: StaffRole, moduleId: string): PermissionLevel {
  const asked = EXCEPTIONS[role]?.[moduleId] ?? BASE[role]
  const ceiling = ceilingFor(moduleId)
  /*
   * The lower of the two, never the role's alone. `no_access` is a role
   * decision and is never raised by a ceiling: a module offering a write does
   * not mean everybody gets one.
   */
  return RANK[asked] <= RANK[ceiling] ? asked : ceiling
}

export const PERMISSION_ROLES = ALL
