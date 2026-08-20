import type { AllergyStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * Allergies. The sharpest illustration of the Evidence Invariant in the whole
 * product, and the reason `AllergyStatus` has three members. PRD §6.2:
 *
 *   ALLERGIES: penicillin                      critical — a finding
 *   NO KNOWN ALLERGIES — recorded 12/03/2026   positive — a recorded NEGATIVE
 *   ALLERGIES NOT RECORDED                     hatched  — nobody has asked
 *
 * The middle one is a complete clinical record and must look settled. Only
 * the third is a hole. A care worker about to give penicillin needs to know
 * which of the three they are looking at, from across the room.
 *
 * Allergies render in --status-critical wherever they appear, and appear on
 * every medication and care screen, not only on the profile. PRD §6.2.
 */
export function AllergyBadge({ status }: { status: AllergyStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_recorded':
      return <Unrecorded label="Allergies not recorded" />

    case 'none_known':
      return (
        <StatusPill
          tone="positive"
          label="No known allergies"
          detail={`recorded ${format.instantDate(status.recordedAt)} · ${status.recordedBy.displayName}`}
        />
      )

    case 'allergies':
      return (
        <>
          {status.items.map((allergy) => (
            <StatusPill
              key={allergy.substance}
              tone="critical"
              label={`Allergy: ${allergy.substance}`}
              detail={`${allergy.reaction} · ${SEVERITY[allergy.severity]}`}
            />
          ))}
        </>
      )

    default:
      return assertNever(status)
  }
}

const SEVERITY: Record<'mild' | 'moderate' | 'severe' | 'anaphylaxis', string> = {
  mild: 'mild',
  moderate: 'moderate',
  severe: 'severe',
  anaphylaxis: 'anaphylaxis',
}
