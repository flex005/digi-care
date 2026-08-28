import { Link } from 'react-router-dom'
import type { Goal, GoalProgressNote, IsoDateTime } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { formatLateness, pluralise } from '@/lib/format'
import { goalStanding, targetStanding } from './goal-timing'
import type { GoalStanding } from './goal-timing'
import styles from './goals.module.css'

/**
 * The parts a goal is drawn from, shared by the tab, the detail and the queue.
 *
 * One place, because the statement's treatment is the module's whole argument:
 * **it is the largest thing on every screen it appears**, in the resident's own
 * words. Three copies of that rule is three chances for one of them to become
 * a clinical paraphrase in a smaller size.
 */

const DOMAIN_NAME = new Map(CARE_PLAN_DOMAINS.map((entry) => [entry.id, entry.name]))

/** The resident speaking: what they want, and why it matters to them. */
export function GoalStatement({ goal, hero = false }: { goal: Goal; hero?: boolean }) {
  return (
    <>
      <p
        className={hero ? styles.heroStatement : styles.statement}
        data-goal-statement={goal.id}
      >
        &ldquo;{goal.statement}&rdquo;
      </p>
      <p className={styles.why}>&ldquo;{goal.whyItMatters}&rdquo;</p>
    </>
  )
}

/**
 * The domain it belongs to and the date it is aimed at — two facts, two tags.
 *
 * The link is thin on purpose: the goal is the outcome and the domain holds
 * the method, so a goal that restates the domain's agreed actions is a
 * mis-filed care plan action.
 */
export function GoalMeta({ goal, now }: { goal: Goal; now: IsoDateTime }) {
  const format = useSiteFormat()
  const target = targetStanding(goal.target, now)

  return (
    <div className={styles.goalMeta}>
      {goal.domain.kind === 'domain' ? (
        <span className={styles.tag} data-domain={goal.domain.domainId}>
          {DOMAIN_NAME.get(goal.domain.domainId) ?? goal.domain.domainId}
        </span>
      ) : (
        // A goal nobody filed under a domain is a real state and must never
        // default to one.
        <span data-unlinked>
          <Unrecorded variant="badge" label="No domain" />
        </span>
      )}

      {target.kind === 'none' ? (
        // It can never be late, and "no date" must never read as "not yet
        // due". The hatch says which it is.
        <span data-no-target>
          <Unrecorded variant="badge" label="No target date set" />
        </span>
      ) : (
        <span
          className={
            target.kind === 'past' ? `${styles.date} ${styles.datePast}` : styles.date
          }
          data-target={target.kind}
        >
          Target <span data-numeric>{format.date(target.on)}</span>
          {target.kind === 'past'
            ? ` · ${formatLateness(target.daysPast)} past`
            : ` · in ${formatLateness(target.daysUntil)}`}
        </span>
      )}
    </div>
  )
}

const CLOSED_LABEL = {
  achieved: 'Achieved',
  not_achieved: 'Not achieved',
  withdrawn_by_resident: 'Withdrawn by the resident',
  stopped_by_service: 'Stopped by the service',
} as const

const CLOSED_CLASS = {
  achieved: styles.stateAchieved,
  not_achieved: styles.stateNotAchieved,
  withdrawn_by_resident: styles.stateWithdrawn,
  stopped_by_service: styles.stateStopped,
} as const

/**
 * The chip, and beneath it what the resident said.
 *
 * **An exhaustive switch, not a chain of ifs.** The fullest case is the one
 * where everything is recorded, so a member falling through would render as a
 * goal somebody had seen to.
 */
export function GoalState({
  goal,
  progress,
  now,
  preferredName,
}: {
  goal: Goal
  progress: GoalProgressNote[]
  now: IsoDateTime
  preferredName: string
}) {
  const format = useSiteFormat()
  const standing = goalStanding(goal, progress, now)

  return (
    <span className={styles.stateWrap} data-standing={standing.kind}>
      <Chip standing={standing} />
      <Said standing={standing} preferredName={preferredName} format={format} />
    </span>
  )
}

function Chip({ standing }: { standing: GoalStanding }) {
  const format = useSiteFormat()

  switch (standing.kind) {
    case 'past_target':
      /*
       * The lead finding, and it is a gap rather than a failure: the date
       * passed and nobody has said what happened. That is not a record that
       * it did not happen.
       */
      return (
        <Unrecorded
          variant="chip"
          label="Nothing recorded"
          detail={
            standing.progress.kind === 'none'
              ? `no progress note since it was set, and ${formatLateness(standing.daysPast)} past its date`
              : `last note ${format.instantDate(standing.progress.at)}, nothing since, and ${formatLateness(standing.daysPast)} past its date`
          }
        />
      )

    case 'moving':
      // Recorded and unremarkable renders quietly — plain text, no chip (§3b).
      return (
        <span className={`${styles.state} ${styles.stateMoving}`} data-moving>
          In progress
          <small>
            {pluralise(standing.progress.count, 'note')} · last{' '}
            <span data-numeric>{format.instantDate(standing.progress.at)}</span> ·{' '}
            {standing.progress.by.displayName}
          </small>
        </span>
      )

    case 'nothing_yet':
      return (
        <Unrecorded
          variant="chip"
          label="No progress recorded"
          detail={`set ${formatLateness(standing.daysSinceSet)} ago and nothing written since`}
        />
      )

    case 'closed':
      return (
        <span
          className={`${styles.state} ${CLOSED_CLASS[standing.outcome]}`}
          data-closed={standing.outcome}
        >
          {CLOSED_LABEL[standing.outcome]}
          <small>
            <span data-numeric>{format.date(standing.on)}</span> ·{' '}
            {standing.by.displayName} · {standing.note}
          </small>
        </span>
      )

    default:
      return assertNever(standing)
  }
}

/**
 * What the resident said about the decision to close their goal.
 *
 * **"Not asked" renders as the gap it is.** A family reading this later is
 * entitled to know whether the person was asked — and on a goal, which is the
 * one record whose subject is what *they* wanted, that question is the record.
 */
function Said({
  standing,
  preferredName,
  format,
}: {
  standing: GoalStanding
  preferredName: string
  format: ReturnType<typeof useSiteFormat>
}) {
  void format
  if (standing.kind !== 'closed') return null
  const view = standing.residentView

  // A withdrawal carries none, because the withdrawal *is* their view.
  if (view === 'not_applicable') return null

  switch (view.kind) {
    case 'agreed':
      return (
        <span className={`${styles.said} ${styles.saidAgreed}`} data-said="agreed">
          {preferredName} agreed
        </span>
      )
    case 'disagreed':
      return (
        <span
          className={`${styles.said} ${styles.saidDisagreed}`}
          data-said="disagreed"
        >
          {preferredName} disagreed: {view.note}
        </span>
      )
    case 'not_asked':
      return (
        <span data-said="not_asked">
          <Unrecorded
            variant="chip"
            label={`${preferredName} was not asked`}
            detail="nobody recorded what they thought of this"
          />
        </span>
      )
    default:
      return assertNever(view)
  }
}

/** The action on a goal card, wherever it appears. */
export function OpenGoal({ to, primary = false }: { to: string; primary?: boolean }) {
  return (
    <Link to={to} className={primary ? styles.actionPrimary : styles.action}>
      Open
    </Link>
  )
}
