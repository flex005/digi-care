#!/usr/bin/env node
/**
 * A class a component applies that its stylesheet does not define.
 *
 * **NOT WIRED INTO `verify`, and it must not be counted as coverage until it
 * is.** It currently reports 19 real findings across four stylesheets — the
 * Team invite form, the staff detail form, two compliance rating lines, a
 * dashboard bar and the invitation password counter — and a guard that ships
 * red is a guard nobody can act on. The alternative, an allowlist of 19
 * exceptions, is the wallpaper failure CLAUDE.md §8 names three times. So the
 * order is: style the 19, then wire this into `verify`, where it lands green
 * and any twentieth fails the build.
 *
 * CSS Modules resolve a missing key to `undefined`, React drops the attribute,
 * and nothing errors: the element renders unstyled. No assertion in this suite
 * can see it, because nothing in the DOM differs between a class that exists
 * and one that does not.
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

for (const f of findings) console.log(`✖ ${f}`)
for (const u of unreadable) console.log(`? unreadable stylesheet: ${u}`)
console.log(
  `\n${String(pairs)} component/stylesheet pairs checked; ` +
    `${String(findings.length)} undefined; ` +
    `${String(unreadable.length)} unreadable; ` +
    `${String(dynamic)} computed keys unresolvable.`,
)
