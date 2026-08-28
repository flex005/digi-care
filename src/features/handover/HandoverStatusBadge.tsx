import type { HandoverStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { staffLabel } from '@/data/access/team-store'

/**
 * A resident's handover status. PRD §6.3.
 *
 * Four states, and the fourth is the point:
 *
 *   All Well          quiet — recorded, and somebody's name on it
 *   Needs Attention   amber, with what for
 *   Urgent            red, with what for
 *   Not Reviewed      hatched — nobody looked
 *
 * **All Well is not a pill.** Rule 3b: recorded and unremarkable renders
 * quietly, or it competes with the hatch for the reader's eye on the one
 * screen whose whole job is finding the residents nobody looked at. A filled
 * green pill on twenty rows is twenty things shouting "nothing to do here".
 * Quiet is not hidden — the author and the timestamp are on the row exactly as
 * they were, always visible, never hover-only.
 *
 * "A resident nobody looked at is not All Well." Without a fourth state, the
 * pressure at 19:58 with four residents left is to mark them all well and go
 * home, and nothing downstream can tell that from four people who were
 * genuinely checked. The hatch is what makes running out of time say so.
 */
export function HandoverStatusBadge({ status }: { status: HandoverStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_reviewed':
      // Stacked, sentence case, label leading. The inline form ran as a long
      // uppercase ribbon across half the row, which gave the quietest fact on
      // the screen the most width and made the shape of the shift unreadable.
      return (
        // Label only. The detail line said "nobody has looked at this resident
        // this handover" on every hatched row, which is what "Not reviewed"
        // already says — six identical sentences between the reader and six
        // rows they are trying to rank. What differs row to row is the
        // silence beneath, and `LastNoteLine` carries that.
        <Unrecorded variant="chip" label="Not reviewed" />
      )

    case 'all_well':
      return (
        <Settled
          label="All well"
          detail={format.attribution(staffLabel(status.recordedBy), status.recordedAt)}
        />
      )

    case 'needs_attention':
      return (
        <StatusPill
          tone="caution"
          label="Needs attention"
          detail={format.attribution(staffLabel(status.recordedBy), status.recordedAt)}
        />
      )

    case 'urgent':
      return (
        <StatusPill
          tone="critical"
          label="Urgent"
          detail={format.attribution(staffLabel(status.recordedBy), status.recordedAt)}
        />
      )

    default:
      return assertNever(status)
  }
}
