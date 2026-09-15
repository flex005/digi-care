import { Link, useOutletContext } from 'react-router-dom'
import type { IsoDate, IsoDateTime, RiskStatus } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import {
  type ConfiguredState,
  configuredState,
  countsTowardsExpected,
} from '@/data/access/site-config-store'
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

  /*
   * **Every template, and the pair.** The list has always shown all of them,
   * because a list of the completed ones reads as a complete picture. From
   * Phase 22 each row also carries what the home decided about the template,
   * and the two together are what a row means: an unassessed template this
   * home uses is a gap somebody can close, and an unassessed one it does not
   * use is a question nobody here asks.
   */
  const rows = RISK_ASSESSMENT_TEMPLATES.map((template) => {
    const status = resident.risks[template.id]
    return {
      template,
      status,
      state: configuredState(resident.siteId, template.id, status.kind === 'assessed'),
    }
  })
  /*
   * **Counted over what this home asks, and the claim says so.** Counting
   * retired templates would report a gap that is an artefact of a setting
   * rather than of the record — the filtered-set rule, arriving through a
   * configuration rather than through a control.
   */
  const asked = rows.filter((row) => countsTowardsExpected(row.state))
  const never = asked.filter((row) => row.status.kind === 'not_assessed').length
  const retired = rows.length - asked.length

  return (
    <div className={styles.tabPanel}>
      <PlaceholderBanner />

      <div className={styles.lead} data-never-assessed={never}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(never)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            of <span data-numeric>{formatCount(asked.length)}</span> risks have never
            been assessed for {resident.preferredName}
          </span>
          <span className={styles.leadDetail}>
            Never assessed is not low risk. Every template is listed whether or not
            anybody has completed it, because a list of only the completed ones would
            read as a complete picture.
            {retired > 0 ? (
              <>
                {' '}
                <span data-retired-note>
                  {formatCount(retired)} of the {formatCount(rows.length)} are not
                  carried out at this home and are not counted above; anything already
                  recorded against them is still below.
                </span>
              </>
            ) : null}
          </span>
        </span>
      </div>

      <Card>
        <ul className={styles.assessmentList}>
          {rows.map(({ template, status, state }) => (
            <li key={template.id}>
              <div
                className={styles.assessmentRow}
                data-template={template.id}
                data-assessed={status.kind}
                data-configured={state}
              >
                <div className={styles.rowAbout}>
                  <p className={styles.rowName}>{template.name}</p>
                  <p className={styles.rowInstrument}>
                    {isScored(template.id)
                      ? 'Placeholder scored instrument'
                      : 'Unscored: findings recorded'}
                  </p>
                </div>

                <StateChip status={status} state={state} />
                <LevelPill status={status} state={state} />

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

function StateChip({ status, state }: { status: RiskStatus; state: ConfiguredState }) {
  const format = useSiteFormat()

  /*
   * **Plain, never hatched.** The home does not carry this assessment out and
   * nobody has done one: that is not a gap somebody can close, it is a
   * question nobody here asks. The hatch says nobody has looked, and it
   * invites completion — which would be inviting somebody to answer a question
   * the home has decided not to ask.
   */
  if (state === 'retired_unanswered') {
    return (
      <span className={styles.rowState} data-not-carried-out>
        Not carried out at this home
      </span>
    )
  }

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

  /*
   * **A record on a retired template keeps everything it had, quietly.**
   * Somebody did this assessment, with their name, their score and the date on
   * it, and the home deciding later that it no longer carries this one out
   * does not make that untrue. Hiding it would delete work; the line beside it
   * says why nobody is being asked to redo it.
   */
  return (
    <span className={styles.rowState}>
      <ReviewChip status={status} format={format} />
      {state === 'retired_answered' ? (
        <span className={styles.retiredNote} data-retired>
          This home no longer carries this assessment out. The record stays.
        </span>
      ) : null}
    </span>
  )
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

function LevelPill({ status, state }: { status: RiskStatus; state: ConfiguredState }) {
  /*
   * **Nothing, where the home does not ask the question.** The state chip
   * beside it already says the assessment is not carried out here, and a
   * hatched "No level" next to that would be the second treatment saying the
   * same thing — which is the argument the comment below already makes about
   * a duplicate detail line, one column over.
   *
   * It was the defect this row had when the four states first landed: the
   * chip went plain and the level pill kept hatching, so a retired template
   * still rendered as a gap. A test caught it, which is the point of asserting
   * the absence of the treatment rather than the presence of the copy.
   */
  if (state === 'retired_unanswered') return null

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
