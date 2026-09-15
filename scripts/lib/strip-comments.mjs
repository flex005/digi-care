/**
 * Blank out comments, keeping every character position and every newline.
 *
 * **Written because a regex could not do this and failed in the direction of a
 * tick.** `check-selector-specificity.mjs` stripped comments with
 * `/\/\*[\s\S]*?\*\//g`, which cannot tell a comment from a string that
 * contains one. `authority.test.tsx` has the line
 *
 *     .filter((path) => !path.includes(':') && path !== '/*')
 *
 * excluding the router's catch-all route. The regex paired that `/*` with the
 * next block-comment terminator ninety-three lines later and blanked
 * everything between them, including four queries the guard exists to check. It printed
 * "every query is scoped, named, or identified" over a file it had read a
 * third of, and the hole moved every time somebody edited a docblock, so the
 * same guard gave two verdicts on an identical line.
 *
 * That is the §8 class about a check narrower than its own success message,
 * and it is worse here than usual: the blindness is invisible in the output
 * and it drifts with unrelated edits.
 *
 * So the scanner walks the source once and knows what it is inside: a line
 * comment, a block comment, a single- or double-quoted string, a template
 * literal, or a regex literal. Only the comment states are blanked. Regex
 * literals are recognised by what precedes them, which is the standard
 * heuristic and the only one available without parsing: a `/` after a value
 * is division, a `/` after an operator or an opening bracket starts a pattern.
 * Getting that wrong costs a false finding rather than a silent hole, which is
 * the right direction to fail in.
 */

const BEFORE_REGEX = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
  '\n',
])

export function stripComments(source) {
  let out = ''
  let index = 0
  let lastSignificant = '\n'

  const blank = (text) => text.replace(/[^\n]/g, ' ')

  while (index < source.length) {
    const two = source.slice(index, index + 2)

    if (two === '//') {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      out += blank(source.slice(index, stop))
      index = stop
      continue
    }

    if (two === '/*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += blank(source.slice(index, stop))
      index = stop
      continue
    }

    const character = source[index]

    if (character === '"' || character === "'" || character === '`') {
      const start = index
      index += 1
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2
          continue
        }
        if (source[index] === character) {
          index += 1
          break
        }
        index += 1
      }
      out += source.slice(start, index)
      lastSignificant = character
      continue
    }

    if (character === '/' && BEFORE_REGEX.has(lastSignificant)) {
      const start = index
      index += 1
      let inClass = false
      while (index < source.length) {
        const current = source[index]
        if (current === '\\') {
          index += 2
          continue
        }
        if (current === '\n') break
        if (current === '[') inClass = true
        else if (current === ']') inClass = false
        else if (current === '/' && !inClass) {
          index += 1
          break
        }
        index += 1
      }
      out += source.slice(start, index)
      lastSignificant = '/'
      continue
    }

    out += character
    if (!/\s/.test(character)) lastSignificant = character
    else if (character === '\n') lastSignificant = '\n'
    index += 1
  }

  if (out.length !== source.length)
    throw new Error(
      `stripComments changed the length of the source (${source.length} to ${out.length}). Every guard that uses it maps findings back to line numbers, so a shifted offset reports the wrong line.`,
    )

  return out
}

/**
 * The same job for CSS, which needs a different scanner rather than this one.
 *
 * **Not the JavaScript one with a different file extension.** That scanner
 * treats `/` after `(` as the start of a regex literal, and `url(/assets/x.svg)`
 * is exactly that shape: it would swallow the rest of the declaration. CSS has
 * no regex and no template literals, so what it needs is block comments and
 * quoted strings and nothing else.
 *
 * `check-tokens.mjs` reads CSS and had the same regex the selector guard had.
 * The failure needs `content: "/*"` to appear in a stylesheet, which is rarer
 * than the JavaScript case and is the same defect waiting.
 */
export function stripCssComments(source) {
  let out = ''
  let index = 0
  const blank = (text) => text.replace(/[^\n]/g, ' ')

  while (index < source.length) {
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += blank(source.slice(index, stop))
      index = stop
      continue
    }

    const character = source[index]
    if (character === '"' || character === "'") {
      const start = index
      index += 1
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2
          continue
        }
        if (source[index] === character) {
          index += 1
          break
        }
        if (source[index] === '\n') break
        index += 1
      }
      out += source.slice(start, index)
      continue
    }

    out += character
    index += 1
  }

  if (out.length !== source.length)
    throw new Error('stripCssComments changed the length of the source.')

  return out
}
