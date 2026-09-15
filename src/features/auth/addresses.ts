import type { StaffMember } from '@/data/types'
import type { Site } from '@/data/types'

/**
 * The address somebody would sign in with. PRD §6.7.
 *
 * **Derived, never stored.** `StaffMember` has no email field and is not
 * getting one: it holds the minimum on purpose, and a field nobody has decided
 * how to protect is how a care system starts holding data it was not built to
 * hold. This is a demonstration address computed from a name and a home, and
 * it exists so the sign-in screen can ask the question a real one would.
 *
 * One owner, because the form has to recognise what the form suggests. Two
 * places building "k.osei@rosewoodcourt.example" from a name is two rules, and
 * the second one drifts the day somebody has two surnames.
 */
export function addressFor(member: StaffMember, site: Site): string {
  const parts = member.ref.fullName.trim().toLowerCase().split(/\s+/)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]! : first
  const domain = site.name.toLowerCase().replace(/[^a-z]/g, '')
  return `${first.charAt(0)}.${last}@${domain}.example`
}

/**
 * Who an address belongs to, or nobody.
 *
 * Matched against people whose standing is `has_access`. Somebody suspended,
 * or on the team with access never set up, is an access decision the team
 * record already took, and a sign-in screen is not the place to take it again.
 */
export function memberForAddress(
  typed: string,
  members: StaffMember[],
  sites: Site[],
): StaffMember | undefined {
  const wanted = typed.trim().toLowerCase()
  if (wanted === '') return undefined

  /*
   * **Any of their homes, from Phase 18.** The address is derived from a name
   * and a home, so somebody working at two has two of them, and a deputy
   * manager overseeing both sites would otherwise be unable to sign in with
   * the address the second home's screen suggested to them.
   */
  return members.find((member) => {
    if (member.standing.kind !== 'has_access') return false
    return member.siteIds.some((siteId) => {
      const site = sites.find((entry) => entry.id === siteId)
      return site !== undefined && addressFor(member, site) === wanted
    })
  })
}
