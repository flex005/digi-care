import type { Site } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Button } from '@/components/primitives'
import styles from './group.module.css'

/**
 * The record you are reading belongs to another home. PRD §2.4, Phase 15.
 *
 * **It offers the switch and does not perform it.** Navigating somebody away
 * from a record they are reading is the app deciding they made a mistake, and
 * they may not have: a manager who covers both homes reads across them all
 * day.
 *
 * It exists because the screen was showing **two site names that disagreed**
 * with nothing saying which governed what — the top bar naming the selected
 * home and the profile header naming the record's own. Neither was wrong. The
 * fix is to say which governs the timestamps, not to remove one.
 */
export function CrossSiteBanner({ recordSite }: { recordSite: Site }) {
  const { activeSite, setActiveSite } = useSession()

  if (activeSite.id === recordSite.id) return null

  return (
    <div className={styles.crossSite} data-cross-site={recordSite.id}>
      <div>
        <p className={styles.crossSiteTitle}>
          You are reading a record that belongs to {recordSite.name}
        </p>
        <p className={styles.crossSiteBody}>
          You have {activeSite.name} selected. Every time on this page is in{' '}
          {recordSite.name}&rsquo;s zone,{' '}
          <b>the record&rsquo;s own home decides that</b>, not the one you have
          selected.
        </p>
      </div>
      <div className={styles.crossSiteAction}>
        <Button
          variant="secondary"
          data-switch-site={recordSite.id}
          onClick={() => setActiveSite(recordSite)}
        >
          Switch to {recordSite.name}
        </Button>
      </div>
    </div>
  )
}
