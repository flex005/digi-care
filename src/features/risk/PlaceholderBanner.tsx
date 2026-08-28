import { Unrecorded } from '@/components/status'
import { PLACEHOLDER_NOTICE } from './instrument'
import styles from './risk.module.css'

/**
 * On every screen in this module.
 *
 * The export stub's treatment, for the export stub's reason: **a figure that
 * does not do what it appears to must say so where it appears.** A note in a
 * release document is not where somebody reads a score.
 *
 * The hatch rather than a warning tint, because what is missing is a validated
 * instrument — an absence, not a finding.
 */
export function PlaceholderBanner() {
  return (
    <div className={styles.placeholder} data-placeholder-instrument>
      <Unrecorded
        variant="panel"
        label="This instrument is a placeholder"
        detail={PLACEHOLDER_NOTICE}
      />
    </div>
  )
}
