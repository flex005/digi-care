import { held, type SessionHolding } from './session-holding'
import type {
  CareNoteId,
  IsoDate,
  IsoDateTime,
  MarCellState,
  MedicationId,
  ResidentId,
  StaffRef,
  StockBalance,
  StockCount,
} from '../types'
import { marRecordsAll, stockCounts, type MarRecord } from '../fixtures/medications'

/**
 * Administrations recorded during this session. PRD §3.6, CLAUDE.md §6.
 *
 * Same discipline as `note-store.ts`: in memory, never touching the fixtures,
 * gone on reload. A prototype that remembers a medication record across
 * reloads invites somebody to treat it as a system of record, and this is the
 * one module where that would be dangerous rather than merely wrong.
 *
 * **An overlay, not an edit.** Keyed by (medication, date, round), patched on
 * read. The fixtures stay exactly as they are, so `fixtures.test.ts` keeps
 * testing the fixtures rather than whatever the last round did.
 */

const key = (medicationId: MedicationId, date: IsoDate, roundTime: string) =>
  `${medicationId}|${date}|${roundTime}`

const administrations = new Map<string, MarCellState>()

/**
 * A PRN dose given this session.
 *
 * Its own list rather than a MAR cell, because a PRN dose is not a round: it
 * has no due time, so there is no cell for it to occupy and no omission it
 * could ever be. Recording one against a round's grid would invent a dose that
 * was due.
 */
export interface PrnAdministration {
  id: string
  residentId: ResidentId
  medicationId: MedicationId
  reason: string
  symptom: string
  givenBy: StaffRef
  givenAt: IsoDateTime
  /**
   * What happened afterwards, and **`'not_recorded'` until somebody says.**
   *
   * PRD §6.4 requires an outcome. A PRN given with no outcome is a dose
   * nobody checked the effect of, which is a real gap and has to look like
   * one — not an empty string, and not an assumption that it worked.
   */
  outcome:
    { kind: 'not_recorded' } | { kind: 'recorded'; text: string; at: IsoDateTime }
  /** Reserved for the linked care note a later phase writes. */
  note: CareNoteId | 'none'
}

const prnGiven: PrnAdministration[] = []
let prnSequence = 0

/** Applies anything recorded against this cell during the session. */
function patch(record: MarRecord): MarRecord {
  const recorded = administrations.get(
    key(record.medicationId, record.date, record.roundTime),
  )
  return recorded === undefined ? record : { ...record, state: recorded }
}

/** Every MAR record, with this session's administrations applied. */
export function patchedRecords(): MarRecord[] {
  return marRecordsAll.map(patch)
}

export function recordAdministration(
  medicationId: MedicationId,
  date: IsoDate,
  roundTime: string,
  state: MarCellState,
): void {
  administrations.set(key(medicationId, date, roundTime), state)
}

export function appendPrn(entry: Omit<PrnAdministration, 'id'>): PrnAdministration {
  prnSequence += 1
  const stored: PrnAdministration = { ...entry, id: `prn-session-${prnSequence}` }
  prnGiven.push(stored)
  return stored
}

export function prnFor(residentId: ResidentId): PrnAdministration[] {
  return prnGiven.filter((entry) => entry.residentId === residentId)
}

export function recordPrnOutcome(id: string, text: string, at: IsoDateTime): boolean {
  const entry = prnGiven.find((item) => item.id === id)
  if (!entry) return false
  entry.outcome = { kind: 'recorded', text, at }
  return true
}

/**
 * Stock counts taken during this session, opening balances among them.
 *
 * Same overlay discipline as the administrations: appended here, never written
 * into the fixtures. A register that forgot an opening balance on reload would
 * put the drug back to having no balance, which is a different record from the
 * one somebody just signed.
 */
const sessionCounts: StockCount[] = []

export function appendStockCount(count: StockCount): void {
  sessionCounts.push(count)
}

/** Every stock count, fixtures and this session's, oldest first. */
export function patchedStockCounts(): StockCount[] {
  return [...stockCounts, ...sessionCounts].sort((a, b) =>
    a.countedAt.localeCompare(b.countedAt),
  )
}

/**
 * What a drug is standing at, with this session's counts applied.
 *
 * The app asks this, never the fixtures' own `balanceOf` — an opening balance
 * recorded a minute ago has to be the balance the next dose reconciles
 * against, or the second dose of the round would ask for another opening count.
 */
export function balanceWithSession(medicationId: MedicationId): StockBalance {
  const counts = patchedStockCounts().filter(
    (count) => count.medicationId === medicationId,
  )
  const last = counts[counts.length - 1]
  if (!last) return { kind: 'no_balance_recorded' }
  return {
    kind: 'counted',
    value: last.counted,
    countedAt: last.countedAt,
    countedBy: last.countedBy,
  }
}

/**
 * What this store would lose.
 *
 * Doses, PRN doses and stock counts are counted apart because they are three
 * different acts: a scheduled dose signed for, a decision to give something as
 * required, and a controlled drug balance somebody counted by hand.
 */
export function marHoldings(): SessionHolding[] {
  return [
    ...held('doses you signed for', administrations.size),
    ...held('as-required doses you recorded', prnGiven.length),
    ...held('controlled drug counts you made', sessionCounts.length),
  ]
}

/** Emptied on sign out, and by tests. */
export function resetSessionAdministrations(): void {
  administrations.clear()
  prnGiven.length = 0
  prnSequence = 0
  sessionCounts.length = 0
}
