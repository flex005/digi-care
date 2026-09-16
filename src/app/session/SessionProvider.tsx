import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { IsoDateTime, Site, SiteId, StaffMember } from '@/data/types'
import { organisation, staffOkonkwo } from '@/data/fixtures/organisation'
import { now as appNow } from '@/data/fixtures/clock'
import { configuredSites, organisationAsConfigured } from '@/data/access/settings-store'
import { endSession } from '@/data/access/session-losses'
import { resetViewerScope, setViewer } from '@/data/access/viewer-scope'
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

  const configuredAll = useMemo(() => configuredSites(), [configured])
  /**
   * **The homes this viewer is appointed to, and nothing else.**
   *
   * It was every configured home, for everybody, and `activeSiteId` started at
   * Rosewood before anybody signed in — so the site switcher offered a manager
   * homes they do not work in, and every queue and figure on the screen was
   * whichever of those they last selected. 56 call sites read
   * `activeSite.id`; not one of them is wrong now, because the active site can
   * only ever be one of these.
   *
   * **A property of the assignment, not of the role.** A manager appointed to
   * one home has one and `TopBar` draws no switcher; a deputy covering two has
   * two and draws one, which is what AM v2.0's TM-04 exists for; an admin
   * administering the organisation has both. A control whose presence depended
   * on a role would be a fact about the reader rather than about their record.
   *
   * Signed out it is every configured home, because the authentication screens
   * resolve an address against each of them and there is no viewer yet.
   */
  /*
   * **Keyed on which homes, never on the sign-in itself.** It was memoised on
   * `signIn`, and every sign-in stores a fresh timestamp — so the array took a
   * new identity on every sign-in even when the homes were identical. The test
   * helper that signs in re-ran whenever `sites` changed, signed in again, and
   * got a new array again: an infinite loop in every test that signed in,
   * spinning each worker until it exhausted a 4 GB heap. Anything depending on
   * this array would have done the same. A value that means "these homes"
   * changes when the homes do, and at no other time.
   */
  const homeKey =
    signIn.kind === 'signed_in' ? signIn.member.siteIds.join('|') : 'signed-out'
  const sites = useMemo(() => {
    if (homeKey === 'signed-out') return configuredAll
    const held = homeKey.split('|')
    const theirs = configuredAll.filter((site) => held.includes(site.id))
    return theirs.length > 0 ? theirs : configuredAll
  }, [configuredAll, homeKey])
  /*
   * Through the settings store for the same reason the sites are: the setup
   * wizard names the organisation, and a name read straight from the fixture
   * would leave that step writing something nothing shows.
   */
  const configuredOrganisation = useMemo(
    () => organisationAsConfigured(organisation),
    [configured],
  )
  /*
   * Falls back to the first home they hold rather than to the first home there
   * is: a selected site that is not theirs would put another home's queues and
   * figures on the screen without anybody switching to it.
   */
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0]
  if (!activeSite) throw new Error('No sites configured')

  const signInAs = useCallback((member: StaffMember, site: Site) => {
    /*
     * **Who is signed in, for the loaders.** They cannot ask the session: this
     * is React context and `client.ts` is a plain module, readable only during
     * a render, and a loader called from `useResource` runs outside one. So the
     * id is handed over here and the homes are derived from it at call time,
     * which keeps `StaffMember.siteIds` the only owner of which homes somebody
     * holds.
     */
    setViewer(member.id)
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

  /*
   * **A session ends when this provider goes, not only when somebody signs
   * out.** The pointer to who is signed in is module-level, so it outlived the
   * provider that set it: a test signed in as a senior carer at Rosewood, the
   * provider unmounted, and the next test — which signed in as nobody — was
   * refused Ashgrove's handover as that carer. Access outliving the session
   * that authorised it, arriving through an unmount instead of a sign-out.
   * Cleared here as well as in `endSession`.
   */
  useEffect(() => resetViewerScope, [])

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
