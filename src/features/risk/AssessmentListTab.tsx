import { Link, useOutletContext } from 'react-router-dom'
import type { IsoDate, IsoDateTime, RiskStatus } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Card } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { formatCount, formatLateness } from '@/lib/format'
import { PlaceholderBanner } from './PlaceholderBanner'
import { LEVEL_LABEL, isScored } from './instrument'
import { scoreText } from './score'
import styles from './risk.module.css'

/**
 * The assessment list. PRD §6.6.
 *
 * The sentence: **these risks have never been assessed for this person.**
 *
 * **All nine rows always render**, iterated from the template constant and
 * never from the resident's record. A list of only the completed assessments
 * would read as a complete picture, which is absence-from-a-list in its
 * original form — and completing one cannot remove a row, because the row is
 * the template rather than the assessment.
 *
 * Never assessed carries **"No level"** in the hatch. Not blank, and never
 * "low" by default: a risk nobody has looked at is not a low risk, and the
 * cheapest way to make a home look safe is to default the unknown to fine.
 */
export function AssessmentListTab() {
  const { resident } = useOutletContext<ResidentProfile>()

  const rows = RISK_ASSESSMENT_TEMPLATES.map((template) => ({
    template,
    status: resident.risks[template.id],
  }))
  const never = rows.filter((row) => row.status.kind === 'not_assessed').length

  return (
    <div className={styles.tabPanel}>
      <PlaceholderBanner />

      <div className={styles.lead} data-never-assessed={never}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(never)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            of <span data-numeric>{formatCount(rows.length)}</span> risks have never
            been assessed for {resident.preferredName}
          </span>
          <span className={styles.leadDetail}>
            Never assessed is not low risk. Every template is listed whether or not
            anybody has completed it, because a list of only the completed ones would
            read as a complete picture.
          </span>
        </span>
      </div>

      <Card>
        <ul className={styles.assessmentList}>
          {rows.map(({ template, status }) => (
            <li key={template.id}>
              <div
                className={styles.assessmentRow}
                data-template={template.id}
                data-assessed={status.kind}
              >
                <div className={styles.rowAbout}>
                  <p className={styles.rowName}>{template.name}</p>
                  <p className={styles.rowInstrument}>
                    {isScored(template.id)
                      ? 'Placeholder scored instrument'
                      : 'Unscored: findings recorded'}
                  </p>
                </div>

                <StateChip status={status} />
                <LevelPill status={status} />

                {/* Beside the hatch, never instead of it. The row still has to
                    read as a gap after the affordance is added — an action is
                    not an answer. */}
                <Link
                  to={template.id}
                  className={
                    status.kind === 'not_assessed'
                      ? styles.rowActionPrimary
                      : styles.rowAction
                  }
                  data-action={status.kind === 'not_assessed' ? 'score' : 'rescore'}
                >
                  {status.kind === 'not_assessed' ? 'Score now' : 'Re-score'}
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

function StateChip({ status }: { status: RiskStatus }) {
  const format = useSiteFormat()

  if (status.kind === 'not_assessed') {
    return (
      <span className={styles.rowState}>
        <Unrecorded
          variant="chip"
          label="Never assessed"
          detail="nobody has looked at this risk"
        />
      </span>
    )
  }

  return <ReviewChip status={status} format={format} />
}

/**
 * Where the review has got to. **An exhaustive switch, not a chain of ifs.**
 *
 * This was written as if-chains ending in a shared return, and two of
 * `ReviewState`'s five members fell into it: a `completed` assessment and one
 * with `never_scheduled` both rendered as *in date*. The fall-through returned
 * something plausible, so it was not a type error and did not look like a bug —
 * it looked like a reviewed assessment (CLAUDE.md §8).
 *
 * `assertNever` is what makes the sixth member a compile error rather than a
 * reassuring default.
 */
function ReviewChip({
  status,
  format,
}: {
  status: Extract<RiskStatus, { kind: 'assessed' }>
  format: ReturnType<typeof useSiteFormat>
}) {
  const assessed = (
    <span className={styles.rowStateSettled}>
      Assessed <span data-numeric>{format.date(dayOf(status.assessedAt))}</span>
    </span>
  )

  switch (status.reviewState.kind) {
    case 'overdue':
      return (
        <span className={`${styles.rowState} ${styles.rowStateOverdue}`}>
          Review overdue
          <small>
            {formatLateness(status.reviewState.daysOverdue)} late · last{' '}
            <span data-numeric>{format.date(dayOf(status.assessedAt))}</span>
          </small>
        </span>
      )

    case 'due':
      return (
        <span className={`${styles.rowState} ${styles.rowStateDue}`}>
          Review due
          <small>
            due <span data-numeric>{format.date(status.reviewState.dueOn)}</span>
          </small>
        </span>
      )

    case 'never_scheduled':
      // Assessed, and nobody set a date to look again. A gap — and the one
      // that read as an in-date assessment until the screen was dumped.
      return (
        <span className={styles.rowState}>
          {assessed}
          <Unrecorded
            variant="chip"
            label="No review scheduled"
            detail="nobody has set a date to look at this again"
          />
        </span>
      )

    case 'scheduled':
    case 'completed': {
      // Recorded and unremarkable renders quietly — plain text, no chip (§3b),
      // because nine green pills would drown the rows that are gaps.
      const next =
        status.reviewState.kind === 'completed'
          ? status.reviewState.nextDueOn
          : status.reviewState.dueOn
      return (
        <span className={styles.rowState}>
          {assessed}
          <small>
            {status.assessedBy.displayName} · next{' '}
            <span data-numeric>{format.date(next)}</span>
          </small>
        </span>
      )
    }

    default:
      return assertNever(status.reviewState)
  }
}

function LevelPill({ status }: { status: RiskStatus }) {
  if (status.kind === 'not_assessed') {
    // "No level" in the hatch. Never blank, and never "low" by default.
    return (
      <span className={styles.rowLevel}>
        {/* No detail line. The state chip beside it already says nobody has
            looked — two hatched chips explaining the same fact is volume
            drowning a distinction, in miniature. */}
        <Unrecorded variant="chip" label="No level" />
      </span>
    )
  }

  return (
    <span className={styles.rowLevel}>
      <StatusPill
        tone={LEVEL_TONE[status.level]}
        label={
          status.score.kind === 'scored'
            ? `${LEVEL_LABEL[status.level]} · ${status.score.value}`
            : LEVEL_LABEL[status.level]
        }
      />
      {status.score.kind === 'unscored' ? (
        <small className={styles.rowUnscored}>{scoreText(status.score)}</small>
      ) : null}
    </span>
  )
}

const LEVEL_TONE = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
} as const satisfies Record<string, 'positive' | 'caution' | 'critical'>

/** The day an instant falls on, for a field the formatter takes as a date. */
const dayOf = (at: IsoDateTime): IsoDate => at.slice(0, 10) as IsoDate
