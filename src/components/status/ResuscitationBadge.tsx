import type { ResuscitationStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate, formatAttribution } from '@/lib/format'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * Resuscitation status. PRD §5.1, §6.2.
 *
 * "For DNAR the same ambiguity is catastrophic in both directions" (§2.1) —
 * a missing badge must never be read as "for resuscitation", and it must
 * never be read as "DNAR". So there are three states and the third is
 * rendered, loudly.
 *
 * DNAR in place uses the brand tone rather than red or green, because a DNAR
 * is a recorded clinical decision and neither good news nor bad news.
 * Colouring it would editorialise a legal document.
 */
export function ResuscitationBadge({ status }: { status: ResuscitationStatus }) {
  switch (status.kind) {
    case 'no_decision_recorded':
      return <Unrecorded label="No decision recorded" />

    case 'dnar_in_place':
      return (
        <StatusPill
          tone="brand"
          label="DNAR in place"
          detail={`signed by ${status.signedBy}, ${formatDate(status.signedOn)}`}
        />
      )

    case 'for_resuscitation':
      return (
        <StatusPill
          tone="positive"
          label="For resuscitation"
          detail={formatAttribution(
            status.recordedBy.displayName,
            status.recordedAt,
            status.recordedBy.isActive,
          )}
        />
      )

    default:
      return assertNever(status)
  }
}
