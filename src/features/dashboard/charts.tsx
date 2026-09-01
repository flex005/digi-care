import { useId } from 'react'
import { formatCount } from '@/lib/format'
import type { DaySeries, DoseDay, RoundToday, TodayDoses } from './series'
import styles from './charts.module.css'

/**
 * The Dashboard's charts, hand-authored. Phase 12, restyled.
 *
 * **No chart library.** Every shape here is a polyline, a path or a stroked
 * circle, which is what the approved reference is made of too. A library would
 * have to be fought on the one requirement that matters most — the hatch is an
 * SVG `<pattern>` filling an area and stroking an arc, not a series colour —
 * and on colour, which reaches these components only as `var(--token)` through
 * a stylesheet, never as a prop.
 *
 * **Nothing in this file is green**, and nothing renders a percentage. Every
 * chart shows recorded against expected, because a chart of a percentage hides
 * its own denominator: a bar at 92% looks like evidence whatever it is 92% of.
 */

/**
 * The id prefix every chart fills or strokes with.
 *
 * **Suffixed per chart, and the defs go inside the chart that uses them.** The
 * pattern used to be declared once per page, in an `<svg>` of its own, and
 * referenced by `url(#…)` from four other `<svg>` elements. A browser resolves
 * that — ids are document-wide — and anything reading one `<svg>` as a
 * standalone document does not: it finds a fill referring to a paint server
 * that is not there, and falls back to solid. Which is how the most
 * load-bearing visual in the product exports as its own opposite, a gap
 * nobody recorded rendering as a bar that was.
 */
export const HATCH = 'digicare-chart-hatch'

/**
 * What a round cap costs an arc, in dasharray units.
 *
 * The donut's radius makes its circumference 100 units, so one unit is one per
 * cent and the allowance is exactly the stroke width in charts.module.css.
 * Kept beside it rather than derived, because the two have to be changed
 * together and a reader who moves one has to see the other.
 */
export const CAP = 5.5
/** Small enough to stay honest, large enough to be a shape rather than a dot. */
const MIN_ARC = 0.5

/**
 * One arc, as an explicit path rather than a dash pattern on a circle.
 *
 * **Both of these were `stroke-dasharray` on a full circle, and that is a
 * trick rather than a shape.** It draws correctly in a browser and it is not
 * geometry: nothing in the file says where the arc starts or ends, only how
 * long the painted run is and how far the dash is offset. Anything reading the
 * document rather than rasterising it — a design-tool importer, an SVG
 * optimiser — sees a dashed circle and repeats the dash, which is what it
 * literally says.
 *
 * It also carried a bug the dash hid. The dash convention is 0–100 because the
 * donut's radius makes its circumference exactly 100 units; the rings copied
 * the convention at `r=17`, whose circumference is 106.8, so every ring painted
 * its share times 100/106.8 — a round with 76 per cent recorded drew 71. A
 * copied formula is a second rule even when it is copied correctly, because
 * the constant that made the original true did not come with it.
 *
 * Fractions run 0–1 clockwise from twelve o'clock, which is where both charts
 * start.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
): string {
  const span = to - from
  // A full turn has no two distinct endpoints, so it is drawn as two halves.
  if (span >= 1) {
    return [
      `M${cx},${cy - r}`,
      `A${r},${r} 0 0 1 ${cx},${cy + r}`,
      `A${r},${r} 0 0 1 ${cx},${cy - r}`,
    ].join(' ')
  }
  const point = (fraction: number) => {
    const angle = fraction * 2 * Math.PI - Math.PI / 2
    return `${(cx + r * Math.cos(angle)).toFixed(4)},${(cy + r * Math.sin(angle)).toFixed(4)}`
  }
  return `M${point(from)} A${r},${r} 0 ${span > 0.5 ? 1 : 0} 1 ${point(to)}`
}

/**
 * The hatch, as an SVG pattern — the second medium the treatment lives in.
 *
 * **One definition, and `scripts/check-hatch.mjs` enforces it here too.** The
 * CSS hatch in `styles/unrecorded.module.css` is the definition for anything
 * with a box around it; this is the same treatment where the consumer is a
 * chart area or an arc stroke, which cannot take a CSS background at all.
 *
 * Same 45°, same rhythm, and the band takes `--status-unrecorded` rather than
 * the tint the CSS hatch lays over a surface. That is the §4 rule about which
 * token a fill takes rather than a second palette: at ten pixels of bar the
 * tint is white, and a hatch nobody can see is a solid neutral fill, which is
 * the one thing Rule 2 says this must never become.
 *
 * Rendered once per page. The colours come from CSS so stylelint's token rule
 * still governs them.
 */
export function ChartDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width="12"
        height="12"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="12" height="12" className={styles.hatchGround} />
        <rect width="6" height="12" className={styles.hatchBand} />
      </pattern>
    </defs>
  )
}

/**
 * A hatch id belonging to one chart.
 *
 * `useId` rather than the bare constant, because the same pattern is now
 * declared inside each chart that uses it and two elements sharing an id is
 * invalid — and `url(#…)` resolves to whichever came first in the document,
 * which would tie every chart's hatch to the first chart that mounted.
 */
function useHatchId(): string {
  return `${HATCH}-${useId().replace(/:/g, '')}`
}

/**
 * The hatch at swatch size, in the same medium as the thing it labels.
 *
 * **A legend drawn by a different mechanism from its chart is two definitions
 * of one treatment**, and they disagree exactly where nobody looks. This one
 * did: the bars fill with the SVG `<pattern>` below and the swatch beside them
 * composed the CSS `repeating-linear-gradient`, which at twelve pixels lays
 * down most of one band of a pale tint inside a dashed border and reads as
 * blank. The reader was shown a key whose "not recorded" entry had no
 * treatment in it.
 *
 * The CSS hatch stays the definition for anything with a box around it — a
 * cell, a chip, a panel. This is for a swatch standing next to SVG geometry,
 * where matching the *chart* matters more than matching the surrounding boxes,
 * and it carries its own `<pattern>` because `url(#…)` does not resolve across
 * two `<svg>` elements anywhere but a browser.
 */
export function HatchSwatch({ size = 12 }: { size?: number }) {
  const id = useHatchId()
  return (
    <svg width={size} height={size} aria-hidden focusable="false">
      <ChartDefs id={id} />
      <rect
        width={size}
        height={size}
        rx="2"
        fill={`url(#${id})`}
        className={styles.swatchEdge}
      />
    </svg>
  )
}

/**
 * Seven days of one figure, with today marked.
 *
 * **A line and never an arrow.** "↑5%" states a direction with no denominator
 * and no period, which is the shape this build spent fifteen phases removing;
 * seven points carry the same direction and carry what it is a direction in.
 * The caption beside it says what the points count, because a sparkline under
 * a figure is otherwise read as that figure whether or not it is.
 */
export function Sparkline({ series, tone }: { series: DaySeries; tone: string }) {
  const values = series.points.map((point) => point.value)
  const top = Math.max(...values, 1)
  const step = values.length > 1 ? 120 / (values.length - 1) : 0

  const at = (value: number) => 30 - (value / top) * 26
  const points = values.map((value, index) => `${index * step},${at(value)}`).join(' ')
  const last = values[values.length - 1] ?? 0

  return (
    <svg
      className={styles.spark}
      viewBox="0 0 120 34"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${series.what}: ${values.map(formatCount).join(', ')}`}
      data-spark={tone}
    >
      <polyline className={styles.sparkLine} points={points} data-spark-line />
      <circle
        className={styles.sparkToday}
        cx={120}
        cy={at(last)}
        r={3.5}
        data-spark-today
      />
    </svg>
  )
}

/**
 * Doses recorded against doses due, by day, over seven days.
 *
 * One stacked bar a day: recorded at the bottom, the gap hatched on top, so
 * the height of the bar is what was due and the two parts are what became of
 * it. **The gap is hatched rather than shaded** — missing evidence is never a
 * lighter tint of the recorded colour, which is what keeps the distinction
 * alive in greyscale and to a colour-blind reader.
 *
 * The gap also carries its count above the bar. This home records most of its
 * doses, so the hatched segment is a few per cent of the bar: accurate, and too
 * small to read. The axis is not truncated to make it bigger, because hiding
 * zero magnifies a gap and that is the same lie about proportion as a
 * percentage with no denominator. The geometry stays honest and the figure is
 * printed.
 */
/**
 * A bar with its top corners curved and its foot square on the baseline.
 *
 * `rx` on a `<rect>` rounds all four corners, which lifts the bar off its own
 * axis and rounds the seam between two stacked segments as well. The path
 * curves only the end that is actually the end of the bar.
 */
function barPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height))
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ')
}

/** Matches --radius-md at the chart's own scale. */
const BAR_RADIUS = 6

export function DoseBars({ days }: { days: DoseDay[] }) {
  const hatchId = useHatchId()
  const width = 700
  const height = 250
  const left = 44
  const floor = 200
  const ceiling = 30

  const top = Math.max(...days.map((day) => day.due + day.stillToCome), 1)
  const slot = (width - left - 10) / Math.max(days.length, 1)
  const barWidth = Math.min(slot * 0.6, 54)
  const centre = (index: number) => left + slot * index + slot / 2
  const scale = (value: number) => (value / top) * (floor - ceiling)

  const gridlines = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg
      className={styles.area}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Doses recorded against doses due, by day. ${days
        .map((day) => `${formatCount(day.recorded)} of ${formatCount(day.due)}`)
        .join('; ')}.`}
      data-bar-chart
    >
      <ChartDefs id={hatchId} />
      <g className={styles.grid}>
        {gridlines.map((fraction) => (
          <line
            key={fraction}
            x1={left}
            x2={width - 10}
            y1={floor - fraction * (floor - ceiling)}
            y2={floor - fraction * (floor - ceiling)}
          />
        ))}
      </g>
      <g className={styles.axis}>
        {gridlines.map((fraction) => (
          <text key={fraction} x={8} y={floor - fraction * (floor - ceiling) + 4}>
            {formatCount(Math.round(top * fraction))}
          </text>
        ))}
      </g>

      {days.map((day, index) => {
        const recorded = scale(day.recorded)
        const gap = scale(day.noRecord)
        const x = centre(index) - barWidth / 2
        return (
          <g key={day.date} data-bar-day={day.date}>
            {/* Square-topped while the gap sits above it, curved when it is
                the top of the bar itself. */}
            <path
              className={styles.barRecorded}
              d={
                day.noRecord > 0
                  ? `M${x},${floor} L${x},${floor - recorded} L${x + barWidth},${floor - recorded} L${x + barWidth},${floor} Z`
                  : barPath(x, floor - recorded, barWidth, recorded, BAR_RADIUS)
              }
              data-bar-segment="recorded"
            />
            {day.noRecord > 0 ? (
              <path
                d={barPath(x, floor - recorded - gap, barWidth, gap, BAR_RADIUS)}
                fill={`url(#${hatchId})`}
                data-bar-segment="gap"
              />
            ) : null}
            {day.noRecord > 0 ? (
              <text
                className={styles.gapLabel}
                x={centre(index)}
                y={floor - recorded - gap - 7}
                textAnchor="middle"
                data-gap-label={day.date}
              >
                {formatCount(day.noRecord)}
              </text>
            ) : null}
            {/* Today is still running, so its bar is not a whole day yet. */}
            {day.daysBack === 0 ? (
              <rect
                className={styles.barToday}
                x={x - 3}
                y={floor - recorded - gap - 3}
                width={barWidth + 6}
                height={recorded + gap + 3}
                rx={BAR_RADIUS + 2}
                data-today-mark
              />
            ) : null}
          </g>
        )
      })}

      <line
        className={styles.baseline}
        x1={left}
        x2={width - 10}
        y1={floor}
        y2={floor}
      />

      <g className={styles.axis}>
        {days.map((day, index) => (
          <text key={day.date} x={centre(index)} y={floor + 22} textAnchor="middle">
            {day.daysBack === 0 ? 'today' : day.date.slice(8, 10)}
          </text>
        ))}
      </g>
    </svg>
  )
}

/**
 * Today's rounds, as counts rather than proportions.
 *
 * **The segments are counts**, so a home that has recorded nothing renders a
 * mostly-hatched ring rather than an empty one — the absence is drawn rather
 * than left as blank space. The centre states the denominator, because a
 * donut without one is a percentage with extra steps.
 *
 * Not-due-yet takes `--border-subtle`, never a success colour. It has not
 * happened, so nobody has succeeded at it.
 */
export function RoundsDonut({ doses }: { doses: TodayDoses }) {
  const hatchId = useHatchId()
  const total = Math.max(doses.total, 1)
  const arcs = [
    { key: 'recorded', value: doses.recorded, className: styles.arcRecorded },
    { key: 'no-record', value: doses.noRecord, className: styles.arcNoRecord },
    { key: 'due-now', value: doses.dueNow, className: styles.arcDueNow },
    { key: 'due-soon', value: doses.dueSoon, className: styles.arcDueSoon },
    { key: 'not-due-yet', value: doses.notDueYet, className: styles.arcNotDue },
  ]

  let offset = 0
  return (
    <svg
      className={styles.donut}
      viewBox="0 0 42 42"
      role="img"
      aria-label={`Today's doses: ${formatCount(doses.recorded)} recorded, ${formatCount(
        doses.noRecord,
      )} with no record, ${formatCount(doses.dueNow)} due now, ${formatCount(
        doses.dueSoon,
      )} due soon, ${formatCount(
        doses.notDueYet,
      )} not due yet, of ${formatCount(doses.total)} in total.`}
      data-donut
    >
      <ChartDefs id={hatchId} />
      <circle className={styles.donutTrack} cx="21" cy="21" r="15.915" />
      {arcs.map((arc) => {
        const share = (arc.value / total) * 100
        if (share === 0) return null
        /*
         * Round caps, and the dash shortened to pay for them.
         *
         * A round cap adds half the stroke width of arc at each end, so a
         * segment drawn at its true length paints wider than its share and
         * every boundary sits in the wrong place. The radius is chosen so the
         * circumference is 100 units, which makes the allowance the stroke
         * width itself: shorten by that and shift the start by half, and what
         * is painted, caps included, is the share.
         *
         * **A segment at or below the allowance takes square caps instead.**
         * Compensating one that small leaves nothing to draw, so the two caps
         * meet and the arc becomes a rounded blob: the doses nobody recorded
         * were 4.9% of the ring and rendered as a stub with no length to read.
         * Square-capped at its true share it is a short arc, which is what it
         * is. Rounding is a finish; it does not get to eat the smallest
         * segment on the chart, which is usually the one that matters.
         */
        const rounded = share > CAP + MIN_ARC
        const painted = rounded ? share - CAP : share
        const start = rounded ? offset + CAP / 2 : offset
        const element = (
          <path
            key={arc.key}
            className={arc.className}
            d={arcPath(21, 21, 15.915, start / 100, (start + painted) / 100)}
            fill="none"
            // Geometry, not colour: a segment too short to survive round caps
            // is drawn square so it keeps its length.
            strokeLinecap={rounded ? undefined : 'butt'}
            // A reference to the pattern, not a colour — every colour on this
            // page still reaches it as a token, through the stylesheet.
            stroke={arc.key === 'no-record' ? `url(#${hatchId})` : undefined}
            data-arc={arc.key}
            data-arc-value={arc.value}
            /* What is painted, caps included: the share less the round-cap
               allowance where the segment is long enough to pay it. Stated by
               the component so a guard reads the number rather than measuring
               a path string, which would be the same arithmetic written twice. */
            data-arc-share={painted}
          />
        )
        offset += share
        return element
      })}
    </svg>
  )
}

/**
 * One round today, as a ring.
 *
 * The track behind an incomplete ring is hatched, so a short round is short
 * *and* patterned — the same fact the area chart states for the week, said
 * again at the scale of one round.
 */
export function RoundRing({ round }: { round: RoundToday }) {
  const hatchId = useHatchId()
  const total = Math.max(round.expected, 1)
  const done = (round.recorded / total) * 100
  const started = round.recorded > 0 || round.noRecord > 0 || round.dueNow > 0

  return (
    <svg
      className={styles.ring}
      viewBox="0 0 42 42"
      role="img"
      aria-label={`${round.at}: ${formatCount(round.recorded)} of ${formatCount(
        round.expected,
      )} recorded`}
      data-ring={round.at}
    >
      <ChartDefs id={hatchId} />
      {/*
       * A round nobody has reached yet gets the plain track, not the hatch:
       * the hatch means a gap somebody can close, and there is nothing to
       * close until the round opens.
       */}
      <circle
        className={styles.ringTrack}
        cx="21"
        cy="21"
        r="17"
        stroke={
          started && round.recorded < round.expected ? `url(#${hatchId})` : undefined
        }
        data-ring-track={started && round.recorded < round.expected ? 'gap' : 'plain'}
      />
      {round.recorded > 0 ? (
        <path
          className={styles.ringDone}
          d={arcPath(21, 21, 17, 0, done / 100)}
          fill="none"
          data-ring-done
          data-ring-share={done}
        />
      ) : null}
    </svg>
  )
}
