import type { PermissionLevel, StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { navItems } from '@/app/nav-items.icons'

/**
 * What each role can do in each module. PRD §6.7, Phase 14, and Phase 17.
 *
 * **These levels decide what renders, and they are not security.** From Phase
 * 17 the shell reads them: a module a role has no access to does not open, and
 * a control a role has no level for is not rendered. What that prevents is a
 * wrong-role mistake. It prevents nothing else, because sign-in still checks
 * nothing and anybody can sign in as anybody, and access control that lives in
 * a browser is a suggestion. A real deployment enforces this on a server. Both
 * screens that render these levels say exactly that before the first row.
 *
 * **One owner, because the alternative was already in the build.** `accessMode`
 * was a second answer to the same question, held on the session as a global
 * read-only switch, and by Phase 16 no control set it and five screens branched
 * on a state nothing could reach. Two rules for one question drift, and the one
 * that drifted had gone dead without anybody noticing. It is gone: the five
 * branches ask this file about their own module instead, and the auditor role
 * reaches them.
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
      /*
       * **Three cells that were wrong for sixteen phases**, found the first
       * time anything read this table rather than rendering it. PRD §1 defines
       * the role as "Senior Carer / Clinical Lead: reviews and countersigns
       * care notes, countersigns medication, runs handovers" — which is the
       * `approve` act in all three modules, and the baseline said `record`
       * because nothing widened it. Countersigning is the whole of what the
       * role is for, and the matrix said they could not.
       *
       * It is the Phase 15 finding again, in the direction that is harder to
       * see: that one read "Record" against a module where nobody records, and
       * this one read "Record" against the module the role exists to approve
       * in. A cell that is too small is as wrong as a cell that is too large,
       * and neither is visible while nothing asks.
       */
      '/care-notes': 'approve',
      '/handover': 'approve',
      '/medications': 'approve',
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

// ---------------------------------------------------------------------------
// Authority, which is a different question from level
// ---------------------------------------------------------------------------

/**
 * Whether this role is one of the people the service is registered to.
 *
 * **A level answers "what can you do to a record here". This answers "whose
 * authority do you hold".** They are not the same question and collapsing them
 * was the first thing Phase 17 tried: a deputy manager has `approve` on
 * Compliance and should have it, because deciding whether the CQC must be told
 * is part of reviewing an incident. What they do not have is the act of
 * notifying the CQC, and no level expresses that, because filing a statutory
 * notification is not a bigger version of approving somebody's work. It is a
 * different kind of act with a different person's name on it.
 *
 * **Two members and not three.** A middle tier for "site authority" was
 * written and removed the same hour: every act below needs `registered_person`,
 * so a third member would have decided nothing for anybody and read as a rule.
 * That is the dead `/team` exception, one file over, arrived at while writing
 * its replacement.
 *
 * Both members are named for what is true of them rather than for what they
 * can do, so neither goes stale when the act list grows. The provider's admin
 * and the registered manager are the two people CQC registers a service to;
 * everybody else works in a service somebody else is registered for.
 */
export type Accountability = 'registered_person' | 'not_registered'

/**
 * A `Record` rather than a list, so a new role cannot be added without somebody
 * deciding this about it. A list of two names would silently make the eighth
 * role `not_registered` by default, and a default is how "Record" got onto the
 * Dashboard.
 */
const ACCOUNTABLE: Record<StaffRole, Accountability> = {
  registered_manager: 'registered_person',
  deputy_manager: 'not_registered',
  senior_carer: 'not_registered',
  care_worker: 'not_registered',
  activities_coordinator: 'not_registered',
  auditor: 'not_registered',
}

export const accountabilityOf = (role: StaffRole): Accountability => ACCOUNTABLE[role]

/**
 * Which roles are viewers of this platform, as against subjects of its records.
 *
 * **The distinction this product kept re-deriving wrongly.** diGi-Care Admin &
 * Manager is one product; Care Worker, Family Portal and Superadmin are
 * separate products with their own UIs. A care worker therefore appears all
 * over this one — invited in Team Management, assigned to residents, named as
 * the author of thousands of records, given a row in the permission matrix —
 * and never signs into it. Being in the product is not being a user of it.
 *
 * So the sign-in screen offers these three and only these three. The auditor
 * is here on purpose and is not an oversight: an external auditor or a CQC
 * inspector has no other product to use, PRD §1 gives them full read and zero
 * write during an inspection, and they are the only role that reaches the
 * read-only rendering of five screens. Take them out and the read-only state
 * stops existing anywhere in the build.
 *
 * **Every other role keeps its matrix row.** The matrix is an Admin's view of
 * the people they manage, which is a different claim from a list of viewers,
 * and the screen now says which of the two it is making.
 */
export const SIGN_IN_ROLES: StaffRole[] = [
  'registered_manager',
  'deputy_manager',
  'auditor',
]

export const canSignIn = (role: StaffRole): boolean => SIGN_IN_ROLES.includes(role)

/**
 * The acts that belong to the registered person rather than to a level.
 *
 * Four, and each one names the module it sits in, so **an act cannot be held
 * in a module the role cannot even open**. That cap is what stops this becoming
 * a second permission table: the two questions are asked in series rather than
 * side by side, and a care worker is refused by the level before this file
 * looks at accountability at all.
 *
 * `route` is for an act that is a whole screen. Where there is none, the act
 * is a control inside a screen the role can otherwise read, which is the shape
 * AM v2.0 asks for on Compliance: a manager sees every finding and files
 * nothing.
 */
export interface AdminAct {
  id: string
  module: string
  /** The label, imperative, for a list of acts: "Generate an inspection pack". */
  what: string
  /**
   * The same act inside a sentence: "Generating an inspection pack is not
   * part of your access".
   *
   * **Two forms because one of them was wrong on a screenshot.** The refusal
   * page put `what` into a heading and produced "Generate an inspection pack
   * is not part of your access". That is `INCIDENT_TYPES.phrase` again, to the
   * letter: a label that reads correctly in a column and wrongly in a
   * sentence, and the call site is not the place to fix it.
   */
  phrase: string
  /** Why it is the registered person's. One sentence, and never "because Admin". */
  why: string
  /**
   * The screen it is, where it is a whole screen rather than a control.
   *
   * **Required and sometimes undefined**, rather than optional. An act with no
   * screen of its own is a decision somebody took, and an absent key would let
   * the next act be added without anybody taking it.
   */
  route: string | undefined
}

export const ADMIN_ACTS = [
  {
    id: 'inspection_pack',
    module: '/compliance',
    route: '/compliance/pack',
    what: 'Generate an inspection pack',
    phrase: 'Generating an inspection pack',
    why: 'The pack is the evidence the service hands to a regulator, and it goes out in the name of the person the service is registered to.',
  },
  {
    id: 'statutory_notification',
    module: '/compliance',
    // A control on the notifications screen. The manager reads that screen.
    route: undefined,
    what: 'Record that the CQC has been told',
    phrase: 'Recording that the CQC has been told',
    why: 'A statutory notification is made by the registered person. Deciding whether one is required is part of reviewing the incident, and that decision is not gated here.',
  },
  {
    id: 'configure_service',
    module: '/settings',
    // The settings screen itself is readable by a manager. The controls are not.
    route: undefined,
    what: "Change a home's name, its timezone, or the figures this build runs on",
    phrase: 'Changing what this home runs on',
    why: 'Configuring the service belongs to the registered person. A manager sees every setting and changes none of them.',
  },
  {
    id: 'manage_team',
    module: '/settings',
    /*
     * Controls on a screen a manager reads. AM v2.0's TM-01 gives them the
     * staff list in read-only: they need to know who is on the team, and
     * deciding it is the registered person's.
     */
    route: undefined,
    what: 'Invite staff, change a role, assign homes, and deactivate an account',
    phrase: 'Deciding who is on the team',
    why: 'Who works in a service, and what they may reach in the record, is decided by the person the service is registered to. AM v2.0 gives a manager the staff list and none of the acts on it.',
  },
  {
    id: 'group_overview',
    module: '/settings',
    route: '/settings/homes',
    what: 'See every home in the organisation at once',
    phrase: 'Seeing every home in the organisation at once',
    why: 'A manager works in the homes they are assigned to. Reading them side by side is a view of the organisation rather than of a home.',
  },
  {
    /*
     * AM v2.0's AUTH-05 runs the wizard for the first Admin only. Every write
     * it makes goes through an owner another act already gates — the site
     * name, the template settings, the invitation — so this act is about the
     * screen, and it refuses a manager the whole screen rather than half of it.
     */
    id: 'set_up_organisation',
    module: '/settings',
    route: '/settings/setup',
    what: 'Set up the organisation',
    phrase: 'Setting up the organisation',
    why: 'Naming the organisation, its first home, what that home carries out and who joins it first are the decisions for the person the service is registered to. A manager is invited into a service somebody has already set up.',
  },
] as const satisfies readonly AdminAct[]

export type AdminActId = (typeof ADMIN_ACTS)[number]['id']

export const actById = (id: AdminActId): AdminAct =>
  ADMIN_ACTS.find((act) => act.id === id) as AdminAct

/**
 * Whether this role holds this act.
 *
 * The level first, then the accountability. Order matters for the message a
 * refused screen gives: a care worker is refused because Compliance is not
 * theirs, and a deputy manager is refused because the act is not theirs, and
 * telling the second one that Compliance is not theirs would be false.
 */
export function mayDo(role: StaffRole, id: AdminActId): boolean {
  const act = actById(id)
  if (levelFor(role, act.module) === 'no_access') return false
  return ACCOUNTABLE[role] === 'registered_person'
}

/** The acts a role does not hold, so a screen can say what it is not showing. */
export const actsWithheldFrom = (role: StaffRole): AdminAct[] =>
  ADMIN_ACTS.filter((act) => !mayDo(role, act.id))

// ---------------------------------------------------------------------------
// Which module a screen belongs to
// ---------------------------------------------------------------------------

/**
 * The module a path sits in, or nothing.
 *
 * **Longest first**, because `/settings/homes` is in Settings and `/` would
 * otherwise claim every path in the product. Nothing is not a failure: `/me`,
 * `/me/permissions` and `/dev/states` belong to no module and are every role's,
 * which is the whole reason `/me/permissions` can be the place somebody reads
 * what they do not have.
 *
 * Derived from `PERMISSION_MODULES`, so the sidebar remains the only
 * declaration of what a module is. A second list of prefixes here would be the
 * proxy this phase exists to remove.
 */
const MODULE_PATHS = PERMISSION_MODULES.map((module) => module.id)
  .filter((id) => id !== '/')
  .sort((a, b) => b.length - a.length)

export function moduleForPath(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return '/'
  return MODULE_PATHS.find((id) => path === id || path.startsWith(`${id}/`))
}

/**
 * Why a screen is rendering no write controls, in a sentence naming the role.
 *
 * One owner because the alternative is already in the build and already wrong:
 * five screens say "You are a read-only auditor", which was true while the
 * only way into read-only was a control that said auditor on it. An
 * organisation admin reads Care Notes too, and telling them they are an auditor
 * is a screen inventing a fact about the person reading it.
 */
export function readOnlyReason(role: StaffRole, moduleId: string): string {
  const module = PERMISSION_MODULES.find((entry) => entry.id === moduleId)
  const label = module?.label ?? moduleId
  return `Your role is ${STAFF_ROLE_NAMES[role]}, which reads ${label} and writes nothing in it.`
}
