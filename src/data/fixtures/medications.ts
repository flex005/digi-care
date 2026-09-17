/**
 * Medications, MAR records and controlled drug stock counts. PRD §5.2, §5.3.
 *
 * Phase 1 renders only "medication due in the next 2 hours" on the profile
 * header. The 90 days of MAR history is generated now because two of PRD
 * §5.3's ten deliberate gaps live in it — three omissions with distinct
 * escalation states, and a controlled drug stock discrepancy — and because
 * Phase 3 is the highest-consequence module in the build and should meet real
 * data rather than freshly-invented data.
 */

import type {
  IsoDate,
  IsoDateTime,
  MarCellState,
  Medication,
  DocumentId,
  MedicationId,
  RegisterMovement,
  ResidentId,
  StaffRef,
  StockBalance,
  StockCount,
} from '../types'
import { zonedDate, type TimeZone } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import {
  NOW,
  atTime,
  daysAgo,
  makeRandom,
  recordedBetween,
  toIsoDateTime,
} from './generate'
import { carersAndSeniors, sites, staffHalloran, staffNwosu } from './organisation'
import { residents } from './residents'

interface DrugTemplate {
  name: string
  dose: string
  doseQuantity: number
  stockUnit: string
  form: string
  route: string
  /** Omitted means every day. Only the patches are not. */
  intervalDays?: number
  roundTimes: [string, ...string[]]
  isControlledDrug: boolean
  isPrn: boolean
}

const DRUGS: DrugTemplate[] = [
  {
    name: 'Amlodipine',
    dose: '5mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '5mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Atorvastatin',
    dose: '20mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '20mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['20:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Levothyroxine',
    dose: '75 micrograms',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '75 micrograms · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Metformin',
    dose: '500mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '500mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '18:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Donepezil',
    dose: '10mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '10mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['20:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Furosemide',
    dose: '40mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '40mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Paracetamol',
    dose: '1g',
    doseQuantity: 2,
    stockUnit: 'tablets',
    form: '500mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: false,
    isPrn: true,
  },
  {
    name: 'Salbutamol inhaler',
    dose: '2 puffs',
    doseQuantity: 2,
    stockUnit: 'puffs',
    form: '100 micrograms/puff · inhaler',
    route: 'Inhaled',
    intervalDays: 1,
    roundTimes: ['08:00', '20:00'],
    isControlledDrug: false,
    isPrn: true,
  },
  {
    name: 'Lansoprazole',
    dose: '30mg',
    doseQuantity: 1,
    stockUnit: 'capsules',
    form: '30mg · capsules',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  /*
   * Controlled drugs, from here down.
   *
   * **Oral morphine stays the most common and stops being almost the only
   * one.** Sixteen of eighteen controlled drugs being one drug is the same
   * defect as sixteen drugs sharing one balance: the unit column cannot
   * visibly matter when almost every unit is `ml`, so the wrong figure it
   * exists to prevent is untestable.
   *
   * Oral morphine is the one in the shared pool, so it stays the commonest by
   * some way. The other three forms are assigned deliberately below rather
   * than pooled: dropped into the draw they landed on most of the home, and a
   * care home where nearly every resident is on a controlled drug is wrong on
   * the facts in the other direction.
   */
  {
    name: 'Morphine sulfate oral solution',
    dose: '2.5mg',
    doseQuantity: 1.25,
    stockUnit: 'ml',
    form: '10mg/5ml · oral solution',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  },
]

/**
 * A medication before its prescription is attached.
 *
 * The prescription fields are filled in one pass at the end, so a drug cannot
 * be pushed with half of one — and there is one place that decides what a
 * prescription looks like rather than six.
 */
type MedicationDraft = Omit<
  Medication,
  | 'maximumIn24Hours'
  | 'prescriber'
  | 'startedOn'
  | 'storage'
  | 'instructions'
  | 'prescriptionDocument'
>

const medicationList: MedicationDraft[] = []

for (const [index, resident] of residents.entries()) {
  const rng = makeRandom(0x3ed10000 + index * 65537)
  const count =
    resident.siteId === 'site-ashgrove-lodge' ? rng.int(1, 3) : rng.int(2, 5)
  for (const drug of rng.sample(DRUGS, count)) {
    medicationList.push({
      id: `med-${resident.id}-${drug.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` as MedicationId,
      residentId: resident.id,
      intervalDays: 1,
      ...drug,
    })
  }
}

/** Emmanuel Okafor is the source PRD's running example. He carries the
 *  medication gaps, so the MAR grid meets them from its first day. */
const OKAFOR = 'res-okafor' as ResidentId
const okaforAmlodipine = 'med-res-okafor-amlodipine' as MedicationId
/**
 * The controlled drug §5.3's medication gaps hang off. Exported so
 * `fixtures.test.ts` can assert the three specified omissions by identity
 * rather than by counting every omission in the set — the generator produces
 * others now, and a count would confuse "the specified gaps are intact" with
 * "no other dose was ever missed".
 */
export const OKAFOR_MORPHINE =
  'med-res-okafor-morphine-sulfate-oral-solution' as MedicationId
const okaforMorphine = OKAFOR_MORPHINE

if (!medicationList.some((med) => med.id === okaforAmlodipine)) {
  medicationList.push({
    id: okaforAmlodipine,
    residentId: OKAFOR,
    name: 'Amlodipine',
    dose: '5mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '5mg · tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  })
}
if (!medicationList.some((med) => med.id === okaforMorphine)) {
  medicationList.push({
    id: okaforMorphine,
    residentId: OKAFOR,
    name: 'Morphine sulfate oral solution',
    dose: '2.5mg',
    doseQuantity: 1.25,
    stockUnit: 'ml',
    form: '10mg/5ml · oral solution',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  })
}

/**
 * A controlled drug prescribed five days ago and never counted.
 *
 * The fixture that reaches `no_balance_recorded`. Without it that member is a
 * branch nothing renders — §8's first standing check — and the opening-count
 * flow would exist only in a test.
 *
 * It is also the honest situation the state models: a drug prescribed and not
 * yet counted is exactly when a balance does not exist. It is a *different*
 * finding from Okafor's morphine discrepancy, which stays the only one in the
 * set — one drug never counted and one drug whose count does not reconcile
 * must not be confused for each other on a register.
 */
export const NEWLY_PRESCRIBED_CD =
  'med-res-adeyemi-oxycodone-oral-solution' as MedicationId

medicationList.push({
  id: NEWLY_PRESCRIBED_CD,
  residentId: 'res-adeyemi' as ResidentId,
  name: 'Oxycodone oral solution',
  dose: '5mg',
  doseQuantity: 5,
  stockUnit: 'ml',
  form: '5mg/5ml · oral solution',
  route: 'Oral',
  intervalDays: 1,
  roundTimes: ['08:00', '20:00'],
  isControlledDrug: true,
  isPrn: false,
})

/**
 * Two more controlled drugs, in two more forms.
 *
 * Sixteen controlled drugs all measured in millilitres is the same problem as
 * sixteen drugs with one balance between them: **the unit column cannot
 * visibly matter when every unit is the same**, so the wrong-figure it exists
 * to prevent is untestable. A patch counted in patches and a modified-release
 * tablet counted in tablets make the column do work.
 *
 * Both reconcile. The discrepancy stays on Okafor's morphine and the
 * never-counted stays on Grace's oxycodone — the two findings the register
 * must keep apart, and neither of them multiplied.
 */
export const PEMBERTON_OXYCODONE =
  'med-res-pemberton-oxycodone-modified-release' as MedicationId
export const KAVANAGH_FENTANYL =
  'med-res-kavanagh-fentanyl-transdermal-patch' as MedicationId

/**
 * The other controlled drug forms, on a few residents each.
 *
 * Three each, drawn from a fixed seed, so the register carries three units
 * with oral morphine still the commonest. Pooled instead, they reached most of
 * the home — and a care home where nearly every resident is on a controlled
 * drug is as wrong as one where they are all on the same one.
 */
const OTHER_CONTROLLED: DrugTemplate[] = [
  {
    name: 'Morphine sulfate modified release',
    dose: '10mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '10mg · modified release tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  },
  {
    name: 'Oxycodone modified release',
    dose: '10mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '10mg · modified release tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  },
  {
    // Every seventh day. A patch left on past its interval is a real risk, and
    // the chart has to be able to say which days it was not due.
    name: 'Buprenorphine transdermal patch',
    dose: '10 micrograms/hour',
    doseQuantity: 1,
    stockUnit: 'patches',
    form: '10 micrograms/hour · transdermal patch',
    route: 'Transdermal',
    intervalDays: 7,
    roundTimes: ['08:00'],
    isControlledDrug: true,
    isPrn: false,
  },
]

/**
 * Six residents already on oral morphine take one of the other forms instead.
 *
 * **A swap, not an addition.** Dropped in on top, the new forms took the
 * proportion of the home on a controlled drug from a bit over half to nearly
 * four fifths — wrong on the facts in the other direction, and the same class
 * of error as every drug sharing one unit. Substituting leaves the count of
 * residents on a controlled drug exactly where it was and changes only what
 * they are on.
 *
 * Okafor is excluded: his morphine carries the pinned discrepancy.
 */
{
  const rng = makeRandom(0x0cd50f0f)
  const swappable = medicationList.filter(
    (med) =>
      med.id.endsWith('-morphine-sulfate-oral-solution') && med.residentId !== OKAFOR,
  )
  const chosen = rng.sample(swappable, OTHER_CONTROLLED.length * 2)

  for (const [index, existing] of chosen.entries()) {
    const drug = OTHER_CONTROLLED[index % OTHER_CONTROLLED.length]!
    const id =
      `med-${existing.residentId}-${drug.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` as MedicationId
    if (medicationList.some((med) => med.id === id)) continue
    const at = medicationList.indexOf(existing)
    medicationList[at] = {
      id,
      residentId: existing.residentId,
      intervalDays: 1,
      ...drug,
    }
  }
}

const pinnedControlledDrugs: MedicationDraft[] = [
  {
    id: PEMBERTON_OXYCODONE,
    residentId: 'res-pemberton' as ResidentId,
    name: 'Oxycodone modified release',
    dose: '10mg',
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '10mg · modified release tablets',
    route: 'Oral',
    intervalDays: 1,
    roundTimes: ['08:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  },
  {
    id: KAVANAGH_FENTANYL,
    residentId: 'res-kavanagh' as ResidentId,
    name: 'Fentanyl transdermal patch',
    dose: '25 micrograms/hour',
    doseQuantity: 1,
    stockUnit: 'patches',
    form: '25 micrograms/hour · transdermal patch',
    route: 'Transdermal',
    /*
     * Changed every third day, not given daily. A fentanyl patch administered
     * once a day would be an overdose, and a register showing thirty patches
     * in thirty days is a clinically wrong record rather than a thin one.
     *
     * On the two days between, the MAR cell is `not_due` — nobody missed that
     * dose, because there was no dose.
     */
    intervalDays: 3,
    roundTimes: ['08:00'],
    isControlledDrug: true,
    isPrn: false,
  },
]

for (const pinned of pinnedControlledDrugs) {
  // Guarded, because these drugs are now in the shared pool too: pushing blind
  // would give one resident the same medication id twice.
  if (!medicationList.some((med) => med.id === pinned.id)) medicationList.push(pinned)
}

// ---------------------------------------------------------------------------
// The prescription. PRD §5.3, §6.4.
//
// Filled in one pass over the assembled list rather than repeated at every
// push site, so a new drug cannot be added with half a prescription attached.
// ---------------------------------------------------------------------------

const PRESCRIBERS = [
  { name: 'Dr S. Achebe', organisation: 'Rosewood Medical Centre' },
  { name: 'Dr P. Ramanathan', organisation: 'Thornfield Health Partnership' },
  { name: 'Dr O. Balogun', organisation: 'Eastgate Family Practice' },
  { name: 'Dr H. Whitfield', organisation: 'Manchester Royal Infirmary' },
]

/** What the prescription says about giving it. Keyed by drug name. */
const INSTRUCTIONS: Record<string, string> = {
  Amlodipine: 'Take with or without food. Blood pressure checked weekly.',
  Atorvastatin: 'Give in the evening.',
  Levothyroxine: 'Give at least 30 minutes before breakfast, on an empty stomach.',
  Metformin: 'Give with food to reduce stomach upset.',
  Donepezil: 'Give in the evening. Report any fainting or slow pulse.',
  Furosemide: 'Give in the morning. Do not give after midday: it disturbs the night.',
  Paracetamol: 'Leave at least four hours between doses.',
  'Salbutamol inhaler': 'Shake before use. Two puffs, one minute apart.',
  Lansoprazole: 'Give 30 minutes before food.',
  'Morphine sulfate oral solution':
    'Measure with the oral syringe supplied. Never a spoon.',
  'Morphine sulfate modified release':
    'Swallow whole. Never crushed or halved: the whole dose would be released at once.',
  'Oxycodone modified release':
    'Swallow whole. Never crushed or halved: the whole dose would be released at once.',
  'Oxycodone oral solution': 'Measure with the oral syringe supplied.',
  'Fentanyl transdermal patch':
    'Apply to clean, dry, unbroken skin. Rotate the site and record where it was applied.',
  'Buprenorphine transdermal patch':
    'Apply to clean, dry, unbroken skin. Rotate the site and record where it was applied.',
}

/**
 * The one PRN with no 24-hour maximum recorded.
 *
 * **Exactly one, and it is a finding.** Every PRN was in this state before the
 * field existed, which would have fired the prescription screen's critical
 * block on all 23 of them — and a warning that fires on everything is
 * indistinguishable from a screen that always looks like that. The alarm would
 * have been right and nobody could have acted on it.
 *
 * Pinned by identity so the guard asserts *this* rather than counting.
 */
export const PRN_WITHOUT_MAXIMUM = 'med-res-okafor-salbutamol-inhaler' as MedicationId

/** Deliberate single gaps, so each branch of each union is reachable. */
const NO_PRESCRIBER_RECORDED = 'med-res-adeyemi-oxycodone-oral-solution' as MedicationId
const NO_STORAGE_RECORDED =
  'med-res-pemberton-oxycodone-modified-release' as MedicationId
const NO_INSTRUCTIONS_RECORDED =
  'med-res-kavanagh-fentanyl-transdermal-patch' as MedicationId

export const medications: Medication[] = medicationList.map((draft, index) => {
  const rng = makeRandom(0x9e550000 + index * 65537)

  // The newly prescribed controlled drug is five days old by construction;
  // everything else has been running for a while.
  const startedDaysAgo = draft.id === NEWLY_PRESCRIBED_CD ? 5 : rng.int(40, 400)
  const startedOn = zonedDate(
    toIsoDateTime(atTime(daysAgo(startedDaysAgo), 9, 0)),
    zoneFor(draft.residentId),
  )

  const controlled = draft.isControlledDrug
  const scanner =
    carersAndSeniors[rng.int(0, carersAndSeniors.length - 1)] ?? staffNwosu

  return {
    ...draft,
    startedOn,

    maximumIn24Hours: !draft.isPrn
      ? // The schedule is the limit. A claim, not an omission.
        { kind: 'not_applicable' as const }
      : draft.id === PRN_WITHOUT_MAXIMUM
        ? { kind: 'not_recorded' as const }
        : {
            kind: 'recorded' as const,
            // Counted in stockUnit, the only unit a dose can be checked
            // against. Four doses' worth for the tablets, four for the puffs.
            quantity: draft.doseQuantity * 4,
          },

    prescriber:
      draft.id === NO_PRESCRIBER_RECORDED
        ? { kind: 'unrecorded' as const }
        : {
            kind: 'recorded' as const,
            value:
              PRESCRIBERS[
                controlled && draft.stockUnit === 'patches'
                  ? PRESCRIBERS.length - 1
                  : rng.int(0, PRESCRIBERS.length - 2)
              ]!,
            recordedBy: scanner,
            recordedAt: toIsoDateTime(atTime(daysAgo(startedDaysAgo), 9, 20)),
          },

    storage:
      draft.id === NO_STORAGE_RECORDED
        ? { kind: 'unrecorded' as const }
        : {
            kind: 'recorded' as const,
            value: controlled
              ? 'Controlled drug cabinet, ground floor clinic room. Keep upright.'
              : 'Medication trolley, upper drawer.',
            recordedBy: scanner,
            recordedAt: toIsoDateTime(atTime(daysAgo(startedDaysAgo), 9, 20)),
          },

    instructions:
      draft.id === NO_INSTRUCTIONS_RECORDED || !INSTRUCTIONS[draft.name]
        ? { kind: 'unrecorded' as const }
        : {
            kind: 'recorded' as const,
            value: INSTRUCTIONS[draft.name]!,
            recordedBy: scanner,
            recordedAt: toIsoDateTime(atTime(daysAgo(startedDaysAgo), 9, 20)),
          },

    // Not on file is ordinary rather than a finding — a prescription can be
    // in the paper folder — so it is a minority, not a single pinned case.
    prescriptionDocument:
      rng.int(0, 4) === 0
        ? { kind: 'not_on_file' as const }
        : {
            kind: 'on_file' as const,
            documentId: `doc-${draft.id}` as DocumentId,
            scannedOn: startedOn,
            scannedBy: scanner,
          },
  }
})

/**
 * The share of due doses with no record against them, as a percentage.
 *
 * **Named and exported so the guard reads it rather than restating it.** The
 * fixture check pinned the rate to a hand-typed band, and a band typed in one
 * file to describe a number chosen in another is the proxy problem: raising the
 * rate meant editing the assertion to make it pass, which is how a guard stops
 * asserting. It now checks that the generator produces the rate it declares.
 */
export const OMISSION_RATE_PERCENT = 7

/** How long this drug has been prescribed, in whole days before `NOW`. */
export function prescribedDaysAgo(medication: Medication): number {
  const started = new Date(`${medication.startedOn}T09:00:00`).getTime()
  return Math.max(0, Math.floor((NOW.getTime() - started) / 86_400_000))
}

export function medicationsFor(residentId: ResidentId): Medication[] {
  return medications.filter((med) => med.residentId === residentId)
}

/**
 * How far back the MAR chart holds records: 90 days, the oldest 89 days ago.
 *
 * **Exported because the schedule depends on it.** Which days a drug falls due
 * on is counted forward from the first day on the chart, not from the date it
 * was prescribed — so a reader of the chart who takes the prescription date
 * instead lands on a different set of days for every drug prescribed more than
 * ninety days ago and given other than daily. That produced two counts of the
 * same doses today, 162 and 163, from two functions written minutes apart.
 */
export const MAR_HISTORY_DAYS = 90

/**
 * Whether this drug falls due at all on a day, counted back from today.
 *
 * **One owner, because the MAR record does not carry the answer.** A cell says
 * `not_due` both for a drug that is not on schedule that day and for a round
 * later today that has not opened yet, and the two are opposites when you are
 * counting what is still to come: the first was never due and the second is
 * about to be. The chart that adds them together reports a denominator
 * containing doses nobody ever owed.
 *
 * The schedule is a property of the prescription — `startedOn`, `intervalDays`
 * — so this reads the medication rather than reconstructing the generator, and
 * it lives here beside `prescribedDaysAgo` because a second copy on a screen
 * would drift from the chart the first day an interval changed.
 */
export function isScheduledDaysAgo(medication: Medication, daysBack: number): boolean {
  const started = firstChartedDayAgo(medication)
  if (daysBack > started || daysBack < 0) return false
  return (started - daysBack) % medication.intervalDays === 0
}

/** The oldest day this drug appears on the chart, in days before today. */
const firstChartedDayAgo = (medication: Medication) =>
  Math.min(prescribedDaysAgo(medication), MAR_HISTORY_DAYS - 1)

// ---------------------------------------------------------------------------
// MAR records
// ---------------------------------------------------------------------------

export interface MarRecord {
  medicationId: MedicationId
  residentId: ResidentId
  /** The round this cell belongs to, e.g. '08:00' on that date. */
  roundTime: string
  /**
   * The day this round belongs to, **in the site's zone**.
   *
   * `toDateString()` before, which is machine-local: a runner west or east of
   * the site got its day boundaries from the wrong midnight. The grid is a
   * lookup by (medication, date, round), so a wrong boundary does not render a
   * wrong cell — it renders **no cell**, and a missing MAR cell is the exact
   * ambiguity §2.1 opens with. Inert only because both fixture sites are
   * Europe/London, and inert is not fixed.
   */
  date: IsoDate
  state: MarCellState
}

/**
 * A record is written after the event it describes, but never after now.
 *
 * A round that fell due four minutes ago has only four minutes of slack, so
 * the offset is clamped rather than the cell dropped: dropping it would leave
 * a hole in the MAR grid, and a missing cell is precisely the ambiguity this
 * product exists to prevent. Clamping keeps every past round accounted for.
 *
 * The random draw still happens either way, so the RNG stream — and therefore
 * every other fixture downstream — is unaffected by which branch is taken.
 */
export function recordedAfter(dueAt: Date, minutes: number): Date {
  // Delegates, so the "after the event, never after now" rule has exactly one
  // implementation. See recordedBetween in generate.ts.
  return recordedBetween(dueAt, new Date(dueAt.getTime() + minutes * 60_000))
}

/**
 * Which zone a medication's rounds are counted in.
 *
 * A round time is "08:00 in the site's zone" (see `Medication.roundTimes`), so
 * the day it belongs to is the site's day. Resolved per medication rather than
 * once, because a resident belongs to a site and sites may differ.
 */
function zoneFor(residentId: ResidentId): TimeZone {
  const resident = residents.find((entry) => entry.id === residentId)
  const site = sites.find((entry) => entry.id === resident?.siteId)
  return (site?.timeZone ?? 'Europe/London') as TimeZone
}

/** What a manager wrote when closing an older omission. Varied, and plain. */
const CLOSURE_REASONS: readonly [string, string, string] = [
  'GP informed. The next dose was given on time and no harm came of it.',
  'Resident was at hospital outpatients over the round; the ward gave the dose.',
  'Checked with the family and the pharmacy. Discussed with the member of staff.',
]

const marRecords: MarRecord[] = []

for (const [index, medication] of medications.entries()) {
  const rng = makeRandom(0x9a40000 + index * 2654435761)
  const startedDaysAgo = firstChartedDayAgo(medication)
  for (let day = startedDaysAgo; day >= 0; day -= 1) {
    const date = daysAgo(day)
    /**
     * A day this drug is not due on.
     *
     * **A record still goes on the chart**, and it says `not_due`. Leaving the
     * day off entirely would put a hole in the grid, and a hole is the one
     * thing the chart must never render — absence from a list is the same bug
     * as a blank cell. Nobody missed this dose; there was no dose.
     */
    const onSchedule = (startedDaysAgo - day) % medication.intervalDays === 0

    for (const roundTime of medication.roundTimes) {
      const [hourPart, minutePart] = roundTime.split(':')
      const hour = Number(hourPart)
      const minute = Number(minutePart)
      const dueAt = atTime(date, hour, minute)

      if (!onSchedule) {
        marRecords.push({
          medicationId: medication.id,
          residentId: medication.residentId,
          roundTime,
          date: zonedDate(toIsoDateTime(dueAt), zoneFor(medication.residentId)),
          state: { kind: 'not_due' },
        })
        continue
      }

      // Rounds still in the future are not due yet — a real state, and not
      // the same as an omission.
      if (dueAt.getTime() > NOW.getTime()) {
        marRecords.push({
          medicationId: medication.id,
          residentId: medication.residentId,
          roundTime,
          date: zonedDate(toIsoDateTime(dueAt), zoneFor(medication.residentId)),
          state:
            dueAt.getTime() - NOW.getTime() < MEDICATION_LOOKAHEAD_HOURS * 3_600_000
              ? {
                  kind: 'due',
                  windowOpensAt: toIsoDateTime(dueAt),
                  windowClosesAt: toIsoDateTime(new Date(dueAt.getTime() + 3_600_000)),
                }
              : { kind: 'not_due' },
        })
        continue
      }

      const roll = rng.int(1, 100)
      let state: MarCellState

      /**
       * A round whose hour is still running has not been signed off yet.
       *
       * **Every past round used to be fully recorded**, including one that
       * opened four minutes ago, so a dose inside its window did not exist in
       * the fixture at all: the Dashboard's "due now" segment was unreachable
       * on any fresh load, whatever the screen did with it. Reading it as zero
       * was correct and reading it as broken was reasonable, which is the
       * worst pair a figure can offer.
       *
       * A round in progress is also simply what a home looks like at 08:20.
       *
       * Drawn after `roll` and never instead of it, so the RNG stream is
       * bit-for-bit what it was and no other fixture moved.
       */
      const sinceDue = NOW.getTime() - dueAt.getTime()
      /*
       * **Part-recorded, not empty.** A round twenty minutes in has some doses
       * signed for and some still to give; leaving the whole round open made
       * the part-recorded state unreachable, which is the one §8 names by
       * name — a dose already signed for rendering as an empty control invites
       * a second signature over somebody else's name.
       *
       * **The whole round, and never an omission inside it.** Falling the
       * even-numbered drugs through to the ordinary past-dose logic put six
       * doses twenty minutes into their window down as missed, which they
       * cannot be: the window is what decides that, and it has not closed.
       *
       * A round somebody is part way through is reached from the resident's
       * day rather than from inside one round, which is what the round screen
       * shows anyway.
       */
      if (sinceDue >= 0 && sinceDue < 3_600_000) {
        /*
         * Alternating on the drug's index, so a resident with two drugs at
         * this round always has one signed and one still to give. Randomising
         * it leaves most residents wholly on one side, because most have a
         * single drug at any one round, and the state this exists for is a
         * *resident* part way through rather than a home part way through.
         *
         * The signed half is built here rather than by falling through to the
         * ordinary past-dose logic, which would have marked some of them
         * missed: a dose twenty minutes into its window cannot be an omission,
         * because the window is what decides that and it has not closed.
         *
         * Derived, never drawn, so this adds no call into the RNG.
         */
        const stillToGive = index % 2 === 1
        marRecords.push({
          medicationId: medication.id,
          residentId: medication.residentId,
          roundTime,
          date: zonedDate(toIsoDateTime(dueAt), zoneFor(medication.residentId)),
          state: stillToGive
            ? {
                kind: 'due',
                windowOpensAt: toIsoDateTime(dueAt),
                windowClosesAt: toIsoDateTime(new Date(dueAt.getTime() + 3_600_000)),
              }
            : {
                kind: 'given',
                givenAt: toIsoDateTime(recordedAfter(dueAt, 4 + (index % 12))),
                givenBy: carersAndSeniors[index % carersAndSeniors.length]!,
                witness: medication.isControlledDrug
                  ? {
                      kind: 'witnessed',
                      by: carersAndSeniors[(index + 1) % carersAndSeniors.length]!,
                    }
                  : { kind: 'not_required' },
              },
        })
        continue
      }

      /**
       * **7% of due doses have no record.** Raised from 1% on 25/08/2026.
       *
       * This said "no randomly-generated omissions" and pinned exactly the
       * three §5.3 asks for. That was right about the danger and wrong about
       * the home: three missed doses in 16,200 across 32 residents over 90
       * days is not a careful service, it is one that does not exist, and it
       * left the omitted state reachable on one resident in thirty-two.
       *
       * The screen that state exists for — the omissions view — then had
       * three rows, all the same drug on the same day, so neither the
       * oldest-first sort nor the escalation filter did any visible work.
       *
       * 1% was ~13 in a seven-day window: long enough that the sort and the
       * filters meant something, short enough to read in one screen.
       *
       * **1% is invisible in a chart, which is a different requirement from
       * legible in a queue.** A gap of one dose in a hundred is three pixels of
       * a bar and a hairline of a donut arc, so the four states of a round and
       * the two parts of a bar could not be seen to work on any screen in the
       * build: they were held by construction in tests instead, which is
       * coverage but is not a demonstration. 7% is ~11 a day and ~78 a week,
       * which draws a segment you can see at a glance and still leaves a queue
       * a person could work through.
       *
       * The earlier fear was 300 at once, which is the volume-drowns-
       * distinction failure. 78 is not that, and the three §5.3 omissions are
       * still pinned by hand rather than left to the draw.
       *
       * **Gated on `roll`, which was already drawn.** No new call into the
       * RNG, so the stream is bit-for-bit what it was and no other fixture
       * moved — the same discipline the care-note corrections used.
       */
      if (roll <= OMISSION_RATE_PERCENT) {
        // Escalation is derived, not drawn, for the same reason. A dose missed
        // more than a day ago has been noticed by somebody; one missed this
        // morning may not have been yet, and that is the distinction the
        // union exists to carry.
        const ageHours = (NOW.getTime() - dueAt.getTime()) / 3_600_000
        state = {
          kind: 'omitted',
          dueAt: toIsoDateTime(dueAt),
          escalation:
            ageHours > 24
              ? {
                  kind: 'escalated',
                  // Past the 60-minute mark, varying by day so every escalated
                  // dose is not stamped at the same offset.
                  at: toIsoDateTime(recordedAfter(dueAt, 60 + (day % 30))),
                }
              : { kind: 'not_escalated' },
          /*
           * **Closed by a manager, for some of the older ones, derived rather
           * than drawn** (CW PRD MED-01). Omissions more than three days old on
           * every third day are closed a day after they fell due, so both states
           * are on a fresh load and the ones still open are the recent ones a
           * senior would be looking at. No RNG call, so no other fixture moves.
           */
          closure:
            ageHours > 72 && day % 3 === 0
              ? {
                  kind: 'closed',
                  by: staffHalloran,
                  at: toIsoDateTime(
                    recordedBetween(dueAt, new Date(dueAt.getTime() + 86_400_000)),
                  ),
                  reason: CLOSURE_REASONS[day % CLOSURE_REASONS.length],
                }
              : { kind: 'open' },
        }
      } else if (roll <= 92) {
        const givenAt = recordedAfter(dueAt, rng.int(1, 25))
        state = {
          kind: 'given',
          givenAt: toIsoDateTime(givenAt),
          givenBy: rng.pick(carersAndSeniors),
          witness: medication.isControlledDrug
            ? rng.chance(0.9)
              ? { kind: 'witnessed', by: rng.pick(carersAndSeniors) }
              : { kind: 'required_not_recorded' }
            : { kind: 'not_required' },
        }
      } else {
        // A recorded refusal is a COMPLETE clinical record, not a gap. This
        // is the majority of the non-given cells and it must look settled.
        const drawn = rng.pick([
          'resident_refused',
          'resident_asleep',
          'medication_unavailable',
          'resident_in_hospital',
          'other',
        ] as const)
        state = {
          kind: 'not_given',
          /*
           * "Resident vomiting" joined the reasons for CW PRD MED-02. The draw
           * above keeps its five choices, so its stream is unchanged; some of
           * the "other" answers on every fourth day become vomiting instead.
           */
          reason: drawn === 'other' && day % 4 === 0 ? 'resident_vomiting' : drawn,
          note: '',
          recordedAt: toIsoDateTime(recordedAfter(dueAt, rng.int(2, 30))),
          recordedBy: rng.pick(carersAndSeniors),
        }
      }

      marRecords.push({
        medicationId: medication.id,
        residentId: medication.residentId,
        roundTime,
        date: zonedDate(toIsoDateTime(dueAt), zoneFor(medication.residentId)),
        state,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// PRD §5.3 gap 4 — three medication omissions, one escalated past 60 minutes
// and one inside the 30–60 minute window.
//
// The source PRD's escalation logic is meaningless unless the UI tells these
// apart, which is why MarEscalation is its own union rather than a nullable
// timestamp.
// ---------------------------------------------------------------------------

const yesterday = daysAgo(1)
const omissionRounds = [
  {
    // Escalated past 60 minutes — the serious one.
    dueAt: atTime(yesterday, 8, 0),
    escalation: {
      kind: 'escalated' as const,
      at: toIsoDateTime(atTime(yesterday, 9, 12)),
    },
  },
  {
    // Inside the 30–60 minute window — escalated, but only just.
    dueAt: atTime(yesterday, 14, 0),
    escalation: {
      kind: 'escalated' as const,
      at: toIsoDateTime(atTime(yesterday, 14, 47)),
    },
  },
  {
    // Not escalated at all. The window closed and nobody has noticed yet,
    // which is a different and arguably worse thing than an escalated one.
    dueAt: atTime(yesterday, 20, 0),
    escalation: { kind: 'not_escalated' as const },
  },
]

/**
 * The three §5.3 gap-4 omissions, kept by reference as they are pinned.
 *
 * Exported so the guard can assert **these** rather than reconstruct them from
 * a medication id and a date. The generator produces omissions on this drug
 * too now, so any filter that describes them rather than identifying them
 * catches the generated ones as well — which is how the guard first failed.
 */
export const SPECIFIED_OMISSIONS: MarRecord[] = []

for (const omission of omissionRounds) {
  const roundTime = `${`${omission.dueAt.getHours()}`.padStart(2, '0')}:00`
  const day = zonedDate(toIsoDateTime(omission.dueAt), zoneFor(OKAFOR))
  const existing = marRecords.findIndex(
    (record) =>
      record.medicationId === okaforMorphine &&
      record.roundTime === roundTime &&
      record.date === day,
  )
  const record: MarRecord = {
    medicationId: okaforMorphine,
    residentId: OKAFOR,
    roundTime,
    date: day,
    state: {
      kind: 'omitted',
      dueAt: toIsoDateTime(omission.dueAt),
      escalation: omission.escalation,
      // The pinned three stay open: they are the ones a senior has not dealt with.
      closure: { kind: 'open' },
    },
  }
  if (existing >= 0) marRecords[existing] = record
  else marRecords.push(record)
  SPECIFIED_OMISSIONS.push(record)
}

export const marRecordsAll: MarRecord[] = marRecords

/**
 * When a dose fell due, whatever became of it — or that it never did.
 *
 * **One owner, because two screens count the same denominator.** The omissions
 * read derived this inline, and the reports module needs the identical
 * derivation over two periods at once; a second copy is two definitions of
 * "doses due" that agree today and disagree after one edit, on the figure a
 * medication error rate is a fraction of.
 *
 * Each member says where its instant lives: an omission has a `dueAt`, a given
 * dose has the moment it was given, a recorded refusal the moment it was
 * written, and a dose still inside its window the moment that window opened.
 * `not_due` is the one member with no instant, and it is not a zero — the
 * round has not happened.
 */
export function fellDueAt(record: MarRecord): IsoDateTime | 'not_due' {
  switch (record.state.kind) {
    case 'omitted':
      return record.state.dueAt
    case 'given':
      return record.state.givenAt
    case 'not_given':
      return record.state.recordedAt
    case 'due':
      return record.state.windowOpensAt
    case 'not_due':
      return 'not_due'
  }
}

export function marRecordsFor(residentId: ResidentId): MarRecord[] {
  return marRecords.filter((record) => record.residentId === residentId)
}

/**
 * Medication about to fall due, inside `MEDICATION_LOOKAHEAD_HOURS`.
 *
 * Rendered on the profile header (§16.3) and on the Dashboard. An empty result
 * means nothing is due — which both screens state in words rather than leaving
 * as a blank.
 *
 * **Named for the rule rather than the number**, because the number is now a
 * constant and the old name asserted a window this body never computed: the
 * generator decides which records are `due`, and this reads that decision.
 * A parameterised window would need the records regenerating, and a function
 * accepting an argument it could not honour would be worse than one that says
 * which rule it applies.
 */
export function dueWithinLookahead(residentId: ResidentId): MarRecord[] {
  return marRecordsFor(residentId).filter((record) => record.state.kind === 'due')
}

// ---------------------------------------------------------------------------
// The controlled drug register. PRD §5.3 gap 5, §6.4.
//
// **Simulated forward from an opening count, not sprinkled.** The register's
// whole purpose is a running total, and a total only runs if the entries add
// up: every administration takes `doseQuantity` off the balance, every receipt
// puts a pack on, and a routine count's expected figure is the balance the
// register had reached at that moment. Counts invented independently of the
// doses would make the arithmetic on the screen unfollowable — every drug
// would read as a discrepancy, or none would, and neither would mean anything.
//
// Two findings survive it, and they must stay distinct:
//   · Okafor's morphine — a count that does not reconcile. Two millilitres.
//   · Grace's oxycodone — never counted. No opening balance, so nothing for a
//     count to reconcile against. Not a smaller version of the first.
// ---------------------------------------------------------------------------

export const stockCounts: StockCount[] = []
export const registerMovements: RegisterMovement[] = []

/** How much arrives in one delivery, per drug form. */
const PACK_SIZE: Record<string, number> = {
  ml: 100,
  tablets: 56,
  patches: 5,
}

const PHARMACY = 'Ashworth Pharmacy'

for (const [index, medication] of medications.entries()) {
  if (!medication.isControlledDrug) continue
  // Prescribed five days ago and never counted. The one drug that must have no
  // balance, and the only fixture that reaches `no_balance_recorded`.
  if (medication.id === NEWLY_PRESCRIBED_CD) continue

  const rng = makeRandom(0x57ac0000 + index * 65537)
  const pack = PACK_SIZE[medication.stockUnit] ?? 50

  /** Two different people. A count signed once is one person's word. */
  const pair = (): [StaffRef, StaffRef] => {
    const [a, b] = rng.sample(carersAndSeniors, 2)
    return [a ?? staffNwosu, b ?? staffHalloran]
  }

  // The register opens 30 days back, or when the drug was prescribed if that
  // is later. Nothing before an opening count belongs on it.
  const openDaysAgo = Math.min(prescribedDaysAgo(medication), 30)
  const openedAt = atTime(daysAgo(openDaysAgo), 9, rng.int(0, 40))
  const [openBy, openWitness] = pair()

  let balance = pack
  stockCounts.push({
    medicationId: medication.id,
    countedAt: toIsoDateTime(openedAt),
    countedBy: openBy,
    witnessedBy: openWitness,
    entry: { kind: 'opening' },
    counted: balance,
  })

  // Every dose actually given, in order. The register follows the MAR rather
  // than inventing its own history of what was administered.
  const given = marRecords
    .filter(
      (record) =>
        record.medicationId === medication.id && record.state.kind === 'given',
    )
    .map((record) => ({
      at: record.state.kind === 'given' ? record.state.givenAt : ('' as IsoDateTime),
    }))
    .filter((entry) => entry.at > toIsoDateTime(openedAt))
    .sort((a, b) => a.at.localeCompare(b.at))

  for (const dose of given) {
    // A delivery before the cabinet runs dry, not after.
    if (balance < medication.doseQuantity * 4) {
      const [by, witness] = pair()
      registerMovements.push({
        kind: 'received',
        medicationId: medication.id,
        from: PHARMACY,
        quantity: pack,
        // An hour before the dose it makes possible. Stamped at the same
        // instant, the register showed a delivery and an administration
        // sharing a timestamp, which reads as one event and leaves the order
        // of the two to whichever was pushed first.
        at: toIsoDateTime(new Date(new Date(dose.at).getTime() - 3_600_000)),
        by,
        witnessedBy: witness,
      })
      balance += pack
    }
    balance -= medication.doseQuantity
  }

  // A patch comes off before the next one goes on, and the used one goes back
  // to the pharmacy. It leaves the cabinet without being administered, which
  // is exactly the movement a count-only register cannot explain.
  if (medication.stockUnit === 'patches' && given.length > 0) {
    const [by, witness] = pair()
    const at = given[Math.floor(given.length / 2)]!.at
    registerMovements.push({
      kind: 'disposed',
      medicationId: medication.id,
      reason: 'Used patch returned to pharmacy for destruction',
      quantity: 1,
      at,
      by,
      witnessedBy: witness,
    })
    balance -= 1
  }

  // The routine count closes the register, so the balance on screen is the
  // balance somebody last counted rather than one the software worked out.
  const [countBy, countWitness] = pair()
  const shortBy = medication.id === okaforMorphine ? 2 : 0
  /*
   * A quarter of an hour after the last dose — **and never after now.**
   *
   * Unclamped, a drug whose last dose was given within the last fifteen
   * minutes acquired a count timestamped in the future, which the incident
   * raised from it then inherited. Second occurrence of the same class
   * (CLAUDE.md §8): anything built by adding an offset to a past instant can
   * overshoot.
   */
  const countedAt =
    given.length > 0
      ? toIsoDateTime(
          new Date(
            Math.min(
              new Date(given[given.length - 1]!.at).getTime() + 900_000,
              NOW.getTime(),
            ),
          ),
        )
      : toIsoDateTime(atTime(daysAgo(1), 20, 10))

  stockCounts.push({
    medicationId: medication.id,
    countedAt,
    countedBy: countBy,
    witnessedBy: countWitness,
    entry: { kind: 'routine', expected: round2(balance) },
    counted: round2(balance - shortBy),
  })
}

/** Two decimal places. A balance in millilitres must not drift on floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function movementsFor(medicationId: MedicationId): RegisterMovement[] {
  return registerMovements.filter((movement) => movement.medicationId === medicationId)
}

export function stockCountsFor(medicationId: MedicationId): StockCount[] {
  return stockCounts.filter((count) => count.medicationId === medicationId)
}

/**
 * The balance this drug is standing at, or the fact that nobody has counted it.
 *
 * The only way to ask. It replaced `lastCount?.counted ?? 0` at the one call
 * site that needed it, which is why the union exists.
 */
export function balanceOf(medicationId: MedicationId): StockBalance {
  // By time, not by array position. "The latest count" has to be true rather
  // than incidentally true of the order the fixtures were pushed in.
  const counts = [...stockCountsFor(medicationId)].sort((a, b) =>
    a.countedAt.localeCompare(b.countedAt),
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
 * A count that does not reconcile. Named so the Fixture Audit can find it.
 *
 * **An opening count can never be one.** There is no expected figure for it to
 * differ from, and calling the first count of a drug's life a discrepancy would
 * report a loss on a cabinet nobody had counted before.
 */
export const hasStockDiscrepancy = (count: StockCount): boolean =>
  count.entry.kind === 'routine' && count.entry.expected !== count.counted

export const GAP_MEDICATION_IDS = {
  controlledDrugWithDiscrepancy: okaforMorphine,
  controlledDrugNeverCounted: NEWLY_PRESCRIBED_CD,
  omissionsResident: OKAFOR,
}
