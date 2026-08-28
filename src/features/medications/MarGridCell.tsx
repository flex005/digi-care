import type { MarCellState } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Icon } from '@/components/icon/Icon'
import styles from './medications.module.css'

/**
 * One cell of the MAR grid, at grid density.
 *
 * **Every distinction here is carried by shape, and colour only reinforces
 * it.** At 34px, on a mediocre monitor, in greyscale, hue is the first thing
 * to go — and the pair most at risk is the one that matters most:
 *
 *   given      a tick     recorded and complete
 *   not given  a bar      ALSO recorded and complete — a decision somebody
 *                         signed, with a reason. Rule 3: it must read as
 *                         settled, because it is not a gap.
 *   due        a ring     open, unfinished, not yet late
 *   omitted    no glyph   and the only *patterned* cell in the grid
 *   not due    empty      the one genuinely empty cell, and it is empty
 *                         because nothing is scheduled — not because nobody
 *                         recorded
 *
 * The hatch appears on exactly one state, so it survives desaturation by
 * construction (§4.5). The absence of a glyph on `omitted` is doing work too:
 * every closed shape in the grid means somebody acted, and an open unmarked
 * cell means nobody did.
 *
 * **Escalated omissions carry a glyph, unescalated ones do not.** The
 * reference distinguished them by border hue plus a 5px dot; hue does not
 * survive greyscale and a 5px dot is not reliably visible at this size. A
 * glyph is the same carrier every other distinction in this grid uses, and it
 * makes the binary legible: no mark, nobody escalated; a mark, somebody did.
 *
 * The button is the cell. A `<td>` with a click handler is not reachable by
 * keyboard and has no role; this is a real control inside a real table cell,
 * with the full sentence as its accessible name (PRD §6.4, §7).
 */

/**
 * The glyph, written at the call site rather than looked up in a table.
 *
 * `scripts/icons/scan-usage.mjs` only finds names that are statically visible
 * on the Icon element itself, and that is deliberate: a name assembled
 * elsewhere cannot be traced into the bundle, so it typechecks and then fails
 * at runtime. A lookup table is exactly that case, and it did fail that way
 * here before this was inlined.
 *
 * The scanner does not strip comments, so prose in this file must not spell
 * the element out either — it read the placeholder in this very docblock and
 * went looking for an icon called "…".
 */
function Glyph({ state }: { state: MarCellState }) {
  switch (state.kind) {
    case 'not_due':
      return null
    case 'due':
      // An open ring: the window is open and nothing has closed it.
      return <Icon name="geometric-sharps/circle" size={12} aria-hidden />
    case 'given':
      return <Icon name="check-validation/tick-02" size={12} aria-hidden />
    case 'not_given':
      // A bar, not a cross: this is a decision somebody signed, not an error.
      return <Icon name="add-remove-delete/remove-01" size={12} aria-hidden />
    case 'omitted':
      // Glyphless unless escalated — every closed shape in this grid means
      // somebody acted, and a mark here means somebody raised it.
      return state.escalation.kind === 'escalated' ? (
        <Icon name="alert-notification/alert-02" size={12} aria-hidden />
      ) : null
    default:
      return assertNever(state)
  }
}

function className(state: MarCellState): string {
  switch (state.kind) {
    case 'not_due':
      return styles.cellNotDue
    case 'due':
      return styles.cellDue
    case 'given':
      // Rule 3a: given AND missing its required second signature is two facts,
      // so it keeps the settled green fill and takes a dashed underline. Not a
      // different fill — that would merge two facts into one averaged state.
      return state.witness.kind === 'required_not_recorded'
        ? `${styles.cellGiven} ${styles.cellNoWitness}`
        : styles.cellGiven
    case 'not_given':
      return styles.cellNotGiven
    case 'omitted':
      return state.escalation.kind === 'escalated'
        ? `${styles.cellOmitted} ${styles.cellEscalated}`
        : styles.cellOmitted
    default:
      return assertNever(state)
  }
}

/**
 * The look of a cell, without the behaviour.
 *
 * The legend needs the appearance and nothing else. Drawing it as a button
 * would put a focusable control with no accessible name into the tab order —
 * and hiding that button from assistive technology while leaving it focusable
 * is its own violation. So the legend gets the visual and the grid gets the
 * control, from one definition, and the two cannot drift.
 */
export function MarCellSwatch({ state }: { state: MarCellState }) {
  return (
    <span
      className={[styles.cell, className(state)].join(' ')}
      data-mar={state.kind}
      data-escalated={state.kind === 'omitted' && state.escalation.kind === 'escalated'}
      aria-hidden
    >
      <Glyph state={state} />
    </span>
  )
}

export function MarGridCell({
  state,
  description,
  selected,
  onSelect,
}: {
  state: MarCellState
  /** The full sentence. Accessible name and detail-panel text, one string. */
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={[styles.cell, className(state), selected ? styles.cellSelected : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={description}
      aria-pressed={selected}
      data-mar={state.kind}
      data-escalated={state.kind === 'omitted' && state.escalation.kind === 'escalated'}
      data-witness={state.kind === 'given' ? state.witness.kind : undefined}
      onClick={onSelect}
    >
      <Glyph state={state} />
    </button>
  )
}
