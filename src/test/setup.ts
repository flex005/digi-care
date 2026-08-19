import '@testing-library/jest-dom/vitest'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as axeMatchers from 'vitest-axe/matchers'

expect.extend(axeMatchers)

/**
 * jsdom implements neither of these. Both are used by real code that must be
 * testable: ViewportGuard reads matchMedia to decide whether the window is
 * wide enough for a care record, and Radix's overlays use ResizeObserver for
 * positioning.
 *
 * matchMedia reports "does not match", so components under test render their
 * normal desktop path rather than the too-narrow message.
 */
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

afterEach(() => {
  cleanup()
})
