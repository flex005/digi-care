import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSession } from './use-session'

/**
 * Nothing in the product renders until somebody has signed in. PRD §6.7.
 *
 * **This gate enforces nothing about security and is not pretending to.**
 * There is no authentication behind it: any details sign you in, and the
 * screens it guards are static files anybody can fetch. What it does enforce
 * is that the site is chosen before the first record is read, which is a real
 * property — the site decides the timezone every clinical timestamp renders
 * in, and a screen read before that choice was made was read in the wrong zone.
 *
 * A reload signs you out, because there is no session to remember and nothing
 * in this build persists anywhere.
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { signIn } = useSession()
  const location = useLocation()

  if (signIn.kind === 'signed_out') {
    /*
     * `replace`, so the back button does not return to a screen that never
     * rendered — and the path is carried so signing in lands where somebody
     * was going rather than dropping them on the Dashboard.
     */
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
