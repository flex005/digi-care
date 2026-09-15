#!/usr/bin/env node
/**
 * The Family Portal module reads the consent and never records one.
 *
 * **Why this is a guard and not a sentence.** Whether a family may see
 * anything is the resident's `family_portal` consent, recorded through the
 * capacity gate under `/consent`. Who is named is a different fact, and it
 * lives in `/family`. If the family module ever grew its own way to record the
 * consent, there would be two records of one fact and the one that goes stale
 * is always whichever the reader is looking at.
 *
 * That rule was stated in three docblocks and held by nothing. Every docblock
 * would still read correctly the day somebody added a "record it here too"
 * button in good faith — which is the §8 class this build keeps meeting: a
 * screen describing what it does is a claim, and the next sentence somebody
 * writes when they mean to build the thing is where it goes wrong.
 *
 * So the check reads the source, and it reads it with the shared scanner
 * rather than a regex: this file's own subject is naming those writers in
 * prose, and a regex cannot tell a comment from a string containing one.
 *
 * It states what it reached rather than printing a tick over whatever it
 * happened to read — a file count that can fall is a regression somebody can
 * see, where a tick is a tick either way.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FEATURE = path.join(ROOT, 'src/features/family')

/** Everything that writes a consent, by the name a call site uses. */
const WRITERS = ['recordConsent', 'withdrawConsent', 'editResidentField']
/** A store that can write a resident record directly, whatever it is called. */
const FORBIDDEN_IMPORT = '@/data/access/resident-store'

/**
 * The lowest number of source files this module can honestly have: the
 * section, the tab, the queue and the shared statements. If the sweep ever
 * reads fewer than this, it is reaching less than the module, and saying so is
 * the whole point — a check that can silently skip half its input and still
 * print a tick is not a check.
 */
const EXPECTED_AT_LEAST = 4

const sourceFiles = async () => {
  const entries = await readdir(FEATURE, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.'),
    )
    .map((entry) => path.join(FEATURE, entry.name))
}

const files = await sourceFiles()
const findings = []

for (const file of files) {
  const code = stripComments(await readFile(file, 'utf8'))
  const where = path.relative(ROOT, file)

  code.split('\n').forEach((line, index) => {
    for (const writer of WRITERS) {
      if (new RegExp(`\\b${writer}\\s*\\(`).test(line)) {
        findings.push(
          `${where}:${index + 1} calls ${writer}. The family module names people; whether they may be named is the consent, recorded under /consent.`,
        )
      }
    }
    if (line.includes(FORBIDDEN_IMPORT)) {
      findings.push(
        `${where}:${index + 1} imports ${FORBIDDEN_IMPORT}, which can write a consent onto a resident directly.`,
      )
    }
  })
}

if (files.length < EXPECTED_AT_LEAST) {
  console.error(
    `✖ family writes — read ${files.length} source files under src/features/family, fewer than the ${EXPECTED_AT_LEAST} this module has. The sweep is reaching less than it claims.`,
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error('✖ family writes — the family module records a consent:\n')
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\nThe consent is one fact with one owner. Link to the Consent tab instead.',
  )
  process.exit(1)
}

console.log(
  `✓ family writes — ${files.length} source files under src/features/family, none records a consent`,
)
