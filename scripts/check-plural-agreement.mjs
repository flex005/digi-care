/**
 * A count beside a configurable plural agrees with it, through `pluralise`.
 *
 * **Why this one is enforceable where two others were refused.** §8 records
 * the lowercasing guard and the clock-ordered-fixture guard both being costed
 * and thrown away, because what they were looking for was arbitrary prose with
 * nothing mechanical in it. This shape is different: **both halves come from
 * known owners.** The count is a `formatCount(…)` call or a `.length`, and the
 * word is a declared plural form read out of `src/lib/vocabulary.ts` rather
 * than guessed. Two named things a script can recognise.
 *
 * **Why it is needed at all.** This class has got through three times — the
 * incident video note, the activities invitation, and seven handover and
 * dashboard denominators that would have read "of 1 service users reviewed
 * this shift" on any shift where one person had been marked. `check-plurals`
 * cannot see any of them: it looks for a count agreeing with its word **in one
 * expression**, and in every one of these the count and the word are separate
 * expressions. That guard is narrower than its name.
 *
 * `pluralise(n, term.one, term.many)` is the owner. A conditional written at a
 * call site is a second copy of the rule, so it is not accepted here either.
 *
 * `// plural-ok: <why>` opts out per site, and the count is printed.
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

/* ---- 1. Which forms are plural, from the vocabulary rather than a guess. ---- */

const vocabulary = readFileSync(join(ROOT, 'lib/vocabulary.ts'), 'utf8')
const declared = /export const PLURAL_FORMS = \[([^\]]*)\]/.exec(vocabulary)
if (declared === null) {
  console.error(
    '✖ plural agreement — vocabulary.ts declares no PLURAL_FORMS, so this check' +
      '\n  has nothing to look for and would pass everything.',
  )
  process.exit(1)
}
const forms = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
if (forms.length === 0) {
  console.error('✖ plural agreement — PLURAL_FORMS is empty; nothing would be checked.')
  process.exit(1)
}

/* ---- 2. A count expression immediately before one of those forms. ---- */

/**
 * What closes a count: `formatCount(n)`, `n.length`, or a braced expression
 * ending in either. Whitespace, a closing tag and a JSX space may sit between
 * it and the word — they are how the two halves end up looking adjacent on
 * screen while being separate expressions in the source.
 */
const BETWEEN = String.raw`(?:\s|</span>|\{' '\}|<span[^>]*>)*`
const COUNT = String.raw`(?:formatCount\([^)]*\)|[\w.]+\.length|\$\{[^}]*\}|\{[^}]*\})`

const patterns = forms.map(
  (form) => new RegExp(`${COUNT}${BETWEEN}\\$?\\{?\\s*[\\w.]*\\.${form}\\b`, 'g'),
)

const files = walk(ROOT).filter(
  (file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file),
)

const findings = []
let optedOut = 0
let suspect = 0
/** Sites already doing it correctly: a number that falls if one is undone. */
let agreed = 0

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  /*
   * A real scanner, not a regex: a string containing `/*` is not a comment,
   * and the §8 entry about that one blanked a third of a file and printed a
   * tick over it. The examples inside this file's own docblocks would be
   * findings otherwise.
   */
  const source = stripComments(raw)
  const lines = source.split('\n')
  for (const form of forms) {
    agreed += [...source.matchAll(new RegExp(`pluralise\\([^)]*\\.${form}\\b`, 'g'))]
      .length
  }

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let hit
    while ((hit = pattern.exec(source)) !== null) {
      suspect += 1
      /*
       * The surrounding statement, not the match: `pluralise(n, term.one,
       * term.many)` contains a count and a plural form by construction, and is
       * the correct shape rather than a finding.
       */
      const from = source.lastIndexOf('\n', Math.max(0, hit.index - 240))
      const around = source.slice(Math.max(0, from), hit.index + hit[0].length + 40)
      if (/pluralise\(/.test(around)) continue

      const line = source.slice(0, hit.index).split('\n').length
      if (/plural-ok:/.test(raw.split('\n')[line - 2] ?? '')) {
        optedOut += 1
        continue
      }
      findings.push({
        file: file.replace(ROOT + '/', 'src/'),
        line,
        text: (lines[line - 1] ?? '').trim().slice(0, 96),
      })
    }
  }
}

if (findings.length > 0) {
  console.error(
    `✖ plural agreement — ${findings.length} count(s) sit beside a configurable` +
      `\n  plural without agreeing with it. At one they read "of 1 service users".\n`,
  )
  for (const f of findings) {
    console.error(`  ${f.file}:${String(f.line)}`)
    console.error(`    ${f.text}\n`)
  }
  console.error(
    `  Use pluralise(n, term.one, term.many), which is the owner of that` +
      `\n  agreement. A conditional at the call site is a second copy of the rule.` +
      `\n  "// plural-ok: <why>" on the line above opts out where a count and a` +
      `\n  plural are genuinely unrelated.\n`,
  )
  process.exit(1)
}

/*
 * What it read, against what it cannot see — the rule this repo's guards
 * follow rather than printing a bare tick.
 */
console.log(
  `✓ plural agreement — ${String(forms.length)} declared plural form(s); ` +
    `${String(agreed)} counts agreed through pluralise, ${String(suspect)} sitting ` +
    `beside one without it (${String(optedOut)} deliberate). It sees a count ` +
    `adjacent to a declared form; a count further away, or one held in a variable ` +
    `named like a noun, it cannot.`,
)
