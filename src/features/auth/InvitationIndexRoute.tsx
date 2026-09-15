import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { invitationHasExpired, invitations } from '@/data/fixtures/invitations'
import { memberById } from '@/data/access/team-store'
import { formatDate, zonedDate } from '@/lib/format'
import styles from './auth.module.css'

/**
 * The way into an invitation. PRD §6.7.
 *
 * **In a real deployment this screen does not exist.** An invitation arrives
 * as a link in an email addressed to one person, and that link is the only way
 * anybody reaches theirs. There is no email here and no server to send one, so
 * the alternative was an invitation nobody could open without being told the
 * URL — which is the same as not having built it.
 *
 * So it lists who has one outstanding, and says why it is listing them. It is
 * not a directory of staff: everybody here is somebody the team record already
 * holds as added-but-never-set-up, which is the state an invitation exists to
 * close.
 *
 * **Both states render, and the lapsed one is not hidden.** An invitation that
 * ran out is a finding about a home — somebody was added over a month ago and
 * nobody followed it up — and a list showing only the live one would report
 * that as nothing to do.
 */
export function InvitationIndexRoute() {
  const { activeSite, sites } = useSession()

  const today: IsoDate = zonedDate(
    appNow().toISOString() as IsoDateTime,
    activeSite.timeZone,
  )
  const outstanding = invitations()

  return (
    <div className={styles.screen} data-invitation-index>
      <h1 className={styles.title}>Invitations</h1>

      <div className={`${styles.card} ${styles.inv}`}>
        {outstanding.length === 0 ? (
          /*
           * A real answer rather than an empty screen: nobody is waiting, which
           * is different from a list that failed to load.
           */
          <p className={styles.nothingToLose} data-no-invitations>
            Nobody is waiting to be set up.
          </p>
        ) : (
          <ul className={styles.inviteList}>
            {outstanding.map((invitation) => {
              const member = memberById(invitation.staffId)
              if (member === undefined) return null
              const home =
                sites.find((site) => member?.siteIds.includes(site.id)) ?? activeSite
              const expired = invitationHasExpired(invitation, today)

              return (
                <li key={invitation.staffId}>
                  <Link
                    to={`/invitation/${invitation.staffId}`}
                    className={styles.inviteRow}
                    data-invitation-link={invitation.staffId}
                  >
                    <span>
                      <span className={styles.inviteName}>{member.ref.fullName}</span>
                      <span className={styles.inviteMeta}>
                        {STAFF_ROLE_NAMES[member.role]} · {home.name} · invited by{' '}
                        {invitation.invitedBy.fullName} on{' '}
                        {formatDate(invitation.invitedOn)}
                      </span>
                    </span>

                    {expired ? (
                      <span
                        className={styles.inviteExpired}
                        data-invite-state="expired"
                      >
                        Expired {formatDate(invitation.expiresOn)}
                      </span>
                    ) : (
                      <span className={styles.inviteLive} data-invite-state="live">
                        Expires {formatDate(invitation.expiresOn)}
                      </span>
                    )}

                    <Icon
                      name="arrows-sharp/arrow-right-01-sharp"
                      size={16}
                      aria-hidden
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link to="/sign-in" className={styles.linkButton}>
        Back to sign in
      </Link>
    </div>
  )
}
