import type {
  IsoDateTime,
  MarCellState,
  MarWitness,
  NotGivenReason,
} from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatTime } from '@/lib/format'
import type { TimeZone } from '@/lib/format'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'
import styles from './MarCell.module.css'

/**
 * One cell of the MAR chart. Five states, no nulls. PRD §2.1, §5.1, §6.4.
 *
 * The five, and why each looks the way it does:
 *
 *   not_due     Nothing is expected. Quiet, but still labelled — an unlabelled
 *               blank is the bug.
 *   due         The window is open and nobody has acted yet. Info blue: this
 *               is a call to action, not a failure.
 *   given       A complete record. Solid green, settled.
 *   not_given   ALSO a complete record — "resident refused, signed 08:04" is
 *               correct clinical practice. Solid amber, settled. Rule 3 says
 *               this must never look like a gap, because it is not one.
 *   omitted     The window closed with no record. This IS a gap, so it gets
 *               the hatch. PRD §4.5 is explicit: "An omission uses the hatch."
 *
 * The accessible name is a full sentence, exposed to screen readers via a
 * visually-hidden span while the visible cell stays compact. PRD §7.
 */

const NOT_GIVEN_REASON: Record<NotGivenReason, string> = {
  resident_refused: 'resident refused',
  resident_asleep: 'resident asleep',
  medication_unavailable: 'medication unavailable',
  resident_in_hospital: 'resident in hospital',
  other: 'other reason',
}

/** The second signature on a controlled drug, or its conspicuous absence. */
function witnessText(witness: MarWitness): { text: string; missing: boolean } {
  switch (witness.kind) {
    case 'not_required':
      return { text: '', missing: false }
    case 'witnessed':
      return { text: `witnessed by ${witness.by.displayName}`, missing: false }
    case 'required_not_recorded':
      // The distinction this union exists for: on a controlled drug an absent
      // witness must never be mistaken for "no witness was needed".
      return { text: 'second signature not recorded', missing: true }
    default:
      return assertNever(witness)
  }
}

/**
 * The full-sentence accessible name. PRD §6.4:
 * "08:00, 5 April, Amlodipine 5mg — given by C. Nwosu at 08:04".
 *
 * Exported so the Phase 3 MAR table can put it on the <td> directly.
 */
export function marCellDescription(
  state: MarCellState,
  context: string,
  timeZone: TimeZone,
): string {
  const at = (value: IsoDateTime) => formatTime(value, timeZone)
  switch (state.kind) {
    case 'not_due':
      return `${context} — not due.`
    case 'due':
      return `${context} — due, window open from ${at(state.windowOpensAt)} until ${at(state.windowClosesAt)}, no record yet.`
    case 'given': {
      const witness = witnessText(state.witness)
      return `${context} — given by ${state.givenBy.displayName} at ${at(state.givenAt)}${
        witness.text ? `, ${witness.text}` : ''
      }.`
    }
    case 'not_given':
      return `${context} — not given, ${NOT_GIVEN_REASON[state.reason]}, recorded by ${state.recordedBy.displayName} at ${at(state.recordedAt)}.${
        state.note ? ` Note: ${state.note}.` : ''
      }`
    case 'omitted':
      return `${context} — omitted. Due at ${at(state.dueAt)}, window closed with no record.${
        state.escalation.kind === 'escalated'
          ? ` Escalated at ${at(state.escalation.at)}.`
          : ' Not yet escalated.'
      }`
    default:
      return assertNever(state)
  }
}

export interface MarCellProps {
  state: MarCellState
  /** "08:00, 5 April, Amlodipine 5mg" — what this cell is about. */
  context: string
}

function CellBody({ state }: { state: MarCellState }) {
  const format = useSiteFormat()

  switch (state.kind) {
    case 'not_due':
      return (
        <span className={`${styles.cell} ${styles.notDue}`}>
          <span className={styles.label}>Not due</span>
        </span>
      )

    case 'due':
      return (
        <StatusPill
          block
          tone="info"
          label="Due"
          detail={`${format.time(state.windowOpensAt)}–${format.time(state.windowClosesAt)}`}
        />
      )

    case 'given': {
      const witness = witnessText(state.witness)
      // Two facts, two treatments. The administration IS recorded, so it keeps
      // the settled green pill. A required second signature that was never
      // captured is a hole in that record, so it gets the hatch — inside the
      // same cell. Rendering the whole thing green with the omission as small
      // print would make an incomplete controlled-drug record read as fine,
      // which is the exact failure Rule 3 exists to prevent.
      return (
        <>
          <StatusPill
            block
            tone="positive"
            label="Given"
            detail={`${format.time(state.givenAt)} · ${state.givenBy.displayName}${
              witness.missing || !witness.text ? '' : ` · ${witness.text}`
            }`}
          />
          {witness.missing ? (
            <Unrecorded label="Second signature not recorded" />
          ) : null}
        </>
      )
    }

    case 'not_given':
      // A settled record, not a gap. Rule 3.
      return (
        <StatusPill
          block
          tone="caution"
          label="Not given"
          detail={`${NOT_GIVEN_REASON[state.reason]} · ${state.recordedBy.displayName}, ${format.time(state.recordedAt)}`}
        />
      )

    case 'omitted':
      return (
        <Unrecorded
          variant="cell"
          label="Omitted"
          detail={
            state.escalation.kind === 'escalated'
              ? `due ${format.time(state.dueAt)} · escalated ${format.time(state.escalation.at)}`
              : `due ${format.time(state.dueAt)} · not yet escalated`
          }
        />
      )

    default:
      return assertNever(state)
  }
}

export function MarCell({ state, context }: MarCellProps) {
  const { timeZone } = useSiteFormat()

  return (
    <>
      <span aria-hidden="true">
        <CellBody state={state} />
      </span>
      <span className="visuallyHidden">
        {marCellDescription(state, context, timeZone)}
      </span>
    </>
  )
}
