import { Outlet, useOutletContext } from 'react-router-dom'
import type { ResidentProfile } from '@/data/access/client'
import { ScreenTabs, type ScreenTab } from '@/components/shell/ScreenTabs'
import styles from './medications.module.css'

/**
 * The resident's Medications tab, and the two things it holds. PRD §6.4.
 *
 * **The chart is what was recorded; prescriptions are what was prescribed.**
 * Two readings of the same drugs, and the distinction is the reason they are
 * separate screens rather than one long one: a chart answers "was it given",
 * a prescription answers "what does giving it require", and a screen trying to
 * do both makes somebody scroll past a month of cells to find out whether a
 * second signature is needed.
 *
 * A layout route, so the profile's subject header stays mounted across both
 * (§2.4) and there is one declaration of what this tab contains for
 * `reachability.test.ts` to check the router against in both directions.
 *
 * **The underline strip, not the pill.** The reference specified pills with
 * the omissions filter's exact measurements, which would have made one shape
 * mean two things: navigation here, filtering on `/medications`. They never
 * appear on the same screen, and that is a weaker guarantee than it sounds —
 * a reader learns the shape, not the screen it was on. Pill means filter and
 * underline means navigation, which is what the profile's own tab strip and
 * the Medications module already say.
 */
export const MEDICATION_SUBTABS: ScreenTab[] = [
  { label: 'Chart', path: '.', end: true },
  { label: 'Prescriptions', path: 'prescriptions', end: false },
]

export function MedicationsTab() {
  // Passed straight through: the tabs below need the resident, and taking it
  // from the route rather than from here would be a second source of identity
  // on a screen where there must only ever be one (§2.4).
  const profile = useOutletContext<ResidentProfile>()

  return (
    <div className={styles.subTabPanel}>
      <ScreenTabs label="Medications" tabs={MEDICATION_SUBTABS} />
      <Outlet context={profile} />
    </div>
  )
}
