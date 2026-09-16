import type { SessionHolding } from './session-holding'
import { memberById } from './team-store'
import type { SiteId, StaffId } from '../types'

/**
 * Who is signed in, so a loader can ask which homes they are appointed to.
 *
 * **It holds an id and nothing else.** The moment it holds a name, a role or a
 * list of homes it has become a second copy of something `StaffMember` already
 * owns, and the argument for it is gone. `viewerHomes()` derives through
 * `memberById` at the moment of the call, which is not merely tidier: an admin
 * reassigning a manager's homes mid-session takes effect on the next read,
 * where a copied list would go stale at precisely the moment access changed.
 *
 * **Why this exists at all, rather than the loaders asking the session.** The
 * session is React context and `client.ts` is a plain module. Context is
 * readable only during a render, and a loader called from `useResource` runs
 * outside one — so the two cannot see each other by construction rather than
 * by arrangement. The obvious fix looks available and is not. The alternative
 * was passing the homes in at every call site, which is the rule-living-in-a-
 * form failure one file over: 26 loaders, dozens of call sites, and the next
 * one forgets silently.
 *
 * **Nobody signed in means no scope, not an empty scope.** Every product
 * screen sits behind the sign-in gate, so a loader reached without a viewer is
 * a sign-in screen or a test. Returning "no scope" there keeps this from being
 * a second gate that disagrees with the first; returning an empty list would
 * refuse everything, which is a different product rather than a safer one.
 */

let viewerId: StaffId | undefined

export function setViewer(id: StaffId): void {
  viewerId = id
}

/**
 * The homes this viewer is appointed to, or `undefined` when nobody is.
 *
 * Derived on every call. `StaffMember.siteIds` stays the only owner of which
 * homes somebody holds.
 */
export function viewerHomes(): SiteId[] | undefined {
  if (viewerId === undefined) return undefined
  const member = memberById(viewerId)
  return member?.siteIds
}

/** Whether this viewer may read records belonging to a home. */
export function viewerHolds(siteId: SiteId): boolean {
  const homes = viewerHomes()
  return homes === undefined || homes.includes(siteId)
}

/**
 * Nothing, and it is on the list deliberately.
 *
 * A pointer is not work somebody would lose, so it contributes no line to the
 * sign-out dialog. It is on `session-losses` because it must be *cleared* with
 * everything else: a pointer surviving a sign-out is an access decision
 * outliving the session that authorised it, which is the shape family members
 * surviving a withdrawn consent already has.
 */
export function viewerScopeHoldings(): SessionHolding[] {
  return []
}

/**
 * Cleared last, after every store has been reset.
 *
 * **Order matters here even though today's counts do not depend on it.** The
 * sign-out dialog reports what this session wrote, and the moment any holdings
 * function derives its count by asking whose work it was rather than what a
 * store recorded, clearing this first would zero the list — a dialog saying
 * nothing would be lost with plenty to lose. The cost of putting it last is
 * nothing; the cost of discovering that later is a sign-out somebody trusted.
 */
export function resetViewerScope(): void {
  viewerId = undefined
}
