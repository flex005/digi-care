import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { StatesRoute } from '@/dev/StatesRoute'
import { NotFound } from './NotFound'

/**
 * Routing. React Router 7, data router API. PRD §3.1.
 *
 * Phase 0 registers three routes and no more. Modules get their routes in
 * their own phase — stubbing them now would mean shipping placeholder
 * screens, which CLAUDE.md §6 forbids. The sidebar already tells the user
 * they are coming, which is the honest version of the same information.
 *
 * `/` redirects to /dev/states because Phase 0 has no user-facing screens
 * (PRD §6.1) and /dev/states is the one thing this phase built. The Dashboard
 * claims `/` when Phase 1 lands.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dev/states" replace /> },
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
