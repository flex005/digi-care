import { useEffect } from 'react'
import type { StaffRole } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { useSession } from '@/app/session/use-session'

/**
 * Signs the session in as somebody holding this role, for a test. Phase 17.
 *
 * **It replaced a helper that set a flag nobody could set.** Four test files
 * carried a `BecomeAuditor` button that called `setAccessMode('read_only')`,
 * which was the only thing in the product that could reach read-only after the
 * account menu's "View as" was removed: the branches were asserted by tests and
 * reachable by nobody. Signing in as a real member of staff is how a person
 * gets there, so it is how the test gets there.
 *
 * **One helper rather than four**, because the four were already drifting: two
 * of them explained the flip in a comment and two did not, and a fifth would
 * have copied whichever it landed next to.
 *
 * Mounted inside the provider and signs in on mount, so a screen under test
 * renders for that role from its first paint rather than flipping while the
 * reader watches. What is asserted is what the role sees, not a transition.
 */
/*
 * **The prop is `as` rather than `role`.** `<SignInAs role="auditor" />` is
 * what it wants to be called, and jsx-a11y reads any `role` prop as an ARIA
 * role and fails the build on "auditor". Renaming the prop costs a word;
 * silencing an accessibility rule to keep the word would be the first
 * exception in a file of them.
 */
export function SignInAs({ as: role }: { as: StaffRole }) {
  const { signInAs, sites, signIn } = useSession()

  useEffect(() => {
    const member = teamMembers().find(
      (entry) => entry.role === role && entry.standing.kind === 'has_access',
    )
    if (member === undefined)
      throw new Error(
        `No member of staff with access holds the role ${role}, so no test can render the product as one. Either the fixtures lost somebody or the role is not reachable by anybody.`,
      )
    /*
     * **Already signed in as this person: nothing to do.** Signing in again
     * changes the session, which re-runs this effect, which signs in again.
     * `SessionProvider` now keeps `sites` stable, which is the real fix; this
     * is the second one, so the helper cannot loop even if something else
     * unsettles its dependencies later.
     */
    if (signIn.kind === 'signed_in' && signIn.member.id === member.id) return
    const site = sites.find((entry) => member.siteIds.includes(entry.id))
    if (site === undefined)
      throw new Error(`${role} belongs to a site that is not configured.`)
    signInAs(member, site)
  }, [role, signInAs, sites, signIn])

  return null
}
