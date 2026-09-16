/**
 * The data access layer's state shape.
 *
 * There is no server. A thin layer returns fixture data behind promise-shaped
 * functions so a real API can replace it later without touching components
 * (PRD §3.1). What the layer must express is not "the data" but the seven
 * states every screen is reviewed against (PRD §6):
 *
 *   Loading · Empty · Partial · Populated · Stale · Error · Read-only
 *
 * Three of those are transport concerns and live here. `Loading` and `Error`
 * are members of AsyncResource; `Stale` is derived from `fetchedAt` rather
 * than being a separate flag, so it cannot drift out of sync with the data.
 *
 * The other four are properties of the data itself and belong to the domain
 * types, not to this union — `Empty` and `Partial` are designed states that
 * say what is missing, never a shrug, and `Read-only` is a permission.
 *
 * Note there is no `{ data: T | null }` shape here. That would reintroduce
 * exactly the ambiguity the Evidence Invariant exists to prevent: a null
 * that means either "no data" or "not loaded yet".
 */

import type { IsoDateTime } from '../types'

export type AsyncResource<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T; fetchedAt: IsoDateTime }
  | { kind: 'error'; message: string; retry: () => void }
  /**
   * The record exists, in a home this viewer is not appointed to.
   *
   * **A fourth member rather than an error, because it is not one.** Nothing
   * failed: the record is there and it loaded. Rendering it through `error`
   * would put "could not be loaded" over a record that loaded perfectly, which
   * is the product misdescribing its own state — the same lie as a not-found
   * for a resident who exists, one layer up.
   *
   * It carries both homes so the panel can name them. A ternary is not
   * exhaustive, so the compiler will not force a screen to handle this;
   * `scripts/check-refusal-handled.mjs` does, and a consumer that ignores it
   * falls through to the ready branch and reads `data` that is not there.
   */
  | {
      kind: 'refused'
      /** The record, in words: "Nathaniel Brennan's record". */
      what: string
      /** The home it belongs to. */
      home: string
      /** The homes this viewer is appointed to. */
      yours: string[]
    }

/*
 * `AccessMode` was declared here and is gone. It said read-only is a property
 * of the viewer rather than of the data, which is true and is now answered by
 * `levelFor` per module: a viewer is not read-only everywhere, they are
 * read-only in the modules they cannot write in, and one global flag could not
 * say which. Phase 17.
 */
