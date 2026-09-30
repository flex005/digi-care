#!/usr/bin/env node
/**
 * A class a component applies that its stylesheet does not define.
 *
 * Wired into `verify` as `lint:cssclasses`. It landed green: the nineteen it
 * first reported — the Team invite form, the staff detail form, two
 * compliance rating lines, a dashboard bar row and the invitation password
 * counter — are styled, so a twentieth fails the build rather than joining an
 * allowlist, which is the wallpaper failure CLAUDE.md §8 names three times.
 *
 * Mutated before being trusted: deleting `.roleChoices` from
 * `team.module.css` fails it on both files that apply the class.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(p)) files.push(p)
  }
})('src')

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
/** `@/x` is an alias for `src/x`; an unresolved path would read as missing. */
const resolveCss = (fromFile, spec) =>
  spec.startsWith('@/')
    ? resolve('src', spec.slice(2))
    : resolve(dirname(fromFile), spec)

function defined(cssPath) {
  const css = stripComments(readFileSync(cssPath, 'utf8'))
  const names = new Set()
  // Everything before a `{` is a selector list; declarations never reach here.
  for (const m of css.matchAll(/(^|\})([^{}]*)\{/g))
    for (const cls of m[2].matchAll(/\.([A-Za-z_][\w-]*)/g)) names.add(cls[1])
  return names
}

let pairs = 0
let dynamic = 0
const findings = []
const unreadable = []

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
    const used = new Set()
    for (const m of code.matchAll(
      new RegExp(`\\b${binding}\\??\\.([A-Za-z_]\\w*)`, 'g'),
    ))
      used.add(m[1])
    for (const m of code.matchAll(
      new RegExp(`\\b${binding}\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g'),
    ))
      used.add(m[1])
    dynamic += [
      ...code.matchAll(new RegExp(`\\b${binding}\\[(?!\\s*['"])[^\\]]*\\]`, 'g')),
    ].length
    for (const name of used)
      if (!names.has(name)) findings.push(`${file}: .${name} not in ${spec}`)
  }
}

for (const f of findings) console.error(`✖ ${f}`)
for (const u of unreadable) console.error(`? unreadable stylesheet: ${u}`)

/*
 * The count is stated against what was reached, never a bare tick: a check
 * that silently read half its input would otherwise print the same line
 * (CLAUDE.md §8). `dynamic` is the part this cannot answer — a computed key
 * is unresolvable here — so it is named rather than left out of the total.
 */
const reached =
  `${String(pairs)} component/stylesheet pairs checked; ` +
  `${String(findings.length)} applied and never defined; ` +
  `${String(unreadable.length)} unreadable; ` +
  `${String(dynamic)} computed keys this check cannot resolve.`

if (findings.length > 0 || unreadable.length > 0) {
  console.error(
    `\n✖ css classes — ${reached}\n` +
      '  A missing key resolves to `undefined`, so React drops the attribute ' +
      'and the element renders unstyled. Nothing errors, and no assertion in ' +
      'the suite can see it.',
  )
  process.exit(1)
}

console.log(`✓ css classes — ${reached}`)
