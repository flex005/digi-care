import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Order matters: tokens first, so everything after can read them. tokens.css
// also carries the @font-face rules — Manrope's five static masters under our
// own family name, and it says there why the rename exists. PRD §4.3.
import './styles/tokens.css'
import './styles/reset.css'
import './styles/base.css'

import { App } from './app/App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
