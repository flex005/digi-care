import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * The left sidebar. PRD §4.7.
 *
 * All sixteen items are listed from Phase 0 onward, in this order, and the
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
 * sixteen labels to find out it is there.
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
    path: '/dashboard',
    icon: 'dashboard/dashboard-square-01',
    phase: 12,
    enabled: false,
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
    enabled: false,
    section: 'delivery',
  },
  {
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    phase: 2,
    enabled: false,
    section: 'delivery',
  },
  {
    label: 'Medications',
    path: '/medications',
    icon: 'medical/medicine-01',
    phase: 3,
    enabled: false,
    section: 'delivery',
  },
  {
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    phase: 4,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Risk Assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    phase: 5,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Care Plans',
    path: '/care-plans',
    icon: 'education/clipboard',
    phase: 6,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Reviews',
    path: '/reviews',
    icon: 'date-and-time/calendar-01',
    phase: 7,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    phase: 8,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    phase: 9,
    enabled: false,
    section: 'planning',
  },
  {
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    phase: 10,
    enabled: false,
    section: 'governance',
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    phase: 11,
    enabled: false,
    section: 'governance',
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: 'check-validation/checkmark-badge-01',
    phase: 12,
    enabled: false,
    section: 'governance',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'business-and-finance/analytics-01',
    phase: 13,
    enabled: false,
    section: 'governance',
  },
  {
    label: 'Team',
    path: '/team',
    icon: 'users/user-group',
    phase: 14,
    enabled: false,
    section: 'admin',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings/setting-02',
    phase: 15,
    enabled: false,
    section: 'admin',
  },
]

/** Icons the shell itself uses, outside the nav list. */
export const shellIcons = {
  /** The logo mark, in its own block at the top of the sidebar. */
  logo: 'medical/healtcare',
  search: 'search/search',
  alerts: 'alert-notification/notification-02',
  user: 'users/user-circle',
  siteSwitcher: 'arrows-round/arrow-down-02-round',
  collapseSidebar: 'dashboard/sidebar-left',
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
