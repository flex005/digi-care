import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  Activity,
  ActivityId,
  AttendanceState,
  DidNotAttendReasonId,
  Resident,
  ResidentId,
} from '@/data/types'
import { DID_NOT_ATTEND_REASONS } from '@/data/types'
import { getActivity } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Avatar, Button, Card, Select } from '@/components/primitives'
import { Unrecorded, NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { formatCount, pluralise } from '@/lib/format'
import { tally } from './session-state'
import { CancelSession } from './CancelSession'
import { EditSession } from './EditSession'
import { now as appNow } from '@/data/fixtures/clock'
import { useViewer } from '@/app/session/use-viewer'
import styles from './activities.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * Recording who came. PRD §6.7, Phase 9.
 *
 * The sentence: **every invited resident has an answer, and these ones do
 * not.**
 *
 * ## Two rules hold this screen up
 *
 * **Every row carries its own resident identity.** §2.4 applied per row: on a
 * grid you do not pick the wrong person from a list, you slip a row — and
 * Doris is marked present while Beryl is marked absent. The avatar, the
 * preferred name, the full legal name and the room are the only thing standing
 * between the two, which is why a first name is not enough here even though it
 * is on a queue.
 *
 * **There is no "mark all attended".** One click asserting eighteen facts
 * nobody checked is the handover "sign for everybody" failure with eighteen
 * people in it. If it is ever added, the handover's answer applies: permit it
 * loudly and store that it was set in bulk, so the record cannot later read as
 * eighteen individual observations.
 */

interface Loaded {
  activity: Activity
  residents: Resident[]
}

/** What the screen holds while somebody is filling it in. */
type Draft = Record<
  string,
  { answer: 'came' | 'did_not'; reason: DidNotAttendReasonId | '' } | undefined
>

export function AttendanceRoute() {
  const { activityId } = useParams<{ activityId: string }>()
  const { activeSite } = useSession()

  const load = useCallback(
    () => getActivity((activityId ?? '') as ActivityId),
    [activityId],
  )
  /* Bumped when a session is cancelled, to re-read it. */
  const [version, setVersion] = useState(0)
  const resource = useResource<Loaded>(load, [activityId, version])

  return (
    <SiteTimeZone timeZone={activeSite.timeZone}>
      <div className={styles.page}>
        <Link to=".." relative="path" className={styles.backLink}>
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
          All activities
        </Link>

        {resource.kind === 'loading' ? (
          <p className={styles.loading} role="status">
            Loading this session…
          </p>
        ) : resource.kind === 'refused' ? (
          <NotYourHome refusal={resource} />
        ) : resource.kind === 'error' ? (
          <Card padded>
            <p className={styles.errorTitle}>This session could not be loaded</p>
            <p className={styles.errorBody}>
              Nothing has been lost; this is a read. A partial invitation list is not
              shown, because the list is the denominator for everything on this screen.
            </p>
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          </Card>
        ) : (
          <Grid data={resource.data} onChanged={() => setVersion((c) => c + 1)} />
        )}
      </div>
    </SiteTimeZone>
  )
}

function Grid({ data, onChanged }: { data: Loaded; onChanged: () => void }) {
  const format = useSiteFormat()
  const viewer = useViewer()
  const [draft, setDraft] = useState<Draft>({})

  const { activity, residents } = data
  const byId = new Map(residents.map((resident) => [resident.id, resident]))
  const counts = tally(activity)

  /*
   * Who is still unanswered — from the record and this screen's draft together.
   * Named individually in the footer, because "2 outstanding" tells somebody
   * how much is left and the names tell them who.
   */
  const waiting = activity.invited.filter(
    (entry) => entry.attendance.kind === 'not_recorded' && !draft[entry.residentId],
  )

  return (
    <Card>
      <div className={styles.activityHead}>
        <h1 className={styles.activityName}>{activity.name}</h1>
        <p className={styles.activityMeta}>
          <span data-numeric>{format.dateTime(activity.startsAt)}</span> ·{' '}
          {activity.place} · planned by {activity.plannedBy.displayName}
        </p>
        {activity.standing.kind === 'planned' && viewer.canRecordIn('/activities') ? (
          <div className={styles.sessionActions}>
            {/*
             * Changing it only before it starts: once it has begun, its time is
             * what attendance is recorded against.
             */}
            {activity.startsAt > appNow().toISOString() ? (
              <EditSession
                activity={activity}
                timeZone={format.timeZone}
                onEdited={onChanged}
              />
            ) : null}
            <CancelSession activity={activity} onCancelled={onChanged} />
          </div>
        ) : null}
      </div>

      {/*
       * **A cancelled session renders settled, never hatched.** Somebody
       * decided, their name is on it and the reason is in their words: the
       * record is complete. The hatch says nobody has looked, and here
       * somebody has. The tallies below stay exactly as they were, because
       * what was recorded before the cancellation is still what happened.
       */}
      {activity.standing.kind === 'cancelled' ? (
        <div className={styles.cancelled} data-cancelled>
          <p className={styles.cancelledLabel}>This session was cancelled</p>
          <p className={styles.cancelledWhy}>
            {activity.standing.reason} · {activity.standing.by.displayName} ·{' '}
            <span data-numeric>{format.dateTime(activity.standing.at)}</span>
          </p>
          <p className={styles.cancelledWhy}>
            Everything recorded before it stays below, with the names and times it was
            written under.
          </p>
        </div>
      ) : null}

      {/* Four cells, and every one counts over the invitation list. */}
      <div className={styles.tally} data-tally>
        <div className={styles.tallyCell} data-tally-cell="invited">
          <p className={styles.tallyKey}>Invited</p>
          <p className={styles.tallyValue} data-numeric>
            {formatCount(counts.invited)}
          </p>
          <p className={styles.tallyDetail}>the denominator for everything here</p>
        </div>
        <div className={styles.tallyCell} data-tally-cell="attended">
          <p className={styles.tallyKey}>Attended</p>
          <p className={styles.tallyValue} data-numeric>
            {formatCount(counts.attended)}
          </p>
          <p className={styles.tallyDetail}>
            of <span data-numeric>{formatCount(counts.invited)}</span> invited
          </p>
        </div>
        <div className={styles.tallyCell} data-tally-cell="did-not-attend">
          <p className={styles.tallyKey}>Did not attend</p>
          <p className={styles.tallyValue} data-numeric>
            {formatCount(counts.didNotAttend)}
          </p>
          <p className={styles.tallyDetail}>recorded, with a reason</p>
        </div>
        {/* The one the module exists for. Nothing recorded is not zero attended. */}
        <div className={styles.tallyGap} data-tally-cell="not-recorded">
          <p className={styles.tallyKey}>Not recorded</p>
          <p className={styles.tallyValue} data-numeric>
            {formatCount(counts.notRecorded)}
          </p>
          <p className={styles.tallyDetail}>nobody said whether they came</p>
        </div>
      </div>

      <ul className={styles.attendanceList}>
        {activity.invited.map((entry) => (
          <li key={entry.residentId}>
            <Row
              resident={byId.get(entry.residentId)}
              residentId={entry.residentId}
              attendance={entry.attendance}
              draft={draft[entry.residentId]}
              onAnswer={(answer) =>
                setDraft((current) => ({
                  ...current,
                  [entry.residentId]: { answer, reason: '' },
                }))
              }
              onReason={(reason) =>
                setDraft((current) => ({
                  ...current,
                  [entry.residentId]: { answer: 'did_not', reason },
                }))
              }
            />
          </li>
        ))}
      </ul>

      {activity.joined.length > 0 ? (
        <div className={styles.joined} data-joined={activity.joined.length}>
          <p className={styles.joinedKey}>Joined without being invited</p>
          {activity.joined.map((joiner) => {
            const resident = byId.get(joiner.residentId)
            return (
              <div
                className={styles.joinedRow}
                key={joiner.residentId}
                data-joiner={joiner.residentId}
              >
                <Who resident={resident} residentId={joiner.residentId} />
                <span className={styles.whoMeta}>{joiner.note}</span>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={styles.foot}>
        <p className={styles.footState} data-foot-state>
          {waiting.length === 0 ? (
            <>
              <strong>
                Every one of{' '}
                <span data-numeric>
                  {pluralise(counts.invited, 'invited resident')}
                </span>{' '}
                has an answer.
              </strong>{' '}
              Nothing here is stored in this build.
            </>
          ) : (
            <>
              <strong>
                Waiting on <span data-numeric>{formatCount(waiting.length)}</span> of{' '}
                <span data-numeric>{formatCount(counts.invited)}</span>:
              </strong>{' '}
              {waiting
                .map(
                  (entry) =>
                    byId.get(entry.residentId)?.fullLegalName ?? entry.residentId,
                )
                .join(' · ')}
              .
              <br />
              There is no &ldquo;mark all attended&rdquo;, one click asserting{' '}
              <span data-numeric>{pluralise(counts.invited, 'fact')}</span> nobody
              checked is not a record.
            </>
          )}
        </p>
        <Button size="large" disabled data-record>
          Record attendance
        </Button>
      </div>
    </Card>
  )
}

/**
 * One invited resident, and whether anybody said if they came.
 *
 * **No default on any row.** A pre-selected answer is an answer nobody gave,
 * and on a register of who was where it is a claim about a person's afternoon.
 */
function Row({
  resident,
  residentId,
  attendance,
  draft,
  onAnswer,
  onReason,
}: {
  resident: Resident | undefined
  residentId: ResidentId
  attendance: AttendanceState
  draft: { answer: 'came' | 'did_not'; reason: DidNotAttendReasonId | '' } | undefined
  onAnswer: (answer: 'came' | 'did_not') => void
  onReason: (reason: DidNotAttendReasonId) => void
}) {
  const recorded = attendance.kind !== 'not_recorded'
  const came = draft?.answer === 'came' || attendance.kind === 'attended'
  const didNot = draft?.answer === 'did_not' || attendance.kind === 'did_not_attend'

  return (
    <div className={styles.attendanceRow} data-attendance-row={residentId}>
      <Who resident={resident} residentId={residentId} />

      <div className={styles.answers} role="group">
        <button
          type="button"
          className={`${styles.answer} ${styles.answerCame}`}
          aria-pressed={came}
          aria-label={`${resident?.fullLegalName ?? residentId} came`}
          data-answer="came"
          onClick={() => onAnswer('came')}
        >
          Came
        </button>
        <button
          type="button"
          className={`${styles.answer} ${styles.answerDidNot}`}
          aria-pressed={didNot}
          aria-label={`${resident?.fullLegalName ?? residentId} did not come`}
          data-answer="did_not"
          onClick={() => onAnswer('did_not')}
        >
          Did not
        </button>
      </div>

      <div>
        <Answer
          attendance={attendance}
          didNot={didNot}
          draftReason={draft?.reason ?? ''}
          onReason={onReason}
          recorded={recorded}
          residentName={resident?.fullLegalName ?? residentId}
        />
      </div>
    </div>
  )
}

function Answer({
  attendance,
  didNot,
  draftReason,
  onReason,
  recorded,
  residentName,
}: {
  attendance: AttendanceState
  didNot: boolean
  draftReason: DidNotAttendReasonId | ''
  onReason: (reason: DidNotAttendReasonId) => void
  recorded: boolean
  residentName: string
}) {
  const format = useSiteFormat()

  // Choosing "did not" on this screen asks why, and cannot be saved without
  // one — a recorded negative with no reason is indistinguishable from nobody
  // having looked, which is the distinction the third state exists for.
  if (didNot && attendance.kind !== 'did_not_attend') {
    return (
      <Select
        labelVisible
        label={`Why ${residentName} did not come`}
        placeholder="Say why"
        value={draftReason === '' ? undefined : draftReason}
        onValueChange={(value) => onReason(value as DidNotAttendReasonId)}
        options={DID_NOT_ATTEND_REASONS.map((entry) => ({
          value: entry.id,
          label: entry.name,
        }))}
      />
    )
  }

  switch (attendance.kind) {
    case 'not_recorded':
      if (recorded) return null
      return (
        <Unrecorded
          variant="chip"
          label="Nobody has said whether they came"
          detail="not the same as a record that they did not"
        />
      )

    case 'attended':
      return (
        <span className={styles.reasonNote}>
          {format.attributionOn(
            staffLabel(attendance.recordedBy),
            attendance.recordedAt,
          )}
        </span>
      )

    case 'did_not_attend': {
      const reason =
        DID_NOT_ATTEND_REASONS.find((entry) => entry.id === attendance.reason)?.name ??
        attendance.reason
      return (
        <span className={styles.reasonNote}>
          {reason}, {attendance.note}
          <br />
          {format.attributionOn(
            staffLabel(attendance.recordedBy),
            attendance.recordedAt,
          )}
        </span>
      )
    }

    default:
      return assertNever(attendance)
  }
}

/** The identity that stops a slipped row becoming the wrong person's record. */
function Who({
  resident,
  residentId,
}: {
  resident: Resident | undefined
  residentId: ResidentId
}) {
  if (!resident) {
    return (
      <span className={styles.who}>
        <Unrecorded
          variant="chip"
          label="Not a resident of this site"
          detail={residentId}
        />
      </span>
    )
  }

  return (
    <span className={styles.who}>
      <Avatar name={resident.fullLegalName} photo={resident.photo} size="small" />
      <span>
        <span className={styles.whoName}>{resident.preferredName}</span>
        <br />
        <span className={styles.whoMeta}>
          {resident.fullLegalName}
          {resident.room.kind === 'recorded'
            ? ` · Room ${resident.room.value}`
            : ' · Room not recorded'}
        </span>
      </span>
    </span>
  )
}
