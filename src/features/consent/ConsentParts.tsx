import type { AnyConsent, DecisionAuthority, EffectCount } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatDate, formatCount } from '@/lib/format'
import styles from './consent.module.css'

/**
 * The second column: **who decided it**, which is a different question from
 * what was decided.
 *
 * `not_sought` and `pending` carry no authority, and that is not a blank —
 * nothing has been decided, so there is nobody who decided it. The hatch says
 * so, because an empty cell there would read as an authority nobody recorded.
 */
export function ConsentAuthority({ status }: { status: AnyConsent }) {
  if (status.kind === 'not_sought' || status.kind === 'pending') {
    return (
      <span className={styles.authority} data-authority="none">
        <span className={styles.authorityKey}>Decided by</span>
        <Unrecorded
          variant="chip"
          label="Nobody has decided"
          detail={
            status.kind === 'pending'
              ? 'asked, and no answer recorded yet'
              : 'nobody has asked, and nobody has decided on their behalf'
          }
        />
      </span>
    )
  }

  return (
    <span className={styles.authority} data-authority={status.by.kind}>
      <span className={styles.authorityKey}>Decided by</span>
      <span className={styles.authorityWho}>{who(status.by)}</span>
      <span className={styles.authorityCapacity}>
        <Capacity authority={status.by} />
      </span>
    </span>
  )
}

function who(authority: DecisionAuthority<never>): string {
  switch (authority.kind) {
    case 'the_resident':
      return 'The resident'
    case 'best_interests':
      return 'A best-interests process'
    case 'lpa_holder':
      return authority.who
    default:
      return assertNever(authority)
  }
}

/**
 * The assessment that authorised it, named rather than implied.
 *
 * A decision recorded against an assessment nobody can find is a signature
 * without a basis — and the scope is part of the record, because an assessment
 * that did not name this decision could not have authorised it.
 */
function Capacity({ authority }: { authority: DecisionAuthority<never> }) {
  const { assessment } = authority
  const finding = assessment.finding
  const covered = Object.keys(assessment.covers).length

  return (
    <>
      {finding.kind === 'has_capacity'
        ? 'Capacity assessed'
        : 'Lacks capacity for this decision · assessed'}{' '}
      <span data-numeric>{formatDate(assessment.assessedOn)}</span> ·{' '}
      {assessment.assessedBy.displayName}
      {covered > 1 ? (
        <>
          {' '}
          · one assessment covering <span data-numeric>
            {formatCount(covered)}
          </span>{' '}
          decisions
        </>
      ) : null}
      {authority.kind === 'best_interests' ? (
        <> · consulted: {authority.consulted.join(', ')}</>
      ) : null}
    </>
  )
}

/**
 * How many of something still exists.
 *
 * **`not_counted` renders as the gap it is.** Nobody knowing how many prints
 * are on the corridor noticeboards is not the same as there being none, and a
 * zero would be a figure nobody measured.
 */
export function EffectCountValue({ count }: { count: EffectCount }) {
  switch (count.kind) {
    case 'counted':
      return (
        <span className={styles.effectCount} data-count="counted">
          <span data-numeric>{formatCount(count.value)}</span>
        </span>
      )
    case 'unchanged':
      return (
        <span className={styles.effectCount} data-count="unchanged">
          Unchanged
        </span>
      )
    case 'not_counted':
      return (
        <span data-count="not_counted">
          <Unrecorded variant="chip" label="Not counted" />
        </span>
      )
    default:
      return assertNever(count)
  }
}
