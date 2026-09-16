import { useEffect, useState, type ReactNode } from 'react'
import styles from './AppShell.module.css'

/**
 * Desktop only in this build. PRD §4.6: below 1280px the app shows a message
 * directing the user to a wider screen rather than degrading into a broken
 * layout.
 *
 * This is a designed state, not a failure page. A manager who opens the app
 * on a narrow window should be told what to do about it, not shown a MAR grid
 * with columns overlapping — a misread MAR grid is the whole risk.
 */

const MIN_WIDTH = 1280

export function ViewportGuard({ children }: { children: ReactNode }) {
  const [tooNarrow, setTooNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`)
    const update = () => setTooNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (tooNarrow) {
    return (
      <div className={styles.viewportGuard}>
        <p className={styles.viewportGuardTitle}>This window is too narrow</p>
        <p className={styles.viewportGuardBody}>
          diGi-Care needs a screen at least {MIN_WIDTH} pixels wide. Widen this window
          or move to a larger display.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
