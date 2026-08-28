import type {
  IsoDateTime,
  MarWitness,
  Medication,
  RegisterMovement,
  StaffRef,
  StockBalance,
  StockCount,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'

/**
 * The controlled drug register, assembled before anything renders it.
 *
 * Pure, and every figure passed in, so a test asserts the arithmetic rather
 * than the hour the suite runs (CLAUDE.md §8).
 *
 * **The running balance is the point.** A register is not a list of counts; it
 * is a total that runs, and it only runs if everything that moves the stock is
 * on it — doses given, deliveries in, disposals out, and the counts that check
 * the total against the cabinet. Two counts three weeks apart with nothing
 * between them assert that nothing happened, which is absence-from-a-list on
 * the one screen whose entire purpose is the total.
 */

/**
 * One line of the register.
 *
 * A closed union, because the five things that can appear on a register are
 * not variations of a row with optional fields: a count *sets* the balance and
 * an administration *moves* it, and a screen that forgot which is which would
 * show a count as a change of stock.
 */
export type RegisterEntry =
  | {
      kind: 'opening_count'
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
      counted: number
      balanceAfter: number
    }
  | {
      kind: 'routine_count'
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
      expected: number
      counted: number
      balanceAfter: number
      /** False is the finding this screen exists for. */
      reconciles: boolean
    }
  | {
      kind: 'administered'
      at: IsoDateTime
      by: StaffRef
      /**
       * The second signature, or the fact that it is missing.
       *
       * A controlled drug given without a witness is half a record, and the
       * register is where that shows. Never a blank, and never the giver's
       * name doubled up to fill the column.
       */
      witness: MarWitness
      quantity: number
      balanceAfter: number
    }
  | {
      kind: 'received'
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
      quantity: number
      from: string
      balanceAfter: number
    }
  | {
      kind: 'disposed'
      at: IsoDateTime
      by: StaffRef
      witnessedBy: StaffRef
      quantity: number
      reason: string
      balanceAfter: number
    }

/**
 * What the register says about one drug, as a closed union.
 *
 * **Never counted and does-not-reconcile are different findings**, and keeping
 * them apart is what the register is for. An absence is not a small
 * discrepancy: with no opening balance there is nothing for a count to
 * reconcile against, so the drug is not failing a check — it has never been
 * checked.
 */
export type RegisterState =
  | { kind: 'never_counted' }
  | { kind: 'discrepancy'; at: IsoDateTime; expected: number; counted: number }
  | { kind: 'reconciled'; at: IsoDateTime }

/** Two decimal places. A balance in millilitres must not drift on floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const byTime = (a: { at: IsoDateTime }, b: { at: IsoDateTime }) =>
  a.at.localeCompare(b.at)

/**
 * Every entry for one drug, newest first, each carrying the balance it left
 * behind.
 *
 * Built oldest-first because that is the only direction the arithmetic runs,
 * then reversed — a register is read newest-first and computed oldest-first,
 * and conflating the two is how a balance column stops adding up.
 */
export function buildRegister(
  medication: Medication,
  counts: StockCount[],
  movements: RegisterMovement[],
  records: MarRecord[],
): RegisterEntry[] {
  type Pending =
    | { at: IsoDateTime; sort: 0; count: StockCount }
    | { at: IsoDateTime; sort: 1; movement: RegisterMovement }
    | { at: IsoDateTime; sort: 1; given: { by: StaffRef; witness: MarWitness } }

  const pending: Pending[] = []

  for (const count of counts) {
    if (count.medicationId !== medication.id) continue
    pending.push({ at: count.countedAt, sort: 0, count })
  }
  for (const movement of movements) {
    if (movement.medicationId !== medication.id) continue
    pending.push({ at: movement.at, sort: 1, movement })
  }
  for (const record of records) {
    if (record.medicationId !== medication.id) continue
    if (record.state.kind !== 'given') continue
    pending.push({
      at: record.state.givenAt,
      sort: 1,
      given: { by: record.state.givenBy, witness: record.state.witness },
    })
  }

  pending.sort((a, b) => byTime(a, b) || a.sort - b.sort)

  // Nothing before the opening count belongs on the register: the balance did
  // not exist yet, so no entry can say what it left behind.
  const opening = pending.findIndex(
    (item) => 'count' in item && item.count.entry.kind === 'opening',
  )
  if (opening === -1) return []

  const entries: RegisterEntry[] = []
  let balance = 0

  for (const item of pending.slice(opening)) {
    if ('count' in item) {
      const { count } = item
      // A count does not change the stock; it says what the stock actually is.
      // Where that differs from the running total, the count wins and the
      // difference is the finding.
      balance = count.counted
      entries.push(
        count.entry.kind === 'opening'
          ? {
              kind: 'opening_count',
              at: count.countedAt,
              by: count.countedBy,
              witnessedBy: count.witnessedBy,
              counted: count.counted,
              balanceAfter: round2(balance),
            }
          : {
              kind: 'routine_count',
              at: count.countedAt,
              by: count.countedBy,
              witnessedBy: count.witnessedBy,
              expected: count.entry.expected,
              counted: count.counted,
              balanceAfter: round2(balance),
              reconciles: count.entry.expected === count.counted,
            },
      )
      continue
    }

    if ('movement' in item) {
      const { movement } = item
      balance += movement.kind === 'received' ? movement.quantity : -movement.quantity
      entries.push(
        movement.kind === 'received'
          ? {
              kind: 'received',
              at: movement.at,
              by: movement.by,
              witnessedBy: movement.witnessedBy,
              quantity: movement.quantity,
              from: movement.from,
              balanceAfter: round2(balance),
            }
          : {
              kind: 'disposed',
              at: movement.at,
              by: movement.by,
              witnessedBy: movement.witnessedBy,
              quantity: movement.quantity,
              reason: movement.reason,
              balanceAfter: round2(balance),
            },
      )
      continue
    }

    balance -= medication.doseQuantity
    entries.push({
      kind: 'administered',
      at: item.at,
      by: item.given.by,
      witness: item.given.witness,
      quantity: medication.doseQuantity,
      balanceAfter: round2(balance),
    })
  }

  return entries.reverse()
}

/**
 * What the list row says about this drug.
 *
 * Derived from the counts, not from the running balance: a discrepancy is a
 * count that did not come out, which is a thing somebody found, not a thing
 * the software worked out.
 */
export function registerState(counts: StockCount[]): RegisterState {
  const ordered = [...counts].sort((a, b) => a.countedAt.localeCompare(b.countedAt))
  const last = ordered[ordered.length - 1]
  if (!last) return { kind: 'never_counted' }

  const failed = ordered.filter(
    (count) => count.entry.kind === 'routine' && count.entry.expected !== count.counted,
  )
  const worst = failed[failed.length - 1]
  if (worst && worst.entry.kind === 'routine') {
    return {
      kind: 'discrepancy',
      at: worst.countedAt,
      expected: worst.entry.expected,
      counted: worst.counted,
    }
  }

  return { kind: 'reconciled', at: last.countedAt }
}

/** The balance the register carries, or the fact that nobody has counted it. */
export function registerBalance(counts: StockCount[]): StockBalance {
  const ordered = [...counts].sort((a, b) => a.countedAt.localeCompare(b.countedAt))
  const last = ordered[ordered.length - 1]
  if (!last) return { kind: 'no_balance_recorded' }
  return {
    kind: 'counted',
    value: last.counted,
    countedAt: last.countedAt,
    countedBy: last.countedBy,
  }
}

/**
 * Findings first, then by drug.
 *
 * A discrepancy is an open finding and a never-counted drug is an open gap;
 * both are things somebody has to act on, and a register sorted by name buries
 * them among the drugs that are fine.
 */
export function registerOrder(state: RegisterState): number {
  switch (state.kind) {
    case 'discrepancy':
      return 0
    case 'never_counted':
      return 1
    case 'reconciled':
      return 2
  }
}
