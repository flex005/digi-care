#!/usr/bin/env node
/**
 * Every `tel:` href is built by `telHref`, and none is interpolated by hand.
 *
 * There were five, all written as `href={`tel:${contact.phone}`}` — GP and next
 * of kin in the profile header, GP, consultants and pharmacy on the Care team
 * section. Each produced a URI with spaces in it and no country code, because
 * the display string and the dialable string had been treated as one thing.
 *
 * A guard on the pattern rather than on the five, because it was never five
 * mistakes — it was one habit, repeated wherever a phone number appeared.
 * Screen 5 brings social workers, advocates, LPA holders and family with
 * visiting rights, so the next several call sites are already coming.
 *
 * Lives here rather than in a vitest file because it reads the filesystem, and
 * src/ is a browser project with no node types — the same reason
 * check-hatch.mjs lives here.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP_DIRECTORIES = new Set(['assets', 'icons-generated', 'node_modules'])

/** phone.ts builds them; its test asserts the strings it builds. */
const ALLOWED = new Set([
  path.join(SRC, 'lib/phone.ts'),
  path.join(SRC, 'lib/phone.test.ts'),
])

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (/\.tsx?$/.test(entry.name)) yield full
  }
}

const findings = []

for await (const file of walk(SRC)) {
  if (ALLOWED.has(file)) continue
  const lines = (await readFile(file, 'utf8')).split('\n')
  lines.forEach((line, index) => {
    if (/['"`]tel:/.test(line)) {
      findings.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        text: line.trim(),
      })
    }
  })
}

if (findings.length > 0) {
  console.error(
    `\n✖ tel links: ${findings.length} built by hand rather than by telHref().\n`,
  )
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`)
    console.error(`      ${finding.text}`)
  }
  console.error(
    "\n  Use:  href={telHref(contact.phone)}   from '@/lib/phone'",
    '\n  It strips the spaces a URI cannot carry and puts the number in',
    '\n  international form, so a national number still connects from a',
    '\n  roaming handset.\n',
  )
  process.exit(1)
}

console.log('✓ tel links — every dialable href is built by telHref')
