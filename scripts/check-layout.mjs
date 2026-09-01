#!/usr/bin/env node
/**
 * Nothing on any screen is lost to layout at the narrowest width we support.
 *
 * **Two checks, one browser, because they are one class.** The MAR week view
 * captioned seven days and rendered six; the Reports panel captioned itself
 * "split by whether the row has enough behind it" and rendered every
 * denominator guillotined — "15 of", "0 of", "8 o" — with the bars squeezed to
 * nought pixels so the hatch was not drawn at all. Both are a screen making a
 * claim its own pixels do not support, and neither is visible to a single
 * assertion in the suite: **jsdom performs no layout.** Every
 * `getBoundingClientRect` is zero there, so a clipping check written as a
 * vitest test passes on any grid at any width, which is worse than none.
 *
 * **What it asserts is a contract, not a prediction.** Content fits its own
 * box, or declares how it does not — a scroller, an ellipsis, a line clamp.
 * The first version of this asked instead *which ancestor does the cutting*,
 * and it let the dashboard tiles through: their border boxes sat inside the
 * viewport and it was `main`'s `overflow: auto` that guillotined "of 40 on
 * record at Rosewood Court" nine pixels in. Where silently-overflowing content
 * ends up depends on every ancestor between it and the page; whether it fits
 * does not. The page itself is checked too — it never scrolls sideways at the
 * narrowest width we support.
 *
 * **The routes are crawled, not listed.** A hand-kept list here would be a
 * second copy of the route table, and two rules drift (§6) — a route added
 * next month would simply not be swept, under a tick saying the app was
 * checked. So it walks the app's own links, and prints how many screens it
 * reached: a number that falls is a coverage loss somebody can see.
 *
 * Run: npm run check:layout
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4351
/** --layout-min-width. Below it the app shows the too-narrow notice instead. */
const MIN_WIDTH = 1280
/** A ceiling on the crawl, so a link cycle cannot run it for ever. */
const MAX_SCREENS = 70
/**
 * The floor the crawl is expected to clear. Not the exact count — that would
 * be the assertion-edited-each-phase defect (§8) — but a bound that a real
 * coverage loss falls through.
 */
const MIN_SCREENS = 35
/**
 * How many residents' weeks fit at 1280 without scrolling. Not all 28: the
 * five on four rounds a day need 1,454px against the 1,194 the content column
 * gives, and closing that would cost either the dose target's WCAG 2.5.8 floor
 * or the medication column's drug names. Held as a floor rather than a target,
 * so the number cannot quietly fall.
 */
const MIN_WEEKS_FIT = 23

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

/** Client-side navigation, so the crawl keeps one signed-in session. */
async function go(page, route) {
  await page.evaluate((r) => {
    window.history.pushState({}, '', r)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  await page.waitForTimeout(850)
}

const server = await serve()
const browser = await chromium.launch()
const findings = []
let visited = 0
let weeksFit = 0
let weeksTotal

try {
  const page = await browser.newPage({ viewport: { width: MIN_WIDTH, height: 900 } })
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle' })
  await page.click('[data-sign-in-submit]')
  await page.waitForSelector('main', { timeout: 15000 })

  const seen = new Set(['/sign-in', '/sign-out'])
  const queue = ['/']

  while (queue.length > 0 && visited < MAX_SCREENS) {
    const route = queue.shift()
    if (seen.has(route)) continue
    seen.add(route)
    await go(page, route)
    visited += 1

    const found = await page.evaluate(() => {
      const main = document.querySelector('main')
      const lost = []

      /*
       * The contract: content fits its own box, or says how it does not.
       *
       * Three ways of not fitting are legitimate and declared — a scroller, an
       * ellipsis, a line clamp. Everything else overflows silently, and where
       * it ends up is not something a rule can predict: the dashboard tiles
       * kept their border boxes inside the viewport and it was `main`'s
       * `overflow: auto` that cut "of 40 on record at Rosewood Court" nine
       * pixels in. Chasing which ancestor does the cutting was tried and it
       * missed that case; asking whether the content fits at all does not.
       */
      for (const el of main?.querySelectorAll('*') ?? []) {
        const over = el.scrollWidth - el.clientWidth
        if (over <= 1) continue

        const style = getComputedStyle(el)
        if (/auto|scroll/.test(style.overflowX)) continue // reachable
        if (style.textOverflow === 'ellipsis') continue // truncation you can see
        if (style.webkitLineClamp && style.webkitLineClamp !== 'none') continue
        // Deliberately clipped, and deliberately unreadable: the whole point.
        if (style.position === 'absolute' && el.clientWidth <= 1) continue
        // The deepest box only. An overflowing parent is the symptom of this.
        if ([...el.children].some((c) => c.scrollWidth - c.clientWidth > 1)) continue

        lost.push({
          why: `overflows its own box by ${over}px, with nothing declared to handle it`,
          label: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`,
          text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 52),
        })
      }

      // And the page itself never scrolls sideways at the supported minimum.
      const de = document.documentElement
      if (de.scrollWidth > de.clientWidth + 1) {
        lost.push({
          why: `the page scrolls sideways by ${de.scrollWidth - de.clientWidth}px`,
          label: 'the document',
          text: '',
        })
      }

      const links = [...(main?.querySelectorAll('a[href^="/"]') ?? [])]
        .concat([...document.querySelectorAll('nav a[href^="/"]')])
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && !h.startsWith('//'))

      return { lost: lost.slice(0, 4), links: [...new Set(links)] }
    })

    for (const l of found.lost) findings.push({ route, ...l })
    for (const link of found.links) if (!seen.has(link)) queue.push(link)
  }

  /*
   * The week view, over every resident rather than the one that fitted.
   *
   * The first version of this checked `res-okafor` and printed a tick. The
   * grid's width is data-dependent — seven days times however many rounds a
   * day that resident is on — so `res-okafor` at three rounds fits in 1,194px
   * and the five residents on four rounds need 1,454px. A guard naming one
   * subject was measuring that subject, not the rule, and the ✓ it printed was
   * about the whole screen.
   *
   * So it states a count against its denominator. A number that falls is a
   * regression somebody can see, where a tick is a tick either way.
   */
  await go(page, '/residents')
  await page.waitForTimeout(1200)
  const residents = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/residents/res-"]')].map(
        (a) => a.getAttribute('href').split('/')[2],
      ),
    ),
  ])

  let caption = ''
  for (const id of residents) {
    await go(page, `/residents/${id}/medications`)
    await page.waitForTimeout(500)
    const week = await page.evaluate(() => {
      const table = document.querySelector('table')
      if (!table) return null
      const scroller = table.closest('div')
      const days = new Set(
        [...table.querySelectorAll('thead tr:first-child th')]
          .map((th) => th.textContent?.trim())
          .filter((t) => t && /\d{2}\/\d{2}/.test(t)),
      )
      return {
        days: days.size,
        fits: scroller.scrollWidth <= scroller.clientWidth + 1,
        // The chart's own heading, named. A bare `h2` picked up the profile
        // header's "Medication due · next 2 hours" instead — the caption under
        // test is the one this check exists to compare against.
        caption:
          document.querySelector('[class*="chartTitle"]')?.textContent?.trim() ?? '',
      }
    })
    if (!week) throw new Error(`no MAR grid for ${id}`)
    caption = week.caption
    if (week.fits) weeksFit += 1
    // Seven days are always *present*, whether or not they are all on screen
    // at once. A grid that renders six has lost a day rather than hidden one.
    if (week.days !== 7) {
      findings.push({
        route: `/residents/${id}/medications`,
        why: `the grid renders ${week.days} day columns, not 7`,
        label: 'the week caption',
        text: week.caption,
      })
    }
  }

  console.log(`\n  ${caption}`)
  weeksTotal = residents.length
  console.log(
    `  ${weeksFit} of ${residents.length} weeks fit at ${MIN_WIDTH}px without scrolling`,
  )
  if (weeksFit < MIN_WEEKS_FIT) {
    findings.push({
      route: '/residents/*/medications',
      why:
        `${weeksFit} of ${residents.length} weeks fit without scrolling, below the ` +
        `${MIN_WEEKS_FIT} that did`,
      label: 'the week view',
      text: caption,
    })
  }

  console.log(`  ${visited} screens crawled at ${MIN_WIDTH}px\n`)
} finally {
  await browser.close()
  server.kill()
}

if (visited < MIN_SCREENS) {
  console.error(
    `✖ layout: the crawl reached ${visited} screens, below the ${MIN_SCREENS} it` +
      `\n  should. A sweep that visits less of the app still prints a tick, so a` +
      `\n  drop here is a coverage loss rather than a passing run.\n`,
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(`✖ layout: ${findings.length} thing(s) a reader cannot get to:\n`)
  for (const f of findings) {
    console.error(`  ${f.route}`)
    console.error(`    ${f.why}`)
    console.error(`    ${f.label}  "${f.text}"\n`)
  }
  console.error(
    `  Each of these overflows its own box at ${MIN_WIDTH}px, the narrowest width` +
      `\n  the app supports, without declaring a scroller, an ellipsis or a clamp.` +
      `\n  Where it then lands is up to whichever ancestor clips first, which is` +
      `\n  not something the markup states — so it is a finding either way.\n`,
  )
  process.exit(1)
}

/*
 * What the tick claims and what was checked, kept the same size.
 *
 * It read "and the week fits", which is true of 23 residents and not of the
 * five on four rounds a day — a message wider than its own check, which is how
 * a guard starts reading as coverage it does not have. It says the count.
 */
console.log(
  `✓ layout — nothing lost at ${MIN_WIDTH}px; ${weeksFit} of ${weeksTotal} weeks` +
    ` fit on screen, the rest reachable by scrolling\n`,
)
