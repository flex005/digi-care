import type { ReportDimension } from '@/data/types'

/**
 * The eight reports, and the seven questions that are not reports. Phase 13.
 *
 * **Eight, not fifteen.** A screen whose only distinction is a name is a
 * screen somebody has to learn for nothing. Seven of the fifteen would have
 * been a compliance check with a table under it, so they open from that check
 * instead — which is also where a reader already is when the question occurs
 * to them. The index says so where it would otherwise list them.
 *
 * **Every report carries the line saying what it answers.** A report whose
 * question cannot be stated in one line is a table looking for a purpose.
 */

export type ReportId =
  | 'medication-omissions'
  | 'controlled-drug-reconciliation'
  | 'incidents-by-type'
  | 'assessment-coverage'
  | 'care-note-coverage'
  | 'document-expiry-forecast'
  | 'activity-participation'
  | 'consent-coverage'

export interface Cut {
  id: string
  label: string
}

export interface ReportDefinition {
  id: ReportId
  group: string
  name: string
  /** What it answers, in one line. */
  answers: string
  /**
   * Whether the report is about events in a period or the state of the record.
   *
   * A `state` report offers no period comparison, because comparing today's
   * snapshot with a snapshot nobody took is a number with nothing behind it.
   */
  dimension: ReportDimension
  /** The ways the same figures can be cut. The first is the default. */
  cuts: Cut[]
  /**
   * Whether the table has a column that changes when the comparison is on.
   *
   * **A control that changes nothing is worse than no control.** Five of the
   * eight have no per-row comparison — a change column on the staff report
   * would be a performance track, and on a coverage table it would compare a
   * state with itself — so the toggle is absent there rather than present and
   * inert.
   */
  comparison: boolean
  /**
   * Whose figures these are.
   *
   * `staff` carries a constraint no other report does: workload and coverage,
   * never a league table, never sorted worst-first, and a note above the table
   * saying a gap in a record is not necessarily a failure by whoever was on
   * shift.
   */
  subject: 'resident' | 'staff' | 'record'
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'medication-omissions',
    group: 'Medication',
    name: 'Omissions over a period',
    answers:
      'Which drugs and which rounds go unrecorded, and whether it is getting better or worse.',
    dimension: 'flow',
    comparison: true,
    cuts: [
      { id: 'drug', label: 'By drug' },
      { id: 'round', label: 'By round' },
      { id: 'weekday', label: 'By day of week' },
      { id: 'resident', label: 'By resident' },
    ],
    subject: 'record',
  },
  {
    id: 'controlled-drug-reconciliation',
    group: 'Medication',
    name: 'Controlled drug reconciliation',
    answers: 'Every count in the period, and whether the balances held.',
    dimension: 'flow',
    comparison: false,
    cuts: [{ id: 'drug', label: 'By drug' }],
    subject: 'record',
  },
  {
    id: 'incidents-by-type',
    group: 'Safety',
    name: 'Incidents by type and location',
    answers:
      'Where incidents happen, what kind, and how this period compares with the last.',
    dimension: 'flow',
    comparison: true,
    cuts: [
      { id: 'type', label: 'By type' },
      { id: 'location', label: 'By location' },
      { id: 'severity', label: 'By harm caused' },
    ],
    subject: 'record',
  },
  {
    id: 'assessment-coverage',
    group: 'Safety',
    name: 'Risk assessment and review coverage over time',
    answers: 'Whether the home is assessing and re-assessing, or falling behind.',
    dimension: 'flow',
    comparison: false,
    cuts: [{ id: 'template', label: 'By assessment' }],
    subject: 'record',
  },
  {
    id: 'care-note-coverage',
    group: 'The record itself',
    name: 'Care note coverage by staff and shift',
    answers: 'Who is writing residents up, on which shifts, and where the gaps fall.',
    dimension: 'flow',
    comparison: false,
    cuts: [
      { id: 'staff', label: 'By staff member' },
      { id: 'shift', label: 'By shift' },
    ],
    subject: 'staff',
  },
  {
    id: 'document-expiry-forecast',
    group: 'The record itself',
    name: 'Document expiry forecast',
    answers: 'What lapses in the next 90 days, and what has no expiry decision at all.',
    dimension: 'state',
    comparison: false,
    cuts: [{ id: 'category', label: 'By category' }],
    subject: 'record',
  },
  {
    id: 'activity-participation',
    group: 'The person',
    name: 'Activity participation over a period',
    answers: 'Who is joining in, who is not, and who nobody has recorded either way.',
    dimension: 'flow',
    comparison: false,
    cuts: [
      { id: 'resident', label: 'By resident' },
      { id: 'activity', label: 'By activity' },
    ],
    subject: 'resident',
  },
  {
    id: 'consent-coverage',
    group: 'The person',
    name: 'Consent and capacity coverage',
    answers:
      'Which consents have been sought, by whose authority, and with what capacity assessment behind them.',
    dimension: 'state',
    comparison: false,
    cuts: [{ id: 'type', label: 'By consent type' }],
    subject: 'resident',
  },
]

/**
 * The seven that are not reports.
 *
 * Each is a compliance check with a table under it, so each opens from that
 * check. Listed here because a reader looking for one of these questions needs
 * to be told where it lives, not left to conclude the product cannot answer it.
 */
export interface DrillDown {
  question: string
  /** The Key Question whose panel carries the check. */
  to: string
  where: string
}

export const DRILL_DOWNS: DrillDown[] = [
  { question: 'Omission rate by resident', to: '/compliance/safe', where: 'Safe' },
  { question: 'Consents never sought', to: '/compliance/caring', where: 'Caring' },
  {
    question: 'Goals past the date they were set for',
    to: '/compliance/responsive',
    where: 'Responsive',
  },
  {
    question: 'Reviews never scheduled',
    to: '/compliance/effective',
    where: 'Effective',
  },
  {
    question: 'Documents with no expiry decision',
    to: '/compliance/well_led',
    where: 'Well-led',
  },
  { question: 'Unacknowledged incidents', to: '/compliance/safe', where: 'Safe' },
  {
    question: 'Care plan domains never written',
    to: '/compliance/effective',
    where: 'Effective',
  },
]

export function reportById(id: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.id === id)
}

/** The groups, in the order the index renders them. */
export function reportGroups(): { group: string; reports: ReportDefinition[] }[] {
  const groups: { group: string; reports: ReportDefinition[] }[] = []
  for (const report of REPORTS) {
    const held = groups.find((entry) => entry.group === report.group)
    if (held) held.reports.push(report)
    else groups.push({ group: report.group, reports: [report] })
  }
  return groups
}
