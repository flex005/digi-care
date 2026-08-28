import type { IsoDate, MarCellState, Medication, MedicationId } from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'

/**
 * The shape of a MAR chart, worked out before anything renders it.
 *
 * Pure. No clock is read here, so the grid a test asserts on is the grid a
 * reader sees and neither depends on the hour the suite runs (CLAUDE.md §8).
 * Every state comes from a record; none is derived from "now".
 *
 * **A missing record is a rendered state, never a missing cell.** Every
 * (medication × day × round) intersection produces a cell. Where no record
 * exists the cell is `not_due`, because the alternative — omitting the `<td>` —
 * is the blank that §2.1 is about, and it would also break the table's column
 * associations for a screen reader.
 */

export type MarRange = 'week' | 'month'

export interface MarDay {
  date: IsoDate
  /** 'Mon' */
  weekday: string
  /** '17/08' */
  label: string
}

export interface MarCell {
  medicationId: MedicationId
  date: IsoDate
  roundTime: string
  state: MarCellState
}

export interface MarRow {
  medication: Medication
  cells: MarCell[]
  /**
   * Rule 4 on every row. `given`, `omitted` and `due` are counted out of the
   * rounds this medication was actually scheduled for in this range — never
   * out of the grid's cell count, most of which are `not_due` for this row and
   * would make every denominator the same wrong number.
   */
  scheduled: number
  given: number
  omitted: number
  due: number
}

export interface MarGrid {
  days: MarDay[]
  /** Every round time any medication in the set uses, sorted. */
  rounds: string[]
  rows: MarRow[]
  /** Doses with no record at all, over doses that were due. Rule 4. */
  omissions: { count: number; ofDue: number }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `2026-08-19` → a Date at UTC midnight. Date-only values are never zoned. */
function fromIsoDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`)
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate
}

/**
 * The days a range covers, ending on `anchor`'s week or month.
 *
 * Weeks run Monday to Sunday: a care home's week does, and a Sunday-first grid
 * splits a weekend across two screens.
 */
export function daysIn(anchor: IsoDate, range: MarRange): MarDay[] {
  const start = fromIsoDate(anchor)
  if (range === 'week') {
    // getUTCDay: 0 is Sunday. Monday-first means Sunday counts as day 7.
    const offset = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - offset)
  } else {
    start.setUTCDate(1)
  }

  const length =
    range === 'week'
      ? 7
      : new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
        ).getUTCDate()

  return Array.from({ length }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return {
      date: toIso(day),
      weekday: WEEKDAYS[day.getUTCDay()]!,
      label: `${String(day.getUTCDate()).padStart(2, '0')}/${String(
        day.getUTCMonth() + 1,
      ).padStart(2, '0')}`,
    }
  })
}

/** Builds the grid. Pure: every state comes from a record, none is derived. */
export function buildMarGrid(
  medications: Medication[],
  records: MarRecord[],
  days: MarDay[],
): MarGrid {
  const rounds = [
    ...new Set(medications.flatMap((medication) => medication.roundTimes)),
  ].sort()

  const byKey = new Map<string, MarRecord>()
  for (const record of records) {
    byKey.set(`${record.medicationId}|${record.date}|${record.roundTime}`, record)
  }

  const rows = medications.map((medication) => {
    const scheduledRounds = new Set(medication.roundTimes)
    let scheduled = 0
    let given = 0
    let omitted = 0
    let due = 0

    const cells = days.flatMap((day) =>
      rounds.map((roundTime): MarCell => {
        // Not on this medication's schedule: nothing is expected, and that is
        // the one genuinely empty cell in the grid.
        if (!scheduledRounds.has(roundTime)) {
          return {
            medicationId: medication.id,
            date: day.date,
            roundTime,
            state: { kind: 'not_due' },
          }
        }

        scheduled += 1
        const record = byKey.get(`${medication.id}|${day.date}|${roundTime}`)

        /**
         * No record at all for a scheduled round.
         *
         * This is a day outside the recorded window — page back far enough and
         * every day is one. It renders `not_due`, and that is deliberate: the
         * alternative is deriving an omission, and an omission is a claim that
         * a dose was due and nobody gave it. The product has no evidence of
         * that here. Deriving it would manufacture thousands of gaps out of
         * the absence of a record system, which is the Evidence Invariant
         * inverted — asserting an absence that is an artefact of the view
         * (Rule 3c).
         *
         * Within the recorded window every scheduled round has a record, and
         * `fixtures.test.ts` is what keeps that true.
         */
        const state: MarCellState = record?.state ?? { kind: 'not_due' }

        if (state.kind === 'given') given += 1
        if (state.kind === 'omitted') omitted += 1
        if (state.kind === 'due') due += 1

        return { medicationId: medication.id, date: day.date, roundTime, state }
      }),
    )

    return { medication, cells, scheduled, given, omitted, due }
  })

  return {
    days,
    rounds,
    rows,
    omissions: {
      count: rows.reduce((total, row) => total + row.omitted, 0),
      // Doses that were actually due in this range, which is what an omission
      // count is a fraction of. Not the grid's cell count.
      ofDue: rows.reduce((total, row) => total + row.scheduled, 0),
    },
  }
}
