import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type {
  CarePlanDomainId,
  CarePlanDomainRecord,
  IsoDate,
  IsoDateTime,
} from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { recordWholePlanReview, undoWholePlanReviewRecord } from '@/data/access/client'
import type { WholePlanReviewToken } from '@/data/access/whole-plan-review-store'
import type { ProfileContext } from '@/features/residents/ResidentProfileRoute'
import { AlertDialog, Button, Card, Toast } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { formatLateness, pluralise } from '@/lib/format'
import { nextReviewFrom } from '@/lib/review-interval'
import { reviewTiming } from '@/features/care-plan/review-timing'
import styles from './reviews.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The whole care plan review — the meeting, not the plan. PRD §6.7.
 *
 * The sentence: **this is the plan as it stands, and completing this records
 * which parts of it were still gaps.**
 *
 * **It can be completed while domains are gaps, and the record carries which
 * ones.** The handover signature pattern exactly. Refusing would mean the
 * meeting happened and the system holds no evidence of it — and a review
 * meeting happens *because* there are gaps, so refusing is refusing to record
 * the normal case. Permitting it silently would let "care plan reviewed" sit
 * over three domains nobody has written.
 *
 * **Not a profile tab**, deliberately. Each module already answers for its own
 * records, and a second place to see the same thing is where the two start
 * disagreeing. It is reached from the review queue, and it renders inside the
 * profile layout so the subject header is there — a write surface without one
 * is the wrong-subject failure waiting to happen (§2.4).
 */
export function WholePlanReviewRoute() {
  const { resident, refresh } = useOutletContext<ProfileContext>()
  const { currentUser } = useSession()
  const format = useSiteFormat()

  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)
  const [discussion, setDiscussion] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [recorded, setRecorded] = useState<WholePlanReviewToken | 'none'>('none')
  const [error, setError] = useState('')

  const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
  const rows = CARE_PLAN_DOMAINS.map((domain) => ({
    domain,
    record: byDomain.get(domain.id),
  }))

  /*
   * What will be carried on the signature, named rather than counted.
   *
   * A figure says how much was missing; the names say what — and what the
   * record has to hold is which domains, so that it can never later read as a
   * review of a complete plan.
   */
  const outstanding = rows.filter(({ record }) => isGap(record))
  const state = resident.carePlanReview
  const against =
    state.kind === 'scheduled' || state.kind === 'due' || state.kind === 'overdue'
      ? ({ kind: 'due_on', dueOn: state.dueOn } as const)
      : ({ kind: 'never_scheduled' } as const)
  const today = now.slice(0, 10) as IsoDate
  const nextDueOn = nextReviewFrom(now)

  return (
    <div className={styles.page}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        The whole care plan
      </Link>

      <h2 className={styles.sessionTitle}>
        Whole care plan review: {resident.fullLegalName}
      </h2>

      <Card>
        <p className={styles.sectionTitle}>The plan as it stands</p>
        {rows.map(({ domain, record }) => (
          <div className={styles.domainRow} key={domain.id} data-domain={domain.id}>
            <p className={styles.domainName}>{domain.name}</p>
            <span className={styles.rowState}>
              <DomainState record={record} now={now} />
            </span>
            <Link
              to={`../${domain.id}`}
              relative="path"
              className={styles.rowAction}
              data-open-domain={domain.id}
              aria-label={`Open the ${domain.name} care plan domain`}
            >
              Open
            </Link>
          </div>
        ))}

        <div className={styles.discussion}>
          <label className={styles.domainName} htmlFor="discussion">
            What was discussed
          </label>
          <textarea
            id="discussion"
            className={styles.textarea}
            value={discussion}
            placeholder="Who was there, what was agreed, what changes."
            onChange={(event) => setDiscussion(event.target.value)}
          />
        </div>
      </Card>

      {outstanding.length > 0 ? (
        <div className={styles.willStore} data-will-store={outstanding.length}>
          <p className={styles.willStoreTitle}>
            Completing this records that{' '}
            <span data-numeric>{pluralise(outstanding.length, 'domain')}</span>{' '}
            {outstanding.length === 1 ? 'was a gap' : 'were gaps'} at the time
          </p>
          <p className={styles.willStoreBody}>
            You can complete this review with parts of the plan unwritten, the meeting
            happened and it should be on the record. But the record will carry what was
            outstanding when you signed it, so it can never later read as a review of a
            complete plan.
          </p>
          <ul className={styles.willStoreList}>
            {outstanding.map(({ domain, record }) => (
              <li key={domain.id} data-outstanding={domain.id}>
                {domain.name}, {gapDescription(record)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card>
        <div className={styles.foot}>
          <p className={styles.footState} data-foot-state>
            {recorded === 'none' ? (
              <>
                <strong>
                  Completing records a whole care plan review for{' '}
                  {resident.fullLegalName} on{' '}
                  <span data-numeric>{format.date(today)}</span>
                  {outstanding.length === 0
                    ? ' with nothing outstanding'
                    : `, carrying ${pluralise(outstanding.length, 'outstanding domain')}`}
                  .
                </strong>{' '}
                The next review falls due{' '}
                <span data-numeric>{format.date(nextDueOn)}</span>.
              </>
            ) : (
              <>
                <strong>The review is recorded.</strong> It carries{' '}
                {outstanding.length === 0
                  ? 'nothing outstanding'
                  : pluralise(outstanding.length, 'outstanding domain')}
                , and it will say so wherever it is read. Held in memory only and gone
                on reload.
              </>
            )}
          </p>

          {recorded === 'none' ? (
            <Button size="large" onClick={() => setConfirming(true)} data-complete>
              Complete review
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="large"
              data-undo-review
              onClick={() => {
                void undo(recorded)
              }}
            >
              Undo: take the review back
            </Button>
          )}
        </div>
      </Card>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        subject={{
          kind: 'resident',
          name: resident.fullLegalName,
          ...(resident.room.kind === 'recorded' ? { room: resident.room.value } : {}),
        }}
        action="Complete the whole care plan review"
        confirmLabel="Complete review"
        description={
          <span className={styles.confirmBody}>
            <span>
              The next review falls due {format.date(nextDueOn)}, and this becomes the
              review date every screen reads.
            </span>
            {/*
              Named individually, never counted — and in one sentence rather
              than one sentence each. Four identical openings is the reader
              skipping to the end of the list; the names are the point, not the
              repetition.
            */}
            {outstanding.length === 0 ? (
              <span>Every domain was written and in date at the time of signing.</span>
            ) : (
              <span data-outstanding-names>
                Recorded as outstanding at the time of this review:{' '}
                {outstanding.map(({ domain }) => domain.name).join(', ')}.
              </span>
            )}
            <span>
              Held in memory only for this session and gone on reload. There is no
              backend in this build, so nothing here reaches a real record.
            </span>
          </span>
        }
        onConfirm={() => {
          void complete()
        }}
      />

      <Toast
        open={recorded !== 'none'}
        onOpenChange={(open) => {
          if (!open) setRecorded('none')
        }}
        tone="positive"
        title={
          outstanding.length === 0
            ? 'Care plan review recorded'
            : `Care plan review recorded: ${pluralise(outstanding.length, 'domain')} outstanding`
        }
        description="Held in memory only and gone on reload."
      />

      {error === '' ? null : <p className={styles.errorBody}>{error}</p>}
    </div>
  )

  async function complete() {
    try {
      const token = await recordWholePlanReview({
        residentId: resident.id,
        by: currentUser,
        on: today,
        nextDueOn,
        against,
        outstanding: outstanding.map(({ domain }) => domain.id as CarePlanDomainId),
      })
      setConfirming(false)
      setRecorded(token)
      refresh()
      setError('')
    } catch (cause) {
      setConfirming(false)
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }

  async function undo(token: WholePlanReviewToken) {
    await undoWholePlanReviewRecord(token)
    setRecorded('none')
    refresh()
  }
}

/** A domain that was a gap at the time of signing: unwritten, or past its date. */
function isGap(record: CarePlanDomainRecord | undefined): boolean {
  if (!record) return true
  return record.status.kind !== 'complete'
}

function gapDescription(record: CarePlanDomainRecord | undefined): string {
  if (!record) return 'not on this care plan'
  switch (record.status.kind) {
    case 'not_started':
      return 'never written'
    case 'in_progress':
      return 'started and never signed'
    case 'review_due':
      return `${formatLateness(record.status.daysOverdue)} past its own review date`
    case 'complete':
      return 'in date'
    default:
      return assertNever(record.status)
  }
}

/**
 * The same states the care plan tab renders, read-only here.
 *
 * Read-only because this screen is the meeting, not the editing: the act of
 * writing a domain belongs to the editor, and two screens that can both write
 * one domain is two ways to do one thing.
 */
function DomainState({
  record,
  now,
}: {
  record: CarePlanDomainRecord | undefined
  now: IsoDateTime
}) {
  const format = useSiteFormat()

  if (!record) {
    return (
      <Unrecorded
        variant="chip"
        label="Not on this care plan"
        detail="the plan does not hold this domain at all"
      />
    )
  }

  const timing = reviewTiming(record.status, now)

  switch (timing.kind) {
    case 'not_started':
      return (
        <Unrecorded
          variant="chip"
          label="Never written"
          detail="nobody has written what this person needs here"
        />
      )

    case 'in_progress':
      return (
        <span className={styles.stateSettled}>
          Draft in progress
          <small>
            {format.attributionOn(staffLabel(timing.updatedBy), timing.updatedAt)} · not
            signed
          </small>
        </span>
      )

    case 'overdue':
      return (
        <span className={`${styles.stateChip} ${styles.stateOverdue}`} data-state-chip>
          Review overdue
          <small>
            {formatLateness(timing.daysOverdue)} late · signed{' '}
            <span data-numeric>{format.date(timing.signed.on)}</span>
          </small>
        </span>
      )

    case 'due_soon':
      return (
        <span className={styles.stateSettled}>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            review due <span data-numeric>{format.date(timing.dueOn)}</span>
          </small>
        </span>
      )

    case 'settled':
      return (
        <span className={styles.stateSettled}>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            next review <span data-numeric>{format.date(timing.nextReviewOn)}</span>
          </small>
        </span>
      )

    default:
      return assertNever(timing)
  }
}
