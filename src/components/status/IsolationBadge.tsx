import type { IsolationStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * Infection control isolation. Source PRD §16.3 — amber.
 *
 * "Not isolating" is a recorded observation, not an absence. A care worker
 * about to walk into a room needs to know the difference between "somebody
 * checked this morning and she is not isolating" and "nobody has said".
 */
export function IsolationBadge({ status }: { status: IsolationStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_recorded':
      return <Unrecorded label="Isolation status not recorded" />

    case 'not_isolating':
      return (
        <StatusPill
          tone="positive"
          label="Not isolating"
          detail={format.attribution(
            status.recordedBy.displayName,
            status.recordedAt,
            status.recordedBy.isActive,
          )}
        />
      )

    case 'isolating':
      return (
        <StatusPill
          tone="caution"
          label={`Isolating — ${status.reason}`}
          detail={`since ${formatDate(status.since)} · ${status.recordedBy.displayName}`}
        />
      )

    default:
      return assertNever(status)
  }
}
