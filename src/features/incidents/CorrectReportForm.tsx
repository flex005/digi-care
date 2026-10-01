import { useState } from 'react'
import type {
  CommunalAreaId,
  Incident,
  IncidentSeverityId,
  IncidentTypeId,
  IsoDateTime,
} from '@/data/types'
import { COMMUNAL_AREAS, INCIDENT_SEVERITIES, INCIDENT_TYPES } from '@/data/types'
import { correctReport } from '@/data/access/incident-store'
import { AlertDialog, Button, Card, Select } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import styles from './incidents.module.css'

/**
 * An admin correcting what the reporter wrote.
 *
 * **This overwrites somebody else's account and the original is not kept.**
 * Every other write on an incident adds a record beside what was there; this
 * one replaces it. That is a decision taken knowingly — it is written up in
 * PROGRESS.md — and the person doing it is told before they do it rather than
 * discovering it afterwards.
 *
 * **It cannot reach the manager's review.** `ReporterCorrection` is its own
 * patch type covering exactly the reporter's six fields, so the structural
 * separation this module keeps between the two records survives: a correction
 * cannot quietly become a review, or the other way round.
 *
 * **Gated in the page, not at the route.** `/incidents/:id` is a page every
 * role reads, and `correct_incident_report` carries `route: undefined` for
 * that reason — refusing the whole page would take the incident away from the
 * people who need to read it. What is admin-only is the act.
 */
/**
 * Whether this viewer may rewrite a report.
 *
 * Exported because the trigger and the form are rendered in two places now —
 * the header action row and the panel below it — and **both** ask. One gate
 * read by one caller would leave the other reachable by whoever could find it.
 */
export function mayCorrectReport(viewer: ReturnType<typeof useViewer>): boolean {
  return viewer.may('correct_incident_report')
}

/**
 * The control that opens the form, rendered in the header beside Download.
 *
 * **It belongs with the whole-report actions, not inside a section.** A
 * correction rewrites the type, the severity, when it happened, where, the
 * account and what was done — so a trigger sitting inside "What the reporter
 * recorded" implied it touched only that card's text, which was a smaller
 * claim than the act makes.
 */
export function CorrectReportTrigger({ onOpen }: { onOpen: () => void }) {
  const viewer = useViewer()
  if (!mayCorrectReport(viewer)) return null

  return (
    <Button variant="secondary" size="medium" data-correct-report onClick={onOpen}>
      <Icon name="edit-formatting/edit-02" size={16} aria-hidden />
      Correct this report
    </Button>
  )
}

export function CorrectReportForm({
  incident,
  subjectName,
  open,
  onClose,
  onCorrected,
}: {
  incident: Incident
  /** Who the incident is about, so the confirmation names them (§2.4). */
  subjectName: string
  /** Held by the route, because the trigger lives in its header now. */
  open: boolean
  onClose: () => void
  onCorrected: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState('')

  const [type, setType] = useState<IncidentTypeId>(incident.type)
  const [severity, setSeverity] = useState<IncidentSeverityId>(incident.severity)
  const [occurredAt, setOccurredAt] = useState(incident.occurredAt.slice(0, 16))
  const [area, setArea] = useState<CommunalAreaId | 'resident_room' | 'not_recorded'>(
    incident.location.kind === 'communal'
      ? incident.location.area
      : incident.location.kind === 'resident_room'
        ? 'resident_room'
        : 'not_recorded',
  )
  const [room, setRoom] = useState(
    incident.location.kind === 'resident_room' ? incident.location.room : '',
  )
  const [description, setDescription] = useState(incident.description)
  const [immediateAction, setImmediateAction] = useState(
    incident.response.immediateAction,
  )

  /*
   * The act, not the page. Everybody reads an incident; one role rewrites one.
   * Asked here as well as on the trigger: a form reachable without the trigger
   * would be gated only by whichever control somebody happened to use.
   */
  if (!mayCorrectReport(viewer) || !open) return null

  const blank = description.trim() === '' || immediateAction.trim() === ''

  return (
    <Card padded>
      <section className={styles.section} data-section="correct-report">
        <h2 className={styles.sectionTitle}>Correct this report</h2>

        {/*
         * Said before the act, not after. Somebody about to overwrite another
         * person's account should know that is what it does.
         */}
        <p className={styles.instruction} data-correction-warning>
          <b>
            This replaces {incident.reported.by.displayName}&rsquo;s own account of what
            happened. What it says now is not kept anywhere, and your name and the time
            go on the record in its place.
          </b>
        </p>

        <div className={styles.twoUp}>
          <Select
            label="Type"
            labelVisible
            placeholder="Choose a type"
            value={type}
            onValueChange={(value) => setType(value as IncidentTypeId)}
            options={INCIDENT_TYPES.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
          />
          <Select
            label="Severity"
            labelVisible
            placeholder="Choose a severity"
            value={severity}
            onValueChange={(value) => setSeverity(value as IncidentSeverityId)}
            options={INCIDENT_SEVERITIES.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
          />
        </div>

        <div className={styles.twoUp}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>When it happened</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={occurredAt}
              data-correct-occurred
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </label>
          <Select
            label="Where"
            labelVisible
            placeholder="Choose a place"
            value={area}
            onValueChange={(value) =>
              setArea(value as CommunalAreaId | 'resident_room' | 'not_recorded')
            }
            options={[
              { value: 'not_recorded', label: 'Not recorded' },
              { value: 'resident_room', label: "The resident's own room" },
              ...COMMUNAL_AREAS.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
        </div>

        {area === 'resident_room' ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Room</span>
            <input
              className={styles.input}
              type="text"
              value={room}
              data-correct-room
              onChange={(event) => setRoom(event.target.value)}
            />
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>What happened</span>
          <textarea
            className={styles.input}
            rows={4}
            value={description}
            data-correct-description
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>What was done at the time</span>
          <textarea
            className={styles.input}
            rows={3}
            value={immediateAction}
            data-correct-action
            onChange={(event) => setImmediateAction(event.target.value)}
          />
        </label>

        <div className={styles.decisionActions}>
          <Button variant="ghost" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="small"
            disabled={blank}
            data-correct-save
            onClick={() => setConfirming(true)}
          >
            Save the correction
          </Button>
        </div>

        {failure === '' ? null : (
          <p className={styles.footState} data-correction-failure>
            {failure}
          </p>
        )}
      </section>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{ kind: 'resident', name: subjectName }}
        action={`Replace ${incident.reported.by.displayName}'s account`}
        confirmLabel="Replace it"
        description={
          <span className={styles.confirmBody}>
            <span>
              What they wrote is not kept. The record will say it was edited by you,
              with the time.
            </span>
          </span>
        }
        onConfirm={() => {
          try {
            correctReport(
              incident,
              {
                type,
                severity,
                occurredAt: new Date(occurredAt).toISOString() as IsoDateTime,
                location:
                  area === 'not_recorded'
                    ? { kind: 'not_recorded' }
                    : area === 'resident_room'
                      ? { kind: 'resident_room', room }
                      : { kind: 'communal', area },
                description,
                immediateAction,
              },
              currentUser,
            )
            setConfirming(false)
            onClose()
            onCorrected()
          } catch (cause) {
            setConfirming(false)
            setFailure(cause instanceof Error ? cause.message : 'Nothing was changed.')
          }
        }}
      />
    </Card>
  )
}
