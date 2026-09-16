import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { Goal, GoalProgressNote, IsoDateTime } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getResidentGoals } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { formatLateness } from '@/lib/format'
import { GoalMeta, GoalState, GoalStatement } from './GoalParts'
import { goalStanding } from './goal-timing'
import styles from './goals.module.css'
import { staffLabel } from '@/data/access/team-store'
import { NotYourHome } from '@/components/status'

/**
 * One goal, and what has happened since it was set. PRD §6.7.
 *
 * The sentence: **this is what has happened since it was set** — including
 * when the answer is nothing.
 */
export function GoalDetailRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { goalId } = useParams<{ goalId: string }>()
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  const load = useCallback(() => getResidentGoals(resident.id), [resident.id])
  const resource = useResource<{ goals: Goal[]; progress: GoalProgressNote[] }>(load, [
    resident.id,
  ])

  if (resource.kind === 'loading') {
    return (
      <div className={styles.tabPanel}>
        <p className={styles.loading} role="status">
          Loading this goal…
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
          <p className={styles.errorTitle}>This goal could not be loaded</p>
          <p className={styles.errorBody}>Nothing has been lost; this is a read.</p>
          <Button variant="secondary" onClick={resource.retry}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  const goal = resource.data.goals.find((entry) => entry.id === goalId)

  if (!goal) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such goal</p>
          <p className={styles.errorBody}>
            Nothing is missing from {resident.fullLegalName}&rsquo;s record; this
            address does not name one of their goals.
          </p>
          <Link to=".." relative="path" className={styles.backLink}>
            <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
            All goals
          </Link>
        </Card>
      </div>
    )
  }

  const progress = resource.data.progress.filter((note) => note.goalId === goal.id)

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        All goals
      </Link>

      <Card>
        <div className={styles.hero}>
          <GoalStatement goal={goal} hero />
          <GoalMeta goal={goal} now={now} />
        </div>

        <div className={styles.fields}>
          <div className={styles.fieldFull}>
            <p className={styles.fieldLabel}>How we will know it has happened</p>
            <p className={styles.fieldValue} data-how-we-will-know>
              {goal.howWeWillKnow}
            </p>
          </div>

          <div>
            <p className={styles.fieldLabel}>Set</p>
            <p className={styles.fieldValue}>
              <SetOn goal={goal} />
            </p>
          </div>

          <div>
            <p className={styles.fieldLabel}>Status</p>
            <p className={styles.fieldValue}>
              <GoalState
                goal={goal}
                progress={progress}
                now={now}
                preferredName={resident.preferredName}
              />
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Progress</h3>
        </div>
        <Timeline goal={goal} progress={progress} now={now} />
      </Card>
    </div>
  )
}

function SetOn({ goal }: { goal: Goal }) {
  const format = useSiteFormat()
  return (
    <>
      <span data-numeric>{format.date(goal.setOn)}</span> by {goal.setBy.displayName}
    </>
  )
}

/**
 * What has happened since it was set.
 *
 * **Its own record, not a filtered view of care notes** — so a gap here is a
 * gap in goal progress and makes no claim about the care record. That is why
 * Rule 3c does not apply to it and a gap marker is honest: nothing was
 * filtered, so nothing is an artefact of a filter.
 *
 * The last row is always when it was set and by whom. **A timeline has a
 * beginning**, and an empty one is a goal that was set and then nothing —
 * not a goal with no history.
 */
function Timeline({
  goal,
  progress,
  now,
}: {
  goal: Goal
  progress: GoalProgressNote[]
  now: IsoDateTime
}) {
  const format = useSiteFormat()
  const standing = goalStanding(goal, progress, now)
  const newestFirst = [...progress].reverse()

  return (
    <div className={styles.timeline} data-timeline>
      {standing.kind === 'past_target' ? (
        <div className={styles.timelineGap} data-timeline-gap>
          Nothing said: <span data-numeric>{formatLateness(standing.daysPast)}</span>{' '}
          past its date
          <small>
            {standing.progress.kind === 'none'
              ? 'Nothing has been written about this goal since it was set.'
              : 'Nothing has been written about this goal since the last note below.'}{' '}
            <strong>
              This is not a record that it did not happen; it is a record that nobody
              said.
            </strong>
          </small>
        </div>
      ) : null}

      {newestFirst.map((note) => (
        <div className={styles.timelineRow} key={note.id} data-progress-note={note.id}>
          <span className={styles.timelineWhen} data-numeric>
            {format.instantDate(note.recordedAt)}
          </span>
          <span>
            <span className={styles.timelineBody}>{note.body}</span>
            <span className={styles.timelineWho}>
              {format.attributionOn(staffLabel(note.recordedBy), note.recordedAt)}
            </span>
          </span>
        </div>
      ))}

      <p className={styles.timelineSet} data-timeline-set>
        Set on <span data-numeric>{format.date(goal.setOn)}</span> by{' '}
        {goal.setBy.displayName}.
      </p>
    </div>
  )
}
