import type { OmissionClosure } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { omissionClosureSentence } from './omission-closure-wording'
import styles from './OmissionClosureFact.module.css'

/**
 * Whether somebody has closed an omission, stated beside the gap and never
 * instead of it. CW PRD MED-01, shared by both builds.
 *
 * **Closing records a decision about the gap; it does not fill it.** A closed
 * omission is still a dose nobody recorded, so whatever renders the omission
 * keeps its hatch, and this renders next to it as a second, plain fact: who
 * looked, when, and what they concluded. Two facts, two treatments, the same
 * rule as a given dose with its second signature missing.
 *
 * **Plain text, and deliberately not `<Settled>` or a pill.** `<Settled>` marks
 * itself `data-state="recorded"`, and inside a cell or a row about a dose that
 * reads as the dose being recorded. A green or "resolved" treatment would say
 * the same thing louder. Neither is true: the dose still has no record.
 *
 * An open omission renders nothing here, because the hatch beside it already
 * says what is true of it, exactly as it did before closures existed.
 */

export function OmissionClosureFact({ closure }: { closure: OmissionClosure }) {
  const format = useSiteFormat()

  switch (closure.kind) {
    case 'open':
      return null
    case 'closed':
      return (
        <span className={styles.fact} data-omission-closure="closed">
          {omissionClosureSentence(closure, format.attributionOn)}
        </span>
      )
    default:
      return assertNever(closure)
  }
}
