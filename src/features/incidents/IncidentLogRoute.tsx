import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  Incident,
  IncidentSeverityId,
  IncidentStatus,
  IncidentTypeId,
  IsoDateTime,
  Resident,
} from '@/data/types'
import {
  COMMUNAL_AREAS,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  subjectResidentId,
} from '@/data/types'
import { getIncidents } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, Select, SelectedMark } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { formatCount } from '@/lib/format'
import { elapsedMinutesBetween } from '@/lib/shift'
import { coarseWait } from '@/features/notes/note-parts'
import { outstandingDecisions } from './decisions'
import styles from './incidents.module.css'

/**
 * The incident log. PRD §6.5.
 *
 * The sentence: **these incidents have been reported and nobody has
 * acknowledged them.**
 *
 * The fourth queue in the shape `/care-notes`, omissions and handover already
 * share — oldest first because the wait is the finding, every row naming its
 * subject, the figure following the filter. Somebody who has learned one has
 * learned all of them, so nothing here is different for the sake of it.
 *
 * **Two findings, never summed and never one card.** Unacknowledged incidents
 * lead: they are the thing still fixable by whoever is looking. Undecided
 * notifications sit beside them on a plain surface — graver, but older, and
 * not what this screen is for. An incident can be both, which is the
 * arithmetic reason they cannot be added, and the two are different failures,
 * which is the real one.
 */

type StatusFilter = 'not_acknowledged' | 'open' | 'under_review' | 'closed' | 'all'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'not_acknowledged', label: 'Not acknowledged' },
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under review' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

export function IncidentLogRoute() {
  const { activeSite } = useSession()

  /** One instant for the life of the screen, so every wait agrees. */
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  // **Not acknowledged, never All.** The screen opens on its own finding, the
  // way the handover opens on the residents nobody has looked at.
  const [status, setStatus] = useState<StatusFilter>('not_acknowledged')
  const [type, setType] = useState<IncidentTypeId | 'all'>('all')
  const [severity, setSeverity] = useState<IncidentSeverityId | 'all'>('all')

  const load = useCallback(() => getIncidents(activeSite.id), [activeSite.id])
  const resource = useResource<{ incidents: Incident[]; residents: Resident[] }>(load, [
    activeSite.id,
  ])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <header className={styles.logHead}>
          <h1 className={styles.pageTitle}>Incidents</h1>
          {/* The only thing on this screen that is not about triage, which is
              why it lives here rather than in the filter row.

              A link rather than a button, because it navigates — styled to
              match the primary button so the two read alike, which they should:
              it is the screen's one action. */}
          <Link to="/incidents/new" className={styles.reportAction}>
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Report an incident
          </Link>
        </header>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading incidents…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>The incident log could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial list is not shown,
              because it would read as fewer incidents waiting than there are.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            data={resource.data}
            now={now}
            siteName={activeSite.name}
            status={status}
            type={type}
            severity={severity}
            onStatus={setStatus}
            onType={setType}
            onSeverity={setSeverity}
          />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Found({
  data,
  now,
  siteName,
  status,
  type,
  severity,
  onStatus,
  onType,
  onSeverity,
}: {
  data: { incidents: Incident[]; residents: Resident[] }
  now: IsoDateTime
  siteName: string
  status: StatusFilter
  type: IncidentTypeId | 'all'
  severity: IncidentSeverityId | 'all'
  onStatus: (value: StatusFilter) => void
  onType: (value: IncidentTypeId | 'all') => void
  onSeverity: (value: IncidentSeverityId | 'all') => void
}) {
  const all = data.incidents
  const unacknowledged = all.filter(
    (incident) => incident.status.kind === 'reported_not_acknowledged',
  )
  const undecided = all.filter(
    (incident) => incident.notification.kind === 'not_yet_decided',
  )

  const visible = all
    .filter((incident) =>
      status === 'all'
        ? true
        : status === 'not_acknowledged'
          ? incident.status.kind === 'reported_not_acknowledged'
          : incident.status.kind === status,
    )
    .filter((incident) => type === 'all' || incident.type === type)
    .filter((incident) => severity === 'all' || incident.severity === severity)
    // Oldest first, because the wait is the finding — the same ordering and
    // the same reason as the omissions list and the flagged-note queue.
    .sort((a, b) => a.reported.at.localeCompare(b.reported.at))

  return (
    <>
      <div className={styles.findings}>
        {/* The lead. Hatched, because nobody has looked at these — and the one
            of the two that whoever is reading can still fix. */}
        <div className={styles.findingLead} data-finding="unacknowledged">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(unacknowledged.length)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              {unacknowledged.length === 1
                ? 'incident reported and not acknowledged'
                : 'incidents reported and not acknowledged'}
            </span>
            <span className={styles.findingDetail}>
              Somebody wrote them down and nobody has picked them up. Of{' '}
              <span data-numeric>{formatCount(all.length)}</span> recorded at {siteName}{' '}
              in the last 90 days.
            </span>
          </span>
        </div>

        {/* The secondary. A plain surface, not a second hatch and not added to
            the first — an incident can be in both, and they are different
            failures. */}
        <div className={styles.findingSecondary} data-finding="undecided">
          <span className={styles.findingFigure} data-numeric>
            {formatCount(undecided.length)}
          </span>
          <span className={styles.findingBody}>
            <span className={styles.findingTitle}>
              with no CQC notification decision
            </span>
            <span className={styles.findingDetail}>
              Nobody has recorded whether these must be notified. Graver than an
              unacknowledged incident and usually older. Of{' '}
              <span data-numeric>{formatCount(all.length)}</span> at {siteName}.
            </span>
          </span>
        </div>
      </div>

      <Card>
        <div className={styles.filters}>
          {STATUS_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={[
                styles.filterTab,
                status === entry.id ? styles.filterTabActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={status === entry.id}
              data-status-filter={entry.id}
              onClick={() => onStatus(entry.id)}
            >
              <SelectedMark selected={status === entry.id} />
              {entry.label}
            </button>
          ))}

          {/* Selects, not pills. Pill means filter — and a twelve-item type
              list is not a pill row. */}
          <div className={styles.filterSelects}>
            <Select
              label="Type"
              placeholder="Any type"
              value={type === 'all' ? undefined : type}
              onValueChange={(value) => onType(value as IncidentTypeId | 'all')}
              options={[
                { value: 'all', label: 'Any type' },
                ...INCIDENT_TYPES.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
            <Select
              label="Severity"
              placeholder="Any severity"
              value={severity === 'all' ? undefined : severity}
              onValueChange={(value) => onSeverity(value as IncidentSeverityId | 'all')}
              options={[
                { value: 'all', label: 'Any severity' },
                ...INCIDENT_SEVERITIES.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
          </div>
        </div>

        <p className={styles.resultLine}>
          Oldest first
          {status === 'all' && type === 'all' && severity === 'all' ? null : (
            <>
              {' · '}
              <span data-numeric>{formatCount(visible.length)}</span> of{' '}
              <span data-numeric>{formatCount(all.length)}</span> shown
            </>
          )}
        </p>

        {visible.length === 0 ? (
          <p className={styles.settledNote}>
            {status === 'not_acknowledged' && type === 'all' && severity === 'all'
              ? `Every incident recorded at ${siteName} has been picked up by somebody.`
              : 'Nothing matches these filters. That is a statement about the filters, not about the record.'}
          </p>
        ) : (
          <ul className={styles.logList}>
            {visible.map((incident) => (
              <li key={incident.id}>
                <IncidentRow incident={incident} residents={data.residents} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function IncidentRow({
  incident,
  residents,
  now,
}: {
  incident: Incident
  residents: Resident[]
  now: IsoDateTime
}) {
  const format = useSiteFormat()
  const residentId = subjectResidentId(incident)
  const resident = residents.find((person) => person.id === residentId)

  const typeName =
    INCIDENT_TYPES.find((entry) => entry.id === incident.type)?.name ?? incident.type
  const severityName =
    INCIDENT_SEVERITIES.find((entry) => entry.id === incident.severity)?.name ??
    incident.severity

  const owed = outstandingDecisions(incident, now)

  return (
    <Link
      to={`/incidents/${incident.id}`}
      className={styles.logRow}
      data-incident={incident.id}
      data-status={incident.status.kind}
    >
      {/* Never an empty column. Where nobody was involved that is the content,
          with who recorded it — a claim, not a blank. */}
      <span className={styles.rowWho}>
        {resident ? (
          <>
            <span className={styles.rowName}>{resident.preferredName}</span>
            <span className={styles.rowMeta}>
              {resident.fullLegalName}
              {resident.room.kind === 'recorded'
                ? ` · Room ${resident.room.value}`
                : ' · Room not recorded'}
            </span>
          </>
        ) : (
          <>
            <span className={styles.rowNoResident}>No resident involved</span>
            <span className={styles.rowMeta}>
              recorded by{' '}
              {incident.subject.kind === 'no_resident_involved'
                ? incident.subject.recordedBy.displayName
                : ''}
            </span>
          </>
        )}
      </span>

      <StateChip status={incident.status} reportedAt={incident.reported.at} now={now} />

      <span className={styles.rowWhat}>
        <span className={styles.rowName}>{typeName}</span>
        <span className={styles.rowMeta}>
          <span data-numeric>{format.dateTime(incident.occurredAt)}</span> ·{' '}
          {placeOf(incident)} · reported by {incident.reported.by.displayName}
        </span>
      </span>

      <span className={styles.rowSeverity}>
        <StatusPill tone={SEVERITY_TONE[incident.severity]} label={severityName} />
        {/* The only place the secondary finding appears per row. It is how a
            reader gets from the second card to the incidents it counts — the
            figure is not a dead number. */}
        {owed.length === 0 ? null : (
          <span className={styles.rowOwed} data-owed={owed.length}>
            {owedSummary(owed.map((decision) => decision.id))}
          </span>
        )}
      </span>

      {/* One control, and it is not "Acknowledge". Acknowledging without
          reading is the failure the unacknowledged state exists to make
          visible, and a one-tap control on a list invites exactly that. */}
      <span className={styles.rowOpen}>
        Open
        <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
      </span>
    </Link>
  )
}

/**
 * Where it happened, in the row's meta line.
 *
 * Never blank — a location nobody recorded says so, because an unexplained
 * injury with no place attached to it cannot be investigated.
 */
function placeOf(incident: Incident): string {
  switch (incident.location.kind) {
    case 'not_recorded':
      return 'place not recorded'
    case 'resident_room':
      return `Room ${incident.location.room}`
    case 'communal': {
      const { area } = incident.location
      return COMMUNAL_AREAS.find((entry) => entry.id === area)?.name ?? area
    }
  }
}

/** "notification undecided · no root cause". */
function owedSummary(ids: string[]): string {
  const words = ids.map((id) =>
    id === 'root-cause'
      ? 'no root cause'
      : id === 'notification'
        ? 'notification undecided'
        : id === 'notification-outstanding'
          ? 'not yet notified'
          : 'review not done',
  )
  return [...new Set(words)].join(' · ')
}

const SEVERITY_TONE: Record<
  IncidentSeverityId,
  'positive' | 'info' | 'caution' | 'critical'
> = {
  no_harm: 'positive',
  low_harm: 'info',
  moderate_harm: 'caution',
  severe_harm: 'critical',
}

/**
 * Where the incident is, and — where nobody has picked it up — how long it has
 * been waiting.
 *
 * **Closed is plain text with no chip at all.** Recorded and unremarkable
 * renders quietly (§3b); a column of closed pills would drown the four rows
 * that are the reason to open this screen.
 */
function StateChip({
  status,
  reportedAt,
  now,
}: {
  status: IncidentStatus
  reportedAt: IsoDateTime
  now: IsoDateTime
}) {
  // Exhaustive, because the fall-through rendered "Under review" — a fifth
  // member of `IncidentStatus` would have arrived as work somebody had taken
  // on (§8).
  switch (status.kind) {
    case 'reported_not_acknowledged':
      return (
        <span className={styles.rowState}>
          <Unrecorded
            variant="chip"
            label="Not acknowledged"
            detail={`waiting ${coarseWait(elapsedMinutesBetween(reportedAt, now))}`}
          />
        </span>
      )

    case 'closed':
      return <span className={`${styles.rowState} ${styles.rowClosed}`}>Closed</span>

    case 'open':
      return (
        <span className={styles.rowState}>
          <StatusPill tone="caution" label="Open" />
        </span>
      )

    case 'under_review':
      return (
        <span className={styles.rowState}>
          <StatusPill tone="info" label="Under review" />
        </span>
      )

    default:
      return assertNever(status)
  }
}
