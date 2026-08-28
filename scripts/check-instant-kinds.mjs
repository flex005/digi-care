#!/usr/bin/env node
/**
 * A date widened into an instant must be widened for arithmetic, never for a
 * screen.
 *
 * **This exists because the §8 entry did not work.** "Before applying any
 * transformation to a timestamp, say out loud what kind of instant it is" has
 * been in CLAUDE.md since Phase 7, and the class has landed three times since:
 *
 *   1. `after()` clamping `dueBy`, dragging every review flag to now.
 *   2. `filedOn` widened to midnight and rendered through the site's zone,
 *      printing "02/10/2025 01:00 BST" — an hour nobody recorded.
 *   3. A review's `dueOn` widened the same way on the Dashboard, printing
 *      "01:00 BST" against every overdue review on the screen.
 *
 * Three tries. The note becomes a rule.
 *
 * ## What it flags, and why that shape
 *
 * `new Date(`${day}T00:00:00Z`)` is arithmetic — a day turned into a number so
 * something can be added to it — and it is fine. Every legitimate use in this
 * repository has that shape.
 *
 * What is not fine is the same string kept as a value: assigned to a field,
 * returned, or cast to `IsoDateTime`. That is a date pretending to be an
 * instant, and the next thing that happens to it is a formatter rendering a
 * midnight nobody recorded.
 *
 *     const at = `${dueOn}T00:00:00.000Z` as IsoDateTime   ← flagged
 *     const date = new Date(`${dueOn}T00:00:00.000Z`)      ← arithmetic, fine
 *
 * ## The escape hatch
 *
 * A comparison key is a real reason to build one — a sort has to put dates and
 * instants in one order somehow. Say so on the line above:
 *
 *     // instant-ok: a sort key, never rendered
 *
 * Per-site, with a reason, and the count is printed so it cannot quietly grow.
 */
import { readFileSync, globSync } from 'node:fs'

/** Midnight, end of day, or any other invented time appended to a date. */
const WIDENING = /`\$\{[^`]*\}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z?`/g

const OPT_OUT = /\/\/\s*instant-ok:\s*\S/

const files = globSync('src/**/*.{ts,tsx}').filter((file) => !file.includes('.test.'))

const findings = []
let optOuts = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  for (const match of source.matchAll(WIDENING)) {
    const index = match.index
    if (index === undefined) continue

    const line = source.slice(0, index).split('\n').length - 1

    /*
     * Arithmetic: the widened string is consumed by `new Date(` on the same
     * line. Line-based rather than character-based because the legitimate
     * shape is sometimes a ternary inside the call — `new Date(at.length === 10
     * ? \`${at}T00:00:00.000Z\` : at)` — and a lookbehind of a few characters
     * reports that as a value.
     */
    if ((lines[line] ?? '').includes('new Date(')) continue
    /*
     * Three lines back, because the reason is often a two-line comment and the
     * widening is often the line after the declaration it belongs to. Wider
     * than that and an unrelated opt-out three statements away would silence
     * this one.
     */
    const nearby = [lines[line], lines[line - 1], lines[line - 2], lines[line - 3]]
    if (nearby.some((candidate) => OPT_OUT.test(candidate ?? ''))) {
      optOuts += 1
      continue
    }

    findings.push(`${file}:${line + 1}  ${(lines[line] ?? '').trim()}`)
  }
}

if (findings.length > 0) {
  console.error(
    '✖ instant kinds — a date is being widened into an instant as a value.\n' +
      '  A date has no time, and the invented one reaches a formatter as a\n' +
      '  midnight nobody recorded. Keep the date, or widen it inside `new Date(`\n' +
      '  for arithmetic, or write `// instant-ok: <why>`.\n',
  )
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}

console.log(
  '✓ instant kinds — no date is widened into an instant as a value' +
    (optOuts > 0 ? ` (${optOuts} deliberate)` : ''),
)
