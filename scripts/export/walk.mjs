/**
 * The page-side walker, as a string.
 *
 * **It runs inside the page, after the browser has resolved everything.** That
 * is the whole point of the approach: `var()`, `rem`, `fr`, `gap`, `grid` and
 * percentages are all gone by the time `getComputedStyle` answers, so what is
 * captured is pixels and colours rather than instructions somebody else has to
 * interpret. html.to.design does not have to understand our stylesheet because
 * the output does not contain one.
 */
export const WALKER = String(function walk(options) {
  const { stripHeight, weights } = options
  const out = []
  const rounded = []
  const skipped = { hidden: 0, empty: 0 }

  const nearestWeight = (value) =>
    weights.reduce((best, candidate) =>
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
    )

  const px = (value) => `${Math.round(value)}px`
  const escape = (text) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  /** Transparent in every spelling a browser returns. */
  const invisible = (colour) =>
    colour === 'transparent' ||
    colour === 'rgba(0, 0, 0, 0)' ||
    /rgba\([^)]*,\s*0\)$/.test(colour)

  /**
   * The most visible layer of a shadow.
   *
   * Figma takes one shadow per effect and our cards carry two: a tight
   * contact shadow and a wide soft one. The wide one is what a reader sees as
   * elevation, so blur decides.
   */
  const oneShadow = (value) => {
    if (!value || value === 'none') return null
    const layers = value.split(/,(?![^(]*\))/).map((layer) => layer.trim())
    if (layers.length === 1) return layers[0]
    let best = layers[0]
    let widest = -1
    for (const layer of layers) {
      const lengths = layer.match(/-?\d+(?:\.\d+)?px/g) ?? []
      const blur = lengths.length > 2 ? parseFloat(lengths[2]) : 0
      if (blur > widest) {
        widest = blur
        best = layer
      }
    }
    return best
  }

  /**
   * The hatch, redrawn as an SVG pattern.
   *
   * `repeating-linear-gradient` does not exist in Figma, and this is the one
   * background in the product that carries meaning rather than decoration: it
   * says nobody recorded this. Dropping it would turn a gap into a blank, so it
   * is re-emitted as geometry at the same size, behind the element's own text.
   */
  const hatchSvg = (width, height, radius) => {
    const id = `h${out.length}`
    return (
      `<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">` +
      `<defs><pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="12" height="12" fill="#f2f1f6"></rect>` +
      `<rect width="6" height="12" fill="#8e86a8" fill-opacity="0.55"></rect>` +
      `</pattern></defs>` +
      `<rect width="${width}" height="${height}" rx="${radius}" fill="url(#${id})"></rect>` +
      `</svg>`
    )
  }

  /**
   * Content that exists for assistive technology and is not on screen.
   *
   * `.visuallyHidden` is a 1px box with `clip-path: inset(50%)`, and the
   * skip-to-content link sits off the top until it takes focus. Neither is
   * `display:none`, so neither is caught by the checks above — and both have
   * real client rects, which is how a tile's whole accessible sentence came out
   * printed across the label it summarises.
   */
  const forScreenReadersOnly = (element, style, rect) => {
    if (/inset\(50%\)/.test(style.clipPath)) return true
    if (style.clip === 'rect(0px, 0px, 0px, 0px)') return true
    if (rect.width <= 1 && rect.height <= 1) return true
    // Off the top or the left of the document entirely.
    if (rect.bottom <= 0 || rect.right <= 0) return true
    return false
  }

  const doc = document
  const root = doc.documentElement

  /*
   * **Scroll containers are opened out before anything is measured.** The shell
   * is `height: 100vh; overflow: hidden` with the main region scrolling inside
   * it, which is what a fixed rail beside a long page is — and it means a
   * capture would get one viewport of content and a rail cut off at the fold.
   * Opened out, the geometry is the whole page, which is what a design file
   * wants.
   */
  for (const element of doc.querySelectorAll('*')) {
    const style = getComputedStyle(element)
    const scrolls =
      element.scrollHeight > element.clientHeight + 1 &&
      /auto|scroll|hidden/.test(style.overflowY)
    if (scrolls || style.height === `${window.innerHeight}px`) {
      element.style.setProperty('height', 'auto', 'important')
      element.style.setProperty('max-height', 'none', 'important')
      element.style.setProperty('overflow', 'visible', 'important')
    }
  }
  void root.offsetHeight

  const originX = 0
  const originY = 0

  const emit = (html) => out.push(html)

  const walkNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? ''
      if (text.trim() === '') return
      const range = doc.createRange()
      range.selectNodeContents(node)
      const rects = [...range.getClientRects()]
      if (rects.length === 0) return
      const left = Math.min(...rects.map((r) => r.left))
      const top = Math.min(...rects.map((r) => r.top))
      const right = Math.max(...rects.map((r) => r.right))
      const bottom = Math.max(...rects.map((r) => r.bottom))
      const parent = node.parentElement
      if (parent === null) return
      const style = getComputedStyle(parent)

      const declared = parseInt(style.fontWeight, 10) || 400
      const weight = nearestWeight(declared)
      if (weight !== declared) {
        rounded.push({
          from: declared,
          to: weight,
          text: text.trim().slice(0, 60),
          tag: parent.tagName.toLowerCase(),
        })
      }

      emit(
        `<div style="position:absolute;left:${px(left - originX)};top:${px(
          top - originY + stripHeight,
        )};width:${px(right - left + 1)};height:${px(bottom - top)};` +
          `color:${style.color};font-family:Manrope,sans-serif;font-size:${style.fontSize};` +
          `font-weight:${weight};line-height:${style.lineHeight};` +
          `letter-spacing:${style.letterSpacing === 'normal' ? '0px' : style.letterSpacing};` +
          `text-align:${
            style.textAlign === 'start'
              ? 'left'
              : style.textAlign === 'end'
                ? 'right'
                : style.textAlign
          };text-transform:${style.textTransform};` +
          `white-space:${/pre/.test(style.whiteSpace) ? style.whiteSpace : 'normal'};">` +
          escape(text.trim()) +
          `</div>`,
      )
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node
    const tag = element.tagName.toLowerCase()
    if (
      ['script', 'style', 'link', 'meta', 'title', 'head', 'noscript'].includes(tag)
    ) {
      return
    }

    const style = getComputedStyle(element)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      skipped.hidden += 1
      return
    }

    const rect = element.getBoundingClientRect()
    if (forScreenReadersOnly(element, style, rect)) {
      skipped.hidden += 1
      return
    }
    const left = rect.left - originX
    const top = rect.top - originY + stripHeight

    /*
     * An `<svg>` goes out whole. The charts are the only vector geometry in the
     * product and they are self-contained: every pattern they fill with is
     * declared inside the same `<svg>`, so the element survives being lifted
     * out of the page.
     */
    if (tag === 'svg') {
      if (rect.width > 0 && rect.height > 0) {
        const clone = element.cloneNode(true)
        clone.setAttribute('width', String(Math.round(rect.width)))
        clone.setAttribute('height', String(Math.round(rect.height)))
        // The stylesheet is not coming with it, so the paint is inlined.
        const source = element.querySelectorAll('*')
        const copies = clone.querySelectorAll('*')
        source.forEach((original, index) => {
          const painted = getComputedStyle(original)
          const target = copies[index]
          if (target === undefined) return
          /*
           * **Stated, including `none`.** The stylesheet does not travel with
           * the element, and an SVG shape with no `fill` defaults to black —
           * so a circle whose CSS says `fill: none` arrives as a solid black
           * disc. That is the same defect this build already paid for once, on
           * this very donut, and skipping the attribute rather than writing it
           * is how an exporter reintroduces it.
           */
          if (!target.getAttribute('fill')?.startsWith('url(')) {
            target.setAttribute('fill', invisible(painted.fill) ? 'none' : painted.fill)
          }
          if (!target.getAttribute('stroke')?.startsWith('url(')) {
            target.setAttribute(
              'stroke',
              invisible(painted.stroke) ? 'none' : painted.stroke,
            )
          }
          if (painted.strokeWidth && painted.strokeWidth !== '1px') {
            target.setAttribute('stroke-width', painted.strokeWidth)
          }
          if (painted.strokeLinecap && painted.strokeLinecap !== 'butt') {
            target.setAttribute('stroke-linecap', painted.strokeLinecap)
          }
          /*
           * A dash that is genuinely a dash. The charts draw arcs as paths
           * now, so every remaining dash-array in the source is an outline
           * somebody meant to be dashed — today's bar, the legend swatch — and
           * dropping it turns a provisional edge into a settled one.
           */
          if (painted.strokeDasharray && painted.strokeDasharray !== 'none') {
            target.setAttribute('stroke-dasharray', painted.strokeDasharray)
          }
          if (original.tagName.toLowerCase() === 'text') {
            target.setAttribute('font-size', painted.fontSize)
            target.setAttribute(
              'font-weight',
              String(nearestWeight(parseInt(painted.fontWeight, 10) || 400)),
            )
            target.setAttribute('font-family', 'Manrope, sans-serif')
          }
        })
        emit(
          `<div style="position:absolute;left:${px(left)};top:${px(top)};width:${px(
            rect.width,
          )};height:${px(rect.height)};">${clone.outerHTML}</div>`,
        )
      }
      return
    }

    if (rect.width === 0 || rect.height === 0) {
      skipped.empty += 1
    } else {
      const background = style.backgroundColor
      const hatched = /repeating-linear-gradient/.test(style.backgroundImage)
      const radius = style.borderRadius
      const shadow = oneShadow(style.boxShadow)

      const borders = ['Top', 'Right', 'Bottom', 'Left']
        .map((side) => ({
          side,
          width: parseFloat(style[`border${side}Width`]),
          style: style[`border${side}Style`],
          colour: style[`border${side}Color`],
        }))
        .filter(
          (border) =>
            border.width > 0 && border.style !== 'none' && !invisible(border.colour),
        )

      const uniform =
        borders.length === 4 &&
        borders.every(
          (border) =>
            border.width === borders[0].width &&
            border.style === borders[0].style &&
            border.colour === borders[0].colour,
        )

      const paint = []
      if (!invisible(background)) paint.push(`background:${background}`)
      if (uniform) {
        paint.push(
          `border:${borders[0].width}px ${borders[0].style} ${borders[0].colour}`,
        )
      } else {
        for (const border of borders) {
          paint.push(
            `border-${border.side.toLowerCase()}:${border.width}px ${border.style} ${border.colour}`,
          )
        }
      }
      if (radius !== '0px') paint.push(`border-radius:${radius}`)
      if (shadow) paint.push(`box-shadow:${shadow}`)

      if (paint.length > 0 || hatched) {
        emit(
          `<div style="position:absolute;left:${px(left)};top:${px(top)};width:${px(
            rect.width,
          )};height:${px(rect.height)};${paint.join(';')};">` +
            (hatched
              ? hatchSvg(
                  Math.round(rect.width),
                  Math.round(rect.height),
                  parseFloat(radius) || 0,
                )
              : '') +
            `</div>`,
        )
      }
    }

    /*
     * A placeholder is not a text node and is text on the screen. The search
     * field is empty in the export without it, which reads as a control that
     * lost its label.
     */
    if ((tag === 'input' || tag === 'textarea') && element.placeholder) {
      const inset = parseFloat(style.paddingLeft) || 0
      emit(
        `<div style="position:absolute;left:${px(left + inset)};top:${px(
          top + (rect.height - parseFloat(style.fontSize) * 1.4) / 2,
        )};width:${px(rect.width - inset * 2)};height:${px(
          parseFloat(style.fontSize) * 1.4,
        )};color:#9a93b0;font-family:Manrope,sans-serif;font-size:${style.fontSize};` +
          `font-weight:${nearestWeight(parseInt(style.fontWeight, 10) || 400)};` +
          `line-height:${px(parseFloat(style.fontSize) * 1.4)};">` +
          escape(element.placeholder) +
          `</div>`,
      )
    }

    if (tag === 'img') {
      emit(
        `<img src="${element.getAttribute('src')}" style="position:absolute;left:${px(
          left,
        )};top:${px(top)};width:${px(rect.width)};height:${px(rect.height)};">`,
      )
      return
    }

    for (const child of node.childNodes) walkNode(child)
  }

  walkNode(doc.body)

  return {
    body: out.join('\n'),
    width: Math.ceil(doc.body.getBoundingClientRect().width),
    height: Math.ceil(root.scrollHeight) + stripHeight,
    rounded,
    skipped,
  }
})
