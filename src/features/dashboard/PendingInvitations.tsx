import { Link } from 'react-router-dom'
import { useViewer } from '@/app/session/use-viewer'
import { useSession } from '@/app/session/use-session'
import { memberById } from '@/data/access/team-store'
import { invitations } from '@/data/fixtures/invitations'
import { now as appNow } from '@/data/fixtures/clock'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { formatDate, pluralise, zonedDate } from '@/lib/format'
import styles from './dashboard.module.css'

/**
 * Invitations nobody has accepted. AM v2.0 DASH-01, Phase 19.
 *
 * **Admin only, because it is a list of work only they can do.** A manager
 * cannot invite, resend or cancel, so telling them two invitations are
 * outstanding is telling them about somebody else's queue: a notice nobody can
 * act on is a notice they learn to scroll past, and the next one they scroll
 * past is one they could have acted on.
 *
 * **Two days rather than AM v2.0's forty-eight hours, which is the same
 * number said in the units the record carries.** An invitation's age is a date
 * arithmetic on `addedOn`, not a timestamp, so counting hours would be
 * inventing precision the record does not hold.
 *
 * **It names them and never counts them alone.** "2 invitations have not been
 * accepted" is a figure with nothing behind it; the reader needs to know that
 * one is a deputy manager five weeks in, which is a different fact from an
 * auditor invited on Tuesday.
 */
const STALE_AFTER_DAYS = 2

export function PendingInvitations() {
  const { activeSite } = useSession()
  const viewer = useViewer()

  if (!viewer.may('manage_team')) return null

  const today: IsoDate = zonedDate(
    appNow().toISOString() as IsoDateTime,
    activeSite.timeZone,
  )
  const stale = invitations().filter((invitation) => {
    const days =
      (new Date(today).getTime() - new Date(invitation.invitedOn).getTime()) /
      86_400_000
    return days > STALE_AFTER_DAYS
  })

  if (stale.length === 0) return null

  return (
    <div className={styles.pendingInvites} data-pending-invitations={stale.length}>
      <p className={styles.pendingTitle}>
        {pluralise(stale.length, 'invitation')} nobody has accepted
      </p>
      <ul className={styles.pendingList}>
        {stale.map((invitation) => {
          const member = memberById(invitation.staffId)
          return (
            <li key={invitation.staffId} data-pending={invitation.staffId}>
              {member?.ref.fullName ?? invitation.staffId} · sent{' '}
              <span data-numeric>{formatDate(invitation.invitedOn)}</span> by{' '}
              {invitation.invitedBy.fullName}
            </li>
          )
        })}
      </ul>
      <Link to="/settings" className={styles.pendingLink} data-pending-link>
        Open the team
      </Link>
    </div>
  )
}
