import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Manrope, self-hosted via @fontsource. Weights 400/500/600/700/800 — the
// five in the closed type scale, and no others. PRD §4.3.
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'

// Order matters: tokens first, so everything after can read them.
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
