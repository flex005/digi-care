import type { Resident, Site } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { AllergyBadge } from '@/components/status'
import { formatDate, ageFrom } from '@/lib/format'
import styles from './notes.module.css'

/**
 * The subject header for a write surface. PRD §2.4, CLAUDE.md §2.
 *
 * > Every write surface carries a **persistent subject header**: resident
 * > photo, full name, preferred name, room, DOB. It is not collapsible, and on
 * > a write surface it is sticky and does not scroll away.
 *
 * This is the debt from unsticking the profile header, settled. The profile is
 * read-only and lost its pinned header on 21/08/2026; the rule was narrowed to
 * write surfaces rather than repealed, and this is the first write surface
 * built since. It does not inherit anything from the profile: it names the
 * subject itself, at the top of the form, above the field somebody is typing
 * into.
 *
 * It carries allergies as well as identity. A correction or a note written
 * against the wrong resident is the failure this guards; a note about
 * medication written against somebody whose allergies you cannot see while
 * writing is the one next door.
 *
 * Sticky within the dialog, so it stays above the body on a long form.
 */
export function SubjectStrip({ resident, site }: { resident: Resident; site: Site }) {
  return (
    <div className={styles.subject}>
      {/* One horizontal row: who, then where. In a 560px dialog the previous
          layout collapsed into a narrow column with every fact on its own
          line and the allergy floated beside it — five stacked lines for the
          one control on the screen that has to be readable at a glance. */}
      <div className={styles.subjectRow}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="small" />
        <div className={styles.subjectWho}>
          <p className={styles.subjectName}>{resident.preferredName}</p>
          <p className={styles.subjectLegal}>{resident.fullLegalName}</p>
        </div>
        <p className={styles.subjectFacts}>
          <span>
            {resident.room.kind === 'recorded'
              ? `Room ${resident.room.value}`
              : 'Room not recorded'}
          </span>
          <span aria-hidden>·</span>
          <span data-numeric>
            Born {formatDate(resident.dateOfBirth)} ({ageFrom(resident.dateOfBirth)})
          </span>
          <span aria-hidden>·</span>
          <span>{site.name}</span>
        </p>
      </div>
      {/* Full width beneath, not floated beside. An allergy record is the
          reason this strip carries more than a name, and it is the line
          somebody has to be able to read without hunting for it. */}
      <div className={styles.subjectAllergies}>
        <AllergyBadge status={resident.allergies} />
      </div>
    </div>
  )
}
