import type { ReactNode } from 'react'
import type { Recorded, RecordedList } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import styles from './profile.module.css'

/**
 * A read-only field list. Semantic `<dl>` — these are terms and their
 * definitions, and a table would claim a row/column relationship that is not
 * there.
 *
 * The rule this exists to enforce: **a field is never an empty row and never
 * an em dash.** Either it has a value, or it says in words that nobody has
 * recorded one. "—" is the single most common way a care record quietly
 * turns "nobody asked" into "nothing to report".
 */

export function FieldList({ children }: { children: ReactNode }) {
  return <dl className={styles.fieldList}>{children}</dl>
}

export function Field({
  id,
  label,
  children,
}: {
  /** Also the test hook — the guard asserts every declared field is present
   *  and non-empty by this id. */
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className={styles.field} data-field={id}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{children}</dd>
    </div>
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
  attributed,
  render,
}: {
  record: Recorded<T>
  /** Used in the hatch: "GP not recorded". */
  label: string
  attributed: boolean
  render: (value: T) => ReactNode
}) {
  const format = useSiteFormat()

  if (record.kind === 'unrecorded') {
    return <Unrecorded label={`${label} not recorded`} />
  }

  return (
    <>
      <div className={styles.value}>{render(record.value)}</div>
      {attributed ? (
        <p className={styles.attribution}>
          Recorded by{' '}
          {record.recordedBy.isActive
            ? record.recordedBy.displayName
            : `${record.recordedBy.displayName} (deactivated)`}
          , <span data-numeric>{format.instantDate(record.recordedAt)}</span>
        </p>
      ) : null}
    </>
  )
}

/**
 * A `RecordedList<T>` rendered as its three states.
 *
 * The middle one is the point. **"We asked, and there are none" is a positive
 * claim somebody made** — it looks settled, carries its author, and must never
 * wear the hatch, exactly like a recorded "No known allergies". Only
 * `not_recorded` is a gap.
 */
export function RecordedListField<T>({
  list,
  label,
  /** How the "none" case reads: "No consultants or specialists involved". */
  noneLabel,
  attributed,
  render,
}: {
  list: RecordedList<T>
  label: string
  noneLabel: string
  attributed: boolean
  render: (items: [T, ...T[]]) => ReactNode
}) {
  const format = useSiteFormat()

  if (list.kind === 'not_recorded') {
    return <Unrecorded label={`${label} not recorded`} />
  }

  const attribution = attributed ? (
    <p className={styles.attribution}>
      Recorded by{' '}
      {list.recordedBy.isActive
        ? list.recordedBy.displayName
        : `${list.recordedBy.displayName} (deactivated)`}
      , <span data-numeric>{format.instantDate(list.recordedAt)}</span>
    </p>
  ) : null

  if (list.kind === 'none_involved') {
    return (
      <>
        <StatusPill tone="positive" label={noneLabel} />
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
