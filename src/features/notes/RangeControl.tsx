import { Button, Tooltip } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { RANGE_DAYS, type NoteRange } from './note-window'
import styles from './notes.module.css'

/**
 * The timeline's window control.
 *
 * **The MAR chart's control, deliberately.** Same shape, same segmented
 * group, same stepping buttons either side, same accessible names. Two screens
 * that bound a stretch of time should not ask a reader to learn two ways of
 * moving through it, and this is CLAUDE.md §6's rule read the other way round:
 * one meaning, one shape.
 *
 * The stepping is what keeps the window honest. A bound with no way past it
 * would hide the rest of the record behind a default nobody chose; with it,
 * every note is reachable and the reader can see how far back they are.
 */
export function RangeControl({
  range,
  stepsBack,
  onRangeChange,
  onStep,
}: {
  range: NoteRange
  /** How many whole windows back from now. 0 is the window ending now. */
  stepsBack: number
  onRangeChange: (range: NoteRange) => void
  /** +1 is later, −1 is earlier, matching the arrows. */
  onStep: (direction: 1 | -1) => void
}) {
  const span = `${RANGE_DAYS[range]} days`

  return (
    <div className={styles.range} role="group" aria-label="Range shown">
      {/* Icon-only, so each carries an accessible name and a tooltip (§7) —
          and the name says by how much, because "Earlier" does not tell a
          keyboard user whether they are moving 7 days or 30. */}
      <Tooltip content={`Earlier ${span}`}>
        <Button
          variant="secondary"
          size="small"
          aria-label={`Earlier ${span}`}
          onClick={() => onStep(-1)}
        >
          <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        </Button>
      </Tooltip>

      <div className={styles.segmented} role="group" aria-label="Range">
        {(['week', 'month'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={[styles.segment, range === option ? styles.segmentActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={range === option}
            onClick={() => onRangeChange(option)}
          >
            {RANGE_DAYS[option]} days
          </button>
        ))}
      </div>

      {/* Disabled at the newest window rather than hidden: a control that
          vanishes at the edge leaves a reader wondering whether it was ever
          there. §7 — and it keeps its name while disabled. */}
      <Tooltip
        content={
          stepsBack === 0 ? `Already showing the ${span} to now` : `Later ${span}`
        }
      >
        <span>
          <Button
            variant="secondary"
            size="small"
            disabled={stepsBack === 0}
            aria-label={
              stepsBack === 0 ? `Already showing the ${span} to now` : `Later ${span}`
            }
            onClick={() => onStep(1)}
          >
            <Icon name="arrows-sharp/arrow-right-01-sharp" size={16} aria-hidden />
          </Button>
        </span>
      </Tooltip>
    </div>
  )
}
