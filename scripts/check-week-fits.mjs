#!/usr/bin/env node
/**
 * The MAR week view shows a week, at the narrowest width the app supports.
 *
 * **The caption is the assertion.** The heading says "Week of 31/08 to 06/09"
 * and the grid beneath it either renders those seven days or it does not. A
 * heading naming a span the rendering cannot show is the same class of defect
 * as a figure without its denominator — a claim the screen makes and its own
 * pixels do not support — except that here the contradiction is in layout, so
 * nothing in the test suite can see it.
 *
 * **It cannot be a vitest test.** jsdom performs no layout: every
 * `getBoundingClientRect` is zero, so a clipping check written there would
 * pass on any grid at any width, which is worse than no check. It needs a real
 * browser, which is why it lives here and runs against a built preview.
 *
 * Run: npm run check:layout
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4351
/** --layout-min-width. Below it the app shows the too-narrow notice instead. */
const MIN_WIDTH = 1280
const ROUTE = '/residents/res-okafor/medications'

function serve() {
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview did not start')), 30000)
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer)
        resolve(server)
      }
    })
    server.on('error', reject)
  })
}

const server = await serve()
const browser = await chromium.launch()
let failed = false

try {
  const page = await browser.newPage({ viewport: { width: MIN_WIDTH, height: 900 } })
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle' })
  await page.click('[data-sign-in-submit]')
  await page.waitForSelector('main', { timeout: 15000 })
  await page.evaluate((route) => {
    window.history.pushState({}, '', route)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, ROUTE)
  await page.waitForTimeout(2200)

  const seen = await page.evaluate(() => {
    const table = document.querySelector('table')
    if (!table) return null
    const scroller = table.closest('div')
    const days = new Set(
      [...table.querySelectorAll('thead tr:first-child th')]
        .map((th) => th.textContent?.trim())
        .filter((text) => text && /\d{2}\/\d{2}/.test(text)),
    )
    return {
      days: days.size,
      client: scroller.clientWidth,
      scroll: scroller.scrollWidth,
      // The chart's own heading, named. A bare `h2` picked up the profile
      // header's "Medication due · next 2 hours" instead — the caption under
      // test is the one this check exists to compare against.
      caption:
        document.querySelector('[class*="chartTitle"]')?.textContent?.trim() ?? '',
    }
  })

  if (!seen) throw new Error('no MAR grid on the page')

  const clipped = seen.scroll - seen.client
  console.log(`\n  ${seen.caption}`)
  console.log(
    `  ${seen.days} day columns · ${seen.client}px visible of ${seen.scroll}px`,
  )

  if (seen.days !== 7) {
    failed = true
    console.error(`\n✖ week view: the grid renders ${seen.days} day columns, not 7.\n`)
  } else if (clipped > 0) {
    failed = true
    console.error(
      `\n✖ week view: clipped by ${clipped}px at ${MIN_WIDTH}px, the narrowest` +
        `\n  width the app supports. The heading names seven days and the grid` +
        `\n  cannot show them, so the caption is making a claim the rendering` +
        `\n  does not support.\n`,
    )
  } else {
    console.log(`\n✓ week fits — seven days, no clipping at ${MIN_WIDTH}px\n`)
  }
} finally {
  await browser.close()
  server.kill()
}

process.exit(failed ? 1 : 0)
