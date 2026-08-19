import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon } from './Icon'

/**
 * CLAUDE.md §3 and PRD §7: icons are decorative by default and must be
 * hidden from assistive technology unless they are given a name. An icon that
 * announces itself as "add-01" to a screen reader is noise; an icon-only
 * control with no name is unusable.
 */
describe('Icon', () => {
  it('is hidden from assistive technology when it has no label', () => {
    const { container } = render(<Icon name="add-remove-delete/add-01" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('becomes a named image when given a label', () => {
    render(<Icon name="add-remove-delete/add-01" label="Add resident" />)
    const image = screen.getByRole('img', { name: 'Add resident' })
    expect(image).toBeInTheDocument()
    expect(image).not.toHaveAttribute('aria-hidden')
  })

  it('takes its colour from currentColor, never from the file', () => {
    const { container } = render(<Icon name="medical/stethoscope" />)
    const markup = container.innerHTML
    expect(markup).toContain('currentColor')
    // The whole set ships hard-coded as #141B34; the build step rewrites it.
    expect(markup.toLowerCase()).not.toContain('#141b34')
  })

  it('renders at the requested size from the closed size set', () => {
    const { container } = render(<Icon name="add-remove-delete/add-01" size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })
})
