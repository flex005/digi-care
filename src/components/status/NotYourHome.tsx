import type { AsyncResource } from '@/data/access/resource'
import styles from './NotYourHome.module.css'

/**
 * A record in a home this viewer is not appointed to. Phase 29.
 *
 * **It names both homes, and it is not a finding.** Nothing is missing and
 * nothing failed: the record exists, it loaded, and the reader is not
 * appointed to the home it belongs to. So it takes neither the hatch, which
 * says nobody has looked, nor the caution treatment, which says something is
 * wrong. It says what is true and stops.
 */
export function NotYourHome({
  refusal,
}: {
  refusal: Extract<AsyncResource<unknown>, { kind: 'refused' }>
}) {
  return (
    <div className={styles.panel} data-not-your-home={refusal.home}>
      <p className={styles.title}>This record belongs to {refusal.home}</p>
      <p className={styles.body}>
        {refusal.what} is held there. You are appointed to{' '}
        {refusal.yours.length > 0
          ? refusal.yours.join(' and ')
          : 'no home on this record'}
        .
      </p>
      <p className={styles.body}>
        {refusal.yours.length > 0
          ? 'Which homes you are appointed to is on your staff record, and an admin changes it on the team screen.'
          : 'Nobody has recorded which home you work in.'}
      </p>
    </div>
  )
}
