import { describe, expect, it } from 'vitest'
import { telHref } from './phone'

describe('telHref', () => {
  it('turns a UK national number into international form', () => {
    expect(telHref('0161 496 0789')).toBe('tel:+441614960789')
    expect(telHref('07700 900275')).toBe('tel:+447700900275')
  })

  it('never leaves a space in the href', () => {
    // The defect this exists for. `tel:0161 496 0789` is a URI with spaces in
    // it, and a national number dialled from anywhere else does not connect.
    for (const shape of ['0161 496 0789', '+44 161 496 0789', '00 44 161 496 0789']) {
      expect(telHref(shape)).not.toMatch(/\s/)
    }
  })

  it('leaves a number that is already international alone', () => {
    expect(telHref('+44 161 496 0789')).toBe('tel:+441614960789')
    expect(telHref('0044 161 496 0789')).toBe('tel:+441614960789')
    expect(telHref('+1 212 555 0100')).toBe('tel:+12125550100')
  })

  it('invents no country code for a number in neither shape', () => {
    // Guessing which country a number belongs to would be a fabricated fact on
    // a contact somebody dials in an emergency.
    expect(telHref('161 999 6789')).toBe('tel:1619996789')
  })

  it('returns a bare scheme rather than a broken href for empty input', () => {
    expect(telHref('')).toBe('tel:')
  })
})
