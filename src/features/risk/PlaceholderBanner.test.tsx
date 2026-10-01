import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaceholderBanner } from './PlaceholderBanner'
import { PLACEHOLDER_NOTICE } from './instrument'

/**
 * The banner's own words, rendered on their own.
 *
 * **Not through a route or a fixture**, deliberately. Where this appears is a
 * separate question with its own tests; what it *says* is this one, and it was
 * wrong for reasons no route test could see.
 *
 * The title and the detail both opened with "This instrument is a
 * placeholder" — §8's entry about a repeated segment in a rendered string
 * being two owners agreeing the same fact, the one the pharmacy cycle's
 * "30mg · 30mg · capsules" is named for. A reader got the same sentence twice
 * and no second fact.
 *
 * **And the repetition was the lesser failure.** "This instrument is a
 * placeholder" reads like a note about the software — something not built
 * yet — rather than a warning about a number. A reader who takes it for a
 * development note ignores it, which is the opposite of what a clinical
 * warning is for.
 */
describe('the placeholder banner says one thing, once', () => {
  const TITLE = 'Not yet backed by a real clinical scale'

  it('names what is missing, and what to do instead', () => {
    render(<PlaceholderBanner />)

    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByText(PLACEHOLDER_NOTICE)).toBeTruthy()
    // What the number is, and what to use while it stands.
    expect(PLACEHOLDER_NOTICE).toContain('placeholder scoring')
    expect(PLACEHOLDER_NOTICE).toContain('Don’t base a care decision on it')
    expect(PLACEHOLDER_NOTICE).toContain('use the written findings here')
  })

  /**
   * The assertion that would have caught the original.
   *
   * Mechanical rather than a reading: the detail may not open by restating the
   * title. Written against the rendered pair rather than the constants, so
   * moving the duplication into the component rather than the string does not
   * slip past it.
   */
  it('does not open the detail by repeating the title', () => {
    const { container } = render(<PlaceholderBanner />)
    const text = container.textContent ?? ''

    const detail = text.slice(text.indexOf(TITLE) + TITLE.length).trim()
    expect(detail.startsWith(TITLE)).toBe(false)
    // Nor the old wording, which is what the two used to share.
    expect(detail.startsWith('This instrument is a placeholder')).toBe(false)
    expect(text).not.toMatch(/This instrument is a placeholder/)
    // And the title appears once in the whole banner, not twice.
    expect(text.split(TITLE).length - 1).toBe(1)
  })
})
