import type { ReactNode } from 'react'
import type { SignedEntry } from '@/data/types'
import { formatDate } from '@/lib/format'
import styles from './profile.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * A signed, dated, version-controlled entry. PRD §6.2: "Every entry
 * date-stamped, signed, version-controlled."
 *
 * All three on one line beneath the value, always visible and never
 * hover-only (CLAUDE.md §6). The version is shown even when it is 1, because a
 * number that only appears once it is interesting teaches the reader nothing
 * the first time they see it — and on this tab the interesting case is the
 * entry that has been rewritten since the family last read it.
 *
 * There is no history link. The fixtures carry a version number and not the
 * versions behind it, and a link to a list that does not exist would be worse
 * than the number alone. The document viewer is Phase 11.
 *
 * `signedBy` is a StaffRef here, unlike a DNAR's, which is a plain string —
 * a DNAR is signed by a clinician who is usually not a member of staff in this
 * system, and an advance care plan is witnessed by somebody who is.
 */
export function SignedValue<T>({
  entry,
  render,
}: {
  entry: SignedEntry<T>
  render: (value: T) => ReactNode
}) {
  const who = staffLabel(entry.signedBy)

  return (
    <>
      <div className={styles.value}>{render(entry.value)}</div>
      <p className={styles.attribution}>
        Signed by {who}, <span data-numeric>{formatDate(entry.signedOn)}</span> ·{' '}
        <span data-numeric>version {entry.version}</span>
      </p>
    </>
  )
}
