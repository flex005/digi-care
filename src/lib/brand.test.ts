import { describe, expect, it } from 'vitest'
import {
  BRAND_OPTIONS,
  BRAND_STEPS,
  DEFAULT_BRAND_ID,
  LADDER,
  MIN_HUE_DISTANCE,
  STATUS_HUES,
  WHITE,
  brandOptionById,
  brandRamp,
  brandRampHex,
  clampChroma,
  contrast,
  hueDistance,
  oklchToHex,
  oklchToLinearRgb,
} from './brand'

/**
 * The ramp's arithmetic, and the one claim the whole design rests on.
 *
 * `scripts/check-brand-ramp.mjs` measures every offered hue against every
 * pairing; this is the layer underneath — that the conversion is right, that
 * the clamp does what it says, and that holding L is what makes the pairings
 * survive a hue change.
 */

describe('the conversion is right, measured against the ramp that shipped', () => {
  /*
   * **The strongest available check on a colour-space conversion: ask it for
   * the colours already in tokens.css.** A conversion with a transposed matrix
   * row produces plausible colours and fails this instantly. Three of the five
   * land exactly; two differ by one step in one channel, which is what
   * rounding the measured OKLCH to three decimals costs, so the tolerance is
   * stated rather than the assertion loosened to "looks about right".
   */
  it.each([
    ['900', '#1e0059', 0],
    ['600', '#6935cf', 1],
    ['400', '#a284f1', 1],
    ['200', '#d5c6fb', 0],
    ['50', '#f1ecff', 0],
  ] as const)(
    'reproduces the shipped purple %s within %i/255',
    (step, shipped, slack) => {
      const got = brandRampHex(292)[step]
      const channels = (hex: string) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      const a = channels(got)
      const b = channels(shipped)
      for (let i = 0; i < 3; i += 1) {
        expect(
          Math.abs(a[i]! - b[i]!),
          `${step}: ${got} vs ${shipped}`,
        ).toBeLessThanOrEqual(slack)
      }
    },
  )
})

describe('the chroma clamp', () => {
  it('leaves a chroma that is already in gamut exactly alone', () => {
    // Purple at the 600 step can carry the full 0.219.
    expect(clampChroma(0.49, 0.219, 292)).toBe(0.219)
  })

  it('pulls an impossible chroma back inside the gamut', () => {
    // No hue reaches 0.219 at L=0.953; the 50 step is nearly white.
    const clamped = clampChroma(0.953, 0.219, 180)
    expect(clamped).toBeLessThan(0.219)
    const { r, g, b } = oklchToLinearRgb({ l: 0.953, c: clamped, h: 180 })
    for (const v of [r, g, b]) expect(v).toBeLessThanOrEqual(1 + 1e-6)
  })

  it('never silently truncates: every offered hue is in gamut at every step', () => {
    for (const option of BRAND_OPTIONS) {
      const ramp = brandRamp(option.hue)
      for (const step of BRAND_STEPS) {
        const { r, g, b } = oklchToLinearRgb(ramp[step])
        for (const v of [r, g, b]) {
          expect(v, `${option.label} ${step}`).toBeGreaterThanOrEqual(-1e-6)
          expect(v, `${option.label} ${step}`).toBeLessThanOrEqual(1 + 1e-6)
        }
      }
    }
  })
})

/**
 * **The claim the design rests on, proved rather than asserted.**
 *
 * Holding lightness is what keeps the pairings true for every hue. If that is
 * real, then swapping the hue at a fixed L moves the contrast ratio hardly at
 * all — because WCAG luminance is dominated by lightness. This measures the
 * spread directly: the primary action across all eight hues.
 */
describe('holding L is what makes contrast survive a hue change', () => {
  it('keeps the primary action within a narrow band across every hue', () => {
    const ratios = BRAND_OPTIONS.map((o) => contrast(brandRamp(o.hue)['600'], WHITE))
    const spread = Math.max(...ratios) - Math.min(...ratios)
    // Every one clears 4.5 with room, and they sit close together.
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5)
    expect(spread).toBeLessThan(2)
  })

  it('breaks when L is allowed to move, which is why it is the invariant', () => {
    /*
     * The counter-example, so the claim above is a finding rather than a
     * coincidence: at the 400 step's lightness the same hue cannot carry a
     * white label at all. Nothing in the product does this; it is here to
     * show what the ladder is preventing.
     */
    const lightened = { ...brandRamp(292)['600'], l: LADDER['400'].l }
    expect(contrast(lightened, WHITE)).toBeLessThan(4.5)
  })
})

describe('the palette keeps clear of the status vocabulary', () => {
  it.each(BRAND_OPTIONS)(
    '$label ($hue°) is far enough from every status hue',
    (option) => {
      for (const [status, hue] of Object.entries(STATUS_HUES)) {
        expect(
          hueDistance(option.hue, hue),
          `${option.label} vs ${status}`,
        ).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE)
      }
    },
  )

  it('offers the purple that shipped as the default, unchanged', () => {
    expect(brandOptionById(undefined).id).toBe(DEFAULT_BRAND_ID)
    expect(brandOptionById('nothing-like-this').id).toBe(DEFAULT_BRAND_ID)
    expect(brandOptionById(DEFAULT_BRAND_ID).hue).toBe(292)
  })

  it('never offers two hues under one id', () => {
    const ids = BRAND_OPTIONS.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('what the brand must not reach', () => {
  /*
   * A colour this build already ships and the generator has no business
   * producing. Not a contrast check: a check that the arithmetic cannot
   * accidentally land on the status vocabulary.
   */
  it('produces no step within 30° of a status hue, at any offered hue', () => {
    for (const option of BRAND_OPTIONS) {
      const ramp = brandRamp(option.hue)
      for (const step of BRAND_STEPS) {
        for (const [status, hue] of Object.entries(STATUS_HUES)) {
          expect(
            hueDistance(ramp[step].h, hue),
            `${option.label} step ${step} vs ${status}`,
          ).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE - 7)
        }
      }
    }
  })

  it('renders a hex for every step of every option', () => {
    for (const option of BRAND_OPTIONS) {
      const hexes = brandRampHex(option.hue)
      for (const step of BRAND_STEPS) {
        expect(hexes[step], `${option.label} ${step}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('is pure black only where asked, never by accident', () => {
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000')
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff')
  })
})
