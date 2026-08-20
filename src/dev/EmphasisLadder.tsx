import { Settled, StatusPill, Unrecorded } from '@/components/status'
import styles from './dev.module.css'

/**
 * The three weights, at production size, on one row each.
 *
 * Rule 3's panel below asks whether a record and a hole look different. This
 * one asks a question that panel cannot: **do the three weights rank in the
 * right order?**
 *
 * The residents list had them ranked backwards. A completed, in-date care plan
 * review — the least actionable fact on the screen — was a solid green pill,
 * while "falls risk not assessed" was a quiet grey outline. Every row shouted
 * its reassurance and murmured its gaps, on the one screen whose entire job is
 * finding neglect.
 *
 * Read down each column and the order should be obvious without reading the
 * words: the gap pulls hardest, the finding next, the settled fact last. Turn
 * on greyscale and the order must not change — if it does, the ranking is
 * being carried by hue, and hue is the one thing a reader may not have.
 */
export function EmphasisLadder() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Three weights, in order of demand</h2>
      <p className={styles.sectionNote}>
        Quiet is not hidden. Every row below states its fact in full, with author and
        timestamp where there is one — the difference is how hard each one pulls.
        Nothing that is missing is ever quiet: the hatch is the loudest thing here and
        stays that way.
      </p>

      <div className={styles.compare}>
        <div className={styles.compareCell}>
          <span className={styles.compareLabel}>1 — nobody has looked · loudest</span>
          <div className={styles.row}>
            <Unrecorded label="Falls risk — not assessed" />
          </div>
          <div className={styles.row}>
            <Unrecorded label="Never scheduled" />
          </div>
        </div>

        <div className={styles.compareCell}>
          <span className={styles.compareLabel}>2 — recorded, needs action</span>
          <div className={styles.row}>
            <StatusPill tone="critical" label="Falls — HIGH" />
          </div>
          <div className={styles.row}>
            <StatusPill
              tone="critical"
              label="Overdue"
              detail="due 06/06/2026 · 75 days overdue"
            />
          </div>
        </div>

        <div className={styles.compareCell}>
          <span className={styles.compareLabel}>
            3 — recorded, nothing to do · quietest
          </span>
          <div className={styles.row}>
            <Settled label="All assessed — no flags" />
          </div>
          <div className={styles.row}>
            <Settled
              label="Reviewed 01/08/2026"
              detail="next 07/02/2027 · M. Halloran"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
