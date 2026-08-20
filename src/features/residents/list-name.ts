import type { Resident } from '@/data/types'

/**
 * The name in a list row: preferred first name plus surname — "Ada Nwachukwu"
 * for Adaeze Nwachukwu, who is known as Ada.
 *
 * One line, not two. The preferred-name-over-legal-name stack made every row
 * taller and read as a form field, and it was doing identity confirmation in
 * the wrong place: that happens on the profile header, where the full legal
 * name, photo, date of birth and room sit together and somebody is about to
 * act on the record. A list is for finding a person; a header is for being
 * certain it is them.
 *
 * **The surname is derived, not stored.** `Resident` has `preferredName` and
 * `fullLegalName` with nothing between them, so this takes the last token of
 * the legal name. That is right for every name in the fixtures and wrong for
 * the first one with a particle — "Anna van der Berg" would render as "Anna
 * Berg", which is somebody's name mangled by a string split.
 *
 * `residents.test.tsx` therefore fails if any fixture legal name stops being
 * two tokens. That day the answer is a real surname field on `Resident`, which
 * is a fixture type change and Frank's call — the guard exists to force that
 * conversation rather than let the mangling ship quietly.
 */
export function listName(resident: Resident): string {
  const parts = resident.fullLegalName.trim().split(/\s+/)
  // One token means there is no surname to take. Show the legal name whole
  // rather than doubling the single name back on itself.
  if (parts.length < 2) return resident.fullLegalName
  return `${resident.preferredName} ${parts[parts.length - 1]}`
}
