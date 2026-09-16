import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { Goal, GoalProgressNote, IsoDateTime } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getResidentGoals } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { formatCount, formatDuration, pluralise } from '@/lib/format'
import { GoalMeta, GoalState, GoalStatement, OpenGoal } from './GoalParts'
import {
  NO_GOALS_ALERT_DAYS,
  daysSinceAdmission,
  goalStanding,
  longEnoughToExpectAGoal,
} from './goal-timing'
import styles from './goals.module.css'
import { NotYourHome } from '@/components/status'

/**
 * A resident's goals. PRD §6.7, Phase 8.
 *
 * The sentence, and it changes with the record: **nobody has set a goal with
 * this person** — or, once somebody has, **these goals passed their date and
 * nobody has said what happened.**
 *
 * A goal is the first record in this build whose subject is the resident's own
 * intention rather than a clinical account of them, which is why the statement
 * is the largest thing on the card and why "what the resident said" is a fact
 * the screen carries rather than a detail.
 */
export function GoalsTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  const load = useCallback(() => getResidentGoals(resident.id), [resident.id])
  const resource = useResource<{ goals: Goal[]; progress: GoalProgressNote[] }>(load, [
    resident.id,
  ])

  if (resource.kind === 'loading') {
    return (
      <div className={styles.tabPanel}>
        <p className={styles.loading} role="status">
          Loading goals…
        </p>
      </div>
    )
  }

  /* The record exists, in a home this viewer is not appointed to. */

  if (resource.kind === 'refused') {
    return <NotYourHome refusal={resource} />
  }

  if (resource.kind === 'error') {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>Goals could not be loaded</p>
          <p className={styles.errorBody}>Nothing has been lost; this is a read.</p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  const { goals, progress } = resource.data
  const byGoal = new Map<string, GoalProgressNote[]>()
  for (const note of progress) {
    byGoal.set(note.goalId, [...(byGoal.get(note.goalId) ?? []), note])
  }

  if (goals.length === 0) {
    return (
      <div className={styles.tabPanel} data-goals-panel>
        <NobodyHasSetOne resident={resident} now={now} />
      </div>
    )
  }

  /*
   * The lead: open, past its date, and nobody has said what happened.
   *
   * Undated goals are not in it and cannot be — a goal with no target date can
   * never be late — which is why the denominator says what it counts.
   */
  const pastTarget = goals.filter(
    (goal) => goalStanding(goal, byGoal.get(goal.id) ?? [], now).kind === 'past_target',
  ).length
  const dated = goals.filter((goal) => goal.target.kind === 'by_date').length

  return (
    <div className={styles.tabPanel} data-goals-panel>
      <div className={styles.lead} data-past-target={pastTarget}>
        <span className={styles.leadFigure} data-numeric>
          {formatCount(pastTarget)}
        </span>
        <span className={styles.leadBody}>
          <span className={styles.leadTitle}>
            {pastTarget === 1
              ? 'goal passed its date with nothing recorded'
              : 'goals passed their date with nothing recorded'}
          </span>
          <span className={styles.leadDetail}>
            Of <span data-numeric>{pluralise(dated, 'goal')}</span> with a target date,
            among <span data-numeric>{formatCount(goals.length)}</span> set with{' '}
            {resident.preferredName}. Nobody has said whether these happened.
          </span>
        </span>
      </div>

      <Card>
        <ul className={styles.goalList}>
          {goals.map((goal) => (
            <li key={goal.id}>
              <div className={styles.goalCard} data-goal={goal.id}>
                <div>
                  <GoalStatement goal={goal} />
                  <GoalMeta goal={goal} now={now} />
                </div>
                <GoalState
                  goal={goal}
                  progress={byGoal.get(goal.id) ?? []}
                  now={now}
                  preferredName={resident.preferredName}
                />
                <OpenGoal to={goal.id} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/**
 * Nobody has set a goal with this person.
 *
 * **The lead is the screen.** There is no list beneath it because there is
 * nothing to list, and a table header over an empty body says the opposite of
 * what this screen is for.
 *
 * It names how long they have been here, because "no goals set" means nothing
 * about somebody admitted yesterday and a great deal about somebody here five
 * months — the threshold doing visible work rather than sitting in a constant.
 */
function NobodyHasSetOne({
  resident,
  now,
}: {
  resident: ResidentProfile['resident']
  now: IsoDateTime
}) {
  const here = daysSinceAdmission(resident.admittedOn, now)
  const expected = longEnoughToExpectAGoal(resident.admittedOn, now)

  return (
    <div
      className={styles.leadNone}
      data-no-goals
      data-expected={expected || undefined}
    >
      <p className={styles.leadNoneTitle}>
        Nobody has set a goal with {resident.preferredName}
      </p>
      <p className={styles.leadNoneBody}>
        {expected ? (
          <>
            They have been here <span data-numeric>{formatDuration(here)}</span>. A goal
            is this person&rsquo;s own statement of something they want, not a care plan
            action, and not something decided for them. Setting one starts with asking.
          </>
        ) : (
          <>
            {/* The window has not elapsed, so the answer is not "no problem",
                it is not yet knowable — and the screen says which. */}
            They have been here <span data-numeric>{formatDuration(here)}</span>, which
            is less than the{' '}
            <span data-numeric>{pluralise(NO_GOALS_ALERT_DAYS, 'day')}</span> this home
            expects to have asked within. This is not yet a gap; it is a conversation
            that has not come round.
          </>
        )}
      </p>
      <span className={styles.leadNoneAction}>
        <Link to="new" className={styles.actionPrimary} data-set-goal>
          Set a goal with {resident.preferredName}
          <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
        </Link>
      </span>
    </div>
  )
}
