import { Link, useParams } from 'react-router-dom'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { memberById } from '@/data/access/team-store'
import { RolePermissions } from '@/features/me/RolePermissions'
import styles from './auth.module.css'

/**
 * What an invitation would give somebody, before they accept it. PRD §6.7.
 *
 * The same component the signed-in person sees at `/me/permissions`, because
 * an invitation that describes access in its own words is a second description
 * of it — and the one somebody accepts on is the one that goes stale.
 */
export function InvitationAccessRoute() {
  const { staffId } = useParams<{ staffId: string }>()
  const member = staffId === undefined ? undefined : memberById(staffId)

  if (member === undefined) {
    return (
      <div className={styles.screen} data-invitation-missing>
        <h1 className={styles.title}>No invitation with that link</h1>
        <Link to="/sign-in" className={styles.linkButton}>
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.screen} data-invitation-access={member.id}>
      <Link to={`/invitation/${member.id}`} className={styles.linkButton}>
        Back to the invitation
      </Link>

      <header>
        <h1 className={styles.title}>What you would be able to do</h1>
        <p className={styles.subtitle}>
          {member.ref.fullName} · {STAFF_ROLE_NAMES[member.role]}
        </p>
      </header>

      <RolePermissions staffRole={member.role} who={member.ref.fullName} />
    </div>
  )
}
