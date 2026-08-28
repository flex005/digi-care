#!/usr/bin/env node
/**
 * Every store holding session state is on the sign-out loss list.
 *
 * Signing out is the only action in this build that destroys work rather than
 * failing to save it, and the confirmation names what would go item by item so
 * a reader can check it against what is actually there. That promise breaks
 * silently the moment a thirteenth store is written: the new work is destroyed
 * with the rest and the confirmation never mentions it, which is worse than the
 * vague sentence the itemised list replaced, because now it looks complete.
 *
 * A store holds session state if it declares a module-level mutable collection
 * — an array, a Map or a Set that something pushes to, sets or clears. Those
 * are asked here, and the file that must ask them is `session-losses.ts`.
 *
 * `// losses-ok: <why>` opts a file out. The count is printed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'src/data/access'
const OWNER = join(DIR, 'session-losses.ts')

/** A module-level `const x: T[] = []`, `new Map()`, `new Set()`, or `let n = 0`. */
const MUTABLE = /^(?:const|let) (\w+)(?:: [^=]+)? = (?:\[\]|new Map|new Set|0\b)/

const owner = readFileSync(OWNER, 'utf8')
const findings = []
let deliberate = 0

for (const file of readdirSync(DIR).sort()) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
  if (file === 'session-losses.ts' || file === 'session-holding.ts') continue

  const source = readFileSync(join(DIR, file), 'utf8')
  if (source.includes('// losses-ok:')) {
    deliberate += 1
    continue
  }

  const lines = source.split('\n')
  const holds = lines.some((line) => MUTABLE.test(line))
  if (!holds) continue

  // Asked by name, so a store cannot satisfy this by being imported for
  // something else — the loss list has to call it.
  const asked = new RegExp(`from '\\./${file.replace(/\.ts$/, '')}'`).test(owner)
  if (!asked) findings.push(file)
}

if (findings.length > 0) {
  console.error(
    '\n\u2716 session losses: a store holds work the sign-out screen never mentions.\n',
  )
  for (const file of findings) {
    console.error(
      `  ${join(DIR, file)} — holds session state and is not asked by session-losses.ts`,
    )
  }
  console.error(`
  Signing out destroys everything in memory. The confirmation names what would
  go item by item so it can be checked; a store missing from it is work that
  disappears without warning under a list that looks complete.

  Export a \`…Holdings(): SessionHolding[]\` and a \`resetSession…()\`, and add both
  to session-losses.ts. Or \`// losses-ok: <why>\` if it genuinely holds nothing.
  CLAUDE.md §8.
`)
  process.exit(1)
}

console.log(
  `\u2713 session losses — every store holding session state is on the list (${deliberate} deliberate)`,
)
