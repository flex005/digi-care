import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TooltipProvider, ToastProvider, ToastViewport } from '@/components/primitives'
import { getSites } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import type { Site } from '@/data/types'
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
  const sites = useResource<Site[]>(getSites)
  const [activeSiteId, setActiveSiteId] = useState<string | undefined>(undefined)
  const [collapsed, setCollapsed] = useState(false)

  const siteList = sites.kind === 'ready' ? sites.data : []
  const activeSite = siteList.find((site) => site.id === activeSiteId) ?? siteList[0]

  return (
    <ViewportGuard>
      <TooltipProvider delayDuration={200}>
        <ToastProvider>
          <a className="skipToContent" href="#main">
            Skip to content
          </a>
          <div className={styles.shell}>
            <div className={styles.topbar}>
              {activeSite ? (
                <TopBar
                  sites={siteList}
                  activeSite={activeSite}
                  onSiteChange={(site) => setActiveSiteId(site.id)}
                  alertCount={0}
                  userName="A. Okonkwo"
                  userRoleLabel="Registered Manager"
                />
              ) : null}
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
