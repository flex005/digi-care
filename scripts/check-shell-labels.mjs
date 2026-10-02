/**
 * A fixed shell label is sentence case, and nothing cites it in title case.
 *
 * **Why this needs a mechanism rather than a sweep.** The convention has been
 * sentence case since Phase 0 — `STAFF_ROLE_NAMES` reads 'Registered manager',
 * the sidebar's own group headings read 'Care delivery' and 'Planning and
 * risk' — and the item labels beside those headings were title case, in the
 * same file, for thirty phases. Nothing caught it because **nine of the
 * seventeen items are single words**, and a single word is the same string in
 * both conventions. Only a multi-word label can distinguish them, and until
 * the configurable vocabulary started producing multi-word labels there were
 * almost none. Same shape as the vocabulary's own title-case slip and the
 * plural pairings before it: a convention that only multi-word cases can test,
 * in a product that had almost no multi-word cases.
 *
 * **Two checks, because the declaration is the smaller half.** Renaming a tab
 * is easy; the citations are what rot. `key-questions.ts` names two profile
 * tabs as the provenance of a finding — "Important people · every recorded
 * contact" — on the screen whose entire job is saying where a finding came
 * from, so a stale citation points a reader at a tab that does not exist by
 * that name. The activity log, the document library, the inspection pack and
 * the settings figures each restate module names too. So this reads every
 * source file, not just the declarations.
 *
 * `PRODUCT_NAMES_IN_LABELS` in `nav-items.icons.ts` carries the exceptions and
 * is read **in both directions**: an inner capital that is not declared fails,
 * and a declared name that has no inner capital fails too, so an entry cannot
 * go stale and keep excusing something.
 *
 * Run: npm run lint:shelllabels
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = new URL('../src', import.meta.url).pathname

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

/* ---- 1. The exceptions, from the declaration rather than from this file. ---- */

const navSource = readFileSync(join(ROOT, 'app/nav-items.icons.ts'), 'utf8')
const declaredNames =
  /export const PRODUCT_NAMES_IN_LABELS: readonly string\[\] = \[([^\]]*)\]/.exec(
    navSource,
  )
if (declaredNames === null) {
  console.error(
    '✖ shell labels — nav-items.icons.ts declares no PRODUCT_NAMES_IN_LABELS, so' +
      '\n  this check has no way to tell a name from a slip and would pass everything.',
  )
  process.exit(1)
}
const exceptions = [...declaredNames[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

/* ---- 2. The fixed labels: the ones the vocabulary does not own. ---- */

/**
 * `label: 'X'` (nav items and group headings) and `label: () => 'X'` (profile
 * tabs). A tab reading `label: (terms) => terms.carePlan.One` is deliberately
 * not matched: the vocabulary owns that word and `vocabulary.test.ts` holds it.
 */
const LABEL = /label:\s*(?:\(\)\s*=>\s*)?'([^']+)'/g

const sources = walk(ROOT).filter((file) => /\.(ts|tsx)$/.test(file))
const labelFiles = [
  join(ROOT, 'app/nav-items.icons.ts'),
  join(ROOT, 'features/residents/ResidentProfileRoute.tsx'),
]

const labels = new Set()
for (const file of labelFiles) {
  const source = stripComments(readFileSync(file, 'utf8'))
  for (const hit of source.matchAll(LABEL)) {
    if (hit[1].trim() !== '') labels.add(hit[1])
  }
}
if (labels.size === 0) {
  console.error(
    '✖ shell labels — no fixed label was found to check. The declarations moved,' +
      '\n  and this check would have printed a tick over nothing.',
  )
  process.exit(1)
}

/** Every word after the first. A one-word label cannot distinguish the two. */
const afterFirst = (label) => label.split(/\s+/).slice(1)
const titleCased = (label) =>
  label
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const findings = []

/* ---- 3. A declared label with an inner capital it has not earned. ---- */

for (const label of labels) {
  if (exceptions.includes(label)) continue
  const capitalised = afterFirst(label).filter((word) => word !== word.toLowerCase())
  if (capitalised.length > 0) {
    findings.push({
      what: `"${label}" is title case`,
      why: `"${capitalised.join('", "')}" would be lower case in sentence case.`,
    })
  }
}

/* ---- 4. The other direction, so an entry cannot go stale. ---- */

for (const name of exceptions) {
  if (!labels.has(name)) {
    findings.push({
      what: `"${name}" is declared a product name and is not a shell label`,
      why: 'It excuses nothing, and reads as a decision somebody took.',
    })
    continue
  }
  if (afterFirst(name).every((word) => word === word.toLowerCase())) {
    findings.push({
      what: `"${name}" is declared a product name and has no inner capital`,
      why: 'Nothing about it needs excusing; the entry has gone stale.',
    })
  }
}

/* ---- 5. A citation left in title case, anywhere in the tree. ---- */

let cited = 0
for (const label of labels) {
  if (exceptions.includes(label)) continue
  const stale = titleCased(label)
  if (stale === label) continue
  for (const file of sources) {
    /*
     * Comments blanked first. §8 records `check-hatch` firing on the docblock
     * that explained it, and the pressure that creates is the wrong way round:
     * the cheapest fix is to reword the prose, and the habit that builds is
     * writing about the rule obliquely — which is how the next real citation
     * gets in under a comment. This file's own account of the defect names the
     * old spelling, and so do four entries explaining why the module names
     * have one owner. A guard matches the construct, not the word for it.
     */
    const source = stripComments(readFileSync(file, 'utf8'))
    if (!source.includes(stale)) continue
    const line = source.slice(0, source.indexOf(stale)).split('\n').length
    cited += 1
    findings.push({
      what: `"${stale}" in ${file.replace(ROOT + '/', 'src/')}:${String(line)}`,
      why: `The label is "${label}". A citation in the old case points a reader at a screen that is not called that.`,
    })
  }
}

if (findings.length > 0) {
  console.error(
    `✖ shell labels — ${String(findings.length)} label(s) or citation(s) out of` +
      `\n  step with this build's sentence case:\n`,
  )
  for (const f of findings) {
    console.error(`  ${f.what}`)
    console.error(`    ${f.why}\n`)
  }
  console.error(
    `  Sentence case matches STAFF_ROLE_NAMES ("Registered manager") and the` +
      `\n  sidebar's own group headings ("Planning and risk"). A label that is a` +
      `\n  product's name rather than a description of a section goes in` +
      `\n  PRODUCT_NAMES_IN_LABELS, in nav-items.icons.ts, with the reason.\n`,
  )
  process.exit(1)
}

/*
 * What it read against what it was given, rather than a bare tick — and what
 * it cannot see, which is a label built at runtime from anything but the
 * vocabulary.
 */
const multiWord = [...labels].filter((label) => afterFirst(label).length > 0)
console.log(
  `✓ shell labels — ${String(labels.size)} fixed label(s), ${String(multiWord.length)} of ` +
    `them multi-word and so able to tell the two conventions apart; ` +
    `${String(exceptions.length)} declared product name(s); ${String(cited)} stale ` +
    `citation(s) across ${String(sources.length)} source files. It reads literal ` +
    `labels: one assembled at runtime, outside the vocabulary, it cannot see.`,
)
