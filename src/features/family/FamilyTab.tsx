import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import { FamilyAccessSection } from './FamilyAccessSection'
import styles from './family.module.css'

/**
 * A resident's Family Portal access. AM v2.0 FAM-01, Phase 26.
 *
 * **Its own tab rather than a block under Consent.** A resident may have a
 * daughter, a son and a spouse, each with their own relationship, email and
 * level, and a list of people is not a footnote to a consent record.
 *
 * **The consent itself stays on the Consent tab, which owns it.** This screen
 * reads it: the basis where it stands, the refusal and a link where it does
 * not. It never records one. That is the constraint a guard holds rather than
 * a sentence: `scripts/check-family-writes.mjs` fails the build if anything
 * under this feature calls a consent writer or imports the resident store.
 */
export function FamilyTab() {
  const { resident } = useOutletContext<ResidentProfile>()
  /*
   * Bumped when somebody is named or removed. The store is this session's and
   * the section reads it on render, so a counter is what makes the list agree
   * with what somebody just did.
   */
  const [, setVersion] = useState(0)

  return (
    <div className={styles.tabPanel} data-family-panel>
      <FamilyAccessSection
        resident={resident}
        onChanged={() => setVersion((count: number) => count + 1)}
      />
    </div>
  )
}
