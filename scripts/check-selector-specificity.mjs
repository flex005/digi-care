#!/usr/bin/env node
/**
 * A test query must name the element it means, specifically enough that
 * nothing else can satisfy it.
 *
 * **This exists because the §8 entry did not work.** "An assertion that
 * something is absent must be anchored to the thing it forbids" had been in
 * CLAUDE.md since Phase 4, and the same defect landed three times after it —
 * most recently `container.querySelector('ul')`, written to prove the empty
 * goals tab has no list, matching the profile header's risk flags list. A
 * standing check that has not prevented a recurrence after three tries is not
 * a check, it is a note. So the note became a rule.
 *
 * ## Why this is no longer about absence
 *
 * It shipped as an absence check, and the polarity was never the point.
 * `container.querySelector('[data-state="recorded"]')`, written to read the
 * allergies badge, took whichever badge came first — a fixture shift put falls
 * risk in front of it and the test failed on a screen that was working. That
 * is `querySelector('ul')` assuming the goals list, wearing a positive.
 *
 * A positive assertion reaching for a loose selector fails in the more
 * dangerous direction: it **passes on the wrong element** rather than failing
 * on the right one. So the rule is polarity-blind, and named for what it
 * checks rather than for the half of it that was written first.
 *
 * ## The two rules
 *
 * **Naming.** A query rooted on the document or on `container` must name its
 * target — by scope or by selector, either is enough:
 *
 *   scoped:    panel.querySelector('ul')          the panel is the claim
 *              within(row).getByRole('button')
 *   specific:  container.querySelector('[data-discard-draft]')
 *
 * What is neither is a claim about the whole page made with a selector that
 * matches half of it: `screen.queryByRole('button', {name: /Acknowledge/i})`,
 * `container.querySelector('ul')`.
 *
 * **Identity.** A query that picks *one* element — `querySelector`, or an
 * indexed `…All…(…)[0]` — must say which one, not only what condition it is
 * in. A condition attribute is derived rather than listed: it is one this
 * repository emits with two or more distinct literal values, which is what
 * `data-state`, `data-finding`, `data-emphasis` and `data-gap` are, and what
 * `data-badge`, `data-field` and `data-domain` (emitted from an expression,
 * one per element) are not.
 *
 * Stated honestly, that derivation is a proxy and it under-reaches: an
 * attribute always emitted from an expression reads as an identity even when
 * it names a condition, so `data-status` and `data-tone` are missed. It was
 * chosen over a hand-written vocabulary because a list of condition words
 * would need editing every time a component gained one, and a check nobody
 * maintains goes stale silently. Under-reaching with no false positives is the
 * side to fail on: every flag it raises is real.
 *
 * `querySelectorAll` without an index is not a pick — iterating every row and
 * asserting something of each is exactly what a condition selector is for.
 *
 * ## The escape hatch, and why it is not a list
 *
 * Sometimes the claim really is about the whole page — "no acknowledge control
 * anywhere on this log" — or the first match really is the subject. Then say
 * so on the line above:
 *
 *   // selector-ok: no acknowledge control exists anywhere on the log
 *
 * Per-site, and it has to carry a reason, like `@ts-expect-error`. An exception
 * list is where a guard goes to die; a reason somebody had to write is a
 * sentence a reviewer can disagree with. The count is printed so it cannot
 * quietly grow.
 */
import { readFileSync, globSync } from 'node:fs'

/** Roots that mean "the document" rather than a thing the test chose. */
const PAGE_ROOTS = ['screen', 'document']

/** Narrower than the document, but only as specific as its selector. */
const RENDER_ROOT = 'container'

const ROOTS = [...PAGE_ROOTS, RENDER_ROOT]

/**
 * The query families that can silently return the wrong thing.
 *
 * `queryBy` returns null when nothing matched, which is the whole point of an
 * absence assertion and also how a mistyped selector passes one.
 * `querySelector` returns the first of however many matched. Both are silent.
 *
 * `getBy` and `findBy` are deliberately absent: they throw on zero matches and
 * throw again on more than one, so an ambiguous name fails loudly at the call
 * rather than quietly at the wrong element. The library already enforces here
 * what this check exists to enforce elsewhere.
 */
const QUERY = String.raw`query(?:All)?By\w+|querySelectorAll|querySelector`

/**
 * The matchers that turn a sweep into a claim that nothing matched.
 *
 * `querySelectorAll` and `queryAllBy` are checked only here. Used positively
 * they are a sweep — every link on the page, every button in the panel — and a
 * sweep is supposed to be broad; used negatively they assert an absence over
 * the whole page, which is the shape that has gone wrong.
 */
const EMPTY = /\.toHaveLength\(0\)|\.toEqual\(\[\]\)|\.toBeNull\(\)|\.toBeFalsy\(\)/

/**
 * Whether the thing being queried is named specifically enough.
 *
 * **This is the discriminator, and scope is not.** Every recurrence used a
 * loose matcher: `/Acknowledge/i` matched the "Not acknowledged" filter pill,
 * and `'ul'` matched the profile header's list. Meanwhile the page-wide
 * assertions in this suite that are correct all name their target exactly —
 * `'Review'`, `'Balance after'`, `/^Acknowledge/i`.
 *
 * Specific enough is any of:
 *
 *   [data-*]              a hook that exists for the test that reads it
 *   'an exact string'     cannot match a longer label that contains it
 *   /^anchored/           cannot match a label that merely ends with it
 *   /three or more words/ long enough that a collision is not an accident
 *
 * Loose is a bare role or tag with no name at all, and a short unanchored
 * pattern — the two shapes that have actually gone wrong.
 */
function isSpecific(call) {
  // Any attribute selector: `[data-badge="allergies"]`, `a[href*="/care-plan"]`.
  if (/\[[\w-]+[\]~^$*|=]/.test(call)) return true
  if (/ByTestId/.test(call)) return true

  const name = call.match(/name:\s*(['"`])((?:(?!\1).)*)\1/)
  if (name) return true

  const pattern = call.match(/\/((?:[^/\\]|\\.)+)\/[gimsuy]*/)
  if (pattern) {
    const body = pattern[1] ?? ''
    if (body.startsWith('^')) return true
    return (body.match(/[A-Za-z]{2,}/g) ?? []).length >= 3
  }

  // A quoted argument that is not a bare tag name: queryByText('Balance after'),
  // getByLabelText('Previous week'), queryByTestId('resident').
  const quoted = call.match(/\((['"`])((?:(?!\1).)*)\1/)
  if (quoted) {
    const value = quoted[2] ?? ''
    if (/^[a-z]+$/.test(value)) return false
    return value.length > 0
  }

  return false
}

const OPT_OUT = /\/\/\s*selector-ok:\s*\S/

/**
 * Whether the document means the whole application here.
 *
 * In a component test there is no shell: the document *is* the component, and
 * `container` is the element the test itself chose to render, so both are
 * already scoped to the claim. In a test that mounts a router, the document is
 * the sidebar, the top bar, the profile header and every other thing the test
 * did not mean to ask about — which is where every recurrence happened, and
 * where `container` stops being narrow enough to mean anything.
 */
const isPageLevel = (source) =>
  source.includes('createMemoryRouter') ||
  source.includes('RouterProvider') ||
  source.includes('AppShell')

/**
 * Blank out comments, keeping every newline so line numbers still hold.
 *
 * A docblock explaining which selector went wrong last time contains that
 * selector, and the check reported it — the note about the defect read as the
 * defect. Found by this check flagging its own case study in goals.test.tsx.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (line, lead) => lead + ' '.repeat(line.length - lead.length),
    )
}

/** Collapse whitespace while keeping, for every character, its source line. */
function collapseWithLines(source) {
  let out = ''
  const lineOf = []
  let line = 0
  let inGap = false
  for (const character of source) {
    if (character === '\n') line += 1
    if (/\s/.test(character)) {
      if (!inGap) {
        out += ' '
        lineOf.push(line)
        inGap = true
      }
      continue
    }
    inGap = false
    out += character
    lineOf.push(line)
  }
  return { out, lineOf }
}

/** The call text, from its root to its closing bracket. */
function callAt(collapsed, start) {
  let depth = 0
  for (let index = start; index < collapsed.length; index += 1) {
    const character = collapsed[index]
    if (character === '(') depth += 1
    else if (character === ')') {
      depth -= 1
      if (depth === 0) return collapsed.slice(start, index + 1)
    }
  }
  return collapsed.slice(start, start + 200)
}

const files = globSync('src/**/*.test.{ts,tsx}')
const findings = []
let optOuts = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  const pageLevel = isPageLevel(source)
  const { out: collapsed, lineOf } = collapseWithLines(withoutComments(source))

  if (!pageLevel) continue
  const pattern = new RegExp(String.raw`\b(${ROOTS.join('|')})\.(${QUERY})\(`, 'g')

  for (const match of collapsed.matchAll(pattern)) {
    const start = match.index
    if (start === undefined) continue
    const text = callAt(collapsed, start)
    const method = match[2] ?? ''

    const sweep = /All/.test(method)
    const claimsEmpty = EMPTY.test(collapsed.slice(start, start + text.length + 80))
    const loose = (!sweep || claimsEmpty) && !isSpecific(text)

    if (!loose) continue

    const line = lineOf[start] ?? 0
    if (OPT_OUT.test(lines[line - 1] ?? '') || OPT_OUT.test(lines[line - 2] ?? '')) {
      optOuts += 1
      continue
    }

    findings.push({
      where: `${file}:${line + 1}`,
      code: (lines[line] ?? '').trim(),
    })
  }
}

if (findings.length > 0) {
  console.error(
    '✖ selector specificity — a query does not name the element it means.\n' +
      '  `screen` and `document` are the whole page; a bare tag or role can match\n' +
      '  something that is supposed to be present; and a selector naming only a\n' +
      '  condition takes whichever element happens to be first. Root the query on\n' +
      '  the element you mean, name it, or write `// selector-ok: <why>`.\n',
  )
  for (const finding of findings) {
    console.error(`  ${finding.where}\n    ${finding.code}`)
  }
  process.exit(1)
}

console.log(
  '✓ selector specificity — every query is scoped, named, or identified' +
    (optOuts > 0 ? ` (${optOuts} deliberate)` : ''),
)
