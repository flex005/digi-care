import { useViewer } from '@/app/session/use-viewer'
import type { AdminActId } from '@/features/team/permissions'
import { Outlet } from 'react-router-dom'
import { ScreenTabs, type ScreenTab } from '@/components/shell/ScreenTabs'
import styles from './settings-shell.module.css'

/**
 * The administrative area, under one sidebar item. PRD §6.7.
 *
 * Team, homes and the figures this build runs on were three items in the
 * sidebar. They are three tabs here because they are the same kind of thing:
 * what a manager configures, rather than what a manager does during a shift.
 * The sidebar's job is the second list, and every item it carries that is not
 * on it makes the ones that are harder to find.
 *
 * A layout route, so the title and the strip stay mounted while the screens
 * change, and so there is one declaration of what this module contains for
 * `reachability.test.tsx` to check the router against in both directions.
 */
/**
 * All three, always, as the declaration the reachability guard reads.
 *
 * **What a role sees is a filter over this and never a shorter list.** A tab
 * strip built per role would be a second declaration of what the module
 * contains, and the guard would then be checking the router against whichever
 * role it happened to construct.
 */
export const SETTINGS_TABS: ScreenTab[] = [
  { label: 'Team', path: '.', end: true },
  { label: 'Homes', path: 'homes' },
  { label: 'Settings', path: 'figures' },
]

/** The act a tab needs, where it needs one. Homes is the group overview. */
const TAB_ACTS: Partial<Record<string, AdminActId>> = { homes: 'group_overview' }

export function SettingsShellRoute() {
  const viewer = useViewer()
  const tabs = SETTINGS_TABS.filter((tab) => {
    const act = TAB_ACTS[tab.path]
    return act === undefined || viewer.may(act)
  })

  return (
    <div className={styles.module} data-settings-shell>
      <h1 className={styles.pageTitle}>Settings</h1>
      <ScreenTabs label="Settings" tabs={tabs} />
      <Outlet />
    </div>
  )
}
