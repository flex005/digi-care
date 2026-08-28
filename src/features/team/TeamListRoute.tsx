import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Avatar, Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { AddMemberDialog, Tally, standingCounts } from './TeamManagement'
import { sites } from '@/data/fixtures/organisation'
import { Standing } from './TeamParts'
import styles from './team.module.css'

/**
 * The team. PRD §6.7, Phase 14.
 *
 * The sentence: **who works here, ordered by name, with their role and whether
 * they still have access — never ordered by anything they did.**
 *
 * **The ordering is said out loud rather than merely obeyed.** A table of
 * people sorted by a count is a ranking however it is labelled, and saying so
 * on the screen is what stops somebody adding a sort control later in good
 * faith.
 */
export function TeamListRoute() {
  const { organisation } = useSession()
  const [adding, setAdding] = useState(false)
  const [, setVersion] = useState(0)
  const members = teamMembers()
  const counts = standingCounts(members)
  const siteName = (id: string) =>
    sites.find((site) => site.id === id)?.name ?? 'Site not on record'

  return (
    <div className={styles.page} data-team-list>
      <header className={styles.pageHead}>
        <div className={styles.tallies} data-team-tallies>
          <Tally label="On the team" value={members.length} of={organisation.name} />
          <Tally
            label="With access"
            value={counts.has_access}
            of={`of ${members.length}`}
          />
          <Tally
            label="Suspended"
            value={counts.suspended}
            of={`of ${members.length}`}
            tone="caution"
          />
          <Tally
            label="Never set up"
            value={counts.never_given_access}
            of={`of ${members.length}`}
            tone="gap"
          />
        </div>
      </header>

      <AddMemberDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => setVersion((count) => count + 1)}
      />

      <Card>
        {/*
         * The actions sit opposite the ordering note rather than under the
         * tallies: they act on this list, and the row they are on is the one
         * that says what the list is.
         */}
        <div className={styles.listBar}>
          <p className={styles.orderNote} data-order-note>
            Ordered by name. <b>Never by anything anybody did</b>: people sorted by a
            count is a ranking however it is labelled.
          </p>
          <div className={styles.pageActions}>
            <Button onClick={() => setAdding(true)} data-add-member>
              Add a team member
            </Button>
            <Link to="permissions" className={styles.headLink} data-permissions-link>
              Permissions
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </Link>
            <Link to="activity" className={styles.headLink} data-activity-link>
              Activity log
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </Link>
          </div>
        </div>

        <ul className={styles.rows}>
          {members.map((member) => (
            <li key={member.id}>
              <div className={styles.row} data-member={member.id}>
                <div className={styles.who}>
                  {/* A member of staff has no photograph on file — this build holds
                      none — and initials distinguish two people where a
                      silhouette would not. */}
                  <Avatar
                    photo={{ kind: 'not_on_file' }}
                    name={member.ref.fullName}
                    size="medium"
                    tone="brand"
                  />
                  <div>
                    <p className={styles.name}>{member.ref.displayName}</p>
                    <p className={styles.role}>
                      {member.ref.fullName} · {STAFF_ROLE_NAMES[member.role]}
                    </p>
                  </div>
                </div>

                <Standing standing={member.standing} />

                <p className={styles.site}>{siteName(member.siteId)}</p>

                <Link
                  to={`team/${member.id}`}
                  className={styles.openLink}
                  data-open-member={member.id}
                  aria-label={`Open ${member.ref.fullName}`}
                >
                  Open
                  <Icon
                    name="arrows-sharp/arrow-right-01-sharp"
                    size={16}
                    aria-hidden
                  />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
