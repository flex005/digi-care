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
}

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard/dashboard-square-01',
    phase: 12,
    enabled: false,
  },
  {
    label: 'Residents',
    path: '/residents',
    icon: 'users/user-multiple',
    phase: 1,
    // Enabled by Step 1, which builds the list. Step 0 ships the data layer
    // and the Fixture Audit; a nav item pointing at a screen that does not
    // exist yet would be a dead control.
    enabled: false,
  },
  {
    label: 'Care Notes',
    path: '/care-notes',
    icon: 'note-task/note-01',
    phase: 2,
    enabled: false,
  },
  {
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    phase: 2,
    enabled: false,
  },
  {
    label: 'Medications',
    path: '/medications',
    icon: 'medical/medicine-01',
    phase: 3,
    enabled: false,
  },
  {
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    phase: 4,
    enabled: false,
  },
  {
    label: 'Risk Assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    phase: 5,
    enabled: false,
  },
  {
    label: 'Care Plans',
    path: '/care-plans',
    icon: 'education/clipboard',
    phase: 6,
    enabled: false,
  },
  {
    label: 'Reviews',
    path: '/reviews',
    icon: 'date-and-time/calendar-01',
    phase: 7,
    enabled: false,
  },
  {
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    phase: 8,
    enabled: false,
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    phase: 9,
    enabled: false,
  },
  {
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    phase: 10,
    enabled: false,
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    phase: 11,
    enabled: false,
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: 'check-validation/checkmark-badge-01',
    phase: 12,
    enabled: false,
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'business-and-finance/analytics-01',
    phase: 13,
    enabled: false,
  },
  {
    label: 'Team',
    path: '/team',
    icon: 'users/user-group',
    phase: 14,
    enabled: false,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings/setting-02',
    phase: 15,
    enabled: false,
  },
]

/** Icons the shell itself uses, outside the nav list. */
export const shellIcons = {
  search: 'search/search',
  alerts: 'alert-notification/notification-02',
  user: 'users/user-circle',
  siteSwitcher: 'arrows-round/arrow-down-02-round',
  collapseSidebar: 'dashboard/sidebar-left',
} satisfies Record<string, IconName>
