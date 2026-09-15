import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { RolePermissions } from './RolePermissions'
import styles from './me.module.css'

/**
 * What the signed-in person can do. PRD §6.7.
 *
 * One row of the manager's matrix, rendered by the same component the
 * invitation screen uses, so what somebody is shown before accepting and what
 * they are shown afterwards are the same screen.
 */
export function MyPermissionsRoute() {
  const { currentUser, activeSite } = useSession()

  return (
    <div className={styles.page} data-my-permissions={currentUser.id}>
      <Link to="/me" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        My dashboard
      </Link>

      <header>
        <h1 className={styles.pageTitle}>What you can do</h1>
        <p className={styles.pageSubtitle}>
          {currentUser.fullName} · {STAFF_ROLE_NAMES[currentUser.role]} ·{' '}
          {activeSite.name}
        </p>
      </header>

      <RolePermissions staffRole={currentUser.role} who={currentUser.fullName} />
    </div>
  )
}
