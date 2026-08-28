import { now as appNow } from '@/data/fixtures/clock'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { IsoDateTime, ReportCell, ReportRow } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import { reportById } from './catalogue'
import { loadReportData, type ReportData } from './data'
import {
  PERIOD_OPTIONS,
  REPORT_PERIOD_DAYS,
  periodEndingToday,
  previousPeriod,
  type PeriodDays,
} from './period'
import { runReport } from './runs'
import styles from './reports.module.css'

/**
 * One report. PRD §6.7, Phase 13.
 *
 * The sentence: **the finding first — including "this data is too thin to
 * support one" — then the filters that produced it, then the table, then the
 * plain statement that no file can be produced.**
 *
 * Where the data is too thin the finding *is* that, and **the table still
 * renders beneath it**: refusing to render hides data somebody may still need,
 * and the finding above is what stops the table being read as a conclusion.
 * The same relationship the omissions banner has to the MAR grid.
 *
 * **No ratings anywhere.** Figures and coverage here; judgement stays on the
 * compliance panel.
 */
export function ReportViewRoute() {
  const { activeSite } = useSession()
  const { reportId } = useParams()
  const definition = reportId === undefined ? undefined : reportById(reportId)

  const [data, setData] = useState<ReportData | 'loading'>('loading')
  const [days, setDays] = useState<PeriodDays>(REPORT_PERIOD_DAYS)
  const [compare, setCompare] = useState(true)
  const [cut, setCut] = useState<string | undefined>(undefined)

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

  const result = useMemo(() => {
    if (data === 'loading' || definition === undefined) return undefined
    const period = periodEndingToday(data.now, data.site.timeZone, days)
    return runReport({
      data,
      definition,
      period,
      // A state report has no previous period to compare with, and the control
      // that would offer one is absent rather than disabled.
      previous: definition.comparison && compare ? previousPeriod(period) : undefined,
      cut: cut ?? definition.cuts[0]?.id ?? '',
    })
  }, [data, definition, days, compare, cut])

  if (definition === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.errorTitle}>That is not a report</p>
        <p className={styles.errorBody}>
          There are eight, and seven further questions that are drill-downs from a
          compliance check rather than reports of their own.
        </p>
        <Link to=".." relative="path" className={styles.backLink}>
          Back to reports
        </Link>
      </div>
    )
  }

  if (data === 'loading' || result === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the record…</p>
      </div>
    )
  }

  const thin = result.rows.filter((row) => row.thin).length

  return (
    <div className={styles.page} data-report-view={definition.id}>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Reports
      </Link>

      <header>
        <h1 className={styles.pageTitle}>{definition.name}</h1>
        <p className={styles.pageSubtitle}>{definition.answers}</p>
      </header>

      {/*
       * The finding, above the filters and above the table. Always — and the
       * largest thing on the screen, with the coverage it rests on beside it
       * rather than under the table where it would be read after the figures.
       */}
      <div className={styles.viewGrid}>
        <div
          className={
            result.finding.kind === 'too_thin' ? styles.findingThin : styles.finding
          }
          data-finding={result.finding.kind}
          data-state={result.finding.kind === 'too_thin' ? 'unrecorded' : undefined}
        >
          <span className={styles.findingFigure} data-numeric>
            {result.finding.figure}
          </span>
          <span>
            <span className={styles.findingTitle}>{result.finding.title}</span>
            <span className={styles.findingDetail}>{result.finding.detail}</span>
          </span>
        </div>

        <div className={styles.pair}>
          <section className={styles.miniPlain} data-mini="rows">
            <p className={styles.miniLabel}>Rows in this cut</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(result.rows.length)}
            </p>
            <p className={styles.miniBody}>
              every one of them shown, in the order the report orders them.
            </p>
          </section>

          <section className={styles.miniGap} data-mini="thin" data-state="unrecorded">
            <p className={styles.miniLabel}>Below the population floor</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(thin)}
            </p>
            <p className={styles.miniBody}>
              of {formatCount(result.rows.length)}, each keeps its counts and shows
              Insufficient Evidence where its rate would be.
            </p>
          </section>
        </div>
      </div>

      <section className={styles.tableCard}>
        {definition.subject === 'staff' ? (
          <p className={styles.staffNote} data-staff-note>
            <b>This is workload and coverage, not a ranking.</b> A gap in a record is
            not necessarily a failure by whoever was on shift, a missed dose can be a
            broken trolley, a short round, or a resident in hospital nobody updated. The
            table is ordered by name, and it will not be ordered by anything else.
          </p>
        ) : null}

        <div className={styles.filters}>
          {definition.comparison ? (
            <div
              className={styles.segmented}
              role="group"
              aria-label="Period comparison"
              data-comparison
            >
              <button
                type="button"
                aria-pressed={!compare}
                onClick={() => setCompare(false)}
                data-compare="off"
              >
                This period
              </button>
              <button
                type="button"
                aria-pressed={compare}
                onClick={() => setCompare(true)}
                data-compare="on"
              >
                Against the last
              </button>
            </div>
          ) : (
            <p className={styles.stateNote} data-state-note>
              This is the state of the record today, not a flow through a period, so
              there is nothing to compare it with.
            </p>
          )}

          {definition.dimension === 'flow' ? (
            <label className={styles.filterLabel}>
              <span className={styles.filterLabelText}>Period</span>
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value) as PeriodDays)}
                data-filter="period"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Last {option} days
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {definition.cuts.length > 1 ? (
            <label className={styles.filterLabel}>
              <span className={styles.filterLabelText}>Cut</span>
              <select
                value={cut ?? definition.cuts[0]?.id}
                onChange={(event) => setCut(event.target.value)}
                data-filter="cut"
              >
                {definition.cuts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {/* Rule 3c over a whole screen: every figure below, in the terms that
            produced it. */}
        <p className={styles.restated} data-restated>
          {result.restated}
        </p>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={column.numeric ? styles.numeric : undefined}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((entry) => (
                <Row key={entry.id} row={entry} />
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.noFile} data-no-file data-state="unrecorded">
          <p className={styles.noFileTitle}>No file can be produced here.</p>
          <p className={styles.noFileBody}>
            A real export would contain {result.exportWouldContain} This build has no
            backend and no file storage, so there is no download control rather than one
            that produces nothing.
          </p>
        </div>
      </section>
    </div>
  )
}

function Row({ row }: { row: ReportRow }) {
  return (
    <tr
      className={row.thin ? styles.thinRow : undefined}
      data-row={row.id}
      data-thin={row.thin}
    >
      <th scope="row" className={styles.rowHead}>
        <span className={styles.rowName}>
          {row.name}
          {/* Records outlive access (§6.7), so a deactivated author stays on
              the table and is marked rather than removed. */}
          {row.deactivated ? (
            <span className={styles.deactivated} data-deactivated>
              {' '}
              (no longer has access)
            </span>
          ) : null}
        </span>
        {row.note === '' ? null : <span className={styles.rowNote}>{row.note}</span>}
      </th>
      {row.cells.map((cell, index) => (
        <td key={index} className={styles.numeric}>
          <Cell cell={cell} />
        </td>
      ))}
    </tr>
  )
}

function Cell({ cell }: { cell: ReportCell }) {
  switch (cell.kind) {
    case 'count':
      return <span data-numeric>{formatCount(cell.value)}</span>
    case 'text':
      return <span>{cell.value}</span>
    case 'rate':
      return (
        <span data-numeric data-cell="rate">
          {cell.aggregate.value.toFixed(1)}%
        </span>
      )
    case 'insufficient':
      return (
        <span data-cell="insufficient">
          <Unrecorded
            variant="chip"
            label="Insufficient evidence"
            detail={cell.aggregate.missingDescription}
          />
        </span>
      )
    case 'change': {
      const change = cell.change
      if (change.kind === 'no_comparison') {
        return (
          <span className={styles.noComparison} data-cell="no_comparison">
            No comparison
          </span>
        )
      }
      /*
       * A word and a figure, never an arrow alone. A reader who cannot see the
       * colour still has to know which way this went.
       */
      return (
        <span className={styles.change} data-change={change.kind}>
          {change.kind === 'worse'
            ? 'worse'
            : change.kind === 'better'
              ? 'better'
              : 'unchanged'}
          , was {change.was}
        </span>
      )
    }
  }
}
