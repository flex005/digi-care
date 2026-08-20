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
  MarCellState,
  Medication,
  MedicationId,
  ResidentId,
  StockCount,
} from '../types'
import {
  NOW,
  atTime,
  daysAgo,
  makeRandom,
  recordedBetween,
  toIsoDateTime,
} from './generate'
import { carersAndSeniors, staffHalloran, staffNwosu } from './organisation'
import { residents } from './residents'

interface DrugTemplate {
  name: string
  dose: string
  route: string
  roundTimes: [string, ...string[]]
  isControlledDrug: boolean
  isPrn: boolean
}

const DRUGS: DrugTemplate[] = [
  {
    name: 'Amlodipine',
    dose: '5mg',
    route: 'Oral',
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Atorvastatin',
    dose: '20mg',
    route: 'Oral',
    roundTimes: ['20:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Levothyroxine',
    dose: '75 micrograms',
    route: 'Oral',
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Metformin',
    dose: '500mg',
    route: 'Oral',
    roundTimes: ['08:00', '18:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Donepezil',
    dose: '10mg',
    route: 'Oral',
    roundTimes: ['20:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Furosemide',
    dose: '40mg',
    route: 'Oral',
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Paracetamol',
    dose: '1g',
    route: 'Oral',
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: false,
    isPrn: true,
  },
  {
    name: 'Salbutamol inhaler',
    dose: '2 puffs',
    route: 'Inhaled',
    roundTimes: ['08:00', '20:00'],
    isControlledDrug: false,
    isPrn: true,
  },
  {
    name: 'Lansoprazole',
    dose: '30mg',
    route: 'Oral',
    roundTimes: ['08:00'],
    isControlledDrug: false,
    isPrn: false,
  },
  {
    name: 'Morphine sulfate oral solution',
    dose: '2.5mg',
    route: 'Oral',
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  },
]

const medicationList: Medication[] = []

for (const [index, resident] of residents.entries()) {
  const rng = makeRandom(0x3ed10000 + index * 65537)
  const count =
    resident.siteId === 'site-ashgrove-lodge' ? rng.int(1, 3) : rng.int(2, 5)
  for (const drug of rng.sample(DRUGS, count)) {
    medicationList.push({
      id: `med-${resident.id}-${drug.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` as MedicationId,
      residentId: resident.id,
      ...drug,
    })
  }
}

/** Emmanuel Okafor is the source PRD's running example. He carries the
 *  medication gaps, so the MAR grid meets them from its first day. */
const OKAFOR = 'res-okafor' as ResidentId
const okaforAmlodipine = 'med-res-okafor-amlodipine' as MedicationId
const okaforMorphine = 'med-res-okafor-morphine-sulfate-oral-solution' as MedicationId

if (!medicationList.some((med) => med.id === okaforAmlodipine)) {
  medicationList.push({
    id: okaforAmlodipine,
    residentId: OKAFOR,
    name: 'Amlodipine',
    dose: '5mg',
    route: 'Oral',
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
    route: 'Oral',
    roundTimes: ['08:00', '14:00', '20:00'],
    isControlledDrug: true,
    isPrn: false,
  })
}

export const medications: Medication[] = medicationList

export function medicationsFor(residentId: ResidentId): Medication[] {
  return medications.filter((med) => med.residentId === residentId)
}

// ---------------------------------------------------------------------------
// MAR records
// ---------------------------------------------------------------------------

export interface MarRecord {
  medicationId: MedicationId
  residentId: ResidentId
  /** The round this cell belongs to, e.g. '08:00' on that date. */
  roundTime: string
  date: string
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

const marRecords: MarRecord[] = []

for (const [index, medication] of medications.entries()) {
  const rng = makeRandom(0x9a40000 + index * 2654435761)
  for (let day = 89; day >= 0; day -= 1) {
    const date = daysAgo(day)
    for (const roundTime of medication.roundTimes) {
      const [hourPart, minutePart] = roundTime.split(':')
      const hour = Number(hourPart)
      const minute = Number(minutePart)
      const dueAt = atTime(date, hour, minute)

      // Rounds still in the future are not due yet — a real state, and not
      // the same as an omission.
      if (dueAt.getTime() > NOW.getTime()) {
        marRecords.push({
          medicationId: medication.id,
          residentId: medication.residentId,
          roundTime,
          date: date.toDateString(),
          state:
            dueAt.getTime() - NOW.getTime() < 2 * 3_600_000
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
      // No randomly-generated omissions. PRD §5.3 asks for exactly three, and
      // they are hand-authored below with distinct escalation states. Three
      // hundred random ones would swamp the Phase 3 omissions view and make
      // the escalation distinction — the thing the union exists for —
      // impossible to see.
      if (roll <= 92) {
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
        state = {
          kind: 'not_given',
          reason: rng.pick([
            'resident_refused',
            'resident_asleep',
            'medication_unavailable',
            'resident_in_hospital',
            'other',
          ] as const),
          note: '',
          recordedAt: toIsoDateTime(recordedAfter(dueAt, rng.int(2, 30))),
          recordedBy: rng.pick(carersAndSeniors),
        }
      }

      marRecords.push({
        medicationId: medication.id,
        residentId: medication.residentId,
        roundTime,
        date: date.toDateString(),
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

for (const omission of omissionRounds) {
  const roundTime = `${`${omission.dueAt.getHours()}`.padStart(2, '0')}:00`
  const existing = marRecords.findIndex(
    (record) =>
      record.medicationId === okaforMorphine &&
      record.roundTime === roundTime &&
      record.date === yesterday.toDateString(),
  )
  const record: MarRecord = {
    medicationId: okaforMorphine,
    residentId: OKAFOR,
    roundTime,
    date: yesterday.toDateString(),
    state: {
      kind: 'omitted',
      dueAt: toIsoDateTime(omission.dueAt),
      escalation: omission.escalation,
    },
  }
  if (existing >= 0) marRecords[existing] = record
  else marRecords.push(record)
}

export const marRecordsAll: MarRecord[] = marRecords

export function marRecordsFor(residentId: ResidentId): MarRecord[] {
  return marRecords.filter((record) => record.residentId === residentId)
}

/**
 * Medication due in the next two hours. Rendered on the profile header
 * (§16.3). An empty result means nothing is due — which the header states in
 * words rather than leaving as a blank.
 */
export function dueWithinTwoHours(residentId: ResidentId): MarRecord[] {
  return marRecordsFor(residentId).filter((record) => record.state.kind === 'due')
}

// ---------------------------------------------------------------------------
// PRD §5.3 gap 5 — a controlled drug with a stock count discrepancy.
// Two counts: one that reconciles, and one that does not.
// ---------------------------------------------------------------------------

export const stockCounts: StockCount[] = [
  {
    medicationId: okaforMorphine,
    countedAt: toIsoDateTime(atTime(daysAgo(4), 8, 10)),
    countedBy: staffNwosu,
    expected: 42,
    counted: 42,
  },
  {
    // Two doses unaccounted for. In Phase 3 a mismatch blocks submission and
    // raises an incident; here it is a recorded discrepancy waiting for that
    // screen to exist.
    medicationId: okaforMorphine,
    countedAt: toIsoDateTime(atTime(daysAgo(1), 20, 5)),
    countedBy: staffHalloran,
    expected: 30,
    counted: 28,
  },
]

export function stockCountsFor(medicationId: MedicationId): StockCount[] {
  return stockCounts.filter((count) => count.medicationId === medicationId)
}

/** A count that does not reconcile. Named so the Fixture Audit can find it. */
export const hasStockDiscrepancy = (count: StockCount): boolean =>
  count.expected !== count.counted

export const GAP_MEDICATION_IDS = {
  controlledDrugWithDiscrepancy: okaforMorphine,
  omissionsResident: OKAFOR,
}
