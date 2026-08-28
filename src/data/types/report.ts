import type { InsufficientAggregate, MeasuredAggregate } from './compliance'
import type { IsoDate } from './primitives'

/**
 * Reports — PRD §6.7, Phase 13.
 *
 * **A report answers something a queue and a panel cannot**: a figure over a
 * period, cut by something other than resident. A queue is a worklist ordered
 * by urgency; a panel is coverage over the whole record. Neither has ever
 * carried a period, and nothing in the build before this could compare one
 * with the one before it.
 *
 * **No ratings live here.** Figures and coverage on a report, judgement on the
 * compliance panel — a green rating on a report would reintroduce exactly the
 * reassurance the Dashboard refuses.
 */

export interface Period {
  from: IsoDate
  /** Inclusive. The last day the period covers, not the day after it. */
  to: IsoDate
  days: number
}

/**
 * Whether a report is about a flow or a state.
 *
 * **Two of the eight are states of the record rather than events in a
 * period**, and period comparison is meaningless for them: consent coverage
 * today against consent coverage a month ago compares one snapshot with a
 * snapshot nothing recorded. Saying so is better than offering a control that
 * produces a number nobody can interpret.
 */
export type ReportDimension = 'flow' | 'state'

/**
 * How a figure moved against the period before it.
 *
 * `no_comparison` is a real member rather than a zero: a row with too little
 * in the previous period has nothing to compare against, and rendering "0%
 * change" would state a stability nobody measured.
 *
 * **`was` is already formatted**, by whichever helper decided the direction.
 * A rate row's previous value is a percentage and a count row's is a count,
 * and letting the cell decide which to print would be a formatting rule with
 * no owner — the shape §6 names. The direction and the words come from one
 * place or they disagree.
 */
export type Change =
  | { kind: 'no_comparison' }
  | { kind: 'better'; was: string }
  | { kind: 'worse'; was: string }
  | { kind: 'unchanged'; was: string }

/**
 * One cell.
 *
 * `insufficient` is the point of the type: a row below the population floor
 * keeps its counts and loses only its rate, so the table still shows what is
 * there while refusing to state a rate it cannot support.
 */
export type ReportCell =
  | { kind: 'count'; value: number }
  | { kind: 'rate'; aggregate: MeasuredAggregate }
  | { kind: 'insufficient'; aggregate: InsufficientAggregate }
  | { kind: 'change'; change: Change }
  | { kind: 'text'; value: string }

export interface ReportColumn {
  label: string
  /** Right-aligned and tabular. Every figure column is one. */
  numeric: boolean
}

export interface ReportRow {
  id: string
  name: string
  /** The second line: a drug's form, a staff member's role, a place. */
  note: string
  /**
   * Below the population floor.
   *
   * **The row stays in the table**, hatched, with Insufficient Evidence where
   * its rate would be. Removing it would make the table look complete.
   */
  thin: boolean
  /** Records outlive access, so a deactivated author is shown and marked. */
  deactivated: boolean
  cells: ReportCell[]
}

/**
 * What the report says before anything else.
 *
 * Two members and no third. A finding names a gap; `too_thin` says the data
 * cannot support one — and the table still renders beneath either, because
 * refusing to render hides data somebody may still need.
 *
 * **There is no reassuring member.** A report has no way to say "this is
 * fine", by design.
 */
export type ReportFinding =
  | { kind: 'finding'; figure: string; title: string; detail: string }
  | { kind: 'too_thin'; figure: string; title: string; detail: string }

export interface ReportResult {
  finding: ReportFinding
  /** Every figure below, restated in terms of period, cut and population. */
  restated: string
  columns: ReportColumn[]
  rows: ReportRow[]
  /** What a real export would contain. There is no control to produce it. */
  exportWouldContain: string
}
