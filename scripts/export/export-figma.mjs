#!/usr/bin/env node
/**
 * Every screen as standalone HTML, for import into Figma via html.to.design.
 *
 * **The React app is the source and the browser does the interpreting.** Each
 * route is opened in Playwright's Chromium at 1440px, and the DOM is read with
 * `getComputedStyle` rather than from the stylesheet: by then `var()`, `rem`,
 * `fr`, `gap`, `grid` and every percentage have been resolved to pixels. What
 * comes out is one absolutely-positioned `<div>` per box and one per run of
 * text, with colours and type already decided. The plugin has nothing left to
 * interpret, which is where its trouble with those features lives.
 *
 * Three conversions the output cannot avoid making:
 *
 *   - **Weights round to 400, 600 or 700.** Those are the three static faces
 *     embedded in the file. Anything computing to 500 or 800 is rounded to the
 *     nearest and written to `<route>.weights.txt`, named, so a rounding that
 *     matters can be found rather than discovered.
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
const WIDTH = 1440
const WEIGHTS = [400, 600, 700]
/** Room for the weight strip, and every captured box is offset by it. */
const STRIP = 108
const OUT_DIR = 'export'

/** Which routes to export, and what to call the file. */
const ROUTES = [{ name: 'dashboard', path: '/' }]

const FONT_FILES = {
  400: 'node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff2',
  600: 'node_modules/@fontsource/manrope/files/manrope-latin-600-normal.woff2',
  700: 'node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff2',
}

function embeddedFonts() {
  return Object.entries(FONT_FILES)
    .map(([weight, file]) => {
      const data = readFileSync(file).toString('base64')
      return `@font-face{font-family:'Manrope';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2')}`
    })
    .join('\n')
}

/** The strip that proves the three weights survived the import. */
function weightStrip() {
  const row = (weight, label) =>
    `<div style="position:absolute;left:24px;top:${
      14 + (weight === 400 ? 0 : weight === 600 ? 32 : 64)
    }px;width:900px;height:26px;color:#1e0059;font-family:Manrope,sans-serif;font-size:19px;font-weight:${weight};line-height:26px;">${label} &mdash; Handgloves 0123 &mdash; the quick brown fox</div>`
  return [
    `<div style="position:absolute;left:0;top:0;width:${WIDTH}px;height:${
      STRIP - 8
    }px;background:#ffffff;border-bottom:1px solid #e7e4fd;"></div>`,
    row(400, '400 Regular'),
    row(600, '600 SemiBold'),
    row(700, '700 Bold'),
  ].join('\n')
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
    [WALKER, { stripHeight: STRIP, weights: WEIGHTS }],
  )

  const document_ = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>diGi-Care — ${route.name}</title>
<style>
${embeddedFonts()}
*{margin:0;padding:0;box-sizing:border-box}
body{position:relative;width:${WIDTH}px;height:${result.height}px;background:#f2f6fe;font-family:Manrope,sans-serif;-webkit-font-smoothing:antialiased}
</style>
</head>
<body>
${weightStrip()}
${result.body}
</body>
</html>
`

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${route.name}.html`), document_)

  const log = [
    `Weights rounded on ${route.name} (${route.path})`,
    `The export carries three static faces: 400, 600, 700.`,
    `Anything else is rounded to the nearest, and listed here.`,
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
