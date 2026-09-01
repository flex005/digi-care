#!/usr/bin/env node
/**
 * Every screen as standalone HTML, for import into Figma via html.to.design.
 *
 * **The React app is the source and the browser does the interpreting.** Each
 * route is opened in Playwright's Chromium at a width given by `--width`, and
 * the DOM is read with
 * `getComputedStyle` rather than from the stylesheet: by then `var()`, `rem`,
 * `fr`, `gap`, `grid` and every percentage have been resolved to pixels. What
 * comes out is one absolutely-positioned `<div>` per box and one per run of
 * text, with colours and type already decided. The plugin has nothing left to
 * interpret, which is where its trouble with those features lives.
 *
 * Three conversions the output cannot avoid making:
 *
 *   - **Nothing rounds.** All five weights the product uses — 400, 500, 600,
 *     700, 800 — ship as their own static face. Anything that *did* have to
 *     round would be written to `<route>.weights.txt`, named, so a rounding
 *     that matters can be found rather than discovered; that file should now
 *     say nothing was rounded, and a line in it is a regression.
 *   - **The hatch becomes an SVG pattern.** `repeating-linear-gradient` does
 *     not exist in Figma, and this is the one background in the product that
 *     means something: it says nobody recorded this. It is re-emitted as
 *     geometry at the same size behind the element's text.
 *   - **A multi-layer shadow becomes its widest layer.** Figma takes one, and
 *     the wide soft layer is what reads as elevation.
 *
 * **The fonts are embedded, not linked, and that is a correction to the brief.**
 * Google serves Manrope as a variable font from *both* `css` and `css2` — the
 * same file, byte for byte, for every weight requested; the discrete-weight
 * form just declares three `@font-face` rules pointing at it. So neither
 * endpoint fixes the ExtraLight problem, because both hand Figma a 200–800
 * range to resolve. The three static instances from `@fontsource` are real
 * separate files with `usWeightClass` 400, 600 and 700, and they go in as data
 * URIs — which also makes the output standalone, as asked.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { WALKER } from './walk.mjs'

const PORT = 4319
/**
 * The weights the export carries, which is every weight the product uses.
 *
 * It was 400/600/700, and the two it left out are both real: `--weight-medium`
 * has 30 uses and `--weight-extrabold` 64. Rounding them collapsed 64 runs of
 * text on the dashboard alone — the sidebar's nav items are 500 and arrived at
 * 400, visibly thinner than the app. A rounding that changes what a reader
 * sees is not a conversion, it is a loss, and there was no reason to take it:
 * `@fontsource` ships a static master for each of the five.
 *
 * `nearestWeight` still exists and now rounds nothing, because it is the thing
 * that *reports* a rounding. If a sixth weight is ever introduced without a
 * face to carry it, this list is what makes it show up in `.weights.txt` named
 * rather than silently flattened.
 */
const WEIGHTS = [400, 500, 600, 700, 800]
const OUT_DIR = 'export'

/**
 * The viewport the export is captured at.
 *
 * **A parameter, because the geometry inside the file is resolved at it.**
 * Every box is emitted at an absolute position the browser worked out at this
 * width, so the capture is one width made permanent — it cannot reflow, and
 * that is deliberate: resolved pixels are what leave the importer nothing to
 * interpret.
 *
 *     npm run export:figma -- --width 1920
 *
 * **What the width no longer decides is whether the file can be read.** The
 * document scales the whole capture down to whatever window it is opened in,
 * so a 1,440px export opens on a 1,280px laptop with no horizontal scrollbar
 * and every proportion intact. Scaling never goes above 1, so at any window at
 * least as wide as the capture the geometry is untouched. Choosing this number
 * is now about how much detail the capture holds, not about who can open it.
 *
 * Below `--layout-min-width` the app deliberately refuses to lay out and shows
 * the too-narrow notice instead (PRD §4.6), so a smaller width would export a
 * screenshot of that message rather than the screen. Rejected rather than
 * captured, because the file would look plausible and be worthless.
 */
const MIN_WIDTH = 1280

function widthFromArgv(argv) {
  const flag = argv.indexOf('--width')
  if (flag === -1) return 1440
  const value = Number(argv[flag + 1])
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--width needs a number, got "${argv[flag + 1] ?? '(nothing)'}"`)
  }
  if (value < MIN_WIDTH) {
    throw new Error(
      `--width ${value} is below the app's minimum of ${MIN_WIDTH}. ` +
        'Below it the app shows the too-narrow notice rather than the screen, ' +
        'so the export would be a picture of that.',
    )
  }
  return value
}

const WIDTH = widthFromArgv(process.argv)

/** Which routes to export, and what to call the file. */
const ROUTES = [{ name: 'dashboard', path: '/' }]

/**
 * One family name per weight, rather than one family at several weights.
 *
 * **The one hypothesis left for the ExtraLight problem, and it is a test.**
 * Neither the app nor this file has ever presented a variable font or a weight
 * range: `src/main.tsx` loads five static `@fontsource` faces with seven
 * distinct masters, and the block below writes three static faces with
 * unambiguous weights. So the range explanation does not fit — but an importer
 * that resolves by *family name* would look up bare `Manrope`, find Figma's
 * own Manrope, which is variable, and take its default master. That master is
 * ExtraLight, and it explains the one thing the range theory could not: why
 * installing Manrope in Figma does not help.
 *
 * Naming the family `Manrope SemiBold` means there is no bare `Manrope` to
 * resolve against. It either fixes it or rules the whole idea out; both are
 * worth more than another round of reasoning about a plugin that cannot be run
 * from here.
 *
 * **The browser rendering is unchanged either way.** Each family holds exactly
 * one face at exactly one weight, so there is one exact match and nothing to
 * synthesise — verified against the app rather than assumed.
 */
const FONT_FACES = [
  { weight: 400, family: 'Manrope Regular' },
  { weight: 500, family: 'Manrope Medium' },
  { weight: 600, family: 'Manrope SemiBold' },
  { weight: 700, family: 'Manrope Bold' },
  { weight: 800, family: 'Manrope ExtraBold' },
].map((face) => ({
  ...face,
  file: `node_modules/@fontsource/manrope/files/manrope-latin-${face.weight}-normal.woff2`,
}))

/** Weight → family, for the walker. The fallback is the lightest we ship. */
const FAMILIES = Object.fromEntries(
  FONT_FACES.map(({ weight, family }) => [weight, family]),
)

function embeddedFonts() {
  return FONT_FACES.map(({ weight, family, file }) => {
    const data = readFileSync(file).toString('base64')
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2')}`
  }).join('\n')
}

function serve() {
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('preview server did not start')),
      30000,
    )
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer)
        resolve(server)
      }
    })
    server.on('error', reject)
  })
}

async function exportRoute(page, route) {
  /*
   * Signed in through the form, because every route redirects to /sign-in
   * until somebody is. Driving the real control rather than faking a session
   * means the export cannot quietly capture a state a user cannot reach.
   */
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle' })
  await page.click('[data-sign-in-submit]')
  await page.waitForSelector('[data-app-shell], main', { timeout: 15000 })

  if (route.path !== '/') {
    await page.evaluate((path) => {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, route.path)
  }

  // Fonts resolved and the route settled, or the first measurement is of a
  // fallback face at the wrong metrics.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)

  const result = await page.evaluate(
    ([walker, options]) => eval(`(${walker})`)(options),
    [WALKER, { weights: WEIGHTS, families: FAMILIES }],
  )

  const document_ = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>diGi-Care — ${route.name}</title>
<style>
${embeddedFonts()}
*{margin:0;padding:0;box-sizing:border-box}
html{background:#f2f6fe}
body{background:#f2f6fe;font-family:'Manrope Regular',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
/*
 * The capture, at the width it was captured. Nothing inside this box moves:
 * every child is still at the absolute pixel the browser resolved for it.
 */
#page{position:absolute;left:0;top:0;width:${WIDTH}px;height:${result.height}px;transform-origin:0 0}
/*
 * The window the capture is fitted into. \`#page\` is out of flow, so its
 * ${WIDTH}px never reaches the layout and never raises a horizontal scrollbar;
 * this box carries the height the scaled capture actually occupies.
 */
#fit{position:relative;width:100%;height:${result.height}px;overflow:hidden}
</style>
</head>
<body data-export-width="${WIDTH}" data-export-height="${result.height}">
<div id="fit"><div id="page">
${result.body}
</div></div>
<script>
/*
 * Fit the capture to the window, and never magnify it.
 *
 * The export is absolute pixels by design — that is what leaves the importer
 * nothing to interpret — so it cannot reflow, and reflowing it is not what is
 * wanted anyway: the text runs are pinned boxes, and making their containers
 * fluid while they stayed put would misalign the whole page. A uniform scale
 * keeps every relative position exactly as captured, which is the difference
 * between fitting and still looking like the app.
 *
 * **Clamped at 1, which is what keeps the Figma path intact.** At any viewport
 * at least as wide as the capture the transform is \`none\` and the geometry is
 * untouched — identical to the file this exporter produced before it could
 * fit. And with scripting off, which is how a good deal of import tooling
 * reads a pasted document, nothing here runs at all and the result is that
 * same untouched capture. Fitting is a viewing affordance layered on top; it
 * cannot subtract from what is exported.
 */
;(function () {
  var W = ${WIDTH}
  var H = ${result.height}
  var page = document.getElementById('page')
  var fit = document.getElementById('fit')
  function apply() {
    var available = document.documentElement.clientWidth
    var scale = Math.min(1, available / W)
    page.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')'
    fit.style.height = Math.ceil(H * scale) + 'px'
  }
  apply()
  window.addEventListener('resize', apply)
})()
</script>
</body>
</html>
`

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${route.name}.html`), document_)

  const log = [
    `Weights rounded on ${route.name} (${route.path})`,
    // Derived, not typed. This line said "three static faces: 400, 600, 700"
    // for one export after five started shipping — true when written, printed
    // every run, and exactly the sentence nobody reads.
    `The export carries ${FONT_FACES.length} static faces, one per weight: ` +
      `${FONT_FACES.map((face) => `${face.weight} ${face.family}`).join(', ')}.`,
    `Anything the product uses outside that set is rounded to the nearest and`,
    `listed here, so a weight with no face of its own is named rather than`,
    `silently flattened.`,
    '',
    ...(result.rounded.length === 0
      ? ['Nothing was rounded.']
      : result.rounded.map(
          (entry, index) =>
            `${String(index + 1).padStart(3)}. ${entry.from} → ${entry.to}  <${entry.tag}>  "${entry.text}"`,
        )),
  ].join('\n')
  writeFileSync(join(OUT_DIR, `${route.name}.weights.txt`), `${log}\n`)

  return result
}

const server = await serve()
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 } })
  for (const route of ROUTES) {
    const result = await exportRoute(page, route)
    const counts = result.rounded.reduce((tally, entry) => {
      const key = `${entry.from}→${entry.to}`
      tally[key] = (tally[key] ?? 0) + 1
      return tally
    }, {})
    console.log(
      `✓ ${route.name}.html — ${result.height}px tall, ` +
        `${result.body.split('\n').length} nodes, ` +
        `${result.rounded.length} weights rounded ${JSON.stringify(counts)}`,
    )
  }
} finally {
  await browser.close()
  server.kill()
}
