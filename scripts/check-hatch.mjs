#!/usr/bin/env node
/**
 * Guard the single definition of the unrecorded treatment.
 *
 * Stylelint enforces that colour comes only from tokens, but it cannot tell a
 * hand-rolled hatch from a legitimate gradient. The unrecorded treatment is
 * the most load-bearing visual in the product — Rule 2 of the Evidence
 * Invariant — and a second, slightly-different copy of it is exactly the kind
 * of drift that survives review.
 *
 * So: `repeating-linear-gradient` and the dashed unrecorded border may appear
 * in src/styles/unrecorded.module.css and nowhere else. Everything else
 * reaches it with `composes:`.
 *
 * **The hatch has a second medium, and this now covers it.** A chart area and
 * an arc stroke cannot take a CSS background, so the Dashboard's charts fill
 * them with an SVG `<pattern>` — declared inside each chart's own `<svg>`, one
 * definition in the source and one per chart in the document, because a
 * `url(#…)` crossing two `<svg>` elements resolves in a browser and nowhere
 * else — which this script could not see, because it
 * only ever read .css files. One definition in each medium: the gradient in
 * styles/unrecorded.module.css, the pattern in features/dashboard/charts.tsx.
 * A second `<pattern>` anywhere is the same drift the CSS half exists to stop,
 * and it would have shipped unnoticed.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const CANONICAL = path.join(SRC, 'styles/unrecorded.module.css')
/** The one place the hatch is declared as an SVG pattern. */
const CANONICAL_SVG = path.join(SRC, 'features/dashboard/charts.tsx')

const SKIP_DIRECTORIES = new Set(['node_modules', 'assets', 'dist', 'coverage'])

/**
 * A line that is prose rather than code.
 *
 * The guard used to match the string anywhere, so a docblock *explaining* why
 * the hatch has one owner counted as a second declaration of it. A guard that
 * fires on its own documentation teaches people to word around it, which is
 * how the next real copy gets in under a comment.
 */
const COMMENT = /^\s*(\/\*|\*|\/\/)/

const FORBIDDEN = [
  {
    // A declaration, not a mention.
    pattern: /^\s*background(-image)?:\s*repeating-linear-gradient/,
    what: 'the diagonal hatch',
  },
  {
    pattern: /dashed\s+var\(--border-unrecorded\)/,
    what: 'the dashed unrecorded border',
  },
  {
    pattern: /--status-unrecorded-tint/,
    what: 'the unrecorded tint',
  },
]

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(css|tsx|ts)$/.test(entry.name)) {
      yield full
    }
  }
}

/** The SVG half: a hatch pattern declared anywhere but the one component. */
const FORBIDDEN_SVG = [
  { pattern: /<pattern[\s>]/, what: 'an SVG hatch pattern' },
  { pattern: /patternUnits|patternTransform/, what: 'an SVG hatch pattern' },
]

/**
 * How many gradient declarations the owner file is allowed.
 *
 * **Two, and the number is the point.** One bands `--status-unrecorded-tint`
 * for boxes — cells, chips, panels, tiles — where the treatment covers enough
 * area to read as texture. One bands `--status-unrecorded` for chart regions
 * 7–20px tall, where the tint measures 1.12:1 against the surface and a hatch
 * nobody can see is a solid neutral fill: the one thing Rule 2 says this must
 * never become, in the direction that hides a gap.
 *
 * This is not the guard weakening. Two sizes in one file is one owner; a copy
 * in a feature stylesheet is drift, and that is still a finding.
 */
const OWNER_GRADIENTS = 2
/** A declaration, not a mention. The docblocks name the property in prose. */
const GRADIENT_DECLARATION = /^\s*background:\s*repeating-linear-gradient\(/

const findings = []

for await (const file of walk(SRC)) {
  const isStyle = file.endsWith('.css')
  if (file === CANONICAL || file === CANONICAL_SVG) continue
  // tokens.css declares the tokens; it does not apply the treatment.
  if (file === path.join(SRC, 'styles/tokens.css')) continue
  // A test may name the pattern to assert a chart fills with it.
  if (/\.test\.tsx?$/.test(file)) continue

  const rules = isStyle ? FORBIDDEN : FORBIDDEN_SVG
  const lines = (await readFile(file, 'utf8')).split('\n')
  lines.forEach((line, index) => {
    if (COMMENT.test(line)) return
    for (const { pattern, what } of rules) {
      if (pattern.test(line)) {
        findings.push({
          file: path.relative(ROOT, file),
          line: index + 1,
          what,
          text: line.trim(),
        })
      }
    }
  })
}

const ownerGradients = (await readFile(CANONICAL, 'utf8'))
  .split('\n')
  .filter((line) => GRADIENT_DECLARATION.test(line)).length

if (ownerGradients !== OWNER_GRADIENTS) {
  console.error(
    `\n\u2716 hatch: ${path.relative(ROOT, CANONICAL)} declares ${ownerGradients} gradient` +
      `${ownerGradients === 1 ? '' : 's'}, expected ${OWNER_GRADIENTS}.\n`,
  )
  console.error(
    '  There are two on purpose, and the second is not a relaxation:',
    '\n    .unrecorded      — bands --status-unrecorded-tint, 1.12:1, for boxes.',
    '\n                       Correct across 170px, invisible across 7px.',
    '\n    .unrecordedChart — bands --status-unrecorded, 3.43:1, for chart',
    '\n                       regions 7-20px tall. Clears WCAG 1.4.11 (3:1).',
    '\n',
    '\n  A hatch nobody can see is a solid neutral fill, which Rule 2 forbids —',
    '\n  so one size cannot serve both. Two sizes in one file is one owner.',
    '\n  A third means a size nobody has justified; a copy in a feature',
    '\n  stylesheet is drift and is reported separately above.',
    '\n  PRD \u00a74.5, CLAUDE.md \u00a71.\n',
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    `\n✖ hatch: the unrecorded treatment is defined in ${findings.length === 1 ? 'a second place' : 'other places'}.\n`,
  )
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.what}`)
    console.error(`      ${finding.text}`)
  }
  console.error(
    '\n  There is one definition per medium:',
    '\n    CSS — src/styles/unrecorded.module.css, reached with',
    "\n          composes: unrecorded from '…/styles/unrecorded.module.css';",
    '\n          and rendered through <Unrecorded label="…" />, which requires the text.',
    '\n    SVG — src/features/dashboard/charts.tsx, reached with url(#…) from HATCH.',
    '\n  PRD §4.5, CLAUDE.md §1.\n',
  )
  process.exit(1)
}

console.log(
  `\u2713 hatch — one owner per medium: ${OWNER_GRADIENTS} CSS sizes in one file, ` +
    'one SVG pattern in one component',
)
