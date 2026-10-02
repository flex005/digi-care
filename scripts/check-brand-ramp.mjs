/**
 * Every offered brand hue generates a ramp that passes every pairing.
 *
 * **An option that fails cannot ship, and adding one later cannot ship
 * inaccessible either.** That second half is the point: a palette is the kind
 * of thing somebody extends six months later by copying a line, and a hue that
 * cannot carry 4.5:1 on its primary action looks exactly like one that can
 * until somebody measures it.
 *
 * **It imports `src/lib/brand.ts` rather than restating the arithmetic.** §8
 * records the Dashboard helper that reproduced the fixture generator's maths
 * faithfully except for one clamp, and produced two counts of the same doses
 * minutes apart — a copied formula is a second rule even when it was copied
 * correctly, because the original is still free to move. Node strips the types
 * and runs the module the product runs.
 *
 * **The pairings are jobs, not a generic contrast sweep.** Each one names what
 * breaks: a white label on the primary action, body text on a selected row's
 * tint, a chart series against the surface it is drawn on. A single "check
 * contrast" over the ramp would pass a 50 step that no text ever sits on and
 * miss the 200 step that all of it does.
 *
 * Run: npm run lint:brand
 */
import { readFileSync } from 'node:fs'
import {
  BRAND_OPTIONS,
  WHITE,
  contrast,
  BRAND_STEPS,
  LADDER,
  MIN_HUE_DISTANCE,
  PAIRINGS,
  STATUS_HUES,
  brandRamp,
  checkPairings,
  hueDistance,
  oklchToLinearRgb,
} from '../src/lib/brand.ts'

const findings = []

/* ---- 1. Every pairing, for every offered hue. ---- */

let checked = 0
let worst = { ratio: Infinity, id: '', hue: 0, min: 0, job: '' }

for (const option of BRAND_OPTIONS) {
  for (const result of checkPairings(option.hue)) {
    checked += 1
    /*
     * The worst is tracked against its own threshold rather than in absolute
     * terms, because a 3.0 pairing at 3.4 is tighter than a 4.5 pairing at
     * 4.6 — and the number that matters is how much room is left.
     */
    if (result.ratio - result.min < worst.ratio - worst.min) {
      worst = {
        ratio: result.ratio,
        id: result.id,
        hue: option.hue,
        min: result.min,
        job: result.job,
      }
    }
    if (!result.passes) {
      findings.push({
        what: `${option.label} (${String(option.hue)}°) fails ${result.id}`,
        why: `${result.ratio.toFixed(2)}:1 against a floor of ${String(result.min)}:1 — ${result.job}.`,
      })
    }
  }
}

/* ---- 2. Nothing in gamut-clamped output may be out of gamut. ---- */

for (const option of BRAND_OPTIONS) {
  const ramp = brandRamp(option.hue)
  for (const step of BRAND_STEPS) {
    const { r, g, b } = oklchToLinearRgb(ramp[step])
    for (const [channel, value] of Object.entries({ r, g, b })) {
      if (value < -1e-6 || value > 1 + 1e-6) {
        findings.push({
          what: `${option.label} (${String(option.hue)}°) step ${step} is out of gamut`,
          why: `linear ${channel} = ${value.toFixed(4)}; the chroma clamp did not hold, so the hex is a silent truncation of a colour sRGB cannot show.`,
        })
      }
    }
  }
}

/* ---- 3. The chart series, measured on whichever step the charts use. ---- */

/*
 * **Read from the stylesheet, not restated here.** `--brand-400` carried the
 * comment "Secondary accent, chart series, hover" and no chart uses it — every
 * series, axis and legend swatch is `--brand-600`. A pairing written from that
 * comment measures a step nothing plots with, and at L=0.687 no hue reaches
 * 3:1 on white, so it fails for every option including the purple that has
 * shipped for thirty phases. It would have read as a palette problem and been
 * a stale sentence.
 *
 * So the step comes from the file that draws. Moving the charts onto a lighter
 * step fails here rather than going quiet.
 */
const chartCss = readFileSync(
  new URL('../src/features/dashboard/charts.module.css', import.meta.url),
  'utf8',
)
const chartSteps = [
  ...new Set([...chartCss.matchAll(/var\(--brand-(\d+)\)/g)].map((m) => m[1])),
]
if (chartSteps.length === 0) {
  findings.push({
    what: 'the charts reference no brand step',
    why: 'This check would measure nothing and print a tick over a chart drawn in some other colour.',
  })
}
for (const option of BRAND_OPTIONS) {
  const ramp = brandRamp(option.hue)
  for (const step of chartSteps) {
    const ratio = contrast(ramp[step], WHITE)
    checked += 1
    if (ratio < 3) {
      findings.push({
        what: `${option.label} (${String(option.hue)}°) chart series at --brand-${step} is ${ratio.toFixed(2)}:1 on white`,
        why: 'WCAG 1.4.11 wants 3:1 for a graphical object somebody has to read a value off.',
      })
    }
  }
}

/* ---- 4. Every offered hue stays clear of the status hues. ---- */

for (const option of BRAND_OPTIONS) {
  for (const [status, hue] of Object.entries(STATUS_HUES)) {
    const distance = hueDistance(option.hue, hue)
    if (distance < MIN_HUE_DISTANCE) {
      findings.push({
        what: `${option.label} (${String(option.hue)}°) is ${String(Math.round(distance))}° from ${status} (${String(hue)}°)`,
        why: `The floor is ${String(MIN_HUE_DISTANCE)}°, which is how far the shipped purple sits from info — a distance this product has demonstrated rather than guessed.`,
      })
    }
  }
}

/* ---- 5. The ladder holds its lightness, which is the whole argument. ---- */

for (const option of BRAND_OPTIONS) {
  const ramp = brandRamp(option.hue)
  for (const step of BRAND_STEPS) {
    if (Math.abs(ramp[step].l - LADDER[step].l) > 1e-9) {
      findings.push({
        what: `${option.label} (${String(option.hue)}°) step ${step} moved off the ladder`,
        why: `L is ${ramp[step].l.toFixed(3)} where the ladder says ${LADDER[step].l.toFixed(3)}. Lightness is the invariant; moving it is what breaks every pairing at once.`,
      })
    }
  }
}

if (findings.length > 0) {
  console.error(
    `✖ brand ramp — ${String(findings.length)} problem(s) across ` +
      `${String(BRAND_OPTIONS.length)} offered hue(s):\n`,
  )
  for (const f of findings) {
    console.error(`  ${f.what}`)
    console.error(`    ${f.why}\n`)
  }
  console.error(
    `  Hold L, swap H, clamp C. A hue that cannot carry a pairing is not one to` +
      `\n  raise the chroma for — the clamp pulls it straight back and the ramp then` +
      `\n  lies about what it asked for. It is a hue to leave out of BRAND_OPTIONS.\n`,
  )
  process.exit(1)
}

/*
 * The count and the tightest margin, rather than a tick: a number that falls
 * is a regression somebody can see, and the worst pairing is the one that
 * decides whether the next hue can be added at all.
 */
console.log(
  `✓ brand ramp — ${String(BRAND_OPTIONS.length)} hue(s) × ${String(PAIRINGS.length)} pairing(s) ` +
    `= ${String(checked)} measured, all in gamut, all ≥ ${String(MIN_HUE_DISTANCE)}° from every status hue. ` +
    `Tightest: ${worst.id} at ${worst.hue}° with ${worst.ratio.toFixed(2)}:1 against a ` +
    `${String(worst.min)}:1 floor (${worst.job}). It measures the generated ramp; what a ` +
    `component then composes on top of it — an opacity, a blend — it cannot see.`,
)
