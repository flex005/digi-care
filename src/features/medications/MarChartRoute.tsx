import { now as appNow } from '@/data/fixtures/clock'
import { useCallback, useMemo, useState } from 'react'
import { useWideScreen } from '@/components/shell/wide-screen'
import { useOutletContext, useParams } from 'react-router-dom'
import type { IsoDate, MarCellState, Medication, ResidentId } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { getMarRecords } from '@/data/access/client'
import type { MarRecord } from '@/data/fixtures/medications'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, Tooltip } from '@/components/primitives'
import { AggregateFigure, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { marCellDescription } from '@/components/status/MarCell'
import { useTimeZone } from '@/app/session/use-session'
import { formatDate, zonedDate } from '@/lib/format'
import { MarGridCell } from './MarGridCell'
import { ExportControl } from './ExportControl'
import { MarLegend } from './MarLegend'
import { buildMarGrid, daysIn, type MarRange } from './mar-grid'
import styles from './medications.module.css'

/**
 * The MAR chart. PRD §6.4, and the screen the Evidence Invariant was designed
 * around.
 *
 * The one fact it exists to surface: **these doses have no record against
 * them, and the window has closed.**
 *
 * That is why the omissions figure sits above the grid rather than being
 * something a reader arrives at. A week is 168 cells and all but a handful say
 * "given"; a screen that makes somebody scan for the holes has buried its own
 * finding. **The banner states it, the grid proves it.**
 *
 * Read-only. The administration flow is a separate surface.
 */

const DEFAULT_RANGE: MarRange = 'week'

export function MarChartRoute() {
  /*
   * The grid needs 1188px and the content column gives 970 at 1280, so the
   * screen takes the rail's 176px and the gutter's 48px rather than narrowing
   * a dose target to the accessibility floor. Restored on the way out.
   */
  useWideScreen()

  const { resident, site } = useOutletContext<ResidentProfile>()
  const { residentId } = useParams<{ residentId: string }>()
  const timeZone = useTimeZone()

  const [range, setRange] = useState<MarRange>(DEFAULT_RANGE)
  const [anchor, setAnchor] = useState<IsoDate>(() =>
    zonedDate(appNow().toISOString() as never, timeZone),
  )
  const [selected, setSelected] = useState<string | 'none'>('none')
  /**
   * Narrows the grid to the rows that carry an omission.
   *
   * A filter, so Rule 3c applies: it hides *rows*, never cells, and the
   * figure above it is unchanged — it counts the whole range either way, so
   * the claim never becomes an artefact of the view.
   */
  const [onlyOmissions, setOnlyOmissions] = useState(false)

  const load = useCallback(
    () => getMarRecords((residentId ?? '') as ResidentId),
    [residentId],
  )
  const resource = useResource<{
    medications: Medication[]
    records: MarRecord[]
  }>(load, [residentId])

  const days = useMemo(() => daysIn(anchor, range), [anchor, range])

  const grid = useMemo(() => {
    if (resource.kind !== 'ready') return undefined
    return buildMarGrid(resource.data.medications, resource.data.records, days)
  }, [resource, days])

  const step = (direction: -1 | 1) => {
    const next = new Date(`${anchor}T00:00:00Z`)
    if (range === 'week') next.setUTCDate(next.getUTCDate() + direction * 7)
    else next.setUTCMonth(next.getUTCMonth() + direction)
    setAnchor(next.toISOString().slice(0, 10) as IsoDate)
    setSelected('none')
  }

  if (resource.kind === 'loading') {
    return (
      <div className={styles.tabPanel}>
        <p className={styles.loading} role="status">
          Loading the medication record…
        </p>
      </div>
    )
  }

  if (resource.kind === 'error' || grid === undefined) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>
            This medication record could not be loaded
          </p>
          <p className={styles.errorBody}>
            Nothing has been lost; this is a read. A partial MAR chart is not shown,
            because a missing cell and an unrecorded dose look identical.
          </p>
          {resource.kind === 'error' ? (
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          ) : null}
        </Card>
      </div>
    )
  }

  const rangeLabel =
    range === 'week'
      ? `Week of ${days[0]?.label} to ${days[days.length - 1]?.label}`
      : `Month of ${days[0]?.label.slice(3)}`

  const visibleRows = onlyOmissions
    ? grid.rows.filter((row) => row.omitted > 0)
    : grid.rows

  const selectedCell = grid.rows
    .flatMap((row) => row.cells.map((cell) => ({ row, cell })))
    .find(
      ({ cell }) => keyOf(cell.medicationId, cell.date, cell.roundTime) === selected,
    )

  return (
    <div className={styles.tabPanel}>
      {/* The fact the screen exists for, before a single cell is scanned. */}
      <div className={styles.omissions} data-omissions>
        <AggregateFigure
          emphasis="banner"
          caption="doses with no record"
          denominatorNoun={`doses due this ${range}`}
          note="Every other dose in this range has a record against it: given, or not given with a reason."
          action={
            grid.omissions.count > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setOnlyOmissions((only) => !only)}
                aria-pressed={onlyOmissions}
              >
                {onlyOmissions ? 'Show every medication' : 'Show only these'}
              </Button>
            ) : undefined
          }
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: grid.omissions.count,
            coverage: { covered: grid.omissions.count, total: grid.omissions.ofDue },
          }}
        />
      </div>

      <Card>
        <div className={styles.chartHead}>
          <div>
            <h2 className={styles.chartTitle}>{rangeLabel}</h2>
            <p className={styles.chartFacts}>
              {/* The resident's own site, not the one the manager happens to
                  be looking at. The profile renders these times in
                  `profile.site`'s zone, so naming `activeSite` here could put
                  one site's name over another site's clock — a wrong label on
                  a clinical timestamp (§6). */}
              {grid.rows.length} medications · {grid.rounds.length} rounds a day · times
              in {site.name}&rsquo;s zone
            </p>
          </div>
          <div className={styles.range}>
            {/* Icon-only, so it carries an accessible name and a tooltip
                (§7) — and the name says which way and by how much, because
                "Earlier" does not tell a keyboard user whether they are moving
                a week or a month. */}
            <Tooltip content={`Previous ${range}`}>
              <Button
                variant="secondary"
                size="small"
                aria-label={`Previous ${range}`}
                onClick={() => step(-1)}
              >
                <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
              </Button>
            </Tooltip>
            <div className={styles.segmented} role="group" aria-label="Range">
              {(['week', 'month'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    styles.segment,
                    range === option ? styles.segmentActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={range === option}
                  onClick={() => {
                    setRange(option)
                    setSelected('none')
                  }}
                >
                  {option === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            <Tooltip content={`Next ${range}`}>
              <Button
                variant="secondary"
                size="small"
                aria-label={`Next ${range}`}
                onClick={() => step(1)}
              >
                <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
              </Button>
            </Tooltip>

            {/* Beside the range control, because the range is what it would
                export. An export button somewhere else on the page would be a
                claim about the whole record. */}
            <ExportControl
              resident={resident}
              range={range}
              rangeLabel={rangeLabel}
              siteName={site.name}
              medications={grid.rows.length}
              rounds={grid.rounds.length}
              days={grid.days.length}
            />
          </div>
        </div>

        <MarLegend />

        <div className={styles.gridScroll}>
          <table
            className={styles.grid}
            aria-label={`Medication administration record, ${rangeLabel}, ${resident.fullLegalName}`}
          >
            <thead>
              <tr>
                <th className={styles.medHead} rowSpan={2} scope="col">
                  Medication
                </th>
                {grid.days.map((day) => (
                  <th
                    key={day.date}
                    className={styles.dayHead}
                    colSpan={grid.rounds.length}
                    scope="colgroup"
                  >
                    {day.weekday}
                    <span className={styles.dayDate} data-numeric>
                      {day.label}
                    </span>
                  </th>
                ))}
                <th className={styles.totalHead} rowSpan={2} scope="col">
                  This {range}
                </th>
              </tr>
              <tr>
                {grid.days.flatMap((day) =>
                  grid.rounds.map((round, index) => (
                    <th
                      key={`${day.date}-${round}`}
                      className={[styles.roundHead, index === 0 ? styles.dayStart : '']
                        .filter(Boolean)
                        .join(' ')}
                      scope="col"
                    >
                      <span data-numeric>{round}</span>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.medication.id}>
                  <th className={styles.medCell} scope="row">
                    <span className={styles.medName}>{row.medication.name}</span>
                    <span className={styles.medDose}>
                      {row.medication.dose} · {row.medication.route}
                      {row.medication.isPrn ? ' · PRN' : ''}
                    </span>
                    {row.medication.isControlledDrug ? (
                      <span className={styles.cdTag}>Controlled drug</span>
                    ) : null}
                  </th>

                  {row.cells.map((cell, index) => {
                    const key = keyOf(cell.medicationId, cell.date, cell.roundTime)
                    return (
                      <td
                        key={key}
                        className={[
                          styles.cellSlot,
                          index % grid.rounds.length === 0 ? styles.dayStart : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <MarGridCell
                          state={cell.state}
                          description={sentenceFor(row.medication, cell, timeZone)}
                          selected={selected === key}
                          onSelect={() => setSelected(key)}
                        />
                      </td>
                    )
                  })}

                  {/* Rule 4 on every row: counted out of the rounds this
                      medication was scheduled for, never out of the grid's
                      cells — most of which are not_due for this row. */}
                  <td className={styles.totalCell}>
                    {row.omitted > 0 ? (
                      <span className={styles.totalOmitted}>
                        {row.omitted} with no record
                      </span>
                    ) : null}
                    <span className={styles.totalGiven}>
                      {row.given} given of {row.scheduled} due
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The same sentence the screen reader announces. One string, so the
            two can never disagree about what a cell says. */}
        <div className={styles.detail} aria-live="polite">
          <p className={styles.detailCaption}>Cell detail</p>
          {selectedCell === undefined ? (
            <p className={styles.detailBody}>
              Choose any cell. What appears here is what a screen reader announces.
            </p>
          ) : (
            <>
              <p className={styles.detailBody}>
                {sentenceFor(selectedCell.row.medication, selectedCell.cell, timeZone)}
              </p>
              {/* Through Unrecorded, not a local dashed border: the hatch has
                  exactly one definition and the component is what forces the
                  words to go with it (scripts/check-hatch.mjs). */}
              {selectedCell.cell.state.kind === 'omitted' ? (
                <p className={styles.detailGap}>
                  <Unrecorded
                    variant="row"
                    label="Nobody recorded anything"
                    detail="This is not a record that the dose was withheld."
                  />
                </p>
              ) : null}
              {selectedCell.cell.state.kind === 'given' &&
              selectedCell.cell.state.witness.kind === 'required_not_recorded' ? (
                <p className={styles.detailGap}>
                  <Unrecorded
                    variant="row"
                    label="Second signature not recorded"
                    detail="A controlled drug requires one. This is not a record that none was needed."
                  />
                </p>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

const keyOf = (medicationId: string, date: string, round: string) =>
  `${medicationId}|${date}|${round}`

/**
 * The full sentence, built once and used for both the accessible name and the
 * detail panel — PRD §6.4 wants "08:00, 5 April, Amlodipine 5mg — given by
 * C. Nwosu at 08:04", and a cell read out of context has to be unambiguous.
 */
function sentenceFor(
  medication: Medication,
  cell: { date: IsoDate; roundTime: string; state: MarCellState },
  timeZone: string,
): string {
  // DD/MM/YYYY, not the ISO key. The key is how the grid finds a cell; this is
  // what a person hears (CLAUDE.md §6).
  const context = `${cell.roundTime}, ${formatDate(cell.date)}, ${medication.name} ${medication.dose}`
  return marCellDescription(cell.state, context, timeZone)
}
