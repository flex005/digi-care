import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Logo } from './Logo'

/**
 * The product mark. PRD §4.7.
 *
 * **The colour is the whole risk here, and it is invisible to a DOM query.**
 * The same lockup sits on a white rail and on a deep purple panel, and it only
 * works because every path carries `data-part` for CSS to override. A
 * re-export from the design tool would drop those attributes, the artwork
 * would fall back to its baked `#6935CF` and `#1E0059`, and the mark on the
 * sign-in panel would be brand purple on brand purple — present, correct,
 * and unreadable. Nothing else in the suite would notice.
 */
describe('the mark can be recoloured by whatever it sits on', () => {
  it('tags both halves of the lockup, which is what CSS overrides', () => {
    const { container } = render(<Logo title="Product mark" />)

    const marks = container.querySelectorAll('[data-part="mark"]')
    const words = container.querySelectorAll('[data-part="word"]')
    expect(marks.length, 'the mark has no taggable path').toBeGreaterThan(0)
    expect(words.length, 'the wordmark has no taggable path').toBeGreaterThan(0)
  })

  it('tags the mark-only variant too', () => {
    const { container } = render(<Logo variant="mark" title="Product mark" />)
    expect(container.querySelectorAll('[data-part="mark"]').length).toBeGreaterThan(0)
    // No wordmark in this one: it is the half that does not fit a collapsed rail.
    expect(container.querySelectorAll('[data-part="word"]')).toHaveLength(0)
  })

  it('carries a different class on a dark ground', () => {
    const light = render(<Logo tone="light" title="Product mark" />)
    const ink = render(<Logo tone="ink" title="Product mark" />)

    const lightClass = light.container.querySelector('[data-logo]')!.className
    const inkClass = ink.container.querySelector('[data-logo]')!.className
    expect(lightClass).not.toBe(inkClass)
  })

  it('is hidden from a screen reader when nothing needs naming', () => {
    /*
     * Two announcements of the same word is noise. Where a heading beside the
     * mark already says the product's name, the mark is decoration.
     */
    const { container } = render(<Logo />)
    const wrapper = container.querySelector('[data-logo]')!
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.getAttribute('role')).toBeNull()

    const named = render(<Logo title="Product mark" />)
    const namedWrapper = named.container.querySelector('[data-logo]')!
    expect(namedWrapper.getAttribute('role')).toBe('img')
    expect(namedWrapper.getAttribute('aria-label')).toBe('Product mark')
  })
})
