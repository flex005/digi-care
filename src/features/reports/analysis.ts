import { minPopulationForARate } from '@/data/access/settings-store'
import type { ReportResult } from '@/data/types'
import { reportGroups, type ReportDefinition } from './catalogue'
import type { ReportData } from './data'
import { REPORT_PERIOD_DAYS, periodEndingToday, previousPeriod } from './period'
import { runReport } from './runs'

/**
 * The eight, run once, and what the index says before anybody opens one.
 * Phase 13, restyled.
 *
 * **The hero carries the count of reports that cannot support a finding.** Not
 * how many findings there are — how much of this screen cannot tell you
 * anything. Opening a report to discover it has nothing to say is a wasted
 * trip, and a screen that leads on its findings hides how few of them there
 * are.
 *
 * **No rating anywhere in here.** Judgement stays on the compliance panel
 * (PRD §6.6h); these are figures, coverage and the population floor.
 */
export interface ReportRun {
  definition: ReportDefinition
  result: ReportResult
}

export function runAll(data: ReportData): ReportRun[] {
  const period = periodEndingToday(data.now, data.site.timeZone, REPORT_PERIOD_DAYS)
  return reportGroups()
    .flatMap((group) => group.reports)
    .map((definition) => ({
      definition,
      result: runReport({
        data,
        definition,
        period,
        previous: definition.comparison ? previousPeriod(period) : undefined,
        cut: definition.cuts[0]?.id ?? '',
      }),
    }))
}

export interface ReportHeadline {
  /** Reports whose data is too thin to state a finding at all. */
  tooThin: number
  reports: number
  /** Reports that do state one. */
  withFinding: number
  /** Rows below the population floor, across all eight. */
  thinRows: number
  rows: number
  /** The floor itself, named — it is a setting, not a fact about the home. */
  floor: number
}

export function reportHeadline(runs: ReportRun[]): ReportHeadline {
  let thinRows = 0
  let rows = 0
  for (const run of runs) {
    rows += run.result.rows.length
    thinRows += run.result.rows.filter((row) => row.thin).length
  }

  const tooThin = runs.filter((run) => run.result.finding.kind === 'too_thin').length
  return {
    tooThin,
    reports: runs.length,
    withFinding: runs.length - tooThin,
    thinRows,
    rows,
    floor: minPopulationForARate(),
  }
}

/**
 * One bar per report: rows that can carry a figure, and rows below the floor.
 *
 * **The same constant, read over rows rather than checks.** A row under the
 * floor keeps its counts and loses only its rate, and it stays in the table —
 * so the bar counts it rather than shortening. The hatched segment is that
 * count, and it is a statement about coverage, not a shortfall against a
 * target.
 */
export interface ReportBar {
  id: string
  label: string
  usable: number
  thin: number
}

export function reportBars(runs: ReportRun[]): ReportBar[] {
  return runs.map((run) => {
    const thin = run.result.rows.filter((row) => row.thin).length
    return {
      id: run.definition.id,
      label: run.definition.name,
      usable: run.result.rows.length - thin,
      thin,
    }
  })
}
