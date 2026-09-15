#!/usr/bin/env node
/**
 * A rendered percentage carries its denominator.
 *
 * CLAUDE.md §1: every aggregate carries its denominator, and there are no bare
 * percentages anywhere. **This checks the percentage half of that rule and not
 * the count half**, deliberately, and the reason the other half is absent is
 * recorded at the foot of this file so nobody re-derives it as an oversight.
 *
 * A bare percentage is the more damaging of the two: a bare count invites a
 * question, and a bare percentage answers one. "92%" reads as a finding about
 * a home whatever it is 92% of, and the reader has no way to know it is 92% of
 * twelve.
 *
 * ## What counts as a rendered percentage
 *
 * A `}%` that is not closing a template literal. Every percentage in this
 * build is either `{value}%` in JSX text or `` `${value}%` `` inside a
 * `style` object, and the second is geometry rather than a claim: a bar drawn
 * at 92% of its track is not a figure anybody reads. The two are told apart by
 * what follows the `%`, which is a backtick in the CSS case.
 *
 * ## The approximation, and which way it fails
 *
 * The denominator has to be rendered **within `NEARBY` lines of the
 * percentage, and inside the same component**. Both halves are needed and the
 * second alone is not enough, which a mutation showed rather than a reading:
 * a bare `{share}%` added to `DashboardRoute` passed, because that component
 * is six hundred lines long and contains an unrelated "of {" somewhere in it.
 *
 * That is the pass-for-the-wrong-reason this check exists to refuse, at a
 * smaller scale than whole-file scope but the same shape. Whole-file scope was
 * tried first and passes `ReportViewRoute` on an "of" four hundred lines from
 * the cell; component scope was tried second and passes anything inside a
 * large screen. A line window is what "beside it" actually means to a reader,
 * which is what the rule is about.
 *
 * **It can only be wrong in one direction.** Too tight a window flags a
 * percentage whose denominator is further away — a false alarm somebody
 * investigates and writes an opt-out for, naming where a reader finds it. It
 * cannot pass a genuinely bare percentage, because a bare one has no
 * denominator at any distance. §8 warns that a proxy is a second rule and that
 * two rules drift; this one cannot drift towards permitting the thing it
 * forbids, and that is the difference between an approximation chosen and one
 * settled for.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage'])
/*
 * Either comment form. A percentage is rendered in JSX children, where `//` is
 * not a comment at all — the opt-out has to be written `{/* percentage-ok: … *\/}`
 * and a guard accepting only the other form is one nobody can satisfy where it
 * fires.
 */
const OPT_OUT = /(?:\/\/|\/\*)\s*percentage-ok:\s*\S/

/** `{value}%` in JSX text. A backtick after the `%` is a CSS length. */
const RENDERED = /\}%(?!`)/

/**
 * A denominator being rendered: "N of M", in the shapes JSX writes it.
 *
 * `{covered} of{' '}{total}` and `{covered} of {total}` are the two this build
 * uses. `coverage.total` is accepted as well, because a component that reaches
 * for the total is rendering it.
 */
const DENOMINATOR = /of\{'\s*'\}|\}\s+of\s|\sof\s*\{|coverage\.total|\.total[)}]/

/** The line a top-level declaration starts on. */
const DECLARATION = /^(export\s+)?(async\s+)?(function|const|class)\s/

/**
 * How far "beside it" reaches, in lines.
 *
 * Twelve, because the widest compliant case in this build is five — the group
 * overview puts the percentage and its "213 of 306" in sibling spans — and a
 * window has to have room for a comment between them. It is a number, so it is
 * the kind of thing §8 says to be suspicious of; what makes it safe is that
 * moving it down produces false alarms and never silence.
 */
const NEARBY = 12

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      yield full
    }
  }
}

/** The lines of the declaration containing `line`, and its name. */
function componentAround(lines, line) {
  let start = line
  while (start > 0 && !DECLARATION.test(lines[start] ?? '')) start -= 1
  let end = line + 1
  while (end < lines.length && !DECLARATION.test(lines[end] ?? '')) end += 1
  const name = (lines[start] ?? '').match(/(function|const|class)\s+(\w+)/)?.[2]
  return { text: lines.slice(start, end).join('\n'), name: name ?? 'this component' }
}

const findings = []
let rendered = 0
let optOuts = 0

for await (const file of walk(SRC)) {
  const raw = await readFile(file, 'utf8')
  const source = stripComments(raw)
  const lines = source.split('\n')
  const rawLines = raw.split('\n')

  lines.forEach((line, index) => {
    if (!RENDERED.test(line)) return
    rendered += 1

    if (
      OPT_OUT.test(rawLines[index - 1] ?? '') ||
      OPT_OUT.test(rawLines[index - 2] ?? '')
    ) {
      optOuts += 1
      return
    }

    const component = componentAround(lines, index)
    const window = lines
      .slice(Math.max(0, index - NEARBY), index + NEARBY + 1)
      .join('\n')
    if (DENOMINATOR.test(window) && DENOMINATOR.test(component.text)) return

    findings.push({
      where: `${path.relative(ROOT, file)}:${index + 1}`,
      component: component.name,
      line: line.trim(),
    })
  })
}

if (findings.length > 0) {
  console.error(
    '✖ percentages: a percentage is rendered with no denominator beside it.\n' +
      '\n' +
      '  A bare count invites a question; a bare percentage answers one. "92%"\n' +
      '  reads as a finding about a home whatever it is 92% of, and nothing on\n' +
      '  the screen tells the reader it is 92% of twelve.\n' +
      '\n' +
      '  If the denominator is genuinely rendered elsewhere — a table row whose\n' +
      '  first column is the population, say — write `// percentage-ok: <why>`\n' +
      '  above the line and name where a reader finds it.\n',
  )
  for (const finding of findings)
    console.error(`  ${finding.where}  in ${finding.component}\n      ${finding.line}`)
  process.exit(1)
}

console.log(
  `✓ percentages — ${rendered} rendered, every one with its denominator within ${NEARBY} lines of it (${optOuts} deliberate)`,
)

/**
 * ## Why counts are not checked here, examined and refused
 *
 * §1 forbids bare counts in the same breath as bare percentages, and a guard
 * for them was costed and is not being built. **A number in JSX is
 * syntactically recognisable and says nothing about whether it is an
 * aggregate.** `{grid.rows.length} medications` on the MAR chart describes
 * what is visibly on the screen: its denominator is in the reader's eyes.
 * `{covered} medications` would be a claim about evidence. Identical AST,
 * opposite meanings, and no property of the source separates them, because the
 * difference is what the number is a claim *about*.
 *
 * There are over three hundred `data-numeric` sites and several hundred more
 * numbers in JSX, so any syntactic rule produces hundreds of findings that are
 * mostly legitimate. That is the exception-list failure this build has reached
 * three times already, at a scale where it would be wallpaper on the first run
 * — and wallpaper is worse than a sentence, because it reads as coverage.
 *
 * Refused rather than overlooked, so nobody re-derives it as an oversight.
 */
