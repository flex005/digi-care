/**
 * Where somebody came to the setup wizard from, so its way out is true.
 *
 * "Back to the organisation" is right for somebody who opened it from the
 * Organisation tab and wrong for somebody who arrived from sign-in: they have
 * not been there, so going there is not going back. The origin travels in the
 * navigation's state, and anything else — a typed address, a state from some
 * other screen — gets "Go to the dashboard", which is true from any direction.
 */
export const SETUP_FROM_ORGANISATION = 'organisation'

export function cameFromOrganisation(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    state.from === SETUP_FROM_ORGANISATION
  )
}
