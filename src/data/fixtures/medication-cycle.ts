import type { IsoDate, MedicationId, ResidentId, StaffRef } from '../types'
import { daysAgo, toIsoDate } from './generate'
import { medications } from './medications'
import { residents } from './residents'

/**
 * The monthly cycle a pharmacy sends, and what the home holds. PRD §6.4.
 *
 * **Nothing here creates a prescription.** Every row is a change a prescriber
 * has already made; the home is recording that it received it. A screen that
 * let a care home invent a prescription would be the most dangerous thing in
 * the product, and this one cannot: each row names the prescriber who made the
 * change and the date they made it.
 *
 * **The fourth finding is not in the cycle at all.** A drug the home is still
 * giving that the pharmacy has stopped supplying appears on neither side's
 * list: the cycle does not mention it and the MAR chart looks normal. It can
 * only be seen by comparing the two, which is why this screen is a comparison
 * rather than a list, and why that tally takes the hatch.
 */
export type CycleChangeKind = 'new' | 'changed' | 'stopped'

export interface CycleRow {
  id: string
  medicationId: MedicationId | 'not_on_mar'
  residentId: ResidentId
  drug: string
  form: string
  kind: CycleChangeKind
  /** Who made the change and when. Never the home. */
  prescriber: string
  changedOn: IsoDate
  /** What it was, and what it now is, on one line. */
  was: string
  now: string
}

export interface MedicationCycle {
  id: string
  pharmacy: string
  receivedOn: IsoDate
  coversFrom: IsoDate
  coversTo: IsoDate
  rows: CycleRow[]
}

const RESIDENT = (index: number): ResidentId => residents[index % residents.length]!.id

const medicationFor = (residentId: ResidentId): MedicationId | 'not_on_mar' =>
  medications.find((one) => one.residentId === residentId)?.id ?? 'not_on_mar'

/**
 * One cycle, received four days ago.
 *
 * Deliberately small and readable. The point of this screen is that each row
 * is read and accepted on its own, so a fixture of ninety rows would be
 * testing scrolling rather than the rule.
 */
export const cycle: MedicationCycle = {
  id: 'cycle-september',
  pharmacy: 'Ashworth Pharmacy',
  receivedOn: toIsoDate(daysAgo(4)),
  coversFrom: toIsoDate(daysAgo(-4)),
  coversTo: toIsoDate(daysAgo(-34)),
  rows: [
    {
      id: 'cycle-1',
      residentId: RESIDENT(0),
      medicationId: medicationFor(RESIDENT(0)),
      drug: 'Amlodipine',
      form: '5mg · tablets · oral',
      kind: 'changed',
      prescriber: 'Dr P. Ramanathan',
      changedOn: toIsoDate(daysAgo(6)),
      was: '5mg once daily',
      now: '10mg once daily',
    },
    {
      id: 'cycle-2',
      residentId: RESIDENT(1),
      medicationId: 'not_on_mar',
      drug: 'Sertraline',
      form: '50mg · tablets · oral',
      kind: 'new',
      prescriber: 'Dr H. Whitfield',
      changedOn: toIsoDate(daysAgo(5)),
      was: 'Not currently on the MAR chart',
      now: '50mg each morning',
    },
    {
      id: 'cycle-3',
      residentId: RESIDENT(2),
      medicationId: medicationFor(RESIDENT(2)),
      drug: 'Furosemide',
      form: '20mg · tablets · oral',
      kind: 'stopped',
      prescriber: 'Dr P. Ramanathan',
      changedOn: toIsoDate(daysAgo(8)),
      was: 'On the MAR at 08:00 and 12:00',
      now: 'No longer supplied',
    },
    {
      id: 'cycle-4',
      residentId: RESIDENT(3),
      medicationId: 'not_on_mar',
      drug: 'Atorvastatin',
      form: '20mg · tablets · oral',
      kind: 'new',
      prescriber: 'Dr H. Whitfield',
      changedOn: toIsoDate(daysAgo(5)),
      was: 'Not currently on the MAR chart',
      now: '20mg at night',
    },
    {
      id: 'cycle-5',
      residentId: RESIDENT(4),
      medicationId: medicationFor(RESIDENT(4)),
      drug: 'Metformin',
      form: '500mg · tablets · oral',
      kind: 'changed',
      prescriber: 'Dr A. Sundaram',
      changedOn: toIsoDate(daysAgo(7)),
      was: '500mg twice daily',
      now: '500mg three times daily',
    },
  ],
}

/**
 * What the home is giving that this cycle does not mention.
 *
 * **Derived by comparison, never listed.** A hand-written list of drugs the
 * pharmacy has dropped would be a second copy of the same fact, and the two
 * would disagree the first time a row was added to the cycle. This asks the
 * only question that finds it: which drugs on the MAR chart appear nowhere in
 * what arrived?
 */
export interface CycleGap {
  medicationId: MedicationId
  residentId: ResidentId
  drug: string
  form: string
  rounds: string
}

export function gapsAgainst(
  cycleRows: CycleRow[],
  residentIds: ResidentId[],
): CycleGap[] {
  const named = new Set(
    cycleRows.map((row) => `${row.residentId}|${row.drug.toLowerCase()}`),
  )
  const wanted = new Set(residentIds)

  return medications
    .filter((one) => wanted.has(one.residentId) && !one.isPrn)
    .filter((one) => !named.has(`${one.residentId}|${one.name.toLowerCase()}`))
    .slice(0, 2)
    .map((one) => ({
      medicationId: one.id,
      residentId: one.residentId,
      drug: one.name,
      /*
       * `form` already reads "10mg/5ml · oral solution": it is form *and*
       * strength, as the register lists it. Putting the dose in front of it
       * produced "30mg · 30mg · capsules" — the seventh time a value has been
       * rendered by whoever happened to be appending it.
       */
      form: one.form,
      rounds: one.roundTimes.join(' and '),
    }))
}

export const CYCLE_STAFF_NOTE =
  'Every row names the prescriber who made the change. The home records receiving it; nothing here prescribes.'

export type { StaffRef }
