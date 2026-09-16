import type { AnyConsent, ConsentMethod } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'
import styles from './Settled.module.css'

/**
 * What was decided about one consent. PRD §6.7, §2.1.
 *
 * **This badge answers one of two questions.** Who decided it is a separate
 * fact with a separate treatment — see `ConsentAuthority` — because five of the
 * old union's six members said what was decided and one said who, and merging
 * them meant a best-interests decision that concluded *no* could not be
 * recorded at all.
 *
 * `not_sought` is the hatch. Never sought is not refusal and it is not
 * permission: care given without either is care given without consent.
 *
 * **Refused is not a failure treatment.** A resident refusing is them
 * exercising a right, and caution or critical would make the record disapprove
 * of them — the same reason a goal that was not achieved renders quietly.
 */
export function ConsentBadge({ status }: { status: AnyConsent }) {
  switch (status.kind) {
    case 'not_sought':
      return (
        <Unrecorded
          variant="chip"
          label="Never sought"
          detail="nobody has asked, and nobody has decided on their behalf"
        />
      )

    case 'pending':
      return (
        <StatusPill
          tone="info"
          label="Awaiting a decision"
          detail={`asked ${formatDate(status.requestedOn)} by ${status.requestedBy.displayName}`}
        />
      )

    case 'given':
      return (
        <StatusPill
          tone="positive"
          label="Given"
          detail={`${formatDate(status.on)} · ${METHOD[status.method]}`}
        />
      )

    case 'refused':
      // Plain, on a sunken surface. A record of a choice, not a finding.
      return (
        <span className={styles.settled} data-refused>
          Refused
          <small>
            {formatDate(status.on)}, {status.note}
          </small>
        </span>
      )

    case 'withdrawn':
      return (
        <StatusPill
          tone="caution"
          label="Withdrawn"
          detail={`${formatDate(status.on)} · given ${formatDate(status.previouslyGivenOn)}`}
        />
      )

    default:
      return assertNever(status)
  }
}

/**
 * How a consent was given, in words.
 *
 * **Keyed by the union, not by `string`.** It was `Record<string, string>`
 * with a `digital` key, and the value a record actually holds is
 * `digital_signature` — so every consent given by signature rendered
 * "undefined" beside its date, on a badge whose whole job is to say what was
 * decided and how. Nothing failed: a `Record<string, …>` accepts any key and
 * returns `undefined` for the ones it has not got, silently.
 *
 * Typed this way, a member the map does not cover is a compile error, and a
 * member renamed in `ConsentMethod` cannot leave a screen printing nothing.
 */
const METHOD: Record<ConsentMethod, string> = {
  verbal: 'verbal',
  written: 'written',
  digital_signature: 'digital signature',
}
