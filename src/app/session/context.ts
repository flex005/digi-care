import { createContext } from 'react'
import type { AccessMode } from '@/data/access/resource'
import type {
  IsoDateTime,
  Organisation,
  Site,
  StaffMember,
  StaffRef,
} from '@/data/types'

/**
 * Whether anybody has signed in, and who.
 *
 * **A closed union rather than a nullable member**, for the reason every other
 * status in this product is one: signed-out and signed-in-as-nobody must not
 * be able to look the same to a screen reading it.
 *
 * There is no authentication behind it. Any details sign you in, no password
 * is checked, and every authentication screen says so where somebody can read
 * it before they type — a form that silently accepts anything implies a check
 * that is not happening, which is worse than no form.
 */
export type SignInState =
  | { kind: 'signed_out' }
  | {
      kind: 'signed_in'
      member: StaffMember
      /** When this session started. What the sign-out screen counts against. */
      at: IsoDateTime
    }

/**
 * Who is looking, at which site, and in whose timezone.
 *
 * Phase 0 hard-coded the user into `AppShell` and held the active site in
 * local state. Every screen in Phase 1 needs some of it, so it lives here once.
 */
export interface Session {
  organisation: Organisation
  sites: Site[]
  /** Re-reads the site names and zones after settings change them. */
  reloadSites: () => void
  activeSite: Site
  setActiveSite: (site: Site) => void
  signIn: SignInState
  /**
   * Signs somebody in as a named member, at a named site.
   *
   * The site is chosen here rather than afterwards because it decides the
   * timezone every record written today carries, and choosing it later means
   * the first thing somebody read was in the wrong zone.
   */
  signInAs: (member: StaffMember, site: Site) => void
  /** Ends the session and destroys everything it wrote. */
  signOut: () => void
  /**
   * Who is writing.
   *
   * The signed-in member while there is one. Signed out, this is the
   * registered manager — the pre-authentication default this build had before
   * there were accounts, kept because no product screen renders while signed
   * out: every route outside the two authentication screens redirects.
   */
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
