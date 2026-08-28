import { Icon } from '@/components/icon/Icon'
import styles from './notes.module.css'

/**
 * What a filter does to the claims on the screen. Rule 3c, made visible.
 *
 * > A claim made over a filtered set carries the filter, or it is false.
 * > Absence within a filter is not absence.
 *
 * The banner exists because Rule 3c is otherwise invisible: the product
 * quietly declines to make a claim, and a reader has no way to tell a
 * suppressed claim from a claim that came back empty. "Nothing here" and
 * "nothing here that matches what you asked for" look identical, and the
 * first is the one that gets acted on.
 *
 * **The wording has to be true of this screen.** The reference mockup says
 * "gap markers are hidden" on every filtered view, but the cross-resident
 * views have no gap markers to hide — a banner naming a mechanism that is not
 * on the page is a false guarantee, which is the same defect as a comment
 * claiming something the code does not do. So each caller says what its own
 * filter actually costs, and the literal gap-marker wording belongs to the
 * one screen that renders gap markers.
 *
 * `tone` is not decoration. `suppressed` means a claim this screen would
 * otherwise make has been withheld; `scoped` means the claim is still being
 * made, but only about the filtered set. They are different promises and a
 * reader acts on them differently.
 */
export function FilterNotice({
  tone,
  heading,
  children,
}: {
  tone: 'suppressed' | 'scoped'
  /** The filter, in a phrase: "Filtered to K. Osei". */
  heading: string
  /** What that costs the claims on this screen. */
  children: React.ReactNode
}) {
  return (
    <div className={styles.filterNotice} data-filter-notice={tone} role="note">
      <Icon name="alert-notification/information-circle" size={20} aria-hidden />
      <p className={styles.filterNoticeBody}>
        <strong className={styles.filterNoticeHeading}>{heading}.</strong> {children}
      </p>
    </div>
  )
}
