import type { ReviewState } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { Settled } from './Settled'
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

/**
 * How loudly to render it.
 *
 * `comfortable` — one resident, one badge, on a profile. Every state gets the
 * same pill treatment.
 *
 * `compact` — a column of 32, where the reader's task is scanning for the ones
 * that need work. Here the two settled states (completed and in date;
 * scheduled and not yet due) drop to plain text, because a green pill on 24 of
 * 28 rows is the loudest thing on a screen whose job is finding the other four.
 *
 * What does NOT change between the two: every state still renders, with its
 * date and author. `never_scheduled` stays hatched in both — a gap is never
 * quieted for density. Only settled facts get quieter, and only where the
 * volume of them is itself the problem.
 */
export type ReviewEmphasis = 'comfortable' | 'compact'

export function ReviewBadge({
  state,
  emphasis = 'comfortable',
}: {
  state: ReviewState
  emphasis?: ReviewEmphasis
}) {
  const compact = emphasis === 'compact'

  switch (state.kind) {
    case 'never_scheduled':
      return <Unrecorded label="Never scheduled" />

    case 'scheduled':
      // Booked, not yet due. Nothing to do about it today.
      return compact ? (
        <Settled label="Scheduled" detail={`due ${formatDate(state.dueOn)}`} />
      ) : (
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
      return compact ? (
        <Settled
          label={`Reviewed ${formatDate(state.completedOn)}`}
          detail={`next ${formatDate(state.nextDueOn)} · ${state.completedBy.displayName}`}
        />
      ) : (
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
