#!/usr/bin/env node
/**
 * Who may read which residents a care worker has been given.
 *
 * **The constraint this protects is free, and that is why it needs a guard.**
 * Resident assignment decides nothing in this platform: care workers do not
 * sign in here, so the scoping it describes happens in the Care Worker
 * product. It is written on the invite drawer and read on the staff profile,
 * and there is no screen in this build where it could change a figure — which
 * means nothing will push back the day somebody makes one.
 *
 * And somebody will, in good faith. Five places invite it:
 *
 *   - The staff report's "doses with no record" column, removed in Phase 13
 *     because an omission is a dose nobody recorded and carries nobody's name.
 *     **With assignment, a gap on an assigned resident carries one** — which is
 *     exactly when the column becomes attributable and exactly when it becomes
 *     a performance record about a person.
 *   - The staff profile's figures, where a list of six residents beside
 *     another person's one is a workload comparison with no denominator.
 *   - The Dashboard's "not written up today", the moment somebody wants it
 *     filtered to their own team.
 *   - Any coverage-by-care-worker report, which this data makes possible.
 *   - Admission's "care workers assigned to this resident see a banner", which
 *     is a claim about another product rendered here.
 *
 * So the field is named `residentAssignment`, distinctly enough that every
 * reach for it is greppable, and this fails for any file not listed below.
 *
 * The list is short and every entry carries a reason, because an exception
 * list with thirty entries is wallpaper inside a week and this build has
 * arrived at that failure three times. If it ever needs a sixth entry, the
 * question to ask is not how to word the reason but whether the constraint
 * still holds.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage'])
/*
 * **Matched case-insensitively, because the first version missed the writer.**
 * `line.includes('residentAssignment')` is false for `setResidentAssignment`
 * and for the type `ResidentAssignment`, so the invite drawer — the one screen
 * that writes an assignment — did not register as reaching for it at all. A
 * guard that cannot see the write is not guarding the field, it is guarding
 * one spelling of it.
 */
const FIELD = /residentassignment/i

/**
 * Where it may be reached, and why.
 *
 * Declaring the type, holding it, seeding it, and the two screens that write
 * and read it. Nothing that counts, aggregates, ranks or renders a gap.
 */
/* Only `src` is walked, so this script naming the field is not a reach. */
const ALLOWED = [
  { file: 'src/data/types/team.ts', why: 'declares the union' },
  {
    file: 'src/data/types/index.ts',
    why: 're-exports the type, and a barrel skipping one type is the inconsistency somebody fixes without reading this',
  },
  {
    file: 'src/data/access/team-store.ts',
    why: 'holds it, seeds it from the fixtures, and is the only writer',
  },
  {
    file: 'src/features/team/AssignmentSection.tsx',
    why: 'the staff profile section that renders and edits it (TM-03)',
  },
  {
    file: 'src/features/team/InviteDrawer.tsx',
    why: 'the invite drawer chooses residents when the role is care worker (TM-02)',
  },
  {
    file: 'src/features/team/assignment.test.tsx',
    why: 'asserts the states render, and that no other role holds one',
  },
]

const allowed = new Set(ALLOWED.map((entry) => entry.file))

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

const findings = []
const touched = new Set()
let reaches = 0

for await (const file of walk(SRC)) {
  const relative = path.relative(ROOT, file)
  const source = stripComments(await readFile(file, 'utf8'))
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    if (!FIELD.test(line)) return
    reaches += 1
    touched.add(relative)
    if (allowed.has(relative)) return
    findings.push({ where: `${relative}:${index + 1}`, line: line.trim() })
  })
}

/*
 * **The other direction, and it was vacuous when first written.** The
 * condition was `!findings.length && false`, which cannot be true: a dead
 * entry could never be reported and the count printed in the success line was
 * always zero. That is the assertion-that-cannot-fail defect inside the guard
 * meant to enforce a constraint, written in the same hour as the entry warning
 * about it.
 *
 * An entry naming a file that does not reach the field narrows nothing for
 * anybody and still reads as a decision somebody took, which is the dead
 * `/team` permission exception all over again. So it is a finding.
 */
const reached = new Set(findings.map((finding) => finding.where.split(':')[0]))
for (const file of touched) reached.add(file)
const dead = ALLOWED.filter((entry) => !reached.has(entry.file))

if (dead.length > 0) {
  console.error(
    '✖ assignment reach: an entry excuses a file that does not reach the field.\n' +
      '  It narrows nothing for anybody and still reads as a decision somebody took.\n',
  )
  for (const entry of dead) console.error(`  ${entry.file} — ${entry.why}`)
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    '✖ assignment reach: which residents a care worker has been given is read somewhere it must not be.\n' +
      '\n' +
      "  An omission is a dose nobody recorded, so it carries nobody's name. A gap\n" +
      '  that acquires one stops being a gap and becomes a performance record about\n' +
      '  a person, which is why Phase 13 removed a column and why this field decides\n' +
      '  nothing outside Team Management.\n' +
      '\n' +
      '  If this is genuinely a sixth place it belongs, the question is not how to\n' +
      '  word the exception but whether the constraint still holds.\n',
  )
  for (const finding of findings) console.error(`  ${finding.where}  ${finding.line}`)
  process.exit(1)
}

console.log(
  `✓ assignment reach — ${reaches} references across ${touched.size} files, every one of the ${ALLOWED.length} allowed places live`,
)
