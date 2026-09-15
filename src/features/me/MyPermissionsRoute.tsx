import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Button, Card } from '@/components/primitives'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { memberById } from '@/data/access/team-store'
import { Standing } from '@/features/team/TeamParts'
import { formatTime } from '@/lib/format'
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
  const { currentUser, activeSite, sites, signIn } = useSession()
  const member = memberById(currentUser.id)

  return (
    <div className={styles.page} data-my-permissions={currentUser.id}>
      <header>
        <h1 className={styles.pageTitle}>What you can do</h1>
        <p className={styles.pageSubtitle}>
          {currentUser.fullName} · {STAFF_ROLE_NAMES[currentUser.role]} ·{' '}
          {activeSite.name}
        </p>
      </header>

      {/*
       * **Four facts from `/me`, which is gone.** That screen was built for
       * somebody working a shift: the next round with a button to open it, a
       * night-or-day pill, what they flagged and were still waiting on, and a
       * count of residents nobody had written up. An Admin does not run a
       * medication round, AM v2.0 has no personal dashboard at all, and three
       * of its four sections were either a duplicate of the site Dashboard or
       * the inverse of a queue that already exists.
       *
       * What was left was an account page, and it belongs here rather than
       * under Settings for a concrete reason: **the auditor has no access to
       * Settings**, and an account page living there would lock them out of
       * their own. This route belongs to no module, which is what makes it
       * every role's.
       */}
      <Card>
        <div className={styles.yoursHead}>
          <h2 className={styles.yoursTitle}>Yours</h2>
          <p className={styles.yoursBody}>
            Your details and your access. There are no counts of your work here, and
            there will not be: this build has no rota, so a figure about a person has no
            honest denominator and is an accusation rather than a measurement.
          </p>
        </div>

        <div className={styles.details}>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Role</span>
            <span className={styles.detailValue}>
              {STAFF_ROLE_NAMES[currentUser.role]}
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>
              {member === undefined || member.siteIds.length < 2 ? 'Home' : 'Homes'}
            </span>
            <span className={styles.detailValue} data-my-homes>
              {member === undefined
                ? activeSite.name
                : member.siteIds
                    .map((id) => sites.find((site) => site.id === id)?.name ?? id)
                    .join(' · ')}
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>Access</span>
            {/*
             * **The team screen's component, not a second sentence.** This was
             * a `standingSentence` function in `/me` saying the same fact the
             * team's `Standing` renders, which is a component and a function
             * describing one thing: the drift caught in `/me`'s own tiles, and
             * deleting the screen is the moment collapsing it costs nothing.
             */}
            <span className={styles.detailValue} data-standing>
              {member === undefined ? (
                'Not on the team record'
              ) : (
                <Standing standing={member.standing} />
              )}
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailKey}>This session</span>
            <span className={styles.detailValue} data-session-started>
              {signIn.kind === 'signed_in'
                ? `Signed in at ${formatTime(signIn.at, activeSite.timeZone)}, in ${activeSite.timeZone}`
                : 'Not signed in'}
            </span>
          </div>
        </div>

        <div className={styles.panelActions}>
          <Button variant="secondary" disabled data-no-password>
            Change my password
          </Button>
          <Link to="/sign-out" className={styles.plainButton} data-sign-out-link>
            Sign out
          </Link>
        </div>
        <p className={styles.yoursBody}>
          There is no password to change: nothing is stored and nothing is checked.
        </p>
      </Card>

      <RolePermissions staffRole={currentUser.role} who={currentUser.fullName} />
    </div>
  )
}
