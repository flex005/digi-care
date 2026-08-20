import type { Resident } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import styles from './residents.module.css'

/**
 * The risk flags column. PRD §6.2, and the sharpest decision on this screen.
 *
 * Rendering all five badge-strip statuses on all 32 rows is unreadable —
 * volume that drowns a distinction is the same failure as a blank cell. But
 * rendering only the "notable" ones leaves an empty cell for everyone else,
 * and **an empty cell is exactly what this product exists to prevent**: it
 * reads as "nothing wrong" when it may mean nobody has looked.
 *
 * So the cell shows every notable state — an elevated falls risk, recorded
 * allergies, a DNAR, EOLC in place, isolating — **plus every unrecorded one,
 * hatched**, because "not assessed" is always notable. And when a resident
 * genuinely has none of those, it renders an explicit claim:
 *
 *     ALL ASSESSED — NO FLAGS
 *
 * which is a recorded finding, not the absence of one. A blank never appears
 * in this column. That is the entire point of it.
 *
 * **The rule that makes this safe: anything not shown here is recorded and
 * unremarkable.** It holds only because every unrecorded state renders
 * hatched — so no badge cannot mean "nobody looked", it can only mean "looked,
 * and it was the settled value". That is why `for_resuscitation` is not drawn
 * as a pill: `no_decision_recorded` and `dnar_in_place` both always render, so
 * the absence of a resuscitation badge is unambiguous, and drawing the third
 * state on all 32 rows would fill the column with reassurance nobody acts on.
 * The full badge strip, with every state drawn, is the profile header's job
 * (PRD §6.2) — that is the write surface, and this is the index.
 *
 * There is deliberate overlap with the Critical records missing chip —
 * falls-not-assessed appears in both. They answer different questions (PRD §1:
 * *what does this person need right now* versus *can you prove you did what
 * you said*), and a manager uses them differently. Suppressing one to avoid
 * the repetition would be tidier and less true.
 */
export function RiskFlagsCell({ resident }: { resident: Resident }) {
  const flags: React.ReactNode[] = []

  // Falls — the §2.1 example. "No FALLS RISK badge reads to a care worker as
  // 'assessed, he's fine'. It may mean nobody has ever assessed him."
  const falls = resident.risks.falls
  if (falls.kind === 'not_assessed') {
    flags.push(<Unrecorded key="falls" label="Falls — not assessed" />)
  } else if (falls.level !== 'low') {
    flags.push(
      <StatusPill
        key="falls"
        tone={falls.level === 'high' ? 'critical' : 'caution'}
        label={`Falls — ${falls.level === 'high' ? 'HIGH' : 'MODERATE'}`}
      />,
    )
  }

  // Dysphagia — same-day dangerous, and critical for the same reason falls is.
  const choking = resident.risks.choking
  if (choking.kind === 'not_assessed') {
    flags.push(<Unrecorded key="choking" label="Dysphagia — not assessed" />)
  } else if (choking.level === 'high') {
    flags.push(<StatusPill key="choking" tone="critical" label="Dysphagia — HIGH" />)
  }

  // Allergies — three states, three treatments. A recorded "none known" is a
  // complete record and is NOT shown here: it is the settled case, and the
  // cell would fill with reassurance nobody needs to act on.
  switch (resident.allergies.kind) {
    case 'not_recorded':
      flags.push(<Unrecorded key="allergies" label="Allergies not recorded" />)
      break
    case 'allergies':
      for (const allergy of resident.allergies.items) {
        flags.push(
          <StatusPill
            key={`allergy-${allergy.substance}`}
            tone="critical"
            label={`Allergy: ${allergy.substance}`}
          />,
        )
      }
      break
    case 'none_known':
      break
  }

  // Resuscitation — ambiguity here is catastrophic in both directions (§2.1).
  // A missing decision is hatched and a DNAR is drawn; "for resuscitation" is
  // the settled value and folds into the "all assessed" claim. Because the
  // other two always render, no badge here can only mean for-resuscitation.
  switch (resident.resuscitation.kind) {
    case 'no_decision_recorded':
      flags.push(<Unrecorded key="resus" label="No resuscitation decision" />)
      break
    case 'dnar_in_place':
      flags.push(<StatusPill key="resus" tone="brand" label="DNAR in place" />)
      break
    case 'for_resuscitation':
      break
  }

  if (resident.eolc.kind === 'in_place') {
    flags.push(
      <StatusPill
        key="eolc"
        tone="info"
        label="EOLC in place"
        detail={`since ${formatDate(resident.eolc.startedOn)}`}
      />,
    )
  }

  if (resident.isolation.kind === 'isolating') {
    flags.push(
      <StatusPill
        key="isolation"
        tone="caution"
        label={`Isolating — ${resident.isolation.reason}`}
      />,
    )
  }

  if (flags.length === 0) {
    // Not a blank. A claim: everything on the strip has been looked at, and
    // none of it needs attention today.
    return (
      <div className={styles.flags}>
        <StatusPill tone="positive" label="All assessed — no flags" />
      </div>
    )
  }

  return <div className={styles.flags}>{flags}</div>
}
