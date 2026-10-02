import { Link, useOutletContext } from 'react-router-dom'
import type {
  CustomRisk,
  IsoDate,
  IsoDateTime,
  Resident,
  RiskFinding,
  RiskStatus,
} from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import {
  type ConfiguredState,
  configuredState,
  countsTowardsExpected,
} from '@/data/access/site-config-store'
import type { ResidentProfile } from '@/data/access/client'
import { Card } from '@/components/primitives'
import { withResidentEdits } from '@/data/access/resident-store'
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { useTerm } from '@/app/session/use-term'
import { formatCount, formatLateness } from '@/lib/format'
import { PlaceholderBanner } from './PlaceholderBanner'
import {
  LEVEL_LABEL,
  NEW_CUSTOM_RISK,
  isScored,
  isSourced,
  needsPlaceholderWarning,
} from './instrument'
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
      {/*
       * **Only while some SCORED row on this list is unsourced.** All four
       * scored templates are real now, so there is currently no row this can
       * be true of — the five unscored templates and any custom risk are not
       * what this banner is about, and showing it for them is a category
       * error (see `needsPlaceholderWarning`). Kept as a `.some` over the
       * rows, not a constant `false`, so it reappears automatically if a
       * future scored template ships before its instrument is sourced.
       */}
      {rows.some((row) =>
        needsPlaceholderWarning(isScored(row.template.id), isSourced(row.template.id)),
      ) ? (
        <PlaceholderBanner />
      ) : null}

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
            Never assessed is not low risk.
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
                    {/* The published scale where there is one, the same way
                        the admission row labels itself. */}
                    {!isScored(template.id)
                      ? 'Unscored: findings recorded'
                      : isSourced(template.id)
                        ? template.framework
                        : 'Placeholder scored instrument'}
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
              <Findings status={status} />
            </li>
          ))}
        </ul>
      </Card>

      <CustomRisks resident={resident} />
    </div>
  )
}

/**
 * What the assessment found, and what the home is doing about it.
 *
 * **Under the row rather than behind the link**, because a level with nothing
 * beneath it is the state this build spent a phase removing: the number said
 * high and the reason lived on the page it was typed on. Empty is rendered as
 * empty rather than skipped — an assessment with no description is a real
 * record, and a reader has to be able to tell it from one they have not
 * scrolled to.
 */
function Findings({ status }: { status: RiskStatus | CustomRisk }) {
  if ('kind' in status && status.kind === 'not_assessed') return null
  const finding = status as RiskFinding

  return (
    <div className={styles.rowFindings} data-findings>
      <p className={styles.findingsBody} data-finding-description>
        {finding.description === '' ? (
          <span className={styles.findingsNone}>No description recorded.</span>
        ) : (
          finding.description
        )}
      </p>
      {finding.actions.length === 0 ? (
        <p className={styles.findingsNone} data-no-actions>
          No actions recorded.
        </p>
      ) : (
        <ul className={styles.actionList} data-actions={finding.actions.length}>
          {finding.actions.map((action) => (
            <li key={`${action.description}-${action.responsible}`}>
              <span className={styles.actionWhat}>{action.description}</span>
              {/* Never the action alone: a plan nobody owns is not a plan. */}
              <span className={styles.actionWho}>{action.responsible}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Risks this home recorded for this resident, outside the nine.
 *
 * **A second list with its own sentence, never a tenth row.** "3 of 9 assessed"
 * is a claim about what every home is expected to hold, and nineteen screens
 * count against it; folding a custom risk in would make that denominator mean
 * something different for every resident. So the two are rendered together,
 * counted apart, and the heading says which is which.
 */
function CustomRisks({ resident }: { resident: Resident }) {
  const term = useTerm()
  const risks = withResidentEdits(resident).customRisks

  return (
    <Card>
      <div className={styles.customHead}>
        <div className={styles.customHeadRow}>
          <h3 className={styles.customTitle}>Recorded for {resident.preferredName}</h3>
          {/*
           * **Here rather than only at admission.** A risk a home identifies in
           * month three is the same record as one it identified on the day, and
           * a form that only takes the second sends the first somewhere else:
           * a care note, a handover, somebody's memory.
           */}
          {/*
           * A link to the same form the nine open, not a dialog. A first
           * assessment outside the nine is the same act as a first assessment
           * of one of them, and it asks for a name there because a
           * `CustomRisk` cannot exist before somebody has judged a level.
           */}
          <Link to={NEW_CUSTOM_RISK} className={styles.rowAction} data-add-custom-risk>
            <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
            Add custom risk
          </Link>
        </div>
        {/*
         * **One sentence where there is nothing here, not two.** The note and
         * the empty state fired together and said nearly the same thing twice:
         * that these sit outside the nine and are not in the figure at the top,
         * and that having none is ordinary. Both facts still have to be said —
         * a zero here is not a gap somebody can close — so they are said once,
         * and the empty case keeps its own attribute rather than its own
         * paragraph.
         */}
        <p
          className={styles.customNote}
          data-custom-claim
          data-no-custom-risks={risks.length === 0 ? true : undefined}
        >
          <span data-numeric>{formatCount(RISK_ASSESSMENT_TEMPLATES.length)}</span>{' '}
          templates above, plus <span data-numeric>{formatCount(risks.length)}</span>{' '}
          outside the nine
          {risks.length === 0
            ? ': not counted in the figure at the top, and having none is ordinary rather than a gap.'
            : ', not counted in the figure at the top.'}
        </p>
      </div>

      {risks.length === 0 ? null : (
        <ul className={styles.assessmentList}>
          {risks.map((risk) => (
            <li key={risk.id}>
              <div className={styles.assessmentRow} data-custom-risk={risk.id}>
                <div className={styles.rowAbout}>
                  <p className={styles.rowName}>{risk.name}</p>
                  <p className={styles.rowInstrument}>
                    Recorded for this {term.one}, outside the nine
                  </p>
                </div>
                {/* A custom risk is always in use: a home that recorded one
                    for a resident has not retired it. */}
                <StateChip status={{ kind: 'assessed', ...risk }} state="in_use" />
                <LevelPill status={{ kind: 'assessed', ...risk }} state="in_use" />

                {/* The nine's row exactly: re-scoring one of these is the same
                    act, on the same form, so it is the same control. */}
                <Link
                  to={risk.id}
                  className={styles.rowAction}
                  data-action="rescore"
                  aria-label={`Re-score ${risk.name} for ${resident.fullLegalName}`}
                >
                  Re-score
                  <Icon
                    name="arrows-sharp/arrow-right-01-sharp"
                    size={16}
                    aria-hidden
                  />
                </Link>
              </div>
              <Findings status={risk} />
            </li>
          ))}
        </ul>
      )}
    </Card>
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
