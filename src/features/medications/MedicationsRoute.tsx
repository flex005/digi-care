import { Outlet } from 'react-router-dom'
import { ScreenTabs, type ScreenTab } from '@/components/shell/ScreenTabs'
import styles from './medications.module.css'

/**
 * The Medications module. PRD §6.4.
 *
 * A layout route rather than two unrelated screens, so the title and the strip
 * stay mounted while the screens change — and so there is one declaration of
 * what this module contains, which `reachability.test.ts` checks the router
 * against in both directions.
 *
 * The two screens ask opposite questions of the same records. **Omissions is
 * the record of what was missed; the round is the act of recording.** They are
 * one module because a home working through a round is the same home that will
 * read the omissions afterwards, and moving between them should not mean going
 * back out to the sidebar.
 */
export const MEDICATION_TABS: ScreenTab[] = [
  { label: 'Omissions', path: '.', end: true },
  { label: 'Round', path: 'round' },
  { label: 'Controlled drug register', path: 'register' },
  // The intake path. Two screens, because a cycle from the pharmacy and a
  // single prescription that arrived between cycles are different acts.
  { label: 'Pharmacy cycle', path: 'cycle' },
  { label: 'Add interim', path: 'interim' },
]

export function MedicationsRoute() {
  return (
    <div className={styles.module}>
      <h1 className={styles.pageTitle}>Medications</h1>
      <ScreenTabs label="Medications" tabs={MEDICATION_TABS} />
      <Outlet />
    </div>
  )
}
