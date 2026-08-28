import type { Resident } from '@/data/types'
import { Settled } from '@/components/status'
import { RISK_FLAG_SOURCES } from './risk-flag-sources'
import styles from './residents.module.css'

/**
 * The Risk flags column. PRD §6.2, and the sharpest decision on this screen.
 *
 * Rendering every status on all 32 rows is unreadable — volume that drowns a
 * distinction is the same failure as a blank cell. But rendering only the
 * notable ones leaves an empty cell for everyone else, and **an empty cell is
 * exactly what this product exists to prevent**: it reads as "nothing wrong"
 * when it may mean nobody has looked.
 *
 * The resolution is a rule, stated in the legend beside the table so it can
 * never become folk knowledge:
 *
 *     Anything not shown has been recorded and is unremarkable.
 *
 * It holds because every contributing status renders a hatched badge when it
 * is unrecorded — see risk-flag-sources.tsx, where that is a required field
 * and a tested precondition rather than a convention.
 *
 * There is deliberate overlap with the Critical records missing chip:
 * falls-not-assessed appears in both. They answer different questions (PRD §1:
 * *what does this person need right now* versus *can you prove you did what
 * you said*). Suppressing one would be tidier and less true.
 */
/**
 * Whether this resident's picture is entirely settled — nothing unrecorded and
 * nothing notable.
 *
 * **Exported because the guard that keeps the branch alive has to ask the same
 * question the screen does.** `fixtures.test.ts` asserted a hand-written
 * approximation of this — falls low, choking not high, no allergies, for
 * resuscitation — which is a *weaker* condition than the cell's, so it stayed
 * green while a change to the fixture stream removed the last resident who
 * actually reached the branch. A guard that asserts less than the screen
 * requires is a guard that passes while the thing it protects goes dead (§8).
 */
export function hasNoRiskFlags(resident: Resident): boolean {
  return RISK_FLAG_SOURCES.every(
    (source) =>
      !source.isUnrecorded(resident) && source.renderNotable(resident).length === 0,
  )
}

export function RiskFlagsCell({ resident }: { resident: Resident }) {
  const flags = RISK_FLAG_SOURCES.flatMap((source) =>
    source.isUnrecorded(resident)
      ? [source.renderUnrecorded()]
      : source.renderNotable(resident),
  )

  if (flags.length === 0) {
    // Not a blank. A claim: all four have been looked at, and none of them
    // needs attention today.
    //
    // Quiet, not absent. It was a green pill, which made the residents with
    // nothing wrong the most eye-catching rows in the table — reassurance
    // shouting over risk. The claim still has to be made, because a blank cell
    // here would mean either this or "nobody looked"; it just does not need to
    // be the loudest thing on the row.
    return (
      <div className={styles.flags}>
        <Settled label="All assessed, no flags" />
      </div>
    )
  }

  return <div className={styles.flags}>{flags}</div>
}
