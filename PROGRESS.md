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
