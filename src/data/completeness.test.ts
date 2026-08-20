import { describe, expect, it } from 'vitest'
import { residents } from './fixtures/residents'
import { NOW } from './fixtures/generate'
import { hadCriticalGapAt, recordCompleteness } from './completeness'

/**
 * The two definitions of "critical gap" must be one definition.
 *
 * `recordCompleteness` decides it for now; `hadCriticalGapAt` decides it for a
 * past instant by reading the same records' timestamps. They are separate
 * functions, which is exactly the shape that drifts — an eighth critical added
 * to one and forgotten in the other would be invisible until a figure on a
 * card quietly disagreed with the chip on the row beneath it.
 */
describe('as-of completeness agrees with present completeness', () => {
  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s',
    (name, resident) => {
      expect(
        hadCriticalGapAt(resident, NOW.getTime()),
        `${name}: the as-of check disagrees with recordCompleteness at the present instant — the two critical lists have drifted apart`,
      ).toBe(recordCompleteness(resident).hasCriticalGaps)
    },
  )
})

describe('reconstruction actually looks backwards', () => {
  it('finds at least one resident whose critical position was different a month ago', () => {
    // If nothing ever changes, the delta on every card is a permanent zero and
    // the reconstruction is dead code dressed as a figure.
    const monthAgo = NOW.getTime() - 30 * 86_400_000
    const changed = residents.filter(
      (resident) =>
        hadCriticalGapAt(resident, monthAgo) !==
        hadCriticalGapAt(resident, NOW.getTime()),
    )
    expect(changed.length).toBeGreaterThan(0)
  })
})
