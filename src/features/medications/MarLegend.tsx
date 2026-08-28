import type { MarCellState, StaffRef } from '@/data/types'
import { MarCellSwatch } from './MarGridCell'
import styles from './medications.module.css'

/**
 * The five states, permanently above the grid. PRD §6.4: "A legend is
 * permanently visible above the grid, not hidden behind a tooltip."
 *
 * Not a tooltip, and the reason is the one this whole module exists for: the
 * grid means the opposite of what it looks like to somebody who has not been
 * told what an empty cell is. A legend you have to hover to find is a legend
 * that is not there when somebody skims 168 cells looking for a hole.
 *
 * Each swatch is drawn by `MarCellSwatch`, the same definition the grid cell
 * uses — not a hand-styled copy. A legend that drifts from the thing it
 * explains is worse than none.
 *
 * A swatch is a `<span>`, not a button: the legend is an explanation, and a
 * focusable control with no accessible name in the tab order is a defect
 * whichever way it is hidden.
 */

/**
 * A stand-in, and never rendered: the legend's swatches carry no text and are
 * `aria-hidden`, because the explanation beside them is the label. Naming a
 * real member of staff in a legend would put them on a screen they had nothing
 * to do with.
 */
const LEGEND_STAFF: StaffRef = {
  id: 'staff-legend' as StaffRef['id'],
  displayName: 'C. Nwosu',
  fullName: 'Chidi Nwosu',
  role: 'senior_carer',
  isActive: true,
}

const SAMPLES: {
  states: MarCellState[]
  title: string
  note: string
}[] = [
  {
    states: [{ kind: 'not_due' }],
    title: 'Not due',
    note: 'nothing is scheduled: the only empty cell',
  },
  {
    states: [
      {
        kind: 'due',
        windowOpensAt: '2026-08-22T08:00:00+01:00',
        windowClosesAt: '2026-08-22T09:00:00+01:00',
      },
    ],
    title: 'Due',
    note: 'window open, nobody has acted yet',
  },
  {
    states: [
      {
        kind: 'given',
        givenAt: '2026-08-22T08:04:00+01:00',
        givenBy: LEGEND_STAFF,
        witness: { kind: 'not_required' },
      },
    ],
    title: 'Given',
    note: 'recorded, with who and when',
  },
  {
    states: [
      {
        kind: 'not_given',
        reason: 'resident_refused',
        note: '',
        recordedAt: '2026-08-22T08:04:00+01:00',
        recordedBy: LEGEND_STAFF,
      },
    ],
    title: 'Not given',
    note: 'also complete: a signed decision, with a reason',
  },
  {
    /**
     * Both forms, in one cell.
     *
     * Six columns fit at 1280px but leave 113px of text apiece, which runs the
     * longest note to four lines. Five leaves 144px and two. So escalated is
     * not a sixth state here — it is the same state with a mark, and showing
     * both swatches is what lets a reader recognise the mark rather than
     * having to infer it from a sentence.
     */
    states: [
      {
        kind: 'omitted',
        dueAt: '2026-08-22T08:00:00+01:00',
        escalation: { kind: 'not_escalated' },
      },
      {
        kind: 'omitted',
        dueAt: '2026-08-22T08:00:00+01:00',
        escalation: { kind: 'escalated', at: '2026-08-22T09:04:00+01:00' },
      },
    ],
    title: 'No record',
    note: 'window closed, nobody wrote. A mark means escalated.',
  },
]

export function MarLegend() {
  return (
    <div className={styles.legend} aria-label="What each cell means">
      {SAMPLES.map(({ states, title, note }) => (
        <p key={title} className={styles.legendItem}>
          <span className={styles.legendSwatch}>
            {states.map((state, index) => (
              <MarCellSwatch key={index} state={state} />
            ))}
          </span>
          <span>
            <span className={styles.legendTitle}>{title}</span>
            <span className={styles.legendNote}>{note}</span>
          </span>
        </p>
      ))}
    </div>
  )
}
