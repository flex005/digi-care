import type { Resident } from '@/data/types'
import { recordCompleteness } from '@/data/completeness'
import { StatusPill, Unrecorded } from '@/components/status'
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

  if (critical.length === 0) {
    return (
      <div className={styles.gaps}>
        <StatusPill tone="positive" label="Critical records complete" />
        {standardCount > 0 ? (
          <span className={styles.standardGaps}>
            {standardCount} non-critical gap{standardCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.gaps}>
      <Unrecorded
        variant="chip"
        label="Critical records missing"
        detail={critical.map((gap) => gap.shortLabel).join(' · ')}
      />
      {standardCount > 0 ? (
        <span className={styles.standardGaps}>
          and {standardCount} non-critical gap{standardCount === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  )
}
