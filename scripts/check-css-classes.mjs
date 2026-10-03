#!/usr/bin/env node
/**
 * A class a component applies that its stylesheet does not define — and a
 * class a stylesheet defines that no component applies.
 *
 * Wired into `verify` as `lint:cssclasses`. It landed green: the nineteen it
 * first reported — the Team invite form, the staff detail form, two
 * compliance rating lines, a dashboard bar row and the invitation password
 * counter — are styled, so a twentieth fails the build rather than joining an
 * allowlist, which is the wallpaper failure CLAUDE.md §8 names three times.
 *
 * Mutated before being trusted: deleting `.roleChoices` from
 * `team.module.css` fails it on both files that apply the class.
 *
 * **The second direction, added after it cost three hand-catches in one day.**
 * `.correctOpen` when the correction trigger moved into the header,
 * `.logRowWrap` and `.rowDownload` when the download came off the incident log
 * rows, `.nothingRemembers` when the setup subtitle went: each the same shape,
 * a class whose only consumer was deleted, each found by grep, each reported as
 * "the guard reads it the other way so I checked by hand". §8 says a check that
 * has not prevented a recurrence after three tries either becomes enforceable
 * or stops counting as coverage.
 *
 * **Why this direction is buildable where two others were refused.** The
 * lowercasing guard (30 sites, 27 legitimate) and the clock-ordered fixture
 * guard (11 sites, all legitimate) were thrown away because the legitimate
 * cases swamped the findings. CSS Modules are scoped: a class in `x.module.css`
 * has a known, finite set of possible consumers and this script already pairs
 * them. Costed before shipping — 82 findings across 24 files, and the four
 * spot-checked at random were all genuinely dead, including 30 left in
 * `me.module.css` by the commit that deleted `/me`. Legitimate exceptions: none
 * found. So it ships, and the 82 were deleted rather than allowlisted.
 *
 * Three wrinkles, each handled rather than ignored:
 *
 *   - **`composes:`** means a class can be consumed by another class rather
 *     than by a component. Both forms count as use, including
 *     `composes: x from './other.css'`, which is how every consumer reaches
 *     `unrecorded.module.css` — a file no component imports at all.
 *   - **A computed key** (`styles[whatever]`) means the set of classes reached
 *     is unknowable. In the first direction those are counted and ignored; in
 *     this one they have to suppress the whole stylesheet, or live classes get
 *     reported as dead. Three stylesheets are skipped for that reason and the
 *     success line names them, because a file it could not read is coverage it
 *     does not have.
 *   - **`:global`** selectors and anything a third party reaches are not
 *     applied through `styles.` at all, so those selectors are not collected.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const files = []
const stylesheets = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(p)) files.push(p)
    else if (/\.module\.css$/.test(p)) stylesheets.push(resolve(p))
  }
})('src')

/*
 * **The scanner, not a regex, and this file learned why the hard way.**
 * A file input carries `accept="image/[star],video/[star]"`, and a slash-star
 * inside that string reads to a regex as a comment opener: it blanked from
 * there to the next comment terminator in a docblock far below, taking eight
 * `styles.x` usages with it. The guard then reported one undefined class out
 * of nine, and printed a count over a file it had read part of — the exact
 * defect CLAUDE.md records for `check-selector-specificity`, reproduced in a
 * guard written after it and caught only because the missing class was one I
 * had just added.
 *
 * `stripComments` knows a string from a comment and throws if it ever changes
 * the length of its input. CSS gets `stripCssComments`, because a stripper for
 * one medium is not a stripper for another: the JS scanner treats a slash
 * after an opening bracket as a regex literal, which is the shape of
 * `url(/assets/x.svg)`.
 */
/** `@/x` is an alias for `src/x`; an unresolved path would read as missing. */
const resolveCss = (fromFile, spec) =>
  spec.startsWith('@/')
    ? resolve('src', spec.slice(2))
    : resolve(dirname(fromFile), spec)

function defined(cssPath) {
  const css = stripCssComments(readFileSync(cssPath, 'utf8'))
  const names = new Set()
  // Everything before a `{` is a selector list; declarations never reach here.
  for (const m of css.matchAll(/(^|\})([^{}]*)\{/g)) {
    /*
     * A `:global` selector is not reached through `styles.` and would read as
     * dead in the second direction below. Skipping the whole list rather than
     * the one name: `:global(.x) .y` has no scoped consumer either.
     */
    if (/:global/.test(m[2])) continue
    for (const cls of m[2].matchAll(/\.([A-Za-z_][\w-]*)/g)) names.add(cls[1])
  }
  return names
}

/**
 * Classes consumed by `composes:`, which is use without a component.
 *
 * Both shapes: `composes: a b;` names classes in the same file, and
 * `composes: x from './other.css'` names them in another — which is how every
 * consumer of `unrecorded.module.css` reaches it, a file no component imports.
 * Returns a map of stylesheet path to the names something composes from it.
 */
function composedFrom(cssFiles) {
  const out = new Map()
  const add = (p, n) => {
    if (!out.has(p)) out.set(p, new Set())
    out.get(p).add(n)
  }
  for (const p of cssFiles) {
    let text
    try {
      text = stripCssComments(readFileSync(p, 'utf8'))
    } catch {
      continue
    }
    for (const m of text.matchAll(/composes:\s*([^;]+);/g)) {
      const spec = m[1].trim()
      const from = /\bfrom\s+['"]([^'"]+)['"]/.exec(spec)
      const names = spec
        .replace(/\bfrom\s+['"][^'"]+['"]/, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      const target = from ? resolveCss(p, from[1]) : p
      for (const n of names) add(target, n)
    }
  }
  return out
}

let pairs = 0
let dynamic = 0
const findings = []
const unreadable = []
/*
 * Per stylesheet rather than per pair, because `notes.module.css` has
 * seventeen importers and a class is dead only if **none** of them applies it.
 * Aggregating per pair would report every class used by one component as dead
 * in the other sixteen.
 */
const appliedTo = new Map()
const computedKeyIn = new Map()
const touch = (p) => {
  if (!appliedTo.has(p)) {
    appliedTo.set(p, new Set())
    computedKeyIn.set(p, new Set())
  }
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const imports = [
    ...src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]*\.module\.css)['"]/g),
  ]
  if (!imports.length) continue
  // The import lines themselves contain `name.module.css`, which matches the
  // usage pattern below. Scanned code has them removed.
  const code = stripComments(src).replace(
    /import\s+\w+\s+from\s+['"][^'"]*\.module\.css['"]\s*;?/g,
    '',
  )

  for (const [, binding, spec] of imports) {
    const cssPath = resolveCss(file, spec)
    let names
    try {
      names = defined(cssPath)
    } catch {
      unreadable.push(`${file} -> ${spec}`)
      continue
    }
    pairs += 1
    touch(cssPath)
    const used = new Set()
    for (const m of code.matchAll(
      new RegExp(`\\b${binding}\\??\\.([A-Za-z_]\\w*)`, 'g'),
    ))
      used.add(m[1])
    for (const m of code.matchAll(
      new RegExp(`\\b${binding}\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g'),
    ))
      used.add(m[1])
    const computed = [
      ...code.matchAll(new RegExp(`\\b${binding}\\[(?!\\s*['"])[^\\]]*\\]`, 'g')),
    ].length
    dynamic += computed
    if (computed > 0) computedKeyIn.get(cssPath).add(file)
    for (const name of used) {
      appliedTo.get(cssPath).add(name)
      if (!names.has(name)) findings.push(`${file}: .${name} not in ${spec}`)
    }
  }
}

/* ---- The second direction: defined, and nothing applies it. ---- */

const composed = composedFrom(stylesheets)
const orphans = []
const skippedForComputedKeys = []
for (const cssPath of stylesheets) {
  let names
  try {
    names = defined(cssPath)
  } catch {
    continue
  }
  /*
   * A computed key makes the set of classes a component reaches unknowable, so
   * the whole stylesheet is skipped rather than its classes reported dead. The
   * success line names which ones: a file this could not read is coverage it
   * does not have, and a count that stays silent about it is the §8 failure
   * where a guard reports its activity rather than its reach.
   */
  if ((computedKeyIn.get(cssPath)?.size ?? 0) > 0) {
    skippedForComputedKeys.push(cssPath.replace(`${process.cwd()}/`, ''))
    continue
  }
  const applied = appliedTo.get(cssPath) ?? new Set()
  const viaComposes = composed.get(cssPath) ?? new Set()
  for (const name of names)
    if (!applied.has(name) && !viaComposes.has(name))
      orphans.push(
        `${cssPath.replace(`${process.cwd()}/`, '')}: .${name} is defined and nothing applies it`,
      )
}

for (const f of findings) console.error(`✖ ${f}`)
for (const o of orphans) console.error(`✖ ${o}`)
for (const u of unreadable) console.error(`? unreadable stylesheet: ${u}`)

/*
 * The count is stated against what was reached, never a bare tick: a check
 * that silently read half its input would otherwise print the same line
 * (CLAUDE.md §8). `dynamic` is the part this cannot answer — a computed key
 * is unresolvable here — so it is named rather than left out of the total.
 */
const skipNote =
  skippedForComputedKeys.length === 0
    ? ''
    : ` Stylesheets skipped in that direction for computed keys: ${skippedForComputedKeys.join(', ')}.`

const reached =
  `${String(pairs)} component/stylesheet pairs checked across ` +
  `${String(stylesheets.length)} stylesheets; ` +
  `${String(findings.length)} applied and never defined; ` +
  `${String(orphans.length)} defined and never applied; ` +
  `${String(unreadable.length)} unreadable; ` +
  `${String(dynamic)} computed keys this check cannot resolve.${skipNote}`

if (findings.length > 0 || orphans.length > 0 || unreadable.length > 0) {
  console.error(
    `\n✖ css classes — ${reached}\n` +
      '  A missing key resolves to `undefined`, so React drops the attribute ' +
      'and the element renders unstyled. A rule nothing applies is the same ' +
      'defect from the other end: it survives the deletion of its only ' +
      'consumer and reads as live styling. Neither errors, and no assertion ' +
      'in the suite can see either.',
  )
  process.exit(1)
}

console.log(`✓ css classes — ${reached}`)
