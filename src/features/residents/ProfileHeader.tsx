import type { DueMedication, ResidentProfile } from '@/data/access/client'
import type { CareNote } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { MoodBadge, ReviewBadge, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { formatDate, ageFrom } from '@/lib/format'
import { telHref } from '@/lib/phone'
import { BadgeStrip } from './BadgeStrip'
import styles from './profile.module.css'

/**
 * The persistent subject header. PRD §2.4, §6.2, §16.3.
 *
 * Sticky, not collapsible, does not scroll away — because it is the structural
 * mitigation against the second-worst failure available: a record written
 * against the wrong resident. Whoever is writing must be able to see who they
 * are writing about without scrolling, at any point on any tab.
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
  const { resident, site, latestNote, dueSoon } = profile
  const gp = resident.gp
  const nextOfKin = resident.importantPeople.nextOfKin

  return (
    <header className={styles.header}>
      {/* Three columns: who this is · what to know before the room · what is
          happening. They read left to right in the order somebody approaching
          this resident needs them, and each is a self-contained block rather
          than a band that has to be scanned across. */}
      <div className={styles.identity}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="xlarge" />
        <div className={styles.names}>
          <h1 className={styles.preferredName}>{resident.preferredName}</h1>
          <p className={styles.legalName}>{resident.fullLegalName}</p>
        </div>
        {/* Room, date of birth and site as labelled rows rather than a
            middot-separated line. They are the facts §2.4 asks a care worker to
            check against the person in front of them, and a run-on line is
            read once; a labelled row is read in a glance. */}
        <dl className={styles.identityFacts}>
          <div className={styles.identityFact}>
            <dt>Room</dt>
            <dd>
              {resident.room.kind === 'recorded' ? (
                resident.room.value
              ) : (
                <Unrecorded label="Room not recorded" />
              )}
            </dd>
          </div>
          <div className={styles.identityFact}>
            <dt>Date of birth</dt>
            <dd data-numeric>
              {formatDate(resident.dateOfBirth)} ({ageFrom(resident.dateOfBirth)})
            </dd>
          </div>
          <div className={styles.identityFact}>
            <dt>Site</dt>
            {/* The site travels with the subject, so it stays visible when the
                app top bar has scrolled away. §2.4. */}
            <dd className={styles.site}>{site.name}</dd>
          </div>
        </dl>
      </div>

      <section className={styles.risks} aria-label="Risk flags">
        <h2 className={styles.panelTitle}>Risk flags</h2>
        <BadgeStrip resident={resident} />
      </section>

      <div className={styles.panels}>
        <section
          className={styles.panel}
          aria-label="Medication due in the next 2 hours"
        >
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

        <section className={styles.panel} aria-label="Contacts">
          <h2 className={styles.panelTitle}>Contacts</h2>
          <div className={styles.contacts}>
            {gp.kind === 'recorded' ? (
              <a className={styles.contact} href={telHref(gp.value.contact.phone)}>
                <Icon name="communications/call" size={16} />
                <span>
                  {/* The space is load-bearing. `.contactRole` is display:
                      block, which separates these on screen but leaves no text
                      node between them — so the link's accessible name read
                      "GPDr O. Balogun". A block boundary is not a word
                      boundary. */}
                  <span className={styles.contactRole}>GP</span> {gp.value.name} ·{' '}
                  {gp.value.contact.phone}
                </span>
              </a>
            ) : (
              <Unrecorded label="GP not recorded" />
            )}
            {nextOfKin.kind === 'recorded' ? (
              <a
                className={styles.contact}
                href={telHref(nextOfKin.value.contact.phone)}
              >
                <Icon name="communications/call" size={16} />
                <span>
                  <span className={styles.contactRole}>
                    Next of kin · {nextOfKin.value.relationship}
                  </span>{' '}
                  {nextOfKin.value.name} · {nextOfKin.value.contact.phone}
                </span>
              </a>
            ) : (
              <Unrecorded label="Next of kin not recorded" />
            )}
          </div>
        </section>
      </div>
    </header>
  )
}
