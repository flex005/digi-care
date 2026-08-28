import type {
  Change,
  Period,
  ReportCell,
  ReportFinding,
  ReportResult,
  ReportRow,
} from '@/data/types'
import {
  CARE_NOTE_CATEGORIES,
  CONSENT_TYPES,
  COMMUNAL_AREAS,
  INCIDENT_TYPES,
  RISK_ASSESSMENT_TEMPLATES,
  STAFF_ROLE_NAMES,
  subjectResidentId,
} from '@/data/types'
import { hasAccess } from '@/data/access/team-store'
import { DOCUMENT_CATEGORIES } from '@/features/documents/categories'
import { expiryFinding } from '@/features/documents/expiry'
import { formatCount, formatDate, pluralise, zonedDate } from '@/lib/format'
import type { ReportDefinition, ReportId } from './catalogue'
import { fellDueAt, type ReportData } from './data'
import { describePeriod, within } from './period'
import { dueSoonDays, minPopulationForARate } from '@/data/access/settings-store'

/**
 * What each report counts. Phase 13.
 *
 * **Every figure here goes through `rate()`**, so no report can forget the
 * population floor, and every row below it keeps its counts while losing only
 * its rate. Removing those rows would make a table look complete.
 */

export interface RunInput {
  data: ReportData
  definition: ReportDefinition
  period: Period
  /** Absent where the report is a state rather than a flow. */
  previous: Period | undefined
  cut: string
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const count = (value: number): ReportCell => ({ kind: 'count', value })

/**
 * A rate, or the statement that this row cannot support one.
 *
 * One helper, applied everywhere, for the reason the compliance `reading()`
 * exists: a floor applied per call site is a floor some call site forgets.
 */
function rate(
  covered: number,
  total: number,
  missing: string,
  /**
   * What decides whether a figure is supportable, where that is not the
   * denominator itself.
   *
   * A staff member who recorded nothing has a coverage of 0 of 28 residents —
   * a denominator of 28 supports a rate perfectly well, and "0.0%" against
   * somebody who did not work is precisely the accusation Frank's constraint
   * forbids. What is thin there is the person's presence in the period, so
   * that is what the floor is applied to.
   */
  population?: number,
): ReportCell {
  const coverage = { covered, total }
  if ((population ?? total) < minPopulationForARate()) {
    return {
      kind: 'insufficient',
      aggregate: {
        kind: 'insufficient_evidence',
        coverage,
        missingDescription: missing,
      },
    }
  }
  return {
    kind: 'rate',
    aggregate: {
      kind: 'measured',
      unit: 'percentage',
      value: Math.round((covered / total) * 1000) / 10,
      coverage,
    },
  }
}

/**
 * How this period compares with the one before it.
 *
 * **Rates, not raw counts.** Eleven omissions against 420 doses and six
 * against 180 are the same direction on counts and opposite directions on
 * rates, and the rate is what the row states. Where either period is below the
 * floor there is nothing to compare and the cell says so rather than printing
 * a change nobody measured.
 */
function change(input: {
  now: { covered: number; total: number }
  before: { covered: number; total: number }
  /** Whether a smaller figure is the better news. */
  lowerIsBetter: boolean
}): Change {
  const { now, before, lowerIsBetter } = input
  if (now.total < minPopulationForARate() || before.total < minPopulationForARate()) {
    return { kind: 'no_comparison' }
  }

  const nowRate = (now.covered / now.total) * 100
  const beforeRate = (before.covered / before.total) * 100
  const was = `${(Math.round(beforeRate * 10) / 10).toFixed(1)}%`

  if (Math.round(nowRate * 10) === Math.round(beforeRate * 10)) {
    return { kind: 'unchanged', was }
  }
  const improved = lowerIsBetter ? nowRate < beforeRate : nowRate > beforeRate
  return improved ? { kind: 'better', was } : { kind: 'worse', was }
}

const changeCell = (value: Change): ReportCell => ({ kind: 'change', change: value })

const row = (input: {
  id: string
  name: string
  note?: string
  thin?: boolean
  deactivated?: boolean
  cells: ReportCell[]
}): ReportRow => ({
  id: input.id,
  name: input.name,
  note: input.note ?? '',
  thin: input.thin ?? false,
  deactivated: input.deactivated ?? false,
  cells: input.cells,
})

const thinRows = (rows: ReportRow[]) => rows.filter((entry) => entry.thin).length

/**
 * The finding a report leads on when most of it cannot support a figure.
 *
 * The same 60% the compliance panels use, read over rows rather than checks —
 * one constant, one meaning, two consumers.
 */
function thinnessFinding(rows: ReportRow[], what: string): ReportFinding | undefined {
  if (rows.length === 0) {
    return {
      kind: 'too_thin',
      figure: '0',
      title: `nothing in this period to report on`,
      detail: `Nothing was recorded here in the period, so there is no figure to state. The table below is empty rather than reassuring.`,
    }
  }
  const usable = rows.length - thinRows(rows)
  if (usable / rows.length >= 0.6) return undefined
  return {
    kind: 'too_thin',
    figure: `${formatCount(usable)}`,
    title: `of ${formatCount(rows.length)} ${what} have enough in the period to say anything about`,
    detail:
      'Fewer than three in five rows can support a figure, so neither can the table as a whole. The rows stay below, because removing them would make it look complete.',
  }
}

// ---------------------------------------------------------------------------
// Medication omissions
// ---------------------------------------------------------------------------

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface Tally {
  due: number
  missed: number
  name: string
  note: string
  /** Who the rows are aggregated over, so a drug row can say how many. */
  onIt: Set<string>
}

function omissionTally(input: RunInput, period: Period): Map<string, Tally> {
  const { data, cut } = input
  const tallies = new Map<string, Tally>()
  const medicationById = new Map(data.medications.map((entry) => [entry.id, entry]))
  const residentById = new Map(data.residents.map((entry) => [entry.id, entry]))

  for (const record of data.marRecords) {
    const when = fellDueAt(record)
    if (when === 'not_due') continue
    if (!within(when, period, data.site.timeZone)) continue

    const medication = medicationById.get(record.medicationId)
    if (medication === undefined) continue

    /*
     * **The drug, not the prescription.** Keyed on the medication id, "by
     * drug" rendered one row per resident-prescription: morphine appeared
     * three times and paracetamol three times, which is a per-resident table
     * wearing a per-drug label and cannot answer the question the report
     * exists for. The key is the drug and its dose; the row says how many
     * people are on it.
     */
    let key = `${medication.name} ${medication.dose}`
    let name = medication.name
    let note = `${medication.dose}${medication.isControlledDrug ? ' · controlled' : ''}`

    if (cut === 'round') {
      key = record.roundTime
      name = `${record.roundTime} round`
      note = 'every drug due at this time'
    } else if (cut === 'weekday') {
      const day = new Date(`${zonedDate(when, data.site.timeZone)}T12:00:00.000Z`)
      key = String(day.getUTCDay())
      name = WEEKDAYS[day.getUTCDay()] ?? 'Unknown'
      note = 'every round on this day'
    } else if (cut === 'resident') {
      const resident = residentById.get(record.residentId)
      key = record.residentId
      name = resident?.fullLegalName ?? 'Resident not found'
      note =
        resident?.room.kind === 'recorded'
          ? `Room ${resident.room.value}`
          : 'room not recorded'
    }

    const held = tallies.get(key) ?? {
      due: 0,
      missed: 0,
      name,
      note,
      onIt: new Set<string>(),
    }
    held.due += 1
    if (record.state.kind === 'omitted') held.missed += 1
    held.onIt.add(record.residentId)
    tallies.set(key, held)
  }

  return tallies
}

function medicationOmissions(input: RunInput): ReportResult {
  const now = omissionTally(input, input.period)
  const before =
    input.previous === undefined
      ? new Map<string, Tally>()
      : omissionTally(input, input.previous)

  const rows = [...now.entries()]
    .sort((a, b) => b[1].missed - a[1].missed || a[1].name.localeCompare(b[1].name))
    .map(([key, tally]) => {
      const previous = before.get(key)
      return row({
        id: key,
        name: tally.name,
        note:
          input.cut === 'drug'
            ? `${tally.note} · ${pluralise(tally.onIt.size, 'resident')}`
            : tally.note,
        thin: tally.due < minPopulationForARate(),
        cells: [
          count(tally.due),
          count(tally.missed),
          rate(
            tally.missed,
            tally.due,
            `Only ${pluralise(tally.due, 'dose')} fell due here in the period: too few to support a rate.`,
          ),
          changeCell(
            previous === undefined
              ? { kind: 'no_comparison' }
              : change({
                  now: { covered: tally.missed, total: tally.due },
                  before: { covered: previous.missed, total: previous.due },
                  lowerIsBetter: true,
                }),
          ),
        ],
      })
    })

  const due = [...now.values()].reduce((running, tally) => running + tally.due, 0)
  const missed = [...now.values()].reduce((running, tally) => running + tally.missed, 0)
  const beforeDue = [...before.values()].reduce(
    (running, tally) => running + tally.due,
    0,
  )
  const beforeMissed = [...before.values()].reduce(
    (running, tally) => running + tally.missed,
    0,
  )

  const worst = rows.find((entry) => !entry.thin)

  return {
    finding:
      thinnessFinding(rows, 'rows') ??
      ({
        kind: 'finding',
        figure: formatCount(missed),
        title: `doses with no record, of ${formatCount(due)} due: ${((missed / Math.max(due, 1)) * 100).toFixed(1)}%`,
        detail:
          (input.previous === undefined
            ? ''
            : `Against ${formatCount(beforeMissed)} of ${formatCount(beforeDue)} in the preceding ${pluralise(input.previous.days, 'day')}. `) +
          (worst === undefined ? '' : `The largest single share is ${worst.name}.`),
      } satisfies ReportFinding),
    restated: restate(input, 'doses with no record, of doses due'),
    columns: [
      { label: cutLabel(input), numeric: false },
      { label: 'Doses due', numeric: true },
      { label: 'No record', numeric: true },
      { label: 'Rate', numeric: true },
      { label: 'Against last period', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Controlled drug reconciliation
// ---------------------------------------------------------------------------

function controlledDrugs(input: RunInput): ReportResult {
  const { data, period } = input
  const controlled = data.medications.filter((entry) => entry.isControlledDrug)

  const rows = controlled
    .map((medication) => {
      const counts = data.stockCounts.filter(
        (stock) =>
          stock.medicationId === medication.id &&
          within(stock.countedAt, period, data.site.timeZone),
      )
      const routine = counts.filter((stock) => stock.entry.kind === 'routine')
      const agreed = routine.filter(
        (stock) =>
          stock.entry.kind === 'routine' && stock.entry.expected === stock.counted,
      ).length
      const opening = counts.some((stock) => stock.entry.kind === 'opening')

      return row({
        id: medication.id,
        name: medication.name,
        note: `${medication.dose}${opening ? ' · opening count in the period' : ''}`,
        thin: routine.length < minPopulationForARate(),
        cells: [
          count(counts.length),
          count(routine.length - agreed),
          rate(
            agreed,
            routine.length,
            routine.length === 0
              ? 'No routine count has been made here in the period, so there is nothing to reconcile.'
              : `Only ${pluralise(routine.length, 'routine count')} in the period: too few to support a rate.`,
          ),
        ],
      })
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const discrepancies = rows.reduce(
    (running, entry) =>
      running + (entry.cells[1]?.kind === 'count' ? entry.cells[1].value : 0),
    0,
  )

  return {
    finding:
      thinnessFinding(rows, 'controlled drugs') ??
      ({
        kind: 'finding',
        figure: formatCount(discrepancies),
        title: `counts did not match the register, across ${pluralise(rows.length, 'controlled drug')}`,
        detail:
          'A count that does not reconcile is an incident in its own right. A drug with no routine count in the period has nothing to reconcile and says so rather than reading as agreed.',
      } satisfies ReportFinding),
    restated: restate(input, 'counts and whether they reconciled'),
    columns: [
      { label: 'Controlled drug', numeric: false },
      { label: 'Counts in period', numeric: true },
      { label: 'Did not match', numeric: true },
      { label: 'Reconciled', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

function incidentKey(input: RunInput, incident: (typeof input.data.incidents)[number]) {
  if (input.cut === 'location') {
    const location = incident.location
    if (location.kind === 'communal') {
      const area = COMMUNAL_AREAS.find((entry) => entry.id === location.area)
      return {
        key: location.area,
        name: area?.name ?? location.area,
        note: 'communal area',
      }
    }
    if (location.kind === 'resident_room') {
      // Every room together, not one row per room: a report with 28 rows of
      // one incident each is a list of incidents wearing a table.
      return { key: 'resident_room', name: 'A resident’s room', note: 'private rooms' }
    }
    /*
     * Its own row rather than dropped. An incident nobody recorded a place for
     * is a gap in the record, and leaving it out would make the places that
     * were recorded add up to everything.
     */
    return {
      key: 'not_recorded',
      name: 'No location recorded',
      note: 'nobody wrote down where',
    }
  }
  if (input.cut === 'severity') {
    return {
      key: incident.severity,
      name: severityName(incident.severity),
      note: 'harm caused',
    }
  }
  const type = INCIDENT_TYPES.find((entry) => entry.id === incident.type)
  return { key: incident.type, name: type?.name ?? 'Incident', note: 'incident type' }
}

const severityName = (id: string) =>
  ({
    no_harm: 'No harm',
    low_harm: 'Low harm',
    moderate_harm: 'Moderate harm',
    severe_harm: 'Severe harm',
  })[id] ?? id

function incidentsByType(input: RunInput): ReportResult {
  const { data, period, previous } = input

  const tally = (window: Period) => {
    const counts = new Map<string, { name: string; note: string; total: number }>()
    for (const incident of data.incidents) {
      if (!within(incident.occurredAt, window, data.site.timeZone)) continue
      const { key, name, note } = incidentKey(input, incident)
      const held = counts.get(key) ?? { name, note, total: 0 }
      held.total += 1
      counts.set(key, held)
    }
    return counts
  }

  const now = tally(period)
  const before = previous === undefined ? new Map() : tally(previous)
  const total = [...now.values()].reduce((running, entry) => running + entry.total, 0)
  const beforeTotal = [...before.values()].reduce(
    (running: number, entry) => running + entry.total,
    0,
  )

  const rows = [...now.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[1].name.localeCompare(b[1].name))
    .map(([key, entry]) =>
      row({
        id: key,
        name: entry.name,
        note: entry.note,
        // An incident count is a count, not a rate, so the floor does not
        // apply to the row — it applies to the share it is a share of.
        thin: total < minPopulationForARate(),
        cells: [
          count(entry.total),
          rate(
            entry.total,
            total,
            `Only ${pluralise(total, 'incident')} in the period: too few for a share to mean anything.`,
          ),
          changeCell(
            previous === undefined
              ? { kind: 'no_comparison' }
              : change({
                  now: { covered: entry.total, total: Math.max(total, 1) },
                  before: {
                    covered: before.get(key)?.total ?? 0,
                    total: Math.max(beforeTotal, 1),
                  },
                  lowerIsBetter: true,
                }),
          ),
        ],
      }),
    )

  return {
    finding:
      thinnessFinding(rows, 'kinds of incident') ??
      ({
        kind: 'finding',
        figure: formatCount(total),
        title: `incidents in the period, across ${pluralise(rows.length, 'kind')}`,
        detail:
          previous === undefined
            ? 'Nothing to compare this with; the period comparison is off.'
            : `Against ${formatCount(beforeTotal)} in the preceding ${pluralise(previous.days, 'day')}. A share of a small total moves a long way on one incident, which is why a thin period says so rather than showing percentages.`,
      } satisfies ReportFinding),
    restated: restate(input, 'incidents, as a share of incidents in the period'),
    columns: [
      { label: cutLabel(input), numeric: false },
      { label: 'Incidents', numeric: true },
      { label: 'Share', numeric: true },
      { label: 'Against last period', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Risk assessment and review coverage
// ---------------------------------------------------------------------------

function assessmentCoverage(input: RunInput): ReportResult {
  const { data, period } = input

  const rows = RISK_ASSESSMENT_TEMPLATES.map((template) => {
    let assessed = 0
    let inPeriod = 0
    for (const resident of data.residents) {
      const status = resident.risks[template.id]
      if (status?.kind !== 'assessed') continue
      assessed += 1
      if (within(status.assessedAt, period, data.site.timeZone)) inPeriod += 1
    }

    const overdue = data.reviews.items.filter(
      (item) =>
        item.kind === 'risk_assessment' &&
        item.label === template.name &&
        item.standing.kind === 'overdue',
    ).length

    return row({
      id: template.id,
      name: template.name,
      note: template.framework,
      thin: data.residents.length < minPopulationForARate(),
      cells: [
        count(data.residents.length),
        count(assessed),
        count(inPeriod),
        count(overdue),
        rate(
          assessed,
          data.residents.length,
          `Only ${pluralise(data.residents.length, 'resident')} here: too few to support a rate.`,
        ),
      ],
    })
  })

  const expected = data.residents.length * RISK_ASSESSMENT_TEMPLATES.length
  const never = rows.reduce(
    (running, entry) =>
      running +
      (entry.cells[0]?.kind === 'count' && entry.cells[1]?.kind === 'count'
        ? entry.cells[0].value - entry.cells[1].value
        : 0),
    0,
  )

  return {
    finding:
      thinnessFinding(rows, 'assessments') ??
      ({
        kind: 'finding',
        figure: formatCount(never),
        title: `of ${formatCount(expected)} expected assessments have never been done`,
        detail: `Assessed in the period counts work done between ${describePeriod(period)}; never assessed is the whole record, because an assessment nobody has ever done is not a fact about this month.`,
      } satisfies ReportFinding),
    restated: restate(input, 'assessments, of residents at this site'),
    columns: [
      { label: 'Assessment', numeric: false },
      { label: 'Residents', numeric: true },
      { label: 'Ever assessed', numeric: true },
      { label: 'Assessed in period', numeric: true },
      { label: 'Past review date', numeric: true },
      { label: 'Coverage', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Care note coverage — the staff report
// ---------------------------------------------------------------------------

function careNoteCoverage(input: RunInput): ReportResult {
  const { data, period, cut } = input

  const notes = data.notes.filter((note) =>
    within(note.recordedAt, period, data.site.timeZone),
  )

  if (cut === 'shift') {
    const rows = (['early', 'late', 'night'] as const).map((shift) => {
      const written = notes.filter((note) => note.shift.value === shift)
      const residents = new Set(written.map((note) => note.residentId)).size
      return row({
        id: shift,
        name: `${shift.charAt(0).toUpperCase()}${shift.slice(1)} shift`,
        note: 'every note recorded on this shift',
        thin: written.length < minPopulationForARate(),
        cells: [
          count(written.length),
          count(residents),
          rate(
            residents,
            data.residents.length,
            `Only ${pluralise(written.length, 'note')} on this shift in the period.`,
          ),
        ],
      })
    })

    return {
      finding:
        thinnessFinding(rows, 'shifts') ??
        ({
          kind: 'finding',
          figure: formatCount(notes.length),
          title: `notes written in the period, across ${pluralise(data.residents.length, 'resident')}`,
          detail:
            'Residents seen is the count of people written up at least once on that shift, not the count of notes, one shift writing forty notes about four people has covered four people.',
        } satisfies ReportFinding),
      restated: restate(input, 'notes and the residents they were about'),
      columns: [
        { label: 'Shift', numeric: false },
        { label: 'Notes written', numeric: true },
        { label: 'Residents seen', numeric: true },
        { label: 'Of residents here', numeric: true },
      ],
      rows,
      exportWouldContain: exportLine(input, rows),
    }
  }

  /*
   * By staff member. **Ordered by name and by nothing else**, so the table
   * cannot be read as a ranking, and every figure sits beside the denominator
   * that makes it mean something.
   */
  const rounds = new Map<string, number>()
  for (const record of data.marRecords) {
    const when = fellDueAt(record)
    if (when === 'not_due' || !within(when, period, data.site.timeZone)) continue
    if (record.state.kind === 'given') {
      rounds.set(
        record.state.givenBy.id,
        (rounds.get(record.state.givenBy.id) ?? 0) + 1,
      )
    } else if (record.state.kind === 'not_given') {
      rounds.set(
        record.state.recordedBy.id,
        (rounds.get(record.state.recordedBy.id) ?? 0) + 1,
      )
    }
  }

  const rows = data.staff
    .map((member) => {
      const written = notes.filter((note) => note.recordedBy.id === member.id)
      const residents = new Set(written.map((note) => note.residentId)).size
      const worked = rounds.get(member.id) ?? 0
      return row({
        id: member.id,
        name: member.fullName,
        note: STAFF_ROLE_NAMES[member.role],
        thin: worked < minPopulationForARate(),
        // Current standing, not the snapshot the record carries.
        deactivated: !hasAccess(member.id),
        cells: [
          count(worked),
          count(written.length),
          count(residents),
          /*
           * **Not "doses this person missed".** An omission is a dose nobody
           * recorded, so it carries nobody's name — attributing one to whoever
           * else was on shift would invent exactly the accusation the note
           * above this table warns against. What can honestly be said about a
           * person is what they did record, and how much of the home they saw.
           */
          rate(
            residents,
            data.residents.length,
            `${member.displayName} recorded ${pluralise(worked, 'dose')} in the period: too few for a figure about them to mean anything.`,
            worked,
          ),
        ],
      })
    })
    // By name. Never by any figure — see the note the screen carries.
    .sort((a, b) => a.name.localeCompare(b.name))

  const usable = rows.length - thinRows(rows)

  /*
   * The lead is about the record or about the home, never about a person.
   * Where some staff have too little in the period the finding says so; where
   * they all have enough, it names the residents nobody wrote up — which is a
   * gap in the record rather than a judgement of whoever was on shift.
   */
  const seen = new Set(notes.map((note) => note.residentId))
  const unwritten = data.residents.filter((resident) => !seen.has(resident.id)).length

  return {
    finding:
      usable < rows.length
        ? {
            kind: 'too_thin',
            figure: formatCount(usable),
            title: `of ${formatCount(rows.length)} staff have enough in the period to say anything about`,
            detail:
              'The rest recorded too little in the period for a figure about them to mean anything. They stay in the table, because removing them would make it look complete, and because this is workload and coverage rather than a ranking.',
          }
        : {
            kind: 'finding',
            figure: formatCount(unwritten),
            title: `of ${pluralise(data.residents.length, 'resident')} were not written up by anybody in the period`,
            detail:
              'That is a gap in the record rather than a judgement of anybody on this table. Who was on shift when a note was not written is not something this build records.',
          },
    restated: `Every figure below is work this person recorded at ${data.site.name}, between ${describePeriod(period)}. Doses recorded is what they signed for; residents seen is how many different people they wrote up. The last column is out of every resident here, not out of the residents they were rostered to: nothing in this build records a rota, and a denominator nobody can check is worse than one that is stated. There is no column for doses with no record against them: an omission is a dose nobody recorded, so it has nobody's name on it.`,
    columns: [
      { label: 'Staff member', numeric: false },
      { label: 'Doses recorded', numeric: true },
      { label: 'Notes written', numeric: true },
      { label: 'Residents seen', numeric: true },
      { label: 'Of residents here', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Document expiry forecast
// ---------------------------------------------------------------------------

function documentExpiry(input: RunInput): ReportResult {
  const { data } = input
  const today = zonedDate(data.now, data.site.timeZone)

  const rows = DOCUMENT_CATEGORIES.map((category) => {
    const mine = data.documents.filter((record) => record.category === category.id)
    let expired = 0
    let soon = 0
    let later = 0
    let notRecorded = 0
    for (const record of mine) {
      const finding = expiryFinding(record.expiry, today)
      if (finding.kind === 'expired') expired += 1
      else if (finding.kind === 'expiring') soon += 1
      else if (finding.kind === 'in_date' && finding.inDays <= 90) later += 1
      else if (finding.kind === 'not_recorded') notRecorded += 1
    }

    return row({
      id: category.id,
      name: category.label,
      note: category.holds,
      thin: mine.length < minPopulationForARate(),
      cells: [
        count(mine.length),
        count(expired),
        count(soon),
        count(later),
        rate(
          mine.length - notRecorded,
          mine.length,
          `Only ${pluralise(mine.length, 'document')} in this category: too few to support a rate.`,
        ),
      ],
    })
  })

  const lapsing = rows.reduce(
    (running, entry) =>
      running +
      (entry.cells[1]?.kind === 'count' ? entry.cells[1].value : 0) +
      (entry.cells[2]?.kind === 'count' ? entry.cells[2].value : 0),
    0,
  )

  return {
    finding:
      thinnessFinding(rows, 'categories') ??
      ({
        kind: 'finding',
        figure: formatCount(lapsing),
        title: `documents have lapsed or lapse within ${pluralise(dueSoonDays(), 'day')}`,
        detail:
          'The forecast counts forward from today rather than over a period, because an expiry is a deadline: what matters is what is about to stop being valid, not what expired last month.',
      } satisfies ReportFinding),
    restated: `Every figure below is documents on file at ${data.site.name}, counted forward from ${formatDate(today)}. This report is a state of the record rather than a flow, so it has no period comparison.`,
    columns: [
      { label: 'Category', numeric: false },
      { label: 'On file', numeric: true },
      { label: 'Expired', numeric: true },
      { label: `Within ${pluralise(dueSoonDays(), 'day')}`, numeric: true },
      { label: 'Within 90 days', numeric: true },
      { label: 'Carry a decision', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Activity participation
// ---------------------------------------------------------------------------

function activityParticipation(input: RunInput): ReportResult {
  const { data, period, cut } = input
  const sessions = data.activities.filter(
    (activity) =>
      within(activity.startsAt, period, data.site.timeZone) &&
      activity.endsAt < data.now,
  )

  const rows =
    cut === 'activity'
      ? Object.entries(
          sessions.reduce<Record<string, typeof sessions>>((held, activity) => {
            held[activity.name] = [...(held[activity.name] ?? []), activity]
            return held
          }, {}),
        )
          .map(([name, held]) => {
            const invited = held.flatMap((activity) => activity.invited)
            const attended = invited.filter(
              (invitation) => invitation.attendance.kind === 'attended',
            ).length
            const unrecorded = invited.filter(
              (invitation) => invitation.attendance.kind === 'not_recorded',
            ).length
            return row({
              id: name,
              name,
              note: `${pluralise(held.length, 'session')} in the period`,
              thin: invited.length < minPopulationForARate(),
              cells: [
                count(invited.length),
                count(attended),
                count(unrecorded),
                rate(
                  attended,
                  invited.length,
                  `Only ${pluralise(invited.length, 'invitation')} in the period: too few to support a rate.`,
                ),
              ],
            })
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      : data.residents
          .map((resident) => {
            const invited = sessions.flatMap((activity) =>
              activity.invited.filter(
                (invitation) => invitation.residentId === resident.id,
              ),
            )
            const attended = invited.filter(
              (invitation) => invitation.attendance.kind === 'attended',
            ).length
            const unrecorded = invited.filter(
              (invitation) => invitation.attendance.kind === 'not_recorded',
            ).length
            return row({
              id: resident.id,
              name: resident.fullLegalName,
              note:
                resident.room.kind === 'recorded'
                  ? `Room ${resident.room.value}`
                  : 'room not recorded',
              thin: invited.length < minPopulationForARate(),
              cells: [
                count(invited.length),
                count(attended),
                count(unrecorded),
                rate(
                  attended,
                  invited.length,
                  `${resident.preferredName} was invited to ${pluralise(invited.length, 'session')} in the period: too few to support a rate.`,
                ),
              ],
            })
          })
          .sort((a, b) => a.name.localeCompare(b.name))

  const invitations = rows.reduce(
    (running, entry) =>
      running + (entry.cells[0]?.kind === 'count' ? entry.cells[0].value : 0),
    0,
  )
  const unrecorded = rows.reduce(
    (running, entry) =>
      running + (entry.cells[2]?.kind === 'count' ? entry.cells[2].value : 0),
    0,
  )

  return {
    finding:
      thinnessFinding(rows, cut === 'activity' ? 'activities' : 'residents') ??
      ({
        kind: 'finding',
        figure: formatCount(unrecorded),
        title: `of ${formatCount(invitations)} invitations have no answer either way`,
        detail:
          'Nobody recorded whether these people came. That is not the same as their not coming, and a participation figure that treated it as absence would understate attendance and overstate certainty at once.',
      } satisfies ReportFinding),
    restated: restate(input, 'invitations to sessions that have happened'),
    columns: [
      { label: cut === 'activity' ? 'Activity' : 'Resident', numeric: false },
      { label: 'Invitations', numeric: true },
      { label: 'Attended', numeric: true },
      { label: 'Not recorded', numeric: true },
      { label: 'Attendance', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Consent and capacity coverage
// ---------------------------------------------------------------------------

function consentCoverage(input: RunInput): ReportResult {
  const { data } = input

  const rows = CONSENT_TYPES.map((type) => {
    let sought = 0
    let given = 0
    let refused = 0
    let byOthers = 0
    for (const resident of data.residents) {
      const consent = resident.consents[type.id]
      if (consent.kind !== 'not_sought') sought += 1
      if (consent.kind === 'given') given += 1
      if (consent.kind === 'refused') refused += 1
      if (
        (consent.kind === 'given' ||
          consent.kind === 'refused' ||
          consent.kind === 'withdrawn') &&
        consent.by.kind !== 'the_resident'
      ) {
        byOthers += 1
      }
    }

    return row({
      id: type.id,
      name: type.name,
      note: 'every resident at this site',
      thin: data.residents.length < minPopulationForARate(),
      cells: [
        count(sought),
        count(given),
        count(refused),
        count(byOthers),
        rate(
          sought,
          data.residents.length,
          `Only ${pluralise(data.residents.length, 'resident')} here: too few to support a rate.`,
        ),
      ],
    })
  })

  const possible = data.residents.length * CONSENT_TYPES.length
  const neverSought = rows.reduce(
    (running, entry) =>
      running +
      (entry.cells[0]?.kind === 'count'
        ? data.residents.length - entry.cells[0].value
        : 0),
    0,
  )

  return {
    finding:
      thinnessFinding(rows, 'consent types') ??
      ({
        kind: 'finding',
        figure: formatCount(neverSought),
        title: `of ${formatCount(possible)} consents have never been sought`,
        detail:
          'Never sought is neither refusal nor permission. "Decided by somebody else" counts best-interests decisions and LPA holders together, because both are somebody deciding for a person rather than with them.',
      } satisfies ReportFinding),
    restated: `Every figure below is consents at ${data.site.name}, out of ${pluralise(data.residents.length, 'resident')}. This report is a state of the record rather than a flow, so it has no period comparison.`,
    columns: [
      { label: 'Consent type', numeric: false },
      { label: 'Sought', numeric: true },
      { label: 'Given', numeric: true },
      { label: 'Refused', numeric: true },
      { label: 'Decided by somebody else', numeric: true },
      { label: 'Sought, of residents', numeric: true },
    ],
    rows,
    exportWouldContain: exportLine(input, rows),
  }
}

// ---------------------------------------------------------------------------
// Shared sentences
// ---------------------------------------------------------------------------

function cutLabel(input: RunInput): string {
  const cut = input.definition.cuts.find((entry) => entry.id === input.cut)
  return (cut?.label ?? 'Row')
    .replace(/^By /, '')
    .replace(/^./, (first) => first.toUpperCase())
}

/**
 * The line that restates every figure below in terms of period, cut and
 * population. Rule 3c applied to a whole screen rather than to one claim.
 */
function restate(input: RunInput, what: string): string {
  const { data, period, previous } = input
  const comparison =
    previous === undefined ? '' : ` It is compared with ${describePeriod(previous)}.`
  return `Every figure below is ${what}, at ${data.site.name}, between ${describePeriod(period)}.${comparison} A row with fewer than ${formatCount(minPopulationForARate())} behind it cannot support a rate and says so rather than showing one.`
}

/** What a real export would contain. There is no control to produce it. */
function exportLine(input: RunInput, rows: ReportRow[]): string {
  const thin = thinRows(rows)
  return `${input.definition.name} at ${input.data.site.name}, ${cutLabel(input).toLowerCase()}, ${describePeriod(input.period)}${
    input.previous === undefined
      ? ''
      : ` against the preceding ${pluralise(input.previous.days, 'day')}`
  }: ${pluralise(rows.length, 'row')}${thin === 0 ? '' : `, ${formatCount(thin)} of which cannot support a rate`}.`
}

const RUNS: Record<ReportId, (input: RunInput) => ReportResult> = {
  'medication-omissions': medicationOmissions,
  'controlled-drug-reconciliation': controlledDrugs,
  'incidents-by-type': incidentsByType,
  'assessment-coverage': assessmentCoverage,
  'care-note-coverage': careNoteCoverage,
  'document-expiry-forecast': documentExpiry,
  'activity-participation': activityParticipation,
  'consent-coverage': consentCoverage,
}

export function runReport(input: RunInput): ReportResult {
  return RUNS[input.definition.id](input)
}

export { CARE_NOTE_CATEGORIES, subjectResidentId }
