/**
 * A component that calls a write asks whether this viewer may.
 *
 * **Why this exists.** Permission enforcement in this product is UI-only. No
 * store checks a level, the shell refuses a module only at `no_access`, and
 * the auditor's baseline is `read` — so a control on screen with nothing in
 * front of it *is* an unguarded write. Before the sweep this guard was written
 * for, 26 of the 40 components that write asked nothing, including the ones
 * that withdraw a consent, sign for a dose and file an incident. The sentence
 * in `permissions.ts` — "Reads everything and writes nothing, which is the
 * point of the role" — was a guarantee with nothing behind it.
 *
 * **Writes are declared, never guessed from naming.** Each store and the
 * `client` facade export `WRITE_EXPORTS`. `recordStatus` writes and
 * `statusFor` reads; no spelling rule separates those, and the first two
 * attempts at this audit got it wrong in both directions — one classified
 * `boardFor` as a write, another missed `recordFamilyDecision`.
 *
 * **What it cannot tell you**, stated here and in the success line rather than
 * left for somebody to assume: a write left off a `WRITE_EXPORTS` list is a
 * write this guard will not look for. It checks the other direction — every
 * declared name must be a real export — so a list cannot rot into naming
 * functions that do not exist, and it prints what it reached rather than a
 * tick, so a number that falls is visible.
 *
 * `// permission-ok: <why>` opts a file out, and the count is printed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = new URL('../src', import.meta.url).pathname
const ACCESS = join(ROOT, 'data/access')

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

/** Asks about the viewer's level, however the question is phrased. */
const ASKS = /canRecordIn|canApproveIn|viewer\.may\b|mayCorrectReport|mayDo\(/

const findings = []
let declaredWrites = 0
let optedOut = 0

/* ---- 1. Read the declarations, and check they name real exports. ---- */

const writesByModule = new Map()
for (const file of readdirSync(ACCESS)) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
  const source = readFileSync(join(ACCESS, file), 'utf8')
  const block = /export const WRITE_EXPORTS = \[([\s\S]*?)\] as const/.exec(source)
  if (block === null) continue

  const names = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  const moduleName = file.replace(/\.ts$/, '')
  writesByModule.set(moduleName, names)
  declaredWrites += names.length

  for (const name of names) {
    const exported = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${name}\\b|export\\s+const\\s+${name}\\b`,
    ).test(source)
    if (!exported) {
      findings.push(
        `${file}: WRITE_EXPORTS names '${name}', which this file does not export`,
      )
    }
  }
}

if (writesByModule.size === 0) {
  console.error('✗ write gates — no WRITE_EXPORTS declared anywhere; nothing was read')
  process.exit(1)
}

/* ---- 2. Every component calling one of them asks, or says why not. ---- */

const components = walk(ROOT).filter(
  (file) =>
    /\.(ts|tsx)$/.test(file) &&
    !/\.test\./.test(file) &&
    !file.startsWith(ACCESS) &&
    !file.includes('/test/'),
)

let checked = 0
for (const file of components) {
  const raw = readFileSync(file, 'utf8')
  /*
   * Comments are stripped by the scanner rather than a regex, because a regex
   * cannot tell a string containing `/*` from a comment — the defect §8
   * records, which blanked a third of a file and printed a tick over it.
   */
  const source = stripComments(raw)
  const called = []

  for (const [moduleName, names] of writesByModule) {
    /*
     * The braces are anchored directly to their own `from`. This codebase
     * writes no semicolons, so `import[^;]*?{...}[^;]*?from '...'` ran across
     * several import lines and captured the wrong one's names — the guard
     * reported "1 component" where there are forty, and printed a tick.
     */
    const imports = [
      ...source.matchAll(
        new RegExp(`\\{([^{}]*)\\}\\s*from\\s*'[^']*${moduleName}'`, 'gs'),
      ),
    ]
    if (imports.length === 0) continue
    const imported = new Set(
      imports.flatMap((m) => m[1].split(',')).map((n) => n.trim().split(/\s+as\s+/)[0]),
    )
    for (const name of names) {
      if (imported.has(name) && new RegExp(`\\b${name}\\s*\\(`).test(source)) {
        called.push(name)
      }
    }
  }

  if (called.length === 0) continue
  checked += 1

  if (ASKS.test(source)) continue
  if (/permission-ok:/.test(raw)) {
    optedOut += 1
    continue
  }

  findings.push(
    `${file.replace(ROOT + '/', 'src/')}: calls ${called.join(', ')} and asks nothing about the viewer's level`,
  )
}

if (findings.length > 0) {
  console.error('✗ write gates')
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    `\n  A component that writes asks canRecordIn or canApproveIn for its module,`,
  )
  console.error(
    `  or carries "// permission-ok: <why>" where the act is not a viewer's to make.`,
  )
  process.exit(1)
}

console.log(
  `✓ write gates — ${String(declaredWrites)} writes declared across ${String(writesByModule.size)} modules; ` +
    `${String(checked)} components call one, every one asks (${String(optedOut)} deliberate). ` +
    `A write left off a WRITE_EXPORTS list is not looked for.`,
)
