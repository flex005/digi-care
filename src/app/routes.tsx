import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { StatesRoute } from '@/dev/StatesRoute'
import { ResidentsRoute } from '@/features/residents/ResidentsRoute'
import { ResidentProfileRoute } from '@/features/residents/ResidentProfileRoute'
import { GeneralInformationTab } from '@/features/residents/GeneralInformationTab'
import { NotFound } from './NotFound'

/**
 * Routing. React Router 7, data router API. PRD §3.1.
 *
 * Phase 0 registers three routes and no more. Modules get their routes in
 * their own phase — stubbing them now would mean shipping placeholder
 * screens, which CLAUDE.md §6 forbids. The sidebar already tells the user
 * they are coming, which is the honest version of the same information.
 *
 * `/` redirects to /residents. /dev/states is never deleted — it is how the
 * Evidence Invariant is checked visually at the end of every phase.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      // The Dashboard is built in Phase 12 alongside CQC Compliance, on the
      // same aggregate machinery (PRD §8). Until then / lands on the residents
      // list, which PRD §4.7 documents as the intended behaviour rather than a
      // stopgap.
      { index: true, element: <Navigate to="/residents" replace /> },
      { path: 'residents', element: <ResidentsRoute /> },
      {
        // A layout route, so the subject header stays mounted across every
        // tab rather than being rebuilt by each one. §2.4.
        path: 'residents/:residentId',
        element: <ResidentProfileRoute />,
        children: [{ index: true, element: <GeneralInformationTab /> }],
      },
      {
        // Not deleted after Phase 0. This is how the Evidence Invariant is
        // checked visually in every later review. PRD §6.1.
        path: 'dev/states',
        element: <StatesRoute />,
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
