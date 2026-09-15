import { now as appNow } from '@/data/fixtures/clock'
import {
  NotificationDecisionDialog,
  type DecideStep,
} from './NotificationDecisionDialog'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  ContactState,
  Incident,
  IncidentId,
  IsoDateTime,
  PostIncidentReviewFlag,
  Recorded,
  Resident,
} from '@/data/types'
import { INCIDENT_SEVERITIES, INCIDENT_TYPES, COMMUNAL_AREAS } from '@/data/types'
import { getIncidents } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Avatar, Button, Card, Tooltip } from '@/components/primitives'
import { AllergyBadge, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { BodyMap } from '@/assets/body-map/BodyMap'
import { regionLabel } from '@/assets/body-map/regions'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import {
  flagClearedBy,
  flagName,
  isOverdue,
  outstandingDecisions,
  outstandingHeading,
} from './decisions'
import styles from './incidents.module.css'

/**
 * One incident. PRD §6.5.
 *
 * The sentence: **this is what happened, and these are the decisions nobody
 * has made about it yet.**
 *
 * The second half is structural rather than a heading somewhere down the page.
 * **Outstanding decisions sit above the facts**, because a manager opening an
 * incident should see what is owed before they see what happened — and when
 * nothing is owed the block does not render at all. That absence is only safe
 * because everything it would have listed is stated in full below; an empty
 * version would be a claim ("nothing is outstanding") drawn in the treatment
 * reserved for gaps.
 */
export function IncidentDetailRoute() {
  const { activeSite } = useSession()
  const { incidentId } = useParams<{ incidentId: string }>()

  /** One instant for the life of the screen, so every "how late" agrees. */
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  /** Bumped when a notification decision is recorded, to re-read it. */
  const [version, setVersion] = useState(0)

  const load = useCallback(() => getIncidents(activeSite.id), [activeSite.id])
  const resource = useResource<{ incidents: Incident[]; residents: Resident[] }>(load, [
    activeSite.id,
    version,
  ])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <Link to="/incidents" className={styles.backLink}>
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
          All incidents
        </Link>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading this incident…
          </p>
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>This incident could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. No part of it is shown rather than
              some of it, because an incident missing its decisions reads as an incident
              with none outstanding.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Found
            data={resource.data}
            incidentId={(incidentId ?? '') as IncidentId}
            now={now}
            siteName={activeSite.name}
            onDecided={() => setVersion((count) => count + 1)}
          />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Found({
  data,
  incidentId,
  now,
  siteName,
  onDecided,
}: {
  data: { incidents: Incident[]; residents: Resident[] }
  incidentId: IncidentId
  now: IsoDateTime
  siteName: string
  onDecided: () => void
}) {
  const format = useSiteFormat()
  /** Which decision the reader is taking, if any. */
  const [deciding, setDeciding] = useState<DecideStep>('none')
  const incident = data.incidents.find((entry) => entry.id === incidentId)

  if (!incident) {
    return (
      <Card padded>
        <p className={styles.errorTitle}>No such incident at this site</p>
        <p className={styles.errorBody}>
          Nothing is missing from the log; this address does not name an incident
          recorded here.
        </p>
      </Card>
    )
  }

  const subject = incident.subject
  const resident =
    subject.kind === 'resident'
      ? data.residents.find((person) => person.id === subject.residentId)
      : undefined

  const typeName =
    INCIDENT_TYPES.find((entry) => entry.id === incident.type)?.name ?? incident.type
  const severity = INCIDENT_SEVERITIES.find((entry) => entry.id === incident.severity)
  const decisions = outstandingDecisions(incident, now)

  return (
    <>
      <div>
        {/* The type, not a reference number. A manager recognises "Unwitnessed
            fall"; nobody recognises INC-2026-0341. */}
        <h1 className={styles.detailTitle}>{typeName}</h1>
        <p className={styles.detailRef}>
          <span data-numeric>{incident.id.toUpperCase()}</span> ·{' '}
          {resident ? resident.fullLegalName : 'No resident involved'}
          {resident && resident.room.kind === 'recorded'
            ? `, Room ${resident.room.value}`
            : ''}{' '}
          · <span data-numeric>{format.dateTime(incident.occurredAt)}</span> ·{' '}
          {siteName}
        </p>
      </div>

      {decisions.length === 0 ? null : (
        <div className={styles.outstanding} data-outstanding={decisions.length}>
          <p className={styles.outstandingHeading}>
            {outstandingHeading(decisions.length)}
          </p>
          <ul className={styles.outstandingList}>
            {decisions.map((decision) => (
              <li
                key={decision.id}
                className={styles.outstandingItem}
                data-decision={decision.id}
              >
                <div className={styles.outstandingBody}>
                  <p className={styles.outstandingName}>{decision.name}</p>
                  <p className={styles.outstandingDetail}>{decision.detail}</p>
                </div>
                {decision.availableInPhase === 'now' ? (
                  <Button variant="secondary" size="small">
                    {decision.action}
                  </Button>
                ) : (
                  /* Named and disabled, exactly as the export stub. A control
                     that clears a clinical obligation without the work records
                     a review that did not happen. */
                  <Tooltip
                    content={`${decision.action} arrives in Phase ${decision.availableInPhase}`}
                  >
                    <span>
                      <Button variant="secondary" size="small" disabled aria-disabled>
                        {decision.action}, Phase {decision.availableInPhase}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <div className={styles.facts}>
          <Fact label="Status">
            {/* Reported-but-unacknowledged is the finding and takes the hatch.
                A closed incident is recorded and unremarkable, so it renders
                quietly rather than as a filled pill (§3b). */}
            {incident.status.kind === 'reported_not_acknowledged' ? (
              <Unrecorded
                variant="chip"
                label="Reported, not acknowledged"
                detail="nobody has picked it up"
              />
            ) : incident.status.kind === 'closed' ? (
              <span className={styles.factValue}>Closed</span>
            ) : (
              <StatusPill tone="info" label={STATUS_LABEL[incident.status.kind]} />
            )}
            <span className={styles.factQualifier}>
              {incident.status.kind === 'reported_not_acknowledged'
                ? 'nobody has picked it up'
                : `acknowledged ${format.dateTime(incident.status.acknowledged.at)} by ${incident.status.acknowledged.by.displayName}`}
            </span>
          </Fact>

          <Fact label="Severity">
            <StatusPill
              tone={SEVERITY_TONE[incident.severity]}
              label={severity?.name ?? incident.severity}
            />
            <span className={styles.factQualifier}>
              {SEVERITY_GLOSS[incident.severity]}
            </span>
          </Fact>

          <Fact label="CQC notification">
            <NotificationSummary incident={incident} />
          </Fact>

          <Fact label="Reported">
            <span className={styles.factValue} data-numeric>
              {format.dateTime(incident.reported.at)}
            </span>
            <span className={styles.factQualifier}>
              by {incident.reported.by.displayName}
            </span>
          </Fact>
        </div>

        {/* Never an empty strip. Where nobody was involved it says so, with the
            name of whoever recorded that — a claim, not a blank. */}
        <div className={styles.detailSubject} data-subject={resident?.id ?? 'none'}>
          {resident ? (
            <>
              <Avatar
                photo={resident.photo}
                name={resident.fullLegalName}
                size="medium"
              />
              <div className={styles.subjectWho}>
                <p className={styles.subjectName}>{resident.fullLegalName}</p>
                <p className={styles.subjectMeta}>
                  {resident.room.kind === 'recorded'
                    ? `Room ${resident.room.value}`
                    : 'Room not recorded'}{' '}
                  · Born <span data-numeric>{format.date(resident.dateOfBirth)}</span> ·{' '}
                  {siteName}
                </p>
              </div>
              <div className={styles.subjectAllergy}>
                <AllergyBadge status={resident.allergies} />
              </div>
            </>
          ) : (
            <div className={styles.subjectWho}>
              <p className={styles.subjectName}>No resident was involved</p>
              <p className={styles.subjectMeta}>
                Recorded by{' '}
                {subject.kind === 'no_resident_involved'
                  ? subject.recordedBy.displayName
                  : ''}{' '}
                : a claim somebody made, not a blank.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        {/* The reporter's account, under the reporter's byline. Putting these
            words under the manager's heading attributes them to the wrong
            person, which is why they are separate sections. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What the reporter recorded</h2>
          <p className={styles.account}>{incident.description}</p>
          <p className={styles.byline}>
            Recorded by <strong>{incident.reported.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(incident.reported.at)}</span>
          </p>

          <div className={styles.threeUp}>
            <Field label="Where">
              <LocationValue incident={incident} resident={resident} />
            </Field>
            <Field label="Witnesses">
              {incident.response.witnesses.kind === 'nobody_witnessed' ? (
                <Value
                  main="Nobody witnessed it"
                  note={`recorded by ${incident.response.witnesses.recordedBy.displayName}: a claim, not a blank`}
                />
              ) : (
                <Value
                  main={incident.response.witnesses.people.join(', ')}
                  note={`recorded by ${incident.response.witnesses.recordedBy.displayName}`}
                />
              )}
            </Field>
            <Field label="Type">
              <Value main={typeName} note="" />
            </Field>
          </div>
        </section>

        <InjurySummary incident={incident} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What was done at the time</h2>
          <p className={styles.account}>{incident.response.immediateAction}</p>
          <p className={styles.byline}>
            Recorded by <strong>{incident.reported.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(incident.reported.at)}</span>
          </p>

          <div className={styles.threeUp}>
            <Field label="GP">
              <ContactValue state={incident.response.gp} />
            </Field>
            <Field label="Family">
              <ContactValue state={incident.response.family} />
            </Field>
            <Field label="Emergency services">
              {incident.response.emergencyServices.kind === 'not_called' ? (
                <Value main="Not called" note="" />
              ) : (
                <Value
                  main={
                    incident.response.emergencyServices.service === 'ambulance_999'
                      ? '999: ambulance'
                      : '111'
                  }
                  note={incident.response.emergencyServices.outcome}
                />
              )}
            </Field>
          </div>
        </section>
      </Card>

      <Card>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Manager review</h2>
          <ReviewField label="Root cause" value={incident.review.rootCause} />
          <ReviewField label="Actions taken" value={incident.review.actionsTaken} />
          <ReviewField
            label="Preventive measures"
            value={incident.review.preventiveMeasures}
          />
          {incident.status.kind === 'reported_not_acknowledged' ? (
            <p className={styles.byline}>Nobody has started a review.</p>
          ) : (
            <p className={styles.byline}>
              Acknowledged by{' '}
              <strong>{incident.status.acknowledged.by.displayName}</strong> ·{' '}
              <span data-numeric>
                {format.dateTime(incident.status.acknowledged.at)}
              </span>
            </p>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>CQC notification</h2>
          <NotificationBlock incident={incident} onDecide={setDeciding} />
        </section>

        {/*
         * The decision, recorded against this incident.
         *
         * The three buttons above had no handler at all: a duty the whole
         * compliance panel tracks could be read, judged, and then not written
         * down, and the screen went on saying nobody had decided either way.
         */}
        <NotificationDecisionDialog
          step={deciding}
          incident={incident}
          onClose={() => setDeciding('none')}
          onDecided={() => {
            setDeciding('none')
            onDecided()
          }}
        />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Post-incident review</h2>
          {incident.reviewFlags.length === 0 ? (
            <p className={styles.settledNote}>
              Nothing was flagged for review when this incident was closed.
            </p>
          ) : (
            <div className={styles.flags}>
              {incident.reviewFlags.map((flag) => (
                <ReviewFlag key={flagName(flag)} flag={flag} now={now} />
              ))}
            </div>
          )}
        </section>
      </Card>
    </>
  )
}

const STATUS_LABEL: Record<Incident['status']['kind'], string> = {
  reported_not_acknowledged: 'Reported, not acknowledged',
  open: 'Open',
  under_review: 'Under review',
  closed: 'Closed',
}

const SEVERITY_TONE: Record<
  Incident['severity'],
  'positive' | 'info' | 'caution' | 'critical'
> = {
  no_harm: 'positive',
  low_harm: 'info',
  moderate_harm: 'caution',
  severe_harm: 'critical',
}

const SEVERITY_GLOSS: Record<Incident['severity'], string> = {
  no_harm: 'nothing came of it',
  low_harm: 'minor treatment, no lasting effect',
  moderate_harm: 'treatment needed, recovery expected',
  severe_harm: 'permanent or long-term effect',
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <p className={styles.factLabel}>{label}</p>
      <div className={styles.factBody}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <p className={styles.label}>{label}</p>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  )
}

function Value({ main, note }: { main: string; note: string }) {
  return (
    <>
      <span className={styles.fieldMain}>{main}</span>
      {note === '' ? null : <span className={styles.fieldNote}>{note}</span>}
    </>
  )
}

function LocationValue({
  incident,
  resident,
}: {
  incident: Incident
  resident: Resident | undefined
}) {
  const location = incident.location
  switch (location.kind) {
    case 'not_recorded':
      return (
        <Unrecorded
          variant="chip"
          label="Not recorded"
          detail="nobody wrote down where this happened, and an unexplained injury with no place attached cannot be investigated"
        />
      )
    case 'resident_room':
      return (
        <Value
          main={`Room ${location.kind === 'resident_room' ? location.room : ''}`}
          note={resident ? `${resident.preferredName}’s own room` : ''}
        />
      )
    case 'communal': {
      const area = location.kind === 'communal' ? location.area : 'lounge'
      return (
        <Value
          main={COMMUNAL_AREAS.find((entry) => entry.id === area)?.name ?? area}
          note=""
        />
      )
    }
  }
}

/**
 * A contact state, and the difference the union exists to hold.
 *
 * `not_yet` is unfinished and reads unsettled; `not_required` is a decision
 * somebody took and reads settled with its reason and their name. Collapsing
 * them would let an unmade call look like a considered one.
 */
function ContactValue({ state }: { state: ContactState }) {
  const format = useSiteFormat()

  switch (state.kind) {
    case 'not_yet':
      return (
        <Unrecorded
          variant="chip"
          label="Not yet"
          detail="nobody has contacted them and nobody has decided not to"
        />
      )
    case 'not_required':
      return (
        <Value
          main="Not required"
          note={`${state.reason}: ${state.recordedBy.displayName}, ${format.dateTime(state.recordedAt)}`}
        />
      )
    case 'contacted':
      return (
        <Value
          main={`Contacted ${format.time(state.at)}`}
          note={`${state.outcome} · ${state.by.displayName}`}
        />
      )
  }
}

function ReviewField({ label, value }: { label: string; value: Recorded<string> }) {
  const format = useSiteFormat()

  return (
    <div className={styles.reviewField}>
      <p className={styles.label}>{label}</p>
      {value.kind === 'recorded' ? (
        <>
          <p className={styles.account}>{value.value}</p>
          <p className={styles.byline}>
            <strong>{value.recordedBy.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(value.recordedAt)}</span>
          </p>
        </>
      ) : (
        <Unrecorded
          variant="chip"
          label="Not recorded"
          detail={`nobody has written ${label.toLowerCase()} down`}
        />
      )}
    </div>
  )
}

function InjurySummary({ incident }: { incident: Incident }) {
  const format = useSiteFormat()

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Injury</h2>

      {/* A ternary chain whose last arm was `marked`, so a fourth member of
          `InjuryMap` would have rendered a body map for a state that has no
          regions. Narrowed explicitly, with the fall-through refused below. */}
      {incident.injuries.kind === 'not_recorded' ? (
        <Unrecorded
          variant="panel"
          label="Nobody checked for injury"
          detail="not the same as no injury found: nobody has examined them, and on an unwitnessed fall that is the more serious of the two"
        />
      ) : incident.injuries.kind === 'no_injuries_found' ? (
        /* A recorded negative. Somebody looked, and it reads settled (Rule 3)
           with the author and time that make it a record. */
        <>
          <p className={styles.account}>No injury was found.</p>
          <p className={styles.byline}>
            Checked by <strong>{incident.injuries.recorded.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(incident.injuries.recorded.at)}</span>
          </p>
        </>
      ) : incident.injuries.kind === 'marked' ? (
        <div className={styles.injuryWrap} data-injury-marked>
          <div className={styles.maps}>
            <div className={styles.mapBox}>
              <h3 className={styles.mapCaption}>Front</h3>
              <BodyMap view="front" marked={incident.injuries.regions} readOnly />
            </div>
            <div className={styles.mapBox}>
              <h3 className={styles.mapCaption}>Back</h3>
              <BodyMap view="back" marked={incident.injuries.regions} readOnly />
            </div>
          </div>
          <div>
            <ul className={styles.siteChips}>
              {incident.injuries.regions.map((region) => (
                <li key={region} className={styles.siteChip} data-site={region}>
                  {regionLabel(region)}
                </li>
              ))}
            </ul>
            <p className={styles.byline}>
              Checked by <strong>{incident.injuries.recorded.by.displayName}</strong> ·{' '}
              <span data-numeric>{format.dateTime(incident.injuries.recorded.at)}</span>
              . Left and right are the resident’s own.
            </p>
          </div>
        </div>
      ) : (
        assertNever(incident.injuries)
      )}
    </section>
  )
}

/** The facts-strip summary. Hatched wherever a duty is outstanding. */
function NotificationSummary({ incident }: { incident: Incident }) {
  switch (incident.notification.kind) {
    case 'not_yet_decided':
      return (
        <Unrecorded
          variant="chip"
          label="Not yet decided"
          detail="nobody has decided either way"
        />
      )
    case 'required_not_yet_notified':
      return (
        <Unrecorded
          variant="chip"
          label="Required, not yet notified"
          detail="a duty accepted and not discharged"
        />
      )
    case 'not_required':
      // A decision somebody took, and an unremarkable one. Plain text.
      return <span className={styles.factValue}>Not required</span>
    case 'notified':
      return <StatusPill tone="positive" label="Notified" />
  }
}

/**
 * The notification section.
 *
 * **"Required" renders unsettled until evidence follows it.** An obligation
 * with nothing against it is the same shape as a PRN with no 24-hour maximum —
 * not missing data, a duty nobody can prove was met. Only `notified` and
 * `not_required` render settled, and both carry a name, a date, and a reason
 * or a reference.
 */
function NotificationBlock({
  incident,
  onDecide,
}: {
  incident: Incident
  onDecide: (step: DecideStep) => void
}) {
  const format = useSiteFormat()
  const viewer = useViewer()
  const decision = incident.notification

  /*
   * An exhaustive switch, because the fall-through here defaulted to
   * **notified** — the most reassuring possible answer to a regulatory duty.
   * A fifth member of `NotificationDecision` would have rendered as "the CQC
   * was told" with a reference nobody had entered (CLAUDE.md §8).
   */
  switch (decision.kind) {
    case 'not_yet_decided':
      return (
        <div className={styles.notificationGap} data-notification="not_yet_decided">
          <Unrecorded
            variant="panel"
            label="Not yet decided"
            detail="Nobody has recorded whether this must be notified. A decision is required either way, “not required” is a recorded judgement with a name against it, and this incident cannot be closed until one exists."
          />
          <div className={styles.notificationActions}>
            <Button
              variant="secondary"
              size="small"
              data-decide="required"
              onClick={() => onDecide('required')}
            >
              Notification is required
            </Button>
            <Button
              variant="secondary"
              size="small"
              data-decide="not_required"
              onClick={() => onDecide('not_required')}
            >
              Not notifiable: record why
            </Button>
          </div>
        </div>
      )

    case 'required_not_yet_notified':
      return (
        <div
          className={styles.notificationGap}
          data-notification="required_not_yet_notified"
        >
          <Unrecorded
            variant="panel"
            label="Required, and not yet notified"
            detail={`${decision.decided.by.displayName} decided on ${format.dateTime(decided(decision.decided.at))} that this must be notified. There is nothing in the record to show that it was.`}
          />
          {/*
           * **Deciding is the manager's, telling the CQC is the registered
           * person's, and the two sit one above the other on this screen.**
           * The buttons above stay for a deputy manager, because the decision
           * is part of reviewing the incident. This one does not.
           *
           * It is replaced rather than merely removed. The state it sits under
           * is a duty nobody can prove was met, so a manager reading it needs
           * to know who closes it; a control that silently is not there would
           * leave them looking for a button on a screen about an obligation.
           */}
          <div className={styles.notificationActions}>
            {viewer.may('statutory_notification') ? (
              <Button
                variant="secondary"
                size="small"
                data-decide="notified"
                onClick={() => onDecide('notified')}
              >
                Record the notification
              </Button>
            ) : (
              <p className={styles.byline} data-act-withheld="statutory_notification">
                Telling the CQC is the registered person&rsquo;s act. Your role is{' '}
                {viewer.roleName}, which can see that this is owed and cannot record
                that it was done.
              </p>
            )}
          </div>
        </div>
      )

    case 'not_required':
      return (
        <div data-notification="not_required">
          <p className={styles.account}>Not required. {decision.reason}</p>
          <p className={styles.byline}>
            Decided by <strong>{decision.decided.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(decision.decided.at)}</span>
          </p>
        </div>
      )

    case 'notified':
      return (
        <div data-notification="notified">
          <p className={styles.account}>
            Notified. Reference <span data-numeric>{decision.reference}</span>.
          </p>
          <p className={styles.byline}>
            Decided by <strong>{decision.decided.by.displayName}</strong> · notified by{' '}
            <strong>{decision.notified.by.displayName}</strong> ·{' '}
            <span data-numeric>{format.dateTime(decision.notified.at)}</span>
          </p>
        </div>
      )

    default:
      return assertNever(decision)
  }
}

/** Narrowing helper, so the template above reads as one sentence. */
const decided = (at: IsoDateTime) => at

/**
 * One post-incident review flag.
 *
 * Three treatments and **no "mark as reviewed" control**: clearing a flag means
 * doing the work, and a button that cleared it without would record a review
 * that did not happen. Each names what would clear it and the phase that
 * builds it.
 */
function ReviewFlag({ flag, now }: { flag: PostIncidentReviewFlag; now: IsoDateTime }) {
  const format = useSiteFormat()
  const cleared = flagClearedBy(flag)
  const late = isOverdue(flag, now)

  const state =
    flag.state.kind === 'completed' ? 'completed' : late ? 'overdue' : 'awaiting'

  return (
    <div
      className={[
        styles.flag,
        state === 'overdue' ? styles.flagOverdue : '',
        state === 'completed' ? styles.flagDone : styles.flagOpen,
      ]
        .filter(Boolean)
        .join(' ')}
      data-flag={state}
    >
      <div>
        <p className={styles.flagName}>{flagName(flag)}</p>
        <p className={styles.flagDetail}>
          {flag.state.kind === 'completed'
            ? 'Reviewed after this incident.'
            : `Flagged for review when this incident was closed. ${cleared.sentence}`}
        </p>
      </div>
      <span className={styles.flagWhen}>
        {flag.state.kind === 'completed' ? (
          <>
            done{' '}
            <span data-numeric>{format.date(dateOf(flag.state.completed.at))}</span>
            <br />
            {flag.state.completed.by.displayName}
          </>
        ) : (
          <>
            {late ? 'past its 48 hours' : 'due within 48 hours'}
            <br />
            due <span data-numeric>{format.dateTime(flag.dueBy)}</span>
          </>
        )}
      </span>
    </div>
  )
}

const dateOf = (at: IsoDateTime) => at.slice(0, 10) as `${number}-${number}-${number}`
