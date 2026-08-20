import type { DueMedication, ResidentProfile } from '@/data/access/client'
import type { CareNote } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { MoodBadge, ReviewBadge, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { formatDate, ageFrom } from '@/lib/format'
import { BadgeStrip } from './BadgeStrip'
import styles from './profile.module.css'

/**
 * The persistent subject header, as a rail down the left of the profile.
 * PRD §2.4, §6.2, §16.3.
 *
 * Sticky, not collapsible, does not scroll away — because it is the structural
 * mitigation against the second-worst failure available: a record written
 * against the wrong resident. Whoever is writing must be able to see who they
 * are writing about without scrolling, at any point on any tab.
 *
 * A column rather than a band across the top, which is a change of shape and
 * not only of taste: a header deep enough to hold a photograph, five badges
 * and two phone numbers costs a third of the viewport on every tab, so it
 * either gets shortened until it stops carrying what §2.4 asks for, or it
 * pushes the work off screen. Beside the content it does neither, and it stays
 * in view to the bottom of the longest tab rather than only to the fold.
 *
 * It carries the site for the same reason. §2.4 requires the active site to be
 * permanently visible; the app top bar scrolls away on a long profile, and
 * this does not.
 *
 * Subject identity comes from the route parameter and nothing else — never
 * navigation history, never "last viewed", never component state.
 */

function LastNoteSummary({ note }: { note: CareNote | 'none' }) {
  const format = useSiteFormat()

  if (note === 'none') {
    return (
      <Unrecorded
        variant="chip"
        label="No care note recorded"
        detail="nobody has written this resident up, not once"
      />
    )
  }

  const category = CARE_NOTE_CATEGORIES.find((entry) => entry.id === note.category)

  return (
    <div className={styles.noteSummary}>
      <p className={styles.noteBody}>{note.body}</p>
      <div className={styles.noteMeta}>
        <span>{category ? category.name : note.category}</span>
        {/* Relative time alongside the absolute timestamp, never instead of
            it, and the absolute one in the site's zone. PRD §3.6. */}
        <span data-numeric>
          {format.dateTime(note.recordedAt)} · {format.relative(note.recordedAt)}
        </span>
        <span>
          {note.recordedBy.isActive
            ? note.recordedBy.displayName
            : `${note.recordedBy.displayName} (deactivated)`}
        </span>
      </div>
      <MoodBadge mood={note.mood} />
    </div>
  )
}

function DueMedications({ due }: { due: DueMedication[] }) {
  const format = useSiteFormat()

  if (due.length === 0) {
    // A real answer, stated. An empty panel here would be indistinguishable
    // from a panel that failed to load.
    return (
      <StatusPill
        tone="positive"
        label="Nothing due in the next 2 hours"
        detail="checked against this resident's current rounds"
      />
    )
  }

  return (
    <ul className={styles.dueList}>
      {due.map(({ medication, record }) => (
        <li key={`${medication.id}-${record.roundTime}`}>
          <StatusPill
            tone="info"
            label={`${medication.name} ${medication.dose}`}
            detail={
              record.state.kind === 'due'
                ? `${format.time(record.state.windowOpensAt)}–${format.time(record.state.windowClosesAt)} · ${medication.route}${medication.isControlledDrug ? ' · controlled drug' : ''}`
                : medication.route
            }
          />
        </li>
      ))}
    </ul>
  )
}

export function ProfileHeader({ profile }: { profile: ResidentProfile }) {
  const { resident, site } = profile
  const gp = resident.gp
  const nextOfKin = resident.importantPeople.nextOfKin

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="large" />
        <div className={styles.names}>
          <h1 className={styles.preferredName}>{resident.preferredName}</h1>
          <p className={styles.legalName}>{resident.fullLegalName}</p>
          <p className={styles.identityMeta}>
            {resident.room.kind === 'recorded' ? (
              <span>Room {resident.room.value}</span>
            ) : (
              <Unrecorded label="Room not recorded" />
            )}
            <span aria-hidden="true">·</span>
            <span data-numeric>
              {formatDate(resident.dateOfBirth)} ({ageFrom(resident.dateOfBirth)})
            </span>
          </p>
          {/* Its own line rather than a third item on the meta row. The row
              wrapped in the rail and left a separator dangling at the end of
              it, and the site is not a third identity fact anyway — it is
              where all of this is true. It travels with the subject so it
              stays visible when the app top bar is out of view. §2.4. */}
          <p className={styles.site}>{site.name}</p>
        </div>
      </div>

      <BadgeStrip resident={resident} />

      <section className={styles.railContacts} aria-label="Contacts">
        <h2 className={styles.panelTitle}>Contacts</h2>
        <div className={styles.contacts}>
          {gp.kind === 'recorded' ? (
            <a className={styles.contact} href={`tel:${gp.value.contact.phone}`}>
              <Icon name="communications/call" size={16} />
              <span>
                <span className={styles.contactRole}>GP</span>
                {gp.value.name} · {gp.value.contact.phone}
              </span>
            </a>
          ) : (
            <Unrecorded label="GP not recorded" />
          )}
          {nextOfKin.kind === 'recorded' ? (
            <a className={styles.contact} href={`tel:${nextOfKin.value.contact.phone}`}>
              <Icon name="communications/call" size={16} />
              <span>
                <span className={styles.contactRole}>
                  Next of kin · {nextOfKin.value.relationship}
                </span>
                {nextOfKin.value.name} · {nextOfKin.value.contact.phone}
              </span>
            </a>
          ) : (
            <Unrecorded label="Next of kin not recorded" />
          )}
        </div>
      </section>
    </header>
  )
}

/**
 * What is happening right now, above the tabs.
 *
 * Separated from the rail because these are not identity — they are state, and
 * state changes while the subject does not. Outside the `Outlet`, so they hold
 * across every tab rather than belonging to one.
 */
export function ProfileGlance({ profile }: { profile: ResidentProfile }) {
  const { resident, latestNote, dueSoon } = profile

  return (
    <div className={styles.panels}>
      <section className={styles.panel} aria-label="Medication due in the next 2 hours">
        <h2 className={styles.panelTitle}>Medication due in the next 2 hours</h2>
        <DueMedications due={dueSoon} />
      </section>

      <section className={styles.panel} aria-label="Last care note">
        <h2 className={styles.panelTitle}>Last care note</h2>
        <LastNoteSummary note={latestNote} />
      </section>

      <section className={styles.panel} aria-label="Care plan review">
        <h2 className={styles.panelTitle}>Care plan review</h2>
        <ReviewBadge state={resident.carePlanReview} />
      </section>
    </div>
  )
}
