import type {
  CareNote,
  Incident,
  IsoDate,
  IsoDateTime,
  Resident,
  Site,
} from '@/data/types'
import {
  isScheduledDaysAgo,
  marRecordsAll,
  medications,
  type MarRecord,
} from '@/data/fixtures/medications'
import { formatTime, zonedDate } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import { carePlanDomains, consentsSought, riskAssessments } from './populations'

/**
 * What the Dashboard's charts are made of. Phase 12, restyled.
 *
 * **Every series here is recorded against expected, and never a percentage.**
 * A chart of a percentage hides its own denominator, which is Rule 4 applied
 * to a shape rather than to a figure — and the shape is the harder one to
 * catch, because a bar at 92% looks like evidence whatever it is 92% of.
 *
 * **And every series says what it counts.** A sparkline with no caption is a
 * direction with no subject; the caption is what stops seven points reading as
 * whichever figure sits above them.
 */

/** How many days each sparkline and the area chart cover. */
export const SPARK_DAYS = 7

export interface DayPoint {
  date: IsoDate
  /** Days before today. 0 is today, and today is always partial. */
  daysBack: number
  value: number
}

export interface DaySeries {
  points: DayPoint[]
  /**
   * What the seven points count, in words, on the card.
   *
   * Required rather than optional: the figure above a sparkline is not always
   * the figure the record can reconstruct seven days of, and where the two
   * differ the caption is the only thing that says so.
   */
  what: string
}

/** The seven site-days ending today, oldest first. */
export function lastDays(site: Site, now: IsoDateTime, days = SPARK_DAYS): IsoDate[] {
  const out: IsoDate[] = []
  for (let back = days - 1; back >= 0; back -= 1) {
    // Arithmetic on an instant, then reduced to the site's date — never a date
    // widened into an instant.
    const at = new Date(new Date(now).getTime() - back * 86_400_000)
    out.push(zonedDate(at.toISOString() as IsoDateTime, site.timeZone))
  }
  return out
}

// ---------------------------------------------------------------------------
// Medication — the one population the record holds seven full days of
// ---------------------------------------------------------------------------

export interface DoseDay {
  date: IsoDate
  daysBack: number
  /** Given or recorded as not given. Somebody wrote something down. */
  recorded: number
  /** Due, past its window, and nobody wrote anything. */
  noRecord: number
  /** Recorded plus no-record: everything whose window has closed. */
  due: number
  /** Today only: rounds whose window has not closed yet. */
  stillToCome: number
}

/**
 * Every dose across the site, by day, for the last seven days.
 *
 * A record's `date` is already the site's day (the MAR fixture resolves it per
 * medication), so this groups on it directly rather than widening anything.
 */
export function dosesByDay(
  site: Site,
  residents: Resident[],
  now: IsoDateTime,
): DoseDay[] {
  const dates = lastDays(site, now)
  const wallNow = formatTime(now, site.timeZone)
  const mine = siteRecords(residents)

  return dates.map((date, index) => {
    const daysBack = dates.length - 1 - index
    let recorded = 0
    let noRecord = 0
    let stillToCome = 0

    for (const record of mine) {
      if (record.date !== date) continue
      if (!scheduled(record, daysBack)) continue

      switch (record.state.kind) {
        case 'given':
        case 'not_given':
          recorded += 1
          break
        case 'omitted':
          noRecord += 1
          break
        /*
         * Scheduled, with nothing recorded against it yet. Still to come if
         * its round time has not arrived in this home, or if it has and the
         * hour is not up. Both sides are wall-clock in the site's zone, so
         * there is no instant to get the kind of wrong.
         */
        case 'due':
        case 'not_due':
          if (daysBack !== 0) break
          if (record.roundTime > wallNow || withinWindow(record.roundTime, wallNow)) {
            stillToCome += 1
          }
          break
      }
    }

    return { date, daysBack, recorded, noRecord, due: recorded + noRecord, stillToCome }
  })
}

// ---------------------------------------------------------------------------
// Today — the donut and the rings
// ---------------------------------------------------------------------------

export interface RoundToday {
  /** "08:00" — a wall-clock time in the site's zone. */
  at: string
  recorded: number
  noRecord: number
  /** Inside its window now. */
  dueNow: number
  /**
   * Open within the lookahead, which is what the tile beside the chart counts.
   *
   * **Its own segment rather than folded into not-due-yet.** The tile said six
   * doses were due in the next two hours and the ring called the same six not
   * due yet, which is two true statements a reader has to reconcile on a screen
   * whose job is not making them do that.
   */
  dueSoon: number
  notDueYet: number
  /** Everything scheduled at this round today. */
  expected: number
  /** Who recorded the doses that were recorded, or that nobody did. */
  by: string[]
}

export function roundsToday(
  site: Site,
  residents: Resident[],
  now: IsoDateTime,
): RoundToday[] {
  const today = zonedDate(now, site.timeZone)
  const wallNow = formatTime(now, site.timeZone)
  const byRound = new Map<string, RoundToday>()

  for (const record of siteRecords(residents)) {
    if (record.date !== today) continue
    if (!scheduled(record, 0)) continue

    const round = byRound.get(record.roundTime) ?? {
      at: record.roundTime,
      recorded: 0,
      noRecord: 0,
      dueNow: 0,
      dueSoon: 0,
      notDueYet: 0,
      expected: 0,
      by: [] as string[],
    }
    round.expected += 1

    switch (record.state.kind) {
      case 'given':
        round.recorded += 1
        if (!round.by.includes(record.state.givenBy.displayName)) {
          round.by.push(record.state.givenBy.displayName)
        }
        break
      case 'not_given':
        round.recorded += 1
        if (!round.by.includes(record.state.recordedBy.displayName)) {
          round.by.push(record.state.recordedBy.displayName)
        }
        break
      case 'omitted':
        round.noRecord += 1
        break
      /*
       * Due now and not due yet, both read off the same clock.
       *
       * **`due` is baked into the fixture at generation and `not_due` was
       * being read live**, so the two halves of one question answered to
       * different instants: a round could have opened since the page loaded
       * and still be counted as not-due-yet, or have closed and still be
       * counted as due. The header's clock ticks and the baked state does not.
       *
       * Both are now decided by comparing the round's wall-clock time with the
       * home's, which is the same comparison `dosesByDay` makes.
       */
      case 'due':
      case 'not_due':
        if (record.roundTime > wallNow) {
          if (minutesUntil(record.roundTime, wallNow) < LOOKAHEAD_MINUTES) {
            round.dueSoon += 1
          } else round.notDueYet += 1
        } else if (withinWindow(record.roundTime, wallNow)) round.dueNow += 1
        else round.noRecord += 1
        break
    }

    byRound.set(record.roundTime, round)
  }

  return [...byRound.values()].sort((a, b) => a.at.localeCompare(b.at))
}

export interface TodayDoses {
  recorded: number
  noRecord: number
  dueNow: number
  dueSoon: number
  notDueYet: number
  /** Every dose scheduled today. The donut's denominator, stated in its centre. */
  total: number
}

/**
 * The donut, summed from the same rounds the rings render.
 *
 * **One derivation, two zoom levels.** The rings and the centre figure are the
 * same fact said twice; deriving them separately is how the two come to
 * disagree by one dose and nobody can say which is right.
 */
export function todayDoses(rounds: RoundToday[]): TodayDoses {
  const sum = (pick: (round: RoundToday) => number) =>
    rounds.reduce((running, round) => running + pick(round), 0)

  return {
    recorded: sum((round) => round.recorded),
    noRecord: sum((round) => round.noRecord),
    dueNow: sum((round) => round.dueNow),
    dueSoon: sum((round) => round.dueSoon),
    notDueYet: sum((round) => round.notDueYet),
    total: sum((round) => round.expected),
  }
}

// ---------------------------------------------------------------------------
// The sparklines
// ---------------------------------------------------------------------------

/**
 * Doses nobody recorded, by day.
 *
 * **This is the sparkline under "Already late", and it is not that figure.**
 * The tile counts doses, reviews past their date and unsigned handovers
 * together; of the three, only the doses can be reconstructed for a past day.
 * A review completed since carries no record of the day it stopped being
 * overdue, and an unsigned handover carries no record of the day it was
 * signed — so a seven-day line of the composite would be this week's number
 * drawn backwards over a week that did not have it.
 *
 * The caption is therefore load-bearing rather than decorative: the line says
 * doses, and the words say doses.
 */
export function omissionsByDay(days: DoseDay[]): DaySeries {
  return {
    points: days.map((day) => ({
      date: day.date,
      daysBack: day.daysBack,
      value: day.noRecord,
    })),
    what: 'doses with no record, each of the last seven days',
  }
}

export function dosesDueByDay(days: DoseDay[]): DaySeries {
  return {
    points: days.map((day) => ({
      date: day.date,
      daysBack: day.daysBack,
      value: day.due + day.stillToCome,
    })),
    what: 'doses due, each of the last seven days',
  }
}

/** Residents with no care note on that site-day. Reconstructable exactly. */
export function unwrittenByDay(
  site: Site,
  residents: Resident[],
  notes: CareNote[],
  now: IsoDateTime,
): DaySeries {
  const dates = lastDays(site, now)
  const written = new Map<IsoDate, Set<string>>()
  for (const date of dates) written.set(date, new Set())

  for (const note of notes) {
    const date = zonedDate(note.recordedAt, site.timeZone)
    written.get(date)?.add(note.residentId)
  }

  return {
    points: dates.map((date, index) => ({
      date,
      daysBack: dates.length - 1 - index,
      value: residents.length - (written.get(date)?.size ?? 0),
    })),
    what: 'residents with no care note, each of the last seven days',
  }
}

/**
 * Incidents reported by the end of a day and not acknowledged by then.
 *
 * Exact, because every acknowledged state carries the moment it happened —
 * the record keeps what this is derived from, which is the whole reason this
 * line can exist and the "already late" one cannot.
 */
export function unacknowledgedByDay(
  site: Site,
  incidents: Incident[],
  now: IsoDateTime,
): DaySeries {
  const dates = lastDays(site, now)

  return {
    points: dates.map((date, index) => {
      let waiting = 0
      for (const incident of incidents) {
        if (zonedDate(incident.occurredAt, site.timeZone) > date) continue
        const status = incident.status
        if (status.kind === 'reported_not_acknowledged') {
          waiting += 1
          continue
        }
        if (zonedDate(status.acknowledged.at, site.timeZone) > date) waiting += 1
      }
      return { date, daysBack: dates.length - 1 - index, value: waiting }
    }),
    what: 'incidents reported and not yet acknowledged, at the end of each day',
  }
}

// ---------------------------------------------------------------------------
// What the record holds, by module
// ---------------------------------------------------------------------------

export interface ModuleBar {
  id: string
  label: string
  recorded: number
  expected: number
  /** What the bar counts, named beside the figure. */
  of: string
  /**
   * Whether the remainder is evidence nobody has written, or a finding.
   *
   * An unacknowledged incident *was* written down — somebody reported it — so
   * its remainder is a finding and takes the critical treatment, not the
   * hatch. Hatching it would recruit a recorded fact into the missing-evidence
   * count, which is the aggregate form of calling a recorded negative a blank.
   */
  remainder: 'never_written' | 'finding'
}

export function moduleBars(input: {
  residents: Resident[]
  writtenUpToday: number
  doses: DoseDay
  acknowledged: number
  incidentsTotal: number
}): ModuleBar[] {
  const assessments = riskAssessments(input.residents)
  const domains = carePlanDomains(input.residents)
  const consents = consentsSought(input.residents)

  return [
    {
      id: 'care-notes',
      label: 'Care notes, today',
      recorded: input.writtenUpToday,
      expected: input.residents.length,
      of: 'residents',
      remainder: 'never_written',
    },
    {
      id: 'medication',
      label: 'Medication, today',
      recorded: input.doses.recorded,
      expected: input.doses.due,
      of: 'due so far',
      remainder: 'never_written',
    },
    {
      id: 'risk-assessments',
      label: 'Risk assessments',
      recorded: assessments.recorded,
      expected: assessments.expected,
      of: 'expected',
      remainder: 'never_written',
    },
    {
      id: 'care-plan-domains',
      label: 'Care plan domains',
      recorded: domains.recorded,
      expected: domains.expected,
      of: 'expected',
      remainder: 'never_written',
    },
    {
      id: 'consents',
      label: 'Consents',
      recorded: consents.recorded,
      expected: consents.expected,
      of: 'expected',
      remainder: 'never_written',
    },
    {
      id: 'incidents',
      label: 'Incidents acknowledged',
      recorded: input.acknowledged,
      expected: input.incidentsTotal,
      of: 'on record',
      remainder: 'finding',
    },
  ]
}

// ---------------------------------------------------------------------------

const residentIds = (residents: Resident[]) => new Set(residents.map((one) => one.id))

function siteRecords(residents: Resident[]): MarRecord[] {
  const ids = residentIds(residents)
  return marRecordsAll.filter((record) => ids.has(record.residentId))
}

/**
 * Whether this record's drug falls due at all on that day.
 *
 * `not_due` says both "this drug is not on schedule today" and "this round has
 * not opened yet", and only the second belongs in a count of what is still to
 * come. The medication's own schedule is what tells them apart.
 */
/**
 * Whether a round that has arrived is still inside its hour.
 *
 * Wall-clock against wall-clock, in the site's zone, so there is no instant
 * here to get the kind of wrong. A round whose hour has passed with nothing
 * recorded against it is not due, it is missing.
 */
function withinWindow(roundTime: string, wallNow: string): boolean {
  const minutes = (clock: string) => {
    const [hours, mins] = clock.split(':').map(Number)
    return (hours ?? 0) * 60 + (mins ?? 0)
  }
  const since = minutes(wallNow) - minutes(roundTime)
  return since >= 0 && since < MEDICATION_WINDOW_MINUTES
}

/** How long a round stays open. The MAR fixture uses the same hour. */
const MEDICATION_WINDOW_MINUTES = 60

/** The same lookahead the "due in the next N hours" tile counts over. */
const LOOKAHEAD_MINUTES = MEDICATION_LOOKAHEAD_HOURS * 60

/** How long until a round opens, in minutes of the home's own clock. */
function minutesUntil(roundTime: string, wallNow: string): number {
  const minutes = (clock: string) => {
    const [hours, mins] = clock.split(':').map(Number)
    return (hours ?? 0) * 60 + (mins ?? 0)
  }
  return minutes(roundTime) - minutes(wallNow)
}

const byId = new Map(medications.map((one) => [one.id, one]))

function scheduled(record: MarRecord, daysBack: number): boolean {
  const medication = byId.get(record.medicationId)
  return medication !== undefined && isScheduledDaysAgo(medication, daysBack)
}
