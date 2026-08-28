#!/usr/bin/env node
/**
 * `npm run icons` — the icon pipeline. PRD §3.4, CLAUDE.md §3.
 *
 * There is no icon library in this project and there never will be. Icons come
 * from the Aligned Line Icons set in src/assets/icons/, which is 3,559 SVGs
 * across 56 category folders (the docs say ~40; the folder says 56).
 *
 * Five steps:
 *   1. Enumerate every .svg, slug it, and report ALL naming collisions at once.
 *   2. Emit registry.names.generated.ts — the full IconName union. Types only,
 *      zero runtime cost. This is what makes an invalid name fail to typecheck.
 *   3. Scan source for the icons actually used.
 *   4. Normalise just those to currentColor and copy them to
 *      src/assets/icons-generated/ under slugged, space-free paths.
 *   5. Emit registry.generated.ts — an import map of only those icons.
 *      Importing all 3,559 would compile every one into the bundle.
 *
 * A name used in source but absent from the folder fails the build, loudly,
 * naming the icon, every place it is used, and the closest real names.
 * Nothing is ever substituted. CLAUDE.md §3.
 *
 * `--check` regenerates in memory and diffs against the committed files,
 * failing if they are stale. Wired into `npm run verify` for CI.
 *
 * Neither generated file is ever hand-typed or hand-edited.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { iconNameFor, identifierFor } from './slug.mjs'
import { normaliseSvg } from './normalise-svg.mjs'
import { scanUsage } from './scan-usage.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(ROOT, 'src')
const RAW_ICONS = path.join(SRC, 'assets/icons')
const OUT_ICONS = path.join(SRC, 'assets/icons-generated')
const OUT_DIR = path.join(SRC, 'components/icon')
const NAMES_FILE = path.join(OUT_DIR, 'registry.names.generated.ts')
const REGISTRY_FILE = path.join(OUT_DIR, 'registry.generated.ts')

const CHECK_MODE = process.argv.includes('--check')

const BANNER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced by \`npm run icons\` (scripts/icons/build-icons.mjs) from the
 * contents of src/assets/icons/. Hand-editing it will be overwritten on the
 * next run, and \`npm run icons:check\` will fail CI in the meantime.
 * CLAUDE.md §3.
 */`

const rel = (p) => path.relative(ROOT, p)

// ---------------------------------------------------------------------------
// 1. Enumerate the folder
// ---------------------------------------------------------------------------

async function enumerateIcons() {
  const entries = await readdir(RAW_ICONS, { withFileTypes: true })
  const categories = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  /** @type {Map<string, string[]>} icon name -> source paths that produced it */
  const byName = new Map()
  let svgCount = 0
  let skipped = 0

  for (const category of categories) {
    const dir = path.join(RAW_ICONS, category)
    const files = await readdir(dir)
    for (const file of files) {
      // The set ships 182 stray PNGs and a .DS_Store alongside the SVGs.
      if (!file.toLowerCase().endsWith('.svg')) {
        skipped += 1
        continue
      }
      svgCount += 1
      const name = iconNameFor(category, file)
      const sources = byName.get(name) ?? []
      sources.push(path.join(category, file))
      byName.set(name, sources)
    }
  }

  return { byName, categories, svgCount, skipped }
}

/**
 * Report EVERY collision in one pass, then exit. Stopping at the first one
 * would mean one run per collision; this way a single run describes the whole
 * problem. A winner is never picked silently.
 */
function reportCollisions(byName) {
  const collisions = [...byName.entries()].filter(([, sources]) => sources.length > 1)
  if (collisions.length === 0) return false

  console.error(
    `\n✖ icons: ${collisions.length} naming collision${collisions.length === 1 ? '' : 's'} — two or more files in one category reduce to the same name.\n`,
  )
  for (const [name, sources] of collisions.sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`  ${name}`)
    for (const source of sources.sort()) {
      console.error(`      src/assets/icons/${source}`)
    }
  }
  console.error(
    '\n  Nothing was generated. Rename the source files so each reduces to a distinct',
    '\n  name, then re-run. The naming rule lives in scripts/icons/slug.mjs.\n',
  )
  return true
}

// ---------------------------------------------------------------------------
// 2 & 5. Generated file contents
// ---------------------------------------------------------------------------

function renderNamesFile(names) {
  const union = names.map((name) => `  | '${name}'`).join('\n')
  return `${BANNER}

/**
 * Every icon in src/assets/icons/, namespaced by category.
 * ${names.length} names across the set.
 *
 * Types only — this file compiles to nothing. It is what gives autocomplete on
 * <Icon name="…" /> and what makes a name that is not in the folder fail to
 * typecheck.
 */
export type IconName =
${union}
`
}

function renderRegistryFile(entries) {
  const imports = entries
    .map(
      ({ identifier, name }) =>
        `import ${identifier} from '@/assets/icons-generated/${name}.svg?react'`,
    )
    .join('\n')

  const map = entries
    .map(({ identifier, name }) => `  '${name}': ${identifier},`)
    .join('\n')

  return `${BANNER}

import type { ComponentType, SVGProps } from 'react'
import type { IconName } from './registry.names.generated'

${imports}

/**
 * Only the ${entries.length} icon${entries.length === 1 ? '' : 's'} actually used in source. Importing all of them
 * would compile every icon in the set into the bundle.
 *
 * Partial because it is keyed by the full IconName union. A missing entry
 * means this file is stale — run \`npm run icons\`. Icon.tsx says so rather
 * than falling back to a substitute glyph.
 */
export const iconRegistry: Partial<
  Record<IconName, ComponentType<SVGProps<SVGSVGElement>>>
> = {
${map}
}
`
}

// ---------------------------------------------------------------------------
// Missing-name reporting
// ---------------------------------------------------------------------------

/** Levenshtein, for "did you mean". */
function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ])
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return rows[a.length][b.length]
}

function reportMissing(missing, allNames) {
  console.error(
    `\n✖ icons: ${missing.length} icon name${missing.length === 1 ? '' : 's'} used in source but not present in src/assets/icons/.\n`,
  )
  for (const [name, sites] of missing) {
    console.error(`  "${name}"`)
    for (const site of sites) {
      console.error(`      used at ${site.file}:${site.line}`)
    }
    const suggestions = allNames
      .map((candidate) => [candidate, distance(name, candidate)])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([candidate]) => candidate)
    console.error(`      did you mean: ${suggestions.join('  ·  ')}`)
    console.error('')
  }
  console.error(
    '  Nothing was generated. If the icon you need is genuinely not in the set,',
    '\n  stop and ask — do not substitute an inline SVG, an emoji, a character glyph,',
    '\n  or a similar-looking icon. CLAUDE.md §3.\n',
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { byName, categories, svgCount, skipped } = await enumerateIcons()

  if (reportCollisions(byName)) process.exit(1)

  const allNames = [...byName.keys()].sort()

  // ---- 3. What is actually used ----
  const usage = await scanUsage(SRC)
  const known = new Set(allNames)
  const missing = [...usage.entries()]
    .filter(([name]) => !known.has(name))
    .sort(([a], [b]) => a.localeCompare(b))

  if (missing.length > 0) {
    reportMissing(missing, allNames)
    process.exit(1)
  }

  const usedNames = [...usage.keys()].sort()

  // ---- Render both generated files ----
  const seenIdentifiers = new Set()
  const entries = usedNames.map((name) => ({
    name,
    identifier: identifierFor(name, seenIdentifiers),
    source: byName.get(name)[0],
  }))

  const namesContent = renderNamesFile(allNames)
  const registryContent = renderRegistryFile(entries)

  if (CHECK_MODE) {
    const stale = []
    for (const [file, expected] of [
      [NAMES_FILE, namesContent],
      [REGISTRY_FILE, registryContent],
    ]) {
      const actual = await readFile(file, 'utf8').catch(() => null)
      if (actual !== expected) stale.push(rel(file))
    }
    if (stale.length > 0) {
      console.error(
        `\n✖ icons:check — generated files are stale:\n${stale.map((f) => `      ${f}`).join('\n')}\n`,
        '\n  Run `npm run icons` and commit the result.\n',
      )
      process.exit(1)
    }

    /*
     * **And the icons the registry imports are actually on disk.**
     *
     * The two generated files are committed and the normalised copies are not,
     * so on a fresh clone the registry is perfectly current and every icon it
     * imports is missing. This check passed in exactly that state and said
     * "registry is current" — true of the files it compared and useless to
     * somebody whose test suite had just failed to resolve forty-six modules
     * with no mention of icons anywhere in the error.
     *
     * A check whose success message is wider than what it verifies is the same
     * defect this project keeps finding elsewhere. `postinstall` now generates
     * them, and this is what says so when something has gone wrong with that.
     */
    const missing = []
    for (const { name } of entries) {
      const file = path.join(OUT_ICONS, `${name}.svg`)
      if (
        !(await readFile(file).then(
          () => true,
          () => false,
        ))
      )
        missing.push(rel(file))
    }
    if (missing.length > 0) {
      console.error(
        `\n✖ icons:check — the registry is current and ${missing.length} of the icons it imports are not on disk.\n`,
        `\n      ${missing.slice(0, 3).join('\n      ')}${missing.length > 3 ? `\n      … and ${missing.length - 3} more` : ''}\n`,
        '\n  These are generated rather than committed. `npm install` runs `npm run icons`;',
        '\n  run it directly if the install was skipped with --ignore-scripts.\n',
      )
      process.exit(1)
    }

    console.log(
      `✓ icons:check — registry is current, ${usedNames.length} icons on disk (${allNames.length} available)`,
    )
    return
  }

  // ---- 4. Normalise and copy just the used icons ----
  await rm(OUT_ICONS, { recursive: true, force: true })
  const unexpectedColours = new Set()

  for (const { name, source } of entries) {
    const raw = await readFile(path.join(RAW_ICONS, source), 'utf8')
    const { svg, colours } = normaliseSvg(raw, name.replace('/', '-'))
    for (const colour of colours) {
      if (colour !== '#141b34') unexpectedColours.add(colour)
    }
    const target = path.join(OUT_ICONS, `${name}.svg`)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, svg, 'utf8')
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(NAMES_FILE, namesContent, 'utf8')
  await writeFile(REGISTRY_FILE, registryContent, 'utf8')

  console.log(
    `✓ icons — ${svgCount} SVGs in ${categories.length} categories` +
      (skipped > 0 ? ` (${skipped} non-SVG files ignored)` : ''),
  )
  console.log(`  ${allNames.length} names  ->  ${rel(NAMES_FILE)}`)
  console.log(
    `  ${usedNames.length} used   ->  ${rel(REGISTRY_FILE)} + ${rel(OUT_ICONS)}/`,
  )
  if (unexpectedColours.size > 0) {
    console.log(
      `  note: normalised colours beyond the expected #141B34: ${[...unexpectedColours].join(', ')}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
