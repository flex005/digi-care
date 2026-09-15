#!/usr/bin/env node
/**
 * Every `var(--token)` names a token that exists.
 *
 * **Written the hour it was needed.** Phase 17 used `--text-small-size`,
 * `--text-small-line`, `--ink-600` and `--radius-8`. None of the four exists.
 * Nothing failed: stylelint's colour rule sees a `var()` and is satisfied,
 * `tsc` does not read CSS, the build succeeded, the tests passed, and the
 * screens rendered with the text at whatever size it inherited.
 *
 * That is the class this build keeps meeting from new directions — a value
 * that is correct in the source and absent on screen — and this one is the
 * cheapest variant to catch, because an undefined custom property is a string
 * that does not appear in `tokens.css` and a script can see that.
 *
 * It matters more than a typo: §4 says the type scale is closed at nine steps
 * and colour reaches a component only as a token. A misspelled token is a
 * silent departure from both, and it looks exactly like compliance.
 *
 * Local properties declared in the same file are fine: a stylesheet may define
 * its own `--row-height` and use it. What is checked is that a reference
 * resolves somewhere the author can point at.
 */

import { readdir, readFile } from 'node:fs/promises'
import { stripCssComments } from './lib/strip-comments.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const TOKENS = path.join(SRC, 'styles', 'tokens.css')
const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage'])
const OPT_OUT = /\/\*\s*token-ok:\s*\S/

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.name.endsWith('.css')) {
      yield full
    }
  }
}

const declared = new Set()
for (const match of (await readFile(TOKENS, 'utf8')).matchAll(/^\s*(--[\w-]+)\s*:/gm)) {
  declared.add(match[1])
}

const findings = []
let allowed = 0
let referenced = 0

for await (const file of walk(SRC)) {
  const raw = await readFile(file, 'utf8')
  /*
   * Comments blanked, line count preserved. `tokens.css` explains the rule in
   * prose that says `var(--token)`, and a guard that fires on its own
   * documentation teaches people to word around it (§8).
   *
   * A scanner rather than a regex, for the reason the selector guard found the
   * hard way: a regex cannot tell a comment from a string containing one, and
   * when it gets it wrong it blanks real code and reports a tick.
   */
  const source = stripCssComments(raw)
  const lines = source.split('\n')
  /* Properties this file declares for itself, anywhere in it. */
  const local = new Set(
    [...raw.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]),
  )

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/var\(\s*(--[\w-]+)/g)) {
      referenced += 1
      const name = match[1]
      if (declared.has(name) || local.has(name)) continue
      if (OPT_OUT.test(line)) {
        allowed += 1
        continue
      }
      findings.push(
        `${path.relative(ROOT, file)}:${index + 1}  ${name} is not declared in tokens.css or in this file`,
      )
    }
  })
}

if (findings.length > 0) {
  console.error(
    `✖ tokens: ${findings.length} reference${findings.length === 1 ? '' : 's'} to a custom property that does not exist. An undefined property is silent: the declaration is dropped and the element renders with whatever it inherited.\n`,
  )
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}

console.log(
  `✓ tokens — ${referenced} references, every one declared (${allowed} deliberate)`,
)
