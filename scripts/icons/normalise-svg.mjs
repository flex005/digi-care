/**
 * Normalise a raw icon to currentColor. PRD §3.4 step 2.
 *
 * Source icons are never hand-edited (CLAUDE.md §3). This runs at build time
 * over a copy, and only over the icons actually used.
 *
 * What the source set actually contains, measured across all 3,559 files:
 *   - exactly one colour, #141B34: 11,410 `stroke=` and 574 `fill=`
 *   - 3,559 root `fill="none"`, which must survive untouched
 *   - 5 `fill="white"`: four clipPath rects and TRANSPORTATION/ambulance.svg
 *   - 4 files with <defs>/<clipPath> carrying global ids like clip0_8942_12006
 *
 * So a stroke-only rewrite would leave 484 files (13.6%) still hard-coded.
 * Both attributes are rewritten; `none` and `white` are left alone.
 */

const HEX_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * Rewrite every hex-valued fill/stroke to currentColor, and namespace any
 * internal ids so two inlined icons on one page cannot collide.
 *
 * @param {string} source raw SVG markup
 * @param {string} idPrefix stable per-icon prefix, derived from its name
 * @returns {{ svg: string, colours: Set<string> }}
 */
export function normaliseSvg(source, idPrefix) {
  const colours = new Set()

  let svg = source.replace(/\b(fill|stroke)="([^"]*)"/g, (match, attribute, value) => {
    if (HEX_COLOUR.test(value.trim())) {
      colours.add(value.trim().toLowerCase())
      return `${attribute}="currentColor"`
    }
    // `none` and `white` are structural, not decorative: `fill="none"` is on
    // every root element, and `white` belongs to clip rects and one piece of
    // artwork. Recolouring either would break the icon.
    return match
  })

  // Namespace ids. Only 4 files in the set have them, but an id collision
  // between two inlined icons is silent and very hard to trace.
  const ids = new Set()
  for (const match of svg.matchAll(/\bid="([^"]+)"/g)) {
    ids.add(match[1])
  }
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    svg = svg
      .replace(new RegExp(`\\bid="${escaped}"`, 'g'), `id="${idPrefix}-${id}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${idPrefix}-${id})`)
      .replace(
        new RegExp(`(xlink:href|href)="#${escaped}"`, 'g'),
        `$1="#${idPrefix}-${id}"`,
      )
  }

  return { svg, colours }
}
