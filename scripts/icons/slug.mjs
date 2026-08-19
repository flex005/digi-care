/**
 * The icon naming rule. Single source of truth. PRD §3.4, CLAUDE.md §3.
 *
 * Names are namespaced by category, because the same filename appears in
 * more than one folder and 38 of those duplicates are genuinely different
 * artwork. A flat name would silently drop one of them.
 *
 *   ADD REMOVE DELETE/add-01.svg          -> add-remove-delete/add-01
 *   ARROWS (ROUND)/arrow-shrink -01-round.svg -> arrows-round/arrow-shrink-01-round
 *   PROGRAMMING LANGUAGE/c++.svg          -> programming-language/c-plus-plus
 *   COMMUNICATIONS/horizontal-drag-&-drop.svg -> communications/horizontal-drag-and-drop
 *
 * 28 of the 3,559 filenames are dirty — spaces, trailing spaces before the
 * numeric suffix, uppercase, `&`, `+`, a trailing underscore. The rule below
 * handles all of them deterministically. It never guesses: if two files in one
 * category reduce to the same slug, build-icons.mjs reports it rather than
 * picking a winner.
 */

/**
 * Slugify one path segment — a category folder name or a filename stem.
 *
 * `&` and `+` become words rather than separators, so `c++` and `drag-&-drop`
 * stay distinguishable instead of collapsing to `c` and `drag-drop`.
 */
export function slugSegment(segment) {
  return segment
    .toLowerCase()
    .replaceAll('&', '-and-')
    .replaceAll('+', '-plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Build the namespaced icon name from a category folder and a filename. */
export function iconNameFor(categoryDir, fileName) {
  const stem = fileName.replace(/\.svg$/i, '')
  return `${slugSegment(categoryDir)}/${slugSegment(stem)}`
}

/** The shape a string must have to be a candidate icon name. */
export const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * A unique, valid JavaScript identifier for an icon's generated import.
 * `seen` carries state across calls so a collision gets a numeric suffix
 * rather than silently overwriting an earlier import.
 */
export function identifierFor(iconName, seen) {
  const pascal = iconName
    .split('/')
    .map((part) =>
      part
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(''),
    )
    .join('_')

  let candidate = `Icon${pascal}`
  let suffix = 2
  while (seen.has(candidate)) {
    candidate = `Icon${pascal}${suffix}`
    suffix += 1
  }
  seen.add(candidate)
  return candidate
}
