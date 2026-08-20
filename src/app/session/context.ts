import { createContext } from 'react'
import type { AccessMode } from '@/data/access/resource'
import type { Organisation, Site, StaffRef } from '@/data/types'

/**
 * Who is looking, at which site, and in whose timezone.
 *
 * Phase 0 hard-coded the user into `AppShell` and held the active site in
 * local state. Three screens in Phase 1 need all of it, so it lives here once.
 */
export interface Session {
  organisation: Organisation
  sites: Site[]
  activeSite: Site
  setActiveSite: (site: Site) => void
  currentUser: StaffRef
  /** Read-only is a property of the viewer, not of the data. PRD §1. */
  accessMode: AccessMode
  setAccessMode: (mode: AccessMode) => void
}

export const SessionContext = createContext<Session | undefined>(undefined)

/**
 * The timezone clinical records render in. PRD §3.6.
 *
 * Nested deliberately: the app provides the active site's zone, and a
 * resident's subtree provides *that resident's* site zone. A cross-site list
 * therefore renders each row in its own site's time rather than flattening
 * every record into whichever site happens to be selected.
 */
export const TimeZoneContext = createContext<string | undefined>(undefined)
