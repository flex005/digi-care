/**
 * Find every icon name used in source. PRD §3.4 step 4.
 *
 * Two tiers, deliberately requiring no type information:
 *
 *   Tier 1 — JSX, authoritative.
 *     <Icon name="medical/stethoscope" />   and   name={'medical/stethoscope'}
 *     Every match is an icon name and must exist in the folder.
 *
 *   Tier 2 — lookup maps.
 *     Files named *.icons.ts / *.icons.tsx have every string literal shaped
 *     like an icon name treated as one. This is the sanctioned way to hold a
 *     Record<Something, IconName> whose names are not written inline in JSX
 *     — the sidebar's nav-items.icons.ts, for instance.
 *
 * Anything else — a name built by concatenation, a name arriving from fixture
 * data — is not discoverable and is therefore not supported. That is
 * intentional: an icon name must be statically visible, or the bundle cannot
 * be correct. Scanning every string literal in the project was the
 * alternative, and it mistakes route paths like 'residents/notes' for icons.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ICON_NAME_PATTERN } from './slug.mjs'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

const SKIP_DIRECTORIES = new Set(['node_modules', 'assets', 'dist', 'coverage', '.git'])

const SKIP_FILES = new Set(['registry.generated.ts', 'registry.names.generated.ts'])

/**
 * <Icon … name="…" /> and <Icon … name={…} /> across newlines.
 *
 * The braced form captures the whole expression rather than a single literal,
 * because `name={condition ? 'a/b' : 'c/d'}` is a natural thing to write and
 * an earlier version of this scanner silently missed it — the name typechecked
 * (it is a valid IconName) and the generator saw no usage, so it failed at
 * runtime instead of at build time. Every quoted string inside the braces is
 * now treated as a used name.
 */
const JSX_USAGE = /<Icon\b[^>]*?\bname=(?:"([^"]+)"|\{([^}]*)\})/g

/** Quoted strings inside a `name={…}` expression. */
const NESTED_LITERAL = /'([^'\n]+)'|"([^"\n]+)"/g

/** Any single- or double-quoted string, for *.icons.ts files. */
const ANY_STRING_LITERAL = /'([^'\n]*)'|"([^"\n]*)"/g

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      yield* walk(full)
    } else if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !SKIP_FILES.has(entry.name)
    ) {
      yield full
    }
  }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/**
 * @param {string} srcDir
 * @returns {Promise<Map<string, Array<{file: string, line: number}>>>}
 *   icon name -> every place it is used
 */
export async function scanUsage(srcDir) {
  const used = new Map()

  const record = (name, file, line) => {
    const sites = used.get(name) ?? []
    sites.push({ file: path.relative(process.cwd(), file), line })
    used.set(name, sites)
  }

  for await (const file of walk(srcDir)) {
    const text = await readFile(file, 'utf8')

    // Tier 1
    for (const match of text.matchAll(JSX_USAGE)) {
      const line = lineOf(text, match.index)
      if (match[1] !== undefined) {
        record(match[1], file, line)
        continue
      }
      // A braced expression: take the quoted strings that are shaped like an
      // icon name. The shape filter matters — `name={cond ? 'a/b' : 'c/d'}`
      // also contains the literal from the condition, and reporting
      // `"ascending"` as a missing icon would be a false alarm that teaches
      // people to distrust this check.
      //
      // A typo that keeps the shape ("medical/stethoscopee") is still caught
      // here; one that loses it is caught by tsc, since it is not a member of
      // the IconName union. Between them the coverage is complete.
      //
      // A name built by concatenation, or arriving from fixture data, remains
      // undiscoverable — deliberately. It must be statically visible or the
      // bundle cannot be correct.
      for (const nested of (match[2] ?? '').matchAll(NESTED_LITERAL)) {
        const name = nested[1] ?? nested[2]
        if (name !== undefined && ICON_NAME_PATTERN.test(name)) {
          record(name, file, line)
        }
      }
    }

    // Tier 2
    if (/\.icons\.tsx?$/.test(file)) {
      for (const match of text.matchAll(ANY_STRING_LITERAL)) {
        const value = match[1] ?? match[2]
        if (ICON_NAME_PATTERN.test(value)) {
          record(value, file, lineOf(text, match.index))
        }
      }
    }
  }

  return used
}
