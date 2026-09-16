import { useCallback } from 'react'
import type { CarePlanDomainId, Incident, IsoDateTime, ResidentId } from '@/data/types'
import { getResidentIncidents } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { carePlanDomainName } from '@/data/access/review-flags'
import { INCIDENT_TYPES } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './care-plan.module.css'
import { NotYourHome } from '@/components/status'

/**
 * What this care plan owes, from incidents somebody else closed.
 *
 * Read through this session's clearings rather than from the fixtures, so a
 * domain finalised a minute ago stops being owed on the screen that says it is
 * owed. Reading the raw fixtures here would leave the obligation standing
 * after the work was done, which is the invariant failing in the mirror.
 *
 * Renders nothing when nothing is owed — a banner that says "no reviews
 * outstanding" on twenty-nine of thirty screens is volume that drowns the
 * thirtieth.
 */
export function OwedReviews({
  residentId,
  domainId,
  now,
  revision,
}: {
  residentId: ResidentId
  /** Scoped to one domain on the editor; every domain on the list. */
  domainId?: CarePlanDomainId
  /**
   * One instant for the whole screen, captured by the route.
   *
   * Passed in rather than read here so that this block and the row beside it
   * cannot disagree about whether a deadline has passed, and so a test can pin
   * the hour it runs at (§8).
   */
  now: IsoDateTime
  /**
   * Bumped by the screen after every write, so this block re-reads.
   *
   * Without it, finalising clears the flag and this banner goes on saying the
   * plan owes a review — the screen contradicting itself about the work
   * somebody just did, which is the obligation failing in the mirror.
   */
  revision?: number
}) {
  const load = useCallback(() => getResidentIncidents(residentId), [residentId])
  const resource = useResource<Incident[]>(load, [residentId, revision])
  const format = useSiteFormat()

  if (resource.kind === 'loading') {
    return (
      <p className={styles.loading} role="status">
        Checking post-incident reviews…
      </p>
    )
  }

  /* The record exists, in a home this viewer is not appointed to. */

  if (resource.kind === 'refused') {
    return <NotYourHome refusal={resource} />
  }

  if (resource.kind === 'error') {
    // Said rather than swallowed. Silence here reads as "nothing is owed",
    // which is the one thing this block must never accidentally claim.
    return (
      <div className={styles.owed} data-owed-error>
        <p className={styles.owedTitle}>
          Post-incident reviews could not be read for this resident
        </p>
        <p className={styles.owedItem}>
          Whether this care plan owes a review is unknown, not settled.
        </p>
      </div>
    )
  }

  const owed = resource.data.flatMap((incident) =>
    incident.reviewFlags
      .filter((flag) => flag.state.kind === 'awaiting')
      .filter((flag) => flag.target.kind === 'care_plan_domain')
      .filter((flag) =>
        domainId === undefined
          ? true
          : flag.target.kind === 'care_plan_domain' &&
            flag.target.domainId === domainId,
      )
      .map((flag) => ({ incident, flag })),
  )

  if (owed.length === 0) return null

  return (
    <div className={styles.owed} data-owed={owed.length}>
      <p className={styles.owedTitle}>
        {owed.length === 1
          ? 'This care plan owes a post-incident review'
          : 'This care plan owes post-incident reviews'}
      </p>
      {owed.map(({ incident, flag }) => {
        const domain =
          flag.target.kind === 'care_plan_domain'
            ? carePlanDomainName(flag.target.domainId)
            : ''
        const phrase =
          INCIDENT_TYPES.find((entry) => entry.id === incident.type)?.phrase ??
          incident.type

        return (
          <p
            key={`${incident.id}-${domain}`}
            className={styles.owedItem}
            data-owed-incident={incident.id}
          >
            {domain}, {phrase} of{' '}
            <span data-numeric>{format.instantDate(incident.occurredAt)}</span>.{' '}
            {flag.dueBy < now
              ? 'Already past its 48 hours.'
              : `Due by ${format.dateTime(flag.dueBy)}.`}
          </p>
        )
      })}
    </div>
  )
}
