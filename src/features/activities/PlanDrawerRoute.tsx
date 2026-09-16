import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Activity, ActivityId, CarePlanDomainRecord, Resident } from '@/data/types'
import { getActivity } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Avatar, Button, Card } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount, pluralise } from '@/lib/format'
import { currentVersion } from '@/features/care-plan/plan-fields'
import styles from './activities.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * What is planned, who it is for, and what they have said they like.
 *
 * The sentence: **these people are invited, and this many of them have never
 * been asked what they like doing.**
 *
 * ## The preferences are read, never duplicated
 *
 * What somebody likes doing already lives in their care plan's social and
 * emotional wellbeing domain, in their own words. This screen reads it. A
 * field of its own here would be a second place for the same fact, and the two
 * would drift — the rule goals settled on, for the same reason.
 *
 * It also gives "never asked what they like" **for free and correctly**: an
 * unwritten social and emotional domain *is* nobody having asked, it already
 * renders hatched everywhere else, and the drawer can point at the screen that
 * fixes it rather than inventing a second gap to describe the same absence.
 */

interface Loaded {
  activity: Activity
  residents: Resident[]
}

export function PlanDrawerRoute() {
  const { activityId } = useParams<{ activityId: string }>()
  const { activeSite } = useSession()

  const load = useCallback(
    () => getActivity((activityId ?? '') as ActivityId),
    [activityId],
  )
  const resource = useResource<Loaded>(load, [activityId])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <Link to=".." relative="path" className={styles.backLink}>
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
          All activities
        </Link>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading this plan…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>This plan could not be loaded</p>
            <p className={styles.errorBody}>Nothing has been lost; this is a read.</p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Plan data={resource.data} />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Plan({ data }: { data: Loaded }) {
  const format = useSiteFormat()
  const { activity, residents } = data
  const byId = new Map(residents.map((resident) => [resident.id, resident]))

  const invited = activity.invited.map((entry) => ({
    residentId: entry.residentId,
    resident: byId.get(entry.residentId),
  }))
  const neverAsked = invited.filter(({ resident }) => likes(resident) === 'never_asked')

  return (
    <Card>
      <div className={styles.activityHead}>
        <h1 className={styles.activityName}>{activity.name}</h1>
        <p className={styles.activityMeta}>
          <span data-numeric>{format.dateTime(activity.startsAt)}</span> to{' '}
          <span data-numeric>{format.time(activity.endsAt)}</span> · {activity.place}
        </p>
      </div>

      <div className={styles.drawerSection}>
        <p className={styles.drawerHeading}>Planned by</p>
        <p className={styles.drawerBody}>
          {format.attributionOn(staffLabel(activity.plannedBy), activity.plannedAt)}
        </p>
      </div>

      <div className={styles.drawerSection}>
        <p className={styles.drawerHeading}>
          Invited: {pluralise(invited.length, 'resident')}
        </p>

        {neverAsked.length > 0 ? (
          <p className={styles.preferenceLead} data-never-asked={neverAsked.length}>
            <span data-numeric>{formatCount(neverAsked.length)}</span> of{' '}
            <span data-numeric>{formatCount(invited.length)}</span> invited have never
            been asked what they like doing. Their social and emotional wellbeing care
            plan domain has not been written: open the domain to ask them.
          </p>
        ) : null}

        {invited.map(({ residentId, resident }) => (
          <div className={styles.invitee} key={residentId} data-invitee={residentId}>
            {resident ? (
              <>
                <Avatar
                  name={resident.fullLegalName}
                  photo={resident.photo}
                  size="small"
                />
                <span>
                  <span className={styles.whoName}>{resident.fullLegalName}</span>
                  {resident.room.kind === 'recorded' ? (
                    <span className={styles.whoMeta}>
                      {' '}
                      · Room {resident.room.value}
                    </span>
                  ) : null}
                  <Likes resident={resident} />
                </span>
              </>
            ) : (
              <Unrecorded
                variant="chip"
                label="Not a resident of this site"
                detail={residentId}
              />
            )}
          </div>
        ))}
      </div>

      <div className={styles.drawerSection}>
        <p className={styles.drawerHeading}>What it is</p>
        <p className={styles.drawerBody}>{activity.description}</p>
      </div>
    </Card>
  )
}

/**
 * What this person has said they like, from the care plan.
 *
 * An unwritten domain renders as the gap it already is everywhere else, and
 * links to the screen that fixes it — because the fix is asking them, not
 * filling in a field on this screen.
 */
function Likes({ resident }: { resident: Resident }) {
  const said = likes(resident)

  if (said === 'never_asked') {
    return (
      <span data-preference="never_asked">
        <Unrecorded
          variant="chip"
          label="Never asked what they like"
          detail="their social and emotional wellbeing domain has not been written"
        />
        <Link
          to={`/residents/${resident.id}/care-plan/social_emotional`}
          className={styles.backLink}
        >
          Write the domain
        </Link>
      </span>
    )
  }

  return (
    <span className={styles.preference} data-preference="recorded">
      &ldquo;{said}&rdquo;
    </span>
  )
}

/** Their own words from the social and emotional wellbeing domain, or nothing. */
function likes(resident: Resident | undefined): string | 'never_asked' {
  if (!resident) return 'never_asked'
  const domain: CarePlanDomainRecord | undefined = resident.carePlan.find(
    (entry) => entry.domainId === 'social_emotional',
  )
  if (!domain) return 'never_asked'
  const version = currentVersion(domain)
  if (version === 'none') return 'never_asked'
  const said = version.preferences.trim() || version.currentNeeds.trim()
  return said === '' ? 'never_asked' : said
}
