import { useState } from 'react'
import type {
  CareNoteCategoryId,
  MoodScore,
  NoteShift,
  Resident,
  Shift,
  Site,
} from '@/data/types'
import { CARE_NOTE_CATEGORIES, MOOD_LABELS } from '@/data/types'
import { SHIFTS, SHIFT_NAMES } from '@/lib/shift'
import { Button, RadioGroup, Select } from '@/components/primitives'
import { SubjectStrip } from './SubjectStrip'
import { SUGGESTED_PHRASES } from './suggested-phrases'
import styles from './notes.module.css'

/**
 * The fields a care note is written with. Shared by the composer and the
 * correction dialog, because they write the same record and a correction that
 * captured less than the note it corrects would be a downgrade dressed as a
 * fix.
 *
 * Three things this form will not do:
 *
 *  1. **Pre-answer anything.** Mood opens on nothing chosen and "Not recorded"
 *     is an option somebody picks, not a default that happens. A form that
 *     starts with a mood selected records a mood nobody observed.
 *  2. **Let the author or the timestamp be typed.** Both come from the session
 *     and the clock. A field for either would be a forgery surface.
 *  3. **Accept a changed shift without a reason.** PRD §6.3 says "editable
 *     with reason", and the submit stays disabled until there is one.
 */

export interface NoteDraft {
  category: CareNoteCategoryId
  body: string
  mood: MoodScore | 'not_recorded'
  shift: NoteShift
  flagForReview: boolean
}

export function NoteForm({
  resident,
  site,
  clockShift,
  initialCategory,
  bodyLabel,
  submitLabel,
  error,
  showSuggestions = true,
  onCancel,
  onSubmit,
}: {
  resident: Resident
  site: Site
  /** What the clock says right now, in the site's zone. */
  clockShift: Shift
  initialCategory: CareNoteCategoryId
  bodyLabel: string
  submitLabel: string
  error: string
  /**
   * False on the correction dialog. The openers exist for the blank-page
   * problem — a care worker at the end of a shift with an empty box — and a
   * correction does not have one: somebody writing it already knows exactly
   * what was wrong and is there to say so.
   */
  showSuggestions?: boolean
  onCancel: () => void
  onSubmit: (draft: NoteDraft) => void
}) {
  const [category, setCategory] = useState<CareNoteCategoryId>(initialCategory)
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<MoodScore | 'not_recorded' | undefined>(undefined)
  const [shiftValue, setShiftValue] = useState<Shift>(clockShift)
  const [reason, setReason] = useState('')
  const [flag, setFlag] = useState(false)

  const overridden = shiftValue !== clockShift
  const ready =
    body.trim().length > 0 &&
    mood !== undefined &&
    (!overridden || reason.trim().length > 0)

  const submit = () =>
    onSubmit({
      category,
      body: body.trim(),
      mood: mood ?? 'not_recorded',
      shift: overridden
        ? {
            kind: 'overridden',
            value: shiftValue,
            clockSaid: clockShift,
            reason: reason.trim(),
          }
        : { kind: 'auto', value: clockShift },
      flagForReview: flag,
    })

  return (
    <div className={styles.composer}>
      <SubjectStrip resident={resident} site={site} />

      {/* A visible label, not only an accessible one. The control had an
          aria-label and nothing on screen, so the first field on the form was
          a dropdown a sighted reader had to open to identify. Every other
          field here is labelled; this one was the exception. */}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Category</span>
        <Select
          label="Category"
          placeholder="Choose a category"
          value={category}
          onValueChange={(value) => setCategory(value as CareNoteCategoryId)}
          options={CARE_NOTE_CATEGORIES.map((entry) => ({
            value: entry.id,
            label: entry.name,
          }))}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{bodyLabel}</span>
        {/* Openers, never finished sentences, and never a judgement — a
            button that writes "no concerns" records something nobody
            observed. See suggested-phrases.ts for the whole rule. */}
        {showSuggestions ? (
          <div className={styles.phrases}>
            {SUGGESTED_PHRASES[category].map((phrase) => (
              <button
                key={phrase}
                type="button"
                className={styles.phrase}
                onClick={() => setBody((current) => `${current}${phrase}`)}
              >
                {phrase.trim()}…
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          className={styles.textarea}
          rows={5}
          aria-label={bodyLabel}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Shift</span>
        <p className={styles.fieldHint}>
          Taken from the clock: <strong>{SHIFT_NAMES[clockShift]}</strong>. Change it
          only if this is being written up on a different shift from the one it happened
          on, and say why.
        </p>
        <Select
          label="Shift this is recorded on"
          placeholder="Shift"
          value={shiftValue}
          onValueChange={(value) => setShiftValue(value as Shift)}
          options={SHIFTS.map((shift) => ({
            value: shift.id,
            label:
              shift.id === clockShift
                ? `${shift.name} shift (what the clock says)`
                : `${shift.name} shift`,
          }))}
        />
        {overridden ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Why is this not the {SHIFT_NAMES[clockShift].toLowerCase()} shift?
            </span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      {/* Always a word, never a face alone (PRD §6.3). No default: "Not
          recorded" is chosen, never fallen into. */}
      <RadioGroup
        legend="How did they seem?"
        value={mood === undefined ? undefined : String(mood)}
        onValueChange={(value) =>
          setMood(
            value === 'not_recorded' ? 'not_recorded' : (Number(value) as MoodScore),
          )
        }
        options={[
          ...([1, 2, 3, 4, 5] as MoodScore[]).map((score) => ({
            value: String(score),
            label: MOOD_LABELS[score],
          })),
          { value: 'not_recorded', label: 'Not recorded' },
        ]}
      />

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={flag}
          onChange={(event) => setFlag(event.target.checked)}
        />
        <span>Flag for a senior to review</span>
      </label>

      {error === '' ? null : <p className={styles.formError}>{error}</p>}

      <div className={styles.composerActions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="large" disabled={!ready} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
