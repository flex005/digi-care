import { RouterProvider } from 'react-router-dom'
import { SessionProvider } from './session/SessionProvider'
import { router } from './routes'

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  )
}
