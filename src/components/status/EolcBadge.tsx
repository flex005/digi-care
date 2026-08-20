import type { EolcStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * End of life care.
 *
 * **A deliberate departure from source PRD §16.3**, which specifies grey.
 * Grey is reserved system-wide for unrecorded, so a *recorded* EOLC decision
 * rendered grey would read as "nobody has looked" — Rule 2 failing in the one
 * place it must not. `--status-info` instead: a recorded, factual, neutral
 * clinical state, distinct in hue from DNAR's brand purple and ISOLATION's
 * amber. Recorded in PROGRESS.md so the source PRD can be corrected.
 *
 * Hue is where that distinctness stops: in greyscale these three tints are
 * close, and it is the LABELS that tell them apart. That is acceptable —
 * PRD §7 requires colour never be the sole carrier, and the words carry it —
 * but this comment used to claim they "cannot be confused at a glance", which
 * overstated what colour alone does.
 *
 * `not_applicable` is a recorded decision — a manager looked and concluded
 * EOLC does not apply — and is not the same as nobody having looked.
 */
export function EolcBadge({ status }: { status: EolcStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_recorded':
      return <Unrecorded label="EOLC not recorded" />

    case 'not_applicable':
      return (
        <StatusPill
          tone="positive"
          label="EOLC not applicable"
          detail={format.attribution(
            status.recordedBy.displayName,
            status.recordedAt,
            status.recordedBy.isActive,
          )}
        />
      )

    case 'in_place':
      return (
        <StatusPill
          tone="info"
          label="EOLC in place"
          detail={`since ${formatDate(status.startedOn)} · ${status.recordedBy.displayName}`}
        />
      )

    default:
      return assertNever(status)
  }
}
