import { useMemo } from 'react'
import type { PermissionLevel, StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import {
  type AdminActId,
  accountabilityOf,
  levelFor,
  mayDo,
  readOnlyReason,
} from '@/features/team/permissions'
import { useSession } from './use-session'

/**
 * What the person looking at this screen can do here. Phase 17.
 *
 * **One owner, asked by the call site.** Every screen that used to read
 * `accessMode` off the session now names its own module and asks this, which
 * is the §6 rule about a value whose correct rendering depends on where it
 * appears: a global read-only flag cannot say "records care notes, reads
 * settings", so it had to pick one, and picking one is how it went dead.
 *
 * The role comes from the signed-in member. It is never passed in, for the
 * same reason a resident's identity comes from the route parameter and never
 * from component state (PRD §2.4): a screen that is told who is looking can be
 * told wrongly.
 */
export interface Viewer {
  role: StaffRole
  /** The role as somebody would say it: "Deputy manager". */
  roleName: string
  level: (moduleId: string) => PermissionLevel
  /** Can write what this module records. */
  canRecordIn: (moduleId: string) => boolean
  /** Can sign off somebody else's work here: countersign, finalise, close. */
  canApproveIn: (moduleId: string) => boolean
  /** Holds an act that belongs to the registered person rather than to a level. */
  may: (act: AdminActId) => boolean
  /** Whether the service is registered to this person. */
  isRegisteredPerson: boolean
  /** Why a module shows no write controls, naming the role rather than guessing it. */
  whyReadOnly: (moduleId: string) => string
}

export function useViewer(): Viewer {
  const { currentUser } = useSession()
  const role = currentUser.role

  return useMemo(
    () => ({
      role,
      roleName: STAFF_ROLE_NAMES[role],
      level: (moduleId: string) => levelFor(role, moduleId),
      canRecordIn: (moduleId: string) => {
        const level = levelFor(role, moduleId)
        return level === 'record' || level === 'approve'
      },
      canApproveIn: (moduleId: string) => levelFor(role, moduleId) === 'approve',
      may: (act: AdminActId) => mayDo(role, act),
      isRegisteredPerson: accountabilityOf(role) === 'registered_person',
      whyReadOnly: (moduleId: string) => readOnlyReason(role, moduleId),
    }),
    [role],
  )
}
