import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { formatCount, pluralise } from '@/lib/format'
import { CoverageBar, NotHeldHere, PlaceholderBanner } from './ComplianceParts'
import { evidenceBars, headlineFor, missingEvidence } from './analysis'
import { useComplianceData, usePanels } from './use-compliance'
import styles from './compliance.module.css'

/**
 * The five Key Questions. PRD §2.3, §6.7, Phase 12 — analytical layout.
 *
 * The sentence: **how much of this record cannot support a figure at all, then
 * where the evidence is, then the five in CQC's order.**
 *
 * The layout carries the hierarchy rather than the type size: a dark hero, two
 * stacked minis, a chart filling the rest. What it refuses is the load-bearing
 * part —
 *
 * - **no overall compliance percentage.** Two Key Questions cannot be rated at
 *   all, and no arithmetic turns a mixture of ratings and unratables into a
 *   number that means anything.
 * - **no green in the hero.** The largest thing on the screen carries the
 *   count of checks that cannot support a figure — the least reassuring number
 *   available, in the most prominent position.
 * - **the hatch survives into the chart** as a bar segment rather than a
 *   lighter shade, so missing evidence still reads in greyscale.
 * - **Insufficient Evidence stays a chip**, beside the dots rather than
 *   becoming a fourth colour among them, so the three are never read as a scale.
 * - **no trend without both figures named.** Nothing here says "up 5%".
 */
export function ComplianceOverviewRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const panels = usePanels()
  const data = useComplianceData()

  if (panels === 'loading' || data === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the whole record…</p>
      </div>
    )
  }

  const headline = headlineFor(panels)
  const bars = evidenceBars(data)
  const missing = missingEvidence(bars)
  const tallest = Math.max(...bars.map((bar) => bar.expected), 1)

  return (
    <div className={styles.page} data-compliance-overview>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Compliance</h1>
          <p className={styles.pageSubtitle}>
            {activeSite.name} · the whole record · five CQC Key Questions
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link to="notifications" className={styles.headLink} data-notifications-link>
            Statutory notifications
            <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
          </Link>
          {/*
           * **Absent rather than disabled, and absent rather than a link to a
           * refusal.** The route refuses a role that does not hold the act,
           * which is what makes typing the URL honest; a link that leads there
           * would be a control that exists to say no. The act is named on
           * /me/permissions for anybody who goes looking.
           */}
          {viewer.may('inspection_pack') ? (
            <Link to="pack" className={styles.headLink} data-pack-link>
              Inspection pack
              <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
            </Link>
          ) : null}
        </div>
      </header>

      <PlaceholderBanner what="screen" />

      <div className={styles.analysisGrid}>
        {/* The hero, and it is deliberately not the good news. */}
        <section className={styles.hero} data-hero>
          <p className={styles.heroLabel}>Checks that cannot support a figure</p>
          <p className={styles.heroValue} data-numeric>
            {formatCount(headline.unusable)}
          </p>
          <p className={styles.heroBody}>
            of {formatCount(headline.derived)} checks across{' '}
            {pluralise(headline.panels, 'Key Question')}. Nothing on this screen can
            tell you about these, not that they are bad, that they are unmeasurable.
          </p>
          <div className={styles.heroSplit}>
            <div data-worst-affected>
              {headline.worstAffected === undefined ? (
                <>
                  <p className={styles.heroSplitValue}>None</p>
                  <p className={styles.heroSplitLabel}>
                    of the five has an unmeasurable check
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.heroSplitValue} data-numeric>
                    {formatCount(headline.worstAffected.unusable)} of{' '}
                    {formatCount(headline.worstAffected.total)}
                  </p>
                  <p className={styles.heroSplitLabel}>
                    on {headline.worstAffected.name}, the worst affected
                  </p>
                </>
              )}
            </div>
            <div>
              <p className={styles.heroSplitValue} data-numeric>
                {formatCount(headline.notHeld)}
              </p>
              <p className={styles.heroSplitLabel}>
                further checks this product does not hold at all
              </p>
            </div>
          </div>
        </section>

        <div className={styles.pair}>
          <section className={styles.miniCritical} data-mini="findings">
            <p className={styles.miniLabel}>Checks with a finding</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(headline.findings)}
            </p>
            <p className={styles.miniBody}>
              of {formatCount(headline.usable)} checks that can support a figure.
              {headline.worst === undefined
                ? ''
                : ` Worst is ${headline.worst.name}, ${headline.worst.detail}.`}
            </p>
          </section>

          <section
            className={styles.miniGap}
            data-mini="missing"
            data-state="unrecorded"
          >
            <p className={styles.miniLabel}>Evidence never recorded</p>
            <p className={styles.miniValue} data-numeric>
              {formatCount(missing.total)}
            </p>
            <p className={styles.miniBody}>
              records the home is expected to hold and does not,{' '}
              {missing.components
                .map((entry) => `${formatCount(entry.missing)} ${entry.label}`)
                .join(', ')}
              .
            </p>
          </section>
        </div>

        <section className={styles.chartPanel} data-chart>
          <div className={styles.chartHead}>
            <h2 className={styles.chartTitle}>
              What the record holds, by Key Question
            </h2>
            <p className={styles.chartNote}>
              {/*
               * One named population each rather than a sum across a panel's
               * checks: two of the five count the same records from different
               * angles, and adding them would produce a total nobody could
               * check.
               */}
              Each bar is one named population of records for that Key Question. The
              hatched part is what is expected and missing, not a shortfall against a
              target, a count of records nobody has written.
            </p>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.swatchRecorded} aria-hidden />
                Recorded
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatchGap} aria-hidden />
                Expected and missing
              </span>
            </div>
          </div>

          <ul className={styles.chart}>
            {bars.map((bar) => {
              const recorded = (bar.recorded / tallest) * 100
              const gap = ((bar.expected - bar.recorded) / tallest) * 100
              return (
                <li key={bar.id} className={styles.chartColumn} data-bar={bar.id}>
                  <span
                    className={styles.barGap}
                    style={{ height: `${gap}%` }}
                    data-bar-segment="gap"
                  />
                  <span
                    className={styles.barRecorded}
                    style={{ height: `${recorded}%` }}
                    data-bar-segment="recorded"
                  />
                  <span className={styles.chartLabel}>
                    {bar.label}
                    <span className={styles.chartLabelDetail}>
                      {formatCount(bar.recorded)} of {formatCount(bar.expected)}{' '}
                      {bar.population}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}>
          <div>
            <h2 className={styles.tableTitle}>The five Key Questions</h2>
            <p className={styles.tableNote}>
              Ordered as CQC orders them, never by rating. Coverage is checks that can
              support a figure, not evidence recorded.
            </p>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Key Question</th>
                <th scope="col">Rating</th>
                <th scope="col">What drives it</th>
                <th scope="col">Usable checks</th>
                <th scope="col">Not held here</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {panels.map((panel) => {
                const verdict = panel.verdict
                return (
                  <tr key={panel.question.id} data-panel={panel.question.id}>
                    <th scope="row" className={styles.questionCell}>
                      <span className={styles.questionName}>{panel.question.name}</span>
                      <span className={styles.questionAsks}>{panel.question.asks}</span>
                    </th>

                    <td>
                      {verdict.kind === 'insufficient_evidence' ? (
                        /*
                         * A chip, not a fourth dot. Insufficient Evidence is the
                         * absence of a finding, and putting it in the same
                         * vocabulary as amber and red would make the three read
                         * as a scale.
                         */
                        <span data-rating="insufficient_evidence">
                          <Unrecorded
                            variant="chip"
                            label="Insufficient evidence"
                            detail={`${formatCount(verdict.usable)} of ${formatCount(verdict.total)} usable, below the threshold`}
                          />
                        </span>
                      ) : (
                        <span className={styles.rating} data-rating={verdict.rating}>
                          <span
                            className={styles.dot}
                            data-dot={verdict.rating}
                            aria-hidden
                          />
                          {RATING_WORD[verdict.rating]}
                        </span>
                      )}
                    </td>

                    <td className={styles.driverCell}>
                      {verdict.kind === 'rated' ? (
                        <>
                          <span className={styles.driverName}>
                            {verdict.driver.name}
                          </span>
                          <span
                            className={styles.driverDetail}
                            data-driver={verdict.driver.id}
                          >
                            {verdict.driver.detail}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.driverName}>
                            Nothing can be concluded
                          </span>
                          <span className={styles.driverDetail}>
                            fewer than three in five checks have enough behind them
                          </span>
                        </>
                      )}
                    </td>

                    <td>
                      <CoverageBar verdict={verdict} />
                    </td>

                    <td data-panel-not-held={panel.notHeld.length}>
                      {panel.notHeld.length > 0 ? (
                        <NotHeldHere
                          statement={panel.notHeld
                            .map((check) => check.name)
                            .join(' · ')}
                        />
                      ) : null}
                    </td>

                    <td>
                      <Link
                        to={panel.question.id}
                        className={styles.panelLink}
                        data-open-panel={panel.question.id}
                        aria-label={`Open ${panel.question.name}, every check`}
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
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inert: nothing here is a gap anybody can close. */}
      <div className={styles.noOverall} data-no-overall>
        <p>
          <b>
            There is no overall compliance figure on this screen, and there will not be
            one.
          </b>{' '}
          {/*
           * The reason is the standing one, not a count.
           *
           * It first read "N of 5 Key Questions cannot be rated at all, so
           * there is nothing to average" — and N was zero, so the screen's
           * stated reason for refusing a figure was false on the day it
           * shipped. A refusal that rests on a figure stops being a refusal
           * the moment the figure moves.
           */}
          Each of the five is worst-of over checks counting different things, residents,
          doses, documents, consents, with no denominator in common, so an average of
          the five ratings could not be checked against anything. And where a check
          cannot support a figure at all there is nothing to average in its place:{' '}
          {formatCount(headline.unusable)} of {formatCount(headline.derived)} are in
          that state now. A single number would be most reassuring exactly where the
          record is thinnest.
        </p>
      </div>
    </div>
  )
}

const RATING_WORD = { green: 'Green', amber: 'Amber', red: 'Red' } as const
