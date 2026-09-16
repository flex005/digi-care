import type { ImportantPerson, ImportantPeople } from '@/data/types'
import { Unrecorded } from '@/components/status'
import styles from './profile.module.css'

/**
 * Who this home rings first — a full-width panel at the top of the tab, not a
 * property hidden on one of seven person blocks.
 *
 * The primary contact is a single role that exactly one person holds, and it
 * is spread across the categories rather than stored once: any recorded person
 * can carry `isPrimaryContact`. Reading it off the blocks means scanning seven
 * of them and hoping you did not miss the marker, which is not a way to find
 * out who to ring when somebody has fallen.
 *
 * Three states, because there are three things that can be true and a blank
 * could mean any of them:
 *
 *   Helen Whitcombe, wife         recorded, settled
 *   No primary contact recorded   a gap — nobody has said who to ring first
 *   Two primary contacts          a contradiction, and never quietly resolved
 *
 * The third cannot happen in the fixtures. It renders anyway, in critical,
 * because picking one of two silently is exactly how the wrong family member
 * finds out. The screen must not resolve a contradiction the record contains.
 */

interface Held {
  person: ImportantPerson
  /** Where the flag was found, so the panel can say where to change it. */
  category: string
}

/** Exported so a test can find a resident with none, rather than naming one. */
export function primaryContactsIn(people: ImportantPeople): Held[] {
  const held: Held[] = []

  const consider = (person: ImportantPerson, category: string) => {
    if (person.isPrimaryContact) held.push({ person, category })
  }

  if (people.nextOfKin.kind === 'recorded') {
    consider(people.nextOfKin.value, 'Next of kin')
  }
  if (people.emergencyContact.kind === 'recorded') {
    consider(people.emergencyContact.value, 'Emergency contact')
  }
  if (people.lpaHolder.kind === 'recorded') {
    consider(people.lpaHolder.value, 'Lasting power of attorney')
  }
  if (people.advocate.kind === 'recorded') {
    consider(people.advocate.value, 'Advocate')
  }
  if (people.familyWithVisitingRights.kind === 'recorded') {
    for (const person of people.familyWithVisitingRights.items) {
      consider(person, 'Family with visiting rights')
    }
  }

  return held
}

export function PrimaryContactPanel({
  people,
  residentName,
}: {
  people: ImportantPeople
  residentName: string
}) {
  const held = primaryContactsIn(people)

  if (held.length === 0) {
    return (
      <div className={styles.bannerSlot} data-primary-contact="none">
        <Unrecorded
          variant="panel"
          caption="Primary contact"
          label="Not recorded"
          detail={`Nobody has been named as the person this home rings first about ${residentName}.`}
        />
      </div>
    )
  }

  if (held.length > 1) {
    return (
      <div className={styles.bannerSlot} data-primary-contact="conflict">
        <div className={`${styles.banner} ${styles.bannerCritical}`}>
          <p className={styles.bannerCaption}>Primary contact</p>
          <p className={styles.bannerHeadline}>More than one recorded</p>
          <p className={styles.bannerDetail}>
            {held
              .map((entry) => `${entry.person.name} (${entry.category})`)
              .join(' and ')}{' '}
            are both marked as the primary contact for {residentName}. Only one person
            can be.
          </p>
        </div>
      </div>
    )
  }

  const [only] = held as [Held]

  return (
    <div className={styles.bannerSlot} data-primary-contact="recorded">
      <div className={`${styles.banner} ${styles.bannerInfo}`}>
        <p className={styles.bannerCaption}>Primary contact</p>
        <p className={styles.bannerHeadline}>{only.person.name}</p>
        <p className={styles.bannerDetail}>
          {only.person.relationship} · {only.category}. This is the person the home
          rings first about {residentName}.
        </p>
      </div>
    </div>
  )
}
