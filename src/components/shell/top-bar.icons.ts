import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons the account menu uses.
 *
 * **In a `*.icons.ts` file, and that is not a stylistic choice.** The icon
 * usage scanner treats every icon-shaped string literal in one of these files
 * as a used name; a name written in a plain object literal inside a `.tsx`
 * drops out of the generated registry and throws when the component renders.
 * CLAUDE.md §3.
 */
export const accountMenuIcons = {
  myDashboard: 'users/user-circle',
  whatICanDo: 'users/user-shield-01',
  signOut: 'login-logout/logout-01',
} satisfies Record<string, IconName>

/** The password reveal, on every field that takes one. */
export const passwordIcons = {
  show: 'edit-formatting/view',
  hide: 'edit-formatting/view-off',
} satisfies Record<string, IconName>
