import type { ReviewState } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * Review timing. PRD §5.1, §2.1.
 *
 * "'Never scheduled' and 'scheduled and completed on time' must not both
 * render as untroubled." A review nobody ever put in the diary is not a
 * review that is up to date, so never_scheduled is hatched, not green and
 * not blank.
 *
 * In lists, never_scheduled is its own row — absence from a list is the same
 * failure as a blank cell. PRD §6.7.
 */
export function ReviewBadge({ state }: { state: ReviewState }) {
  switch (state.kind) {
    case 'never_scheduled':
      return <Unrecorded label="Never scheduled" />

    case 'scheduled':
      return (
        <StatusPill
          tone="info"
          label="Scheduled"
          detail={`due ${formatDate(state.dueOn)}`}
        />
      )

    case 'due':
      return (
        <StatusPill
          tone="caution"
          label="Review due"
          detail={`due ${formatDate(state.dueOn)}`}
        />
      )

    case 'overdue':
      return (
        <StatusPill
          tone="critical"
          label="Overdue"
          detail={`due ${formatDate(state.dueOn)} · ${state.daysOverdue} day${
            state.daysOverdue === 1 ? '' : 's'
          } overdue`}
        />
      )

    case 'completed':
      return (
        <StatusPill
          tone="positive"
          label="Completed"
          detail={`${formatDate(state.completedOn)} by ${state.completedBy.displayName} · next due ${formatDate(state.nextDueOn)}`}
        />
      )

    default:
      return assertNever(state)
  }
}
