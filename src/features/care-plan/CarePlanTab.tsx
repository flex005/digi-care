import { now as appNow } from '@/data/fixtures/clock'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { CarePlanDomainRecord, IsoDateTime } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { formatCount, formatLateness, pluralise } from '@/lib/format'
import { OwedReviews } from './OwedReviews'
import { currentVersion, versionCount } from './plan-fields'
import { reviewTiming } from './review-timing'
import type { ReviewTiming } from './review-timing'
import styles from './care-plan.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The care plan domain list. PRD §6.7.
 *
 * The sentence: **these parts of this person's care have never been written
 * down.**
 *
 * **All ten rows always render**, iterated from the domain constant and never
 * from the resident's record — the same rule as the risk list, for the same
 * reason. A list of only the written domains would read as a complete plan,
 * and a plan is exactly the document where an absence has to be visible: staff
 * follow what it says, so what it does not say is what nobody is doing.
 */
export function CarePlanTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
  const rows = CARE_PLAN_DOMAINS.map((domain) => ({
    domain,
    record: byDomain.get(domain.id),
  }))

  const neverWritten = rows.filter(
    (row) => row.record === undefined || row.record.status.kind === 'not_started',
  ).length

  /*
   * Part-written and unsigned is not counted in the figure above, and is not
   * nothing either.
   *
   * "Never been written down" is a precise claim and a draft breaks it. But a
   * domain nobody has signed gives staff nothing to follow whether or not
   * somebody started typing, so the count that would be hidden by silence is
   * named in the sentence instead of becoming a second figure competing with
   * the first.
   */
  const unsigned = rows.filter(
    (row) => row.record !== undefined && row.record.status.kind === 'in_progress',
  ).length

  return (
    <div className={styles.tabPanel}>
      <OwedReviews residentId={resident.id} now={now} />

      <div className={styles.lead} data-never-written={neverWritten}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(neverWritten)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            of <span data-numeric>{formatCount(rows.length)}</span> parts of{' '}
            {resident.preferredName}&rsquo;s care have never been written down
          </span>
          <span className={styles.leadDetail}>
            Never written down is not &ldquo;no needs here&rdquo;. Every domain is
            listed whether or not anybody has written it, because a list of only the
            written ones would read as a complete plan.
            {unsigned > 0 ? (
              <>
                {' '}
                A further <span data-numeric>{pluralise(unsigned, 'domain')}</span>,
                started, not signed, and nothing staff can follow yet.
              </>
            ) : null}
          </span>
        </span>
      </div>

      <Card>
        <ul className={styles.domainList}>
          {rows.map(({ domain, record }) => (
            <li key={domain.id}>
              <div
                className={styles.domainRow}
                data-domain={domain.id}
                data-state={record?.status.kind ?? 'missing'}
              >
                <div className={styles.rowAbout}>
                  <p className={styles.rowName}>{domain.name}</p>
                  <ResidentVoice record={record} />
                </div>

                <div className={styles.rowState} data-state-cell>
                  {record === undefined ? (
                    <Unrecorded
                      variant="chip"
                      label="No record for this domain"
                      detail="the plan does not hold this domain at all"
                    />
                  ) : (
                    <>
                      <DomainState timing={reviewTiming(record.status, now)} />
                      <DraftFact record={record} />
                    </>
                  )}
                </div>

                <p className={styles.rowVersion}>
                  {record !== undefined && versionCount(record) > 0 ? (
                    <>
                      Version <b data-numeric>{versionCount(record)}</b>
                    </>
                  ) : null}
                </p>

                {/* Beside the hatch and in its own column after it. The row
                    still has to read as a gap once the affordance is there —
                    separation, not proximity, as the risk list settled. */}
                <Link
                  to={domain.id}
                  className={
                    record === undefined || record.status.kind === 'not_started'
                      ? styles.rowActionPrimary
                      : styles.rowAction
                  }
                  data-action={
                    record === undefined || record.status.kind === 'not_started'
                      ? 'write'
                      : 'open'
                  }
                  aria-label={`${
                    record === undefined || record.status.kind === 'not_started'
                      ? 'Write'
                      : 'Open'
                  } the ${domain.name} care plan domain for ${resident.fullLegalName}`}
                >
                  {record === undefined || record.status.kind === 'not_started'
                    ? 'Write this domain'
                    : 'Open domain'}
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

/**
 * The first line of what this person said, beneath the domain name.
 *
 * **Their voice, not a clinical summary of it**, and taken from the signed
 * version rather than from `summary` or a draft: an unsigned sentence is not
 * what the plan says. Where nothing has been signed the line is **absent**
 * rather than replaced by a placeholder — the state chip beside it already
 * says nobody has written this, and a second grey line repeating it is volume
 * drowning the distinction.
 */
function ResidentVoice({ record }: { record: CarePlanDomainRecord | undefined }) {
  if (record === undefined) return null
  const version = currentVersion(record)
  if (version === 'none' || version.currentNeeds.trim() === '') return null

  return (
    <p className={styles.rowQuote} data-quote>
      &ldquo;{version.currentNeeds}&rdquo;
    </p>
  )
}

/**
 * Where the plan has got to. **An exhaustive switch, not a chain of ifs.**
 *
 * The chain's last branch is the fullest case and the fullest case is the one
 * where everything is recorded (§8), so a member that fell through here would
 * render as a signed, in-date plan. `assertNever` makes a sixth timing a
 * compile error rather than a reassuring default.
 */
function DomainState({ timing }: { timing: ReviewTiming }) {
  const format = useSiteFormat()

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
      // Started, nothing signed. Not the hatch: somebody has looked, and what
      // is missing is a signature rather than the work. The words say so.
      return (
        <span className={`${styles.stateChip} ${styles.stateDraft}`} data-state-chip>
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
            {formatLateness(timing.daysOverdue)} late · last signed{' '}
            <span data-numeric>{format.date(timing.signed.on)}</span>
          </small>
        </span>
      )

    case 'due_soon':
      /*
       * No chip. A recorded plan approaching a date is the least urgent of the
       * three unsettled states, and the one most likely to crowd the two that
       * matter: the signature is plain text and only the date takes caution
       * ink.
       */
      return (
        <span
          className={`${styles.rowSettled} ${styles.rowSettledDueSoon}`}
          data-due-soon={timing.daysUntil}
        >
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            review due <span data-numeric>{format.date(timing.dueOn)}</span>
          </small>
        </span>
      )

    case 'settled':
      // Recorded and unremarkable renders quietly (§3b). Ten green pills would
      // drown the rows that are the reason to open this screen.
      return (
        <span className={styles.rowSettled} data-settled>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <small>
            {timing.signed.by.displayName} · next review{' '}
            <span data-numeric>{format.date(timing.nextReviewOn)}</span>
          </small>
        </span>
      )

    default:
      return assertNever(timing)
  }
}

/**
 * A draft sitting on top of a signed plan, as its own fact.
 *
 * **Two facts, two treatments.** There is an instruction staff are following
 * today *and* somebody has started rewriting it and has not signed. Rendered
 * as one chip it becomes either "nothing is in force" or "this is settled",
 * and both are wrong in the direction that matters.
 *
 * Nothing renders where the draft is the only thing there — `in_progress`
 * already says it, and saying it twice in one cell is the same volume problem.
 */
function DraftFact({ record }: { record: CarePlanDomainRecord }) {
  const format = useSiteFormat()
  if (record.draft.kind !== 'draft') return null
  if (record.status.kind === 'in_progress') return null

  return (
    <span className={`${styles.stateChip} ${styles.stateDraft}`} data-draft-over-signed>
      Draft in progress
      <small>
        {format.attributionOn(
          staffLabel(record.draft.updatedBy),
          record.draft.updatedAt,
        )}{' '}
        · not signed, and the signed version above is what staff follow
      </small>
    </span>
  )
}
