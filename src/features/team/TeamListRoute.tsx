import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Avatar, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { STAFF_ROLE_NAMES } from '@/data/types'
import type { SiteId, StaffRole, StaffStanding } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { Tally, standingCounts } from './TeamManagement'
import { InviteDrawer } from './InviteDrawer'
import { useViewer } from '@/app/session/use-viewer'
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
  const viewer = useViewer()
  const [, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState<'all' | SiteId>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all')
  const [standingFilter, setStandingFilter] = useState<'all' | StaffStanding['kind']>(
    'all',
  )

  const all = teamMembers()
  /*
   * **The tallies count the whole team, never the filtered set.** A claim over
   * a filtered set carries the filter or it is false (CLAUDE.md §1), and the
   * tallies are a claim about this organisation: "4 never set up" under a role
   * filter would be four of the care workers, read as four of everybody. So
   * they are computed before filtering and the filtered count is stated
   * separately, against its denominator.
   */
  const counts = standingCounts(all)
  const wanted = search.trim().toLowerCase()
  const members = all.filter(
    (member) =>
      (wanted === '' || member.ref.fullName.toLowerCase().includes(wanted)) &&
      (siteFilter === 'all' || member.siteIds.includes(siteFilter)) &&
      (roleFilter === 'all' || member.role === roleFilter) &&
      (standingFilter === 'all' || member.standing.kind === standingFilter),
  )
  const filtered = members.length !== all.length
  const siteName = (id: string) =>
    sites.find((site) => site.id === id)?.name ?? 'Site not on record'

  return (
    <div className={styles.page} data-team-list>
      <header className={styles.pageHead}>
        <div className={styles.tallies} data-team-tallies>
          <Tally label="On the team" value={all.length} of={organisation.name} />
          <Tally
            label="With access"
            value={counts.has_access}
            of={`of ${all.length}`}
          />
          <Tally
            label="Suspended"
            value={counts.suspended}
            of={`of ${all.length}`}
            tone="caution"
          />
          <Tally
            label="Never set up"
            value={counts.never_given_access}
            of={`of ${all.length}`}
            tone="gap"
          />
        </div>
      </header>

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
            {/*
             * **The invite drawer replaces the add dialog for an Admin**, and
             * the old one stays for nobody: AM v2.0's TM-02 asks for name,
             * role, homes and residents in one act, which the Phase 14 dialog
             * did not have. Withheld from a Manager, who reads this list and
             * does not decide who is on it.
             */}
            {viewer.may('manage_team') ? (
              <InviteDrawer onAdded={() => setVersion((count) => count + 1)} />
            ) : (
              <p className={styles.hint} data-team-read-only>
                Your role is {viewer.roleName}, which reads the team and does not change
                who is on it.
              </p>
            )}
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

        {/*
         * AM v2.0's TM-01 filters. The claim under them names the filter,
         * because a list of three under a heading that says the team has
         * seventeen people is a claim about the home that is an artefact of
         * the view.
         */}
        <div className={styles.filterBar} data-team-filters>
          <label className={styles.searchField}>
            <span className={styles.fieldLabel}>Search by name</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              data-field="team-search"
            />
          </label>

          <label className={styles.searchField}>
            <span className={styles.fieldLabel}>Home</span>
            <select
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value as 'all' | SiteId)}
              data-filter="site"
            >
              <option value="all">Every home</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.searchField}>
            <span className={styles.fieldLabel}>Role</span>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as 'all' | StaffRole)
              }
              data-filter="role"
            >
              <option value="all">Every role</option>
              {(Object.keys(STAFF_ROLE_NAMES) as StaffRole[]).map((role) => (
                <option key={role} value={role}>
                  {STAFF_ROLE_NAMES[role]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.searchField}>
            <span className={styles.fieldLabel}>Access</span>
            <select
              value={standingFilter}
              onChange={(event) =>
                setStandingFilter(event.target.value as 'all' | StaffStanding['kind'])
              }
              data-filter="standing"
            >
              <option value="all">Any standing</option>
              <option value="has_access">Has access</option>
              <option value="never_given_access">Never set up</option>
              <option value="suspended">Suspended</option>
              <option value="no_longer_has_access">No longer has access</option>
            </select>
          </label>
        </div>

        <p className={styles.filterClaim} data-filter-claim>
          {filtered
            ? `Showing ${members.length} of ${all.length} on the team. The figures above are the whole team, not this list.`
            : `All ${all.length} on the team.`}
        </p>

        {members.length === 0 ? (
          <p className={styles.noMatches} data-no-matches>
            Nobody on the team matches these filters. That is a fact about the filters
            rather than about the team: {all.length} people are on the record.
          </p>
        ) : null}

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

                {/* Every home they work at. AM v2.0's TM-01 has a SITES
                    ASSIGNED column, and a manager across two homes reading as
                    one is the whole reason `siteIds` is a list. */}
                <p className={styles.site} data-sites={member.siteIds.length}>
                  {member.siteIds.map(siteName).join(' · ')}
                </p>

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
