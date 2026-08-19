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
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const CANONICAL = path.join(SRC, 'styles/unrecorded.module.css')

const SKIP_DIRECTORIES = new Set(['node_modules', 'assets', 'dist', 'coverage'])

const FORBIDDEN = [
  {
    pattern: /repeating-linear-gradient/,
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
    } else if (entry.name.endsWith('.css')) {
      yield full
    }
  }
}

const findings = []

for await (const file of walk(SRC)) {
  if (file === CANONICAL) continue
  // tokens.css declares the tokens; it does not apply the treatment.
  if (file === path.join(SRC, 'styles/tokens.css')) continue

  const lines = (await readFile(file, 'utf8')).split('\n')
  lines.forEach((line, index) => {
    for (const { pattern, what } of FORBIDDEN) {
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

if (findings.length > 0) {
  console.error(
    `\n✖ hatch: the unrecorded treatment is defined in ${findings.length === 1 ? 'a second place' : 'other places'}.\n`,
  )
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.what}`)
    console.error(`      ${finding.text}`)
  }
  console.error(
    '\n  There is one definition, in src/styles/unrecorded.module.css.',
    "\n  Reach it with:  composes: unrecorded from '…/styles/unrecorded.module.css';",
    '\n  and render it through <Unrecorded label="…" />, which requires the text.',
    '\n  PRD §4.5, CLAUDE.md §1.\n',
  )
  process.exit(1)
}

console.log('✓ hatch — the unrecorded treatment has exactly one definition')
