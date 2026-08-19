import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { TooltipProvider, ToastProvider } from '@/components/primitives'
import { StatesRoute } from './StatesRoute'

/**
 * The automated accessibility check PRD §7 requires per screen.
 *
 * /dev/states is the densest surface in the build — every status primitive,
 * every primitive, the whole token sheet — so if it passes axe, the
 * components it is made of pass too.
 *
 * This does not replace the manual keyboard pass. Automated checks catch
 * roughly a third of what matters; the rest is walking the page with the Tab
 * key before a phase is signed off.
 */
describe('/dev/states', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <TooltipProvider>
        <ToastProvider>
          <StatesRoute />
        </ToastProvider>
      </TooltipProvider>,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  }, 30000)
})
