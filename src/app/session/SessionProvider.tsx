import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { IsoDateTime, Site, SiteId, StaffMember } from '@/data/types'
import { organisation, staffOkonkwo } from '@/data/fixtures/organisation'
import { now as appNow } from '@/data/fixtures/clock'
import { configuredSites, organisationAsConfigured } from '@/data/access/settings-store'
import { endSession } from '@/data/access/session-losses'
import { SessionContext, TimeZoneContext, type SignInState } from './context'

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
  /*
   * Starts signed out, and reloading signs you out again: there is no session
   * to remember, and nothing in this build persists anywhere. A "remember me"
   * would be the second control on the screen that does nothing.
   */
  const [signIn, setSignIn] = useState<SignInState>({ kind: 'signed_out' })
  /*
   * Bumped when site settings change, because the name and the zone are read
   * from the settings store rather than straight from the fixtures — and the
   * zone decides what every clinical timestamp on every screen says.
   */
  const [configured, setConfigured] = useState(0)

  const sites = useMemo(() => configuredSites(), [configured])
  /*
   * Through the settings store for the same reason the sites are: the setup
   * wizard names the organisation, and a name read straight from the fixture
   * would leave that step writing something nothing shows.
   */
  const configuredOrganisation = useMemo(
    () => organisationAsConfigured(organisation),
    [configured],
  )
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0]
  if (!activeSite) throw new Error('No sites configured')

  const signInAs = useCallback((member: StaffMember, site: Site) => {
    setActiveSiteId(site.id)
    setSignIn({
      kind: 'signed_in',
      member,
      at: appNow().toISOString() as IsoDateTime,
    })
  }, [])

  /*
   * **Destroys the work before it changes the state**, in that order and not
   * the other, so a screen cannot re-render against a signed-out session while
   * the stores still hold this session's writes.
   */
  const signOut = useCallback(() => {
    endSession()
    setSignIn({ kind: 'signed_out' })
  }, [])

  const value = useMemo(
    () => ({
      organisation: configuredOrganisation,
      sites,
      reloadSites: () => setConfigured((count) => count + 1),
      activeSite,
      setActiveSite: (site: Site) => setActiveSiteId(site.id),
      signIn,
      signInAs,
      signOut,
      /*
       * The signed-in member while there is one. Signed out this is the
       * registered manager, which was the whole of this field before there
       * were accounts — kept because the gate means no product screen renders
       * while signed out, so nothing in the app reads it.
       */
      currentUser: signIn.kind === 'signed_in' ? signIn.member.ref : staffOkonkwo,
    }),
    [activeSite, sites, configuredOrganisation, signIn, signInAs, signOut],
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
