import type {
  IsoDate,
  IsoDateTime,
  MarCellState,
  Medication,
  NotGivenReason,
  Resident,
  StaffRef,
  StockBalance,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'

/**
 * A medication round, worked out before anything renders it.
 *
 * Pure, and every instant is passed in, so the round a test asserts on is the
 * round a nurse sees and neither depends on the hour the suite runs
 * (CLAUDE.md §8).
 *
 * **Room order, not alphabetical and not drug by drug.** The trolley goes down
 * a corridor, and a list in any other order makes somebody walk it twice or
 * skip a door. A resident whose room is unrecorded sorts last rather than
 * being dropped — absent from the list is the same bug as a blank cell.
 */

/** A dose scheduled at this round. */
export interface RoundDose {
  medication: Medication
  record: MarRecord
  state: MarCellState
}

export interface RoundResident {
  resident: Resident
  /** Doses due at this round, in the order they are prescribed. */
  due: RoundDose[]
  /**
   * PRN medications this resident has, available if needed.
   *
   * **Never in `due`.** A scheduled dose is due at 08:00; paracetamol is not
   * due at all, it is available. Putting it in the due list would make not
   * giving it read as an omission, which is a claim that somebody missed a
   * dose nobody was ever supposed to give.
   */
  available: Medication[]
  /** Every due dose has been answered — given, or not given with a reason. */
  done: boolean
}

export interface RoundSlot {
  roundTime: string
  /** How many residents have every due dose answered, out of how many have any. */
  done: number
  total: number
}

export interface Round {
  roundTime: string
  date: IsoDate
  residents: RoundResident[]
  slots: RoundSlot[]
}

/** Answered means somebody recorded a decision. Due and omitted are not. */
export function isAnswered(state: MarCellState): boolean {
  return state.kind === 'given' || state.kind === 'not_given'
}

/**
 * Which round a nurse arriving now is standing in front of.
 *
 * The one most recently opened, not the nearest: at 09:30 the 08:00 round is
 * the one being caught up on, and jumping ahead to 14:00 would hide it. Before
 * the first round of the day, the first round.
 */
export function currentRound(rounds: string[], nowHhMm: string): string {
  const sorted = [...rounds].sort()
  let current = sorted[0] ?? '08:00'
  for (const round of sorted) {
    if (round <= nowHhMm) current = round
  }
  return current
}

/** Room numbers sort as numbers where they are numbers. Unrecorded goes last. */
function roomOrder(resident: Resident): [number, string] {
  if (resident.room.kind !== 'recorded') return [Number.MAX_SAFE_INTEGER, '']
  const value = resident.room.value
  const digits = Number.parseInt(value, 10)
  return [Number.isNaN(digits) ? Number.MAX_SAFE_INTEGER : digits, value]
}

export function buildRound(
  residents: Resident[],
  medications: Medication[],
  records: MarRecord[],
  roundTime: string,
  date: IsoDate,
): Round {
  const medsFor = new Map<string, Medication[]>()
  for (const medication of medications) {
    const list = medsFor.get(medication.residentId) ?? []
    list.push(medication)
    medsFor.set(medication.residentId, list)
  }

  const cell = new Map<string, MarRecord>()
  for (const record of records) {
    cell.set(`${record.medicationId}|${record.date}|${record.roundTime}`, record)
  }

  const forRound = (round: string) =>
    residents
      .map((resident) => {
        const all = medsFor.get(resident.id) ?? []
        const due: RoundDose[] = []
        const available: Medication[] = []

        for (const medication of all) {
          if (medication.isPrn) {
            available.push(medication)
            continue
          }
          if (!medication.roundTimes.includes(round)) continue
          const record = cell.get(`${medication.id}|${date}|${round}`)
          if (!record) continue
          // A drug that runs every third day has a cell on the other two, and
          // that cell says `not_due`. It is not a dose waiting for an answer,
          // and asking for one would put a fentanyl patch on the trolley two
          // days out of three.
          if (record.state.kind === 'not_due') continue
          due.push({ medication, record, state: record.state })
        }

        return {
          resident,
          due,
          available,
          done: due.length > 0 && due.every((dose) => isAnswered(dose.state)),
        }
      })
      .filter((entry) => entry.due.length > 0)

  const residentsHere = forRound(roundTime).sort((a, b) => {
    const [an, av] = roomOrder(a.resident)
    const [bn, bv] = roomOrder(b.resident)
    return an === bn ? av.localeCompare(bv) : an - bn
  })

  const slots = [...new Set(medications.flatMap((m) => m.roundTimes))]
    .sort()
    .map((round) => {
      const at = forRound(round)
      return {
        roundTime: round,
        done: at.filter((entry) => entry.done).length,
        total: at.length,
      }
    })

  return { roundTime, date, residents: residentsHere, slots }
}

/**
 * How much of this resident's round is already on the record.
 *
 * Derived, never asserted. The queue said "nothing recorded yet" from a
 * hardcoded string, which was false for every resident who had two doses
 * signed and one omitted — the commonest shape there is, and the one the
 * screen exists to surface (CLAUDE.md §8: an assertion written from the same
 * string as the code confirms the bug).
 */
export function progressOf(entry: RoundResident): {
  answered: number
  total: number
} {
  return {
    answered: entry.due.filter((dose) => isAnswered(dose.state)).length,
    total: entry.due.length,
  }
}

/**
 * What the register should read after one dose.
 *
 * `balance - doseQuantity`, not `balance - 1`. A dose of morphine oral
 * solution takes 1.25ml off a balance counted in millilitres; subtracting one
 * would have demanded a count that is 0.25ml wrong and refused the correct
 * one. It only became expressible once the drug carried its dose as a number
 * rather than as the string '2.5mg'.
 */
export function expectedAfter(balance: StockBalance, medication: Medication): number {
  if (balance.kind !== 'counted') return Number.NaN
  return Math.round((balance.value - medication.doseQuantity) * 100) / 100
}

/** What the footer is still waiting on, named item by item. */
export interface Answer {
  choice: 'given' | 'not_given' | undefined
  /** One of `NotGivenReason`, never prose. Empty until chosen. */
  reason: NotGivenReason | ''
  /** Free text, and required only where the reason is "other". */
  note: string
  /** A staff id. Empty until chosen. */
  witness: string
  stockAfter: string
  /**
   * What is physically in the cabinet, where the register has no balance yet.
   *
   * Asked instead of `stockAfter`, not as well as it. The nurse counts the
   * cabinet once, that count becomes the opening balance, and the figure after
   * the dose is arithmetic — asking for both would be asking somebody to count
   * the same cabinet twice and then checking their subtraction.
   */
  openingCount: string
}

export const EMPTY_ANSWER: Answer = {
  choice: undefined,
  reason: '',
  note: '',
  witness: '',
  stockAfter: '',
  openingCount: '',
}

/**
 * Everything standing between this resident's doses and a signature.
 *
 * Named individually rather than counted. "3 doses need attention" makes
 * somebody hunt; "Oramorph — no witness" tells them where to look, and this
 * is a screen used standing up with a trolley.
 */
export function outstanding(
  due: RoundDose[],
  answers: Record<string, Answer>,
  balance: (medicationId: string) => StockBalance,
): string[] {
  const waiting: string[] = []

  for (const dose of due) {
    // A dose somebody has already signed for is not outstanding, and asking
    // for it again would invite a second signature over the first.
    if (isAnswered(dose.state)) continue

    const answer = answers[dose.medication.id] ?? EMPTY_ANSWER
    const name = dose.medication.name

    if (answer.choice === undefined) {
      waiting.push(`${name}: nothing recorded`)
      continue
    }
    if (answer.choice === 'not_given') {
      if (answer.reason === '') {
        waiting.push(`${name}: no reason`)
        continue
      }
      // "Other" is the only reason that means nothing on its own.
      if (answer.reason === 'other' && answer.note.trim() === '') {
        waiting.push(`${name}: no reason given`)
        continue
      }
    }
    if (dose.medication.isControlledDrug && answer.choice === 'given') {
      const standing = balance(dose.medication.id)
      if (answer.witness.trim() === '') {
        waiting.push(`${name}: no witness`)
      } else if (standing.kind === 'no_balance_recorded') {
        // Nothing to reconcile against, so nothing is reconciled. What is
        // needed is a first count, and it is a record in its own right.
        if (answer.openingCount.trim() === '') waiting.push(`${name}: no opening count`)
      } else if (answer.stockAfter.trim() === '') {
        waiting.push(`${name}: no stock count`)
      }
      /*
       * **A count that does not reconcile no longer holds the round up.**
       *
       * It did, and that was the wrong trade: you do not withhold morphine
       * from somebody in pain because the cabinet arithmetic is wrong, and
       * blocking turned an accounting problem into a medication-record gap
       * with nobody's name on it — the worse of the two failures, and the one
       * this product exists to prevent.
       *
       * So the doses record with their signatures, the count records what was
       * actually counted, and the discrepancy raises an incident against the
       * count alone. Blocking stays only where there is no balance at all,
       * because there the opening count is what makes the record possible
       * rather than what delays it.
       */
    }
  }

  return waiting
}

/**
 * The five reasons a dose can be not given, as the union already names them.
 *
 * Mapped rather than stored as prose: `NotGivenReason` is closed so a screen
 * cannot invent a sixth, and "Other" is the one that carries free text — which
 * is why it is the only one where the note is required.
 */
export const NOT_GIVEN_REASONS: { value: NotGivenReason; label: string }[] = [
  { value: 'resident_refused', label: 'Resident refused' },
  { value: 'resident_asleep', label: 'Resident asleep' },
  { value: 'medication_unavailable', label: 'Medication unavailable' },
  { value: 'resident_in_hospital', label: 'Resident in hospital' },
  { value: 'other', label: 'Other: say why' },
]

/**
 * The opening balance this answer records, if it records one.
 *
 * Its own entry on the register, with two signatures and no expected figure,
 * so the running total shows where it started rather than appearing to have
 * always been there.
 */
export function openingCountFor(
  answer: Answer,
  balance: StockBalance,
): number | 'none' {
  if (balance.kind !== 'no_balance_recorded') return 'none'
  if (answer.choice !== 'given') return 'none'
  const counted = answer.openingCount.trim()
  if (counted === '') return 'none'
  return Number(counted)
}

/**
 * A count that does not match the register, or nothing if it does.
 *
 * Returned rather than blocked on: the round records, and this is what the
 * round raises alongside it.
 */
export function discrepancyIn(
  answer: Answer,
  medication: Medication,
  balance: StockBalance,
): { expected: number; counted: number } | 'none' {
  if (balance.kind !== 'counted') return 'none'
  if (answer.choice !== 'given') return 'none'
  if (!medication.isControlledDrug) return 'none'
  const counted = answer.stockAfter.trim()
  if (counted === '') return 'none'
  const expected = expectedAfter(balance, medication)
  return Number(counted) === expected ? 'none' : { expected, counted: Number(counted) }
}

/** The state a recorded answer becomes, or nothing if it is not yet an answer. */
export function stateFor(
  answer: Answer,
  medication: Medication,
  by: StaffRef,
  at: IsoDateTime,
  witness: StaffRef | undefined,
): MarCellState | undefined {
  if (answer.choice === 'given') {
    return {
      kind: 'given',
      givenAt: at,
      givenBy: by,
      // The union's whole purpose: on a controlled drug an absent witness must
      // never be mistaken for "no witness was needed".
      witness: medication.isControlledDrug
        ? witness
          ? { kind: 'witnessed', by: witness }
          : { kind: 'required_not_recorded' }
        : { kind: 'not_required' },
    }
  }

  if (answer.choice === 'not_given') {
    const reason = NOT_GIVEN_REASONS.find(
      (entry) => entry.value === answer.reason,
    )?.value
    if (reason === undefined) return undefined
    return {
      kind: 'not_given',
      reason,
      note: answer.note.trim(),
      recordedAt: at,
      recordedBy: by,
    }
  }

  return undefined
}
