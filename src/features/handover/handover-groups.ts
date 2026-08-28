import type { HandoverStatus } from '@/data/types'
import type { HandoverRow } from '@/data/access/handover-store'

/**
 * The four groups the handover list is read in. PRD §6.3.
 *
 * A single sorted list makes a nurse read every row to learn the shape of the
 * shift. Grouped, the shape is the headings: six not reviewed, two urgent,
 * five needing attention, the rest well.
 *
 * **Not reviewed leads**, above urgent, and that ordering is deliberate. Urgent
 * is information you have already received either way, and reading it later
 * costs nothing. Not reviewed is the only group still fixable before the
 * signature goes on, and once it is signed the chance is gone.
 *
 * The denominators differ between the groups on purpose, and it is the whole
 * point of Rule 4 here. "Not reviewed, 6 of 28" is measured across everybody
 * living at the site. "Urgent, 2 of 22" is measured across the residents
 * somebody actually looked at, because the other six were not assessed and
 * counting them in the denominator would claim a coverage nobody has.
 */

export type GroupId = HandoverStatus['kind']

export interface HandoverGroup {
  id: GroupId
  title: string
  /** Said in the heading when the group is empty, so zero is a real answer. */
  emptyNote: string
  /**
   * Which population the count is out of: everybody living here, or only the
   * residents somebody reviewed.
   */
  denominator: 'all_residents' | 'reviewed'
  rows: HandoverRow[]
}

const ORDER: {
  id: GroupId
  title: string
  emptyNote: string
  denominator: HandoverGroup['denominator']
}[] = [
  {
    id: 'not_reviewed',
    title: 'Not reviewed',
    emptyNote: 'Everybody living here has been looked at for this handover.',
    denominator: 'all_residents',
  },
  {
    id: 'urgent',
    title: 'Urgent',
    emptyNote: 'Nobody who was reviewed is urgent.',
    denominator: 'reviewed',
  },
  {
    id: 'needs_attention',
    title: 'Needs attention',
    emptyNote: 'Nobody who was reviewed needs attention.',
    denominator: 'reviewed',
  },
  {
    id: 'all_well',
    title: 'All well',
    emptyNote: 'Nobody has been recorded as well.',
    denominator: 'reviewed',
  },
]

/**
 * All four groups, always, in reading order.
 *
 * An empty group keeps its heading and states its zero. Dropping it would make
 * "nobody is urgent" and "nobody has checked whether anybody is urgent" the
 * same absence, which is the blank-cell failure one level up: absence from a
 * list is the same bug as a blank cell.
 */
export function groupRows(rows: HandoverRow[]): HandoverGroup[] {
  return ORDER.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.status.kind === group.id),
  }))
}
