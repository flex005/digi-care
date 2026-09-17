import { now as appNow } from '@/data/fixtures/clock'
import type { CareNote, FlagReason, IsoDateTime, ReviewOutcome } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import { reviewOutcomeText } from './review-wording'
import { assertNever } from '@/lib/assert-never'
import { SHIFT_NAMES, elapsedMinutesBetween } from '@/lib/shift'
import { MoodBadge, Settled, StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './notes.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The parts a care note is made of, shared by every arrangement of it.
 *
 * Three screens render the same facts in three shapes — the resident's
 * timeline against a rail of clock times, the cross-resident queue as aligned
 * columns, the detail screen as a single note. The *facts* must not drift
 * between them, so they are written once here and only the arrangement is
 * decided by the caller.
 */

/**
 * How long, in one unit, for a chip on a row somebody is scanning.
 *
 * The note detail states the wait to the minute because it is read there. Here
 * the reader is ranking six rows against each other, and "79 hours" ranks them
 * exactly as well as "79 hours 19 minutes" in half the width.
 */
export function coarseWait(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))
  if (whole < 60) return `${whole} ${whole === 1 ? 'minute' : 'minutes'}`

  const hours = Math.round(whole / 60)
  // Days past two of them. "167 hours" is arithmetic a reader has to do before
  // they can rank anything, and the whole point of this figure is that it can
  // be ranked at a glance. Below 48 hours the hour is the useful unit — the
  // difference between 6 and 18 matters and "0 days" does not.
  if (hours >= 48) {
    const days = Math.round(hours / 24)
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export const CATEGORY_NAMES = new Map(
  CARE_NOTE_CATEGORIES.map((category) => [category.id, category.name]),
)

/**
 * Whether anybody has looked at this note yet.
 *
 * **Flagged-and-not-reviewed is hatched, not amber.** A care worker asked for
 * a second opinion and nobody has given one: that is a gap in the record, and
 * the hatch is the treatment for gaps. Amber means recorded and needing
 * attention — a finding somebody made — which is precisely what this is not.
 *
 * It is also the same concept the handover renders as "Not reviewed", and one
 * concept gets one treatment across screens. A reader who learns the hatch
 * means "nobody has looked at this" on the handover must not have to learn a
 * second vocabulary here.
 *
 * **Reviewed is quiet.** Rule 3b: a senior looked and it was fine, which is
 * recorded and unremarkable, and a filled green pill for it competes with the
 * hatch on a screen built to surface the gaps. The full record stays — both
 * halves of it, always visible.
 *
 * **A note flagged and cleared by the same person says so.** It is legitimate
 * — somebody raised a question and answered it themselves — but it is not a
 * second opinion, and one label covering both would let it pass as one.
 *
 * Not flagged renders as nothing at all. Flagging is an action somebody takes,
 * not a record somebody owes, so an unflagged note is not a gap; hatching
 * every unflagged note would drown the handful actually waiting on a senior.
 */
export function ReviewState({ note }: { note: CareNote }) {
  switch (note.review.kind) {
    case 'not_flagged':
      return null

    case 'flagged_not_reviewed': {
      // **The wait, not the author.** The queue is sorted oldest-first because
      // the wait is the finding, and nothing on the row was showing it — a
      // reader could see the order but not the reason for it. The author has
      // room on the note detail; here it ranks nothing.
      const waiting = elapsedMinutesBetween(
        note.review.flaggedAt,
        appNow().toISOString() as IsoDateTime,
      )
      return (
        <div className={styles.reviewState}>
          <Unrecorded
            variant="chip"
            label="Flagged, not reviewed"
            detail={`waiting ${coarseWait(waiting)}`}
          />
          {/* A second fact beside the gap, never folded into it: the gap is
              that nobody has looked, the reason is what the flagger asked. */}
          <FlagReasonLine reason={note.review.reason} />
        </div>
      )
    }

    case 'reviewed': {
      // Both halves, always. "Reviewed by M. Halloran" alone reads as routine
      // sign-off; the record is that somebody asked and somebody answered, and
      // an inspector asks about the distance between the two.
      const { flaggedBy, flaggedAt, reviewedBy, reviewedAt } = note.review
      const bySamePerson = flaggedBy.id === reviewedBy.id

      // Same shape as the flagged chip: the label is the state, the second
      // line is how long it took. Both names are on the note detail, which is
      // where there is room for them and where somebody reads rather than
      // scans. The same-person case keeps its own label, because it is a
      // different claim rather than a longer one.
      return (
        <div className={styles.reviewState}>
          <Settled
            label={
              bySamePerson ? 'Flagged and reviewed by the same person' : 'Reviewed'
            }
            detail={`waited ${coarseWait(elapsedMinutesBetween(flaggedAt, reviewedAt))}`}
          />
          <FlagReasonLine reason={note.review.reason} />
          <ReviewOutcomeLine outcome={note.review.outcome} />
        </div>
      )
    }

    default:
      return assertNever(note.review)
  }
}

/**
 * Why the flagger asked, in their own words, or that they chose not to say.
 *
 * **"No reason given" is plain, never hatched.** The form asked "Why are you
 * flagging this?" and the flagger left it blank, which is an answer they gave
 * rather than a record somebody owes. Hatching it would claim a gap in a note
 * that is complete, and put a second hatch beside the one that matters, which
 * is that nobody has looked yet.
 *
 * The words are quoted and never recased: they are the flagger's, not ours.
 */
export function FlagReasonWords({ reason }: { reason: FlagReason }) {
  switch (reason.kind) {
    case 'given':
      return <q>{reason.text}</q>
    case 'not_given':
      return <>No reason given</>
    default:
      return assertNever(reason)
  }
}

/** The flag's reason, on a chip's column: its own line, never the chip's detail. */
export function FlagReasonLine({ reason }: { reason: FlagReason }) {
  return (
    <p className={styles.reviewFact} data-flag-reason>
      <span className={styles.reviewFactLabel}>Reason</span>
      <FlagReasonWords reason={reason} />
    </p>
  )
}

/** The review's outcome, on its own line beside who and when rather than inside them. */
export function ReviewOutcomeLine({ outcome }: { outcome: ReviewOutcome }) {
  return (
    <p className={styles.reviewFact} data-review-outcome>
      <span className={styles.reviewFactLabel}>Action taken</span>
      {reviewOutcomeText(outcome)}
    </p>
  )
}

/**
 * Author, timestamp, shift, category and mood.
 *
 * Always visible, never hover-only (CLAUDE.md §6) — a note whose author you
 * have to hover to find is a note nobody signed.
 *
 * `showTimestamp` is false only where something else on the row already
 * carries the full stamp, which on the profile timeline is the rail. Never
 * dropped, only relocated.
 */
export function NoteMeta({
  note,
  showTimestamp = true,
  showCategory = true,
  /**
   * False on the queue. The finding there is that the note is waiting for
   * review, and a hatched "Mood not recorded" on the same row competes with
   * the flag for the one thing the screen is asking the reader to see. A
   * missing mood is a real gap and it is stated on the note detail, where it
   * is the only claim being made.
   */
  showMood = true,
}: {
  note: CareNote
  showTimestamp?: boolean
  showCategory?: boolean
  showMood?: boolean
}) {
  const format = useSiteFormat()

  return (
    <p className={styles.noteMeta}>
      {showCategory ? (
        <span className={styles.noteCategory}>
          {CATEGORY_NAMES.get(note.category) ?? note.category}
        </span>
      ) : null}
      <span className={styles.noteAuthor}>{staffLabel(note.recordedBy)}</span>
      {showTimestamp ? (
        <span data-numeric>{format.dateTime(note.recordedAt)}</span>
      ) : null}
      <span>{SHIFT_NAMES[note.shift.value]} shift</span>
      {showMood ? <MoodBadge mood={note.mood} /> : null}
    </p>
  )
}

/**
 * What was changed about the shift, from what, and why.
 *
 * Without `clockSaid` the record would show a shift with no sign it was ever
 * moved, which is the gap the union exists to close.
 */
export function ShiftOverride({ note }: { note: CareNote }) {
  if (note.shift.kind !== 'overridden') return null

  return (
    <p className={styles.shiftOverride}>
      <span className={styles.shiftOverrideLabel}>Shift changed</span>
      The clock said {SHIFT_NAMES[note.shift.clockSaid].toLowerCase()}, recorded as{' '}
      {SHIFT_NAMES[note.shift.value].toLowerCase()}
      {': '}
      <q>{note.shift.reason}</q>
    </p>
  )
}

/**
 * Where this note sits in a correction chain, in both directions.
 *
 * PRD §6.3: a correction "marks the original as superseded while leaving it
 * visible". A superseded note read without knowing it was superseded is worse
 * than not reading it — a wrong fact with a name and a timestamp on it — and
 * a list is where somebody skims. Deleting what was wrong is how a record
 * stops being a record.
 */
export function CorrectionTags({ note }: { note: CareNote }) {
  if (note.supersededBy === 'none' && note.corrects === 'none') return null

  return (
    <div className={styles.noteTags}>
      {note.supersededBy !== 'none' ? (
        <StatusPill
          tone="info"
          label="Superseded by a correction"
          // No detail. It read identically on every superseded note, and the
          // label plus the link to the correction already say it.
          detail={undefined}
        />
      ) : null}
      {note.corrects !== 'none' ? (
        <StatusPill tone="info" label="Correction" detail={undefined} />
      ) : null}
    </div>
  )
}
