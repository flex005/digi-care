import type { SiteId, StaffMember } from '@/data/types'
import { Button } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { setSites } from '@/data/access/team-store'
import styles from './team.module.css'

/**
 * Which homes somebody works at. AM v2.0 TM-04, Phase 18.
 *
 * **One role across all of them**, which is AM v2.0 being explicit that a
 * Manager cannot be an Admin at one site and a Manager at another. v4 §1.2
 * says the opposite and the newer screen-level document wins; the field's
 * docblock records the disagreement so that a later reversal is a decision
 * rather than a discovery.
 *
 * **This is what Sandra Chen is.** AM v2.0 describes a Quality Manager with
 * cross-site Admin access over five homes, and reading that as a role produced
 * `organisation_admin`, a union member nobody had decided. She is an Admin
 * assigned to five sites, and this section is the assignment.
 *
 * Read by anybody who can open the team, changed only by the registered
 * person. A manager needs to know which homes a colleague covers to know who
 * is on tonight; deciding it is not theirs.
 */
export function SitesSection({
  member,
  onChanged,
}: {
  member: StaffMember
  onChanged: () => void
}) {
  const { sites } = useSession()
  const viewer = useViewer()
  const mayChange = viewer.may('manage_team')

  const toggle = (siteId: SiteId) => {
    const next = member.siteIds.includes(siteId)
      ? member.siteIds.filter((id) => id !== siteId)
      : [...member.siteIds, siteId]
    /*
     * Refused rather than offered and then rejected on submit: the control
     * that would empty the list is the one that does not appear. AM v2.0 has
     * an X per site with nothing said about the last one, which is how a
     * record with no home in it gets written.
     */
    if (next.length === 0) return
    setSites(member.id, next)
    onChanged()
  }

  return (
    <section className={styles.section} data-sites-section>
      <h2 className={styles.sectionTitle}>Homes</h2>
      <p className={styles.sectionNote}>
        {mayChange
          ? 'Adding a home gives access to every resident in it. One role across all of them: somebody cannot be a manager at one home and something else at another.'
          : `Which homes ${member.ref.fullName.split(' ')[0]} works at. Your role is ${viewer.roleName}, which reads this and does not change it.`}
      </p>

      <ul className={styles.siteList}>
        {sites.map((site) => {
          const has = member.siteIds.includes(site.id)
          const last = has && member.siteIds.length === 1
          return (
            <li key={site.id} className={styles.siteRow} data-site-row={site.id}>
              <span className={has ? styles.siteOn : styles.siteOff}>
                {site.name}
                <span className={styles.siteMeta}>
                  {has ? `works here · ${site.timeZone}` : 'no access here'}
                </span>
              </span>
              {!mayChange ? null : last ? (
                /*
                 * Named rather than disabled without a reason: a control that
                 * is greyed out with nothing said reads as a thing that might
                 * work later.
                 */
                <span className={styles.siteLast} data-last-home>
                  Their only home, so it cannot be removed; remove their access instead.
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="small"
                  data-toggle-site={site.id}
                  onClick={() => toggle(site.id)}
                >
                  {has ? 'Remove' : 'Add'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
