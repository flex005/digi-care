import type { CarePlanDomainStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate, formatLateness } from '@/lib/format'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'
import { staffLabel } from '@/data/access/team-store'

/**
 * A care plan domain's progress. Source PRD §3, PRD §6.7:
 * "Domain status must distinguish Not Started from Complete from Review Due."
 *
 * `not_started` is hatched rather than merely grey, because a domain nobody
 * has written is a hole in the care plan, and the Needs tab lists all ten
 * domains whether or not they have content — absence from a list is the same
 * bug as a blank cell.
 */
export function DomainStatusBadge({ status }: { status: CarePlanDomainStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_started':
      return <Unrecorded label="Not started" />

    case 'in_progress':
      return (
        <StatusPill
          tone="info"
          label="In progress"
          detail={format.attribution(staffLabel(status.updatedBy), status.updatedAt)}
        />
      )

    case 'complete':
      return (
        <StatusPill
          tone="positive"
          label="Complete"
          detail={`finalised ${formatDate(status.finalisedOn)} by ${status.finalisedBy.displayName} · next review ${formatDate(status.nextReviewOn)}`}
        />
      )

    case 'review_due':
      return (
        <StatusPill
          tone="critical"
          label="Review due"
          detail={`due ${formatDate(status.dueOn)} · ${formatLateness(status.daysOverdue)} overdue · finalised ${formatDate(status.finalisedOn)}`}
        />
      )

    default:
      return assertNever(status)
  }
}
