import type { BodyRegionId } from '@/data/types'
import {
  BACK_REGIONS,
  BODY_MAP_VIEWBOX,
  FRONT_REGIONS,
  type MappedRegion,
  type RegionShape,
} from './regions'
import styles from './BodyMap.module.css'

/**
 * The body map. CLAUDE.md §3's named exception, and the only hand-authored
 * diagram in the product.
 *
 * **The map is the input method; the list beside it is the record.** A diagram
 * alone is unreadable to a screen reader and indistinguishable in greyscale,
 * so nothing here is the only carrier of anything: every region is a real
 * button with an accessible name and a pressed state, every marked site also
 * appears as text, and the marked treatment is a fill *and* a heavier stroke
 * rather than a colour alone.
 *
 * The component takes ids and gives back ids. It has no idea what an incident
 * is, which is what keeps the geometry from acquiring opinions about records.
 */
export function BodyMap({
  view,
  marked,
  onToggle,
  readOnly = false,
}: {
  view: 'front' | 'back'
  marked: BodyRegionId[]
  onToggle?: (id: BodyRegionId) => void
  /**
   * A record being read rather than written.
   *
   * The regions stop being buttons entirely — not disabled buttons. A disabled
   * control says "you could do this and cannot right now"; on a detail screen
   * nobody is marking anything, and a tab stop on every region would be
   * thirty-six stops through a diagram that does nothing.
   */
  readOnly?: boolean
}) {
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${BODY_MAP_VIEWBOX.width} ${BODY_MAP_VIEWBOX.height}`}
      role="group"
      aria-label={
        view === 'front'
          ? 'Front of the body. Left and right are the resident’s.'
          : 'Back of the body. Left and right are the resident’s.'
      }
      data-body-map={view}
    >
      {regions.map((region) => (
        <Region
          key={`${view}-${region.id}`}
          region={region}
          pressed={marked.includes(region.id)}
          readOnly={readOnly}
          onToggle={onToggle}
        />
      ))}
    </svg>
  )
}

function Region({
  region,
  pressed,
  readOnly,
  onToggle,
}: {
  region: MappedRegion
  pressed: boolean
  readOnly: boolean
  onToggle?: (id: BodyRegionId) => void
}) {
  if (readOnly) {
    // Not a control. Marked regions keep their fill and stroke, and the sites
    // are listed as text beside the map — which is the record either way.
    return (
      <g className={styles.region} data-region={region.id} data-marked={pressed}>
        <Shape shape={region.shape} />
        <title>{region.label}</title>
      </g>
    )
  }

  /*
   * `role="button"` on a `<g>` rather than a real `<button>`, because SVG has
   * no button element and a foreignObject wrapper cannot be positioned over an
   * arbitrary shape. It carries everything a button carries: a name, a pressed
   * state, a tab stop, and Enter and Space.
   */
  return (
    <g
      className={styles.region}
      role="button"
      tabIndex={0}
      aria-label={region.label}
      aria-pressed={pressed}
      data-region={region.id}
      data-marked={pressed}
      onClick={() => onToggle?.(region.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle?.(region.id)
        }
      }}
    >
      <Shape shape={region.shape} />
      {/* Read by pointer users on hover; the accessible name covers the rest. */}
      <title>{region.label}</title>
    </g>
  )
}

function Shape({ shape }: { shape: RegionShape }) {
  if (shape.kind === 'ellipse') {
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
  }
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      rx={shape.r}
    />
  )
}
