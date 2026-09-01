import { createContext, useContext, useEffect, useRef } from 'react'

/**
 * A screen that needs the width takes it, rather than asking.
 *
 * The MAR week view is 1188px wide and the content column gives it 970px at
 * 1280 — the narrowest width the app supports — so the heading says "Week of
 * 31/08 to 06/09" and the grid renders six days. A caption disagreeing with
 * what it captions.
 *
 * The 218px is in the chrome, not the grid: the rail holds 176px and the page
 * gutter 48px. Reclaiming both fits the week without narrowing a dose target
 * to WCAG 2.5.8's floor, wrapping a drug name, or dropping the totals column's
 * denominator — the four things the grid itself could have given.
 *
 * **Automatic, not offered.** A toggle leaves the default view unable to show a
 * week for anyone who does not know to collapse the rail, and the people least
 * likely to know are the ones opening it for the first time.
 *
 * Two things keep it from being a state the reader has to undo:
 *
 *  - **The collapse control stays visible**, so the rail is obviously
 *    restorable. This sets the same state the reader can set; it does not
 *    override or hide it. Expanding it again clips the week, which is their
 *    call to make.
 *  - **Leaving restores whatever the rail was before.** The width is a
 *    property of this screen, so it ends when the screen does — a reader who
 *    arrived with the rail open finds it open again.
 */

export interface ShellLayout {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  /** Drops the page gutter. Layout only, and not reader-toggleable. */
  wide: boolean
  setWide: (wide: boolean) => void
}

export const ShellLayoutContext = createContext<ShellLayout | null>(null)

export function useShellLayout(): ShellLayout {
  const layout = useContext(ShellLayoutContext)
  if (!layout) {
    throw new Error('useShellLayout must be used inside the app shell')
  }
  return layout
}

/** Call from a route that needs the full width for as long as it is mounted. */
export function useWideScreen(): void {
  const { collapsed, setCollapsed, setWide } = useShellLayout()

  /*
   * The rail's state as it was on arrival, captured once.
   *
   * Stated rather than implied. The effect's dependencies are both stable, so
   * it runs once and a plain read of `collapsed` inside it would capture the
   * same value — mutating the ref away changes nothing, and that was checked
   * rather than assumed. What it survives is the next edit: adding `collapsed`
   * to the dependencies re-runs the effect on every toggle, and the cleanup
   * then restores whatever the reader last set instead of what they walked in
   * with. That variant fails three of the four tests below; the ref makes the
   * intent legible so it does not have to.
   */
  const before = useRef(collapsed)

  useEffect(() => {
    const restoreTo = before.current
    setCollapsed(true)
    setWide(true)
    return () => {
      setCollapsed(restoreTo)
      setWide(false)
    }
  }, [setCollapsed, setWide])
}
