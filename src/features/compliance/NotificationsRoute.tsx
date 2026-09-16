import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Incident, NotificationDecision } from '@/data/types'
import { INCIDENT_TYPES, subjectResidentId } from '@/data/types'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import { useComplianceData } from './use-compliance'
import styles from './compliance.module.css'

/**
 * Statutory notifications. PRD §6.7, Phase 12. The twelfth queue.
 *
 * The sentence: **incidents where nobody has decided, then those decided and
 * not notified, then those notified — three states, never one queue of
 * outstanding.**
 *
 * The first is the finding this screen exists for. "Nobody has decided" is not
 * a milder "not yet notified": one is a decision waiting to be made, the other
 * is a decision made and an obligation not met, and merging them would hide
 * the first inside the second.
 */
type Filter = 'undecided' | 'required' | 'notified' | 'not_required'

const FILTERS: { id: Filter; label: string; phrase: string }[] = [
  {
    id: 'undecided',
    label: 'Nobody has decided',
    phrase: 'the incidents nobody has decided about',
  },
  {
    id: 'required',
    label: 'Required, not yet notified',
    phrase: 'the incidents decided as notifiable and not yet notified',
  },
  { id: 'notified', label: 'Notified', phrase: 'the incidents already notified' },
  {
    id: 'not_required',
    label: 'Decided as not required',
    phrase: 'the incidents somebody decided did not need notifying',
  },
]

const stateOf = (notification: NotificationDecision): Filter => {
  switch (notification.kind) {
    case 'not_yet_decided':
      return 'undecided'
    case 'required_not_yet_notified':
      return 'required'
    case 'notified':
      return 'notified'
    case 'not_required':
      return 'not_required'
  }
}

export function NotificationsRoute() {
  const { activeSite } = useSession()
  const format = useSiteFormat()
  const data = useComplianceData()
  const [filter, setFilter] = useState<Filter>('undecided')

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = {
      undecided: 0,
      required: 0,
      notified: 0,
      not_required: 0,
    }
    if (data === 'loading') return tally
    for (const incident of data.incidents) tally[stateOf(incident.notification)] += 1
    return tally
  }, [data])

  if (data === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the incident log…</p>
      </div>
    )
  }

  const rows = data.incidents
    .filter((incident) => stateOf(incident.notification) === filter)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  const selected = FILTERS.find((entry) => entry.id === filter)
  const total = data.incidents.length

  return (
    <div className={styles.page} data-notifications>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Compliance
      </Link>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Statutory notifications</h1>
          <p className={styles.pageSubtitle}>
            {activeSite.name} · every incident, by whether the CQC has been told
          </p>
        </div>
      </header>

      <div
        className={styles.filters}
        role="group"
        aria-label="Filter by notification state"
      >
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={styles.filterPill}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            data-filter={entry.id}
          >
            {entry.label}
            <span data-numeric>{formatCount(counts[entry.id])}</span>
          </button>
        ))}
      </div>

      {/* The claim carries the filter, or it is a claim about a different set. */}
      <p className={styles.filterClaim} data-filter-claim>
        <span data-numeric>{formatCount(rows.length)}</span> of{' '}
        <span data-numeric>{formatCount(total)}</span> incidents at {activeSite.name},
        showing <b>{selected?.phrase ?? 'everything'}</b>.
      </p>

      <Card>
        {rows.length === 0 ? (
          <p className={styles.emptyFiltered} data-empty="filtered">
            Nothing at {activeSite.name} matches {selected?.label ?? 'this filter'}.
          </p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((incident) => (
              <li key={incident.id}>
                <div className={styles.row} data-incident={incident.id}>
                  <div>
                    <p className={styles.rowTitle}>{typeName(incident)}</p>
                    <p className={styles.rowMeta}>
                      {format.dateTime(incident.occurredAt)} ·{' '}
                      {subjectOf(incident, data.residents)}
                    </p>
                  </div>

                  <NotificationState notification={incident.notification} />

                  <Link
                    to={`/incidents/${incident.id}`}
                    className={styles.rowAction}
                    aria-label={`Open the ${typeName(incident)} of ${format.date(incident.occurredAt.slice(0, 10) as never)}`}
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
        )}
      </Card>
    </div>
  )
}

function NotificationState({ notification }: { notification: NotificationDecision }) {
  switch (notification.kind) {
    case 'not_yet_decided':
      return (
        <span data-notification="not_yet_decided">
          <Unrecorded
            variant="chip"
            label="Nobody has decided"
            detail="whether the CQC has to be told"
          />
        </span>
      )
    case 'required_not_yet_notified':
      return (
        <span
          className={styles.notifyState}
          data-notification="required_not_yet_notified"
        >
          <span className={styles.notifyLabel}>Required, not notified</span>
          <span className={styles.notifyDetail}>
            decided by {notification.decided.by.displayName}
          </span>
        </span>
      )
    case 'notified':
      return (
        <span className={styles.notifyQuiet} data-notification="notified">
          <span className={styles.notifyLabel}>Notified</span>
          <span className={styles.notifyDetail}>
            reference {notification.reference} · {notification.notified.by.displayName}
          </span>
        </span>
      )
    case 'not_required':
      return (
        <span className={styles.notifyQuiet} data-notification="not_required">
          <span className={styles.notifyLabel}>Not required</span>
          {/* A decision not to notify is a decision somebody made, and it
              carries their name and their reason. */}
          <span className={styles.notifyDetail}>
            {notification.decided.by.displayName}, {notification.reason}
          </span>
        </span>
      )
  }
}

const typeName = (incident: Incident) =>
  INCIDENT_TYPES.find((type) => type.id === incident.type)?.name ?? 'Incident'

function subjectOf(
  incident: Incident,
  residents: { id: string; fullLegalName: string }[],
) {
  const residentId = subjectResidentId(incident)
  if (residentId === 'none') return 'No resident involved'
  return (
    residents.find((resident) => resident.id === residentId)?.fullLegalName ??
    'Resident not found'
  )
}
