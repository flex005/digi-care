import type { Recorded } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill } from './StatusPill'
import { Unrecorded } from './Unrecorded'

/**
 * The general shape, for any clinical value without a bespoke union.
 * PRD §5.1.
 *
 * The allergies case in PRD §6.2 is the sharpest illustration of why the
 * unrecorded member exists, and why a recorded negative is a third thing:
 *
 *   ALLERGIES: penicillin                          recorded positive, red
 *   NO KNOWN ALLERGIES — recorded 12/03/2026       recorded NEGATIVE, green
 *   ALLERGIES NOT RECORDED                         unrecorded, hatched
 *
 * The middle one is a complete clinical record and must look settled. Only
 * the third is a gap.
 */

export interface RecordedValueProps<T> {
  /** What the field is: "Allergies", "Preferred name". */
  name: string
  record: Recorded<T>
  /** How to render a recorded value. */
  render: (value: T) => string
  /**
   * Tone for a recorded value. Allergies present are critical; most fields
   * are simply recorded, so positive is the default.
   */
  tone?: 'positive' | 'caution' | 'critical' | 'info' | 'brand'
}

export function RecordedValue<T>({
  name,
  record,
  render,
  tone = 'positive',
}: RecordedValueProps<T>) {
  const format = useSiteFormat()

  switch (record.kind) {
    case 'unrecorded':
      return <Unrecorded label={`${name} not recorded`} />

    case 'recorded':
      return (
        <StatusPill
          tone={tone}
          label={render(record.value)}
          detail={format.attribution(
            record.recordedBy.displayName,
            record.recordedAt,
            record.recordedBy.isActive,
          )}
        />
      )

    default:
      return assertNever(record)
  }
}
