#!/usr/bin/env node
/**
 * Every screen that loads a record handles being refused one.
 *
 * **Why a guard rather than the compiler.** `AsyncResource` gained a fourth
 * member, `refused`: a record that exists, in a home this viewer is not
 * appointed to. A union member is normally the compiler's job — except every
 * consumer here reads it through a ternary chain (`kind === 'loading' ? … :
 * kind === 'error' ? … : ready`), and a ternary is not exhaustive. A consumer
 * that never mentions `refused` does not fail to build. It falls through to
 * the ready branch and reads `resource.data`, which is not there, and the
 * screen crashes at the moment somebody opens another home's record.
 *
 * That is the silent-fall-through shape §8 already carries three entries
 * about, so the mechanism is not a note: it is this, and it is mutated by
 * removing the handling from one consumer.
 *
 * **It states what it reached.** A tick over an unknown number of files is the
 * failure this build keeps meeting — a check that silently reads half its
 * input and prints a success line phrased over the whole of it. So the count
 * of consumers is printed, and a floor is asserted: if the sweep ever finds
 * fewer files calling `useResource` than the product has, it says so and
 * fails rather than passing over a smaller product.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

/**
 * The lowest number of screens that read a record through `useResource`.
 *
 * **Twenty-six, counted rather than guessed.** It was written as 20 before the
 * consumers had been counted, which is a floor no shrinking product would ever
 * cross — a threshold picked to be safe is a threshold that never fires. The
 * number is what the product has today, so losing a screen from the sweep is a
 * failure somebody sees rather than a tick over a smaller product.
 */
const EXPECTED_AT_LEAST = 26

const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage', 'icons-generated'])

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      found.push(...(await sourceFiles(full)))
      continue
    }
    if (!/\.tsx$/.test(entry.name) || entry.name.includes('.test.')) continue
    found.push(full)
  }
  return found
}

const files = await sourceFiles(SRC)
const consumers = []
const findings = []

for (const file of files) {
  const code = stripComments(await readFile(file, 'utf8'))
  if (!/\buseResource\s*[<(]/.test(code)) continue
  consumers.push(file)
  /*
   * **The resource's own `kind`, not any `kind` in the file.** This took two
   * attempts and both failures are the same class one step apart. Matching the
   * bare word `'refused'` passed the consent dashboard, which filters consents
   * somebody refused — a different fact wearing the same word. Tightening it
   * to `.kind === 'refused'` passed it again, because line 123 of that file
   * reads `row.status.kind === 'refused'`: the word was fixed and the subject
   * was not.
   *
   * So the name is taken from the assignment — 25 screens bind `const
   * resource`, one binds `const incidents` — and the check asks that variable.
   * A screen with no `useResource` assignment it can name is a finding rather
   * than a pass, because a check that cannot identify its subject has not
   * checked anything.
   */
  const bound = [
    ...code.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*useResource\s*[<(]/g),
  ].map((match) => match[1])
  if (bound.length === 0) {
    findings.push(
      `${path.relative(ROOT, file)} (calls useResource without binding it to a name this check can ask about)`,
    )
    continue
  }
  const handlesAll = bound.every((name) =>
    new RegExp(`${name}\\.kind\\s*===\\s*'refused'`).test(code),
  )
  if (!handlesAll) {
    findings.push(path.relative(ROOT, file))
  }
}

if (consumers.length < EXPECTED_AT_LEAST) {
  console.error(
    `✖ refusal handling — found ${consumers.length} screens reading a record, fewer than the ${EXPECTED_AT_LEAST} this product has. The sweep is reaching less than it claims.`,
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    `✖ refusal handling — ${findings.length} of ${consumers.length} screens do not say what happens when a record is refused:\n`,
  )
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\nA ternary is not exhaustive, so this compiles and then reads `resource.data` on a resource that has none. Render the refusal: the record exists, and it belongs to a home this viewer is not appointed to.',
  )
  process.exit(1)
}

console.log(
  `✓ refusal handling — ${consumers.length} screens read a record, every one says what happens when it is refused`,
)
