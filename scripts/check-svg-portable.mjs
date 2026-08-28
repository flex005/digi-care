#!/usr/bin/env node
/**
 * Every SVG is drawn as geometry that stands on its own.
 *
 * The screen and the exported file have to be the same picture. Two shapes of
 * SVG render correctly in a browser and become something else the moment
 * anything reads the markup instead of rasterising it — a design-tool importer,
 * an SVG optimiser, a PDF pipeline:
 *
 *   1. **A paint server declared in one `<svg>` and referenced from another.**
 *      Ids are document-wide, so `url(#hatch)` resolves in a browser. A reader
 *      taking one `<svg>` as a standalone document finds a fill pointing at
 *      nothing and falls back to solid — which is how the hatch, the one
 *      treatment in this product that means "nobody recorded this", exported as
 *      a solid bar meaning the opposite.
 *
 *   2. **An arc faked with `stroke-dasharray` on a full circle.** Nothing in
 *      the markup says where the arc starts or ends, only how long the painted
 *      run is. A reader repeats the dash, because that is what it says, and the
 *      chart arrives in pieces. It also hides arithmetic: the 0–100 dash
 *      convention is only a percentage at one specific radius, and the rings
 *      copied the convention without it for a phase.
 *
 * `// svg-ok: <why>` opts out per file. The count is printed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'src'
const findings = []
let deliberate = 0

/** Elements that put ink on the page, as opposed to declaring paint. */
const DRAWS =
  /<(path|circle|rect|line|polyline|polygon|ellipse|text|g|use|image|foreignObject)[\s/>]/

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!full.endsWith('.tsx') || full.includes('.test.')) continue
    check(full)
  }
}

function check(file) {
  const source = readFileSync(file, 'utf8')
  if (source.includes('// svg-ok:')) {
    deliberate += 1
    return
  }

  const lines = source.split('\n')

  // 1 — an arc drawn as a dash.
  lines.forEach((line, index) => {
    if (/strokeDashoffset/.test(line)) {
      findings.push({
        file,
        line: index + 1,
        text: line.trim(),
        why: 'an arc drawn as a dash offset. Draw it as a path: M…A…',
      })
    }
  })

  // 2 — an <svg> that declares paint and draws nothing, so every reference to
  // it has to cross an element boundary.
  const svgBlocks = source.matchAll(/<svg[\s>][\s\S]*?<\/svg>/g)
  for (const block of svgBlocks) {
    const body = block[0]
    if (!/<defs[\s>]/.test(body)) continue
    const afterDefs = body.replace(/<defs[\s>][\s\S]*?<\/defs>/g, '')
    if (DRAWS.test(afterDefs)) continue
    findings.push({
      file,
      line: source.slice(0, block.index).split('\n').length,
      text: '<svg> containing only <defs>',
      why: 'paint declared where nothing draws, so every use of it crosses an <svg> boundary. Declare it inside the chart that fills with it.',
    })
  }
}

walk(SRC)

if (findings.length > 0) {
  console.error('\n✖ portable svg: a chart renders as something else once exported.\n')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`)
    console.error(`      ${finding.text}`)
    console.error(`      ${finding.why}\n`)
  }
  console.error(`  The screen and the exported file have to be the same picture.
  A hatch that falls back to solid says a gap was recorded, which is the one
  thing this product exists to prevent. CLAUDE.md §8.
`)
  process.exit(1)
}

console.log(
  `✓ portable svg — every chart draws geometry that stands alone (${deliberate} deliberate)`,
)
