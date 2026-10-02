/**
 * The brand ramp: five steps generated from one hue angle.
 *
 * **Hold L, swap H, clamp C.** Every step keeps the lightness the purple ramp
 * was designed at, takes the organisation's hue, and asks for the purple's
 * chroma at that step — clamped down to whatever the sRGB gamut actually
 * allows at that lightness and hue.
 *
 * **Chroma cannot be held constant across hues, and that is the trade rather
 * than a defect to fix.** sRGB is not a cylinder: at L=0.490 a purple reaches
 * C=0.219 and a teal does not come close, so a teal ramp is visibly less vivid
 * than the purple one. The alternative is to let L move so the chroma can
 * stay, and that breaks every contrast pairing at once — a primary button
 * whose white label fails 4.5:1 on some organisations and passes on others.
 * **So lightness is the invariant and chroma is the thing that gives.** Do not
 * "fix" a flat-looking ramp by raising the chroma targets; that pushes the
 * value out of gamut, `clampChroma` pulls it straight back, and the only
 * effect is a ramp that lies about what it asked for.
 *
 * Nothing here reads a token or touches the DOM. `applyBrand` in
 * `brand-store.ts` is what sets the custom properties; this is the arithmetic,
 * and `scripts/check-brand-ramp.mjs` imports **this module** rather than
 * restating it, because §8 records that a copied formula is a second rule even
 * when it was copied correctly.
 */

/** A colour in OKLCH. `h` is degrees. */
export interface Oklch {
  l: number
  c: number
  h: number
}

/* -------------------------------------------------------------------------
   OKLCH → sRGB, and the luminance WCAG contrast is defined on.
   ------------------------------------------------------------------------- */

interface LinearRgb {
  r: number
  g: number
  b: number
}

/** OKLCH to linear-light sRGB. Björn Ottosson's matrices, unmodified. */
export function oklchToLinearRgb({ l, c, h }: Oklch): LinearRgb {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return {
    r: 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    g: -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    b: -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  }
}

/** Is every channel inside the gamut? A hair of tolerance for float error. */
function inGamut({ r, g, b }: LinearRgb): boolean {
  const ok = (v: number) => v >= -1e-6 && v <= 1 + 1e-6
  return ok(r) && ok(g) && ok(b)
}

const gammaEncode = (v: number): number =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055

const toByte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255)

export function oklchToHex(colour: Oklch): string {
  const { r, g, b } = oklchToLinearRgb(colour)
  const hex = (v: number) => toByte(gammaEncode(v)).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * The largest chroma at this L and H that sRGB can actually show.
 *
 * Bisection rather than an analytic solve: the gamut boundary in OKLCH has no
 * closed form, and 24 halvings land well inside a 1/255 step. Returns the
 * requested chroma untouched when it is already in gamut, so a hue that can
 * carry the purple's chroma keeps it exactly.
 */
export function clampChroma(l: number, c: number, h: number): number {
  if (inGamut(oklchToLinearRgb({ l, c, h }))) return c
  let low = 0
  let high = c
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    if (inGamut(oklchToLinearRgb({ l, c: mid, h }))) low = mid
    else high = mid
  }
  return low
}

/**
 * Relative luminance, WCAG 2.2 §1.4.3.
 *
 * Takes the linear-light values straight from the OKLCH conversion rather than
 * re-deriving them from a hex: a round trip through eight bits per channel
 * moves a ratio in the third decimal place, and the pairings below are checked
 * against a threshold where that is the difference between shipping and not.
 */
function luminance(colour: Oklch): number {
  const { r, g, b } = oklchToLinearRgb(colour)
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b)
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. */
export function contrast(a: Oklch, b: Oklch): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/* -------------------------------------------------------------------------
   The ladder.
   ------------------------------------------------------------------------- */

export type BrandStep = '900' | '600' | '400' | '200' | '50'

export const BRAND_STEPS = ['900', '600', '400', '200', '50'] as const

/**
 * The five steps, measured off the shipped purple ramp.
 *
 * `l` and `c` are that step's lightness and its *requested* chroma. `hueOffset`
 * is how far that step's hue sits from the ramp's nominal hue — the purple ramp
 * drifts from 285° at the darkest step to 298° at the lightest, and keeping
 * those offsets means a teal ramp has the same internal shape rather than
 * being five flat samples of one angle.
 *
 * The nominal hue is the 600 step's, because that is the primary action and the
 * one a reader would name if asked what colour the product is.
 */
export const LADDER: Record<BrandStep, { l: number; c: number; hueOffset: number }> = {
  '900': { l: 0.233, c: 0.136, hueOffset: -7 },
  '600': { l: 0.49, c: 0.219, hueOffset: 0 },
  '400': { l: 0.687, c: 0.158, hueOffset: 3 },
  '200': { l: 0.856, c: 0.074, hueOffset: 6 },
  '50': { l: 0.953, c: 0.026, hueOffset: 6 },
}

export type BrandRamp = Record<BrandStep, Oklch>

/** The five steps for one hue, each clamped into gamut at its own lightness. */
export function brandRamp(hue: number): BrandRamp {
  const out = {} as BrandRamp
  for (const step of BRAND_STEPS) {
    const { l, c, hueOffset } = LADDER[step]
    const h = (((hue + hueOffset) % 360) + 360) % 360
    out[step] = { l, c: clampChroma(l, c, h), h }
  }
  return out
}

export function brandRampHex(hue: number): Record<BrandStep, string> {
  const ramp = brandRamp(hue)
  const out = {} as Record<BrandStep, string>
  for (const step of BRAND_STEPS) out[step] = oklchToHex(ramp[step])
  return out
}

/* -------------------------------------------------------------------------
   The two grounds every pairing is measured against.
   ------------------------------------------------------------------------- */

/** `--bg-surface`, #ffffff: cards, tables, drawers, dialogs. */
export const WHITE: Oklch = { l: 1, c: 0, h: 0 }

/**
 * `--ink-900`, the body text neutral.
 *
 * Held here as OKLCH so the pairings are computed rather than read back out of
 * a hex. It is a **neutral**, not a brand value, and that is the point: body
 * text does not move when an organisation picks a hue.
 */
export const INK: Oklch = { l: 0.233, c: 0, h: 0 }

/* -------------------------------------------------------------------------
   The palette offered, by hue angle.
   ------------------------------------------------------------------------- */

/**
 * The status hues this palette stays away from, in degrees.
 *
 * Named here so the exclusion is checkable rather than implied by a colour
 * name: "teal" tells a script nothing about whether it collides with positive.
 */
export const STATUS_HUES: Record<string, number> = {
  critical: 24,
  caution: 54,
  positive: 144,
  info: 262,
}

/**
 * How far a brand hue must stay from a status hue.
 *
 * **30° is demonstrated rather than guessed.** The shipped purple sits at 292°,
 * which is exactly 30° from info at 262°, and it has been the primary action
 * for thirty-odd phases without anybody mistaking a primary button for an info
 * pill. So the distance is one this product has already proved at its tightest
 * point.
 */
export const MIN_HUE_DISTANCE = 30

/** Shortest angular distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}

export interface BrandOption {
  id: string
  label: string
  hue: number
}

/**
 * The offered hues.
 *
 * Three bands survive the exclusion: roughly 174°–232° (teals through azure),
 * 292°–354° (purple through magenta and pink), and a narrow 84°–114°. The
 * default is 292°, which is the purple that has always shipped — so an
 * organisation that chooses nothing sees exactly what it saw before.
 *
 * `--status-unrecorded` sits at 296° and is deliberately not treated as a
 * collision: at C=0.026 it reads as grey, and the hatch it draws is a texture
 * rather than a hue.
 */
export const BRAND_OPTIONS: BrandOption[] = [
  { id: 'purple', label: 'Purple', hue: 292 },
  { id: 'magenta', label: 'Magenta', hue: 316 },
  { id: 'pink', label: 'Pink', hue: 340 },
  { id: 'teal', label: 'Teal', hue: 178 },
  { id: 'sea', label: 'Sea', hue: 196 },
  { id: 'azure', label: 'Azure', hue: 214 },
  { id: 'blue', label: 'Blue', hue: 230 },
  { id: 'olive', label: 'Olive', hue: 100 },
]

export const DEFAULT_BRAND_ID = 'purple'

export function brandOptionById(id: string | undefined): BrandOption {
  return BRAND_OPTIONS.find((option) => option.id === id) ?? BRAND_OPTIONS[0]!
}

/* -------------------------------------------------------------------------
   The pairings. Each is a job, not a generic "check contrast".
   ------------------------------------------------------------------------- */

export interface Pairing {
  id: string
  /** Which step carries the colour. */
  step: BrandStep
  /** What it is measured against. */
  against: 'white' | 'ink' | '900'
  min: number
  /** What breaks if it fails. */
  job: string
}

export const PAIRINGS: Pairing[] = [
  {
    id: 'primary-action',
    step: '600',
    against: 'white',
    min: 4.5,
    job: 'the primary action, which carries a white label',
  },
  {
    id: 'dark-fill',
    step: '900',
    against: 'white',
    min: 4.5,
    job: 'dark fills with white text on them',
  },
  {
    id: 'selected-row',
    step: '200',
    against: 'ink',
    min: 4.5,
    job: 'a selected row, where body text sits on the tint',
  },
  {
    id: 'tinted-card',
    step: '50',
    against: 'ink',
    min: 4.5,
    job: 'a tinted card, where body text sits on the tint',
  },
  {
    id: 'focus-ring',
    step: '600',
    against: 'white',
    min: 3,
    job: 'the focus ring, WCAG 1.4.11 non-text contrast',
  },
  {
    id: 'panel-micro-text',
    step: '400',
    against: '900',
    min: 4.5,
    job: "the sign-in panel's footer text, which sits on the deep brand fill",
  },
]

/*
 * **The chart series is checked by `check-brand-ramp.mjs`, not listed here,
 * and the reason is that this list was nearly wrong about it.** `--brand-400`
 * carried the comment "Secondary accent, chart series, hover" and **no chart
 * uses it** — every series, axis and legend swatch draws at `--brand-600`.
 * A pairing written from that comment would have measured a step nothing
 * plots with, and failed: at L=0.687 no hue reaches 3:1 on white, so it would
 * have read as a palette problem when it was a stale sentence.
 *
 * So the script reads `charts.module.css` and measures whichever steps the
 * charts actually reference. That is the §8 rule about asserting through the
 * thing itself rather than a hand-written approximation of it — and here the
 * approximation was four hundred lines away in a token comment.
 */

export interface PairingResult extends Pairing {
  hue: number
  ratio: number
  passes: boolean
}

/** Every pairing for one hue, measured. */
export function checkPairings(hue: number): PairingResult[] {
  const ramp = brandRamp(hue)
  return PAIRINGS.map((pairing) => {
    /*
     * '900' is the one ground that moves with the hue: light brand text on the
     * deep brand fill is the same ramp twice, so it has to be measured per hue
     * rather than against a fixed colour.
     */
    const ground =
      pairing.against === 'white'
        ? WHITE
        : pairing.against === 'ink'
          ? INK
          : ramp['900']
    const ratio = contrast(ramp[pairing.step], ground)
    return { ...pairing, hue, ratio, passes: ratio >= pairing.min }
  })
}
