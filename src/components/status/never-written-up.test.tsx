import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NeverWrittenUp } from './NeverWrittenUp'

/**
 * One concept, one label, one treatment.
 *
 * This rendered in five places with three different labels and four different
 * supporting lines, all saying the same thing. A reader who learns what the
 * hatch means on one screen should not have to learn a second vocabulary on
 * the next.
 */
describe('a resident nobody has ever written up', () => {
  it('says the same words in every variant', () => {
    for (const variant of ['badge', 'chip', 'panel', 'quiet'] as const) {
      const { container, unmount } = render(<NeverWrittenUp variant={variant} />)
      expect(container.textContent?.trim()).toBe('Never written up')
      unmount()
    }
  })

  it('hatches everywhere except the handover row', () => {
    const hatched = render(<NeverWrittenUp />)
    expect(hatched.container.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    hatched.unmount()

    // The one deliberate exception: that row is already hatched by "Not
    // reviewed", and a second hatch on it is noise rather than emphasis.
    const quiet = render(<NeverWrittenUp variant="quiet" />)
    expect(quiet.container.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  it('is the only place the words are written', () => {
    // The guard that stops a sixth rendering being added by hand. Any file
    // spelling out its own version of this fact is the defect coming back.
    //
    // Read through Vite rather than `node:fs`, so it works in the browser-like
    // test environment the rest of the suite runs in and needs no Node types.
    const sources = import.meta.glob('../../features/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    for (const [file, raw] of Object.entries(sources)) {
      // Tests are allowed to name the words: asserting on the rendered copy is
      // how the words get checked at all. The rule is about the components.
      if (file.includes('.test.')) continue
      // Comments stripped first: the rule is about what reaches the screen,
      // and a docblock quoting the old copy to explain why it went is not the
      // defect coming back.
      const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
      const strings = text.match(/'[^']*'|"[^"]*"/g) ?? []
      // "No care note recorded" on its own is the *gap marker's* phrase — a
      // stretch of time with nothing in it, which is a different fact from a
      // record that has never been written in at all.
      const offenders = strings.filter((literal: string) =>
        /never written up|no care note has ever been recorded/i.test(literal),
      )
      expect(offenders, `${file} spells out its own version`).toEqual([])
    }
  })
})
