import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TooltipProvider, ToastProvider, ToastViewport } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
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
