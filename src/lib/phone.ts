/**
 * Dialable `tel:` hrefs.
 *
 * The display format and the dialable one are different strings and always
 * have been: "0161 999 6789" is what a person reads, `+441619996789` is what a
 * handset dials. Putting the display string in the href — which every contact
 * link in this app did — produces `tel:0161 999 6789`, with spaces a URI is
 * not supposed to carry, and no country code. Some dialers cope. Some strip
 * the spaces and dial a national number from a roaming phone, which fails
 * silently at the moment somebody is trying to reach a GP.
 *
 * **The +44 is an assumption, and a narrow one.** `Site` has no country, and
 * both homes are Europe/London, so a leading single zero is read as a UK
 * national number. That is the only case it is applied to: a number already in
 * international form is left alone, and a number in neither shape gets its
 * digits and no invented country code — guessing which country a phone number
 * belongs to is exactly the kind of invention this build exists to avoid.
 *
 * The day a site exists outside the UK, the code belongs on `Site` and this
 * reads it from there.
 */
const UK_COUNTRY_CODE = '+44'

export function telHref(display: string): string {
  const trimmed = display.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits === '') return 'tel:'

  // Already international, in either notation.
  if (trimmed.startsWith('+')) return `tel:+${digits}`
  if (digits.startsWith('00')) return `tel:+${digits.slice(2)}`

  // UK national: one leading zero, swapped for the country code.
  if (digits.startsWith('0')) return `tel:${UK_COUNTRY_CODE}${digits.slice(1)}`

  // Neither shape. Dial what we were given rather than guess a country.
  return `tel:${digits}`
}
