/**
 * The diGi application family, for the app switcher in the top bar.
 *
 * **Only apps the documents actually name appear here.** Two do:
 *
 *  - **diGiLog** — FRONTEND_PRD.md §4.3 and §4.7. The design language this
 *    product inherits its palette and chrome from; §4.3 cites its dashboard
 *    and the Alerts card its status pills were sampled from.
 *  - **diGi-Time** — FRONTEND_PRD.md §6.3. Where a care note's shift comes
 *    from: "shift (auto from diGi-Time fixture, editable with reason)".
 *
 * A launcher is exactly the kind of surface that invites a plausible-looking
 * list — diGi-Pay, diGi-Recruit — and each invented name would be a fictional
 * product sitting in a real product's chrome, indistinguishable from a real
 * one to anybody reviewing this. Every description below is grounded in the
 * sentence cited above it, for the same reason.
 *
 * **None of them is reachable from this build.** It is frontend-only, with no
 * backend and no shared session, so there is no URL to send anyone to. They
 * render present and explicitly unavailable rather than as links that do
 * nothing — PRD §6.4's rule for the stubbed MAR export: "never a silent
 * no-op". Give an app a `url` when there is a real one.
 */
export interface DigiApp {
  name: string
  /** What it does, in a few words. Grounded in the citation above. */
  description: string
  /** True for the app you are already in. Exactly one, asserted in tests. */
  isCurrent: boolean
}

export const digiApps: DigiApp[] = [
  { name: 'diGi-Care', description: 'Care management', isCurrent: true },
  { name: 'diGiLog', description: 'Dashboard and alerts', isCurrent: false },
  { name: 'diGi-Time', description: 'Shifts', isCurrent: false },
]

/** Said in full on every app that has nowhere to go, never on hover alone. */
export const NOT_LINKED = 'Not in this prototype'
