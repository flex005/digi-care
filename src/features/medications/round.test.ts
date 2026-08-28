import { describe, expect, it } from 'vitest'
import type {
  IsoDate,
  IsoDateTime,
  Medication,
  Resident,
  StockBalance,
} from '@/data/types'
import { staffNwosu } from '@/data/fixtures/organisation'
import type { MarRecord } from '@/data/fixtures/medications'
import {
  EMPTY_ANSWER,
  buildRound,
  currentRound,
  discrepancyIn,
  outstanding,
  type Answer,
} from './round'

/**
 * The round, before anything renders it.
 *
 * Pure and instant-free, so these assert the rule rather than the hour the
 * suite runs (§8).
 */

const DATE = '2026-08-22' as IsoDate

const resident = (id: string, room: string | 'none'): Resident =>
  ({
    id,
    preferredName: id,
    fullLegalName: id,
    room:
      room === 'none'
        ? { kind: 'not_recorded' }
        : { kind: 'recorded', value: room, recordedBy: {}, recordedAt: '' },
  }) as unknown as Resident

const med = (
  id: string,
  residentId: string,
  rounds: string[],
  extra: Partial<Medication> = {},
): Medication =>
  ({
    id,
    residentId,
    name: id,
    dose: '5mg',
    // A whole tablet, so the arithmetic in these cases is one for one. The
    // fractional case — 1.25ml of oral solution — is covered where it lives,
    // against the real fixture.
    doseQuantity: 1,
    stockUnit: 'tablets',
    form: '5mg · tablets',
    route: 'Oral',
    roundTimes: rounds,
    isControlledDrug: false,
    isPrn: false,
    ...extra,
  }) as unknown as Medication

const cell = (
  medicationId: string,
  residentId: string,
  roundTime: string,
  kind: string,
): MarRecord =>
  ({
    medicationId,
    residentId,
    roundTime,
    date: DATE,
    state:
      kind === 'due'
        ? { kind: 'due', windowOpensAt: '', windowClosesAt: '' }
        : kind === 'given'
          ? {
              kind: 'given',
              givenAt: '',
              givenBy: {},
              witness: { kind: 'not_required' },
            }
          : { kind: 'not_due' },
  }) as unknown as MarRecord

describe('the round goes in room order', () => {
  it('sorts by room number, not by name', () => {
    // The trolley goes down a corridor. Any other order makes somebody walk it
    // twice or skip a door.
    const residents = [resident('Zara', '22'), resident('Alan', '4')]
    const meds = [med('m1', 'Zara', ['08:00']), med('m2', 'Alan', ['08:00'])]
    const records = [
      cell('m1', 'Zara', '08:00', 'due'),
      cell('m2', 'Alan', '08:00', 'due'),
    ]

    const round = buildRound(residents, meds, records, '08:00', DATE)
    expect(round.residents.map((entry) => entry.resident.id)).toEqual(['Alan', 'Zara'])
  })

  it('sorts 4 before 22, not "22" before "4"', () => {
    const residents = [resident('a', '4'), resident('b', '22')]
    const meds = [med('m1', 'a', ['08:00']), med('m2', 'b', ['08:00'])]
    const records = [cell('m1', 'a', '08:00', 'due'), cell('m2', 'b', '08:00', 'due')]
    const round = buildRound(residents, meds, records, '08:00', DATE)
    expect(round.residents.map((entry) => entry.resident.id)).toEqual(['a', 'b'])
  })

  it('keeps a resident whose room is unrecorded, at the end', () => {
    // Absent from the list is the same bug as a blank cell: somebody with no
    // room recorded still has medication due.
    const residents = [resident('nowhere', 'none'), resident('a', '4')]
    const meds = [med('m1', 'nowhere', ['08:00']), med('m2', 'a', ['08:00'])]
    const records = [
      cell('m1', 'nowhere', '08:00', 'due'),
      cell('m2', 'a', '08:00', 'due'),
    ]
    const round = buildRound(residents, meds, records, '08:00', DATE)
    expect(round.residents.map((entry) => entry.resident.id)).toEqual(['a', 'nowhere'])
  })
})

describe('PRN is available, never due', () => {
  it('keeps a PRN medication out of the due list', () => {
    // Paracetamol is not due at 08:00; it is available. In the due list, not
    // giving it would read as an omission — a claim somebody missed a dose
    // nobody was ever supposed to give.
    const residents = [resident('a', '4')]
    const meds = [
      med('scheduled', 'a', ['08:00']),
      med('paracetamol', 'a', ['08:00'], { isPrn: true }),
    ]
    const records = [
      cell('scheduled', 'a', '08:00', 'due'),
      cell('paracetamol', 'a', '08:00', 'due'),
    ]

    const round = buildRound(residents, meds, records, '08:00', DATE)
    const entry = round.residents[0]!
    expect(entry.due.map((dose) => dose.medication.id)).toEqual(['scheduled'])
    expect(entry.available.map((m) => m.id)).toEqual(['paracetamol'])
  })
})

describe('which round a nurse is standing in front of', () => {
  const rounds = ['08:00', '14:00', '18:00', '20:00']

  it('lands on the round already open, not the nearest one', () => {
    // At 09:30 the 08:00 round is the one being caught up on. Jumping ahead to
    // 14:00 would hide it.
    expect(currentRound(rounds, '09:30')).toBe('08:00')
    expect(currentRound(rounds, '08:05')).toBe('08:00')
    expect(currentRound(rounds, '13:59')).toBe('08:00')
    expect(currentRound(rounds, '14:00')).toBe('14:00')
    expect(currentRound(rounds, '23:59')).toBe('20:00')
  })

  it('lands on the first round before the day starts', () => {
    expect(currentRound(rounds, '03:00')).toBe('08:00')
  })
})

describe('nothing is left blank', () => {
  const paracetamol = med('Paracetamol', 'a', ['08:00'])
  const oramorph = med('Oramorph', 'a', ['08:00'], { isControlledDrug: true })
  const due = [
    { medication: paracetamol, record: {} as MarRecord, state: { kind: 'due' } },
    { medication: oramorph, record: {} as MarRecord, state: { kind: 'due' } },
  ] as never
  const stock = (): StockBalance => ({
    kind: 'counted',
    value: 12,
    countedAt: '2026-08-20T20:05:00.000Z' as IsoDateTime,
    countedBy: staffNwosu,
  })

  /** A controlled drug nobody has counted. Not zero, and not a smaller number. */
  const uncounted = (): StockBalance => ({ kind: 'no_balance_recorded' })

  const answers = (over: Record<string, Partial<Answer>>): Record<string, Answer> =>
    Object.fromEntries(
      Object.entries(over).map(([id, value]) => [id, { ...EMPTY_ANSWER, ...value }]),
    )

  it('names an unanswered dose rather than counting it', () => {
    // Used standing up, with a trolley. "3 doses need attention" makes
    // somebody hunt; naming them says where to look.
    expect(outstanding(due, {}, stock)).toEqual([
      'Paracetamol: nothing recorded',
      'Oramorph: nothing recorded',
    ])
  })

  it('holds a not-given without a reason', () => {
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'not_given' },
        Oramorph: { choice: 'given', witness: 's1', stockAfter: '11' },
      }),
      stock,
    )
    expect(waiting).toEqual(['Paracetamol: no reason'])
  })

  it('holds "other" without the words', () => {
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'not_given', reason: 'other' },
        Oramorph: { choice: 'given', witness: 's1', stockAfter: '11' },
      }),
      stock,
    )
    expect(waiting).toEqual(['Paracetamol: no reason given'])
  })

  it('holds a controlled drug with no witness', () => {
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'given' },
        Oramorph: { choice: 'given' },
      }),
      stock,
    )
    expect(waiting).toEqual(['Oramorph: no witness'])
  })

  it('does not hold the round up for a count that does not reconcile', () => {
    /*
     * This asserted the opposite until the rule changed, and the change is the
     * point rather than the assertion being loosened (§8).
     *
     * Blocking converted an accounting problem into a medication-record gap
     * with nobody's name on it — the worse of the two failures. The dose
     * records; the discrepancy is raised against the count.
     */
    const answered = answers({
      Paracetamol: { choice: 'given' },
      Oramorph: { choice: 'given', witness: 's1', stockAfter: '10' },
    })
    expect(outstanding(due, answered, stock)).toEqual([])
  })

  it('names the discrepancy the count raises', () => {
    const answer = {
      ...EMPTY_ANSWER,
      choice: 'given' as const,
      witness: 's1',
      stockAfter: '10',
    }
    expect(discrepancyIn(answer, oramorph, stock())).toEqual({
      expected: 11,
      counted: 10,
    })

    // A count that comes out raises nothing.
    expect(discrepancyIn({ ...answer, stockAfter: '11' }, oramorph, stock())).toBe(
      'none',
    )
    // And a drug with no balance has nothing to differ from — that is the
    // opening count, not a discrepancy.
    expect(discrepancyIn(answer, oramorph, uncounted())).toBe('none')
  })

  it('never puts a not-due dose on the round', () => {
    // A patch changed every third day has a cell on the other two saying
    // `not_due`. Asking for an answer would put it on the trolley two days out
    // of three, which for fentanyl is an overdose.
    const round = buildRound(
      [resident('Doris', '311')],
      [med('patch', 'Doris', ['08:00'], { intervalDays: 3 })],
      [cell('patch', 'Doris', '08:00', 'not_due')],
      '08:00',
      DATE,
    )
    expect(round.residents).toEqual([])
  })

  it('asks for an opening count where no balance has ever been recorded', () => {
    // Not "no stock count". There is no stock count to be short of — what is
    // missing is the first one, and naming it opening is what tells the
    // register where the running total started.
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'given' },
        Oramorph: { choice: 'given', witness: 's1' },
      }),
      uncounted,
    )
    expect(waiting).toEqual(['Oramorph: no opening count'])
  })

  it('does not ask for a stock-after figure as well as an opening count', () => {
    // One count, not two. `stockAfter` stays empty and the round is complete:
    // asking for both would be asking somebody to count the same cabinet twice.
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'given' },
        Oramorph: { choice: 'given', witness: 's1', openingCount: '40' },
      }),
      uncounted,
    )
    expect(waiting).toEqual([])
  })

  it('cannot fail to reconcile against a balance nobody has taken', () => {
    // The figure that came out of `?? 0` made every count a discrepancy and
    // demanded −1 to clear it. An opening count has nothing to differ from, so
    // no figure it carries can be wrong — which is what makes it opening.
    for (const counted of ['0', '10', '11', '99']) {
      const waiting = outstanding(
        due,
        answers({
          Paracetamol: { choice: 'given' },
          Oramorph: { choice: 'given', witness: 's1', openingCount: counted },
        }),
        uncounted,
      )
      expect(waiting, `counted ${counted}`).toEqual([])
    }
  })

  it('still requires the witness that signs the opening balance', () => {
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'given' },
        Oramorph: { choice: 'given', openingCount: '40' },
      }),
      uncounted,
    )
    expect(waiting).toEqual(['Oramorph: no witness'])
  })

  it('is satisfied only when every dose has a complete answer', () => {
    const waiting = outstanding(
      due,
      answers({
        Paracetamol: { choice: 'not_given', reason: 'resident_refused' },
        Oramorph: { choice: 'given', witness: 's1', stockAfter: '11' },
      }),
      stock,
    )
    expect(waiting).toEqual([])
  })

  it('does not require a witness on a drug that is not controlled', () => {
    const waiting = outstanding(
      [due[0]] as never,
      answers({ Paracetamol: { choice: 'given' } }),
      stock,
    )
    expect(waiting).toEqual([])
  })
})
