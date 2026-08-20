import type { Resident } from '@/data/types'
import { BADGE_STRIP_SOURCES } from './badge-strip-sources'
import styles from './profile.module.css'

/**
 * The risk badge strip. PRD §6.2 calls it "the sharpest expression of the core
 * risk in this phase", and §16.3 lists the five.
 *
 * **Every badge is always present, and every state is drawn.** That is the
 * point of difference from the residents list, which shows a narrowed set and
 * runs on the stated convention that anything not shown was recorded and is
 * unremarkable. That convention is right for a management index. It is wrong
 * here: this is the surface a care worker reads in seconds before entering a
 * room (PRD §1), and the one every write surface carries (§2.4). Nothing about
 * a person's safety is left to inference.
 *
 * The five come from `badge-strip-sources.tsx` so a badge cannot quietly go
 * missing, and they are the same components rendered on `/dev/states`, so what
 * is reviewed there is literally what renders here.
 */
export function BadgeStrip({ resident }: { resident: Resident }) {
  return (
    <ul className={styles.badgeStrip} aria-label="Risk badges">
      {BADGE_STRIP_SOURCES.map((source) => (
        <li key={source.id} className={styles.badge}>
          {source.render(resident)}
        </li>
      ))}
    </ul>
  )
}
