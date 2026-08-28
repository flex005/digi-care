import type { Resident } from '@/data/types'
import { recordCompleteness } from '@/data/completeness'
import { Settled, Unrecorded } from '@/components/status'
import styles from './residents.module.css'

/**
 * The "Critical records missing" chip. PRD §6.2.
 *
 * Named precisely. It was "Records incomplete", which overclaimed: it fires on
 * a subset but reads as all gaps, and that small inaccuracy is the kind this
 * build exists to avoid.
 *
 * It **names** the gaps rather than counting them. "4 records missing" tells a
 * manager something is wrong without telling them whether allergies is one of
 * them, which is the difference between a chip that prompts action and a chip
 * that prompts a click. Rule 4's spirit: no bare counts.
 *
 * A resident with no critical gaps gets a settled positive, not a blank — the
 * same reasoning as the risk flags column. Non-critical gaps are reported
 * quietly alongside, so nothing is hidden, just not shouted.
 */
export function CriticalGapsChip({ resident }: { resident: Resident }) {
  const { critical, missing } = recordCompleteness(resident)
  const standardCount = missing.length - critical.length
  const standardLabel = `${standardCount} non-critical gap${standardCount === 1 ? '' : 's'}`

  if (critical.length === 0) {
    return (
      <div className={styles.gaps}>
        <Settled
          label="Critical records complete"
          {...(standardCount > 0 ? { detail: standardLabel } : {})}
        />
      </div>
    )
  }

  return (
    <div className={styles.gaps}>
      <Unrecorded
        variant="chip"
        label="Critical records missing"
        // The named gaps and the count of the rest on ONE line. They were two
        // stacked lines, which made a three-line block in every row and broke
        // the vertical rhythm of the column — and scanning down this column is
        // what the screen is for. The em dash keeps the two kinds apart: what
        // is named is critical, what is counted is not.
        detail={
          standardCount > 0
            ? `${critical.map((gap) => gap.shortLabel).join(' · ')}, plus ${standardLabel}`
            : critical.map((gap) => gap.shortLabel).join(' · ')
        }
      />
    </div>
  )
}
