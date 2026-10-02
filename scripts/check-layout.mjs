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
 * How many residents' weeks fit at 1280 without scrolling.
 *
 * **Eight, because the chart stopped buying the other fifteen.** Until commit
 * 169597b the Medications tab called `useWideScreen`, which collapsed the rail
 * and dropped the page gutter while the chart was open — 224px borrowed from
 * the shell to fit a grid that needs 1,188px against the 970 the content
 * column gives at 1280. Frank chose to keep the sidebar and the gutter
 * instead, knowing the cost, so most weeks now scroll sideways rather than
 * fit. The grid still declares its scroller, which is what stops a clipped
 * week being a finding.
 *
 * Still a floor rather than a target: this is what the accepted trade-off
 * produces, and anything below it is a regression nobody has agreed to.
 */
const MIN_WEEKS_FIT = 8

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

/**
 * Every term, set to its LEAST default option at once.
 *
 * **All of them together rather than one at a time**, because a collision
 * between two terms only shows when both are non-default — a sentence naming
 * a service user and their care & support plan reads differently from either
 * change alone, and so does a heading that has to hold both.
 *
 * The old word of each is what the crawl then looks for, and each term's
 * reach is counted: a term appearing on **no** screen is a finding rather
 * than a pass, because it means either the sweep missed it or the term has no
 * call sites and should be deferred the way Discharge is.
 *
 * **`proper` is the rule that matters most in this phase, made mechanical.**
 * A configurable word must never reach a proper noun, and the first run of
 * this crawl proved why that has to be declared rather than reasoned about:
 * it reported 97 findings, and most were its own `was` patterns matching the
 * names the vocabulary is forbidden to touch. A phrase matching `proper` is
 * removed from the text before the old word is looked for, so the exclusion
 * is stated once, beside the term, with its reason — rather than becoming a
 * lookbehind nobody can read. `shows` is removed the same way and for a
 * blunter reason: **the new word often contains the old one.** "Care
 * Assessment" contains "assessment", so a naive `was` flags the term's own
 * successful application as a failure to apply it.
 */
const VOCABULARY = [
  {
    id: 'subject',
    chosen: 'Person Supported',
    shows: /people supported|person supported/i,
    was: /\bresidents?\b/i,
  },
  {
    id: 'carePlan',
    chosen: 'Care & Support Plan',
    shows: /care & support plans?/i,
    was: /\bcare plans?\b/i,
    /* The standard end-of-life document named in PRD §6.2 beside the DNAR and
       the ADRT. Not this service's plan of care, and not its word to choose. */
    proper: /advance care plans?/i,
  },
  {
    id: 'staff',
    chosen: 'Healthcare Professional',
    shows: /healthcare professionals?/i,
    was: /\bstaff\b/i,
  },
  {
    id: 'manager',
    chosen: 'Administrator',
    shows: /administrators?/i,
    was: /\bmanagers?\b/i,
    /* CQC titles naming who is legally accountable for the service, and the
       permission system keys off these roles. Renaming one would make the
       product misstate who carries legal responsibility. */
    proper: /registered manager|deputy manager/i,
  },
  {
    id: 'admission',
    chosen: 'Registration',
    shows: /registrations?/i,
    was: /\badmissions?\b/i,
  },
  {
    id: 'incidentReport',
    chosen: 'Clinical Incident',
    shows: /clinical incidents?/i,
    was: /\bincident reports?\b/i,
  },
  {
    id: 'medication',
    chosen: 'Medication Record',
    shows: /medication records?/i,
    was: /\bmedicines\b/i,
  },
  {
    id: 'assessment',
    chosen: 'Care Assessment',
    shows: /care assessments?/i,
    was: /\bassessments?\b/i,
    /* Two names, not one exclusion. "Risk Assessments" is a module declared in
       nav-items and keyed by the permission matrix and the activity log — and
       the compound does not survive the adjective either ("Risk Clinical
       Assessments" is not a phrase). A capacity assessment is the Mental
       Capacity Act two-stage determination, which is a statutory test rather
       than an assessment this service offers. */
    proper: /risk assessments?|capacity assessments?/i,
  },
  {
    id: 'family',
    chosen: 'Next of Kin',
    shows: /next of kin/i,
    was: /\bfamil(y|ies)\b/i,
    /* A separate product with its own PRD and its own UI (CLAUDE.md, Scope).
       Its name is a name, and this product only ever refers to it. */
    proper: /family portal/i,
  },
]

async function setEveryTermToItsLeastDefault(page) {
  await go(page, '/settings/setup')
  const organisation = await page.$('[data-confirm-step="organisation"]')
  if (organisation) await organisation.click()
  await page.waitForSelector('[data-setup-section="vocabulary"]', { timeout: 15000 })

  for (const term of VOCABULARY) {
    const field = `[data-term-choice="${term.id}"] [role="combobox"]`
    const control = await page.$(field)
    if (control === null) {
      console.error(
        `✖ layout: the vocabulary step offers no control for "${term.id}", so the` +
          `\n  crawl cannot set it and would check the default under its own name.`,
      )
      process.exit(1)
    }
    await control.click()
    await page.click(`[role="option"]:has-text("${term.chosen}")`)
    await page.waitForTimeout(120)
  }

  await page.click('[data-confirm-step="vocabulary"]')
  await page.waitForTimeout(400)
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
/** Screens still printing an old word, outside recorded free text. */
const staleTerm = []
/** How many screens each configured term actually reached. */
const reach = new Map()
let weeksFit = 0
let weeksTotal

try {
  const page = await browser.newPage({ viewport: { width: MIN_WIDTH, height: 900 } })
  /*
   * **Signed in as the registered manager, and never as whoever the form
   * happens to prefill.**
   *
   * It clicked straight through the prefilled address, which is a care
   * worker's. That was harmless for sixteen phases and stopped being harmless
   * in Phase 17, when the rail started filtering by role: as a care worker the
   * crawl can no longer reach Compliance, Reports or Settings, because it
   * follows links and those links are not drawn. The count would not have said
   * so. The crawl caps at MAX_SCREENS and had been hitting the cap, so it
   * reported the same 70 screens while covering a smaller product, and the
   * success line would have kept claiming the whole of it.
   *
   * That is the §8 class about a guard whose message outlives its coverage,
   * and the reason it is written out here: the fix is one line, and the way it
   * was found is the part worth keeping.
   */
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle' })
  await page.fill('[data-field="email"]', 'a.okonkwo@rosewoodcourt.example')
  await page.click('[data-sign-in-submit]')

  /*
   * **Verification, because from Phase 19 signing in is two screens.** The
   * crawl clicked submit and waited for `main`, which used to be the next
   * thing to appear; the OTP step now sits between the credentials and the
   * product, and waiting for `main` on a screen that has none times out after
   * fifteen seconds with no indication of why.
   *
   * It is also worth crawling: it is a screen at 1280 like any other.
   */
  await page.waitForSelector('[data-verify]', { timeout: 15000 })
  await page.fill('[data-field="code"]', '123456')
  await page.click('[data-verify-submit]')

  /*
   * **The setup offer, named before it could fail unnamed.** From this phase
   * the registered manager is offered the organisation setup after verifying,
   * rather than landing on the dashboard. Left alone, the crawl would have
   * waited fifteen seconds for a `main` that the offer does not have and
   * failed saying only that — the uninformative timeout §8 describes, which
   * this time was written down before it happened rather than after.
   *
   * The offer is a screen at 1280 too, so it is held to the same sideways-scroll
   * rule before the crawl takes the dashboard way out.
   */
  const offered = await page
    .waitForSelector('[data-setup-offer]', { timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!offered) {
    console.error(
      '✖ layout: verified as the registered manager, and the setup offer did not appear. Either the offer moved or the sign-in did not take the role the crawl asked for.',
    )
    process.exit(1)
  }
  visited += 1
  const offerScrolls = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (offerScrolls > 1) {
    findings.push({
      route: '/verify (setup offer)',
      why: `the page scrolls sideways by ${offerScrolls}px`,
      label: 'the document',
      text: '',
    })
  }
  await page.click('[data-offer-dashboard]')
  const landed = await page
    .waitForSelector('main', { timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!landed) {
    console.error(
      '✖ layout: chose "Go to the dashboard" on the setup offer, and the dashboard did not appear.',
    )
    process.exit(1)
  }

  /*
   * And the crawl proves it got the role it asked for rather than assuming it.
   * Settings is in the rail for the registered manager and for nobody below a
   * deputy, so its absence here means the sign-in did not take.
   */
  const railHasSettings = await page.evaluate(
    () => document.querySelector('nav a[href="/settings"]') !== null,
  )
  if (!railHasSettings) {
    console.error(
      '✖ layout: signed in, and the rail has no Settings item. The crawl is running as a role that cannot reach the administrative screens, so its coverage is smaller than its success line claims.',
    )
    process.exit(1)
  }

  const seen = new Set(['/sign-in', '/sign-out'])
  /*
   * **The term is set before the crawl, and set to the hard one.**
   *
   * A source-level check cannot tell `residentId` from the word "resident" in
   * a sentence, and a guard needing hundreds of escape comments is wallpaper —
   * §8 records that costed and thrown away twice. The rendered page has no
   * such problem: an identifier does not render, so it cannot be a false
   * positive. So the question is asked of the screen.
   *
   * "Service User" rather than an invented sentinel, because it is a real
   * option somebody can choose and it is the case the grammar breaks on: two
   * words, a plural that is not the singular plus an s, and a possessive.
   * A sentinel would have proved the plumbing and not the English.
   */
  await setEveryTermToItsLeastDefault(page)

  const queue = ['/']

  while (queue.length > 0 && visited < MAX_SCREENS) {
    const route = queue.shift()
    if (seen.has(route)) continue
    seen.add(route)
    await go(page, route)
    visited += 1

    const found = await page.evaluate(
      (terms) => {
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

          /*
           * Inside an `<svg>`, `clientWidth` is not a CSS box and the comparison
           * is meaningless: at 2560 the chart's axis labels reported 4–10px of
           * "overflow" while rendering complete and legible. An `<svg>` root is
           * a replaced element that is measured normally and stays in scope.
           */
          if (el.ownerSVGElement) continue

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

        /*
         * **The old word, anywhere a person can read it.**
         *
         * Two markers are excluded, and they are **not** the same exemption.
         * `data-recorded-text` is somebody's own words — a care note saying "the
         * resident was unsettled" goes on saying them, because labels change and
         * what somebody typed does not. `data-published-wording` is a validated
         * instrument's question: the Morse Fall Scale's "A fall on this
         * admission" belongs to the scale, and varying it would be varying the
         * instrument rather than this service's vocabulary. Calling the second
         * one recorded text would be a marker claiming more than it covers.
         * Anything carrying neither is chrome, and chrome must ask the owner.
         */
        const stale = []
        const seenTerms = []
        const walker = document.createTreeWalker(
          main ?? document.body,
          NodeFilter.SHOW_TEXT,
        )
        const texts = []
        let node = walker.nextNode()
        while (node) {
          const el = node.parentElement
          if (el?.closest('[data-recorded-text], [data-published-wording]') == null) {
            texts.push({
              text: (node.textContent ?? '').trim(),
              label: `${el?.tagName.toLowerCase() ?? '?'}.${String(el?.className ?? '').slice(0, 24)}`,
            })
          }
          node = walker.nextNode()
        }

        for (const term of terms) {
          const was = new RegExp(term.was, 'i')
          const shows = new RegExp(term.shows, 'i')
          /*
           * Removed before the old word is looked for, never after: the new word
           * usually contains the old one, and a proper noun always does. What is
           * left is prose that could have asked the owner and did not.
           */
          const notOurs = [new RegExp(term.shows, 'gi')]
          if (term.proper !== null) notOurs.push(new RegExp(term.proper, 'gi'))
          for (const entry of texts) {
            let rest = entry.text
            for (const pattern of notOurs) rest = rest.replace(pattern, ' ')
            if (was.test(rest)) {
              stale.push({
                term: term.id,
                label: entry.label,
                text: entry.text.replace(/\s+/g, ' ').slice(0, 72),
              })
            }
          }
          if (texts.some((entry) => shows.test(entry.text))) seenTerms.push(term.id)
        }

        return {
          lost: lost.slice(0, 4),
          links: [...new Set(links)],
          stale: stale.slice(0, 6),
          seenTerms,
        }
      },
      VOCABULARY.map((t) => ({
        id: t.id,
        was: t.was.source,
        shows: t.shows.source,
        proper: t.proper?.source ?? null,
      })),
    )

    for (const l of found.lost) findings.push({ route, ...l })
    for (const t of found.stale) staleTerm.push({ route, ...t })
    for (const id of found.seenTerms) reach.set(id, (reach.get(id) ?? 0) + 1)
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

  /*
   * The gutter, which no longer goes anywhere.
   *
   * The Medications tab used to collapse the rail and drop the page gutter so
   * the week fitted at 1280, and it kept dropping it at every width above
   * that — the whole tab, heading and tab strip and cards, sat flush against
   * both window edges while every other tab on the profile had 24px. A reader
   * reported that one. jsdom applies no CSS and cannot see a padding, so this
   * is the only place the states can be told apart.
   *
   * **Since 169597b the gutter stays out at every width, 1280 included**, and
   * both checks below are now the same rule rather than opposite halves of a
   * trade-off: the tab is inset, wherever you look at it. The narrow one
   * exists to catch the old rail-eating behaviour coming back, which is what
   * a gutter of 0 at 1280 would mean.
   *
   * It deliberately says nothing about whether the week fits. `MIN_WEEKS_FIT`
   * above owns that, and asserting it here as well — under the opposite
   * polarity, as this did — is how two rules about one fact drift apart.
   */
  const GUTTER_AT = 1440
  const gutterCheck = async (width) => {
    await page.setViewportSize({ width, height: 900 })
    await go(page, `/residents/${residents[0]}/medications`)
    await page.waitForSelector('table', { timeout: 15000 })
    await page.waitForTimeout(400)
    return page.evaluate(() => {
      const main = document.querySelector('main')
      const card = main.querySelector('[class*="card"]')
      const box = card.getBoundingClientRect()
      const scroller = main.querySelector('table').closest('div')
      return {
        pad: Math.round(parseFloat(getComputedStyle(main).paddingLeft)),
        left: Math.round(box.left),
        right: Math.round(window.innerWidth - box.right),
        weekFits: scroller.scrollWidth <= scroller.clientWidth + 1,
      }
    })
  }

  const wide = await gutterCheck(GUTTER_AT)
  if (wide.pad === 0 || wide.left === 0 || wide.right === 0) {
    findings.push({
      route: `/residents/${residents[0]}/medications`,
      why: `at ${GUTTER_AT}px the tab has no page gutter (padding ${wide.pad}px, ${wide.left}px to the rail side and ${wide.right}px to the window edge), so it sits flush where every other tab on the profile is inset`,
      label: 'the medications tab',
      text: '',
    })
  }
  const narrow = await gutterCheck(MIN_WIDTH)
  if (narrow.pad === 0) {
    findings.push({
      route: `/residents/${residents[0]}/medications`,
      why: `at ${MIN_WIDTH}px the tab has no page gutter, which is the rail-eating mode coming back: the chart stopped borrowing the shell's width in 169597b, and the gutter is meant to stay out at every width`,
      label: 'the medications tab',
      text: '',
    })
  }
  /*
   * Both numbers measured, neither asserted in words. The first draft of this
   * line read "flush at 1280px" whatever the padding was, so a mutation that
   * put the gutter back at 1280 printed a sentence saying it had not — the
   * finding fired and the success line lied beside it.
   */
  console.log(
    `  the medications tab is inset ${wide.pad}px at ${GUTTER_AT}px and ${narrow.pad}px at ${MIN_WIDTH}px, where the week ${narrow.weekFits ? 'fits' : 'does not fit'}`,
  )
  await page.setViewportSize({ width: MIN_WIDTH, height: 900 })

  /*
   * The chart hatch, asserted where it can be seen.
   *
   * The bars are HTML with a CSS gradient, because an SVG `<pattern>` does not
   * survive a Figma import. **jsdom cannot check that**: it applies no CSS, so
   * `backgroundImage` is `none` there whatever the class says, and a unit test
   * on it could not fail. A real browser resolves the cascade, which is the
   * whole reason this file exists.
   */
  await go(page, '/')
  await page.waitForTimeout(1400)
  const hatch = await page.evaluate(() => {
    const gaps = [...document.querySelectorAll('[data-bar-segment="gap"]')]
    const recorded = [...document.querySelectorAll('[data-bar-segment="recorded"]')]
    const painted = (el) => getComputedStyle(el).backgroundImage
    /*
     * The *chart* variant, not merely a gradient. The box variant bands
     * `--status-unrecorded-tint` at 1.12:1, which is invisible across a 7px
     * bar — so a guard that accepted any gradient would pass on exactly the
     * regression this hatch exists to prevent.
     */
    const solid = getComputedStyle(document.documentElement)
      .getPropertyValue('--status-unrecorded')
      .trim()
    const chartHatch = (el) => {
      const image = painted(el)
      if (!/repeating-linear-gradient/.test(image)) return false
      const probe = document.createElement('span')
      probe.style.color = solid
      document.body.appendChild(probe)
      const rgb = getComputedStyle(probe).color
      probe.remove()
      return image.includes(rgb)
    }
    return {
      gaps: gaps.length,
      hatched: gaps.filter(chartHatch).length,
      recorded: recorded.length,
      recordedHatched: recorded.filter((r) =>
        /repeating-linear-gradient/.test(painted(r)),
      ).length,
      swatch: chartHatch(
        document.querySelector('[class*="swatchHatch"]') ?? document.body,
      ),
    }
  })
  console.log(
    `  ${hatch.hatched} of ${hatch.gaps} bar gaps hatched, ` +
      `legend swatch hatched: ${hatch.swatch}`,
  )
  if (hatch.gaps === 0) {
    findings.push({
      route: '/',
      why: 'no bar-gap segments rendered, so the hatch assertion swept nothing',
      label: '[data-bar-segment="gap"]',
      text: '',
    })
  } else if (hatch.hatched !== hatch.gaps) {
    findings.push({
      route: '/',
      why: `${hatch.gaps - hatch.hatched} of ${hatch.gaps} bar gaps paint no hatch`,
      label: '[data-bar-segment="gap"]',
      text: 'a gap nobody recorded is drawn as a solid fill',
    })
  }
  if (hatch.recordedHatched > 0) {
    findings.push({
      route: '/',
      why: `${hatch.recordedHatched} recorded segments paint the hatch`,
      label: '[data-bar-segment="recorded"]',
      text: 'a recorded value is drawn as an absence',
    })
  }
  if (!hatch.swatch) {
    findings.push({
      route: '/',
      why: 'the legend swatch paints no hatch, so the key explains nothing',
      label: '[class*="swatchHatch"]',
      text: '',
    })
  }

  /*
   * **The remainder, because a count at its cap reports a budget rather than a
   * reach.** The crawl never exhausts — every care note is a screen — so it
   * stops at MAX_SCREENS with a queue still full, and "70 screens crawled" is
   * the same sentence whether it covered the product or a corner of it. That
   * is not hypothetical: it signed in as a care worker for sixteen phases,
   * could not reach Compliance, Reports or Settings, and said 70 throughout.
   * A number that can rise is a regression somebody can see.
   */
  console.log(
    `  ${visited} screens crawled at ${MIN_WIDTH}px, ${queue.length} queued and not visited\n`,
  )
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

if (staleTerm.length > 0) {
  console.error(
    `✖ terminology: ${staleTerm.length} place(s) still print a default word with` +
      `\n  every term configured to something else:\n`,
  )
  for (const f of staleTerm.slice(0, 40)) {
    console.error(`  ${f.route}  [${f.term}]`)
    console.error(`    ${f.label}  "${f.text}"\n`)
  }
  console.error(
    `  A label asks the owner — useTerms() in a component, or a Term threaded` +
      `\n  into a module that has no component. Two things are exempt and each has` +
      `\n  its own marker on the element holding it: data-recorded-text for` +
      `\n  somebody's own words, data-published-wording for a validated` +
      `\n  instrument's question. A proper noun is not marked in the DOM at all —` +
      `\n  it is declared as "proper" beside its term in this file, with the reason.\n`,
  )
  process.exit(1)
}

/*
 * **A term reaching nothing is a finding, not a pass.** It means either the
 * sweep missed that term or it has no call sites at all — in which case it is
 * a dead control and belongs with Discharge, deferred until the feature it
 * names exists. Either way it is not something to find out later.
 */
const unreached = VOCABULARY.filter((term) => (reach.get(term.id) ?? 0) === 0)
if (unreached.length > 0) {
  console.error(
    `✖ terminology: ${unreached.length} configured term(s) appear on no screen at` +
      `\n  all, so nothing proves they are wired up:\n`,
  )
  for (const term of unreached) {
    console.error(`  ${term.id} — set to "${term.chosen}" and never rendered`)
  }
  console.error(
    `\n  Either the sweep missed it, or it has no call sites and is a control that` +
      `\n  changes nothing — which is the reason Discharge is deferred rather than` +
      `\n  shipped. DEFERRED_TERMS in vocabulary.ts records that decision.\n`,
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

/*
 * What this says and what it checked, kept the same size — the rule this file
 * already follows for the week count.
 *
 * It cannot see a screen the crawl did not reach, and it cannot see free text
 * that nobody marked: an unmarked record value containing the word would be
 * reported as a finding rather than missed, which is the safe direction, but a
 * marker put on a LABEL by mistake would hide one. That is the limit.
 */
console.log(
  `✓ terminology — ${VOCABULARY.length} terms, each set to its least default, across` +
    ` ${visited} screens. No default word survives outside the three exemptions:` +
    ` recorded free text, published instrument wording, and ` +
    `${String(VOCABULARY.filter((t) => t.proper !== undefined).length)} declared proper nouns.`,
)
console.log(
  `  reach: ` +
    VOCABULARY.map((t) => `${t.id} ${String(reach.get(t.id) ?? 0)}`).join(' · '),
)
console.log(
  `  Free text is exempt by data-recorded-text; a marker on a label would hide a` +
    ` finding. Discharge is deferred and not crawled: no feature names it.\n`,
)
