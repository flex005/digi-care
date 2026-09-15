import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * The left sidebar. PRD §4.7.
 *
 * All seventeen items are listed from Phase 0 onward, in this order, and the
 * ones whose module is not yet built are present but disabled with a "Coming
 * in a later phase" tooltip — so the shell does not change shape as phases
 * land, and nobody has to relearn where things are.
 *
 * This file is named *.icons.ts deliberately: the icon usage scanner treats
 * every icon-shaped string literal in a *.icons.ts file as a used icon name,
 * which is how names that are not written inline in JSX still make it into
 * the generated registry. See scripts/icons/scan-usage.mjs.
 */

export interface NavItem {
  label: string
  path: string
  icon: IconName
  /** The phase in FRONTEND_PRD.md §8 that builds this module. */
  phase: number
  /** False until that phase lands. Disabled items stay visible. */
  enabled: boolean
  /** Which section heading this item sits under. */
  section: NavSectionId
}

/**
 * Section headings. §4.7 gives the sidebar's order and this preserves it
 * exactly — the headings are inserted at boundaries that already fall in that
 * sequence, so nothing is reordered. They exist because seventeen unbroken
 * rows is a wall: a manager looking for Consent should not have to read
 * sixteen labels to find out it is there. `navItems.length` is the count that
 * matters; prose repeating it goes stale, as this comment did.
 */
export type NavSectionId = 'overview' | 'delivery' | 'planning' | 'governance' | 'admin'

export interface NavSection {
  id: NavSectionId
  /** Empty for the first group, which needs no heading above one item. */
  label: string
}

export const navSections: NavSection[] = [
  { id: 'overview', label: '' },
  { id: 'delivery', label: 'Care delivery' },
  { id: 'planning', label: 'Planning and risk' },
  { id: 'governance', label: 'Governance' },
  { id: 'admin', label: 'Administration' },
]

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    // The front door, not a screen beside it. The index route *is* the
    // Dashboard, so the item points at `/` rather than at a second URL for
    // the same screen.
    path: '/',
    icon: 'dashboard/dashboard-square-01',
    phase: 12,
    enabled: true,
    section: 'overview',
  },
  {
    label: 'Residents',
    path: '/residents',
    icon: 'users/user-multiple',
    phase: 1,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Care Notes',
    path: '/care-notes',
    icon: 'note-task/note-01',
    phase: 2,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    phase: 2,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Medications',
    path: '/medications',
    icon: 'medical/medicine-01',
    phase: 3,
    enabled: true,
    section: 'delivery',
  },
  {
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    phase: 4,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Risk Assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    phase: 5,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Care Plans',
    path: '/care-plans',
    icon: 'education/clipboard',
    phase: 7,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Reviews',
    path: '/reviews',
    icon: 'date-and-time/calendar-01',
    phase: 7,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    phase: 8,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    phase: 9,
    enabled: true,
    section: 'planning',
  },
  {
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    phase: 10,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Family Portal',
    path: '/family',
    icon: 'users/user-sharing',
    phase: 26,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    phase: 11,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: 'check-validation/checkmark-badge-01',
    phase: 12,
    enabled: true,
    section: 'governance',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'business-and-finance/analytics-01',
    phase: 13,
    enabled: true,
    section: 'governance',
  },
  /*
   * **One entry for the whole administrative area.** Team, homes and the
   * figures this build runs on were three sidebar items and are three tabs
   * under this one: they are all things a manager configures rather than
   * things a manager does during a shift, and the sidebar's job is the second
   * list. Nothing was removed — each screen keeps its route under /settings.
   */
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings/setting-02',
    phase: 15,
    enabled: true,
    section: 'admin',
  },
]

/** Icons the shell itself uses, outside the nav list. */
export const shellIcons = {
  /*
   * The product mark is not here. It was `medical/healtcare` — a stethoscope
   * standing in until there was a real one — and a stand-in that outlives the
   * thing it stood in for is indistinguishable from a decision. The mark is
   * now `src/assets/brand/`, rendered by `<Logo />`, and it is not an icon:
   * the registry is single-colour and normalised to `currentColor`, which
   * would flatten a two-tone lockup.
   */
  search: 'search/search',
  alerts: 'alert-notification/notification-02',
  siteSwitcher: 'arrows-sharp/arrow-down-01-sharp',
  collapseSidebar: 'dashboard/sidebar-left',
  /** The app switcher grid — 3x3 circles, the launcher glyph. Not
   *  dashboard/dashboard-square-01, which the Dashboard nav item wears. */
  appSwitcher: 'more-menu/more-02',
} satisfies Record<string, IconName>

/**
 * The prototype's status kitchen sink at /dev/states. Not a product module, so
 * it is not in `navItems` and no structural guard counts it — but it is
 * declared here rather than in the sidebar because this file is what the icon
 * usage scanner reads. An icon name written in a plain object literal in a
 * .tsx file is invisible to the JSX scan, drops out of the generated registry,
 * and throws when the component renders. That is how this landed here.
 */
export const devStatesItem: NavItem = {
  label: 'Status states',
  path: '/dev/states',
  icon: 'check-validation/validation',
  phase: 0,
  enabled: true,
  section: 'overview',
}
