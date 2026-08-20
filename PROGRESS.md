# PROGRESS

Append-only. Bugs, reasoning, decisions and anything discovered. Newest phase
at the bottom.

---

## Phase 0 — Foundations

Completed 19/08/2026.

### What was built

Tokens, stylelint enforcement, the icon pipeline, 13 Radix primitive wrappers
plus a Button, the state primitive types, the data access layer shape, the app
shell and routing, and `/dev/states`. No user-facing screens, per PRD §6.1.

### Decisions taken before building (approved)

1. **Manrope** — installed `@fontsource/manrope` rather than hand-vendoring
   woff2 files. Weights 400/500/600/700/800 imported in `main.tsx`.
2. **Testing and pre-commit** — installed both stacks in Phase 0 rather than
   deferring: `vitest`, `jsdom`, `@vitest/coverage-v8`, `@testing-library/react`,
   `@testing-library/user-event`, `@testing-library/jest-dom`, `vitest-axe`,
   plus `git init` with `husky` and `lint-staged`.
3. **⚠️ values** — built with the PRD's values as written, each carrying a
   `/* ⚠️ unverified — PRD §4.x */` comment so the later swap is one edit.
4. **Root route** — `/` redirects to `/dev/states`. The Dashboard claims `/`
   when Phase 1 builds it.

### How the Evidence Invariant is enforced mechanically

Four independent mechanisms, so none of it depends on remembering:

| Rule | Mechanism |
| --- | --- |
| 1 — no optional clinical status | Closed unions in `src/data/types/state.ts`; every `switch` ends in `assertNever`. Removing a `case` fails `tsc` and names the missed member. |
| 2 — unrecorded has its own treatment | One definition in `src/styles/unrecorded.module.css`, reached by `composes:`. `scripts/check-hatch.mjs` fails the lint if it is redrawn anywhere else. |
| 2 — pattern never the sole carrier | `<Unrecorded>` takes a **required** `label`. There is no way to render the hatch without visible text. |
| 3 — recorded negative ≠ unrecorded | `StatusPill` (solid, settled) and `Unrecorded` (dashed, hatched) are different components with different `data-state` attributes, asserted in `status.test.tsx`. |
| 4 — every aggregate has a denominator | `AggregateFigure` has no variant that renders `value` without `coverage`. |
| token rule | Four stylelint rules; `tokens.css` is the only exemption. |
| type scale closed | Stylelint rejects any `font-size`/`line-height`/`font-weight` that is not `var(--*)`. |

`src/dev/states.fixtures.ts` uses a `ByKind<T>` mapped type, so **adding a
member to any status union breaks the build until an example exists on
`/dev/states`**. A new state cannot enter the system without becoming visible
on the page we review it with.

### Measured contrast — PRD §4.4 verified

The PRD claims every ink holds ≥4.88:1 on its own tint and ≥5.4:1 on white.
Measured:

| Status | ink on tint | ink on white | AA text (4.5) |
| --- | --- | --- | --- |
| positive | 4.99 | 5.40 | pass |
| caution | 4.88 | 5.49 | pass |
| critical | 5.81 | 6.48 | pass |
| info | 7.32 | 8.21 | pass |
| unrecorded | 6.32 | 7.10 | pass |

The claim holds. Other pairs checked: `--ink-900` on `--bg-page` 16.16,
`--ink-700` on surface 10.24, `--ink-500` on surface 5.36, white on
`--purple-900` 17.51, white on `--purple-600` 6.97. `--ink-400` on surface is
2.93, which is fine for its stated use (placeholder and disabled text, exempt
under WCAG 1.4.3) but must not be used for anything a user has to read.

### ⚠️ Finding — `--border-unrecorded` is below the §7 contrast bar

`#A8A1BC` measures **2.20:1 on `--status-unrecorded-tint`**, 2.47:1 on white
and 2.28:1 on `--bg-page`. PRD §7 requires ≥3:1 for "UI boundaries and status
indicators against their background".

Built as specified rather than adjusted, because changing a token value is a
stop-and-ask (CLAUDE.md §8). Raised for decision.

Mitigating: the border is not the sole carrier — the hatch and the required
text label both carry the state, and `--status-unrecorded-ink` at 6.32:1
carries the words. So this is not a WCAG failure of the component as a whole.
But the dashed border is the most recognisable part of the treatment at a
glance, and at 2.2:1 it is faint on a large screen at arm's length.

Cheapest fix if wanted: use `--status-unrecorded` (`#8E86A8`) for the border,
which measures 3.05:1 on the tint and 3.43:1 on white and therefore passes. It
would also mean one fewer token. The swatch on `/dev/states` is annotated with
the measured figure.

### Discovered — the icon set differs from both documents

Surveyed the whole of `src/assets/icons/` before designing the pipeline:

- **57 category folders**, not "~40" as CLAUDE.md §3 and PRD §3.4 both state.
- 3,559 SVGs — that figure is exactly right.
- Plus **182 stray PNGs** and one `.DS_Store`, which the pipeline ignores.
- Exactly **one colour in the entire set**, `#141B34`: 11,410 `stroke=` and
  574 `fill=`. Also 3,559 root `fill="none"` and 5 `fill="white"` (four
  clipPath rects and `TRANSPORTATION/ambulance.svg`), all of which must
  survive untouched.
- 86% of files are stroke-only, 12% mixed, and **63 files are fill-only**. A
  stroke-only normalisation would have left 484 files (13.6%) hard-coded.
- 4 files in `LOCATION MAP` carry `<defs>`/`<clipPath>` with document-global
  ids like `clip0_8942_12006`. These are prefixed per-icon during
  normalisation, because an id collision between two inlined icons is silent
  and very hard to trace.
- **109 basenames appear in more than one folder, and 38 of those are
  genuinely different artwork.** This is the concrete justification for
  namespacing names by category.
- **28 filenames are dirty**: spaces (`lamp 04.svg`), a trailing space before
  the numeric suffix (`arrow-shrink -01-round.svg`), uppercase (`Lungs.svg`,
  `voice-iD.svg`), `&` and `+` (`horizontal-drag-&-drop.svg`, `c++.svg`), and
  a trailing underscore (`re_.svg`). The slug rule handles all of them:
  `c++` → `c-plus-plus`, `drag-&-drop` → `drag-and-drop`, `voice-iD` →
  `voice-id`, `re_` → `re`.
- **Zero slug collisions** across all 3,559 files. The generator enumerates
  every collision in one pass and exits, rather than stopping at the first.

### ⚠️ Open — file and folder icons are effectively unavailable

`FILES FOLDERS` contains **1 SVG and 124 PNGs**; `MEDIA` contains 4 SVGs and
53 PNGs. There is no generic `file` or `folder` icon in SVG form.

This will bite Phase 11 (Documents). CLAUDE.md §3 says to stop and ask rather
than substitute, so it is raised now rather than at the point of need. For
Phase 0 the Documents nav item uses `legal/legal-document-01`, which is a
genuine document icon rather than a lookalike substitute.

### Deviations from the plan, and why

- **`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` were tried and
  reverted.** Both are beyond the `strict: true` that PRD §3.1 requires. The
  first makes every CSS Module class access `string | undefined` — because CSS
  Modules are typed with an index signature — which would force `!` or `?? ''`
  at hundreds of call sites. `?? ''` is precisely the reflex CLAUDE.md §1
  tells us not to build, and the noise would train the habit where it does
  matter. The second conflicts with Radix's own `value?: string` props and
  buys nothing, since the status unions have no optional properties by design.
  Reasoning is recorded in `tsconfig.app.json` itself.
- **Stylelint uses four rules, not the one the PRD describes.** PRD §3.3's
  literal instruction — an allowed-list on every colour-bearing property —
  rejects legitimate shorthands like
  `border: 1.5px dashed var(--border-unrecorded)`. The four together
  (`color-no-hex`, `color-named`, an allowed-list on pure colour properties, a
  disallowed-list of raw colour functions on shorthands) enforce the same
  intent with no false positives. Verified by deliberately introducing a hex,
  an `rgb()`, a named colour and an off-scale `font-size`: all four rejected,
  `var(--ink-700)` accepted.
- **Type tokens are `-size`/`-line` pairs.** §4.3 gives one token name per step
  holding "32 / 40"; one custom property cannot usefully hold both. Still nine
  steps.
- **`@testing-library/dom` had to be installed explicitly.** It is a peer
  dependency of `@testing-library/react` that `--legacy-peer-deps` leaves
  uninstalled, and the failure mode is an unhelpful "Cannot find package"
  at test startup.
- **`vitest-axe` declares its matchers on the old global `Vi` namespace**,
  which Vitest 4 no longer reads, so `toHaveNoViolations` passed at runtime
  but failed `tsc`. Re-declared in `src/test/vitest-axe.d.ts`; remove when the
  package ships a `declare module 'vitest'` augmentation.
- **jsdom implements neither `matchMedia` nor `ResizeObserver`**, and both are
  used by code that has to be testable — `ViewportGuard` reads matchMedia,
  Radix overlays use ResizeObserver. Stubbed in `src/test/setup.ts`, with
  matchMedia reporting "does not match" so components render their desktop
  path under test.

### Found during visual review, and fixed

**A given dose with no second signature was reading as fine.** The `given` MAR
cell rendered as one green pill with "second signature not recorded" as small
print inside it. On a controlled drug that is precisely the Rule 3 failure —
an incomplete record looking settled.

Now the cell renders two facts with two treatments: the administration is
recorded, so it keeps the green pill; the missing witness is a hole in that
record, so it gets the hatch, in the same cell. `MarWitness` existing as a
union was necessary but not sufficient — the rendering had to honour it too.

**Fixture timestamps were an hour out.** Written as `…T08:04:00Z`, they
rendered as `09:04` because British Summer Time is UTC+1 and `date-fns`
formats in the viewer's local zone. The August and April fixtures now carry
`+01:00`; the March ones stay `Z`, which is correct for GMT.

⚠️ **Open, and it matters from Phase 3:** should a clinical record render in
the *site's* timezone or the *viewer's*? Right now it is the viewer's. An
auditor reviewing Rosewood Court from another timezone would currently see
every medication time shifted, which on a MAR chart is a misread waiting to
happen. Needs a decision before the MAR grid is built.

### Housekeeping notes

- `eslint-plugin-jsx-a11y` re-verified under ESLint 10 after installing eleven
  more packages with `--legacy-peer-deps`: `jsx-a11y/alt-text` still fires
  correctly on `<img>` without `alt`. The flag is used per-install only, never
  in `.npmrc`, per PRD §3.1.
- `tsconfig.app.json` had **no `"strict": true"`** despite PRD §3.1 requiring
  it. Added. `baseUrl` was also removed — TypeScript 6 deprecates it and
  `paths` resolves relative to the config file without it.
- `docs/PROGRESS.md` exists as an empty **directory**, not a file, so nothing
  can be appended to it. This file is at the repository root, which is how
  CLAUDE.md refers to it. The stray directory has been left alone.
- The repository was **not under version control**. `git init` was run and
  Phase 0 committed. Git identity is set repository-locally, not globally.
- `.husky/pre-commit` was not executable when husky created it, which silently
  disabled the hook on the first commit. Fixed and re-verified.
- **`README.md` is still the Vite starter template**, describing a scaffold
  that no longer exists. Not rewritten, because it was not in the approved
  Phase 0 scope. Worth replacing.
- The production bundle is 529 kB (164 kB gzipped), which is React, 13 Radix
  packages and the whole `/dev/states` page in one chunk. Fine for now; code
  splitting is a Phase 12+ concern when charts arrive.

### Verification performed

Each of these was checked by deliberately breaking it, not by assuming:

| Check | Result |
| --- | --- |
| Missing icon name | `npm run icons` exits 1, names the icon, gives `file:line` for every use, suggests the three closest real names. `npm run dev` refuses to start via `predev`. `tsc` rejects it separately. |
| Hex, `rgb()`, named colour, off-scale `font-size` in a component | Four separate stylelint errors, each with the custom message pointing at CLAUDE.md §4. `var(--ink-700)` passed. |
| Hatch redrawn in a second file | `npm run lint:hatch` exits 1, names file and line for all three markers. |
| A `case` removed from `ConsentBadge` | `tsc` fails: *"Argument of type '{ kind: \"withdrawn\"; … }' is not assignable to parameter of type 'never'"*. |
| Committing a file with a hex | husky pre-commit blocks it; HEAD unchanged. |
| Full suite | `npm run verify` green — icons:check, typecheck, eslint, stylelint, hatch, prettier, 19 tests including an axe pass on `/dev/states`. |
| Production build | `npm run build` succeeds. |

### Visual review performed

`/dev/states` was rendered in headless Chrome at 1400px and read section by
section. Everything renders: the shell with the site name and all sixteen
disabled modules, the Rule 3 comparison, all five MAR states, all six consent
outcomes each with an author, all three `Aggregate` shapes each with its
denominator, the primitives, and the token sheet.

**The greyscale claim was tested, not assumed.** The Rule 3 panel was
desaturated and re-read: the unrecorded pills stay clearly distinct from the
recorded ones — dashed border and hatch against solid border, filled dot and
solid tint. Rule 2 holds without hue.

### Still to check by eye at review

- A manual keyboard pass over `/dev/states` — tab order, focus visibility,
  focus trapping in the dialog and return to trigger.
- 200% zoom, checking no horizontal scroll in the content area.
- The `< 1280px` `ViewportGuard` message.
- Whether `--border-unrecorded` at 2.20:1 is acceptable in the flesh, on a
  real monitor at a real working distance. That is a judgement call, and the
  measurement above is only one input to it.

---

## Phase 1, Step 0 — data model, fixtures, timezone, session

Completed 20/08/2026. Reviewed through the Fixture Audit panel on
`/dev/states`. No user-facing screens — Residents is enabled by Step 1, which
builds the list; a nav item pointing at a screen that does not exist yet would
be a dead control.

### Decisions carried in from the Phase 0 review

1. `--border-unrecorded` is now `var(--status-unrecorded)`. As its own literal
   it measured 2.20:1 on the tint, below the 3:1 PRD §7 requires of a status
   boundary. At `--status-unrecorded` it measures **3.05:1** and passes, and
   there is one value that cannot drift from the other.
2. Clinical timestamps render in the **site's** timezone. Built into the data
   layer now rather than deferred to Phase 3.
3. Rule 3a — compound states render as separate facts.

### ⚠️ Deliberate departure from the source PRD — EOLC badge colour

Source PRD §16.3 specifies the EOLC badge as **grey**. It is built **blue**
(`--status-info`).

**Why.** Grey is reserved system-wide for unrecorded — it is the hatch, and it
is the one visual in the product that means "nobody has looked yet". A
*recorded* EOLC decision rendered grey would therefore read as an absence of a
decision, which is Rule 2 failing in precisely the place it must not: end of
life care is where the difference between "a decision was made" and "nobody
has asked" is least survivable.

`--status-info` is a recorded, factual, neutral state — right for a clinical
decision that is neither good news nor bad news — and it is visibly distinct
from DNAR's brand purple and ISOLATION's amber, so the two most consequential
badges on the strip cannot be confused peripherally.

**The source PRD should be corrected rather than this deviation persisting
silently.** Both are rendered side by side on `/dev/states` under EolcStatus,
and the greyscale toggle is the check.

### The timezone layer

`src/lib/format.ts` was rewritten around `Intl.DateTimeFormat` with an explicit
`timeZone`. **No new dependency** — `Intl` does this natively. `date-fns` now
supplies only `formatDistanceToNowStrict`, which is about elapsed time and is
correctly viewer-relative.

Three things make it hard to get wrong:

- **Every formatter that renders an instant requires a `timeZone`.** No
  defaulted parameter, no viewer-local fallback — a default is exactly how the
  wrong zone creeps back in. The compiler caught all 17 existing call sites the
  moment the signature changed.
- **A date-only `IsoDate` is never zone-converted.** `'2026-03-12'` is a date,
  not an instant; parsing it to UTC midnight and shifting it into a zone behind
  UTC moves it to the 11th — a silently wrong date on a DNAR or a consent
  record. `formatDate` takes no zone at all, and `src/lib/format.test.ts` pins
  that regression explicitly.
- **ESLint blocks `format`/`parseISO` imports from `date-fns`** outside
  `src/lib/format.ts`. Rendering a clinical time viewer-local is now a lint
  error rather than a review note. Verified by adding one and watching it fail.

`TimeZoneContext` nests deliberately: the app provides the active site's zone,
and a resident's subtree will provide *that resident's* site zone, so a
cross-site list renders each row in its own site's time rather than flattening
everything into whichever site happens to be selected.

**Zone labelling.** Shown when the viewer's resolved zone differs from the
site's. A UK manager sees `08:04`; an auditor abroad sees `08:04 BST` and
cannot misread the record.

### Found while building — fixtures that looked right but were not

Three problems the Fixture Audit surfaced that a description would not have:

1. **303 medication omissions, where PRD §5.3 asks for three.** The generator
   was producing ~2% omissions across 16,200 MAR records. Three hundred
   omissions would swamp the Phase 3 omissions view and make the escalation
   distinction — the entire reason `MarEscalation` is a union — impossible to
   see. Random omissions removed; the three are hand-authored with distinct
   escalation states (past 60 min, inside the 30–60 min window, not escalated).
2. **32 of 32 residents flagged "records incomplete".** True, and useless — a
   chip that fires on everyone is not a signal, and the list filter built on it
   in Step 1 would have discriminated nothing. `MissingRecord` now carries a
   `severity`: the chip fires on `critical` gaps (allergies, resuscitation,
   falls, GP, next of kin), while the profile still lists everything. Now
   **20 of 32**.
3. **31 of 32 residents carrying a stale record.** Care plan review dates were
   generated as "finalised up to 400 days ago, review 30–200 days later", which
   is almost always in the past. Rebalanced so 4% of domains are genuinely
   overdue. Now **23 of 32** — still a home under pressure, which is the point,
   but the Stale state discriminates.

A fourth thing worth recording: choking and dysphagia was being generated as a
rarely-assessed template while also being treated as clinically critical, which
by itself pushed almost every resident over the threshold. Dysphagia screening
is routine on admission in practice, so it moved to the core template set.

### Fixtures

32 residents (28 Rosewood Court, 4 Ashgrove Lodge), 14 staff across the seven
roles including one deactivated, 4,782 care notes and 16,200 MAR records across
106 medications, 90 days of history. Generated from a fixed seed with
Mulberry32 — no `Math.random`, so a review finding can be reproduced. `NOW` is
captured once at module load, because "admitted yesterday" and "due in the next
two hours" are inherently relative, and is exported so tests reason about the
same instant.

All ten §5.3 gaps are pinned to named residents and asserted twice: on
`/dev/states` for a human, and in `src/data/fixtures/fixtures.test.ts` for the
build. A generator quietly losing a gap would mean every screen built
afterwards was reviewed against tidy data and signed off for the wrong reason —
silent and expensive, so it fails CI instead.

Scope boundary: **incidents and activities are not generated.** Neither appears
in §5.3's ten gaps and neither is rendered by any Phase 1 screen, so designing
their types without their consumers is the guesswork that leads to a
fixture-shape change later — which CLAUDE.md §8 makes a stop-and-ask. They land
with their screens in Phases 4 and 9.

### Seven new status unions

`AllergyStatus` · `EolcStatus` · `IsolationStatus` · `SupportLevel` ·
`CarePlanDomainStatus` · `PhotoStatus` · `MoodRecord`. Each is closed, each has
an explicit unrecorded member, each has a `ByKind` entry in
`states.fixtures.ts` — so adding a member to any of them breaks the build until
it is rendered on `/dev/states`.

`AllergyStatus` is three members rather than `Recorded<Allergy[]>` on purpose.
An empty array standing for "confirmed none known" would put the most
consequential distinction in the product one `.length` check away from being
lost. PRD §6.2 wants three visibly different things, so there are three
members and the compiler insists on all three.

### Photos

No resident has a photograph on file, so all 32 render an initials monogram —
which is what the system genuinely shows in the absence of a photograph, not a
stand-in for one. A silhouette was rejected: §2.4 makes the photo a control
against wrong-subject writes, and a control that looks identical for every
resident is not a control.

The monogram is **not** hatched and does not feed the "records incomplete"
chip. A missing photograph is an identity aid, not a clinical or compliance
record, and spending the hatch on non-clinical gaps blunts the one signal that
matters.

The `on_file` branch is exercised on `/dev/states` against a synthetic sample
(`src/dev/sample-photo.svg`) so it is not dead code. That sample is dev-only,
deliberately abstract, and never appears on a real screen or in the fixtures.

### Nav and routing

§4.7 now lists **17** sidebar items — Handover was added (Phase 2). Dashboard
re-tagged to **Phase 12**, where §8 builds it alongside CQC Compliance on the
same aggregate machinery. `/` still redirects to `/dev/states` for this step
and moves to `/residents` in Step 1, when there is a residents list to land on.

### Verification

`npm run verify` green: icons:check, typecheck under `strict`, eslint,
stylelint, hatch guard, prettier, **50 tests across 7 files**. Production build
succeeds. Each guard checked by deliberately breaking it — a `date-fns`
`format` import rejected by ESLint, a stale icon registry caught by the
generator (the new Handover icon triggered it for real), and the timezone tests
formatting the same instant for London, New York and Tokyo so viewer-local
formatting fails on any machine rather than only on an unusually-configured one.

### Still to check at review

- The Fixture Audit panel at the top of `/dev/states` — ten of ten present.
- The new unions under Phase 1 states, with the greyscale toggle on. EOLC
  beside DNAR and ISOLATION is the one to look at hardest.
- Both `PhotoStatus` branches side by side.

---

## Phase 1, Screen 1 — Residents list

Completed 20/08/2026. `/residents`, and `/` now redirects to it.

### The severity model, as built

PRD §6.2 documents the chip as firing on critical gaps only. **Seven
criticals**: allergies · resuscitation decision · falls risk · choking and
dysphagia risk · GP · next of kin · care and support consent.

§6.2's written list omits choking. That is an error in the document, to be
corrected at the end of Phase 1: unassessed dysphagia is same-day dangerous,
the same class of risk as falls and allergies, so it stays critical and the
code leads the document here.

**Demoted** — still in `missing`, no longer in `critical`: pressure ulcer risk
(a weeks-scale harm, not a today-scale one), primary diagnosis, care plan
domains not started, care plan review never scheduled.

**The count: 19 of 32 residents carry a critical gap** — 15 of 28 at Rosewood,
all 4 at Ashgrove. Thirteen residents are clean, so the chip and its filter
discriminate. `fixtures.test.ts` bounds this, so a chip that fires on everyone
fails the build rather than reaching review.

Renamed from "Records incomplete", which overclaimed: it fires on a subset but
read as all gaps.

### Found while building

**Care notes dated in the future.** The generator wrote notes at every round
time on the current day, so a note could be timestamped twelve hours ahead and
render as "in 12 hours" — reading as a plan rather than an observation. The
deliberate gaps in these fixtures are all *absences*; a record of something
that has not happened is not messy data, it is impossible data. Notes, moods
and reviews are now clamped to `NOW`, and two tests pin it.

**The icon scanner missed `name={condition ? 'a' : 'b'}`.** It matched
`name="literal"` and `*.icons.ts` files but not a braced expression, so a valid
`IconName` used in a ternary passed the generator *and* passed tsc, then threw
at runtime. That is the one failure mode the pipeline was built to prevent, so
the scanner now reads every quoted string inside `name={…}`, filtered to the
namespaced shape — without the filter it reported `"ascending"` from the
ternary's condition as a missing icon, a false alarm that would teach people to
distrust the check. A typo that keeps the shape is caught by the scanner; one
that loses it is caught by tsc. Between them the coverage is complete.

**"All assessed — no flags" was unreachable.** The risk column rendered all
three resuscitation states, so every row had at least one flag and the settled
claim could never appear — dead code that looked like a feature. Fixed by not
drawing `for_resuscitation`, which is the settled value.

That last one produced the rule this column now runs on, and it is worth
stating plainly because it is the whole design:

> **Anything not shown in Risk flags has been recorded and is unremarkable.**

It is safe only because every *unrecorded* state renders hatched. No badge
therefore cannot mean "nobody looked" — it can only mean "looked, and it was
the settled value". Absence of a resuscitation badge means for-resuscitation
precisely because the other two states always render. The rule is stated in
the page lede rather than left as folk knowledge, and the full badge strip
with every state drawn is the profile header's job — that is the write
surface, and this is the index.

### Two empty states, deliberately different

"No residents at this site yet" and "No residents match these filters" are
different answers, and collapsing them would be the Evidence Invariant failing
at the level of a result set. The first says it is not a filter result; the
second says how many residents are still there and offers to clear the filters.

### The oldest-note sort

A resident with no care note at all sorts **first**, not last. Treating a
missing note as a missing date pushes them to the bottom, which hides exactly
the people PRD §6.2 built this sort to surface — never written up is more
neglected than written up long ago. The note column carries both directions
rather than reversing an array, so "oldest" keeps that handling.

### Layout

Eight columns did not fit at 1440px and the **Records** column — the one this
screen exists for — was the one falling off the right edge. Photo moved inside
the Resident cell, and the Site column now renders only when the list spans
sites. §2.4 requires the active site to be permanently visible and it is: top
bar, filter, and table caption. A column repeating "Rosewood Court" 28 times
adds no information and cost the Records column its place on screen.

A compact `chip` variant was added to `unrecorded.module.css` — the uppercase
badge form wrapped "CRITICAL RECORDS MISSING" plus seven gap names into an
unreadable block, and the names are the point.

### Add resident

Present but disabled with a "coming in a later phase" tooltip, matching the
sidebar, because **no phase in the PRD builds resident admission**. Under
read-only it is not rendered at all: an auditor has zero write (§1), and a
disabled button implies a capability they will never have.

### Prototype-only affordance

`?sim=empty|error|loading` makes the states seeded fixtures cannot produce
reviewable. It always renders a visible banner saying the state is simulated,
so it cannot be mistaken for real data. **Remove when a backend lands.**

### Also

- jsdom implements neither `hasPointerCapture` nor `scrollIntoView`, so any
  test opening a Radix Select threw. Stubbed in `src/test/setup.ts` alongside
  the existing `matchMedia` and `ResizeObserver` stubs.
- Each row renders in **its own site's** timezone via `SiteTimeZone`, not the
  active site's. Invisible today — both sites are `Europe/London` — and
  correct the moment one is not.
- Three new primitives: `Table` (a real `<table>`, sortable headers as buttons
  carrying `aria-sort`), `Card`, `EmptyState`. `EmptyState` requires a `body`,
  because an empty state with only a title says "nothing here" without saying
  why, which is the same failure as a blank cell one level up.

### Verification

`npm run verify` green — **67 tests across 8 files**. Rule 2 re-checked in
greyscale on this screen: hatched and solid stay distinct without hue. Beryl
Hutchinson (gap 1) shows a hatched "Falls — not assessed" and a chip naming
falls risk. Both empty states, the simulated-state banner and the disabled Add
resident confirmed by screenshot.

Still to check by eye at review: a keyboard pass over the sort headers and
filters, and 200% zoom.

---

## Phase 1, Screen 2 — Profile header and badge strip

Completed 20/08/2026. `/residents/:residentId`.

### Two additions to Screen 1, done first

**The convention moved from prose to the column.** The Risk flags rule —
*anything not shown has been recorded and is unremarkable* — was stated in the
page lede, which is prose a reader skims once and then forgets. It now lives in
a permanently visible legend beside the table, with real component samples
rather than mock-ups so it cannot drift from what the column renders. Not a
tooltip: PRD §6.4 sets the same rule for the MAR legend ("permanently visible
above the grid, not hidden behind a tooltip"), hover-only would put it out of
reach of a keyboard and a screen reader, and CLAUDE.md §6 forbids
hover-to-reveal for anything clinical.

**The precondition is now structural.** `risk-flag-sources.tsx` declares the
statuses the column is built from. `renderUnrecorded` is a required field, a
status can only reach the column by being in that list, and `residents.test.tsx`
asserts each entry draws a visible hatch — plus, for all 32 residents, that the
number of hatched badges equals the number of unrecorded sources, and that
"All assessed — no flags" never appears over a gap. A future addition cannot
break the rule silently: it cannot be added at all without declaring what it
looks like when nobody has looked.

Verified by adding a source whose `renderUnrecorded` returns `null`. Four tests
failed, naming the offending source and the resident:
*"Arthur Pemberton has 2 unrecorded sources (Probe status, Resuscitation
decision) but 1 hatched badges."*

**The scope narrowed to four while doing it.** Building the guard exposed that
EOLC and isolation were in the column with their *recorded* states drawn but
their unrecorded states silently absent — so the rule was already false. Fixing
it either way meant a choice: draw two more hatches on roughly half the rows,
or narrow the column. Narrowed, because volume that drowns a distinction is the
same failure as a blank cell, and the legend now names the four so "not shown"
has a declared scope rather than implying the column covers everything. EOLC and
isolation are on the profile header, where every state is explicit.

### The badge strip

Five badges, every state drawn, on every resident — the deliberate opposite of
the list. The list narrows and relies on a stated convention because it is a
management index; this is the point-of-care surface a care worker reads in
seconds before entering a room (PRD §1) and the one every write surface carries
(§2.4), so nothing about a person's safety is left to inference. FOR
RESUSCITATION is drawn here though it folds into a claim on the list. NO KNOWN
ALLERGIES is drawn — a recorded negative, which §6.2 is explicit must look
different again from both a finding and a gap.

`BadgeStrip` uses the same five components as `/dev/states`, so what is reviewed
there is literally what renders here. A test asserts all five list items are
present and non-empty for all 32 residents.

### The header

Sticky, not collapsible, does not scroll away — it is the structural mitigation
against a record written against the wrong resident. It carries the **site** as
well as the person, because the app top bar scrolls away on a long profile and
§2.4 requires the site to stay visible; a test pins that Nathaniel Brennan's
header names Ashgrove Lodge even though the session's active site is Rosewood.

Subject identity comes from the route parameter only. An unknown id renders an
error naming it and **no partial header** — a subject header missing half its
facts is one somebody can act on.

"Nothing due in the next 2 hours" is stated in words. An empty medication panel
would be indistinguishable from one that failed to load.

### Timezone, confirmed end to end

Screenshotted the same profile with the viewer in `Europe/London` and in
`America/New_York`. Same site, same records: London shows `16:06`, New York
shows `16:06 BST`. The wall-clock never moves — only the label appears, and only
when the viewer's zone differs from the site's. PRD §3.6 holds.

### Tabs

The four tabs render present but disabled with "coming in a later phase"
tooltips, matching the sidebar, so the profile does not change shape as they
land. Below them an honest statement rather than a blank panel, which would read
as a page that failed to load.

### Verification

`npm run verify` green — **84 tests across 9 files**. Screenshots read back for
the list legend, the profile header, and both timezone cases.

Still to check by eye at review: a keyboard pass over the profile, 200% zoom,
and whether the sticky header behaves on a long page once the tabs have content.

---

## Phase 1, Screen 3 — General Information tab

Completed 20/08/2026. `/residents/:residentId` is now a layout route; General
Information is its index child, so the subject header stays mounted rather than
being rebuilt by each tab. That is what makes it safe to write against (§2.4),
and it only holds because the tabs are children rather than separate pages.

### All sixteen §16.2 bullets, as twenty-one fields

Several bullets bundle two facts — "Full legal name and preferred name",
"Admission date and anticipated length of stay", "Diagnosis and medical history
(free text, plus structured fields for primary and secondary diagnoses)".
Splitting them is more precise, not less faithful: each half can be recorded or
missing on its own, and a bundled row would have to hedge about which half was
absent.

Grouped into five sections — Identity · Placement · Clinical · Care team · The
person. Presentation only; no field added, dropped or reworded.

### The guard

`general-information-fields.tsx` declares every field. The tab maps over the
declaration, and `general-information.test.tsx` asserts, for **all 32
residents**, that every field renders something non-empty, that none renders an
em dash, and that any field reading `unrecorded` renders the hatch.

The guard runs against `ProfileSections` — the real component the tab uses —
not a test harness that re-implements the logic. An earlier draft used a
harness; a guard that tests a copy of the logic proves only that the copy
agrees with itself.

**One declared exception, asserted exactly.** A photograph is an identity aid,
not a clinical or compliance record, so it renders an initials monogram and
says plainly that none is on file rather than taking the hatch. The test
asserts the exception list is `['photo']` — any *other* field opting out is a
hole in the invariant, so it fails rather than being quietly permitted.
Verified by flipping `religion` to `plain`: the test failed with
`expected [ 'photo', 'religion' ] to deeply equal [ 'photo' ]`.

### The three calls, as built

**Attribution on clinical and compliance fields only** — NHS number, funding
source, diagnoses, medical history, GP, pharmacy — plus **dietary
requirements**. That last one reads like a preference but is a clinical
instruction that reaches a plate; a field mixing "no pork" with "IDDSI level 4"
needs a source. Person-centred fields (language, communication needs, religion,
cultural background, pronouns, room) carry none, because twenty attribution
lines would bury the values they annotate.

**No invented staleness threshold.** Every recorded field shows its date and the
reader judges.

> **Stale is not applicable to this tab.** These fields carry no review or
> expiry date, so there is nothing to be past. Marking a value "may be out of
> date" after some number of months would be a clinical judgement with no
> backing in either document, and an invented number in a care record becomes
> fact the moment somebody acts on it. The other six states are answered:
> Loading and Error from `AsyncResource`, Populated on any well-recorded
> resident, **Partial** on Ismail Sowande, Read-only unchanged because there is
> nothing to write. **Empty does not exist here either** — a resident always
> has a legal name, date of birth and admission date, so the emptiest possible
> profile is Sowande's, and that is Partial.

**No edit controls, and no disabled Edit button.** Add Resident earned its
disabled state because §6.2 names the action; editing is named nowhere, so a
disabled button would be inventing a feature in order to disable it. A test
asserts no edit control exists.

### Allergies

A panel, not a row. §6.2 requires `--status-critical` wherever they appear, and
as one row among twenty they would read like any other. Where unrecorded, the
panel says it in words: *"Nobody has recorded whether this person has allergies.
That is not the same as having none, and medication must not be given on the
assumption that it is."*

### ⚠️ Modelling gap found — array fields cannot say "none"

`consultants: ProfessionalContact[]` cannot distinguish **"no consultants are
involved"** from **"nobody recorded them"**. An empty array is exactly the
empty-array ambiguity `AllergyStatus` was deliberately split into three members
to avoid, and it has reappeared here.

Read as the safer of the two for now — an empty list renders "Consultants and
specialists not recorded" — but that is a rendering decision papering over a
type that cannot express the distinction. The field wants to be
`Recorded<ProfessionalContact[]>`.

**The same gap affects `familyWithVisitingRights` and `otherProfessionals`,
which Screen 5 renders.** Changing them is a fixture type change and therefore
a stop-and-ask (CLAUDE.md §8), so it is raised here rather than done. Worth
settling before Screen 5, since that screen is mostly these lists.

### Verification

`npm run verify` green — **129 tests across 10 files**. Guard broken
deliberately and confirmed failing. Screenshots read back for Sowande (Partial,
almost everything hatched, no blank rows) and Okafor (Populated, attribution
present on clinical fields and absent on person-centred ones).

Still to check by eye at review: a keyboard pass over the tab strip, and 200%
zoom on the field grid.

---

## Array fields — the ambiguity that came back

Done before Screen 4, on instruction: cheap while three fields consume it,
expensive once a screen is built on it.

### The shape

```ts
export type RecordedList<T> =
  | { kind: 'not_recorded' }
  | { kind: 'none_involved'; recordedBy; recordedAt }
  | { kind: 'recorded'; items: [T, ...T[]]; recordedBy; recordedAt }
```

**Not `Recorded<T[]>`.** An empty array inside a `recorded` wrapper
reintroduces the same ambiguity one level down, so `items` is typed non-empty
and `recorded` cannot be empty.

`none_involved` carries an author because **"we asked, there is no LPA" is a
positive claim somebody made** — the same reason a recorded "No known
allergies" carries one, and the same reason it renders settled rather than
hatched (Rule 3). It is on `/dev/states` under `RecordedList<T>` with all three
states.

### The sweep — all eight array-typed fields reachable from `Resident`

| Field | Verdict |
| --- | --- |
| `consultants` | **Defect** → `RecordedList` |
| `importantPeople.familyWithVisitingRights` | **Defect** → `RecordedList` |
| `importantPeople.otherProfessionals` | **Defect** → `RecordedList` |
| `secondaryDiagnoses: Recorded<string[]>` | **Defect** → `RecordedList`. This was already the `Recorded<T[]>` shape, ambiguous one level down |
| `AllergyStatus.allergies.items` | **Defect** → `[Allergy, ...Allergy[]]`. An `allergies` record listing none contradicts its own member |
| `ConsentStatus.best_interest.consulted` | **Defect** → `[string, ...string[]]`. A best-interest decision reached without consulting anybody is not one (MCA 2005) |
| `Medication.roundTimes` | **Defect** → `[string, ...string[]]`. A scheduled medication with no rounds is not scheduled |
| `carePlan` | **Not a defect.** A complete enumeration of all ten domains, always fully populated, asserted. An absence would be a bug, not an ambiguity |

Also checked and clear: `risks` and `consents` are `Record<>` maps with every
key always present, asserted by existing tests.

Two shapes, not one. Where the array **is** the field, three members. Where the
array sits **inside a member that already asserts existence**, a non-empty
tuple — because there the emptiness is not ambiguous, it is contradictory, and
the type can simply forbid it.

### Fixtures and tests

Every `RecordedList` field has a resident in all three states, pinned rather
than left to probability: Ismail Sowande `not_recorded` (admitted yesterday,
nobody has asked), Grace Adeyemi `none_involved`, Emmanuel Okafor `recorded`.
`fixtures.test.ts` asserts all three exist per field, that `recorded` is never
empty, and that the non-empty tuples hold.

### Found while doing it — a positive claim went dead, silently

Changing the list fields shifted the generator's random stream, and afterwards
**no resident had an entirely settled risk picture** — so the residents list
could never render "All assessed — no flags". The branch had been reachable
when Screen 1 was reviewed; it went dead as a side effect of unrelated work,
and nothing would have caught it.

Cyril Broadbent is now pinned settled, with a test asserting at least one
resident is. The reassuring case has to exist for the same reason the alarming
ones do: **a screen reviewed only against gaps is a screen nobody has seen
working.** Worth generalising — the fixtures already guarantee every failure
state, and should equally guarantee every success state.

### Verification

`npm run verify` green — 141 tests. Screenshot read back of Grace Adeyemi
showing "No secondary diagnoses" and "No consultants or specialists involved"
as settled green claims with their authors, beside a hatched "Medical history
not recorded".

---

## Phase 1, Screen 4 — Needs tab

Completed 20/08/2026. `/residents/:residentId/needs`.

Read-only, generated from the care plan. PRD §6.2 and source PRD §16.2: "Each
need summary is a read-only view generated from the care plan."

### ⚠️ Found — §16.2's five need groups cover only nine of the ten domains

The five groups in §16.2 — physical care, cognitive and mental health, social
and emotional, communication, clinical — map between them to **nine** care plan
domains. **`end_of_life` belongs to none of them**, because §16.2 handles end of
life under Future Plans instead.

Rendering only the five would have dropped a care plan domain off this screen
entirely. **Absence from a list is the same bug as a blank cell**: a reader
scanning the Needs tab would have seen nine domains and had no way to know a
tenth existed, and nothing on screen would have said so.

Fixed by computing the leftovers rather than hardcoding the groups. Any domain
no group claims lands in a final "Other care plan domains" section, which
explains itself and points at Future Plans. If `NEED_GROUPS` and
`CARE_PLAN_DOMAINS` ever drift apart again the domain surfaces there instead of
vanishing, and a test asserts every domain appears **exactly once** across all
sections — so neither a disappearance nor a duplicate can pass.

This is the third time a list has been the failure surface rather than a field:
absence from the risk column, absence from the array types, and now absence
from a section grouping. Worth watching for on every remaining screen.

### The tab

All ten domains listed for every resident, whether or not anybody has written
them. Each row carries its domain status, its support level, and the care plan
text in the resident's own voice (source PRD §3.3 — "I like to…" rather than
clinical language, so it is quoted as theirs).

A domain with no content gets the hatch twice over, because two different
things are missing: `NOT STARTED` for the domain and `SUPPORT LEVEL NOT
ASSESSED` for the level. "Independent" and "nobody has assessed them" are
opposite claims about somebody's safety, and reading the second as the first is
how a person gets left to manage the stairs alone.

The "write this domain" affordance is present and disabled — the care plan
editor is Phase 6, and a live link would be a dead control.

### Stale — applicable here, unlike General Information

General Information has no review dates, so Stale was recorded as not
applicable to it. **Care plan domains do carry review dates**, so this tab has a
real Stale state and it is tested: Grace Adeyemi's mobility domain reads
`REVIEW DUE · due 20/06/2026 · 61 days overdue · finalised 20/06/2025` — PRD
§5.3 gap 7, finalised fourteen months ago and never reviewed.

Empty does not exist separately here either: every resident has all ten domains
listed, so the emptiest state is Sowande's, where all ten are `not_started`.
That is Partial, and it is tested.

### Small fixture fix

A care plan summary in the pool read "I miss my wife", assigned at random and
landing on female residents. Changed to "my late partner". Fixture texture, not
a product defect, but a jarring detail in review is a distraction from real
ones.

### Verification

`npm run verify` green — **181 tests across 11 files**, including one that
renders the Needs tab for **all 32 residents** and asserts every one of the ten
domains is present and non-empty. Screenshots read back for Grace Adeyemi
(Stale, and the leftover section) and Ismail Sowande (all ten hatched).

Still to check by eye at review: keyboard pass over the tab strip and the
disabled domain links, and 200% zoom on the four-column domain rows.

---

## Navigation bar restyle — 20/08/2026

Not a phase. Frank supplied a reference design (a "Kretya Studio" sidebar) and
asked to adopt that style of navigation bar, then made three calls: give our
nav its own section with our logo as the reference does; ignore the reference's
dark-mode toggle; and on count badges, show the number with the denominator in
the accessible name.

### What changed

The product mark moved out of the top bar and into a block at the top of the
sidebar, and the shell grid changed so the sidebar is its own full-height
column:

```
grid-template-areas:
  'sidebar topbar'
  'sidebar main';
```

The first attempt kept the top bar spanning the full width, which stacked two
header bands and put the mark below the bar rather than at the top-left. That
is not what the reference does and it wasted a band of vertical space.

The seventeen nav items gained a `section` field and are grouped under four
headings — Care delivery · Planning and risk · Governance · Administration —
with the first group (Dashboard) unlabelled, as the reference has it.
**§4.7's order is preserved exactly**; the headings were inserted at boundaries
that already existed, so nothing moved. `navSections` is declared alongside
`navItems` and a test asserts every item belongs to a declared section, so an
item cannot end up in a section that does not render.

### The count badge, and why it is not a bare number

§4.7 wants a figure at a glance. CLAUDE.md §1 forbids a bare count. Frank's
call — number visible, denominator in the name — resolves this rather than
splitting the difference: the badge is a **glyph pointing at a claim**, and the
claim is carried in full by the item's accessible name. The figure itself is
`aria-hidden`, so a screen reader never receives the bare number; it receives
"Reviews — 2 care plan reviews overdue, of 32 residents."

Collapsed, the figure becomes a dot. A truncated number is worse than no
number, and the accessible name does not change between states.

**Reviews is badged from real data** — 2 of 32 residents have an overdue care
plan review — and the badge sits on a *disabled* item deliberately. The overdue
reviews exist whether or not the Reviews module has been built, and they are
already reachable from the residents list and the profile. Hiding the figure
until Phase 7 would be hiding a fact about the home, not tidying a screen.

**Incidents carries no badge**, because there are no incident fixtures yet.
A badge reading "0 open incidents" would be a claim nobody has the evidence to
make. Absent is not zero — the same rule as a blank cell, applied to a count.

### Collapsing must not strip a name

PRD §7 allows an icon-only control only with an adjacent visible label, or an
`aria-label` plus a tooltip. Collapsed, the visible labels are gone, so without
care the rail becomes seventeen unlabelled buttons. `Sidebar.test.tsx` now
iterates `navItems` and asserts **each of the seventeen** still has an
accessible name in the collapsed rail, and that the collapse control itself is
named in both states. Tooltips now render on collapsed items as well as
disabled ones.

Screenshots read back in both states. Expanded: mark at top-left, section
headings, active pill on Residents, red 2 on Reviews, phase tags on the
disabled fourteen. Collapsed: mark only, icon-only items, section rules
retained as separators, badge as a dot.

### Needs Frank's decision

**PRD §4.7 still says the top bar carries the "diGi-Care wordmark".** It does
not any more — the wordmark is in the sidebar. Editing `FRONTEND_PRD.md` is a
stop-and-ask under CLAUDE.md §8, so that line is left as-is and flagged rather
than quietly corrected.

### Unrelated bug found by the clock rolling over

`fixtures.test.ts` began failing mid-session with an administration record
timestamped ~2 minutes in the future. The guard in `medications.ts` checked
that `dueAt` was in the past, then added a random 1–25 minute offset on top,
which can overshoot now. Same defect as the care-notes-in-the-future bug from
Step 0, in a second place.

Care notes could skip an impossible note. **A MAR cell cannot** — dropping it
leaves a hole in the grid, and a missing cell is the exact ambiguity this
product exists to prevent. So the offset is clamped to now instead
(`recordedAfter`), and every past round stays accounted for. The random draw
still happens on both branches, so the RNG stream and every downstream fixture
are unchanged.

The sweep test only catches this when the wall clock sits inside the overshoot
window — a few minutes after a round time, which is most of the day not true.
That is why it survived until today. The clamp is now tested directly, and the
test was confirmed to fail with the clamp removed.

**Third recurrence of the same class**: a timestamp derived from a valid one by
arithmetic is not itself validated. Care notes, then administration, then
refusal records in the same function. Worth a look wherever a fixture computes
one time from another.

---

## Navigation bar — four corrections — 20/08/2026

Frank's review of the restyle: move the collapse control into the logo block,
make the top bar white, give the rail curved edges, and fix the Residents icon,
which when collapsed was displaced and had no active state.

### The collapsed active item was a bug, not a styling slip

Worth writing down because the cause was invisible from the symptom.

The rail rendered enabled and disabled items through **different branches**.
The disabled branch built its class list as a string. The enabled branch used
NavLink's *function* form of `className` — and when collapsed, wrapped it in a
Radix `Tooltip`. Radix's Slot merges a trigger's className with its child's by
**joining them as strings**, so the function was stringified. The item lost
every class it had: no padding, no centring, no active pill. Fourteen disabled
items looked correct and the one enabled item did not, which is exactly the
shape that reads as "a CSS problem with that icon".

Fixed by collapsing all four cases — enabled, disabled, collapsed, expanded —
into a single `SidebarItem` that computes `isActive` with `useMatch` and builds
a **string** class list in every branch. The divergence now has nowhere to live.

`Sidebar.test.tsx` gained the tests that would have caught it: the current item
carries `.item` and `.active` in both states, and *every* row carries the base
`.item` class in both states. Confirmed by restoring the old component — the
collapsed cases fail, the expanded ones pass, which matches the bug exactly.

**The general lesson: every existing sidebar test asked about accessible
names. None asked whether an item still looked like an item.** The naming
tests all passed throughout — the accessible name was never affected.

### A second silent failure, from the same edit

Moving the `/dev/states` item into an object literal in `Sidebar.tsx` took its
icon name out of the Tier-1 JSX scan's reach. `npm run icons` regenerated the
registry **without** it, `icons:check` reported the registry current — because
it was current, for the wrong input — and the screen threw at runtime.

The declaration now lives in `nav-items.icons.ts` as `devStatesItem`, which the
Tier-2 scan reads. Noting the gap rather than redesigning around it: an icon
name that is valid (`IconName` covers all 3,559) but no longer *detected as
used* is caught by neither the type system nor `icons:check`. It is caught by
rendering, and the component tests do render — `npm run verify` would have
failed. It only escaped because a build was run out of order.

### The three visual changes

**Top bar white.** A background swap alone would have put white text on white,
so every colour that sat on the deep purple moved to its ink equivalent, and
the borders moved to `--border-strong`, which is what Select, Button and
`control.module.css` already use on white. The bar is now consistent with the
rest of the app rather than the one surface with its own rules.

**The rail is a card.** `AppShell.module.css` insets it by `--space-12`; the
sidebar carries `--radius-lg` and a `--border-subtle` edge — the same surface
language as the tables and panels, rather than a wall running to the crop.

**Collapse control in the logo block.** Expanded, it sits at the right of the
mark and wordmark. Collapsed, the block stacks: mark above, control below.
Both stay visible — hiding the mark loses the product, hiding the control
strands the reader in the narrow rail. The block's height is the top bar's
height less the inset, so its rule lands on the same line as the top bar's
instead of 12px below it.

### Contrast, checked rather than assumed

Recolouring onto white re-opened every ratio in the bar. Fifteen pairs
measured; one genuine failure found and fixed, and it was **pre-existing from
yesterday's work, not from the recolour**: section headings were `--ink-400`,
2.93:1 on white. Now `--ink-500`, 5.36:1.

Disabled item text stays `--ink-400`. WCAG 2.2 exempts inactive controls
(1.4.3, "Incidental"), and disabled is carried by cursor, `aria-disabled`,
tooltip and phase tag as well as colour — never colour alone.

### Needs Frank's decision

1. **PRD §4.7's "diGi-Care wordmark" in the top bar** — still outstanding from
   the previous entry. The wordmark is in the sidebar.
2. **PRD §4.7 / the diGiLog language describe a deep purple top bar.** It is
   now white, at Frank's instruction. Same class of correction needed.
3. **`--border-strong` on white is 1.24:1.** WCAG 2.2 §1.4.11 wants 3:1 for a
   control boundary that identifies the control — a text input's edge
   qualifies. This is **app-wide**, not local to the top bar: every Select,
   Button and input already uses it. Both border tokens are marked ✅ verified
   in `tokens.css`, so changing one is a token decision (CLAUDE.md §8), not
   something to fix quietly in one stylesheet. Flagged, not touched.

---

## Residents list — visual density pass — 20/08/2026

Frank's note: the screen shouted reassurance as loudly as risk. The loudest
thing in the table was a green *completed review* — the least actionable fact
on it — while "FALLS — NOT ASSESSED" was a quiet grey outline. Hierarchy
inverted, on the one screen whose job is finding neglect.

His corollary is the one that made this tractable, and it is now a rule:

> Not shown means recorded and unremarkable.
> **Shown but unremarkable should be quiet.**

### The missing third weight

The system had two: `StatusPill` (recorded) and `Unrecorded` (a hole). So
"recorded and fine" had to borrow the treatment built for "recorded and
urgent". That is the whole defect — not a styling slip, a gap in the
vocabulary.

Added `<Settled>`: plain secondary text, no fill, no border, no radius. It
renders the same complete record a pill would, author and timestamp included,
always visible and never hover-only (PRD §3.6). It is simply not shouted.

**It is not for gaps, and the doc comment says so in as many words.** Reaching
for it to calm down an inconvenient omission would be the exact bug this
product exists to prevent, and it is the obvious way this component gets
misused later.

`/dev/states` gained a **Three weights, in order of demand** panel. A new
weight nobody can see side by side with the other two is a weight that drifts;
the panel also asks the question Rule 3's panel cannot — do they rank in the
right *order*, and does the order survive greyscale.

### The seven changes

1. **Completed and in-date reviews are plain text.** `ReviewBadge` gained
   `emphasis`. `compact` (the list) drops settled states to `<Settled>`;
   `comfortable` (the profile, where there is one badge not 28) is unchanged.
   Pills stay for `due` and `overdue`; `never_scheduled` stays hatched in both.
   One component, one exhaustive switch — a second renderer would let a union
   member get dropped.
2. **One allergy badge listing every allergen.** Three stacked pills said
   "allergies" three times and let three mild sensitivities out-shout a missing
   falls assessment. Every substance is still named; there is no "+2 more".
3. **The dots are gone.** Their stated justification — "a second, non-textual
   carrier so the pill survives greyscale" — was **never true**. In greyscale a
   red dot and an amber dot are the same grey, exactly as their fills are. The
   dot carried hue and only hue. What actually survives greyscale is the label,
   and for the distinction that matters, solid border against dashed hatch.
4. **Lighter badges**: 1px border, `--radius-sm`, tighter padding. They read as
   buttons and none of them are pressable. **Text was already at
   `--text-micro`, the smallest step in the scale — it did not go lower.** A
   tenth step is a conversation (CLAUDE.md §4), not something to slip in
   during a density pass.
5. **The non-critical count folded into the chip**, one line, em dash between
   the named criticals and the counted rest: what is named is critical, what is
   counted is not.
6. **Row rhythm**: `<colgroup>` widths declared off the same array as the
   headers, `table-layout: fixed`, padding 12/16 → 8/12. Scanning a column only
   works if the column has the same edges on all 28 rows.
7. **Legend compressed** to two tight lines from four. Layout only — still in
   the flow, still selectable, still keyboard- and screen-reader-reachable.
   Nothing moved behind an interaction.

### Judgement calls Frank did not specify — reversible, and flagged

- **`scheduled` reviews went quiet too.** He named due, overdue and
  never-scheduled as keeping pills. A review booked for October is exactly as
  unremarkable as one completed in August, and leaving one blue pill in a
  column of quiet text would rebuild the same inverted hierarchy at lower
  volume.
- **"All assessed — no flags" and "Critical records complete" went quiet.**
  Both were green pills. Neither is hidden — the claim still has to be made,
  because a blank cell there means either that or "nobody looked" — but making
  the residents with nothing wrong the most eye-catching rows was the original
  complaint in a second place.
- **Items 3 and 4 were applied to `StatusPill` globally**, not just here. The
  critique is of the component, not of one screen's use of it; a `density` prop
  making the same fact two different weights is the local override CLAUDE.md
  §4 warns about. This changes the already-approved Screens 2, 3 and 4.
  Screenshot of Emmanuel Okafor's profile read back — the badge strip is
  tighter and the hatched "falls risk — not assessed" stands out **more**
  against the lighter pills, not less.

### Greyscale, re-run as instructed

Dropping the dots cost nothing. In greyscale "FALLS — NOT ASSESSED" (dashed,
hatched) against "DYSPHAGIA — HIGH" (solid border) is unmistakable, and the
Records chip's hatch is the most conspicuous thing on the row. The distinction
the product turns on was never carried by the dot.

Contrast re-measured for the new quiet text, including on the hovered row
background, which is the case easy to forget: label 10.24 / 8.86, detail
5.36 / 4.64. All clear AA. **Quiet is a matter of weight and chrome, never of
contrast — a record nobody can read is not a quiet record.**

### One test loosened, deliberately

`residents.test.tsx` asserted the legend's exact wording (`/Not shown/`), which
broke on a casing change. Rewritten to assert the legend's own text contains
all three claims, case-insensitively. The guard should be *that the convention
is still stated*, not that it is worded a particular way — the first survives
copy edits, the second just gets updated to match whatever the code now says,
which is not a guard at all.

---

## Comment sweep — justifications checked against what the code does — 20/08/2026

Frank, on the dots finding: *"A comment asserting a justification that was
never true is worse than no comment — the next reader believes it and stops
checking. That pattern rarely occurs once."* It did not. Ten found.

Split by what is actually wrong, because the fix differs.

### A. The guarantee does not exist — the dot pattern proper

**1. `src/dev/TokenSheet.tsx` — "Contrast ratios are measured, not asserted …
the figures below are what the palette actually computes to."**

They are hardcoded string literals: `inkOnTint: '4.99'`. Nothing on the page
computes anything. The sentence draws a distinction and then does the thing it
says it is not doing — on the page whose entire job is proving the palette
meets WCAG. Edit a token and the swatch changes while the ratio beside it goes
on saying whatever it said before.

**2. `src/lib/format.ts` — "ESLint enforces it, so a component cannot quietly
render viewer-local time."**

The rule bans four `date-fns` names. It does nothing about `toLocaleString`,
`toLocaleDateString`, `toDateString`, or `new Intl.DateTimeFormat()` with no
`timeZone` — all render viewer-local, all pass lint today. Checked: no rule
anywhere covers them.

**And the hole is already occupied.** `src/data/fixtures/medications.ts` keys
every MAR record by `date.toDateString()` — machine-local. Harmless while it is
an internal key and both sites are Europe/London. It must not reach Phase 3's
grid unexamined, where a day boundary in the wrong zone puts a round on the
wrong date.

**3. `src/components/primitives/AlertDialog.tsx` — "The type is what enforces
it — a confirmation cannot be built here without a sentence naming who it is
about."**

`title: string` and `confirmLabel: string` are required strings. A required
string enforces *presence*, not *content*: `title="Are you sure?"` compiles.
This one guards §2, wrong-subject writes — the second pillar of the product —
and it is carried by review, not by the compiler. Contrast `Unrecorded`'s
label, where a missing prop is a type error *and* a test catches an empty one.

**4. `src/components/icon/Icon.tsx` — "predev/prebuild make that impossible in
a fresh session."**

Disproved in a fresh production build earlier today. The comment names one
cause (registry stale). There is a second: the registry is *current* but the
scanner could not see the name, so it is regenerated **out**, `icons:check`
reports current — correctly, for the wrong input — and this throws at runtime.
A valid `IconName`, so the type system cannot catch it either.

**5. `src/components/status/Unrecorded.tsx` — "enforced three ways."**

Two of the three are enforced. The first — "this component is the only consumer
of the classes" — is a description wearing an enforcement's clothes. `composes:`
reaches the canonical classes from any stylesheet, and `check-hatch.mjs` prints
instructions recommending exactly that. A second component composing them would
apply the hatch with no required label and nothing would fail.

### B. True once, stale now

6. `nav-items.icons.ts` — "All **sixteen** items are listed." There are 17, and
   the same file says "seventeen" 26 lines later. A comment contradicted by its
   own file.
7. `routes.tsx` — "Phase 0 registers **three** routes and no more." Seven now,
   and the very next paragraph describes routes this sentence forbids.
8. `session/context.ts` — "**Three** screens in Phase 1 need all of it."
   Phase 1 is six screens.
9. `needs-sections.ts` — cites `needs.test.ts`; the file is `needs.test.tsx`.
   (The claim it makes is true — that test does assert every domain appears
   exactly once.)
10. `EolcBadge.tsx` — "so **the two** most consequential badges cannot be
    confused at a glance", after listing three. And the distinctness rests on
    hue: in greyscale the three tints are close and the labels do the work.
    Acceptable under PRD §7 — but not what it said.

### What was checked and holds

Not every claim was wrong, and the ones that hold are the ones with a test
behind them: `risk-flag-sources`' hatch precondition (asserted per source, with
a non-empty-text check), `general-information-fields`' declaration guard
(present, non-empty, and not an em dash, per field per resident),
`needs-sections`' exactly-once, `AggregateFigure`'s inseparable denominator
(`coverage` is required on both members of `Aggregate`), `tokens.css`'s
stylelint claim, and `main.tsx`'s five font weights against five imports.

**The pattern in the failures:** every false claim named a mechanism that
sounded like it should work — a type, a lint rule, a build step — where the
mechanism enforced something adjacent to the claim but narrower. Presence
rather than content. One import path rather than a capability. Redrawing rather
than reuse. None was a lie; each was a guarantee described one size too large.

### Done now

All ten comments corrected to say what the code actually does, including
naming the gap where one is left open. No behaviour changed. `npm run verify`
green, 212 tests.

### Three open decisions for Frank

Correcting the words removed the false confidence. It did not close the holes,
and each has a real cost:

1. **Compute the contrast figures** from `getComputedStyle` on the dev page, so
   the sentence becomes true and self-maintaining. Small, contained, dev-only.
2. **Extend the timezone guard** — an ESLint `no-restricted-syntax` rule for
   `toLocaleString`/`toDateString`/`Intl.DateTimeFormat` without `timeZone`,
   exempting `src/lib/format.ts`. Would have caught the `medications.ts` case.
   Also needs a decision on that MAR record key before Phase 3.
3. **Make AlertDialog's subject naming checkable** — a branded type minted by a
   helper that takes the resident, so the compiler sees the subject; or a test
   over every call site. The first is stronger and more intrusive. There are no
   AlertDialog call sites yet, so this is cheapest to decide now and free to
   apply later.

And one guard worth extending cheaply: **`check-hatch.mjs` could also flag
`composes:` of the canonical classes outside `Unrecorded.module.css`**, which
would turn finding 5's open gap into an enforced one.

---

## Top bar — card treatment and fixed in place — 20/08/2026

Frank: give the top bar curved edges too, and fix it in place.

### Curved edges

Both chrome surfaces are now cards on the page background, inset by the same
`--space-12`, with the same `--radius-lg` and `--border-subtle` as the panels
inside the content. The bar's `border-bottom` became a full border.

The sidebar's brand block went back to the full `--layout-topbar-height`. It
had been `topbar-height - space-12` to compensate for the rail being inset
while the bar was flush; now that both cards start at the same 12px origin,
equal heights put the brand's rule exactly on the bar's bottom edge. The
compensation was removed rather than left in and re-tuned.

### Fixed in place — why sticky would not have done it

`position: sticky` on the top bar would not work: it is a grid item, so it can
only stick **within its own grid area**, and that area is one row tall. It
would have looked correct until the first scroll.

So the shell fills the viewport and does not scroll — `height: 100vh`,
`overflow: hidden` — and `.main` becomes the only scrolling region. The bar and
the rail are then held by layout rather than by a scroll trick, which also
means they cannot judder or detach.

Checked first that nothing depended on window scroll: no `ScrollRestoration`,
no `window.scrollTo`, no `scrollIntoView` outside tests. If Phase 2's care note
timeline wants scroll restoration, it now belongs on `.main`, not the window.

The sidebar no longer needs `position: sticky` and no longer has it.

### A gutter, not a slice

First pass had row one at `topbar-height + space-12` — inset above the card
only. Scrolling content was then clipped flush against the card's bottom edge,
which read as the table being cut rather than passing beneath. Row one is now
`topbar-height + space-12 * 2`, leaving a strip of page background under the
bar. The card floats over a gutter, matching the rail.

### Verified by scrolling, not by assertion

A layout claim that only holds at scroll position zero is the kind that passes
review and fails in use. Checked by loading the app in an iframe, polling until
`main` was actually scrollable, scrolling it 1200px, and reading the screenshot
back: bar and rail unmoved, content passing under the gutter. Worth repeating
whenever the shell's scroll container changes.

`npm run verify` green, 212 tests.

---

## App switcher — 20/08/2026

Frank asked for a More Menu icon beside the notification icon, then clarified:
*"it's suppose to be a button that leads to other digi app, like digilog, etc,
just like google has"* — an app launcher, not a kebab overflow menu.

### The icon

**The set has no 3×3 dot grid.** Rendered every plausible candidate to a sheet
and read it back rather than guessing from filenames: `MORE MENU` holds
`menu-01`–`menu-11` (all hamburgers), `more-horizontal`/`more-vertical`
(ellipses), and two 2×2 grids — `menu-circle` (dots) and `menu-square`.

Chose `more-menu/menu-circle`: a 2×2 dot grid, the closest thing the set has to
Google's 3×3, in the semantically right category. Deliberately **not**
`dashboard/dashboard-square-01`, which the Dashboard nav item already wears —
two different things in the same chrome wearing one glyph is its own confusion.

This is a density difference, not a substitution of one concept for another, so
it does not trip CLAUDE.md §3's stop-and-ask. Flagged to Frank anyway, since he
named Google's specifically.

*(Noticed while looking: the vendor's `DASHBOARD` folder also contains clothing
icons — `baby-boy-dress`, `belt`, `cardigan`. Vendor packaging, harmless, but
it means category names are not a reliable guide to contents. Look before
choosing.)*

### What is in it, and what is not

**Only apps the documents name.** Two qualify, and both are cited in
`digi-apps.ts` beside the entry:

- **diGiLog** — PRD §4.3 and §4.7, the design language this product inherits;
  §4.3 cites its dashboard and the Alerts card the status pills were sampled
  from. Described as "Dashboard and alerts".
- **diGi-Time** — PRD §6.3, "shift (auto from diGi-Time fixture)". Described as
  "Shifts".

A launcher is exactly the surface that invites invention — diGi-Pay,
diGi-Recruit — and each made-up name would be a fictional product sitting in
real chrome, indistinguishable from a real one to anybody reviewing this. Same
reason every description is grounded in the sentence cited above it rather than
written to sound plausible.

### Nothing navigates, and it says so

This build is frontend-only with no backend and no shared session, so there is
**nowhere to send anyone**. Every item is disabled and states its own reason in
visible text inside the item — "Current app" or "Not in this prototype" —
rather than in a tooltip. Radix skips disabled items in focus order, so a
tooltip on one would be a reason a keyboard user cannot reach, and a reason
nobody can reach is not a reason.

This follows PRD §6.4's rule for the stubbed MAR export: present, honest,
**never a silent no-op**. A link that 404s or quietly does nothing would be
worse than the disabled state. `DigiApp` gains a `url` the day there is one.

### One thing fixed in passing

**The alerts bell has been icon-only with an `aria-label` and no tooltip since
Phase 0**, which PRD §7 does not allow — it requires a visible adjacent label,
or a name *plus* a tooltip. It now has one. Fixed because the new control sits
directly beside it and would otherwise have been correct next to something that
was not.

### Also

The menu heading is "Apps", not "diGi apps": `.menuLabel` uppercases, and
"DIGI APPS" mangles a brand whose casing is the point. The trigger's accessible
name and tooltip keep the full "diGi apps".

Tests hold the two things that stop a launcher drifting into fiction: the
rendered list is exactly the declared list, and every app with nowhere to go
says so in reachable text. 217 tests green.

### Needs Frank's decision

**PRD §4.7 lists five things in the top bar — wordmark, site name, site
switcher, search, alerts bell, user menu — and no app switcher.** Third
outstanding correction to that section, after the wordmark moving to the
sidebar and the bar turning white.

---

## App switcher — icon corrected, controls grouped — 20/08/2026

### Correcting the entry above

The previous entry says **"The set has no 3×3 dot grid."** That is false, and
the way it got written is worth recording, because it is the failure mode this
morning's sweep was about — a confident claim, in a log, that the next reader
would believe and stop checking.

I built a comparison sheet and read it back rather than trusting filenames,
which was the right instinct. But I chose what went **on** the sheet by
guessing from names: I included `more-horizontal` and `more-vertical` from the
`MORE MENU` family and never rendered `more-01`, `more-02`, `more-03` sitting
directly beside them. All three are 3×3 grids. `more-02` is 3×3 circles — the
launcher glyph, exactly what was asked for.

**Looking at the evidence does not help if you pre-filter the evidence by the
thing you were trying to avoid relying on.** The sheet made the conclusion feel
verified while the sampling was still a guess.

Frank spotted it: *"use the more-02 icon instead"*.

`shellIcons.appSwitcher` is now `more-menu/more-02`. It remains deliberately
not `dashboard/dashboard-square-01`, which the Dashboard nav item wears.

### Closing the gap

The top bar was one flex row with `gap: var(--space-24)` between every child,
so alerts, apps and user sat as far apart from each other as they did from the
search field — three unrelated controls rather than one cluster.

They are one cluster: who you are, and what is waiting for you. They now sit in
an `.actions` group at `--space-4`, and the bar's wider gap falls between the
search field and the group, which is where the actual boundary is.

Grouping is layout only. Nothing moved in the DOM order, so tab order is
unchanged: bell → apps → user.

217 tests green.

---

## Residents list — analytics tiles and the name column — 20/08/2026

Five tiles above the table, each clickable and each carrying its denominator;
the name column down to one line.

### Figures come from fixtures, not from the brief

Frank's example figures were 28 / 16 / 3 / 4 / 6. The fixtures say 28 / 16 /
4 / 1 / 4 at Rosewood. Fixtures are the specification (CLAUDE.md §6), so the
tiles compute and the numbers are what they are — tuning fixtures to match an
illustration is the failure this project has been avoiding since the 303
omissions.

### The catch: an "overdue" tile would have hidden a whole category

The brief said **Reviews overdue · 3 of 28**. Counting `kind === 'overdue'`
alone drops `never_scheduled` — a separate member of the same union.

At **Ashgrove Lodge that tile reads 0 of 4**, and three of its four residents
have never had a review scheduled at all. A tile saying "0" over a home where
75% of reviews were never booked is untrue by omission, and it is PRD §2.1's
named failure verbatim: *"'Never scheduled' and 'scheduled and completed on
time' must not both render as untroubled."*

The tile is now **"Reviews overdue or never scheduled"** — the label names both
categories, the count is both, and a new `ReviewFilter` member
(`not_up_to_date`) lets the click select both. Rosewood reads 4 (2 overdue,
2 never scheduled); Ashgrove reads 3.

### Rule 4 — thin denominators, and where Insufficient Evidence honestly fires

Frank's rule: *a tile whose denominator is too thin to support the figure shows
Insufficient Evidence rather than a number — Ashgrove with 4 residents is the
case to check.* Checked. **It does not fire at n = 4, and it should not.**

"1 of 4 residents has a critical gap" is an exact, complete count over the
whole population — not an estimate from a sample. There is nothing to be
insufficiently evident about; suppressing it would hide four true facts. And
inventing a minimum-n rule would need a number neither document contains,
which is the thing Frank ruled out on Screen 3: *"Fabricating a clinical
judgement with no backing in either document is how invented numbers become
fact."* The only documented threshold is §2.3's 60% **coverage**.

So Insufficient Evidence fires on coverage, and there are two real triggers:

1. **Nobody to count.** `total === 0`. A subset over an empty population is
   undefined, and `coverageRatio` already returns 0 for an empty denominator
   precisely so it never reads as reassuring. Reachable and reviewable at
   `?sim=empty`, where four tiles hatch and the census tile correctly still
   says "0 at Rosewood Court" — because *how many residents are here* is an
   exact fact about an empty home too. That `census` / `subset` split is the
   whole reason the distinction is in the type.
2. **The window has not elapsed.** "No care note in 48h" cannot be asserted
   about somebody resident for 20 hours — the answer is not "no problem", it is
   not yet knowable. Those residents leave the denominator and the tile says so
   in words. **Ismail Sowande at Ashgrove is the live case**: admitted 45 hours
   ago, PRD §5.3's gap 3. Ashgrove reads *"0 of 3 residents here 48h or longer
   at Ashgrove Lodge — 1 admitted more recently than that, so the window has
   not elapsed for them."* Coverage 75%, above the threshold, so the figure
   still shows. Below 60% it would hatch.

**Open for Frank:** if a minimum population is wanted regardless of coverage,
that needs a number from him, not from me.

### Loading is not empty

Placing the tiles above the table put them above the loading branch too, so
during a load `atSite` was `[]` and four tiles announced *"Insufficient
evidence — there are no residents here to count."* That is a claim about the
home nobody is entitled to make yet.

"We have not looked yet" and "we looked and there is nobody" are opposites —
the Evidence Invariant applied to the fetch state, not to a record. Tiles now
render only once the read resolves. `?sim=empty` still shows them, because
that state has genuinely loaded and the claim is earned. Both directions
tested.

### The other rules

- **Every tile is an `Aggregate`.** There is no shape in `analytics-tiles.ts`
  that can hold a number without a `Coverage`, and the accessible name is the
  whole claim so a screen reader gets figure and denominator together or not
  at all.
- **Every tile has a required `filter`.** A tile cannot be declared without
  one, so a display-only tile cannot be added. The click is what earns the
  space.
- **Nothing is ever green.** No tone exists on a tile to set — there is no rule
  to remember because there is no green to reach for. A zero is a quiet zero.
- **Selection is not colour.** The active tile carries the sentence "Filtering
  the list — select again to clear", plus `aria-pressed`. Verified in
  greyscale.
- **Every tile names its site**, so a figure cannot be read against the wrong
  home. Tested.
- **Weight sits below the table**: hairline borders, no fills, one modest
  figure each, and the whole row is shorter than three table rows.

**A bug in my own clear semantics, caught by using it:** the list opens on
critical gaps only, so the Critical gaps tile is active from first paint — and
"clear" was set to `DEFAULT_FILTERS`, which is that same state. The control
promised "select again to clear" and did nothing. Clearing now means *show
everyone*, which is genuinely different, and the census tile says "Showing
every resident" instead, because it has no narrowing to remove.

**Also added the care note recency filter to the bar**, not only to the tile.
A filter applied by clicking a tile would otherwise be invisible state in a bar
showing four unrelated Selects.

### Name column

One line: preferred first name plus surname — "Ada Nwachukwu". Row heights drop
and the column stops reading as a form field. The full legal name stays on the
profile header, where identity confirmation actually happens with photo, DOB
and room beside it.

**The surname is derived, not stored** — `Resident` has `preferredName` and
`fullLegalName` and nothing between them, so `listName()` takes the last token.
Right for every fixture name, wrong for the first one with a particle: "Anna
van der Berg" would render "Anna Berg", which is somebody's name mangled by a
string split.

So there is a guard: `residents.test.tsx` fails if any fixture legal name stops
being two tokens. The answer that day is a real `surname` field, which is a
fixture type change and Frank's call — the test exists to force that
conversation rather than let the mangling ship quietly.

### Verification

229 tests. Greyscale re-checked on Ashgrove — selection survives, nothing reads
as positive. axe on the list unchanged and passing. Screenshots read back for
Rosewood, Ashgrove, and `?sim=empty`.

Also fixed while in there: `Date.now()` during render is impure and React's
compiler rejects it. The tiles and the 48-hour filter now share one clock
(`list-clock.ts`) pinned to the instant the fixtures were generated against —
so a row reading "2 hours ago" and the window that counts it cannot be measured
against different instants.

---

## Analytics cards — reference design applied — 20/08/2026

Frank supplied a reference (a "Total tasks / Tasks Due Today" card row), asked
for that form, for the cards in their own section, and for a shorter lede.

### The form, adopted

Label top-left, icon in a rounded chip top-right, large figure with a small
pill beside it, supporting line beneath. Five cards, one row, figures aligned
on a single horizontal — `.tileLabel` carries two lines' worth of height
whether it needs them or not, because "Reviews overdue or never scheduled"
wraps and a figure that dropped with it would break the line the eye reads.

Moved out of the table's `Card` into their own `<section>`. `role="group"`
rather than letting it become a landmark: five related controls, not a region
worth a place in the landmark list.

Icons picked by rendering candidates and looking, not by reading filenames —
`users/user-multiple`, `alert-02`, `calendar-block-01` (blocked, because the
tile counts never-scheduled too), `note-remove` (the note that is not there),
`stethoscope` (not assessed is not examined). They live in
`analytics-tiles.icons.ts`, because an icon name in an ordinary `.ts` file is
invisible to the usage scanner — the failure from earlier today.

### Two things in the reference that contradict rules set last turn

Taken as design intent, not as a reversal, and resolved rather than silently
followed:

**The green and red delta pills.** Last turn's rule 3 was *"No tile is ever
green. These exist to find problems, not to congratulate."* The reference's
`+8%` / `+12%` pills are exactly that. The pill slot is kept — it is what gives
the card its rhythm — but it carries **the denominator** instead: "16" then
"of 28 residents". Neutral, never a status hue. That slot now holds the one
thing Rule 4 will not let a figure appear without, which is a better use of it
than a percentage.

**The `+8%` and "+12 new this week" deltas.** Both are bare percentages and
bare counts, which Rule 4 forbids outright. More to the point, **we could not
compute them honestly.** A week-on-week change in "critical gaps" needs the
completeness of every record as it stood seven days ago, and nothing stores
that: the fixtures hold current state plus a care note history. Inventing a
plausible "+12%" on a compliance figure is the precise failure this build
exists to prevent — it would look exactly like a real one.

**Open for Frank.** Some deltas *are* computable and would be honest: residents
admitted in the last 7 days, reviews that fell overdue in the last 7 days, and
"no care note in 48h" recomputed as it stood a week ago, since care notes are
dated. Each would need to carry its denominator and its direction in words
rather than as a coloured percentage. Say the word and they go in; they are not
in now because three of the five could not be computed and a row where two
cards have a delta and three do not reads as broken.

### The lede

Was three clauses explaining themselves:

> Sort by oldest care note to find the records nobody has looked at — residents
> nobody has ever written up sort first, because that is the most neglected
> record in the home.

Now one:

> Sort by oldest care note to find the residents nobody has written up.

Still says what the screen is for — PRD §6.2's point that the oldest-note sort
is an instrument, not decoration — without narrating its own reasoning at the
reader.

### Also

The "no care note in 48h" denominator pill said "of 28 residents here 48h or
longer", which wrapped to two lines and was noise on every site where nobody
is excluded. It is now "of 28 residents", and the restriction is stated in
full on the one site where it changes the reading — Ashgrove, which reads
*"0 of 3 residents · at Ashgrove Lodge · 1 admitted under 48h ago, so the
window has not elapsed for them."*

229 tests. Greyscale re-checked: figures, denominators and the active card's
selection all survive without colour.

---

## Residents list — figures become read-only, filters restructured — 20/08/2026

### The cards no longer filter

Last turn's rule was *"a tile that only displays is decoration; the click is
what earns the space."* Reversed on request. `filter` is gone from the tile
source, along with `isTileActive` and `CLEARED_FILTERS`, and the cards render
as divs with no hover, no cursor and no pressed state — nothing suggesting they
do something when clicked, because they no longer do.

Filtering lives entirely in the row beneath now, which is arguably where it
belonged: every narrowing is visible at once rather than inferred from which
card is lit.

### The change figure is reconstructed, not invented

Frank asked for the denominator to move below the number and the pill to carry
something like "+10 this month". Last turn I said three of the five could not
have an honest delta. **Checked properly, all five can.**

Every record that closes a critical gap carries the instant it was written —
`recordedAt`, `assessedAt`, `signedOn`, `on`, `decidedOn` — and care notes hold
90 days of history. So the same question can be asked of a past instant rather
than guessed at. `hadCriticalGapAt(resident, at)` does it for the seven
criticals; each tile source gained a required `matchesAt`.

**The assumption, written down because it is not safe forever:** records here
are only ever added, never removed. The day a consent can be withdrawn back to
`not_sought`, or a DNAR superseded, this reconstruction silently starts
answering a different question and the honest answer becomes stored history
rather than derivation.

**Two guards, because two definitions of "critical gap" is exactly the shape
that drifts.** `completeness.test.ts` asserts `hadCriticalGapAt` agrees with
`recordCompleteness` for all 32 residents at the present instant — so an eighth
critical added to one and forgotten in the other fails the build. And a second
test asserts at least one resident's position actually changed in the last
month, so the figure is live rather than a permanent zero dressed as a finding.

Real movement at Rosewood this month: critical gaps −5, reviews +1, no care
note in 48h +1, falls +1... and residents unchanged.

**Periods are bounded by the data, not by what reads well.** 7 / 30 / 60 days.
No "last year" option: the fixtures carry 90 days of care notes, so a year-ago
comparison would report that every resident had no care note then — the history
ending, presented as a finding.

**Still no green.** The reference colours its deltas; these are neutral, and
the sign carries the direction. "+3 critical gaps this month" is not good news
in a hue, and a signed number survives greyscale where a green arrow does not.

### Site left the cards, and left the filter row

The site name is off the card faces — Frank's call, and sound: the header is
the only thing scoping this screen now, and repeating it five times said less
than it cost. It stays in each card's accessible name via `VisuallyHidden`, so
a reader who cannot see the header still gets the whole claim, and the section
is named "Figures for Rosewood Court".

The site **filter** is gone too, and the list now scopes to the header's site
directly. That closes a bug the removal would otherwise have created: the
filter held its own site in `useState` seeded once, so after removing the
Select the top-bar switcher would have changed the header and left the list
showing the other home — the wrong-subject failure at the scale of a building.
The Site column goes with it; it would repeat one value per row.

### Filters

Records is a segmented control now, per the reference. Three mutually exclusive
options worth seeing at once — including "All residents", which a reader needs
to know exists when the list opens already narrowed to critical gaps.

`role="group"` with `aria-pressed`, not a tablist: these are radio buttons in
appearance and behaviour, and a tablist would promise panels nothing here
implements.

The period selector sits at the far end, pushed apart deliberately, because it
is the one control there that does not filter the list — it sets how far back
the figures above look.

### Also

Stylelint caught a raw `rgb()` in the segmented control's shadow, correctly.
`--shadow-card` already existed; no token was added.

263 tests.

### Open

Frank asked for a "date selector". This is a **period** selector for the
figures. If he meant a date-range filter on the list itself, that is different
work and nothing in the PRD scopes a resident roster by date — say so and I
will build it.

---

## Analytics cards — change moves to the bottom line — 20/08/2026

Frank: take "No change this month" as it is, put it where "residents" is, and
drop "residents". Done for all five.

### One change to what was asked

Following it literally would have left "16" alone above "−5 this month" — a
**bare count**, which is what Rule 4 exists to prevent and what Frank set as
rule 1 for these very cards two turns ago: *"Every tile carries its
denominator — Aggregate type, no bare counts."*

So the denominator moved **inline with the figure** rather than off the card:
"16" large, "of 28 residents" small on the same baseline. The bottom line is
the change, exactly as asked; the standalone "residents" line is gone, exactly
as asked; and no card states a number nobody can size.

Attached rather than stacked on purpose. "16" and "of 28 residents" are one
statement, and a layout that can separate them is a layout that can drop one —
which is how this rule gets broken, not by anybody deciding to break it. A big
figure on a card looks finished without a denominator, which makes this the
easiest place on the screen to reach for a bare number.

**The census card is the exception**, and only because its figure *is* the
population — "28 residents" has nothing to be out of. Its scope is the section
heading, which names the site. So it reads "28" then "No change this month",
which is what Frank described.

Insufficient Evidence has no movement to report, so its bottom line carries the
coverage instead — the figure it could not compute, and out of what.

263 tests.

---

## Rule 4 relaxed on the analytics card face — 20/08/2026

**A deliberate departure, on Frank's explicit instruction.** Recorded here
because it is a departure from the rule this product is built around, and the
one thing that must never happen to such a departure is that it becomes
invisible.

### What changed

"of 28 residents" is off the card face. Each card now shows a label, a figure,
and the movement over the period.

### The rule it departs from

CLAUDE.md §1 and PRD §2.2, Rule 4: *"Every aggregate carries its denominator.
No bare counts, no bare percentages, anywhere."* Frank set the same rule for
these cards himself when he specified them: *"Every tile carries its
denominator — Aggregate type, no bare counts. PRD Rule 4."*

I flagged it when the layout change first implied it, kept the denominator
inline, and said it was the one rule I wanted overruled explicitly rather than
inferred from a layout note. He overruled it explicitly. That is his call to
make, and it is made.

### What still holds the claim together

The denominator has left the card face, not the screen:

- The section is headed **"Figures for Rosewood Court"**.
- Each card's `VisuallyHidden` claim still states figure, denominator and site
  in one sentence — *"Critical gaps — 16 of 28 residents at Rosewood Court.
  −5 this month."* A screen reader gets the whole thing.
- The table's caption directly below reads **"16 of 28 residents at Rosewood
  Court, sorted by name, ascending"** — the same denominator, a few hundred
  pixels down.
- `Aggregate` is unchanged. The type still cannot hold a figure without a
  `Coverage`; only the rendering omits it, so nothing downstream can lose it.

The test that guarded this is kept and rewritten rather than deleted: it now
asserts the **claim** carries the denominator, and fails if a future card
states a number nobody can size. Deleting it would have been the quiet version
of this decision.

### What to watch

A card is the easiest surface on the product to put a bare number on — a big
figure looks finished without a denominator, which is exactly why it looked
better with it gone. The risk is not this screen; it is the precedent when
Phase 12's dashboard arrives, where the same pressure applies to every tile
and the figures are compliance judgements rather than counts of a roster.

`Aggregate` and `AggregateFigure` are untouched, so the dashboard still starts
from a component that cannot render a figure without its denominator. This
relaxation is one screen's rendering, not a change to the shape of the data.

263 tests.

---

## Arrows — chevrons from the -01 family — 20/08/2026

Frank: the arrows should be `arrow-down-01`, or that group.

**`arrow-down-01-round` cannot be used: the vendor ships it as a PNG, not an
SVG.** So do `arrow-up-01-round`, `arrow-left-01-round` and
`arrow-right-01-round` — four names that read as available in a folder of
SVGs and are not. The pipeline only compiles SVGs (`182 non-SVG files ignored`
in every icons run), so asking for one fails the build rather than shipping a
broken glyph, but it is worth knowing they are missing before reaching for
them. Second vendor packaging oddity after the `DASHBOARD` folder full of
clothing icons.

`ARROWS (SHARP)` has the same shapes as real SVGs, so the -01 family is
reachable as `arrows-sharp/arrow-down-01-sharp`.

**Rendered them before choosing, again.** `arrow-down-01-sharp` turns out to be
a **chevron**, not a scaled-down arrow — which is what makes this the right
change rather than a cosmetic one. The old `arrow-down-02-round` is a full
downward arrow, and a full ↓ on a dropdown reads as *download*; a chevron says
*this opens*. Four surfaces changed: the Select trigger, the Accordion, the top
bar's site switcher, and the table's sort indicator, which takes the matching
`arrow-up-01-sharp` so the whole screen agrees.

The back link on the resident profile keeps `arrow-left-02-round`. It is a
direction of travel, not a disclosure, and a full arrow is right for it.

263 tests.
