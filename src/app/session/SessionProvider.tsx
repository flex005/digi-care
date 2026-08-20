import { useMemo, useState, type ReactNode } from 'react'
import type { AccessMode } from '@/data/access/resource'
import type { Site, SiteId } from '@/data/types'
import { organisation, sites, staffOkonkwo } from '@/data/fixtures/organisation'
import { SessionContext, TimeZoneContext } from './context'

/**
 * Supplies the active site, the current user and the access mode.
 *
 * The site is held here and read from fixtures — never inferred from
 * navigation history or "last viewed" (PRD §2.4). Phase 15 makes switching it
 * consequential; until then it drives per-site filtering and, importantly,
 * which timezone clinical records render in.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [activeSiteId, setActiveSiteId] = useState<SiteId>('site-rosewood-court')
  const [accessMode, setAccessMode] = useState<AccessMode>('read_write')

  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0]
  if (!activeSite) throw new Error('No sites configured')

  const value = useMemo(
    () => ({
      organisation,
      sites,
      activeSite,
      setActiveSite: (site: Site) => setActiveSiteId(site.id),
      // Phase 14 builds real accounts. Until then the primary user of this
      // build (PRD §1) is the registered manager.
      currentUser: staffOkonkwo,
      accessMode,
      setAccessMode,
    }),
    [activeSite, accessMode],
  )

  return (
    <SessionContext.Provider value={value}>
      <TimeZoneContext.Provider value={activeSite.timeZone}>
        {children}
      </TimeZoneContext.Provider>
    </SessionContext.Provider>
  )
}

/**
 * Overrides the timezone for a subtree — used by a resident's profile so its
 * records render in *that resident's* site zone rather than whichever site is
 * currently selected. PRD §3.6.
 */
export function SiteTimeZone({
  timeZone,
  children,
}: {
  timeZone: string
  children: ReactNode
}) {
  return (
    <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>
  )
}
