import type { DocumentReference, FileFacts, IsoDate, StaffRef } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { formatDate, formatDuration } from '@/lib/format'
import type { ExpiryFinding } from './expiry'
import styles from './documents.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * What the file is, as text.
 *
 * **No format icon.** A PDF glyph tells a reader nothing they can act on —
 * not whether it opens, not how big it is, not whether it is the current
 * version. "PDF · 1.2 MB" says two of those, and the third is the row's job.
 */
export function FileFactsText({ file }: { file: FileFacts }) {
  if (file.kind === 'not_retrievable') {
    return (
      <span className={styles.fileFacts} data-file="not_retrievable">
        {file.format} · not retrievable
      </span>
    )
  }

  const megabytes = file.bytes / (1024 * 1024)
  const size =
    megabytes >= 1
      ? `${megabytes.toFixed(1)} MB`
      : `${Math.round(file.bytes / 1024)} KB`

  return (
    <span className={styles.fileFacts} data-file="described">
      {file.format} · {size}
    </span>
  )
}

/**
 * Who filed a document and when.
 *
 * **A filing date is a date, not an instant**, and the difference is not
 * pedantry: `filedOn` widened to midnight UTC and rendered through the site's
 * zone came out as "02/10/2025 01:00 BST" — an hour nobody recorded, on a
 * record whose whole content is a day. The clamp entry in §8 is the same
 * mistake in the other direction, and the tell is identical: say what kind of
 * instant it is before touching it.
 *
 * One owner, because two call sites appending a name to a date is how the
 * plural defects started.
 */
export function FiledBy({ staff, on }: { staff: StaffRef; on: IsoDate }) {
  const who = staffLabel(staff)
  return (
    <>
      Filed by {who}, {formatDate(on)}
    </>
  )
}

/**
 * What a document's expiry decision means today.
 *
 * Five renderings for five states, and the shapes are the argument:
 *
 * - **expired** and **expiring** are findings, and take critical and caution.
 * - **in date** is recorded and unremarkable, so it renders quietly.
 * - **does not expire** renders quietly *and names who decided it*. Without
 *   the name it would be indistinguishable from an assumption somebody made
 *   while filing.
 * - **not recorded** takes the hatch. It is not a milder expiry — it is the
 *   absence of the fact the other four are made of.
 */
export function ExpiryChip({ finding }: { finding: ExpiryFinding }) {
  switch (finding.kind) {
    case 'expired':
      return (
        <span className={styles.expiry} data-expiry="expired">
          <span className={styles.expiryLabel}>Expired {formatDate(finding.on)}</span>
          <span className={styles.expiryDetail}>
            {formatDuration(finding.daysAgo)} ago
          </span>
        </span>
      )
    case 'expiring':
      return (
        <span className={styles.expiry} data-expiry="expiring">
          <span className={styles.expiryLabel}>Expires {formatDate(finding.on)}</span>
          <span className={styles.expiryDetail}>
            in {formatDuration(finding.inDays)}
          </span>
        </span>
      )
    case 'in_date':
      return (
        <span className={styles.expiryQuiet} data-expiry="in_date">
          <span className={styles.expiryLabel}>Expires {formatDate(finding.on)}</span>
          <span className={styles.expiryDetail}>
            in {formatDuration(finding.inDays)}
          </span>
        </span>
      )
    case 'does_not_expire':
      return (
        <span className={styles.expiryQuiet} data-expiry="does_not_expire">
          <span className={styles.expiryLabel}>Does not expire</span>
          {/* Somebody said so, and their name is the difference between a
              decision and an assumption. */}
          <span className={styles.expiryDetail} data-decided-by>
            recorded by {finding.decidedBy.displayName}, {formatDate(finding.on)}
          </span>
        </span>
      )
    case 'not_recorded':
      return (
        <span data-expiry="not_recorded">
          <Unrecorded
            variant="chip"
            label="No expiry recorded"
            detail="nobody has said whether it expires"
          />
        </span>
      )
  }
}

/**
 * A document another module says exists and this library cannot produce.
 *
 * Hatched and unlinked, naming the id, the module holding it and what that
 * module says. Never a link that fails on click, and never silence.
 */
export function BrokenReference({ reference }: { reference: DocumentReference }) {
  return (
    <span data-broken-reference={reference.id}>
      <Unrecorded
        variant="chip"
        label="Referenced, not on file"
        detail={`${reference.origin} holds ${reference.id}, ${reference.detail}. Nobody has uploaded it.`}
      />
    </span>
  )
}
