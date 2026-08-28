import { now as appNow } from '@/data/fixtures/clock'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { formatCount, pluralise } from '@/lib/format'
import { DRILL_DOWNS, reportGroups } from './catalogue'
import { loadReportData, type ReportData } from './data'
import { REPORT_PERIOD_DAYS } from './period'
import { reportBars, reportHeadline, runAll, type ReportRun } from './analysis'
import styles from './reports.module.css'

/**
 * The report index. PRD §6.7, Phase 13 — analytical layout.
 *
 * The sentence: **how many of the eight cannot say anything, then how thin the
 * rows underneath them are, then what each one answers.**
 *
 * Every row is run against the default period and marked, because opening a
 * report to discover it cannot conclude is a wasted trip and this screen is
 * where that is cheapest to prevent.
 *
 * **No dots in this table and no ratings anywhere on it.** The dots on the
 * compliance panel are a rating vocabulary, and a report shows figures and
 * coverage; borrowing the shape here would be one concept in two treatments
 * and two concepts in one (CLAUDE.md §6). Thin keeps the hatch.
 */
export function ReportIndexRoute() {
  const { activeSite } = useSession()
  const [data, setData] = useState<ReportData | 'loading'>('loading')

  useEffect(() => {
    let live = true
    const now = appNow().toISOString() as IsoDateTime
    void loadReportData(activeSite, now).then((loaded) => {
      if (live) setData(loaded)
    })
    return () => {
      live = false
    }
  }, [activeSite])

  const runs = useMemo(() => (data === 'loading' ? [] : runAll(data)), [data])

  if (data === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the record…</p>
      </div>
    )
  }

  const headline = reportHeadline(runs)
  const bars = reportBars(runs)
  const widest = Math.max(...bars.map((bar) => bar.usable + bar.thin), 1)
  const byId = new Map(runs.map((run) => [run.definition.id, run]))

  return (
    <div className={styles.page} data-report-index>
      <header>
        <h1 className={styles.pageTitle}>Reports</h1>
      </header>

      <div className={styles.analysisGrid}>
        {/* Not the findings. How much of this screen cannot produce one. */}
        <section className={styles.hero} data-hero>
          <p className={styles.heroLabel}>Reports that cannot state a finding</p>
          <p className={styles.heroValue} data-numeric>
            {formatCount(headline.tooThin)}
          </p>
          <p className={styles.heroBody}>
            of {formatCount(headline.reports)}, over the last{' '}
            {pluralise(REPORT_PERIOD_DAYS, 'day')}. Each of them still opens and still
            shows its table: the finding above it is what stops the table being read as
            a conclusion.
          </p>
          <div className={styles.heroSplit}>
            <div>
              <p className={styles.heroSplitValue} data-numeric>
                {formatCount(headline.withFinding)} of {formatCount(headline.reports)}
              </p>
              <p className={styles.heroSplitLabel}>state a finding over this period</p>
            </div>
            <div>
              <p className={styles.heroSplitValue} data-numeric>
                {formatCount(headline.floor)}
              </p>
              <p className={styles.heroSplitLabel}>
                is the population a row needs before it can carry a rate
              </p>
            </div>
          </div>
        </section>

        <div className={styles.pair}>
          <section className={styles.miniPlain} data-mini="rows">
            <p className={styles.miniLabel}>Rows across the eight</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(headline.rows)}
            </p>
            <p className={styles.miniBody}>
              drugs, rounds, staff members, incident types, categories and activities,
              every one of them counted over the same period.
            </p>
          </section>

          <section className={styles.miniGap} data-mini="thin" data-state="unrecorded">
            <p className={styles.miniLabel}>Rows below the population floor</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(headline.thinRows)}
            </p>
            <p className={styles.miniBody}>
              of {formatCount(headline.rows)}. Each keeps its counts and loses only its
              rate: removing them would make every table look complete.
            </p>
          </section>
        </div>

        <section className={styles.chartPanel} data-chart>
          <div className={styles.chartHead}>
            <h2 className={styles.chartTitle}>What each report has to work with</h2>
            <p className={styles.chartNote}>
              Rows in the last {pluralise(REPORT_PERIOD_DAYS, 'day')}, split by whether
              the row has enough behind it to carry a rate. The hatched part is not a
              shortfall against a target: it is how many rows can state a count and
              nothing more.
            </p>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.swatchRecorded} aria-hidden />
                Can carry a rate
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatchGap} aria-hidden />
                Below the floor
              </span>
            </div>
          </div>

          <ul className={styles.chart}>
            {bars.map((bar) => (
              <li key={bar.id} className={styles.chartRow} data-bar={bar.id}>
                <span className={styles.chartRowLabel}>{bar.label}</span>
                <span className={styles.chartTrack}>
                  <span
                    className={styles.barRecorded}
                    style={{ width: `${(bar.usable / widest) * 100}%` }}
                    data-bar-segment="usable"
                  />
                  <span
                    className={styles.barGap}
                    style={{ width: `${(bar.thin / widest) * 100}%` }}
                    data-bar-segment="thin"
                  />
                </span>
                <span className={styles.chartRowFigure} data-numeric>
                  {formatCount(bar.usable)} of {formatCount(bar.usable + bar.thin)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.tableCard}>
        {reportGroups().map((group) => (
          <div key={group.group} data-report-group={group.group}>
            <h2 className={styles.groupTitle}>{group.group}</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Report</th>
                    <th scope="col">What it answers</th>
                    <th scope="col">Over the last {REPORT_PERIOD_DAYS} days</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.reports.map((report) => (
                    <tr key={report.id} data-report={report.id}>
                      <th scope="row" className={styles.rowHead}>
                        <span className={styles.reportName}>{report.name}</span>
                      </th>
                      <td>
                        {/* A report whose question cannot be stated in one line
                            is a table looking for a purpose. */}
                        <span className={styles.reportAnswers} data-answers>
                          {report.answers}
                        </span>
                      </td>
                      <td>
                        <ReadinessCell run={byId.get(report.id)} />
                      </td>
                      <td>
                        <Link
                          to={report.id}
                          className={styles.openLink}
                          data-open-report={report.id}
                          aria-label={`Open ${report.name}`}
                        >
                          Open
                          <Icon
                            name="arrows-sharp/arrow-right-01-sharp"
                            size={16}
                            aria-hidden
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.drillCard} data-report-group="drill-downs">
        <h2 className={styles.groupTitle}>Drill-downs, not reports</h2>
        <div className={styles.drillDowns}>
          <p className={styles.drillIntro}>
            Each of these is a compliance check with a table under it, so each opens
            from that check rather than having a screen of its own, which is also where
            a reader already is when the question occurs to them.
          </p>
          <ul className={styles.drillList}>
            {DRILL_DOWNS.map((drill) => (
              <li key={drill.question}>
                <Link
                  to={drill.to}
                  className={styles.drillLink}
                  data-drill-down={drill.question}
                >
                  {drill.question}
                  <span className={styles.drillWhere}>{drill.where}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function ReadinessCell({ run }: { run: ReportRun | undefined }) {
  if (run === undefined) return <span />
  const finding = run.result.finding

  if (finding.kind === 'too_thin') {
    return (
      <span data-readiness="too_thin">
        <Unrecorded
          variant="chip"
          label="Too thin to conclude"
          detail={`${finding.figure} ${finding.title}`}
        />
      </span>
    )
  }

  return (
    <p className={styles.readiness} data-readiness="ready">
      <span className={styles.readinessFigure}>
        {finding.figure} {finding.title}
      </span>
      <span>in the current period</span>
    </p>
  )
}
