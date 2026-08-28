/**
 * What one in-memory store is holding that only exists in this browser tab.
 *
 * **Declared by the store itself, because only the store knows what it has.**
 * A count of "4" from the note store means four care notes; the same number
 * from the MAR store means four doses, and from the settings store four
 * figures somebody moved. A loss list assembled by a screen reading raw
 * numbers out of twelve stores would be a screen deciding what those numbers
 * mean, which is the failure this file exists to avoid.
 */
export interface SessionHolding {
  /**
   * What was written, as a plural noun phrase in the second person: "care
   * notes you wrote".
   *
   * Plural regardless of the count, and the count renders in its own column
   * beside it, so nothing here has to agree a plural at the point of use.
   */
  what: string
  count: number
}

/** Only what is actually held. A store with nothing contributes nothing. */
export const held = (what: string, count: number): SessionHolding[] =>
  count > 0 ? [{ what, count }] : []
