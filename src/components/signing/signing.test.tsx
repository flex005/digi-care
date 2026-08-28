import { describe, expect, it } from 'vitest'
import { staffOkonkwo, staffNwosu } from '@/data/fixtures/organisation'
import { signingCodeFor, signingCodeMatches } from '@/data/access/team-store'
import { canSign } from './SigningIdentity'

/**
 * Who signed, rather than that somebody clicked. PRD §6.7.
 *
 * The round asked for four digits and checked only that four had been typed,
 * which establishes that a person was at the trolley and nothing about which
 * person. On a device a shift shares, that is the shared-login failure with a
 * keypad in front of it.
 */
describe('a signature names a member of staff', () => {
  it('gives each person their own code, and the same one every time', () => {
    const mine = signingCodeFor(staffOkonkwo.id)
    expect(mine).toMatch(/^\d{4}$/)
    expect(signingCodeFor(staffOkonkwo.id)).toBe(mine)
    expect(signingCodeFor(staffNwosu.id)).not.toBe(mine)
  })

  it('accepts only the signer’s own code', () => {
    expect(canSign(staffOkonkwo, signingCodeFor(staffOkonkwo.id))).toBe(true)

    // Somebody else's code, and four digits that belong to nobody. Both are
    // refused, and the second is the one the old length check let through.
    expect(canSign(staffOkonkwo, signingCodeFor(staffNwosu.id))).toBe(false)
    expect(canSign(staffOkonkwo, '0000')).toBe(
      signingCodeFor(staffOkonkwo.id) === '0000',
    )
    expect(signingCodeMatches(staffOkonkwo.id, '')).toBe(false)
  })
})
