import type { DueMedication, ResidentProfile } from '@/data/access/client'
import type { CareNote } from '@/data/types'
import { CARE_NOTE_CATEGORIES, MOOD_LABELS } from '@/data/types'
import { Avatar } from '@/components/primitives'
import {
  NeverWrittenUp,
  ReviewBadge,
  StatusPill,
  Unrecorded,
} from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { formatDate, ageFrom, pluralise } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import { telHref } from '@/lib/phone'
import { BadgeStrip } from './BadgeStrip'
import styles from './profile.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The subject header. PRD §2.4, §6.2, §16.3.
 *
 * Present on every tab, not collapsible, and **not sticky**. See the note on
 * `.header` in profile.module.css for why §2.4 was amended rather than
 * contradicted: the rule binds write surfaces, this screen has none, and 410px
 * of permanently pinned header is a poor trade against four tabs of dense
 * record. Phase 2's note composer is a write surface and needs its own.
 *
 * It stays mounted across the tabs because they are children of a layout
 * route, which is a different property from staying on screen while you
 * scroll, and the one §6.2 asks for.
 *
 * Subject identity comes from the route parameter and nothing else: never
 * navigation history, never "last viewed", never component state.
 */

function LastNoteSummary({ note }: { note: CareNote | 'none' }) {
  const format = useSiteFormat()

  if (note === 'none') {
    return <NeverWrittenUp variant="chip" />
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
        <span>{staffLabel(note.recordedBy)}</span>
        {/* Mood as a word in the meta line rather than a green pill. It is a
            recorded observation, not a finding to act on, and a filled pill
            made it the loudest thing in the band.

            `MoodBadge` reaches the same conclusion for the care note surfaces
            and is quiet there too, so this is no longer the exception it was
            written as. The two still differ in one way: this one tints the
            word by score and MoodBadge does not. The word carries the meaning
            in both, so the tint is reinforcement rather than the sole carrier
            — but it is one concept in two treatments, and worth collapsing to
            one the next time either is touched.

            An unrecorded mood keeps the hatch. A care worker who did not
            record how someone seemed has not recorded that they seemed fine,
            and that does not become truer for being in a smaller slot. */}
        {note.mood.kind === 'recorded' ? (
          <span className={styles.mood} data-tone={MOOD_TONE(note.mood.score)}>
            mood {MOOD_LABELS[note.mood.score].toLowerCase()}
          </span>
        ) : (
          <Unrecorded label="Mood not recorded" />
        )}
      </div>
    </div>
  )
}

function DueMedications({ due }: { due: DueMedication[] }) {
  const format = useSiteFormat()

  if (due.length === 0) {
    // A real answer, stated — an empty space here would be indistinguishable
    // from a panel that failed to load. But stated QUIETLY: this was a
    // full-width green bar, the loudest thing in the header, announcing that
    // there was nothing to do. Same correction as the residents list.
    return (
      <>
        <p className={styles.factAnswer}>Nothing due</p>
        <p className={styles.factQuiet}>
          Checked against this resident's current rounds
        </p>
      </>
    )
  }

  // Colour returns when there is something to act on.
  return (
    <>
      <p className={styles.factAnswer}>
        {due.length} due{' '}
        {due[0] && due[0].record.state.kind === 'due'
          ? `at ${format.time(due[0].record.state.windowOpensAt)}`
          : ''}
      </p>
      <ul className={styles.dueList}>
        {due.map(({ medication, record }) => (
          <li key={`${medication.id}-${record.roundTime}`}>
            <StatusPill
              tone="info"
              label={`${medication.name} ${medication.dose}`}
              detail={
                record.state.kind === 'due'
                  ? `${format.time(record.state.windowOpensAt)} to ${format.time(record.state.windowClosesAt)} · ${medication.route}${medication.isControlledDrug ? ' · controlled drug' : ''}`
                  : medication.route
              }
            />
          </li>
        ))}
      </ul>
    </>
  )
}

export function ProfileHeader({ profile }: { profile: ResidentProfile }) {
  const { resident, site, latestNote, dueSoon } = profile
  const gp = resident.gp
  const nextOfKin = resident.importantPeople.nextOfKin

  return (
    <header className={styles.header}>
      {/*
        One surface, three bands — not three floating cards.

        The cards were visually equal and unrelated, so the eye had nowhere to
        start. Bands are ordered by when somebody needs them: who this is and
        who to call, then what to know before entering the room, then the
        routine facts. Hairlines between, no borders around.
      */}
      <div className={styles.band}>
        <div className={styles.identity}>
          <Avatar photo={resident.photo} name={resident.fullLegalName} size="large" />
          <div className={styles.who}>
            <h1 className={styles.preferredName}>{resident.preferredName}</h1>
            {/* Kept here, unlike the list: this is where identity is
                confirmed before somebody writes against the record. §2.4. */}
            <p className={styles.legalName}>{resident.fullLegalName}</p>
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
                <dt>Born</dt>
                <dd data-numeric>
                  {formatDate(resident.dateOfBirth)} ({ageFrom(resident.dateOfBirth)})
                </dd>
              </div>
              <div className={styles.identityFact}>
                <dt>Site</dt>
                {/* Travels with the subject, so it stays visible when the app
                    top bar has scrolled away. §2.4. */}
                <dd>{site.name}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.contacts}>
            {gp.kind === 'recorded' ? (
              <a className={styles.contact} href={telHref(gp.value.contact.phone)}>
                <span className={styles.contactIcon} aria-hidden="true">
                  <Icon name="communications/call" size={16} />
                </span>
                <span className={styles.contactText}>
                  {/* The space is load-bearing: .contactRole is display block,
                      which separates these on screen but leaves no text node
                      between them, so the accessible name read "GPDr O.
                      Balogun". A block boundary is not a word boundary. */}
                  <span className={styles.contactRole}>GP</span>{' '}
                  <span className={styles.contactValue}>
                    {gp.value.name} <small>· {gp.value.contact.phone}</small>
                  </span>
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
                <span className={styles.contactIcon} aria-hidden="true">
                  <Icon name="communications/call" size={16} />
                </span>
                <span className={styles.contactText}>
                  <span className={styles.contactRole}>
                    Next of kin · {nextOfKin.value.relationship}
                  </span>{' '}
                  <span className={styles.contactValue}>
                    {nextOfKin.value.name}{' '}
                    <small>· {nextOfKin.value.contact.phone}</small>
                  </span>
                </span>
              </a>
            ) : (
              <Unrecorded label="Next of kin not recorded" />
            )}
          </div>
        </div>
      </div>

      <div className={styles.band}>
        <p className={styles.eyebrow}>
          Risk flags <span>all five statuses, always shown</span>
        </p>
        <BadgeStrip resident={resident} />
      </div>

      <div className={[styles.band, styles.routine].join(' ')}>
        <section
          className={styles.panel}
          aria-label={`Medication due in the next ${pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}`}
        >
          <h2 className={styles.panelTitle}>
            Medication due · next {pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}
          </h2>
          <DueMedications due={dueSoon} />
        </section>

        <section className={styles.panel} aria-label="Last care note">
          <h2 className={styles.panelTitle}>Last care note</h2>
          <LastNoteSummary note={latestNote} />
        </section>

        <section className={styles.panel} aria-label="Care plan review">
          <h2 className={styles.panelTitle}>Care plan review</h2>
          {/* compact: completed-and-in-date and scheduled-not-yet-due render
              as plain text; due, overdue and never-scheduled keep their
              treatments. The same emphasis the residents list uses, for the
              same reason — a green "Completed" bar was the loudest thing on a
              header whose job is surfacing what needs doing. */}
          <ReviewBadge state={resident.carePlanReview} emphasis="compact" />
        </section>
      </div>
    </header>
  )
}

/** Same thresholds MoodBadge uses, so the two cannot disagree about a score. */
function MOOD_TONE(score: 1 | 2 | 3 | 4 | 5): 'caution' | 'info' | 'positive' {
  return score <= 2 ? 'caution' : score === 3 ? 'info' : 'positive'
}
