/**
 * A record that exists, in a home this viewer is not appointed to.
 *
 * **Not an error, and not a not-found.** The record loaded fine and the
 * resident is real: "could not be loaded" would misdescribe the product's own
 * state, and a not-found would have the product lying about what is on the
 * record. What is true is narrower and says itself — this belongs to Ashgrove
 * Lodge, and you are appointed to Rosewood Court.
 *
 * It carries both homes because the panel names both. A refusal that says only
 * "not yours" leaves a reader unable to tell a mistake from a boundary.
 */
export class RecordNotYours extends Error {
  readonly what: string
  readonly home: string
  readonly yours: string[]

  constructor(what: string, home: string, yours: string[]) {
    super(`${what} belongs to ${home}.`)
    this.name = 'RecordNotYours'
    this.what = what
    this.home = home
    this.yours = yours
  }
}

export const isNotYours = (error: unknown): error is RecordNotYours =>
  error instanceof RecordNotYours
