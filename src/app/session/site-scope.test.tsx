import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import type { Site, StaffMember } from '@/data/types'
import { SessionProvider } from './SessionProvider'
import { useSession } from './use-session'
import { SignInAs } from '@/test/sign-in-as'
import { TooltipProvider } from '@/components/primitives'
import { TopBar } from '@/components/shell/TopBar'
import { memberById, teamMembers } from '@/data/access/team-store'
import {
  staffAluko,
  staffHalloran,
  staffOkonkwo,
  sites,
} from '@/data/fixtures/organisation'

/**
 * Which homes a viewer is handed. Phase 29.
 *
 * **The switcher is a property of the assignment, never of the role.** A
 * manager appointed to one home has no switcher; a deputy covering two has
 * one, which is what AM v2.0's TM-04 exists for; the admin administering the
 * organisation has both. A control whose presence depended on the role would
 * be a fact about the reader rather than about their record — the same shape
 * as a figure that means two things.
 *
 * The assertions go through the session rather than the control, because the
 * session is where the rule lives: `TopBar` has drawn a switcher only for more
 * than one home since Phase 0, and it was handed every configured home
 * regardless of who had signed in.
 */

/** Reports what the session handed this viewer. */
function Report({ onRead }: { onRead: (sites: Site[], active: Site) => void }) {
  const { sites: theirs, activeSite } = useSession()
  /*
   * Braces, so the effect returns nothing. An arrow body returns whatever the
   * call returns — here the length from `push` — and React treats an effect's
   * return value as its cleanup, then throws "destroy is not a function" on
   * unmount. The assertion never ran; the harness died tidying up after it.
   */
  useEffect(() => {
    onRead(theirs, activeSite)
  }, [theirs, activeSite, onRead])
  return null
}

/** Signs in as one named person, where the role alone would not say which. */
function SignInAsMember({ member }: { member: StaffMember }) {
  const { signInAs } = useSession()
  useEffect(() => {
    const site = sites.find((entry) => member.siteIds.includes(entry.id))!
    signInAs(member, site)
  }, [member, signInAs])
  return null
}

function handedTo(who: 'role' | 'member', subject: string | StaffMember) {
  const seen: { sites: Site[]; active: Site }[] = []
  render(
    <SessionProvider>
      {who === 'role' ? (
        <SignInAs as={subject as never} />
      ) : (
        <SignInAsMember member={subject as StaffMember} />
      )}
      <Report
        onRead={(sitesHanded, active) => seen.push({ sites: sitesHanded, active })}
      />
    </SessionProvider>,
  )
  return seen
}

describe('a viewer is handed the homes they are appointed to', () => {
  it('gives a manager appointed to one home exactly that home', async () => {
    const seen = handedTo('member', memberById(staffAluko.id)!)
    await waitFor(() => expect(seen.at(-1)!.sites).toHaveLength(1))
    expect(seen.at(-1)!.sites[0]!.id).toBe('site-rosewood-court')
    expect(seen.at(-1)!.active.id).toBe('site-rosewood-court')
  })

  it('gives a deputy covering two homes both of them', async () => {
    const seen = handedTo('member', memberById(staffHalloran.id)!)
    await waitFor(() => expect(seen.at(-1)!.sites).toHaveLength(2))
  })

  it('gives the admin who administers the organisation both', async () => {
    const seen = handedTo('member', memberById(staffOkonkwo.id)!)
    await waitFor(() => expect(seen.at(-1)!.sites).toHaveLength(2))
  })

  it('hands every home to nobody, because the sign-in screens resolve against all of them', () => {
    const seen: Site[][] = []
    render(
      <SessionProvider>
        <Report onRead={(sitesHanded) => seen.push(sitesHanded)} />
      </SessionProvider>,
    )
    // Signed out there is no viewer to scope to, and an address is built per home.
    expect(seen.at(-1)).toHaveLength(sites.length)
  })

  it('has both manager branches in the fixtures, or the rule is written against nothing', () => {
    const deputies = teamMembers().filter(
      (member) =>
        member.role === 'deputy_manager' && member.standing.kind === 'has_access',
    )
    expect(deputies.some((member) => member.siteIds.length === 1)).toBe(true)
    expect(deputies.some((member) => member.siteIds.length > 1)).toBe(true)
  })
})

describe('the homes a viewer is handed keep their identity', () => {
  it('hands over the same array when the same person signs in again', async () => {
    /*
     * **The loop this guards against spun every test that signed in.** `sites`
     * was memoised on the sign-in, which takes a new timestamp every time, so
     * signing in again produced a new array for the same homes — and anything
     * depending on the array re-ran, including the helper that signs in.
     */
    const member = memberById(staffAluko.id)!
    const seen: Site[][] = []
    function SignInTwice() {
      const { signInAs } = useSession()
      useEffect(() => {
        const site = sites.find((entry) => member.siteIds.includes(entry.id))!
        signInAs(member, site)
        const again = setTimeout(() => signInAs(member, site), 20)
        return () => clearTimeout(again)
      }, [signInAs])
      return null
    }
    render(
      <SessionProvider>
        <SignInTwice />
        <Report onRead={(sitesHanded) => seen.push(sitesHanded)} />
      </SessionProvider>,
    )
    await new Promise((settle) => setTimeout(settle, 80))
    const signedIn = seen.filter((entry) => entry.length === 1)
    expect(signedIn.length).toBeGreaterThan(0)
    expect(new Set(signedIn).size, 'a new array for the same homes').toBe(1)
  })
})

describe('the switcher follows from what the session handed over', () => {
  const draw = (handed: Site[]) =>
    render(
      <TooltipProvider>
        <TopBar
          sites={handed}
          activeSite={handed[0]!}
          onSiteChange={() => {}}
          alertCount={0}
          userName="D. Aluko"
          userRoleLabel="Deputy manager"
          onMyPermissions={() => {}}
          onSignOut={() => {}}
        />
      </TooltipProvider>,
    )

  it('draws no switcher for one home, and still names it', () => {
    const { container } = draw([sites[0]!])
    // Absent, not disabled: there is nothing to switch to.
    expect(container.querySelector('[aria-label^="Site:"]')).toBeNull()
    expect(container.textContent).toContain(sites[0]!.name)
  })

  it('draws one for two homes', () => {
    const { container } = draw(sites)
    expect(container.querySelector('[aria-label^="Site:"]')).toBeTruthy()
  })
})
