import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TooltipProvider, ToastProvider, ToastViewport } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { residents } from '@/data/fixtures/residents'
import type { NavCount } from './NavBadge'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ViewportGuard } from './ViewportGuard'
import styles from './AppShell.module.css'

/**
 * The application shell. PRD §4.7.
 *
 * Carries the diGiLog visual language — deep purple bar, white cards on pale
 * lavender, pill controls, generous radii — but its own information
 * architecture.
 *
 * The site is held here and read from fixtures, never inferred. Phase 15
 * will make switching it consequential; until then it is a label that is
 * always present, which is the part PRD §2.4 actually requires.
 */
export function AppShell() {
  const { sites, activeSite, setActiveSite, currentUser, accessMode, setAccessMode } =
    useSession()
  const [collapsed, setCollapsed] = useState(false)

  /**
   * Nav counts. PRD §4.7 puts a badge on the items the source PRD names —
   * overdue reviews and open incidents.
   *
   * Reviews is wired because the data exists: overdue care plan reviews are
   * real, and they are real whether or not the Reviews module has been built.
   * The badge sits on a disabled item deliberately — the work exists, and it
   * is reachable today from the residents list and the profile, so hiding the
   * figure until Phase 7 would be hiding a fact about the home, not tidying a
   * screen.
   *
   * Incidents carries no badge, because there are no incident fixtures yet.
   * **Absent is not zero** — a badge reading "0 open incidents" would be a
   * claim nobody has the evidence to make.
   */
  const navCounts: Partial<Record<string, NavCount>> = useMemo(() => {
    const overdue = residents.filter(
      (resident) => resident.carePlanReview.kind === 'overdue',
    ).length
    if (overdue === 0) return {}
    return {
      '/reviews': {
        value: overdue,
        description: `${overdue} care plan reviews overdue, of ${residents.length} residents. The Reviews module arrives in a later phase; these are visible now on each resident's profile.`,
      },
    }
  }, [])

  return (
    <ViewportGuard>
      <TooltipProvider delayDuration={200}>
        <ToastProvider>
          <a className="skipToContent" href="#main">
            Skip to content
          </a>
          <div className={styles.shell}>
            <div className={styles.topbar}>
              <TopBar
                sites={sites}
                activeSite={activeSite}
                onSiteChange={setActiveSite}
                alertCount={0}
                userName={currentUser.displayName}
                userRoleLabel="Registered Manager"
                accessMode={accessMode}
                onAccessModeChange={setAccessMode}
              />
            </div>
            <div className={styles.sidebar}>
              <Sidebar
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed((value) => !value)}
                counts={navCounts}
              />
            </div>
            <main id="main" className={styles.main}>
              <div className={styles.content}>
                <Outlet />
              </div>
            </main>
          </div>
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </ViewportGuard>
  )
}
