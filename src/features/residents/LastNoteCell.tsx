import type { CareNote } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import { NeverWrittenUp } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './residents.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The last care note. PRD §6.2.
 *
 * `'none'` is a real answer, and the one this column exists to surface: a
 * resident nobody has ever written up is the most neglected record in the
 * home, and rendering that as an empty cell would hide it completely.
 *
 * Relative time appears alongside the absolute timestamp, never instead of it
 * (PRD §3.6), and the absolute time is in the site's zone.
 */
export function LastNoteCell({ note }: { note: CareNote | 'none' }) {
  const format = useSiteFormat()

  if (note === 'none') {
    return <NeverWrittenUp />
  }

  const category = CARE_NOTE_CATEGORIES.find((entry) => entry.id === note.category)

  return (
    <div className={styles.lastNote}>
      <span className={styles.lastNoteWhen} data-numeric>
        {format.dateTime(note.recordedAt)}
      </span>
      <span className={styles.lastNoteMeta}>
        {category ? category.name : note.category} · {format.relative(note.recordedAt)}
      </span>
      <span className={styles.lastNoteMeta}>{staffLabel(note.recordedBy)}</span>
    </div>
  )
}
