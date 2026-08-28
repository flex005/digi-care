import type { RiskLevel, RiskStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { scoreText } from '@/features/risk/score'
import { Unrecorded } from './Unrecorded'

/**
 * A risk assessment's status. PRD §5.1, §6.2.
 *
 * The absence of a badge is never silence. No FALLS RISK badge reads to a care
 * worker as "assessed, he's fine" — it may mean nobody has ever assessed him.
 * So this component renders in every case and is never conditionally omitted:
 *
 *   FALLS RISK — HIGH        solid red, a finding
 *   FALLS — NOT ASSESSED     hatched, an open loop
 *
 * There is no third option where the badge simply is not there.
 */

const LEVEL_TONE = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
} as const

const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
}

export interface RiskBadgeProps {
  /** What was assessed: "Falls risk", "Pressure ulcer risk". */
  name: string
  status: RiskStatus
}

export function RiskBadge({ name, status }: RiskBadgeProps) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_assessed':
      return <Unrecorded label={`${name} not assessed`} />

    case 'assessed':
      return (
        <StatusPill
          tone={LEVEL_TONE[status.level]}
          label={`${name} · ${LEVEL_LABEL[status.level]}`}
          detail={`${scoreText(status.score)} · ${status.assessedBy.displayName}, ${format.instantDate(
            status.assessedAt,
          )}`}
        />
      )

    default:
      return assertNever(status)
  }
}
