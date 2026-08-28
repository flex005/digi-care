import { STAFF_ROLE_NAMES } from '@/data/types'
import { useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ChangedFiguresBanner } from '@/features/group/ChangedFiguresBanner'
import { MovedClockBanner } from '@/features/group/MovedClockBanner'
import { TooltipProvider, ToastProvider, ToastViewport } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { residents } from '@/data/fixtures/residents'
import { incidents } from '@/data/fixtures/incidents'
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
  /*
   * **`accessMode` is no longer read here, and no control anywhere sets it.**
   * The account menu's "View as" was the only way into read-only — one of the
   * seven states every screen is reviewed against (PRD §6) — and it has been
   * removed from the menu. The session still carries the mode and five screens
   * still branch on it; nothing can currently reach those branches.
   */
  const { sites, activeSite, setActiveSite, currentUser } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

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
   * Incidents is wired now that the fixtures exist. It counts the
   * **unacknowledged** ones rather than every open one, because that is the
   * log's own finding — a badge and the screen it points at should be counting
   * the same thing, or the number changes meaning when somebody arrives.
   *
   * **Absent is still not zero.** Where nothing is unacknowledged the key is
   * omitted rather than set to 0: a badge reading "0" is a claim, and this one
   * has nothing to say when the queue is empty.
   */
  const navCounts: Partial<Record<string, NavCount>> = useMemo(() => {
    const counts: Partial<Record<string, NavCount>> = {}

    const overdue = residents.filter(
      (resident) => resident.carePlanReview.kind === 'overdue',
    ).length
    if (overdue > 0) {
      counts['/reviews'] = {
        value: overdue,
        description: `${overdue} care plan reviews overdue, of ${residents.length} residents. Every one is on the review queue, and on the resident's own profile.`,
      }
    }

    const waiting = incidents.filter(
      (incident) =>
        incident.siteId === activeSite.id &&
        incident.status.kind === 'reported_not_acknowledged',
    ).length
    if (waiting > 0) {
      counts['/incidents'] = {
        value: waiting,
        description: `${waiting} incidents reported and not acknowledged, of ${incidents.filter((incident) => incident.siteId === activeSite.id).length} recorded at ${activeSite.name}.`,
      }
    }

    return counts
  }, [activeSite])

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
                userRoleLabel={STAFF_ROLE_NAMES[currentUser.role]}
                onMyDashboard={() => navigate('/me')}
                onMyPermissions={() => navigate('/me/permissions')}
                onSignOut={() => navigate('/sign-out')}
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
                {/*
                 * Above everything, on every screen, while any figure differs
                 * from its documented default. A screen behaving differently
                 * from what its documentation says, without saying so, is the
                 * reassurance failure with the reader's own change as the
                 * cause — the version they would least suspect.
                 */}
                <MovedClockBanner />
                <ChangedFiguresBanner />
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
