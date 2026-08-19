import * as RadixVisuallyHidden from '@radix-ui/react-visually-hidden'

/**
 * Content for assistive technology only. Thin wrapper over
 * @radix-ui/react-visually-hidden.
 *
 * Used where the accessible name must be a full sentence but the visible
 * element has to stay compact — the MAR grid's cells above all (PRD §6.4).
 *
 * Never used to hide something a sighted user needs. Hiding a status here
 * would be the Evidence Invariant failing silently.
 */
export const VisuallyHidden = RadixVisuallyHidden.Root
