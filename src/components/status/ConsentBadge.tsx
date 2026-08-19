import type { ConsentMethod, ConsentStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * Consent. PRD §5.1, §2.1.
 *
 * "Pending, Refused, Withdrawn, and Lacks Capacity — Best Interest are
 * legally distinct outcomes. None of them is a blank."
 *
 * Six outcomes, every one of them carrying its author, because refusal,
 * withdrawal and best-interest decisions are the most legally consequential
 * records in the set (PRD §3.6).
 *
 * Best interest uses the brand tone for the same reason DNAR does: it is a
 * formal decision under the Mental Capacity Act, not good news or bad news,
 * and a RAG colour would editorialise it.
 */

const METHOD: Record<ConsentMethod, string> = {
  verbal: 'verbal',
  written: 'written',
  digital_signature: 'digital signature',
}

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  switch (status.kind) {
    case 'not_sought':
      return <Unrecorded label="Consent not sought" />

    case 'pending':
      return (
        <StatusPill
          tone="info"
          label="Pending"
          detail={`requested ${formatDate(status.requestedOn)} by ${status.requestedBy.displayName}`}
        />
      )

    case 'consented':
      return (
        <StatusPill
          tone="positive"
          label="Consented"
          detail={`${METHOD[status.method]} · ${formatDate(status.on)} · ${status.by.displayName}`}
        />
      )

    case 'refused':
      return (
        <StatusPill
          tone="caution"
          label="Refused"
          detail={`${formatDate(status.on)} · ${status.recordedBy.displayName} · ${status.note}`}
        />
      )

    case 'withdrawn':
      return (
        <StatusPill
          tone="caution"
          label="Withdrawn"
          detail={`${formatDate(status.on)} · previously consented ${formatDate(
            status.previouslyConsentedOn,
          )} · ${status.recordedBy.displayName} · ${status.note}`}
        />
      )

    case 'best_interest':
      return (
        <StatusPill
          tone="brand"
          label="Best interest decision"
          detail={`${formatDate(status.decidedOn)} · ${status.decidedBy.displayName} · consulted ${status.consulted.join(
            ', ',
          )} · ${status.rationale}`}
        />
      )

    default:
      return assertNever(status)
  }
}
