import type { ReactNode } from 'react'
import type { IsoDateTime, Recorded, RecordedList, StaffRef } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './profile.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * A read-only field list. Semantic `<dl>` — these are terms and their
 * definitions, and a table would claim a row/column relationship that is not
 * there.
 *
 * The rule this exists to enforce: **a field is never an empty row and never
 * an em dash.** Either it has a value, or it says in words that nobody has
 * recorded one. "—" is the single most common way a care record quietly
 * turns "nobody asked" into "nothing to report".
 *
 * Layout is label-left, value-right, one field per row, hairline between —
 * so the eye can run down the labels and the answers line up against a common
 * left edge. A field whose value is a paragraph rather than a phrase takes
 * `width="full"` and puts its label above instead: squeezing four sentences of
 * medical history into a column sized for "she / her" is how a reader stops
 * reading it.
 */

export type FieldWidth = 'standard' | 'full'

export function FieldList({ children }: { children: ReactNode }) {
  return <dl className={styles.fieldList}>{children}</dl>
}

export function Field({
  id,
  label,
  width = 'standard',
  children,
}: {
  /** Also the test hook — the guard asserts every declared field is present
   *  and non-empty by this id. */
  id: string
  label: string
  /** `full` gives a long value the whole row and puts the label above it. */
  width?: FieldWidth
  children: ReactNode
}) {
  return (
    <div
      className={[styles.field, width === 'full' ? styles.fieldFull : '']
        .filter(Boolean)
        .join(' ')}
      data-field={id}
      data-width={width}
    >
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{children}</dd>
    </div>
  )
}

/**
 * A gap in a field, in the right shape for how much it has to say.
 *
 * A one-line gap is a badge — "Religion not recorded" is the whole statement
 * and a pill holds it. A gap that also names what it costs is a chip, which
 * stacks the detail under the label instead of running it along the same line;
 * a pill three-quarters of a row wide stops reading as a pill and starts
 * reading as a paragraph somebody drew a border round.
 *
 * Both are the same hatch from the same component. Only the geometry differs,
 * and it differs because the content does.
 */
function MissingValue({ label, detail }: { label: string; detail?: string }) {
  return detail === undefined ? (
    <Unrecorded label={label} />
  ) : (
    <Unrecorded variant="chip" label={label} detail={detail} />
  )
}

/**
 * The author and date of a clinical record. Always visible, never hover-only
 * (CLAUDE.md §6), and rendered in the site's timezone rather than the
 * viewer's (PRD §3.6).
 *
 * One component rather than the same four lines in each caller, because a
 * deactivated author must never quietly render as an active one and that is a
 * single conditional worth having in a single place.
 */
export function Attribution({ by, at }: { by: StaffRef; at: IsoDateTime }) {
  const format = useSiteFormat()

  return (
    <p className={styles.attribution}>
      Recorded by {staffLabel(by)}, <span data-numeric>{format.instantDate(at)}</span>
    </p>
  )
}

/**
 * The common case: a `Recorded<T>` rendered as its value, or as the hatch
 * saying what is missing.
 *
 * `attributed` decides whether the author and timestamp are shown.
 * CLAUDE.md §6 requires them on every clinical record, and they are shown on
 * every clinical and compliance field here. They are *not* shown on
 * person-centred fields — religion, cultural background, language — because
 * sixteen attribution lines would bury the values they annotate, and volume
 * that drowns a distinction is the same failure as a blank cell.
 *
 * Dietary requirements is attributed despite reading like a preference:
 * texture-modified and allergy-adjacent needs are clinical instructions that
 * reach a plate, and a field mixing "no pork" with "IDDSI level 4" needs a
 * source.
 */
export function RecordedValueField<T>({
  record,
  label,
  missingDetail,
  attributed,
  render,
}: {
  record: Recorded<T>
  /** Used in the hatch: "GP not recorded". */
  label: string
  /**
   * What the gap costs, in a sentence, beneath the hatch — "Nobody is
   * recorded to ring if this person is taken ill."
   *
   * Optional because most fields do not need it: "Religion not recorded"
   * already says everything there is to say. It earns its place where the
   * consequence of the gap is not obvious from the field's name, which on
   * Important People and Future Plans is most of them.
   */
  missingDetail?: string
  attributed: boolean
  render: (value: T) => ReactNode
}) {
  if (record.kind === 'unrecorded') {
    return <MissingValue label={`${label} not recorded`} detail={missingDetail} />
  }

  return (
    <>
      <div className={styles.value}>{render(record.value)}</div>
      {attributed ? (
        <Attribution by={record.recordedBy} at={record.recordedAt} />
      ) : null}
    </>
  )
}

/**
 * A `RecordedList<T>` rendered as its three states — the three answer types
 * this tab has to keep visibly apart:
 *
 *   Dr H. Whitfield · Old Age Psychiatry     a recorded value
 *   NO CONSULTANTS INVOLVED · T. Akinyemi    a recorded NEGATIVE, info blue
 *   CONSULTANTS NOT RECORDED                 a gap, hatched
 *
 * The middle one is the point. **"We asked, and there are none" is a positive
 * claim somebody made** — it looks settled and carries its author, exactly
 * like a recorded "No known allergies", and must never wear the hatch. Only
 * `not_recorded` is a gap.
 *
 * It reads in `--status-info` rather than green because it is not good news,
 * it is neutral news somebody went and got: nobody is worse off for having no
 * consultants, and nobody is better off either. Green is reserved for
 * "recorded, complete, and fine", which is the claim a recorded "No known
 * allergies" genuinely makes and this one does not.
 */
export function RecordedListField<T>({
  list,
  label,
  /** How the "none" case reads: "No consultants or specialists involved". */
  noneLabel,
  missingDetail,
  attributed,
  render,
}: {
  list: RecordedList<T>
  label: string
  noneLabel: string
  /** What the gap costs, in a sentence. See RecordedValueField. */
  missingDetail?: string
  attributed: boolean
  render: (items: [T, ...T[]]) => ReactNode
}) {
  if (list.kind === 'not_recorded') {
    return <MissingValue label={`${label} not recorded`} detail={missingDetail} />
  }

  const attribution = attributed ? (
    <Attribution by={list.recordedBy} at={list.recordedAt} />
  ) : null

  if (list.kind === 'none_involved') {
    return (
      <>
        <StatusPill tone="info" label={noneLabel} />
        {attribution}
      </>
    )
  }

  return (
    <>
      <div className={styles.value}>{render(list.items)}</div>
      {attribution}
    </>
  )
}

/** A plain fact that cannot be absent — a legal name, a date of birth. */
export function PlainValue({ children }: { children: ReactNode }) {
  return <div className={styles.value}>{children}</div>
}
