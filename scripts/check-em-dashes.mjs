#!/usr/bin/env node
/**
 * No em dash reaches the screen.
 *
 * The platform's copy uses a comma, a colon or a full stop. An em dash is a
 * house-style decision Frank has made, and it is mechanical, which means it
 * belongs in a script rather than in a review: it went into 338 lines of
 * user-facing copy over sixteen phases without anybody deciding to put it
 * there, and it would go back the same way.
 *
 * **Comments and documentation are not the platform.** This reads the source
 * with block and line comments blanked, so a dash in a docblock — where the
 * reasoning for a rule is written — is not a finding. What is left is the
 * strings and the JSX text a user can actually see.
 *
 * `// dash-ok: <why>` opts out per line and the count is printed.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage'])
const OPT_OUT = /\/\/\s*dash-ok:\s*\S/

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield full
    }
  }
}

/**
 * Blank every comment line, keeping the line count.
 *
 * Line-based rather than character-based, and deliberately: a character
 * scanner has to know whether a quote opens a string, and in JSX it usually
 * does not — `Today's doses` is text, not the start of a literal. The first
 * version of this took that apostrophe as a string delimiter and lost track of
 * every comment after it, which is how a guard reports findings it should not
 * and misses the ones it should. Prettier formats every block comment in this
 * repo with a leading `*`, so the shape is reliable.
 */
function commentLines(source) {
  const flags = []
  let inBlock = false
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (inBlock) {
      flags.push(true)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed.startsWith('//')) {
      flags.push(true)
      continue
    }
    if (trimmed.startsWith('*')) {
      flags.push(true)
      continue
    }
    if (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) {
      flags.push(true)
      if (!trimmed.includes('*/')) inBlock = true
      continue
    }
    // Code first, then an unterminated block comment on the same line.
    if (line.includes('/*') && !line.includes('*/')) {
      flags.push(false)
      inBlock = true
      continue
    }
    flags.push(false)
  }
  return flags
}

const findings = []
let allowed = 0

for await (const file of walk(SRC)) {
  const source = await readFile(file, 'utf8')
  if (!source.includes('—')) continue
  const rawLines = source.split('\n')
  const isComment = commentLines(source)

  rawLines.forEach((line, index) => {
    if (!line.includes('—')) return
    if (isComment[index]) return
    if (OPT_OUT.test(line)) {
      allowed += 1
      return
    }
    findings.push({
      file: path.relative(ROOT, file),
      line: index + 1,
      text: line.trim(),
    })
  })
}

if (findings.length > 0) {
  console.error(`\n✖ em dashes: ${findings.length} reach the screen.\n`)
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`)
    console.error(`      ${finding.text.slice(0, 100)}`)
  }
  console.error(
    '\n  Use a comma, a colon or a full stop. A dash standing in for a missing',
    '\n  value is worse still: it cannot be told apart from a blank, which is',
    '\n  the ambiguity this product exists to prevent (CLAUDE.md §1).',
    '\n  Deliberate? // dash-ok: <why>\n',
  )
  process.exit(1)
}

console.log(
  `✓ em dashes — none reaches the screen${allowed > 0 ? ` (${allowed} deliberate)` : ''}`,
)
