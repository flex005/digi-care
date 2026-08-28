#!/usr/bin/env node
/**
 * A clinical figure is formatted by one function that owns the rule, never at
 * the call site.
 *
 * Three times now, in independently written code: "1 tablets" shipped on the
 * controlled drug register and was written again from scratch on the
 * prescription card the same day; `${days} day${days === 1 ? '' : 's'}` was
 * written twice, in two status badges, by two different routes. None was a
 * typo. It is what happens when the rule lives at the call site, and the
 * second occurrence proves there will be a third.
 *
 * So this fails the build on the shapes themselves:
 *
 *   `${n} thing${n === 1 ? '' : 's'}`   → pluralise(n, 'thing')
 *   `${n} day(s)`                       → pluralise(n, 'day')
 *
 * It cannot catch a bare `${quantity} ${unit}` — that is indistinguishable
 * from ordinary prose — so it is a net, not a proof. `units.ts` and
 * `format.ts` are where the rules live; the tests on them are what hold the
 * behaviour.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const OWNERS = ['src/lib/format.ts']

/** `${x} day${x === 1 ? '' : 's'}` and friends. */
const INLINE_TERNARY = /\$\{[^}]*\}\s*[A-Za-z]+\$\{[^}]*===\s*1[^}]*\}/g
/** `${x} day(s)` — the lazy form of the same thing. */
const PARENTHESISED = /\$\{[^}]*\}\s*[A-Za-z]+\(s\)/g
/**
 * `${daysOverdue} days` — a count whose own name says it is a count, printed
 * beside a bare plural noun.
 *
 * Narrow on purpose. `${x.length} residents` is the same defect at one, but
 * "residents" also appears in ordinary prose beside a figure, and a net that
 * fires on prose gets disabled. This one keys on the *identifier* rather than
 * on the noun, so it only fires where the expression is unambiguously a count
 * of the thing that follows it.
 */
const BARE_COUNT =
  /\$\{[^}]*(?:days|hours|minutes|weeks|months)[A-Za-z]*\}\s*(days|hours|minutes|weeks|months)\b/gi

const files = globSync('src/**/*.{ts,tsx}').filter(
  (file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
)

const findings = []

for (const file of files) {
  if (OWNERS.includes(file)) continue
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  for (const [index, line] of lines.entries()) {
    for (const pattern of [INLINE_TERNARY, PARENTHESISED, BARE_COUNT]) {
      pattern.lastIndex = 0
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}  ${line.trim()}`)
      }
    }
  }

  // The ternary form often wraps across lines when Prettier gets to it.
  const collapsed = source.replace(/\s+/g, ' ')
  INLINE_TERNARY.lastIndex = 0
  if (INLINE_TERNARY.test(collapsed) && !findings.some((f) => f.startsWith(file))) {
    findings.push(`${file}  (wrapped across lines)`)
  }
}

if (findings.length > 0) {
  console.error(
    '✖ plurals — a count and its word are being agreed at the call site.\n' +
      '  Use pluralise(count, singular) from @/lib/format, or quantityWithUnit\n' +
      '  for a unit of stock. Three of these have shipped already.\n',
  )
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}

console.log('✓ plurals — no count agrees with its word at the call site')
