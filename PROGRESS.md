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

---

## Residents list — filter row trimmed, legend relocated — 20/08/2026

Four changes from Frank: All residents first, drop the care note filter, drop
the Risk flags section, centre the arrow icons.

### The legend did not simply go

Removing the Risk flags section removes the statement the column depends on:

> Anything not shown has been recorded and is unremarkable.

Without it an empty cell reads as "nothing wrong" when it may mean nobody has
looked — PRD §2.1's failure, at the level of a column. Frank asked for that
legend himself for exactly this reason: *"It can't become folk knowledge."*

But the same instruction named the alternative: *"a persistent legend **or a
Risk flags header tooltip**."* So the section is gone and the rule moved onto
the column header, which is the option he already sanctioned.

**Not hover-only.** `TableColumn` gained a `note`, rendered as a real
`<button>` whose accessible name is the whole rule and whose tooltip repeats
it. A rule a keyboard user cannot reach is a rule that is not on the screen for
them, and this one changes what the column means. The guarding test is kept and
rewritten against the header control rather than deleted — it still fails if
the rule stops saying what a hatched badge means, what a coloured one means, or
what an absent one means.

`note` is on the Table primitive rather than this screen, because Phase 3's MAR
grid has the same requirement — PRD §6.4 wants its legend permanently visible —
and a second implementation there is how two legends drift apart.

The header control uses `--ink-500`: `--ink-400` measures 2.80 on the header's
sunken background, and WCAG 1.4.11 wants 3:1 for a control that identifies
itself by its glyph. 5.13 now.

### The care note filter

Gone, along with its state, its type and its matcher — not left as a dead field
in `ResidentFilters`. `hasNoNoteWithinWindow` stays, because the analytics card
still counts it; only the filter went.

### All residents first

Widest first, narrowing left to right, so the reader meets the population
before its subsets and can see what they are a subset of. The list still
*opens* on critical gaps — where the default sits and where the options read
from are different questions.

### Arrow centring

The cause was in `Icon.module.css`: `vertical-align: -0.125em`, a hand-tuned
drop that suited an icon sitting in running text and left every icon inside a
wrapper span a couple of pixels low. Fixed at the single entry point every icon
in the product goes through, so this was one edit rather than a hunt.

`vertical-align: middle` now. In a flex container the parent's `align-items`
wins and this does nothing; where it applies, middle is the honest answer.
Radix wraps the Select's chevron in its own span — which becomes the flex item,
so the icon inside it never saw the trigger's `align-items` — and that span is
now `inline-flex` too.

Also caught by the type system on the way past: `size={14}` is not an
`IconSize`. The scale is closed at 12/16/20/24/32, the same discipline as the
type scale, and it held.

263 tests.

---

## Sidebar — the active item goes solid purple — 21/08/2026

`--purple-600` fill, white label, white icon (the icon takes `currentColor`, so
it followed without being told). The old tint becomes the hover state.

**That was a real defect, not just a restyle.** Hover and active were the *same
declaration* — `--purple-50` with `--purple-900` — so hovering any item made it
look like the page you were on. On a rail of seventeen items where fourteen are
disabled, "which one am I on" is the only question it answers.

White on `--purple-600` measures 6.97:1, past AA for the text and for the icon
as a UI component. Colour is still not the sole carrier: `aria-current="page"`
from NavLink, and the weight steps up. In greyscale the fill reads as a dark
bar against a pale one, which is a bigger difference than before.

Hovering the item you are already on deepens to `--purple-900` rather than
reverting to the hover tint, which would read as leaving the page you are on.

### One latent bug fixed while it was cheap

`--status-critical` against `--purple-600` is **1.65:1** — a count badge on the
row you are standing on would all but vanish. It cannot happen today: the only
badged item is Reviews, which is disabled until Phase 7 and so can never be
active. It will the day that module lands. `.active .badge` inverts to a white
fill with critical ink — still red-coded, and separated from the purple at
6.97:1. One line now rather than a puzzle then.

---

## The future-timestamp bug, fourth occurrence — and one definition at last

`npm run verify` failed on an unrelated fixture test while the above was being
made: a care note's `reviewedAt` was in the future. The clock had rolled past
midnight, and reviews were stamped 09:00 the following morning.

**Fourth instance of the same class** — care notes (Step 0), medication
administrations, refusals, now note reviews. Every one had the identical shape:
*a timestamp derived by arithmetic from a valid one and never re-checked.*

**And a second bug in the same expression, which no test could have caught.**
The review day was `max(day - 1, 0)`, so a note written **today at 14:00** was
reviewed at **09:00 that same morning — five hours before it was written.**
Every guard so far only looked forward; nothing asserted a record cannot
predate the event it describes. It has been wrong the whole time and passed
every run.

Fixed at the class rather than the instance. `recordedBetween(event, preferred)`
in `generate.ts` — beside `NOW`, which is what it clamps against — takes both
bounds: after the event, never after now. `medications.ts`'s `recordedAfter`
now delegates to it, so the rule has exactly one implementation instead of one
per call site.

The test gained the missing direction: `reviewedAt >= recordedAt`, with the
message "reviewed before it was written". Confirmed by reverting the fix —
it fails, and it fails on the backwards case, which is the one that was never
being checked.

263 tests.

---

## Top bar — the "SITE" label comes off the pill — 21/08/2026

Removed from the face. The pill now reads "Rosewood Court" with its chevron.

**Not removed from the control.** A button whose entire accessible name is
"Rosewood Court" says nothing about what it does, and this is the control that
decides which home a record lands in — the second-worst failure in the product
(PRD §2.4). It carries `aria-label="Site: Rosewood Court. Change site."`

The visible text is contained in the accessible name, so voice control still
reaches it by what is written on it — WCAG 2.5.3, Label in Name, which is
exactly the criterion an aria-label like this usually breaks.

Single-site users get no switcher but still get the site (§2.4). A bare place
name in a `<span>` has no accessible name to put the word in, so it keeps a
`VisuallyHidden` "Site: " — the word survives where it still does work.

§2.4's actual requirement is unaffected: the site name is permanently visible,
and it is now the only thing scoping the residents list, so it is doing more
work than when it had a label.

263 tests.

---

## Top bar — the account pill, tinted and given a photo container — 21/08/2026

The tint is the resting state now, not the hover state, so the profile reads as
a block of chrome in its own right — matching the site pill at the other end of
the bar, which has always done this.

**Hover did not simply go.** A permanently tinted control that stops answering
a pointer has lost something, so hover *and* the open menu both deepen to
`--purple-200` — ink-900 measures 11.09:1 on it. The `[data-state='open']` half
matters: with a resting tint there would otherwise be nothing to say the menu
beneath it is showing.

### A container, not a glyph

The `users/user-circle` icon is replaced by the existing `Avatar` primitive, so
there is a real image container: it shows a photograph the day staff carry one,
and initials — "AO" — until then. Nothing was invented to do it; the component
already existed for residents.

**Staff have no photograph in the data model.** `StaffRef` carries id,
displayName, fullName, role and isActive, and nothing else. Adding a field is a
fixture type change and Frank's call (CLAUDE.md §8), so the avatar is passed
`{ kind: 'not_on_file' }` — which is not a placeholder but the true state, and
already the exact shape a real photo would arrive in.

The avatar is `aria-hidden` here. `Avatar` labels itself "no photograph on
file", which is a *resident record* concern — a control against wrong-subject
writes, per its own doc — and repeating it in the chrome beside a name that is
already written out would be noise. The name text carries identity.

The trigger gained an explicit name for the same reason the site pill did: a
button whose accessible name is just "A. Okonkwo" does not say what it does.
"A. Okonkwo — account menu" contains the visible text, so voice control still
reaches it by what is written on it (WCAG 2.5.3).

`shellIcons.user` was left with no consumer, so it is removed rather than kept
as a name nothing renders. 33 icons in the registry, down from 34.

263 tests.

---

## Account pill — search-field fill, brand avatar — 21/08/2026

The pill takes `--bg-page`, the search field's fill, so the two controls either
end of the bar's right-hand cluster read as the same kind of surface. Hover and
the open menu still deepen to `--purple-200`, which is clearly distinct from
`--bg-page` where `--purple-50` would not have been — the two are within 0.03
of each other against white.

The avatar goes solid `--purple-600` with white initials, 6.97:1.

### Why that is a prop and not a restyle

`Avatar` draws all 28 rows of the residents list. Recolouring it where it lives
would have turned every resident's monogram purple to change one control in the
chrome, so it gained a `tone`:

- `neutral` — the record surface. A resident in a list, a profile header.
- `brand` — chrome. The account pill, which is **the one avatar on screen that
  is not a resident**, and the last thing that should be mistakable for one on
  a product whose second-worst failure is writing against the wrong person.

The border goes transparent in the brand tone rather than away, so the box is
exactly the size it is in the neutral tone and the two cannot drift apart.

263 tests, and the resident avatars are untouched — `tone` defaults to
`neutral`, so nothing that did not ask for the change got it.

---

## Resident profile — restructured into a subject rail and a content column — 21/08/2026

Frank supplied three reference screenshots and asked for a restructure of
placement, explicitly not of content. Nothing on this page changed what it
says; what changed is where it stands.

### What the references share, and what was worth taking

All three put **identity in a column beside the work**, not in a band above it:
a photograph, a name, a subtitle, status badges, and the contact details, held
in a card of their own while tabs and content occupy the rest. Two of the three
lead the content column with tabs; one leads it with small state cards.

Taken: the left rail, the stacked identity, the badges in the rail, contacts in
the rail, state cards at the head of the content column, tabs beneath them.

Not taken: any of the content. No ratings, no verification chips, no wallet
balances, no vitals — this is a care record, and a figure on it has to come
from a record.

### Why it is a better shape here, not only a different one

PRD §2.4 asks for a subject header that is persistent and non-collapsing,
because a record written against the wrong resident is the second-worst failure
available. A band across the top deep enough to hold a photograph, five badges
and two phone numbers costs roughly a third of the viewport **on every tab** —
so it gets shortened until it stops carrying what §2.4 asked for, or it pushes
the work off screen.

Beside the content it does neither. Verified rather than asserted: the profile
was scrolled 900px in an iframe and the screenshot read back — photograph,
preferred name, legal name, room, date of birth, site, all five badges, GP and
next of kin, still entirely in view. The old band would have had its badges
gone by then.

The rail carries its own `max-height` and scroll. A resident with five badges,
a long legal name and two contacts can outgrow a short viewport, and a sticky
rail taller than the window puts the bottom of the subject permanently out of
reach.

### What moved where, and why that split

- **Rail** — photograph, preferred name, legal name, room · DOB · age, site,
  the five badges, GP and next of kin. Everything a care worker checks *before*
  acting, in one place that never leaves.
- **Content column** — medication due, last care note, care plan review, then
  the tabs, then the tab's content.

The split is identity against state: the three panels describe what is
happening, which changes while the subject does not. They sit outside the
`Outlet`, so they hold across every tab rather than belonging to one.

### Two things the rail width exposed

The identity meta row ran "Room 14 · 07/07/1948 (78) · Rosewood Court" as one
wrapping line, which in a 320px rail left a separator dangling at the end of a
line with nothing after it. The site is now its own line — and it should have
been anyway: it is not a third identity fact, it is where all of them are true.

Badges stack rather than flow. `BadgeStrip` needed no change; the declaration
and its structural guard are untouched, and the test still asserts all five
render for all 32 residents.

263 tests, axe included.

---

## Resident profile — two-column sections, and the redundancy audit — 21/08/2026

### Applied

**The five field sections sit side by side** rather than stacked full width.
They are independent of one another, so they do not need to be read in order —
which is what a full-width stack implies — and stacked they made a page of
half-empty rows to be scrolled past rather than read. `.fieldList` already used
`auto-fill` with a 320px minimum, so it falls to one column inside a
half-width card without being told.

**The allergies panel rendered the same thing twice.** A badge carrying
substance, reaction and severity, and then a bullet list repeating substance,
reaction and severity six inches below it. `AllergyBadge` already carries all
three per allergen, in the treatment §6.2 requires. The list is gone.

Its subtitle said "Shown here, in the profile header, and on every medication
and care screen" — "the profile header" is now the rail, so it says so.

### The redundancy I did NOT remove, and why it is Frank's call

Six facts still appear twice on this page: **preferred name, full legal name,
date of birth and age, photograph, room, and site** — once in the rail and
again in the Identity and Placement sections. GP and next of kin make eight,
once in the rail's Contacts and again under Care team.

**Both appearances are mandated, by different rules.**

- CLAUDE.md §2 / PRD §2.4: the subject header carries "resident photo, name,
  preferred name, room, DOB". Not optional, and the reason the rail exists.
- PRD §6.2: the General Information tab carries "all fields from source PRD
  §16.2" — which includes every one of them.

So the overlap is designed, not accidental, and removing either side breaks a
document. Cutting them from the tab would also trip
`general-information.test.tsx`, which asserts every declared field renders for
all 32 residents — a guard built precisely to stop fields quietly disappearing.

**What makes it defensible where it is defensible:** most tab fields carry
attribution the rail does not — "Funding source · Local authority · Recorded by
M. Halloran, 01/09/2022". A glance and a record with its provenance are not the
same object.

**Where that defence does not hold:** the Identity fields carry no attribution
at all. Full legal name, preferred name and date of birth are rendered
identically in both places. That is genuine duplication, and the honest fix is
a decision about the documents rather than the code:

1. Leave it. The tab is the record; the rail is the header; §16.2 stays whole.
2. Drop the four identity fields from §16.2's tab list on the grounds that the
   rail is where identity is confirmed, and amend PRD §6.2 to say so.
3. Give the identity fields their attribution, so the tab genuinely says
   something the rail does not.

I would take 3 — it removes the duplication by making the second appearance
carry more, rather than by making the record smaller — but it needs fixture
fields that do not exist, so it is a type change and Frank's.

263 tests.

---

## Resident profile — reverted to its original form — 21/08/2026

Frank: take this page back to its original form. Done — both redesign commits
undone in the source.

`ProfileHeader.tsx`, `ResidentProfileRoute.tsx`, `GeneralInformationTab.tsx`
and `profile.module.css` are restored to their state before `cd64444`. The
full-width subject band is back, with the badge strip in a row and Contacts as
the fourth panel; the tabs sit beneath it; the five sections stack full width;
and the allergies panel has its detail list again.

**The two entries above are left standing.** This log is append-only
(CLAUDE.md §9), and a redesign that was tried and taken out is worth more on
the record than absent — the next person to reach for a left rail should be
able to see it was built, what it argued, and that it was reverted. Nothing in
those entries is now true of the code, and this entry is what says so.

The one finding in them that outlived the layout is the redundancy audit: eight
facts appear twice on this page, six of them mandated by §2.4 and §6.2
together, and the Identity fields duplicate the header exactly because they
carry no attribution. That is unchanged by the revert and still open.

263 tests.

---

## Allergy reaction rendered twice — the fixture, not the component — 21/08/2026

Frank spotted "Anaphylaxis · anaphylaxis" on Emmanuel Okafor's header and asked
which side it came from.

### Which

**The fixture.** `ALLERGY_OPTIONS` had

```ts
{ substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'anaphylaxis' }
```

The component is innocent: `AllergyBadge` renders `reaction · severity`, two
different fields, which happened to hold the same word. Every other allergen in
the list already had a descriptive reaction distinct from its grade — "Nausea
and confusion / moderate", "Contact dermatitis / mild", "Gastric bleeding /
severe". Penicillin was the only one filled in with the severity's own word.

Reaction now reads **"Throat swelling and collapse"** — what happens, which is
what that field is for. The severity still grades it.

### Where it showed

Three places render allergies. Two showed it:

- `AllergyBadge` — the profile badge strip, and the General Information
  allergies panel: *"ALLERGY: PENICILLIN Anaphylaxis · anaphylaxis"*.
- `GeneralInformationTab`'s detail list: *"Penicillin — Anaphylaxis
  (anaphylaxis)"*, the same collision in different punctuation.

One did not: the residents list column renders substance only.

**Reach: 9 of 32 residents carry Penicillin**, of the 18 with any recorded
allergy — so this was on half the profiles that have an allergy at all, and on
the single most common allergen in the fixtures.

### The guard

`fixtures.test.ts` now fails if any allergy's reaction is a severity word.

Asserted against the whole vocabulary — mild, moderate, severe, anaphylaxis —
rather than just equality with its own grade, because "Severe" written into the
reaction of a `moderate` allergy is the same defect and worse: it contradicts
the grade printed beside it instead of merely repeating it.

Confirmed by restoring the old value: it fails, and names Emmanuel Okafor.

### Noted, not changed

`AllergyBadge` carries a `SEVERITY` map from each severity to itself — an
identity map that reads like it is translating something. It is the natural
place a display label would go if severities ever need one, so it stays, but it
does nothing today.

264 tests.

---

## Profile header — three columns — 21/08/2026

Frank supplied a reference (a patient card with a large photograph beside
labelled-row panels) and specified the split: identity, then risk flags, then
the state panels.

**Column one** — photograph at 96px, preferred name, full legal name, then
room, date of birth and site as **labelled rows** rather than a
middot-separated line. Those are the facts §2.4 asks a care worker to check
against the person in front of them, and a run-on line is read once where a
labelled row is read at a glance. It also removes the wrapping problem that
line had in any narrow column.

**Column two** — the risk badges as their own titled block, stacked. They were
a strip trailing off the end of the identity row; they are now a thing to look
at before entering the room, which is what they are for.

**Column three** — medication due, last care note, care plan review and
contacts, as hairline-separated labelled rows on the same pattern as column
one. Four quite different shapes of content — a pill, a paragraph, a badge, two
links — read as one list rather than four competing panels.

### The avatar size

`Avatar` gained `xlarge` at 96px, composed as
`calc(var(--space-64) + var(--space-32))`. The space scale tops out at 64 and
one avatar is not a reason to extend it; the arithmetic keeps the result on the
4px scale, which is the rule the token was protecting. No token added, so no
stop-and-ask needed.

### Unchanged

`BadgeStrip` and its declaration are untouched — the structural guard still
asserts all five badges render for all 32 residents, and the header still
carries everything §2.4 lists. This was placement only.

264 tests.

---

## Profile header — three cards, not three columns of one — 21/08/2026

Frank: the three sections should have their own containers. They do now —
identity, risk flags and the state panels are three surfaces with the row
itself carrying no border or fill.

### The part that was not just moving a border

Splitting one sticky card into three leaves **transparent gaps between them**,
and the header is sticky. Content scrolling beneath rose up through those gaps
while the header held still.

So the row keeps a background — `--bg-page`, the same colour the scroll
container shows, so it is invisible as a band but opaque as a barrier — plus a
little padding below it, so nothing peeks at the bottom edge either. Verified
by scrolling 420px and reading the screenshot back: the gaps stay clean and the
content passes underneath.

`align-items: start` now earns its place. Inside one card it produced voids —
two short columns stretched to the height of the tallest. As three cards each
ends where its content ends, which is what the reference does and why it looks
settled rather than padded.

The surface is one `.headerPanel` rule the three compose from, rather than the
same six declarations written out three times and drifting apart later.

264 tests.

---

## Identity card — the photograph at 128px — 21/08/2026

`Avatar`'s `xlarge` goes from 96px to 128px, composed as
`calc(var(--space-64) * 2)`. Still on the 4px scale, still no token added.

It fits the 260px card with room to spare — 220px of content once the padding
is off — so the photograph leads without the column having to grow around it.

**The initials stepped up with it**, from a heading size to `--text-display`.
That is not tidying: a monogram set small inside a 128px circle reads as a mark
adrift in an empty ring, and the monogram is doing the photograph's job here.
PRD §2.4 makes the photograph a check against writing to the wrong record, and
`Avatar`'s own doc is explicit that initials exist rather than a silhouette
because "a control that cannot distinguish two people is not a control". Making
the container bigger while leaving the only thing in it small would have made
that control harder to read, not easier — no resident in these fixtures has a
photograph on file, so the monogram is what every one of them shows.

264 tests.

---

## Profile header — the three cards share a height — 21/08/2026

Frank's call, reversing the `align-items: start` I put in two entries ago. The
row now stretches, which is grid's default, so there is no `align-items` on
`.header` at all.

The state panels are always the tallest of the three, so identity and risk
flags gain the difference.

**Where that space lands mattered more than the change itself.** Left alone it
pools under the last row of each short card, which reads as a card that ran out
of things to say. The identity card has two natural blocks — the portrait with
the name, and the three labelled facts — so it uses `space-between`: the extra
height goes between them and the facts sit on the card's foot, which reads as
composed rather than padded.

Risk flags keeps its badges top-aligned. A list that starts halfway down a card
is harder to scan than one that starts at the top, and this is the block a care
worker reads before entering a room.

264 tests.

---

## Contact links — a missing word boundary and five undialable hrefs — 21/08/2026

Frank reported "GPDr P. Ramanathan" and `tel:0161 982 7875` on the profile
header.

### 1. A block boundary is not a word boundary

`.contactRole` is `display: block`, so the label and the name are on separate
lines **on screen** — which is why this looked like a styling question and is
not one. There is no text node between them, so the link's accessible name is
`"GPDr O. Balogun · 0161 999 6789"`. A screen reader announces the run-together
string; so does anything else that reads the content rather than the layout.

Fixed with an explicit `{' '}` between the two, which collapses to nothing
visually and gives the text a boundary. Not with an `aria-label`, which would
have replaced the visible text with a different string and put WCAG 2.5.3
(Label in Name) at risk on a link somebody dials in an emergency.

Same fix on next of kin, which had it too.

### 2. The display number and the dialable number are different strings

All five `tel:` hrefs interpolated the display string:

```
href={`tel:${contact.phone}`}   →   tel:0161 999 6789
```

Spaces a URI is not supposed to carry, and no country code. Some dialers cope.
Some strip the spaces and dial a **national** number from a roaming handset,
which fails silently at the moment somebody is trying to reach a GP.

`telHref()` in `src/lib/phone.ts` now builds them: `tel:+441619996789`, with
the readable form left exactly as it was in the link text.

**The +44 is an assumption and a narrow one.** `Site` carries no country, and
both homes are Europe/London, so it is applied only to a number with one
leading zero. A number already in international form is passed through; one in
neither shape gets its digits and **no invented country code** — guessing which
country a phone number belongs to is exactly the sort of fabrication this build
avoids, and it would be fabricated onto a contact dialled in an emergency. The
day a site exists outside the UK, the code belongs on `Site`.

### Where they were

All five, as asked: GP and next of kin in the profile header; GP, consultants
and pharmacy on the Care team section. **Social workers, advocates, LPA holders
and family with visiting rights have no call sites yet** — they arrive with
Screen 5, which is why the guard below matters more than the five fixes.

### The guard

`scripts/check-tel-links.mjs`, wired into `npm run lint`. It fails on any
`tel:` scheme written in source outside `phone.ts`.

On the pattern, not the five, because it was never five mistakes — it was one
habit, repeated wherever a phone number appeared, and Screen 5 is about to add
four more places to repeat it. Confirmed by restoring one by hand: it fails and
names the file and line.

It lives in `scripts/` rather than as a vitest file because it reads the
filesystem and `src/` is a browser project with no node types — the same reason
`check-hatch.mjs` lives there.

269 tests.

---

## Profile header rebuilt against docs/profile-header.html — 21/08/2026

Structure and hierarchy from the approved mockup; none of its CSS. Its literals
are replaced by tokens throughout, and every colour reaches a component as
`var(--token)`.

### 1. One surface, three bands

The three floating cards became one card with hairline-separated bands, in the
order somebody approaching a resident needs them: who this is and who to call ·
what to know before the room · the routine facts. Three equal cards were three
equal invitations, which is why the eye had nowhere to start. A hairline says
"next"; a border says "elsewhere".

### 2. Risk flags as three-line cards

`BADGE_STRIP_SOURCES` now returns **data, not elements** — field, answer,
attribution, tone — because the answer has to be the largest line and the only
coloured one, and a component that hands back a finished pill cannot be laid
out that way from outside. Each source is still exhaustive over its own union
with `assertNever`, and the structural guard still asserts all five render for
all 32 residents.

The badge components are untouched and still used where a pill is the right
shape — the General Information tab, `/dev/states`.

Colour is a left edge bar plus a tint rather than a full outline. An outline
draws a box first and its contents second.

**The unrecorded state keeps the hatch exactly.** Not a lighter version of it:
the same treatment, through the same component, with the left bar in the
unrecorded colour so the strip still reads level. `Unrecorded` gained a `flag`
variant composed from the one definition in `unrecorded.module.css`, and a
`caption` prop so the field can sit above a short answer — "End of life care"
over "Not recorded" — while `label` stays required. `check-hatch` still passes:
one definition.

### 3. Settled facts go quiet

"Nothing due in the next 2 hours" was a full-width green bar announcing that
there was nothing to do — the loudest thing in the header. It is plain text
now, and the review uses `ReviewBadge emphasis="compact"`, the same emphasis
the residents list uses: completed-and-in-date and scheduled-not-yet-due render
as text, while due, overdue and never-scheduled keep their treatments. Verified
on two residents — Ada reads "Reviewed 02/08/2026", Emmanuel keeps the red
"Overdue · 75 days overdue".

Mood moved from a green pill to a coloured word in the meta line. **An
unrecorded mood still hatches** — a care worker who did not record how somebody
seemed has not recorded that they seemed fine, and that does not become truer
for being in a smaller slot.

### A bug I introduced and had to chase

Removing the old layout's stale CSS rules with a script chopped the tail off a
comment, leaving `/*` unterminated. **Everything from there to the next `*/`
was silently swallowed** — `.panelTitle`, `.dueList`, `.noteSummary`,
`.noteBody`, `.noteMeta` all vanished from the module's exports.

Nothing failed. Stylelint passed, the build passed, the tests passed.
`styles.noteMeta` was simply `undefined`, `className={undefined}` renders
nothing, and the note meta lost its flex and its gaps — which is how it reached
a screenshot reading "Mobility21/08/2026 15:52 BSTK. Osei".

Found by reading the screenshot, not by any check. Worth knowing: **a CSS
Modules class that does not exist is not an error, it is `undefined`** — and
TypeScript cannot see it, because the module's type is an index signature. A
typed-CSS-modules step would turn it into a compile error; noted, not built.

### Already done, before this brief

The three "also fix" items were fixed in the preceding commits and are
unchanged here: the allergy reaction duplication (the fixture had filled the
reaction in with the severity word — 9 of 32 residents), the GP label running
into the name (a block boundary is not a word boundary, so the accessible name
was "GPDr O. Balogun"), and all five `tel:` hrefs, now built by `telHref()` and
guarded by `scripts/check-tel-links.mjs` in `npm run lint`.

### Checks

269 tests, axe included. Greyscale: the unrecorded card is unmistakable against
the four recorded ones, and each answer is carried by its words — the left bars
add nothing without colour, which is the correct dependency. At 1280, the
minimum supported width, the identity facts wrap onto two lines and the five
cards stay level; nothing truncated, nothing hidden.

Full legal name stays under the preferred name, as asked — this is where
identity is confirmed.

---

## Risk flag cards — the internal spacing distributes — 21/08/2026

The three lines were packed to the top with the attribution pinned to the foot
by `margin-top: auto`, so all the slack pooled in one gap — and that gap was a
different size on every card, because it was whatever was left after answers of
different lengths. Five cards, five different rhythms, in a row that is
supposed to be read across.

`justify-content: space-between` on both the recorded card and the hatched one,
and the gap is now `--space-4` rather than a hand-typed 2px. The field pins to
the top, the attribution to the foot, and the answer takes the middle — so the
row reads level whatever the answers say.

Checked on the awkward case as well as the easy one: a resident whose isolation
answer wraps to two lines and whose allergy attribution wraps to two still
lines up with the three single-line cards beside it.

269 tests.

---

## Hatched risk flag cards now fill their cell — 21/08/2026

`.unrecordedFlag` set `height: 100%` but not `width`, so a hatched flag sized
to its text and left a gap between itself and the cards either side. The
recorded `.flag` has always had `width: 100%`; the hatched one had not.

The cause is worth naming because it is not obvious from the rule: every other
hatched variant is a **block-level** flex container and fills its parent
without being asked. This one is a **flex item** — `.flagItem` is a flex row —
and a flex item does not grow unless told to. The same declaration behaves
differently depending on what contains it.

**A gap in the record showing up as a gap in the layout is the wrong kind of
accident**, on the one strip whose job is making gaps conspicuous rather than
decorative.

### Checked the others rather than assumed

- **Records column, residents list** — `unrecordedChip`, fills already; every
  row's chip shares a right edge.
- **Analytics cards, Insufficient Evidence** — fills its card.
- **Needs tab domain rows** — `unrecordedRow`, block-level, fills.
- **Badges** (`unrecordedBadge`) — inline-flex and content-sized **on purpose**.
  A pill that stretched to its container would stop reading as a pill, and
  these sit inline among sentences and other badges.

So one broken case, not a family of them — and the reason it was the only one
is that it is the only hatched variant placed as a flex item.

269 tests.

---

## Flag card stretch moved onto the container — 21/08/2026

Frank reported the hatched cards still short. They were, in what he was
looking at; they were not in a fresh build. The `width: 100%` from the previous
commit is present in the source and in `dist`, and a clean
`rm -rf dist && npm run build` renders Arthur Pemberton's strip — the mixed
case, hatched cards between coloured ones — with all five the same width.

**A CSS-module `composes:` change across files is the case Vite's HMR handles
worst.** His screenshot had the new three-band header, so the JSX had reloaded;
the composed class had not. A dev-server restart picks it up.

### Fixed properly anyway

Relying on each card to ask for `width: 100%` was the fragile part, and it is
what let the two variants disagree in the first place. `.flagItem` is a **grid**
now rather than a flex row: a grid item stretches to fill its area on both axes
by default, where a flex item does not grow unless told to.

The stretch belongs to the container. A sixth flag variant added later cannot
reintroduce this by forgetting a line, which is the same reasoning as putting
`renderUnrecorded` in the source declaration rather than trusting each caller.

269 tests.
---

## General Information reworked, Needs rebuilt to match (21/08/2026)

Built against `docs/general-information-v3.html`, approved for structure and
hierarchy. Its CSS is hand-written illustration and none of it was copied; every
value here is a token.

### General Information

**Section headers.** 20px bold title over a one-line plain-English description,
above a divider. That is already what `CardHeader` renders, so the change was to
the descriptions rather than the treatment. Two were written for the schema
rather than the reader and now say what the section is *for*: Care team is "Who
to contact outside the home about this person's health", not "The clinicians and
services outside this home".

**Field rhythm.** The two-up grid of stacked label-over-value cards became one
field per row, label left in a 240px column, value right, hairline between.

The grid fitted more on a screen and read worse. With two independent columns
there is no single place to look for "the answers", and a hatched gap in the
right-hand column sat level with a recorded value in the left, so scanning for
holes meant reading both columns in parallel. On a screen whose entire job is
making gaps conspicuous that is the wrong trade.

Field labels lost the uppercase letterspaced treatment and are now sentence-case
13px, as in the reference. Fifteen uppercase labels in a single column read as
fifteen headings.

**Long fields.** `width: 'full'` on medical history and communication
preferences: label above, value across the row, capped at 78ch for measure. A
wrap point, never a truncation. Optional in `ProfileField` where `whenMissing`
is required, and deliberately so: forgetting `whenMissing` puts a hole in the
record, forgetting this makes a line short.

**Allergies.** Moved from a separate card above the tab into a full-width panel
at the top of Clinical, declared as `ProfileSection.banner` rather than
special-cased on a magic section id. Three states, three treatments: critical
tint for a finding with substance, reaction and severity per item; positive tint
for a recorded "no known allergies"; the hatch for a gap, with the copy saying
in words that it is not a confirmation of none.

`alert-notification/alert-02` on the critical variant only, already in the
registry, so no new icon was needed. The reference has no icons at all, so
nothing was substituted for a placeholder.

### The recorded negative is now info blue, and allergies are still green

`RecordedList.none_involved` moved from `--status-positive` to `--status-info`.

Not an inconsistency with the allergy panel, which stays green. Green claims
"recorded, complete, and fine". A confirmed "no known allergies" genuinely makes
the next medication round safer and earns it; PRD §6.2 names that case green
specifically. "Nobody is involved as a consultant" is neutral news somebody went
and got: nobody is worse off for it and nobody is better off either. Blue says
"recorded, complete, and neutral", which is the whole claim.

Both are settled records carrying an author and a date. Neither can wear the
hatch. That is the part Rule 3 actually constrains.

Added the consultants pair to `/dev/states` Rule 3 comparison so the second
flavour of recorded negative is on the states page rather than only in the app.

### The three answer types side by side

The reference shows them in Ismail Sowande's Care team. **The fixture does not
support that.** Sowande is Gap 3, admitted yesterday, and has GP, pharmacy and
consultants all unrecorded. Giving him a GP and a recorded "no consultants" to
make one screenshot true would be cleaning up fixture data to make a screen look
better, which is the one thing CLAUDE.md §6 forbids.

Scanned all 32 residents instead: **Wilfred Merrivale** already carries exactly
that combination, with GP recorded, consultants `none_involved` and pharmacy
unrecorded. `general-information.test.tsx` now pins it, so the case cannot
vanish from the fixtures unnoticed.

### Needs

Rebuilt in the same language. Same header treatment, same 240px label column so
the two tabs line up when a reader switches between them.

Each domain is a term and its facts are its definitions: **Care plan**, **Support
level**, **In this person's words**, each a labelled answer with its own
treatment, never merged (Rule 3a). A domain that is `not_started` for somebody
`not_assessed` is two gaps and shows two hatches.

Support level was previously a badge sitting next to the status badge with no
label of its own. It now has one, which is the point of `not_assessed` being a
real union member: "Independent" and "nobody has assessed them" are opposite
claims about a person's safety.

**Section descriptions replaced a bare count.** The grouped sections subtitled
themselves "4 care plan domains", a count of the rows directly beneath it,
telling the reader nothing they could not see, and a denominator-less figure on
a screen about missing evidence. Now each says what the group is for, keyed
exhaustively off `NEED_GROUPS` so a sixth group fails the build rather than
rendering undescribed.

**Still six sections, not five.** The five §16.2 need groups claim nine of the
ten domains; `end_of_life` belongs to none of them because §16.2 handles end of
life under Future Plans. Rendering only the five would drop a care plan domain
off the screen, and absence from a list is the same bug as a blank cell. The
leftover section stays and explains itself.

### Reviewed

Seven states on both tabs. Loading and Error come from `ResidentProfileRoute`
and are unchanged. Populated: Joan Merrivale, Emmanuel Okafor. Partial and
Empty: Ismail Sowande, every field and every domain hatched, no blank rows and
no em dashes. Stale: Grace Adeyemi's mobility domain, still overdue with its
day count. Read-only: no edit control on General Information, and the Needs
write affordance present and disabled for all ten domains.

Greyscale: the recorded negative (solid border, solid tint) and the gap (dashed
border, hatch) stay apart, as does the allergy panel from its hatched form.

200% zoom at 1280 CSS px: nothing overflows, nothing truncates. The label
columns are fixed and the text is not, so labels wrap further, which is the
intended behaviour.

axe: clean on both tabs.

### Not changed, worth a decision

The hatched badge is uppercase, so a long one reads "DIETARY REQUIREMENTS AND
PREFERENCES NOT RECORDED". The reference has these sentence-case, and the
full-width rows make the shouting more obvious than the old two-up grid did.
`unrecordedBadge` is shared with the residents list and elsewhere, so it was
left alone rather than changed unilaterally. Flagged to Frank.

277 tests.

---

## S5 Important People and S6 Future Plans (21/08/2026)

Both tabs built in the language settled on the previous screen: 20px section
title over a one-line plain-English description above a divider, label-left
value-right rows on a 240px column, the same three answer types. All four
profile tabs now line up when a reader switches between them.

### The hatched badge is sentence case now

Approved before building, so S5 and S6 were built against the final treatment.
`unrecordedBadge` loses `text-transform: uppercase` and the letterspacing, and
moves from `--text-micro` to `--text-body-sm`.

`StatusPill` stays uppercase, and that is not an inconsistency left behind. It
follows from Rule 2: a recorded status can be one word, "Complete" or "Refused",
but an unrecorded one has to say what is missing, which makes it a sentence.
"Dietary requirements and preferences not recorded" in caps is shouting; the
same words are readable in sentence case. Uppercase suits a word and defeats a
sentence.

The size bump is not decoration either. At 11px with the caps and letterspacing
removed there was not enough left to read, and the label is the carrier of
meaning here, with the pattern as reinforcement. What tells the two families
apart peripherally is the dashed border and the hatch, which is untouched and
depends on neither case nor size.

### A gap that names its cost is a chip, not a badge

`RecordedValueField` and `RecordedListField` take an optional `missingDetail`,
and `MissingValue` picks the geometry from whether there is one. A one-line gap
stays a pill. A gap that also says what it costs stacks the detail underneath,
because a pill three-quarters of a row wide stops reading as a pill and starts
reading as a paragraph somebody drew a border round.

This mattered immediately: on these two tabs almost every gap has a consequence
that is not obvious from the field name. "Preferred place of death not recorded"
is a true statement about a form. "Nobody has asked where this person wants to
die, and in the absence of an answer the ambulance is called and the answer
becomes hospital" is the same fact with the reason to go and ask attached.

`Unrecorded` now marks its detail with `data-unrecorded-detail`, so the guards
assert that a gap names its cost structurally rather than by matching the copy.

### Shared pieces extracted rather than duplicated

- **`.banner*`**, the allergy panel generalised. Clinical opens with allergies,
  In an emergency opens with the resuscitation decision; same shape, same slot,
  four tones. Renamed from `.allergy*` rather than copied.
- **`PendingLink`**, the disabled "coming in Phase N" link. Was inline in
  NeedsTab; now shared with the LPA and ADRT document links, which are Phase 11.
  NeedsTab adopted it, same DOM, tests unchanged.
- **`Attribution`** and **`SignedValue`**, one place each for "who recorded this
  and when" and "who signed this, when, and which version".

### S5, Important People

Three sections, seven categories, all seven rendered for all 32 residents.
Grouped family / legal and statutory / other professionals, because seven cards
is a list and three is a structure.

**Who the home rings first is a panel, not a marker.** `isPrimaryContact` lives
on whichever `ImportantPerson` holds it, spread across five possible categories.
Reading it off the blocks means scanning all of them and hoping you did not miss
the pill, which is not a way to find out who to ring when somebody has fallen.
So it is computed once and stated at the top, in three states:

- one holder: settled, info blue, named;
- **nobody**: hatched. Five residents in the fixtures are in this state, and
  `important-people.test.tsx` pins one, because a state that only exists in a
  unit test is a state nobody reviews;
- **more than one**: critical, naming both, and refusing to choose. Cannot
  happen in the fixtures. It renders anyway, because resolving a contradiction
  the record contains is exactly how the wrong family member finds out.

`missingDetail` on the LPA and the advocate is worded deliberately: "no LPA is
recorded, which is not the same as there being none". Nobody having recorded an
LPA and nobody holding one are different legal situations, and acting on the
wrong one is a Mental Capacity Act problem rather than an admin one.

### S6, Future Plans

Three sections, eight facts. Seven are rows; the resuscitation decision is the
banner, for the same reason allergies are. §2.1: "for DNAR the same ambiguity is
catastrophic in both directions". DNAR renders brand purple rather than red or
green, because colouring a signed legal document editorialises it, and a care
worker who hesitates over red loses the seconds the decision exists to save.

The hatched state says the part a reader cannot infer: **with no decision
recorded, CPR is attempted.** An unrecorded resuscitation decision is not a
neutral gap, it is an outcome nobody chose, and "No decision recorded" alone
does not say that.

Every entry carries signer, date and version, which is §6.2's "date-stamped,
signed, version-controlled", all three visible and none hover-only. The version
shows even at 1: a number that only appears once it is interesting teaches the
reader nothing the first time they see it. There is no history link, because the
fixtures carry a version number and not the versions behind it, and a link to a
list that does not exist is worse than the number alone.

### The two write controls

Frank chose affordance plus confirmation, no write.

Both raise the real dialog. Both name the subject in the sentence, per §2.4 and
never "Are you sure?", and the resuscitation and ADRT ones name **the site whose
staff are notified**, not "all staff": a manager covering two homes needs to
know which building is about to be told.

Neither writes anything, and the toast says which half is missing rather than
faking a save on a read-only fixture. Hiding the controls instead would have
meant the one interaction §2.4 exists to demonstrate never appearing in the
phase that is about the profile.

Two decisions inside that:

- **A button, not a switch**, for the primary contact. A switch that flips,
  raises a confirmation and flips back reads as a bug; and even once writing
  exists, a switch implies a per-person setting when this is a single role
  exactly one person holds.
- **The trigger is secondary, the dialog's action is destructive.** The trigger
  destroys nothing, it opens a question. Two red buttons on a read-only tab
  spend the reader's alarm before anything has happened.

### Reviewed

Seven states on both tabs. Loading and Error from the route, unchanged.
Populated: Emmanuel Okafor. Partial: Arthur Pemberton, no resuscitation
decision recorded. Empty: Ismail Sowande, every category but next of kin
hatched with its cost named. Stale: the social worker's placement review
carries a real `ReviewState`, so overdue and never-scheduled both appear.
Read-only: the two change controls write nothing and say so.

Greyscale: the DNAR panel (solid border, solid tint) against the hatched falls
flag above it stays unmistakable, and so do the two change buttons.

200% zoom at 1280 CSS px: no overflow, no truncation.

axe: clean on both tabs.

**Not screenshot-reviewed:** the two confirmation dialogs. Headless Chrome
cannot click, so their content is covered by tests (subject named, site named,
nothing written), but Frank should press both himself.

362 tests.

---

## Em dashes removed from everything that renders (21/08/2026)

Frank was still seeing them on screen after the PROGRESS.md pass. The previous
change only touched the write-up.

### How the list was found

Grepping `src` gave 600 hits, almost all of them inside doc comments, which
never reach a user. Building first and grepping `dist/assets/*.js` instead gave
the real list: the bundler strips comments, so what is left in the bundle is
exactly what ships. 125 distinct strings, plus a check over `dist` CSS and HTML
for anything hiding in a `content:` property, which found none.

Worth keeping as the technique. "Which strings does the user actually see" is a
question the build answers precisely and a grep over source answers badly.

### What replaced them

Not deleted, rewritten. Three patterns, by what the dash was doing:

- **Separating two facts** becomes the middot already used everywhere else for
  that job: `Isolating · Suspected norovirus`, `Falls risk · HIGH`,
  `Penicillin · anaphylaxis`, `text · 4.8:1 on tint`.
- **Introducing a clause** becomes a colon, a semicolon or a full stop, chosen
  per sentence: "not a neutral gap; it is an outcome nobody has chosen", "This
  is not a filter result. The site is empty.", "no LPA is recorded, which is not
  the same as there being none".
- **A parenthetical aside** becomes actual parentheses, which is now consistent
  across every deferred affordance: `Important People (coming in a later phase)`,
  `Open document (coming in Phase 11)`, `Export (later phase)`.

Several read better as a plain phrase with no punctuation at all, and those
match a house pattern that already existed: `Falls risk — not assessed` became
`Falls risk not assessed`, which is the same shape as `Allergies not recorded`
and `Support level not assessed`.

En dashes went too. Medication windows now read `20:00 to 21:00` rather than
`20:00–21:00`, and the fixture audit says `the 30 to 60 minute window`.

### Scope

Everything that renders: app shell, residents list and filters, profile header
and badge strip, all four profile tabs, every status component's label and
accessible name, the MAR cell descriptions, fixture content, and `/dev/states`.
Fixture strings counted, because they are content on screen: `Nigerian, Igbo`,
`Respite, 4 weeks`.

**Doc comments were left alone.** They are not UI, there are roughly 470 of
them, and rewriting that much carefully-worded prose is churn with no visible
effect. Same for the earlier PROGRESS.md history, which CLAUDE.md §9 says to
append to rather than rewrite.

### One thing this did not touch

`.not.toBe('—')` in the guards, and the sentence in CLAUDE.md §1 it enforces. An
em dash as a *value* is the failure this product exists to prevent, and those
assertions are about a field rendering the character instead of saying what is
missing. Removing prose dashes has nothing to do with it, and the guards still
run.

Five test assertions quoted labels that changed, plus one stale quotation in a
fixture failure message. Updated.

363 tests.

---

## The profile header scrolls with the page now (21/08/2026)

Frank asked for it, and it contradicted PRD §2.4 verbatim: "It is sticky, it is
not collapsible, and it does not scroll away." So it went back to him as a
question rather than being changed quietly. His decision: scroll it, nothing
sticky, and amend the document.

`position: sticky`, `top: 0` and `z-index: 20` are gone from `.header`. Nothing
in the bundle ships a sticky rule any more.

### Why the rule could be narrowed rather than broken

§2.4's bullet binds **write surfaces**. The profile has none: all four tabs are
read-only, and the two change controls on Future Plans open a confirmation that
names the subject in its own sentence, which is a different §2.4 bullet and is
untouched.

Against that, the header is about 410px tall, which is half a laptop viewport
held permanently against four tabs of dense record. That is a real cost paid
every scroll for a mitigation that, on this screen, is guarding nothing.

### Checked before agreeing it was safe

- **The site stays permanently visible** (§2.4, fourth bullet). The header's own
  comment claimed it carried the site "because the app top bar scrolls away on
  a long profile". That was wrong. `AppShell` is a fixed-height grid in which
  only the content column scrolls, so the top bar cannot scroll away and never
  could. The claim has been corrected rather than carried forward.
- **"Persistent across all resident tabs"** (§6.2) is about staying mounted, not
  about staying on screen while you scroll. It still holds: the tabs are
  children of a layout route, so the header is never rebuilt and the subject
  never flickers between tabs. `profile.test.tsx` and each tab's test already
  assert this and needed no change.
- **Nothing else was sticky.** One rule in one file, no z-index stack to unwind.

### The part that is now a debt

**Phase 2's note composer is a write surface and needs its own sticky subject
header.** It does not inherit one from the profile any more. The PRD amendment
says so in bold, the header's source comment says so, and it is written here so
it is not discovered late.

The amendment is marked in `FRONTEND_PRD.md` as a dated narrowing rather than
an edit in place, so the original rule and the reason it changed both stay
readable.

363 tests.

---

## The tab rule and the active tab's underline are one line now (21/08/2026)

`.tabs` carried `padding-bottom: var(--space-4)`, which pushed the row's 1px
rule four pixels below the active tab's 2px underline. Two horizontal lines,
four pixels apart, reading as one rule that had failed to meet another.

The padding is gone, and `.tab` takes `margin-bottom: -1px` so its own underline
sits over the row's rule rather than stacking a second line above it. The active
tab now replaces that segment of the line instead of hovering over it; both
share a bottom edge, and the active one is simply thicker.

`-1px` is off the 4px spacing scale deliberately. It is cancelling a border
width, not spacing anything, which is the one case where the scale has nothing
to say.

363 tests.

---

## Phase 2, part one: the note timeline, detail and correction (21/08/2026)

Frank split the phase: notes first, `/handover` as a second review. This is the
first part. The composer is the one piece not here, and why is at the bottom.

### ⚠️ Waking hours are invented, and need a real answer

PRD §6.3 requires a gap marker after "more than 4 waking hours". **Neither
document defines a waking hour.** 07:00 to 22:00 is made up. It is not measured,
it is not from a care home, and it is certainly wrong for somebody.

It lives in exactly one constant, `WAKING_HOURS` in `src/lib/shift.ts`, and
everything else is derived from it rather than typed again: the gap threshold,
the night length, and which stretches count as overnight. A real answer is a
one-line change touching no screen.

**What a care manager needs to be asked:**

- Are waking hours the same for every resident? They are not, in life. Somebody
  up at 05:00 and somebody who sleeps until 11:00 are both being measured
  against one window here.
- The same for every site? A dementia unit and a residential floor do not run
  the same day.
- Should this be a resident-level or site-level record rather than a constant?
  If it is per-resident it is clinical data, it belongs in the fixture types,
  and it needs its own unrecorded member.

Until then, **every marker states elapsed time and waking time separately**, so
nobody has to trust the constant to read the record. Somebody who disagrees with
the window can read the elapsed figure and judge for themselves.

### The night marker is quiet, not quieter-and-vaguer

Frank's wording, and it shaped the component. The overnight marker carries less
visual weight than the hatch: a dotted left rule rather than a fill, ink-500
rather than the unrecorded ink. It carries exactly as much information: how long,
which window, that no notes were expected between 22:00 and 07:00, and how much
of the stretch was waking time.

The distinction it exists to make is that an overnight stretch is not a hole. A
hatched marker every night for every resident would be 32 alarms a day that mean
nothing, and a chip that fires on everybody discriminates nothing. But jumping
silently from 21:00 to 09:00 would be the timeline going quiet about nine hours,
which is the failure this screen was built to prevent.

An interval can be both. Omission wins, and its wording says the stretch included
a night, so nobody reads it as somebody being ignored at four in the morning.

### A filtered timeline never claims a gap

The decision on this screen that is not obvious and is not negotiable.

Gap markers are **suppressed entirely while any filter is active**, and the
screen says so and offers to clear them. A six-hour hole in "Medication notes
only" is a hole in the filter, not in the record. Rendering it as "No care note
recorded" would be the product making a confident false claim about somebody's
care, which is the same class of failure as a blank cell meaning "no" and worse
for being assertive.

The alternative considered and rejected: compute gaps from the unfiltered notes
and show them anyway. They would not line up with the visible rows, so the
reader would see a marker between two notes that were not adjacent.

### Observation: the threshold marks nearly every interval

Worth a decision, and not fixed here.

The fixtures give a resident one to three notes a day, so almost every interval
between notes exceeds four waking hours and the timeline runs about half
markers. That is exactly what §6.3 asks for, and tuning the threshold to make
the screen look calmer is the move CLAUDE.md §6 forbids.

So it is left as specified and reported instead. One of three things is true:
the threshold is wrong, the fixtures are thinner than a real home, or a real
home genuinely has that many holes and the screen is right to say so. That is a
question for a care manager, alongside the waking hours one.

### No edit control, and what replaced it

The detail screen says in a sentence why there is no pencil, because a reader
who does not know why will assume the feature is unbuilt and wait for it.

`submitCorrectionNote` writes a second note and records the first as superseded.
The original is never touched: it stays as written, wrong, attributed and
timestamped. The correction carries the corrector and the moment of correcting,
never the original author or the original time, because backdating a correction
to the note it fixes is forging the record.

The chain renders in both directions. Somebody arriving from a link lands on
exactly one of the two notes, and either read alone is misleading.

An auditor gets no correction control at all, rather than a disabled one. PRD §1:
zero write is not a permission they might be granted.

### The fixtures are not mutated

`note-store.ts` holds session notes in a separate list and supersessions in a
separate map, patched on read. The fixture arrays are exported consts that
`fixtures.test.ts` asserts against, and a screen quietly editing them would make
those guards test whatever the last click did.

In memory only. No `localStorage`. A prototype that remembers a care note across
a reload invites somebody to treat it as a system of record.

### The subject header debt is settled

`SubjectStrip` is the first write surface built since the profile header was
unstuck, and it carries its own: photo, preferred name, legal name, room, date
of birth, site, and allergies. Sticky within the dialog, which is what "does not
scroll away" means inside a form.

It inherits nothing from the profile. That was the point of narrowing PRD §2.4
rather than repealing it.

### Two narrowings, stated rather than hidden

- **Date range is presets** (all time, last 7 days, last 30 days) rather than a
  pair of date pickers. There is no date-picker primitive in this build and
  designing one in passing, on a screen that does not need it, is how a bad
  primitive enters a design system.
- **The author filter lists only authors who wrote for this resident.** Every
  member of staff would offer fifteen filters that return nothing.

### Open item: the sidebar's Care Notes link

`nav-items.icons.ts` declares `/care-notes` and PRD §6.3 describes no screen at
that path. The four it names are the timeline (under the resident), the
composer, the detail, and `/handover`. The item stays disabled rather than
having a cross-resident feed invented for it. Needs a decision.

400 tests.

---

## Phase 2, part one continued: the composer, the shift union, and a fixture correction (22/08/2026)

### The shift is a union, not a field with a note beside it

Frank's shape, and it is better than the one proposed:

```ts
shift:
  | { kind: 'auto'; value: Shift }
  | { kind: 'overridden'; value: Shift; clockSaid: Shift; reason: string }
```

Two things it gets right that a `shift` plus a separate `shiftSource` would not.

**The union is the field.** There is no way to record a shift without recording
where it came from. With two fields, a note whose shift had been changed could
look identical to one that never was, which is the Evidence Invariant failing
somewhere nobody would think to look: the missing evidence is not the shift, it
is the fact that somebody moved it.

**`clockSaid` keeps what was overridden.** "Recorded on the late shift, though
the clock said night, because handover overran" is the whole fact. Without it
the record shows a shift and a reason with nothing to compare against, and a
reader cannot tell what was corrected or by how much.

No separate author or timestamp on the override: it happens as the note is
written, by whoever is writing it, and the note already carries both. Changing
it afterwards would need a correction note, which is the only way anything about
a submitted note changes.

`SHIFTS` in `lib/shift.ts` now `satisfies` the domain `Shift` type, so a fourth
shift in the record stops the library compiling until it grows one too.

### The fixtures were wrong about the work, not thin by design

**A deliberate correction to a wrong baseline. Explicitly not a tidy-up.**

The generator gave a resident one to three notes a day, drawn from eight daytime
hours. A care home writes a note per shift as a minimum and more when something
happens. One to three a day was not sparse data, it was a false picture of the
job.

Now: one note per shift guaranteed, plus one to three events on top, sampled
without replacement from real hours including night hours (22:00, 23:00, 02:00,
05:00). Ashgrove stays thinner than Rosewood, but never below the one-per-shift
floor, because "thin" should mean fewer extras and more days that slip, not a
home that skips shifts.

Measured after: **4.32 notes per resident per day, 12,055 notes.**

The alternative was raising the four-waking-hour threshold to quiet the markers.
That would have been the worse failure by a distance: tuning the alarm to fit
fake noise, and then shipping an alarm that stays quiet through real gaps for
real users.

**The ten §5.3 gaps are untouched.** Verified after the change, not assumed:
`fixtures.test.ts` passes unchanged, including the flagged-and-unreviewed note,
the correction note, and the note by a deactivated author.

### Marker density, before and after

Frank asked for the count.

| | before | after |
| --- | --- | --- |
| notes per resident per day | ~1.9 | 4.32 |
| markers per note | ~1.0 | **0.34** |
| overnight markers across the fixtures | ~0 | 111 |
| residents with an open gap right now | not measured | 7 of 32 |

Roughly one marker per three notes, down from one per note. The markers
discriminate now. **The four-hour threshold is not the next suspect on this
evidence**, and it stays as §6.3 specifies.

The overnight treatment also became visible for the first time: with no night
notes in the old fixtures, essentially every night gap cleared four waking hours
and rendered as an omission, so the quiet marker existed only in a unit test.

### A resident with no note at all now exists

Checked rather than assumed, and the claim did not hold: **no resident had zero
care notes**, before the volume change or after it. `latestNote: 'none'` is
rendered by the residents list, the profile header and this timeline, and had
never once been seen against real data. It was reachable only by reading the
code.

Ismail Sowande, admitted yesterday, is now pinned to zero notes. It is the
honest version of §5.3's "admitted yesterday, almost nothing filled in", and it
gives "sort by oldest care note" a resident who genuinely belongs at the top,
which is the entire reason that sort exists. Same reasoning as `broadbent`
carrying the settled risk picture: a state that exists only in a unit test is a
state nobody reviews.

### Duplicate note bodies, exposed by the volume

At one to three notes a day, the generator picking a category with replacement
was invisible. At four to six, the same sentence appeared twice in an afternoon,
which reads as a bug rather than as a record. Categories are now sampled without
replacement within a day, so a day's notes are about different things, which is
what a day is like.

Worth recording because it is the general shape of this kind of change: more
volume did not create the flaw, it made an existing one visible.

### The composer

The first genuine write in the product. It writes, unlike the two controls on
Future Plans, and the difference is not appetite: a care note needs no
clinician's signature and no document reference. The author is whoever is signed
in and the timestamp is now, so there is nothing to fabricate, and faking it
would have been a choice rather than a constraint.

In memory, gone on reload.

Three things the form will not do:

1. **Pre-answer anything.** Mood opens on nothing chosen, and "Not recorded" is
   an option somebody picks rather than a default they fall into. A form that
   starts with a mood selected records a mood nobody observed. The submit stays
   disabled until it is answered.
2. **Let the author or the timestamp be typed.** Both come from the session and
   the clock. A field for either would make this a forgery surface.
3. **Accept a changed shift without a reason.** Submit stays disabled. "Editable
   with reason" is not editable with an optional reason.

The composer and the correction dialog share one form, because a correction that
captured less than the note it corrects would be a downgrade dressed as a fix.

**Suggested phrases are openers, never finished sentences**: "Ate ",
"Declined ", "Observations taken: ". A suggestion that completes a sentence gets
pressed instead of typed, and a record full of identical sentences looks like
evidence and contains none. None of them carries a judgement either, so there is
no button that writes "no concerns" about an observation nobody made.

An auditor gets no composer and no correction control at all, rather than
disabled ones. PRD §1: zero write is not a permission they might be granted.

404 tests.

---

## Phase 2, part two: shift handover (22/08/2026)

`/handover` is built, and the Handover nav item is enabled. This completes
Phase 2 except for the open item at the bottom.

### The screen exists for its fourth state

PRD §6.3 gives handover four statuses and says why: "a resident nobody looked
at is not All Well". With three, a shift that runs out of time at 19:58 with
four residents left has one option that gets them home, and nothing afterwards
can tell those four from four who were genuinely checked.

`not_reviewed` is a member of the union, not an absence, so the option is gone
rather than discouraged.

**The list is built from the site's residents, never from the handover
entries.** A resident nobody wrote about is absent from the record and present
on the screen, hatched. Iterating the entries would have made "nobody looked at
Mrs Adeyemi" indistinguishable from "Mrs Adeyemi is not here", which is the
blank-cell failure wearing a different hat. `handover.test.tsx` asserts the
fixture entries are genuinely fewer than the residents, so the test would fail
if the two ever coincided and stopped proving anything.

Sorted urgent, then unreviewed, then needs-attention, then all well. The reader
has ten minutes and twenty-eight residents; alphabetical buries the work.

### A status has to say what it means

`needs_attention` and `urgent` carry a non-empty note by construction, and the
write path refuses them without one. A status telling the incoming shift that
somebody needs attention, without saying what for, is a signal they cannot act
on. It is the denominator rule in another costume: a flag with nothing behind
it.

No default on the status control either. "All well" is something somebody says,
never something the form said for them.

### The signature records what it covered

Two signatures given separately, because a handover is two claims: the outgoing
shift saying what it is handing over, and the incoming shift saying it has it.
One signature covering both would let a shift walk out having told nobody.

**Unsigned is a rendered state.** A handover nobody accepted is a shift change
nobody took responsibility for.

Each signature stores the counts at the moment it was given: how many residents
were reviewed and how many were not. Signing with six people nobody looked at
does not mean "all well", it means "handed over, with six holes", and a
signature that cannot say otherwise means more than it should. The confirmation
says so in the sentence, names the site, and goes destructive when the
unreviewed count is above zero.

**No blocking rule was invented.** Signing with unreviewed residents is allowed,
loudly. Refusing the signature would be a policy this build has no authority to
set, and it would push the pressure straight back onto marking people All Well
to unlock the button, which is the exact failure the fourth state removes.

### The Stale state is real

A previous shift's handover that the outgoing staff signed and the incoming
staff never did. Named on the screen with its date and which half is missing.
That state could not exist at all on a three-status screen with a single
signature, which is a reasonable test of whether the model earns its shape.

### Two fixture flaws the screen exposed

Same shape as the care-note duplicates: the volume did not create them, the
screen made them visible.

- **The same note on two residents.** Notes were picked with replacement, so a
  site with six residents needing attention showed one sentence twice. Now
  sampled without replacement per session.
- **Pools too shallow to sample from.** Five attention notes could not cover six
  residents, so the fallback fired and the duplicate came back. Twelve attention
  notes and six urgent ones now, all of them things a real handover says.

### Read-only

An auditor gets no review control and no signature control, rather than disabled
ones. The record stays completely readable: all twenty-eight rows, every status,
every note. PRD §1, and the test asserts both halves, because a read-only screen
that also hides the record would be a different bug.

### Still open

`nav-items.icons.ts` declares `/care-notes` and §6.3 describes no screen there.
The item stays disabled rather than having a cross-resident feed invented for
it. Unchanged from part one, and still needs a decision.

415 tests.

---

## Phase 3 planned, and what re-reading the documents turned up (22/08/2026)

CLAUDE.md and FRONTEND_PRD.md were both replaced. Re-read in full before planning.
Nothing was built this turn.

### Verified rather than assumed

**`MarCellState` matches §5.1 exactly.** Diffed all four unions programmatically
rather than by eye: `MarWitness`, `MarEscalation`, `MarCellState` and
`NotGivenReason` are identical to the specification, modulo one cosmetic leading
pipe. The type was written before the §5.1 correction landed, so this needed
checking rather than trusting.

**One finding inside it.** `not_given.note` is typed `string | ''`, which
collapses to plain `string`: the empty-string member adds nothing and the type
asserts nothing. It is in the PRD that way too, so it is Frank's call. If the
intent is "a note may be absent", Rule 1 wants a closed union with a named
member, not a union with a subtype of its own other member.

### Rule 3b changes a component that already shipped

`given` on the MAR grid is the definition of recorded-and-unremarkable, and it
is the most common state on the chart. `MarCell` currently renders it as a solid
green pill, which at grid density is a wall of green: Standing Check 4, volume
drowning a distinction.

It becomes a quiet mark. `not_given` deliberately does **not** follow it. A
resident refusing their medication is settled but not unremarkable, the next
round needs to know, and §4.5 names a solid caution tint for it specifically.

`MarCell` gains `density: 'comfortable' | 'grid'` rather than a second
component, matching the split `ReviewBadge` already uses for the same reason.

### Phase 2 is incomplete against the new spec

The replaced §6.3 specifies `/care-notes` in detail, built around four queries
the per-resident timeline cannot answer. The previous build left that route
disabled and recorded it as unspecified, which was true of the old document and
is not true of this one.

**Decision: close it before Phase 3 starts.** §10 says one phase at a time in
order, and an order that gets suspended the first time it is inconvenient is not
an order.

### Two decisions the documents could not settle

**A controlled drug stock mismatch "raises an incident", and Incidents is Phase
4.** Decision: build the submission block fully, and render the incident it
would raise as present-but-disabled with its phase tag, which is the pattern §8
already mandates for Phase 16 affordances. The requirement stays visible instead
of silently not happening.

**The stub must not imply the incident was raised.** Future tense only: "A
discrepancy incident will be raised when Incidents is built." Never "Incident
raised", never anything a reader could take as done. Same rule as the
write-confirmation toasts in Phases 1 and 2: the honest half of a half-built
feature is saying which half is missing, not implying both are there.

**PIN behaviour on shared devices** is PRD §9 open item 3 and explicitly blocks
the MAR confirmation dialog. Decision: a PIN per submission, checked against a
staff fixture. It is the safest reading for a device several carers share, and
it makes a controlled drug's second signature a genuinely different person
entering a genuinely different PIN rather than a checkbox somebody ticks.

**It is a fixture check, not authentication, and the code says so.** No hashing,
no salting, no security vocabulary anywhere near it. This build has no backend
and no auth (CLAUDE.md, first line), so a PIN compared against a fixture is a
prototype affordance that demonstrates the interaction and secures nothing.
Dressing it in security language would be exactly the pattern the comment sweep
found ten instances of: a claim of a guarantee that does not exist.

**The second signature requires a different member of staff.** Not merely a
second PIN entry. The same PIN twice is refused, with a message saying why,
because two entries by one person is one signature typed twice and the whole
control exists to put a second pair of eyes on a controlled drug.

Recorded here because it partially answers an open item rather than closing it:
the real question is whether a home wants that friction on every round, and only
a care manager can answer it.

### The three entry conditions, as planned

1. **The MAR day key.** `medications.ts` keys records by `date.toDateString()`,
   which is machine-local. Inert only because both fixture sites share a
   timezone, and the grid is about to be built on it. One `marDay(instant,
   timeZone)` on the `zonedWallClock` helper Phase 2 added, used by the fixture
   and the grid alike, with a test that a record's day matches its `dueAt`
   rendered in the site's zone. `MarRecord.date` becomes `IsoDate`.
2. **`AlertDialog`** loses `title: string` and gains required `subject` and
   `action` plus a closed `preposition` union, composed by the component. With
   no free-form title, "Are you sure?" stops being expressible rather than being
   discouraged by a comment. Four call sites update.
3. **`MarCellState`** confirmed above.

### Needs approval before building

`Medication.isPrn` is a boolean with nowhere to put the 24-hour maximum §6.4
requires. Proposed: replace it with `{ kind: 'scheduled' } | { kind: 'prn';
maxIn24Hours: number }`, so the maximum cannot go missing from a PRN, plus the
remaining setup fields (storage instructions, prescription photo). A fixture
type change, so it waits.

415 tests, unchanged.

---

## /care-notes, the cross-resident view (22/08/2026)

Closing the Phase 2 gap the replaced §6.3 opened. Built before Phase 3 starts,
per §10.

### There is no feed

§6.3 says a reverse-chronological list of every note in the building is "a
screen nobody opens twice", and it is right: it answers no question anybody
arrives with. So the screen is four questions and opens on the supervisory one,
which has nowhere else in the product to be discharged.

The four queries are pure functions taking `now` and the site's timezone, so
"today" means the site's day rather than the machine's and every answer can be
pinned in a test.

### Rule 3c, in both directions

The new rule cuts two ways here, and the screen does both.

**Suppress, on the resident timeline.** A gap marker inside "Medication notes
only" is an artefact of the view, so it is not rendered at all. That was built
in part one.

**Restate, here.** "No note today" and "no note on the night shift today" are
genuine absence claims, and they are legitimate *because they name their
filter*. The copy carries the window, the shift and the population in the
sentence, and the by-shift view says outright what it is not claiming: somebody
may have written about that resident on another shift.

### "Today" at ten past midnight

The screen was measuring 28 of 28 residents with no note today, which was true
and useless: the fixture clock happened to sit just after midnight.

Left as the calendar day, because that is what "today" means and what §6.3 asks
for. Made legible instead: the figure states the current site time in the same
sentence, so a reader can see why it is high, and every row carries when that
resident was last written up. A home that has stopped writing and a home eleven
minutes into a new day now read differently.

**Worth a decision.** If a care manager would rather this asked about the care
day (since 07:00, the waking-hours constant) than the calendar day, that is a
one-line change. It is the same underlying question as the waking-hours item and
should go to the same person.

### Three fixture corrections, all of them wrong on the facts

Standing check 5. None of these is tidying up a gap; the ten §5.3 gaps are
untouched and `fixtures.test.ts` passes unchanged throughout.

**1. Nobody was ever waiting on a senior.** The generator drew one chance and
produced only `reviewed` or `not_flagged`, so across twelve thousand notes
exactly one was awaiting review: the §5.3 pinned one. That is not a patchy home,
it is a home where nobody asks for help and every request has been answered.
`flagged_not_reviewed` had no fixture reaching it (standing check 1) on the one
screen built around it.

**2. Then there were 208 of them.** Flagging 8% of twelve thousand notes with no
bound left a queue of 208 across 28 residents, which is a wall rather than a
queue, and it cannot show that it is sorted by how long each has waited.
Bounded: a senior clears the queue within a day or two, so only flags from the
last two days are still open and older ones were dealt with.

**3. The queue was full of things nobody escalates.** "Denture soaking solution
replaced. No soreness observed" is not a request for a second opinion. Flags now
attach only to categories somebody would actually escalate: behaviour, health
observation, medication, social and emotional.

Final: **a queue of 5 across 28 residents**, in three plausible categories, with
883 flagged-and-since-reviewed behind it.

Each correction was gated on values already drawn, so the RNG stream is
bit-for-bit unchanged and no other fixture moved. That mattered: an earlier
attempt hoisted the author draw two lines up, shifted every downstream value,
and broke an unrelated timeline test. The lesson is worth keeping: in a seeded
generator, *where* a draw happens is part of the fixture.

### Smaller things

`NoteCard` links absolutely rather than relatively. It renders on the resident
timeline and here, and a relative link resolved differently in each. It also
takes an optional `subject`, because a cross-resident note with no name on it
cannot be read at all.

`zonedDate(instant, timeZone)` added to `lib/format.ts`. It is what "was this
today?" needs about a clinical record, and it is also the replacement for
`medications.ts`'s `toDateString()` key that Phase 3 has to fix. Built here so
Phase 3 reuses it rather than growing a second one.

The author view picks nobody by default. Opening a supervision screen already
pointed at a named member of staff is a decision the product should not make on
somebody's behalf.

429 tests.

---

## Handover layout pass (22/08/2026)

The content was right and the hierarchy was not: every element carried the same
weight, so nothing led. Six changes, all of them about rank rather than copy.

### One block instead of three cards

Title, shift, site, both figures and the unsigned-earlier line are one thing a
reader takes in at once. As three stacked cards they were three equal
announcements, and a handover from yesterday had the same visual weight as the
one about to be signed. The stale line is now a sentence inside the block, under
the facts it belongs with.

### The lead figure is the one still fixable

"6 not reviewed" is the display number; "22 reviewed" is a line beneath it.

Six is the only figure anybody can still do something about before the signature
goes on. Twenty two is the reassuring half, and two equal display figures made
the reader do the ranking themselves. Rule 3b, applied to a pair of numbers
rather than to a status.

Both keep their denominator. Rule 4 is not a matter of emphasis, so
`AggregateFigure` gained `emphasis: 'lead' | 'secondary'` rather than the
secondary figure being written as loose text that happens to mention 28.

### The badge stacks

`Not reviewed` was an inline uppercase ribbon running across half the row, which
gave the quietest fact on the screen the most width. It is the `chip` variant
now: sentence case, label over detail, about a third of the width, same content.

`.chip .label` also moved up one step and one weight, so the label leads rather
than the two lines reading as a single grey block. That ripples into the
residents list, the profile tabs and the Needs tab, and was checked on all of
them: the "Critical records missing" chip in particular reads better for it,
because the label is the carrier of meaning and was competing with its own
detail.

### Four groups, not one sorted list

Not reviewed, Urgent, Needs attention, All well. A nurse can now see the shape of
the shift from the headings without reading a row.

**Not reviewed leads, above urgent**, and that ordering is the argument. Urgent
is information you have already received either way and reading it thirty
seconds later costs nothing. Not reviewed is the only group still fixable before
signing, and once the signature is on, the chance has gone.

**The denominators differ between groups on purpose.** "Not reviewed, 6 of 28" is
measured across everybody living at the site. "Urgent, 2 of 22" is measured
across the residents somebody actually looked at, because the other six were
never assessed and counting them in that denominator would claim a coverage
nobody has.

Every group renders even when empty, with its zero stated. Dropping an empty one
would make "nobody is urgent" and "nobody has checked whether anybody is urgent"
the same absence, which is the blank-cell failure one level up.

### Hatched rows carry the silence

"Not reviewed" alone is flat: six of them look identical and a nurse with ten
minutes has no way to choose between them. Each now states how long the resident
has gone unwritten-about, with the last author and time, and a resident nobody
has ever written up says that instead.

The pairing is much sharper than either half: "Not reviewed" plus "no care note
recorded for 9 hours 55 minutes" ranks the six without anybody sorting them. The
data was already in the fixtures and the row was simply not asking for it.

### Reviewed

Greyscale: the hatch is unmistakable against the group headings and the
plain-text silence lines, and the lead figure still leads without hue. axe clean,
covered by the existing test.

Four new tests: group order and the deliberate position of Not reviewed, the two
different denominators, empty groups surviving, and every hatched row carrying a
silence line.

433 tests.

---

## Hierarchy pass: handover and care notes (22/08/2026)

Built against `docs/handover-carenotes_1.html`, an approved reference for the
two modules. Structure and hierarchy taken from it; none of its CSS, none of
its JS, and none of its literals.

The rule the reference is really demonstrating: **every screen names in one
sentence the single fact it exists to surface, and that fact gets the largest
type, the strongest weight and the top position.** Everything else is context
and renders quieter. Rule 3b, applied to a page instead of to a status.

- Handover — *these residents have not been looked at, and you are about to
  sign.*
- Care Notes — *these notes are waiting for somebody to act on them.*
- The profile Care Notes tab — *this is everything written about this person,
  including the stretches when nobody wrote anything.*

### Five places the reference was not followed

Each is a rule beating a mockup, and each was confirmed before building.

**1. The lead coverage card's fill.** The reference gives "Not reviewed" a
solid `--unrecorded-tint` with a solid border. PRD §4.5 says the unrecorded
treatment must never be a solid neutral fill, because a solid neutral fill
reads as "fine". The deeper problem is that the figure is a *measured count*,
and Insufficient Evidence is the only aggregate that earns the hatch: Red is a
finding, the hatch is the absence of one, and tinting a real number that way
blurs the single distinction §2.3 exists to draw. The lead card is a plain
surface and leads on size, weight and position alone.

**2. The Rule 3c banner's wording.** The reference says "gap markers are
hidden" on the author and shift views. Those screens have no gap markers. A
banner naming a mechanism that is not on the page is a false guarantee — the
same defect as a comment claiming something the code does not do, which §8
already warns about. Each view now says what its own filter actually costs.
The literal gap-marker wording stays on the profile timeline, the one screen
that renders them.

**3. "All notes" is bounded.** The reference has fourteen notes; this site has
11,105. A feed of eleven thousand rows is volume that drowns the distinction
it was meant to show, and a silent cap is worse, because the screen then reads
as "this is everything". So the view is scoped to the site's calendar day and
says so, with the excluded count *and its denominator* in the banner: "11,091
of the 11,105 notes on this site's record are older than today and are not on
this screen."

**4. "Not flagged" is still rendered as nothing.** The reference shows it as a
quiet label. On eleven thousand notes it would fire on nearly every row and
drown the five that are actually waiting on a senior. Flagging is an action
somebody takes, not a record somebody owes.

**5. Single signature.** The reference signs once. PRD §6.3 requires dual,
outgoing and incoming, and the Stale state depends on it.

### Handover

Four titled sections with air between them, via a new `Section` primitive. The
gap between them is the thing doing the work: it says the coverage figures, an
unsigned handover from yesterday, the residents and the signature are four
different kinds of thing, where four equal cards said they were four of the
same thing.

**The glance is four cards, not two figures.** Not reviewed leads; urgent,
needs attention and all well support it. `AggregateFigure` gained a third
rank, `supporting`, and an optional `note` line — the lead card carries "the
only figure here you can still change before you sign", which is the argument
for its own position and should not be left to the reader to infer from type
size.

The *reviewed* figure did not disappear, it became the denominator of the
other three. That is better than a fifth card: "2 of 22 residents reviewed"
states the coverage in the place where somebody is reading the number it
qualifies.

**Earlier handovers is hatched now.** It was amber prose, which is the
treatment for something recorded that needs attention. Nothing was recorded.
Somebody handed a home over and there is no evidence anybody took it, and that
is a hole rather than a warning inside one.

It also names *which* signature is missing, in three cases rather than one:
never countersigned, never handed over, neither shift signed. One label across
all three would lose the worst of them inside the mildest — the blank-cell bug
wearing a word. And when there are none, the section still renders, with a
`Settled` line saying so; an empty section and a section nobody built look
identical.

**All well stopped being a green pill.** Rule 3b: a filled pill for "nothing to
do" on twenty rows is twenty things shouting on the one screen whose whole job
is finding the residents nobody looked at. It is `Settled` now — plain text,
author and timestamp unchanged and still always visible. Quiet is not hidden.

The group headings dropped to `h3` under the sections' `h2`, so the outline a
screen reader gets is the same ranking a sighted reader gets from the spacing.

### Care notes across the home

A fifth tab, **All notes**, last and never the default, bounded as above. Four
questions then a feed, and the order is the argument.

**Rule 3c is on the screen rather than only in the code.** A new `FilterNotice`
banner, in two tones that are two different promises: `suppressed` means a
claim this screen would otherwise make has been withheld, `scoped` means the
claim is still being made but only about the filtered set. Without it the
product simply declines to make a claim and a reader cannot tell a suppressed
claim from one that came back empty — "nothing here" and "nothing here that
matches what you asked for" look identical, and the first is the one that gets
acted on.

### The profile timeline

`NoteCard` gained a `railed` layout rather than having its layout replaced.
The cross-resident row is answering a different question and keeps its shape:
there the reader scans across people, so the name leads. On a resident's own
timeline the subject is settled by the header above, so what is being scanned
is *when* — the time moves out to a rail of its own and the notes and the gaps
between them line up against one column of clock times. That is what makes a
gap marker read as a span rather than as one more row.

The rail is `6rem`, not `96px`, and that is an accessibility requirement rather
than a preference: text-only zoom to 200% grows the root font size without
touching the layout, and a fixed rail would hold a 24px date and clip it. The
gap markers indent off the same variable, so they stay aligned as it grows.

The overnight marker gained the sentence it was missing: that overnight time
does not count toward the four-hour threshold, so the stretch is not an
omission. Without it a reader comparing an eleven-hour overnight against a
five-hour omission has no way to know the longer one is the untroubling one,
and the ranking looks arbitrary.

### The clock-dependent test

`notes.test.tsx` → "puts the open gap first, measured against now" was failing.
Not a regression: a sweep of the suite under pinned clocks at 00:30, 03:30,
06:30, 09:30, 12:30, 15:30, 18:30, 21:30 and 23:30 found it green only around
midnight and red at every other hour tried.

The cause is that the open gap is the only item on the timeline measured
against *now*. Every other gap sits between two fixed notes and cannot move.
So the test was asking whether the resident it named happened to be carrying
an open hole at the hour the suite ran. It was measuring the clock, not the
rule.

Pinned to 15:00 the day after the fixtures' own anchor, with the reason in the
test. Every note is written at or before `NOW`, so from that instant the newest
note for any resident is at least the whole 07:00–15:00 waking window behind,
and the open gap is guaranteed rather than hoped for. What is under test is the
ordering, which is what the test was named for. Green at all nine hours after
the fix, as is the rest of the suite.

**Nothing else in the suite reads the wall clock in a way that can flip.** The
three `Date.now()` calls in `fixtures.test.ts` are legitimate and hour-proof:
they assert no record is timestamped in the future, which is inherently a
statement about now and holds whenever it runs. Everything else derived from
time — `timeline.test.ts`, `care-notes-views.test.ts` — already takes `now` as
an argument. The exposure was one test, and it is the *shape* of the exposure
that is worth keeping: components read `new Date()` with no injection seam, so
any future assertion on an open gap, an elapsed duration or "no note today"
will have the same problem. Added to CLAUDE.md §8 as a sixth standing check.

### Smaller things

The axe test on the profile timeline went from just under its 30s budget to
just over it — the rail added two nodes a row. Raised to 60s rather than left
as a duration-flake. A test that fails on how long it took is not telling you
anything about accessibility.

Two care-notes views had no axe coverage at all, because only the default view
was ever walked. The shift view and the feed are covered now; a view nobody
runs axe over has no accessibility claim behind it.

`care-notes-views.ts` said "there are four questions" in its docblock. There
are five. Corrected rather than left, per §8.

451 tests.

### Still to check by eye at review

No browser driver is installed and I did not add one. Verified structurally
instead: no `ellipsis`, `nowrap`, or `overflow: hidden` in any stylesheet
touched, so nothing can truncate; the hatch, the settled text and the info
banner are distinguishable by pattern and weight rather than hue, so greyscale
should hold. **Greyscale and 200% zoom at 1280 CSS px still want a real look**,
particularly the four-column glance grid and the timeline rail, which are the
two new pieces of layout.

### The seven-states pass

Run properly rather than assumed, and it found more than expected. Auditing
what each branch needs and then checking which branches any fixture actually
reaches (CLAUDE.md §8, first standing check).

**Loading and Error had no test on any of the three screens.** Both states were
written, both were reachable, and neither was ever checked — which is exactly
how a state goes dead without anybody noticing. Covered now on the handover,
the cross-resident view and the profile timeline, including that Retry actually
retries, because a button that re-renders the same error is worse than no
button.

The profile timeline turned out to have *two* loads in sequence — the subject
header resolves before the timeline mounts. That order is correct and is now
asserted as an order: a timeline rendered beside the wrong name is the failure
§2.4 exists to prevent.

A note that does not exist needed no mock. The client already rejects an
unknown id by design, because returning `undefined` would leave the caller to
decide what a missing subject means.

**Ashgrove Lodge is the fixture that reaches the empty states.** Four
residents, nobody urgent, and nothing at all waiting on a senior. It reaches
the empty-group branch on the handover and the settled branch on the default
care-notes view, and neither had been exercised. Both were correct.

#### Six branches no fixture reaches

The fixtures are deliberately messy, which means the Rule 3b answers — recorded,
complete, nothing to do — never render. At both sites somebody always has no
note today, some shift always missed somebody, and every earlier handover is
always the never-countersigned one.

So these were the states nobody had ever looked at, on the screens whose
*reassuring* answers are the most dangerous ones to get wrong. A false
"everybody was written up today" is precisely the failure this product exists
to prevent, and it was unexercised code.

Constructed in tests rather than tidied into the fixtures. The deliberate gaps
stay exactly as they are — correcting this by making a site look healthier
would be the "cleaning up fixture data to make a screen look better" that §6
forbids.

Covered: every resident written up today; a shift that wrote about everybody;
an empty feed over a non-empty record; and every earlier handover signed. All
four were correct — each keeps its denominator, none reaches for the hatch,
and the scoped-claim banner stays up even when the answer comes back complete.

Two of them are worth a decision:

1. **"Every earlier handover has both signatures" cannot render.**
   `handover.ts` builds exactly two sessions per site and the earlier one is
   always the Stale gap §6.3 specifies, at both sites. Neither the fixture nor
   the branch is wrong — the gap is deliberate, and a section that renders
   nothing when empty is the blank-cell bug one level up. But it means the
   settled case only exists in a test. **A third site, or a second earlier
   handover that was properly countersigned, would make it real.** Your call;
   I have not touched the fixtures.

2. **`AuthorView`'s "this author has written no notes" branch is dead by
   construction**, not by fixture. The picker's options come from
   `authorsIn(notes)`, which derives them from the same list `byAuthor` then
   filters — so a chosen author always has at least one note. That is a good
   property of the picker rather than a bug, and the branch is defensive. Left
   in place: removing working code is a §9 conversation, not a tidy-up. Worth
   knowing it is unreachable rather than assuming it is tested.

466 tests.

---

## Care Notes layout pass (22/08/2026)

`/care-notes` was not scanning like a queue. Four changes, all about the screen
being worked down rather than read.

### One concept, one treatment, across screens

**Flagged-and-not-reviewed is hatched now, not an amber pill.** A care worker
asked for a second opinion and nobody has given one — that is a gap, and the
hatch is the treatment for gaps. Amber means recorded and needing attention: a
finding somebody made, which is precisely what this is not.

It is also the concept the handover renders as "Not reviewed". A reader who
learns the hatch means "nobody has looked at this" on one screen must not have
to learn a second vocabulary on the next.

**Reviewed went quiet at the same time**, for the reason that follows from it:
if the gap is loud, the completed case must not compete with it. `Settled`,
with the reviewer and timestamp intact.

### Mood is plain text

Rule 3b. A green "Good" beside a note flagged for senior review is reassurance
competing with the finding, on the screen whose whole job is surfacing what
needs acting on.

Quiet at every score, including the low ones, and that is deliberate. A low
mood is a recorded fact and the note body says what happened; quieting a
*record* is not the forbidden move. Quieting a **gap** is — so `not_recorded`
stays hatched and loud.

Quiet is not hidden: who recorded the mood and when are still on it. Worth
keeping separately, because the fixtures do contain moods recorded by somebody
other than the note's author.

### Rows, not blocks

Four aligned columns: resident, over full legal name and room · flag state ·
note body with its meta beneath · action.

As stacked blocks three notes filled a screen and the action sat on a line of
its own, so a supervisor working through what is waiting had to read every note
to find the next name. In columns the eye runs down one at a time.

`NoteQueueRow` is its own component rather than a third layout inside
`NoteCard`. The queue asks a different question — which of these is waiting,
and on whom — so it needs a subject column and a flag column the timeline
shape has no place for. Both render from `note-parts.tsx`, so the facts cannot
drift between them even though the arrangements differ.

Alignment is the point, not density: every row is the same shape whether its
note is one line or six, and the body is never clipped. A care note cut off
mid-sentence is a care note somebody misreads.

### The count on one line

It was a display card with the explanation beside it, spending the top third of
a queue screen on a single number and pushing the rows below the fold.

`AggregateFigure` gained an `inline` form. It is a *form*, not a demotion — on
a queue the count is still the lead fact. The `secondary` rank it replaced had
been orphaned since the handover masthead was restructured, so this repurposes
a dead rank rather than adding a fourth.

Two things the render caught that the tests had not:

- **The inline form said "of 28 residents" where the card said "across 28
  residents".** For a note count that states a ratio which does not exist —
  "42 notes by K. Osei, of 28 residents". Now "across" in both, so the two
  forms cannot disagree about what the denominator means.
- **Captions were written as standalone card labels** and read as "6 Flagged
  and not yet reviewed" mid-sentence. Reworded to sit inside a sentence.

`formatCount` added to `lib/format.ts`. The figures that get large here are the
ones describing how much of a record a view is *not* showing, and `11091` is
read as the wrong magnitude at a glance. Not applied to `AggregateFigure` yet —
every figure that reaches it today is under a thousand, and changing the shared
component is a wider change than this pass needs.

### The standing check this pass earned

Added to CLAUDE.md §8: **an assertion written from the same string as the code
confirms the bug rather than catching it.**

It happened twice more during this pass, which is why it earned its line. Three
tests broke on changes that broke nothing: `/across 28 residents at Rosewood
Court/` fired when the figure changed shape, and two more fired when thousands
separators arrived. None of them was testing the rule it was named for. All
three now assert the behaviour — the figure carries a number, a population and
a site; the excluded count is smaller than the record it came from — and none
would notice a rewording.

### Smaller things

`ProfileHeader` carried a comment saying MoodBadge stays loud "for Phase 2's
care note surfaces, where the mood IS the subject". That stopped being true in
this pass. Corrected rather than left, per §8.

It also surfaced a real inconsistency: the header tints the mood word by score,
the note surfaces do not. The word carries the meaning in both, so the tint is
reinforcement rather than the sole carrier and nothing is wrong — but it is one
concept in two treatments, and worth collapsing the next time either is
touched. Not done here; outside this pass.

473 tests.

---

## Care Notes queue, built to spec (22/08/2026)

Built to the literal strings and structures given, and to the reference's
`.nrow` proportions.

### The three deletions

All three said the same thing: that this screen asks questions about the home.
The tab labels already say it.

### Heading area, two lines

`H1: Care notes`, then one line:

> 6 flagged and not yet reviewed, across 28 residents at Rosewood Court · oldest first

`AggregateFigure` gained a `qualifier` — two or three words carried on the same
line after a middot, replacing the full stop, so the line stays one statement
rather than two sentences the reader joins up.

### The flag chip

Two lines, hatched, capped: **Flagged, not reviewed** over *C. Nwosu,
19/08/2026*. The sentence that used to sit there was identical on every row, so
it had stopped being information and become the thing between the reader and
the rows.

Capped at `12.5rem` rather than `200px`. Same width at the default root size;
in rem it grows with the words under text-only zoom instead of clipping them
(PRD §7). The only place the literal spec was not taken literally.

### The row

`15rem · 13rem · 1fr · auto`, `--space-12` vertical padding, body at the small
step and meta at the caption step — the reference's proportions.

One meta line: `Behaviour · C. Nwosu · 19/08/2026 08:40 BST · Early shift ·
mood low`. Mood is the last item and has no column, no author and no timestamp
of its own.

Row height works out at 65px for a one-line note and 85px for two, against
677px of vertical space at 1440×900 — **seven two-line rows**, against the six
asked for. Nothing is clipped to get there: a long note makes its own row
taller and the other three columns stay aligned to the top of it.

### A fixture fact-error found on the way

`makeMood` draws `recordedBy: rng.pick(carersAndSeniors)` **independently of
the note's author**, which is drawn on the next line. So the fixtures routinely
have one person writing a note at 23:50 and a different person recording its
mood at exactly 23:50. The comment directly above it says "the mood was
recorded with the note, not at some unrelated moment" — it got the timestamp
right and the person wrong.

Not a deliberate gap; a fact-error (§8). **Not fixed**, and deliberately so:
`author` is drawn after `mood` specifically to keep the RNG stream bit-for-bit
stable, and reordering would shift every downstream fixture. It can be fixed
without moving the stream — let `makeMood` draw and discard, then take the
note's author — but that is a fixture change and wants a decision. It is
invisible either way now that mood carries no attribution of its own.

## The description sweep

The rule applied: **a section heading gets a description only where a reader
would misread the section without it.** Seventeen existed; six survive.

### Kept, and why

| Where | Why it survives |
| --- | --- |
| **Care team** (General Information) | "Care team" reads as the home's own staff. It means GP, dentist, optician — people outside the building. Without the line a reader looks for the wrong names. |
| **The person** (General Information) | A vague heading over heterogeneous fields — language, communication, what matters, diet. Nothing about the title tells a reader that diet is under it. *The better fix is renaming the section; that is a copy change nobody asked for, so the description stays for now.* |
| **Other care plan domains** (Needs) | The load-bearing one. End of life sits here with nothing in it because it is recorded on Future Plans. Without the line an empty domain reads as unrecorded — the exact Evidence Invariant failure the tab exists to prevent. |
| **In an emergency** (Future Plans) | "Both are checked before CPR is started" is a clinical instruction, not a description. DNAR and ADRT are read together, and §2.1 names getting that wrong as catastrophic in both directions. |
| **Legal and statutory** (Important People) | "Statutory" is opaque to a care worker. The section holds LPA holders, deputies and the council's named social worker, and the heading does not say so. |
| **Other professionals involved** (Important People) | Draws the boundary with Care team. Without it a reader expects the GP here. |

### Deleted

Identity · Placement · Clinical · Where this person wants to be · After death ·
Family and next of kin · all five Needs group descriptions · the Care notes
timeline subtitle · both Note detail subtitles · Handover's *Residents* and
*Signature* section notes · the four Care Notes per-view explanations · the
author picker's "choose a member of staff" paragraph, which repeated the
picker's own placeholder.

Handover's *Earlier handovers* kept its first clause only — "A handover is
complete only when both shifts have signed it" — which is why an item appears
there at all. The rest was editorial.

The three `FilterNotice` banners survive but are one sentence each now. They
carry Rule 3c, and Rule 3c is the case the rule is *for*: without them a reader
cannot tell a suppressed claim from one that came back empty.

`description` is optional on all four section types now, and the four tests
that demanded one everywhere assert the shape of the ones that exist instead.

### One claim deleted that was worth keeping somewhere

Clinical's description said allergies "are shown first here, and again on every
medication and care screen". That is a real safety property and it is now
written down nowhere in the UI. It is a claim about other screens rather than a
description of this one, so it did not survive the rule — noting it here so it
is not lost.

473 tests.

---

## Audit item 1 — the review write path (22/08/2026)

The supervisory loop closed. Before this there were four writes in the product
and none of them recorded a review, so a care worker could flag a note to ask
for a second opinion and nothing anywhere could record having given one. The
queue at `/care-notes` could only grow.

**Store.** `sessionReviews`, an overlay keyed by note id, patched on read —
the same shape as `supersessions` and for the same reason: the fixtures stay
exactly as they are, so `fixtures.test.ts` keeps testing the fixtures rather
than whatever the last click did.

The overlay also buys the undo for nothing, and that turns out to matter. See
the type note below.

**Client.** `recordNoteReview` and `undoNoteReview`. Reviewer and timestamp
come from the session and the clock, never from a form — a reviewer field
somebody could type into is a way to sign off work in another person's name.
Only a flagged note can be reviewed; only a review *this session* recorded can
be taken back.

`reviewRecordedThisSession` is the one synchronous read in `client.ts`, and it
says so: it is a question about what this browser tab did a moment ago, not
about the record, and dressing it as a promise would make session state look
like a read of the care record.

**Control.** On the queue row and on the note detail. On the row because the
queue is worked down from there — clearing six flags via the detail screen
would be six round trips.

The confirmation names the resident **and the note**: a senior working a queue
of six is confirming one row of six and the rows differ only in their body
text. It also names who flagged it, and says the flag survives.

### Two bugs the build surfaced

**The toast was destroyed by the action it was confirming.** Recording a review
takes the row off the queue, which unmounts everything inside it — including
the toast that had just been told to open. It never appeared. It would also
have put one toast per row into the DOM.

The outcome is now reported upward and announced once by the screen. Both
screens own their own.

### The type note — worth a decision

`CareNoteReview` replaces `flagged_not_reviewed` with `reviewed` outright:

```ts
| { kind: 'flagged_not_reviewed'; flaggedBy: StaffRef; flaggedAt: IsoDateTime }
| { kind: 'reviewed'; reviewedBy: StaffRef; reviewedAt: IsoDateTime }
```

So **once a note is reviewed, who flagged it and when are gone from the
screen** — half of a supervision record. "C. Nwosu flagged this on 19/08,
M. Halloran reviewed it on 21/08" is the fact somebody wants later; the type
can only carry the second half.

Not changed: a status union is a §9 stop-and-ask. Flagged for a decision.

The undo works only because the store overlays rather than edits — the original
note still carries its flag underneath. A test asserts the flag comes back
byte-identical, so if that ever becomes an in-place write it fails.

482 tests.

---

## The supervision record — `CareNoteReview` widened (22/08/2026)

```ts
| { kind: 'reviewed'; flaggedBy; flaggedAt; reviewedBy; reviewedAt }
```

A review that erased who raised it was half a record rendering as a whole one.
"Reviewed by M. Halloran" reads as routine sign-off; the record is that
somebody asked and somebody answered, and the distance between the two is what
gets asked about.

The compiler found all four construction sites — two fixture branches, the
client write, one test builder. That is the closed-union rule doing its job:
widening a member cannot be half-done.

**Fixtures carry the flag forward.** `flaggedBy: author, flaggedAt: at` in both
branches — literals, no draws, so the RNG stream is bit-for-bit unchanged and
no other fixture moved. `fixtures.test.ts` now asserts the ordering that the
new shape makes checkable: flagged at or after the note was written, reviewed
at or after it was flagged.

### The wait, stated

`SupervisionRecord` on the note detail. Three terms:

```
Flagged    D. Morrison, 20/08/2026 19:39 BST
Reviewed   M. Halloran, 21/08/2026 09:00 BST
Waited     13 hours 21 minutes
```

and for one still in the queue:

```
Flagged    C. Nwosu, 19/08/2026 08:41 BST
Waiting    79 hours 19 minutes so far. Nobody has looked at it yet.
```

Two timestamps side by side make a reader do the arithmetic. The wait is what
the queue sorts on, so it is the figure they came for — and it does not stop
mattering once the note leaves the queue.

Nothing here is hatched. A flag that was answered is a complete record and a
slow answer is a finding about the answer, not a hole in it. The wait is stated
plainly and the reader judges; there is no threshold, and inventing one would
be a claim nobody has signed off.

### Flagged and cleared by the same person

A real state, and not a second opinion. It renders as its own label —
"Flagged and reviewed by the same person" — with "no second opinion was given"
on the wait line. Stated, not judged: raising a question and answering it
yourself is legitimate, it is simply not what the flag asked for, and only both
names on the record let a reader tell.

**No fixture reaches it.** `carersAndSeniors` does not include the fixture
reviewer, so a fixture flag and a fixture review can never share a person. It
is reachable the way a user reaches it — write a flagged note, then clear your
own flag — and the test builds it through the real writes rather than
constructing the state by hand. Worth pinning a fixture for; not done here.

### The handover check

Asked for, and the answer is yes: `StatusDialog` has the same shape. Recording
a status moves the row between groups, so the `<li>` holding the dialog
unmounts.

It does not currently *have* the bug, because it has no toast to destroy — it
has no confirmation at all. Which is the finding: **when the missing
acknowledgement is added it must live on the screen, not in the dialog**, or it
will be destroyed on arrival exactly as the review toast was.

### Two observations, neither fixed

**The `roll < 6` fixture branch reviews notes in any category**, while only
four categories can be flagged-and-waiting — the gate the queue-noise fix
added. Now that the flag author is visible, historical flags appear on
categories the comment says nobody escalates. Defensible either way (a
nutrition note *can* warrant a second opinion), so left alone.

**A wait over a day reads as "79 hours 19 minutes".** Correct and unambiguous,
but `formatDuration` has no day unit. Shared with the gap markers, where hours
are right, so not changed unilaterally.

486 tests.

---

## Care notes fixes, items 1–9 (22/08/2026)

**1. Page title.** `notes.module.css` had no `.pageTitle` rule at all, so the
`<h1>` fell through to the reset and rendered at body size. Added, matching
the residents list exactly.

**2. One control.** "Open" was a second stacked link under the button and cost
every row two lines of height for something the row already does. The note body
is a real `<Link>` now, with a hover state on the row — a link rather than a
click handler, because a row only a mouse can open is a row a keyboard cannot.

**3. Mood off the queue.** `NoteMeta` takes `showMood`. A hatched "Mood not
recorded" on the same row competed with the flag for exactly the attention the
screen is asking for. It is a real gap and it is stated on the note detail,
where it is the only claim being made.

**4. The wait, on the chip.** `Flagged, not reviewed / waiting 80 hours`. The
queue is sorted oldest-first because the wait is the finding, and nothing on
the row was showing it — a reader could see the order but not the reason for
it. The author moved to the detail, where it is read rather than scanned.

The reviewed chip took the same shape — `Reviewed / waited 13 hours` — which
also settles the concern raised last round that it had grown too long for a
13rem column.

`coarseWait` rounds to one unit. The detail states the wait to the minute
because it is read there; on a row being ranked against five others, "80 hours"
ranks it exactly as well in half the width.

**5–7. Note detail.** Both actions in one row, primary and secondary — they
were at opposite corners. The review chip under the note body is gone (the
panel beneath states it and carries the wait, so the chip was the same fact
twice). The immutability card is one line above the control it explains; the
second paragraph is deleted.

**8. The subject strip.** Rebuilt as one horizontal row — avatar, name over
legal name, `Room 14 · Born 07/07/1948 (78) · Rosewood Court` inline — with the
allergy full-width beneath rather than floated beside. In a 560px dialog the
old layout collapsed to a narrow column with every fact on its own line, which
is not a thing anybody reads at a glance, and this is the wrong-subject control.

**9. Category label.** The control had an `aria-label` and nothing on screen,
so the first field on the form was a dropdown a sighted reader had to open to
identify. Every other field was labelled; this was the exception.

486 tests.

---

## The pronoun defect (22/08/2026)

**1,988 of 12,139 care notes referred to a resident by the wrong pronoun.**
45% of every note containing one.

The cause was the same in three places: a pool of hand-written sentences with
pronouns baked in, drawn by `rng.pick`, which knows nothing about the resident
it is drawing for. Residents have carried a `pronouns` field all along; it was
never consulted.

Not a typo. It is the sentence a family reads when they ask what their mother
did yesterday, and it tells them nobody is paying attention.

### What was affected

| Pool | Gendered | Wrong |
| --- | --- | --- |
| `NOTE_BODIES` | 4,455 | **1,988** |
| `ATTENTION_NOTES` / `URGENT_NOTES` | 5 | 3 |
| `COMMUNICATION_NEEDS` | 2 | 1 |
| `DOMAIN_SUMMARIES` | 0 | 0 — written without pronouns, and clean |

The pinned §5.3 notes were also literal; one of them is Emmanuel Okafor's, and
tokenised with the rest.

### The fix

`fixtures/pronouns.ts`. Pools carry `{they}` / `{them}` / `{their}` /
`{themself}`, resolved per resident **after** the draw, so the RNG stream is
bit-for-bit unchanged and no other fixture moved.

**Verb agreement is carried by tokens** — `{were}`, `{are}`, `{have}`, `{do}` —
because "they was reluctant to mobilise" is the failure one step along, and it
arrives the moment a resident is recorded as they/them. No fixture resident is
today; any real service will have one.

```
he/him     "said his hip was aching. He was settled after and has eaten well."
they/them  "said their hip was aching. They were settled after and have eaten well."
```

Two token errors caught while writing them, both worth keeping in mind:

- `{s}` in "prefer{s}" is not a token and would have rendered literally.
  Rewritten to need no agreement at all.
- `{were}` in "said {their} hip {were} aching" is **wrong** — the subject of
  the verb is "hip", not the pronoun, so it is "was" for everybody including
  they/them. A verb token is only correct where the pronoun is the subject.

### Five residents have unrecorded pronouns

So their generated notes say "they", which is the honest answer: nobody
recorded any, and inferring from a forename is exactly the assumption this
change removes. Emmanuel Okafor is one of them, which is why his pinned note
now reads "Left them and returned an hour later".

### The guard

`fixtures.test.ts` asserts the **outcome**, not the mechanism: no rendered
fixture string disagrees with the resident it is about, across care notes,
handover notes and communication needs — plus one that no token is left
unresolved. That is what stops the next hand-written pool being added the old
way.

A sentence carrying both a masculine and a feminine pronoun is exempt: "Asked
twice today when {their} sister is coming. **She** died in 2019" is about the
resident and somebody else, and no rule can judge it.

**1,988 → 0.**

## Suggestion chips, and the allergies stub

**Chips dropped from the correction dialog**, kept in the composer. The openers
solve a blank-page problem a correction does not have: somebody writing one
already knows exactly what was wrong. The discipline stays in a comment at the
call site — fragments only, never a judgement, because a button that writes
"no concerns" records something nobody observed.

**Allergies got the stub DNAR and the primary contact already had.** The field
§2.1 names as the one a blank cell gets fatally wrong, and the one every
medication screen reads, was the only clinical fact on the profile with no
write affordance at all — not even a phase-tagged one. All three states carry
it now, including `allergies`, which is the most consequential to change.

`ProfileSection.banner` takes the site name, because every confirmation on a
clinical change names the site whose staff would be notified.

493 tests.

---

## The rest of the audit (22/08/2026)

### Repeated strings

| Where | Was | Now |
| --- | --- | --- |
| Handover hatched row | "nobody has looked at this resident this handover" on every row | label only — `LastNoteLine` beneath is what differs |
| Needs, unwritten domain | a sentence naming the care plan *template* | "nothing has been written for this domain" |
| Needs, no content | "nobody has written what this person needs here, or how they want it done" | "nothing written" |
| Superseded / correction pills | two fixed sentences on every note in a chain | label only; the link says the rest |
| Gap marker | "· all of it within waking hours" on nearly every omission | only where the waking and elapsed figures differ |

`PendingLink`'s "(coming in Phase 6)" stays in both the tooltip and the
aria-label. That is one fact in two channels for two audiences, not a repeat.

### One concept, one treatment: never written up

Five renderings, three labels, four different supporting lines. Now
`NeverWrittenUp` — **"Never written up"**, because that is what somebody in a
care home says out loud; "No care note recorded" reads as a systems message and
this is a statement about a person.

No detail line anywhere. Every one it carried restated the label at greater
length, on rows where the same sentence appeared under every hatched cell.

The handover keeps the plain-text variant, per the ruling: that row is already
hatched by "Not reviewed" and a second hatch is noise. Same words, stated
quietly.

A guard reads every feature source through Vite and fails if any of them spells
out its own version. Tests are exempt — asserting on rendered copy is how the
words get checked at all.

### Queue navigation

The note opens **over** the queue. A queue is worked down, and a full page
navigation cost the reader their position, their filter and their scroll on
every note — twelve times for a senior clearing six flags.

`NotePeek` carries everything worth going to the detail screen for: the body in
full, the meta, the shift override, the correction chain, the supervision
record with the wait, and both actions. The full record is still linked,
because a note read beside the resident's own timeline answers a different
question.

The row body is a `<button>` now rather than a `<Link>` — it opens a dialog
rather than navigating, and saying so in the element is what keeps a keyboard
and a screen reader correct about what will happen.

### The two handover confirmations

Both writes were silent. A user could not tell a write that worked from one
that did not.

**The acknowledgement lives on the screen, not in the control** — recording a
status moves the row to another group and signing re-renders the panel, so a
toast owned by either would be destroyed by the action it was confirming. That
is the shape found when the note review lost its toast.

The signature says **what was signed**:

> Handover signed — 22 of 28 reviewed, 6 not looked at
> Those 6 are recorded as not reviewed, not as well. The counts are stored with
> your signature.

A bare "Signed" leaves the user checking whether their record went in as they
meant it, and on this screen what went in is the whole point.

### Copy trims

Eight passages, all the same shape: a fact followed by the argument for it.
The facts stayed, the arguments went. Kept per the earlier ruling: the
residents lede, the clinical panels' "that is not the same as" clauses, and
everything on `/dev/states`, where reasoning *is* the interface.

One assertion moved with them — it matched three clauses of reasoning that are
now one clause. Asserted on the claim rather than the sentence.

498 tests.

---

## Phase 3 step 1 — the MAR day key (22/08/2026)

Built before the grid, not after, because the grid is a lookup by
`(medication, date, round)` and building it on a broken key would bake the
defect in.

`MarRecord.date` was `date.toDateString()` — machine-local, at four sites. A
day boundary taken from the runner rather than the site does not render a
*wrong* cell, it renders **no cell**, and a missing MAR cell is the exact
ambiguity §2.1 opens with. Inert only because both fixture sites are
Europe/London, and inert is not fixed.

Now `IsoDate`, built by `zonedDate(dueAt, siteZone)` — the helper Phase 2 added
for exactly this. Widening the field from `string` to `IsoDate` is what found
every consumer.

Two guards: every record's key equals `zonedDate` of its own due time in its
own site's zone, and the key is a date-only string rather than a locale one
(`'Tue Aug 19 2026'` sorts and compares differently from `'2026-08-19'`, and
the grid does both). A third site in another zone now fails the suite rather
than dropping cells on a screen.

The last `toDateString()` in the codebase is gone.

## Phase 3 step 3 — the MAR chart, read-only

Built to `docs/mar-grid.html`. Structure and argument taken from it; none of
its CSS, none of its literals, none of its placeholder SVG.

**The screen's one fact: these doses have no record against them, and the
window has closed.** The omissions figure is above the grid — a week is 168
cells and all but a handful say "given", so a screen that makes somebody scan
for the holes has buried its own finding. The banner states it, the grid proves
it.

### The five states at grid density

Every distinction is carried by **shape**, with colour reinforcing:

| State | Glyph | Fill |
| --- | --- | --- |
| Not due | none | sunken, hairline — the only genuinely empty cell |
| Due | open ring | info tint |
| Given | tick | positive tint |
| Not given | bar | caution tint — settled, because it is a signed decision |
| No record | none | **hatch** — the only patterned cell in the grid |

Given and not-given differ by glyph, so the pair that matters most stays apart
when hue does not. The hatch appears on exactly one state, so it survives
desaturation by construction (§4.5). The *absence* of a glyph on an omission is
doing work: every closed shape here means somebody acted.

The legend is permanent, above the grid, and its swatches are drawn by the same
`MarCellSwatch` the grid uses — a legend that drifts from the thing it explains
is worse than none.

### The two things asked about

**34px cells at 200% zoom.** They hold, but only in rem. Under text-only zoom a
fixed cell keeps its size while every label around it doubles, so the glyph
shrinks against its own row heading and the grid stops reading as a grid. The
cell is `2.125rem` — exactly 34px at the default root, so the reference's
density is preserved where it was measured — and the container scrolls
sideways, which it already did. Target size clears WCAG 2.2 §2.5.8 (24px) at
either scale.

**An escalated omission needs more than a red border.** It has a glyph now.
Hue does not survive greyscale, and the reference's 5px dot is not reliably
visible at this size. A glyph is the carrier every other distinction in this
grid uses, and it makes the binary legible: no mark, nobody escalated; a mark,
somebody did.

### What conflicted with the rules

**The omissions banner is not hatched.** The reference hatches it. The hatch is
the treatment for the *absence* of a finding (§4.5, §2.3), and a count of
omissions is a finding. This is the same rule that ruled the handover's lead
coverage card unhatched two phases ago — one concept cannot have two answers.
It leads on size, weight and position instead.

**Three omission states, but the type has two.** The reference distinguishes
escalated, "inside the 30–60 minute window", and not escalated. `MarEscalation`
is binary. The recorded fact is what renders; the elapsed time is in the
sentence. A third member is a §9 conversation, not something to invent here.

**Hover was an outline in the reference.** The outline belongs to focus and
must not be imitated by something a pointer causes (§7). Hover is a border
colour.

**Off-scale type.** The reference uses 10px, 11.5px and 12.5px. The scale is
closed at micro/11px, so those became micro or caption.

### Three defects the build surfaced

**The icon scanner reads comments.** It found `<Icon name="…" />` inside my own
docblock and went looking for an icon called "…". Prose in a file that renders
icons must not spell the element out.

**A lookup table of icon names is invisible to the scanner** — deliberately, per
its own docblock: a name assembled elsewhere cannot be traced into the bundle,
so it typechecks and fails at runtime. It did. The glyphs are written at the
call site now.

**The legend's swatches were focusable buttons with empty accessible names**,
hidden from assistive technology while still in the tab order — a violation
either way round. `MarCellSwatch` is a span; the grid keeps the button.

517 tests.

---

## The unreachable screen (22/08/2026)

The MAR chart was written, styled, routed and covered by seventeen passing
tests, and **no user could open it**. The route was registered at
`residents/:residentId/medications`; the profile tab was never added. 517 tests
were green. Every state on the screen rendered correctly to nobody.

Frank found it by looking for the tab after a dev server restart, which is the
only way it could have been found.

### Why nothing caught it

Testing the screen cannot catch this. `mar.test.tsx` renders the route
directly — which is precisely the thing a user cannot do. The seventeen tests
were all correct and all irrelevant to whether anybody could get there.

It is also a different shape from the failures §8 already names. Those are
about a *state* nothing reaches. This is a whole *screen* nothing reaches, and
the existing checks have no purchase on it.

### The guard

`src/app/reachability.test.ts`, reading the real router table rather than a
copy of it, **in both directions**:

- every routed profile screen has a tab pointing at it — the direction that
  caught this;
- every built tab has a route to land on — a tab pointing at nothing is the
  same defect from the other end, and a link that 404s tells a user the product
  is broken.

Parameterised segments are excluded: `notes/:noteId` is opened from a note on
the Care Notes tab, not from the tab strip.

**Both directions were checked against a real failure before being trusted** —
removing the tab fails the first, adding a tab for an unrouted screen fails the
second. A guard nobody has seen fail is a guard nobody should believe.

### Smaller things

`TABS` is exported now, because the guard has to read the same declaration the
component renders from. A test asserting against its own copy of a list proves
only that the copy agrees with itself.

The docblock said "The four profile tabs" over a list of five, and would have
said it over six. It no longer states a count at all — anything needing the
figure derives it from `TABS`. Same class as the hardcoded nav-item count §8
already names.

The sidebar's Medications item stays `enabled: false`. It points at
`/medications`, the cross-resident omissions view, and that route genuinely
does not exist yet — it is step 4. Disabled is the honest state, and the new
guard will cover it the moment it lands.

Added to CLAUDE.md §8 as the seventh standing check.

520 tests.

---

## MAR chart — measurements (22/08/2026)

Built to the numbers. What follows is only where a number could not be taken.

### The container

The omissions banner was a `lead` card — a column-shaped thing that sat in the
left third with two thirds of the screen empty beside it. `AggregateFigure`
gained a `banner` emphasis: full width, horizontal, figure left, label and note
beside it, action right-aligned.

The action is wired: **Show only these** narrows the grid to rows carrying an
omission. It is a filter, so Rule 3c applies — it hides rows, never cells, and
the figure above is unchanged because it counts the whole range either way.

### The legend: five columns, not six

Six fit, but badly. At 1280px the content area is 984px; six columns leave
113px of text apiece and run the longest note to four lines, five leave 144px
and two. Took the specified fallback.

Escalated is not a sixth state anyway — it is the same state with a mark — so
**both swatches sit in the "No record" cell**. A reader can see what the mark
looks like rather than inferring it from a sentence.

A CSS grid with `1fr` columns rather than a wrapping flex row, so nothing can
be orphaned onto a second line at any width.

### Numbers that could not be taken

Type is closed and stylelint rejects any font-size, line-height or font-weight
that is not a token, so these were not choices:

| Asked | Built | Delta |
| --- | --- | --- |
| 30px / 800 figure | `--text-display-size` 32px / 800 | +2px |
| 14px / 700 label | `--text-body-size` 15px / 700 | +1px |
| 12.5px explanation | `--text-caption-size` 12px | −0.5px |
| 11.5px / 400 legend note | `--text-micro-size` 11px / 400 | −0.5px |

12px/700 legend label, 13px/600 medication name, 11px/400 dose and 11px totals
are all exactly on the scale and were taken as given.

Spacing is the 4px scale (§4), so:

| Asked | Built | Delta |
| --- | --- | --- |
| 18px below the banner | `--space-20` | +2px |
| 9px legend swatch gap | `--space-8` | −1px |
| 14px 22px legend padding | `--space-16` / `--space-24` | +2px each |
| 9px 14px medication cell | `--space-8` / `--space-16` | −1px / +2px |
| 2px cell margin | none | see below |
| 5px cell radius | `--radius-sm` 8px | +3px |

**22px horizontal padding became 24px** rather than 20px deliberately: 24 is
the card gutter used by every other card in the product, and matching it is
worth more than the 2px.

**The 2px cell margin is gone rather than rounded.** The row is 3rem and the
button 2.125rem, so it centres on its own — no margin needed, and nothing
off-scale introduced. The measured result is the same shape.

**5px radius has no token.** A radius step is a §9 conversation, so the cell
keeps `--radius-sm`. Flagged rather than added.

Taken exactly, in rem so they hold under text zoom: medication column
15.625rem (250px), totals 8.75rem (140px), cell 2.125rem (34px), swatch
1.375rem (22px), row 3rem, detail 4.625rem (74px).

### The table

`width: 100%` with `table-layout: auto` and a `min-width` on the round columns,
rather than `fixed`. Fixed would shrink a month's 112 columns into unreadable
slivers instead of letting the container scroll, and the container scrolling is
the reason it has its own overflow.

### The fixture: not a defaulting problem

The banner reads 0 for whichever resident was open, and that is not something a
default can fix — **31 of the 32 residents have no omissions at all.** Only
Emmanuel Okafor does, and only because §5.3 gap 4 pins three onto him by hand.
The generator produces none.

So `omitted` is reachable on one resident in thirty-two, which makes the state
this whole module exists for effectively unreviewable, and makes the MAR chart
read as a screen about nothing for 97% of the people in the home.

That is the "fixtures may be wrong on the facts" check (§8), not thinness: a
90-day medication record across 32 residents with three missed doses in total
is not a careful home, it is a home that does not exist. **Not changed** —
adding gaps is a fixture change and a §9 decision, and manufacturing omissions
unilaterally is the same crime as tidying them away.

520 tests.

---

## Phase 3 step 4 — the omissions view (22/08/2026)

`/medications`. **These doses were missed across the home, and this is how long
ago.**

### The fixture, first

Built before the screen, because a layout reviewed at n=3 is not reviewed.

**1% of due doses have no record**, approved after the options were costed
against the resulting queue length. Gated on `roll`, which was already drawn —
no new call into the RNG, so the stream is bit-for-bit what it was and nothing
else moved. Escalation is **derived**, not drawn, for the same reason: a dose
missed more than a day ago has been noticed; one missed this morning may not
have been.

Measured, not forecast: **180 of 16,200 (1.11%)**, giving **20 rows across 13
of 32 residents** in the seven-day window, 17 of them escalated.

The escalation split is lopsided and that is right. In a seven-day window most
omissions are over a day old, so most have been raised. The three that have not
are the recent ones — which makes "Not escalated" the tab that needs somebody,
not the leftovers.

### §5.3 gap 4, re-derived

The guard asserted *exactly three omissions in the whole fixture set*. That was
checking a property of the home in order to protect a property of a fixture: it
passed for months, protected nothing, and stood in the way of a legitimate
change.

It now holds the three pinned records **by reference** — `SPECIFIED_OMISSIONS`,
collected as they are pinned — plus that they are still in the set the screens
read from. A second guard bounds the rate between 0.5% and 2%, because a rate
that fills the queue is the same failure as one that empties it.

Added to CLAUDE.md §8 as the eighth standing check.

### The screen

Four columns, the care-notes queue's shape exactly: subject · state · dose ·
action. Every row leads with its resident, and `getOmissions` joins dose, drug
and person in one read — two reads settling separately could render a row
naming a medication and a time with nobody attached to it, which on a
cross-resident medication screen is the wrong-subject failure with a dosage on
it. A record whose resident cannot be resolved is dropped rather than rendered
subjectless; that is the one case where dropping is right.

Oldest first. The denominator is **doses due**, never residents.

### `Unrecorded` gained an optional icon

Decorative and additive, `aria-hidden`, no default — every hatch already in the
product renders exactly as it did. The label still says "escalated" in words;
the mark exists so a gap already marked on the MAR grid keeps the same mark
when it appears in a list.

### Two defects the render surfaced

**The chip read "missed 167 hours ago".** The measurements say "missed 3 days
ago", and 167 hours is arithmetic a reader has to do before they can rank
anything — which is the entire job of that figure. `coarseWait` gained a day
tier above 48 hours. Below that the hour is still the useful unit: the
difference between 6 and 18 matters and "0 days" does not.

That rippled, as predicted: the care-notes queue chip now reads "waiting 3
days" rather than "waiting 79 hours", which was flagged as bad when the
supervision record was built and is better for the same reason.

**The banner read `1219` while the result line read `1,219`.** `formatCount`
was added for the care-notes feed and deliberately not pushed into
`AggregateFigure`, on the grounds that every figure reaching it was under a
thousand. One reached it. Every figure and every denominator in
`AggregateFigure` goes through it now, so a thousand reads the same everywhere.

### Reachability, both halves

The sidebar item is enabled, and the guard extended to cover it — an enabled
item must have a route, and **a route must not sit behind a disabled item**.
The second direction is the one that was about to bite: `Medications` was
correctly disabled while its route did not exist, and nothing would have told
anybody to flip it when the route landed.

Both directions were checked against a real failure before being trusted.

536 tests.

---

## Omissions view — five fixes (22/08/2026)

**1 and 2. The banner and the result line said the same sentence twice**, and
the banner's note was reassurance on a screen whose job is finding gaps. The
count lives on the banner; the result line carries the ordering, which is what
makes the list mean anything. The note is deleted.

**3. The chip and the meta line both said "escalated".** The chip says whether;
the meta says when, and nothing at all when there is nothing to say — an
unescalated row now ends after "controlled drug" rather than carrying a phrase
that repeats the chip.

The escalated form reads `raised 21:07 BST`. Dropping the word entirely left a
bare second time on a line that already has the due time, which is worse than
the duplication was. One word, and it is not the chip's word.

**4. The figure follows the filter, and its caption says which.** A count of 20
above a list of 3 is a claim about a set the reader is not looking at — Rule 3c
in its most direct form. Narrowing the list narrows the claim:

```
All            20 doses with no record, across 1,219 doses due this week
Not escalated   3 doses with no record and not yet escalated, across 1,219 …
```

The week's total does not disappear; it moves to the result line while a filter
is active — `Oldest first · 20 with no record this week in total` — so the
smaller number is never a surprise. On the All tab there is nothing to explain
and the line is just the ordering.

**5. The chip leads with when the dose was due.** `20:00, 15/08 · missed 7 days
ago`. "missed 6 days ago" repeated on six consecutive rows, so the key the list
is sorted by was the one thing a reader could not see, and 15/08 20:00 and
16/08 08:00 read identically. Short form because it is being scanned; the full
date stays on the meta line.

### Two assertions I got wrong before the code

Both worth keeping, because both were the test being stricter than the rule.

**"Every chip detail is unique" fails at 14 of 20**, and correctly: two
residents can miss the same round on the same day, and the resident column is
what separates those rows. The property that actually matters is *resolution* —
more distinct chips than the days-ago figure could produce alone — and that is
what it asserts now.

**`/\b3\b/` did not match "3doses".** A digit followed by a letter is not a word
boundary. The value and the caption are adjacent spans with a flex gap, so the
screen is spaced and `textContent` is not. Asserted on the figure's own element
instead, which is what the claim was about.

538 tests.

---

## Phase 3 · Step 5 — the administration flow (`/medications/round`)

Built to `docs/administration-flow.html`. The sentence: **these doses are due
now, for this person, and you are about to sign for them.**

### The module now has two screens, so it has a layout route

`/medications` became a layout route with `index` (Omissions) and `round`.
Title and a tab strip live in the layout; each screen supplies its own content
beneath. This is the profile's shape, for the profile's reason.

`ScreenTabs` and `ScreenTabs.module.css` are new, and `profile.module.css` now
`composes` its four tab rules from that file. There is one definition of the
strip's height, underline and active colour rather than two that would have
drifted apart at the first change — the audit's "one concept, two treatments"
category, caught before it happened rather than after.

`reachability.test.ts` gained the same bidirectional check it has for profile
tabs, and it was proved to fail on the real defect in both directions before it
was trusted: delete the tab and it names `round` as unopenable; delete the route
and it names `round` as a dead link.

### Three defects the green tests did not find

Found by dumping the rendered screen and reading it, the practice that has now
caught something on every screen it has been used on.

**1. A dose already signed for rendered as unanswered.** Emmanuel Okafor's
08:00 round yesterday has Lansoprazole given by F. Adebayo at 08:25 and
Amlodipine given by Y. Ibrahim at 08:21, with only the morphine omitted. The
screen showed all three with empty Given / Not given buttons and the hatched
"Nothing recorded for this dose yet". Two failures in one: it invited a second
signature over somebody else's, and it rendered **a complete record as a gap**,
which is the Evidence Invariant read backwards.

A settled dose now shows the record and no buttons, using `MarCell` — the MAR
chart's own treatment rather than a second one written here, so a given dose
looks the same wherever it is read and a controlled drug given without its
second signature still arrives as two facts. `outstanding()` skips settled
doses, and `submit()` never includes one.

**2. "3 due · nothing recorded yet" was a hardcoded string.** False for every
resident with two doses signed and one omitted — the commonest shape there is,
and the shape this screen exists to surface. Derived now, three forms:
`Recorded`, `n due · nothing recorded yet`, `n of m recorded`. The test asserts
the form and that `Recorded` agrees with `data-done`, rather than matching the
literal (§8).

**3. The confirmation and the footer both counted the wrong thing.**
`ConfirmBody` listed all three doses and labelled each from this session's
answers, so a dose given by F. Adebayo appeared as **Not given**. The footer
said "All 3 doses have an answer" over a signature that records one. Both now
count what the signature covers: the dialog lists only the open doses and says
"2 further doses at this round are already on the record and not signed again
here"; the footer reads "The 1 dose still open has an answer."

### `recordRound` was making a claim it did not enforce

Its docblock said it refused an unanswered dose. It did not — an unanswered
dose simply never reached it, so a caller that omitted one would have recorded
a complete-looking round that was missing a dose, and the MAR grid would have
shown that dose as an omission with nobody's name on it.

It now derives the expected set itself, from `patchedRecords()` and
`medicationsFor()` — the same derivation `buildRound` makes, so the two cannot
disagree — and refuses a short round by name. §8: a comment claiming a guarantee
is a claim to verify.

### Where the reference and the rules disagreed

The rules won; every substitution is named at the declaration it appears in.

| Reference | Built | Why |
| --- | --- | --- |
| Round time `30px/800` | `--text-display` (32/800) | Closed type scale; display is the step for one figure leading a page |
| Drug name `16px/700` | `--text-h3` (17) | Scale steps 15 → 17; the drug is the row's subject |
| Queue title `14px/700` | `--text-body-sm` (13) | No 14 step |
| `11.5px` / `12.5px` / `13.5px` | micro / caption / body-sm | No half steps |
| Preferred name `22px/700` | `--text-h2` (20) | Frank's decision, taken earlier in the phase |
| Avatar `56px` | `large` (64) | Scale has 48 and 64; a wrong-subject control errs upward |
| Spacings `18/14/11/10/9/7/6/2px` | nearest 4px step | CLAUDE.md §4 |
| Column gap `18px` | `--space-20` | Matches the page's own rhythm |
| Room column `38px` | `--space-40` | Nearest step |

Kept off the scale, each with a comment saying why it is a graphic dimension
rather than spacing: the `1.5px` answer-button border, the `2px` dashed pending
mark, the `3px` inset rule on the current queue item, and the `6px` progress
track. Its width is `224px` rather than `220px`.

The reference's fourth round-bar block is a "window closes · 47 minutes left"
countdown. Replaced with the round selector Frank asked for: a countdown against
a window this build does not model would be an invented deadline, and every slot
carries `{done} of {total}` so choosing a round does not mean walking a corridor
to find out whether anybody has been round it.

### The stock count no longer says what it should come to

Frank's call, against his own reference: drop the placeholder.

> A stock count is an independent check on the record. Showing the expected
> figure turns it into a confirmation prompt — a tired nurse at the end of a
> round reads 27, types 27, and the mismatch guard can never fire because it is
> checking a number the screen supplied. The case the count exists to catch is
> exactly the case where the placeholder makes it likelier the discrepancy gets
> typed over.

`was 28` stays: counting a delta needs the starting point, and the starting
point is on the register anyway. What is withheld is the arithmetic, which is
the whole check. The reconciliation message still names the expected figure,
but only *after* a number that does not reconcile has been entered — that is
the guard firing, not a prompt.

The test asserts the property rather than the markup: the field is empty, it
has no placeholder, `expected` appears nowhere in the row, and `stockBefore`
still does. Proved to fail with the placeholder restored.

### How defect 1 survived twenty green tests

Worth stating plainly, because it is a new shape and it will recur.

Every test rendered **the round**. None rendered **the round as somebody else
had left it.** The screen was exercised from a starting position it almost never
occupies in real use: a resident with nothing recorded against them at all. A
morning round is worked by more than one person, so the ordinary state of any
resident on it is *part-recorded* — and every assertion about answering doses,
blocking submission and signing was written against the one state where that
distinction does not exist.

It is the same family as "every state a component can render needs a fixture
that reaches it", but a step out from it: the state that had no fixture was not
a state of a component, it was **a state of the record the screen is editing**.
`data-settled` exists now so a test can find those rows, and three tests assert
on them — but the durable lesson is the question, which is not "does this render
every state" but *"what has already happened to this record before somebody
opens this screen"*.

On this screen both halves of getting it wrong are the failure the build exists
to prevent: a signature over somebody else's name, and a complete record
rendering as a gap.

### Still open

- `Nothing is due at {roundTime}` has no fixture that reaches it. Every slot in
  the fixture set has at least one resident.
- The write-refused error line has no fixture that reaches it either — it is
  the server-side guard firing where the button already stopped you, which is
  the state it exists for.
- The round has no link out to a resident's MAR chart. Deliberate for now: a
  link out mid-round is navigation that leaves a task, which the audit named.

575 tests, 21 of them on the round.

---

## Phase 3 · Step 6 — the register, part one: the balance

The register screen waits for its reference. What did not wait is the defect
underneath it, which was live on a shipped screen.

### `?? 0` reported a balance of zero for fifteen controlled drugs in sixteen

The round derived the standing balance as `counts[counts.length - 1]?.counted
?? 0`. Sixteen controlled drugs across sixteen residents; one had a stock
count. So fifteen of them rendered `Stock after — was 0`, and the
reconciliation guard demanded a count of −1, which no count can equal.

**Those doses could not be recorded at all.** A dead end reached by a
fallback — the exact construction CLAUDE.md §1 names, producing a wrong
clinical figure and, downstream of it, a screen that silently refused to let
anybody give a controlled drug.

`StockBalance` is now a closed union in `state.ts`:

```ts
export type StockBalance =
  | { kind: 'no_balance_recorded' }
  | { kind: 'counted'; value: number; countedAt: IsoDateTime; countedBy: StaffRef }
```

Frank's framing, kept because it is the whole point: *a balance nobody has
recorded is not zero.* It is not a smaller number and it is not a safer one.
`outstanding()` and `DoseRow` take the union and handle both members, so a
count cannot fail to reconcile against a balance nobody has taken — a count is
still required, and it cannot be wrong. Two unit tests hold that, one of them
sweeping 0, 10, 11 and 99 against an uncounted drug.

### The register baseline was wrong on the facts

A register holding a balance for one drug in sixteen is not a home with patchy
records; it is a home that does not exist. Same class as the note-volume
baseline, same correction. Every controlled drug now carries two reconciling
counts, an older one and a recent one, so a register screen has a movement to
show rather than a single row — 32 counts across 16 drugs.

**Okafor's morphine discrepancy is untouched**: still 30 expected, 28 counted,
still the only one in the set. Gap 5 in `fixtures.test.ts` gained two
neighbours — `5b` asserts no controlled drug is without a balance, `5c` pins
the discrepancy by identity and bounds the rate below 10%, which is the split
§8 arrived at for the omissions. Both were proved to fail with the generation
removed: `5b` names all fifteen.

### Waiting on one decision

`no_balance_recorded` has **no fixture that reaches it**, and that is
deliberate for exactly as long as this note is here. It lands with the
opening-count flow and the newly-prescribed drug that reaches it — one
controlled drug started recently, before anybody counted it, which is the
honest fixture for the state Frank described and the reading that makes both
instructions true at once.

The flow itself needs a `StockCount` shape change, which is §9: an opening
count has two signatures and no expected figure, because there is nothing yet
to expect. Asked, not taken.

580 tests.

---

## Phase 3 · Step 6 — the register, part two: the opening count

Both approvals in. The register screen still waits for its reference; the
record behind it is built.

### `StockCount` now carries two signatures and an entry kind

```ts
export interface StockCount {
  medicationId: MedicationId
  countedAt: IsoDateTime
  countedBy: StaffRef
  witnessedBy: StaffRef
  entry: { kind: 'opening' } | { kind: 'routine'; expected: number }
  counted: number
}
```

`expected` moved inside the union rather than becoming optional. A routine
count with no expected figure cannot be constructed, and an opening count
carrying one cannot either — which is the whole distinction, held by the
compiler instead of by review. Before this, the first count of a drug's life
had to invent a figure to compare itself against, and any figure it invented
would have made that count either a false discrepancy or a false
reconciliation.

`hasStockDiscrepancy` narrows on the union: **an opening count can never be a
discrepancy.** There is nothing for it to differ from, and calling the first
count of a drug's life a discrepancy would report a loss on a cabinet nobody
had counted before.

### The fixture that reaches `no_balance_recorded`

One controlled drug — oxycodone oral solution, prescribed to Grace Adeyemi five
days ago, never counted. Without it the union's second member renders to
nobody and the flow exists only in a test, which is §8's first standing check.

`PRESCRIBED_DAYS_AGO` is a local map in the generator rather than a field on
`Medication`: one drug needs a start date and a whole type does not change for
it. A MAR record dated before a drug was prescribed would be a dose nobody
could have been due, so its history starts where the prescription does — 12
records, not 90 days of them.

**Okafor's morphine is still the only discrepancy.** The two are different
findings and the register must not let them be read as one: *one drug nobody
has counted* and *one drug whose count does not come out* are not degrees of
the same thing.

Gap 5 in `fixtures.test.ts` now has four neighbours. `5b` holds the
never-counted drug **by reference** rather than loosening to a number — the
correction §8 arrived at for the omissions, applied the first time rather than
the second. `5d` pins the drug and asserts it is not the discrepancy. `5e`
walks every count and refuses one signed twice by the same person.

### One count, not two

The round asks a drug with no balance for an **opening count**, not a stock
after. The cabinet is counted once, that count is the opening balance, and the
figure after the dose is arithmetic. Asking for both would be asking somebody
to count the same cabinet twice and then marking their subtraction.

The witness already required for a controlled drug signs both — same two
people, same moment — and the field label says so rather than leaving it to be
assumed.

`outstanding()` distinguishes the two: `— no opening count`, never `— no stock
count`. There is no stock count to be short of; what is missing is the first
one.

### Nothing is blocked, and the write refuses anyway

Administration is never held up by an incomplete register. What the round will
not do is sign a controlled drug into a register that has no balance *without
recording where the balance started* — refused in `recordRound`, not only
disabled on the button, and proved to fail with the refusal removed.

`recordOpeningCount` refuses a count signed twice by the same person, and
refuses a second opening balance once a drug has one: that would move where the
running total started and silently absorb whatever went missing between the
two.

Session counts live in `mar-store` on the same overlay discipline as the
administrations, and `balanceWithSession` is what the app reads — so an opening
balance recorded a minute ago is what the next dose reconciles against, rather
than the round asking for a second opening count on the same drug.

597 tests.

---

## Phase 3 · Step 6 — the controlled drug register

Built to `docs/cd-register.html`. Two screens: `/medications/register` and
`/medications/register/:medicationId`, a third tab in the module strip. The
reachability guard covers the tab; the ledger is reached from a row, the way a
note detail is reached from a timeline.

### The three arguments, and the guards that hold them

Each was broken deliberately to check the test fails on the real defect.

**1. Two findings, never one card and never a sum.** A drug nobody has counted
takes the hatch; a count that does not come out takes critical. Adding them
would make a number nobody can act on — one needs a first count, the other
needs an investigation. Both cards carry the denominator: *of 18 controlled
drugs at Rosewood Court*. Give the two cards the same class and
`renders them as separate cards with separate treatments` fails.

**2. Balance is the rightmost figure.** Date · entry · change · **balance
after** · signatures, so the eye runs down the running total without crossing
another number. Rename the header and
`puts the balance in the rightmost figure column` fails.

**3. No balance is the hatch, never a zero and never a dash.** The defect from
step 5, made visible instead of papered over. And a drug with no entries
renders **no table at all** — headers over an empty body would say the register
exists and happens to be empty, when it was never opened. Render the table
anyway and three tests fail.

### What the register needed that the fixtures did not hold

Four shapes, all approved before building:

| Added | Why |
| --- | --- |
| `Medication.stockUnit` | A balance of 28 that could be millilitres or tablets is a wrong clinical figure. On the drug, not the count — a count records what was found; the unit is a property of the thing counted. |
| `Medication.form` | The list row's second line: `10mg/5ml · oral solution`. |
| `Medication.doseQuantity` | The register's Change column needs a number. `'2.5mg'`, `'2 puffs'` and `'1g'` cannot be parsed into one without inventing it. |
| `RegisterMovement` | Received from pharmacy, disposed. Without them the balance column is arithmetic nobody can follow. |

### A defect `doseQuantity` exposed the moment it existed

The round reconciled a controlled drug against `balance - 1`. Morphine oral
solution is counted in millilitres and a 2.5mg dose is **1.25ml** of it, so the
round demanded a count 0.25ml wrong and refused the correct one. It was
invisible while every drug was implicitly one-of-something; the fix is
`expectedAfter(balance, medication)`, and the round's stock label now carries
the unit too.

The round tests had to change with it, which is the tell: `before - 1` was
asserting the same wrong arithmetic the code did. They read the dose quantity
off the fixture now.

Two incidental fixes from the same pass: `fireEvent.change` rather than
`user.type` for a decimal count, because a number input drops the partial value
`"95."` mid-keystroke and lands `955`; and `1 tablets` is not a clinical figure,
so a quantity of one loses the plural.

### The register is simulated forward, not sprinkled

Entries are generated from an opening count and walked: every administration
takes `doseQuantity` off, every delivery puts a pack on, a disposal takes a
patch out, and a routine count's **expected** figure is the balance the
register had reached at that moment. Counts invented independently of the doses
would have made every drug read as a discrepancy or none — and neither would
mean anything.

`buildRegister` computes oldest-first, because that is the only direction the
arithmetic runs, and reverses for display. `register.test.tsx` walks the whole
84-entry ledger and checks each `balanceAfter` against the running total.

**Okafor's morphine is still the only discrepancy** — now 98.75ml expected
against 96.75ml counted, 2ml unaccounted for, coherent with the movements above
it. **Grace's oxycodone is still the only never-counted drug.** The two
findings stay apart in the data as well as on screen.

Two new drugs, both reconciled, both in new units: Arthur Pemberton's oxycodone
modified release (tablets) and Doris Kavanagh's fentanyl patch (patches). A
column whose every value is `ml` cannot demonstrate the thing the unit
prevents.

### Two things left visible rather than papered over

- **The fentanyl patch is administered daily and a real one is changed every
  third day.** `Medication` has no schedule interval — `roundTimes` are times
  of day and every drug runs every day — so a three-day cycle is not
  expressible. The fixture says so at the declaration rather than carrying a
  comment that claims otherwise. An interval on `Medication` is what fixes it.
- **Sixteen of the eighteen controlled drugs at Rosewood are morphine oral
  solution**, because the shared drug pool has one controlled drug in it. Not
  wrong — oral morphine is the common one — but the register reads repetitively,
  and the two other forms are what make the unit column do any work.

619 tests.

---

## Phase 3 · Step 6b — the dosing interval, and a less monotonous cabinet

### `Medication.intervalDays`

Minimal, as asked: days between doses, `1` everywhere except the patches.
Nothing existing changed shape or moved.

A fentanyl patch was being administered daily, which is not a thin fixture but
a **clinically wrong record** — a patch is changed every third day and one a day
would be an overdose. The same class as the pronoun defect and the note-volume
baseline.

**And it gives `not_due` something real to say.** The days between doses are not
left off the chart; they carry a cell that says `not_due`. A day left off would
be a hole, and a hole is the one thing the chart must never render — nobody
missed that dose, because there was no dose. `not_due` previously only marked
rounds a drug does not run at; it now also marks days a drug does not run on.

Which surfaced a defect the moment the state existed: `buildRound` pushed every
record it found into the due list, so a `not_due` cell would have put a fentanyl
patch on the trolley two days out of three and demanded an answer for it.

Fentanyl's ninety days now read 28 given · 60 not due · 2 not given.

### Six residents swapped, not six more prescriptions

First attempt dropped three new controlled drugs into the shared pool. That took
the share of the home on a controlled drug from a bit over half to **nearly four
fifths**, and buprenorphine outnumbered oral morphine — wrong on the facts in
the other direction, and the same error being fixed, mirrored.

So it is a **swap**: six residents already on oral morphine take one of the
other forms instead, Okafor excluded because his morphine carries the pinned
discrepancy. The count of residents on a controlled drug is exactly where it
was; only what they are on has changed.

Rosewood now holds 18 controlled drugs across six forms and three units — 11
`ml`, 4 `tablets`, 3 `patches` — with oral morphine still the commonest at 10.
One discrepancy, one never counted, both untouched.

Three new fixture guards, each proved to fail on the real defect: `5f` refuses
a patch given daily, `5g` requires the days between to be `not_due` and bounds
the share at roughly two in three, `5h` refuses a cabinet where one drug is
three quarters of it *or* where three quarters of the home is on one.

### A test that was resting on a fixture accident

Three PRN tests broke when the pool shifted — they assumed the resident the
round opens on happened to have a PRN medication. That is testing the draw, not
the rule. They walk the queue for a resident with one now.

One of them could not be salvaged as written: at the pinned instant exactly one
resident has an unanswered dose and no PRN, so "an unanswered PRN does not hold
up the round" had nothing to render. Rewritten to the property that holds in
every state — for any resident with a PRN, the footer's waiting list never names
it — rather than contriving a fixture to reach the original phrasing.

623 tests. Next: step 7, medication setup.

---

## Phase 3 · Step 7 — prescriptions

Built to `docs/medication-setup.html`. A sub-tab on the resident's Medications
tab: **Chart** and **Prescriptions**. The chart is what was recorded; this is
what was prescribed and what following it costs.

### The finding that came before the screen

The reference's critical case is a PRN with no 24-hour maximum. Checking the
fixtures for one turned up something worse: **there was no such field.** Every
one of the 23 PRN medications was in that state and the type could not say so.

So the block would have fired on **every PRN in the home** and read as the
default. Frank's framing, kept because it is the sharpest statement of the
volume problem in the file:

> A gap that fires on everything is indistinguishable from a screen that always
> looks like that — the one where the alarm is right and nobody can act on it.

Six fields were missing altogether, all approved before building:
`maximumIn24Hours`, `prescriber`, `startedOn`, `storage`, `instructions`,
`prescriptionDocument`.

`maximumIn24Hours` is a three-member union and the third member is the point:

```ts
| { kind: 'not_applicable' }              // scheduled — the schedule is the limit
| { kind: 'recorded'; quantity: number }  // in stockUnit
| { kind: 'not_recorded' }                // the check that cannot run
```

`not_applicable` is a **claim**, not an absence — it says this drug is given at
fixed times and there is no separate ceiling. Present on every medication
rather than absent for scheduled ones, so giving a scheduled drug its own
ceiling later needs no change to the union.

Counted in `stockUnit`, because that is the only unit an administered dose can
be checked against. "4g" reads better and can be checked against nothing.

**Exactly one PRN is missing its maximum**, pinned by identity, same reasoning
as one discrepancy and one never-counted drug: the block has a fixture reaching
it and stays a finding rather than becoming the norm. Break it — flip
`unenforceable` to false — and three tests fail.

### The requirements are derived, never stored

`requirementsFor(medication)` reads the prescription. Change a drug to a
controlled one and the second signature appears, because it was never a
sentence somebody remembered to write. A test asserts exactly that: the
controlled drug requires two signatures, the ordinary one does not, the patch
requires a rotated site and says the days between are the schedule rather than
a missed dose.

### `startedOn` paid for itself

Required and plain, so `PRESCRIBED_DAYS_AGO` — a local map that existed for one
drug — is gone, and both generators read the start date off the medication.
A MAR record dated before a drug was prescribed is now impossible by
construction rather than by a lookup somebody has to remember.

### Defects found by dumping the screen

- **"1 capsules measured".** The plural bug from the register, written again
  from scratch on a different card. One `quantityWithUnit` now, in `units.ts`,
  used by both — a clinical quantity is small enough to get wrong everywhere it
  is hand-written.
- **"08:00 and 14:00 and 20:00"** — what a template produces, not what a person
  writes. `joinTimes` gives the final "and" a comma before it.
- **"2 puffs · 2 puffs measured".** The measured note exists to give a quantity
  that differs from how the dose reads; where they are the same it says one
  thing twice.
- A Rosewood resident prescribed by the Ashgrove surgery. Dropped from the
  general prescriber pool.

### Four clock-dependent tests, found by the date rolling over mid-session

Not caused by this work — the date changed to 23/08 at midnight and four tests
went red that had been green all day. §8 exactly.

Three assert on `/care-notes`' today-only feed, which in the small hours holds
almost nothing; they are pinned to the middle of the previous day now. The
fourth asserts an omission names waking hours, which is only true where the gap
overlaps the waking window — at 04:42 the newest gap lay entirely inside the
night, so the screen was right and the assertion was wrong. Pinned to the
afternoon, with the reason at the test.

### One thing to decide

The sub-tabs take the **same pill treatment as the omissions filter** — the
reference's measurements are identical to `.filterTab`, so it composes from
that one definition rather than being copied. But it means a pill is
*navigation* on the profile and a *filter* on `/medications`, which is the
audit's "two controls that look alike and mean different things". They are on
different screens so they never appear together. Worth a look by eye: the
alternative is the underline strip the profile tabs and the Medications module
already use, which would keep pill = filter throughout.

644 tests. Next: step 8, the MAR PDF export stub.

---

## Phase 3 · Step 7b — one treatment per concept, one function per rule

### The sub-tabs take the underline, not the pill

Frank's call, against his own reference:

> The pill is doing two jobs the moment it appears in both places — navigation
> on the profile, filter on `/medications`. "Never on the same screen" is a
> weaker guarantee than it sounds. A reader learns the shape, not the screen it
> was on.

So pill means filter and underline means navigation, which is what the
profile's own tab strip and the Medications module already say. The sub-tabs
use `ScreenTabs`, and the pill classes the reference asked for are deleted
rather than left unused.

Worth naming the shape, because the audit only had it one way round: **two
concepts in one treatment** is the same defect as one concept in two, arrived
at from the other side.

### The plural bug had already happened a third time

The sweep Frank asked for found it before it shipped. Six places where a
figure met a unit at the call site:

- `DoseRow` — the round's stock label and its reconciliation message
- `RegisterRoute` — the balance column and the discrepancy chip
- `RegisterLedgerRoute` — the ledger header and the discrepancy note

All five rendered `28 ml` where a volume is written `28ml`, and any balance of
one patch would have read `1 patches`. And in `ReviewBadge` and
`DomainStatusBadge`, `${days} day${days === 1 ? '' : 's'}` written out twice by
two different routes — a care plan review's overdue figure, agreed at the call
site in two independently written files.

None of them is a typo. It is what happens when a clinical figure is formatted
where it is displayed instead of by a function that owns the rule.

Two owners now, and they own different problems:

- `quantityWithUnit(quantity, unit)` / `unitFor(quantity, unit)` in `units.ts`
  — a unit of stock. `unitFor` exists because the register *stacks* the figure
  over its unit, so the inline form cannot be used there while the agreement
  rule is identical.
- `pluralise(count, singular)` in `format.ts` — a plain count. Deriving
  "tablet" from "tablets" is a different problem from choosing between two
  words that were both given, so they stay separate.

`formatDuration` already owned its own agreement and now expresses it through
`pluralise`.

### `scripts/check-plurals.mjs`

The reason for a build check rather than a note: **the second occurrence proved
there would be a third, and there was.** It fails on the two shapes that can be
detected —

```
`${n} thing${n === 1 ? '' : 's'}`     →  pluralise(n, 'thing')
`${n} day(s)`                         →  pluralise(n, 'day')
```

— and it caught two more in `FixtureAudit` on its first run. Proved to fail on
the real defect by putting the ternary back into `ReviewBadge`. Wired into
`npm run lint`.

It is a net, not a proof: a bare `${quantity} ${unit}` is indistinguishable
from prose and cannot be caught statically. Three tests cover what the script
cannot — that no balance renders as `28 ml`, that no figure renders as
`1 tablets`, and that `unitFor` and `pluralise` agree at one.

647 tests. Next: step 8, the MAR PDF export stub.

---

## Phase 3 · Step 8 — the MAR PDF export stub

PRD §6.4: the button is present and never a silent no-op. It sits beside the
range control, because the range is what it would export — an export button
elsewhere on the page would be a claim about the whole record.

Enabled rather than disabled, and the difference matters. Add-resident is a
capability nobody has yet; this is one the build deferred, and pressing it has
something to tell you.

**It says what it would produce, not only that it cannot.** Frank's line, and
the part that survives the stub:

> A disabled control that does not say what it does is a control nobody can
> plan around.

So the dialog names the contents: this resident's chart for the range on screen
(`Week of 17/08 to 23/08`), 4 medications down the page and 3 rounds a day
across 7 days — 84 cells; every cell in the state the chart shows it in, never
a blank; author and time on every recorded dose and the second signature on
every controlled drug, or the fact that it was never captured. And that it is
the chart rather than a summary of it — nothing aggregated away, no gap closed
by the export.

A manager deciding whether an inspector's request can be met can act on that.
"Not available" alone tells them nothing.

Both halves are guarded, each proved against the real defect: make the button a
no-op and six tests fail; keep the refusal but drop the contents and four fail.
One of them opens the dialog on a week and again on a month, because a stub
describing a fixed month while the reader is looking at a week is a claim about
a document nobody asked for.

### A wrong label on a clinical timestamp, found by dumping the dialog

The chart's facts line read `times in {activeSite.name}'s zone` while the
profile renders its times in **`profile.site`'s** zone — the resident's own
site, as that field's own docblock says. A manager looking at a resident from
another site would have read one site's name over another site's clock.

§6 treats a timestamp in the wrong zone as a wrong timestamp; a timestamp
labelled with the wrong zone is the same defect wearing the right clock. Both
the chart and the export dialog name `site.name` now, and a test renders a
resident from the non-default site and fails on the old code.

Also from the dump: *"Times in Emmanuel's site timezone"*. A timezone belongs
to a site, not to a person.

### Pinning by default, not after a failure

The wall-clock entry in §8 has now caught the same class of thing three times —
the flagged-note ordering, the profile timeline's open gap, and this session's
four tests that went red when the date rolled to 23/08 at midnight having been
green all the previous day.

Three is the argument for **pinning by default**: any test whose result is
derived from *now* — an open gap, an elapsed duration, a "today only" feed, a
waking-hours figure — gets a pinned instant and a sentence saying why, at the
time it is written rather than the first time it fails. The cost is one line;
the failure mode is a suite that is green when you run it and red for whoever
runs it next, which reads as flakiness and gets retried rather than read.

656 tests. Phase 3 is complete: MAR chart, omissions, administration flow,
controlled drug register, prescriptions, export stub.

---

## Phase 4 · Data layer — incidents

Types, fixtures and reads. No screens; the three references are being built.

### The unions

`INCIDENT_TYPES` — twelve, closed, **no "other"**. Frank's reasoning, kept
because it is the general case: a type nobody can name is a type the filter
cannot work on, and "other" becomes the bucket everything lands in.

`INCIDENT_SEVERITIES` — the NHS harm scale, four tiers. **Death is not a
tier**: it is its own notification obligation, and grading a death on a harm
scale says the wrong thing about what has to happen next.

`IncidentStatus` — four members, each later one carrying the facts of the
earlier ones, so an incident cannot be under review without an acknowledgement
to point at. The compiler holds the order of events.

`NotificationDecision` — four, and the third is the point:
`required_not_yet_notified` is a **duty somebody accepted and did not
discharge**, which is different from and worse than one nobody decided. Same
shape as a PRN with no 24-hour maximum: not missing data, an obligation with no
evidence behind it.

`InjuryMap` — three members rather than an array, because an empty array cannot
tell "the reporter looked and found nothing" from "nobody looked". On an
unwitnessed fall that is the whole difference.

`PostIncidentReviewFlag` lives on the **incident**, and overdue is **derived**
from `dueBy`, never stored. A stored "overdue" is true when written and wrong
the next morning. (`ReviewState` stores `daysOverdue` and gets away with it only
because its fixtures are regenerated against `NOW`; a flag raised during a
session would not be. Noted rather than changed.)

`ManagerReview` fields are each `Recorded<string>`. **A closed incident with no
root cause recorded is a real state in a real home**, and making the fields
mandatory would force the fixtures to invent one for every incident — hiding
exactly what the review screen exists to surface.

### The mismatch no longer blocks the round

Frank's call, option (b). The doses record with their signatures, the count
records what was actually counted, and the discrepancy raises an incident
against the count alone:

> You do not withhold morphine from somebody in pain because the cabinet
> arithmetic is wrong.

Blocking converted an accounting problem into a medication-record gap with
nobody's name on it — the worse of the two failures and the one the product
exists to prevent. Blocking stays only where there is **no balance at all**,
because there the opening count is what makes the record possible rather than
what delays it.

`discrepancyIn(answer, medication, balance)` returns what the round raises
instead of what it refuses. The old assertion said the opposite; it was not
loosened but re-derived, and the reason is at the test (§8).

### Four states rendered to nobody, before a screen existed

The probe found them, which is the fixture check run before the screens rather
than after one of them goes dead:

- **`under_review` had no fixture and `open` had one.** The generator closed
  everything older than six days, so two of the four states the log filters on
  did not exist.
- **`InjuryMap.not_recorded` had none** — the state the three-member union was
  written for.
- **`IncidentLocation.not_recorded` had none.**
- **An awaiting review flag that is *not yet overdue* had none.** Every flag in
  flight was already late, so the screen could only ever show the missed
  version of the state.

The last two are now pinned rather than left to the seed: a generator that
reaches a state one time in fifty is a generator that will stop reaching it.

### And one impossible fixture

The generator could **close an incident in the future**. A two-day-old incident
acquired an acknowledgement, a review and a closure spanning up to 87 hours and
landed a day and a half from now. Not a thin fixture — one that cannot have
happened. Every derived timestamp is clamped to `NOW`, and gap 16 walks every
incident to hold it.

53 incidents across 90 days — 34 generated, eleven pinned, sorted newest first.
All twelve types, all four severities, all four statuses, all four notification
states, both flag states with both halves of awaiting.

Six new fixture guards (11–16). `§5.3` gained the three incident entries and
`CLAUDE.md §3` the body-map exception — named, reasoned, bounded to
`src/assets/body-map/`, and explicitly not permission for inline SVG anywhere
else.

663 tests.

### Four amendments, and two of them changed the method

**`residentId` became a union.** Frank's call, and he is right that required was
wrong:

```ts
subject:
  | { kind: 'resident'; residentId: ResidentId }
  | { kind: 'no_resident_involved'; recordedBy: StaffRef }
```

A hoist found faulty during a check, or a trolley noticed before anybody
reached it, happened to nobody — and attaching either to whichever resident was
nearest is a worse record than attaching it to none.

**Note what it is not**: not optional, and no unrecorded member. "No resident
involved" is a positive claim somebody made, the same shape as "no consultants
involved" on a best-interest decision. The form must ask and cannot be left
blank. The wrong-subject rule gets stronger rather than weaker: an incident
with a resident names them everywhere, and one without says so in words instead
of leaving a reader to infer it from an empty field.

Only `equipment_failure` and `near_miss` can carry it, and gap 17 holds that —
a fall recorded against nobody is a lost subject.

**A near miss is `no_harm` by definition**, now said at the generator: a near
miss that caused harm is not a near miss, it is the incident it nearly was.
Gap 18 walks every one.

**The thin site is thin again** — 7 of 45, against 4 residents of 32.

Worth recording *how* the first attempt failed. Weighting the draw by
probability (`chance(4/32)`) gave Ashgrove **nine of thirty-four**: one chance
in eight, drawn thirty-four times, lands two and a half standard deviations out
often enough to matter. **A fixture is generated once, so "usually about right"
is not a property it has.** The split is decided by index now, and gap 19
bounds the share against the resident share rather than against a number.

### Two entries added to §8

**Probe the fixtures for unreachable states as the first step of a module, not
the last.** This module found four states rendering to nobody before a single
component existed — including `InjuryMap.not_recorded`, the state its own
three-member union was written for. Frank:

> The probe finding is the strongest argument yet for running it before screens
> rather than after.

**A derived timestamp is clamped to `NOW` at generation, and a guard walks the
set.** Second occurrence — care notes written in the future in Phase 2,
incidents closed a day and a half from now in Phase 4. Messy fixtures test the
product; impossible ones test nothing and teach the wrong thing about how a
screen reads.

45 incidents, 666 tests, every union member reachable. Waiting on the three
references.

---

## Phase 4 · The report form and the body map

Built to `docs/incident-report.html`, at `/incidents/new`. Sections 1–4 and the
footer. Section 5 needs shapes we do not have — see the end.

### The allergy stays, and not for the reason in the reference

Frank asked for a judgement rather than giving a decision. The reference's
reasoning — a fall and an allergy are read together — is true for choking,
where anaphylaxis is a real differential, and false for an equipment failure.
That points at showing it conditionally, and **conditional is the one option
that is actually unsafe**: shown only where an allergy exists, its absence
reads as "no allergy", which is the blank-means-two-things failure on the most
dangerous field in the record.

So it is always or never, and always wins for a different reason than the one
given: **an allergy is an attribute of the person, not an alert on a task.** A
wristband, not a klaxon. Once the subject card carries it anywhere, carrying it
everywhere is what keeps absence unambiguous — and the condition that makes it
safe is that it renders in all three states, exactly as on the round.

### The body map

`src/assets/body-map/`, the §3 exception. **Shapes are described as data
rather than written as markup** — `{ kind: 'ellipse', cx, cy, rx, ry }` — so
nothing here is an SVG string that could drift from the ids beside it, and the
component cannot render a region the closed union does not name.

Every region is a `role="button"` with a name, a pressed state, a tab stop, and
Enter and Space. `<g>` rather than a real `<button>` because SVG has no button
element; everything a button carries, it carries.

Three claims, each proved against the real defect:

- **The list is the record.** Delete it and six tests fail, including the
  keyboard one — because with no list there is nothing to read the result from.
- **Left and right are the resident's.** Swap the back view's shoulders and two
  tests fail by name. The mirroring test walks every paired region rather than
  the pair it was written from: `Math.sign(frontX - 100) === -Math.sign(backX -
  100)` for all of them.
- **Injury is three states.** No default on any of them, the map appears only
  for the third, and "found" with nothing marked renders the hatch and holds
  the submit.

**An upper arm is one site markable from two views**, and a test asserts that
marking it on the front reads as marked on the back with one entry in the list.
That is what removed `view` from `BODY_REGIONS`: it was presentation smuggled
into data, and it was wrong — a single `view` per region would have made the
same arm two sites.

### Where the reference and the settled model disagree

The reference's **Where** list is not our `COMMUNAL_AREAS`: it has "Corridor,
ground floor", "Corridor, first floor" and "Stairwell" against our `corridor`
and `stairs`, and no `off_site`. The union is approved and the rule wins, so
the form uses ours.

### Section 5 is not built, and one field in section 2

Four fields have no home on `Incident`, and inventing them is a §9 change:

- **Immediate action taken** — distinct from `ManagerReview.actionsTaken`,
  which is the manager's account written later. Putting the reporter's words
  under the manager's field would attribute them to the wrong person.
- **GP contacted · Family contacted · Emergency services** — each a small
  closed union in the reference.
- **"Anyone who saw it"**, in section 2, whose own hint reads *"or leave blank
  if nobody saw it"* — which makes a blank mean either "nobody saw it" or
  "nobody recorded who saw it". That is the defect the product exists to
  prevent, invited by the reference's own copy.

688 tests.

---

## Phase 4 · The five shapes, and the detail screen

### The reporter's account is its own record

`ImmediateResponse` on `Incident`: `immediateAction`, `witnesses`, `gp`,
`family`, `emergencyServices`. All five reach every member of every union
across the fixture set, checked by probe before the screen existed and held by
gaps 20 and 21.

`witnesses` was the catch worth having. The reference's own hint said *"leave
blank if nobody saw it"*, which would have made an empty field mean either
"nobody saw it" or "nobody recorded who" — on an unwitnessed fall, the
difference the record turns on. It mirrors `no_resident_involved`: a claim
carrying a name, never a blank.

`ContactState` keeps `not_yet` and `not_required` apart, and `not_required`
always carries a reason — a decision without one reads the same as a call
nobody made. `EmergencyServicesRecord` has two members rather than three,
because calling is instantaneous and a pending state would be a decision that
cannot exist.

### The detail screen, and its argument

**Outstanding decisions sit above the facts**, and the block does not render at
all when nothing is outstanding. Both halves are guarded: put the block back
when empty and one test fails; render "required, not yet notified" as settled
and three do.

Two notification states are outstanding, not one. `not_yet_decided` is a
decision nobody took; `required_not_yet_notified` is a duty somebody accepted
and did not discharge — worse, and the one that would otherwise sit quietly
because a decision *was* made.

The read-only map's regions **stop being buttons entirely** rather than
becoming disabled ones. A disabled control says "you could do this and cannot
right now"; nobody is marking anything on a detail screen, and a tab stop on
every region would be thirty-six stops through a diagram that does nothing.

### A pinned gap was hiding at the thin site

The un-notified safeguarding concern sat on an Ashgrove resident, so the
screen that surfaces it could not show it at the default site. **A deliberate
gap nobody meets in review is a gap that might as well not be there.** Ashgrove
is thin so that thin-denominator behaviour gets tested, not so that findings
hide in it. Moved to Rosewood.

### And the general sweep caught its first defect immediately

Gap 22 walks every timestamp in incidents, stock counts and the first 500 care
notes. It fired on its first run — not on incidents, but on the **controlled
drug register**: a routine count is stamped fifteen minutes after the last
dose, and where that dose was recent the count landed in the future. The
incident raised from it inherited the instant.

Third occurrence of the class, and the first one caught by a test written for a
different module. Clamped at source, and proved by unclamping it again.

713 tests. The log is the last screen in the phase.

---

## Phase 4 · The log, and the phase closed

Built to `docs/incident-log.html` at `/incidents`. The sidebar item is live and
carries a badge.

### The heading was narrower than its own contents

Frank kept the fourth kind and changed the heading instead: **"Three things are
owed on this incident"**, not "decisions". A closed incident with no root cause
is not a pending decision — it is a record that *asserted it was finished and
is not*, which is arguably worse, because closure made a claim.

### The two findings

`1.5fr 1fr`. Unacknowledged leads and takes the hatch: it is the one of the two
still fixable by whoever is looking. Undecided notifications sit beside it on a
plain surface — graver, but older, and not what this screen is for.

**Never summed**, and the test asserts the overlap exists first: if no incident
were in both, the arithmetic reason for keeping them apart would be untested and
the assertion would prove nothing. Sum them and it fails.

**No acknowledge control on a row.** Acknowledging without reading is the
failure the unacknowledged state exists to make visible. Add one and the test
fails.

The per-row `data-owed` line is how a reader gets from the second card to the
incidents it counts — the secondary figure is not a dead number.

### The badge counts what the screen counts

`/incidents` badges **unacknowledged**, not open. A badge and the screen it
points at should count the same thing, or the number changes meaning when
somebody arrives. Absent is still not zero: with nothing waiting the key is
omitted rather than set to `0`.

### A loose pattern that fired on the control the screen should have

`queryByRole('button', { name: /Acknowledge/i })` matched the **"Not
acknowledged" filter pill**. The assertion existed to prove a control was
absent and was passing on a control that was supposed to be present — it would
have gone green with an Acknowledge button beside it. Anchored to `/^Acknowledge/i`,
and proved by adding the button back.

### The §5.3 site audit

Every pinned gap, checked. **Only two sit at Ashgrove**: the resident admitted
yesterday, and the withdrawn photography consent.

Reported rather than moved, because they are not the same problem as the
incident that was moved. That one was a **home-level finding on a queue
screen** — the log's entire purpose is to bring it to somebody, and at Ashgrove
it could not. These two are **resident-level facts on a profile**, reached by
the ordinary act of opening that resident.

The distinction that matters: a queue finding is found because the screen
brings it to you, and nobody browses to a gap they do not know exists. A
profile gap is found by opening the profile. Both of these also give Ashgrove
real content rather than leaving the thin site empty of anything but thinness.

**Frank's call** — if either should move, say which.

727 tests. Phase 4 is complete: log, report form with the body map, detail and
manager review, post-incident review flags, and the stock discrepancy now a
real incident.

---

## Phase 5 · The scoring shape, before the screens

### The reference settled the biggest question

Not by answering it — by removing it. **Every instrument in this build is a
declared placeholder**, with a banner on every screen saying so. That is the
right answer: reproducing Morse or Waterlow from memory would have put an
invented weighting behind a name that claims clinical authority, which is worse
than an invented instrument that says it is invented.

### `RiskStatus.score` became a union

The reference shows choking assessed at **high** with no number. The old shape
required `score: number`, so an unscored assessment was not expressible.

```ts
export type RiskScore =
  | { kind: 'scored'; value: number }
  | { kind: 'unscored' }
```

A union rather than `score?: number`, because an optional would make a missing
score mean either "this instrument does not produce one" or "nobody recorded
it" — and on a scored instrument the second is real and different.

**An unscored assessment still reaches a level.** Somebody looked and formed a
judgement; what the instrument does not produce is arithmetic. Five templates
are scored (falls, pressure ulcer, nutrition, moving and handling, skin
integrity) and four are not.

### Two defects the change surfaced

**`${status.score}` compiled and rendered `[object Object]`.** Two call sites —
the risk badge and the profile badge strip — interpolated the field directly
into a template string. TypeScript catches every other shape change and is
blind inside a template literal. `scoreText` owns it now, for the same reason
`quantityWithUnit` and `pluralise` exist: a formatting rule with no owner gets
written again at the next call site.

**The RNG stream shifted and two unrelated tests went red.** Gating the score
draw on whether the instrument is scored meant four of the nine templates
stopped consuming a random number, which moved every later value — and the
failures landed in a file about LPA holders. The draw happens either way now
and is discarded for the unscored ones. Same discipline as the pronoun
substitution: decide after the draw, never instead of it.

`/dev/states` gained the unscored assessed state, because it is a branch the
badge and the profile have to render.

727 tests, and the module's data shape is settled.

### Departure from the source PRD — Mental Capacity leaves the risk assessments

`RISK_ASSESSMENT_TEMPLATES` drops to **nine**, and `resident.risks` with it.
Recorded here as a departure, as EOLC was.

The source PRD lists the Mental Capacity Act two-stage test among the ten risk
assessments. It is a **capacity determination, not a risk**: it produces "has
capacity for this decision" or "lacks capacity, and here is the best-interests
process" — never low, moderate or high.

Frank's reasoning, and the part that decides it: forcing it into a union whose
job is producing a risk level would make it *say something it does not say*,
and that level would then feed the badge strip and the risk column as if it
were a risk.

The two alternatives were both worse in instructive ways. Keeping it as an
unscored tenth is wrong because `unscored` is right for choking — an instrument
that genuinely yields a level a clinician judged — while capacity yields no
level at all, so it would need an invented one or a fourth state on a union
that does not want one. Keeping it listed with a permanent explanation of why
it is there is honest, and **a permanent explanation of why something is on a
list is a sign it should not be**.

It goes to Consent (Phase 10), where the same test is already being made:
§6.7 puts a mandatory capacity gate on consent with no default selection.

### Two pinned test subjects that were really pinned to the RNG

Dropping a template changed how many draws each resident consumes, and two
tests failed in files about LPA holders and care-team fields. Both named a
resident id to reach a property — and the id was never what they were about.

Both derive the subject now and assert the property: *some* resident carries a
value, a recorded negative and a gap at once; *some* resident has nobody
holding the primary contact. §8's "an assertion you have to relax was testing
the wrong thing", in its commonest disguise — a hardcoded id standing in for a
property of the set.

### The sweep: a union rendered by interpolation is unchecked

New §8 entry, in its own terms. TypeScript sees nothing inside a template
literal, so `${status.score}` did not fail when the field became a union — it
**printed `[object Object]`**. The one construct that is not type-checked is
exactly where a shape change does silent damage, and the damage looks like a
rendering bug rather than a type error.

The sweep across every clinical value interpolated directly found **three more
defects**, all in `completeness.ts` and all feeding the critical-gaps chip:
`${daysOverdue} days overdue`, which reads "1 days overdue". A different rule
from the score one, but the same shape — a formatting decision taken at the
call site.

`check-plurals.mjs` gained a third pattern for it, keyed on the **identifier**
rather than the noun: `${…days…} days`. Narrow on purpose — `${x.length}
residents` is the same defect at one, but "residents" appears in ordinary prose
beside a figure, and a net that fires on prose gets disabled.

It then caught two more, both already guarded by a surrounding `if` the regex
cannot see. Rather than add an exception mechanism, both were made **correct by
construction**: `every ${pluralise(n, 'day')}` is correct at every value, so
the `if` that was protecting it becomes *unnecessary* rather than *exempted*.

That is the more durable of the two fixes, and the reason is general.
**Teaching a checker about a special case leaves the special case in the code**
— the next reader has to know both the rule and the exemption, and the
exemption outlives whoever understood why it was safe. Removing the condition
that made the call site a special case leaves nothing to remember.

And an exception list is where a guard goes to die: a suppression is invisible
in review, so a guard with a list of them still reads as coverage while
covering less each time somebody adds to it. The script has no exceptions and
no false positives.

`scoreText` is the third formatting rule to need an owner, after
`quantityWithUnit` and `pluralise`.

727 tests.

---

## Phase 5 · The assessment list, and the density question answered

Seventh profile tab at `/residents/:id/risk-assessments`. Nine rows, iterated
from the template constant.

### "Score now" reads fine, and the reason is structural

Frank asked me to flag it if it read badly on nine stacked rows. It does not,
and the reason is worth keeping because it generalises: **the action is in its
own column, not adjacent to the hatch.**

A row reads name → hatched state → hatched level → action. Two hatched cells
sit between the template and the button, so the gap is what the eye meets
first and the affordance arrives after it. "Beside the hatch, never instead of
it" turns out to be satisfied by column separation rather than by proximity —
and only three of the nine rows carry it at all, because the other six are
assessed.

Had it been rendered *inside* the hatched cell it would have read as an answer
to the gap rather than a response to it. The column is doing the work.

### Two defects the rendered screen found

**Two hatched chips side by side saying the same thing.** A never-assessed row
carried "Never assessed — nobody has looked at this risk" *and* "No level —
nothing has been assessed". One fact, two hatches, two sentences: volume
drowning a distinction, in miniature, on the row whose whole job is to be one
clear gap. The reference had only the label on the level pill; the detail line
was mine. Removed.

**Two of the five review states rendered as though everything were fine.** The
row said `Assessed 09/07/2026 · A. Okonkwo` and stopped — which is exactly what
an in-date assessment looks like — for both `completed` (whose next date lives
on `nextDueOn`, not `dueOn`) and `never_scheduled`.

The second is the real one. **An assessment somebody completed and nobody set a
review date for is a gap**, and it was rendering as settled. It takes the hatch
now: "No review scheduled — nobody has set a date to look at this again."

Neither was a type error. `ReviewState` has five members and the code handled
three, falling through to a branch that reads as success — the same shape as a
missing `default` that guesses rather than refusing.

727 tests.

### The density requirement, restated as the property it wanted

Frank's own correction, and the reusable form:

> "Beside the hatch, never instead of it" was me describing proximity when the
> property I actually wanted was **separation** — the gap is met first and the
> affordance arrives after it.

Rendered inside the hatched cell, an action reads as an *answer* to the gap.
Rendered in its own column after it, it reads as a *response* to one. The row
is name → hatched state → hatched level → action, so two hatched cells stand
between the template and the button.

### The sweep: unions rendered by if-chains

Fifteen files branch on three or more clinical union members without
`assertNever`. Most are **deliberately partial** and correctly so — predicates
(`isUnrecorded`), filters, gap counters and write guards ask "is it this one?"
rather than rendering the whole union, and an exhaustive switch there would be
noise.

**Four were renderers with a fall-through that returned something plausible**,
which is the shape §8 now names:

| Renderer | The fall-through rendered as |
| --- | --- |
| `AssessmentListTab` — `ReviewChip` | an **in-date** assessment |
| `IncidentDetailRoute` — `NotificationBlock` | **notified**, with a reference nobody entered |
| `IncidentDetailRoute` — `InjurySummary` | a body map, for a state with no regions |
| `IncidentLogRoute` — `StateChip` | **under review**, work somebody had taken on |

Every one defaults to the reassuring answer. That is not a coincidence: the
last branch of a chain is usually the fullest case, and the fullest case is
usually the one where everything is recorded.

All four are exhaustive switches with `assertNever` now, proved by adding a
member to `NotificationDecision` — it becomes a compile error at the exact
line rather than a screen that says the CQC was told.

Two-member unions (`Recorded<T>`) are left as `if`/`else`: with two members an
else *is* exhaustive, and the hazard is proportional to how many members can
arrive without anybody noticing.

727 tests.

---

## Phase 5 · The scored assessment

`/residents/:id/risk-assessments/:templateId`. The sentence: **this score puts
them in this band, and every intervention here needs somebody's name on it.**

### The running score is sticky, and that is the argument

The score is the thing the reader is watching change — a scorer answering item
four wants to know what item four did. A figure that scrolls away turns a live
instrument into a form you submit and hope.

It carries its denominator and says plainly that it is not final: *"4 of 6
items answered — the score is not final until every item has an answer"*. A
partial score read as a total is a wrong clinical figure, and on a running
total the partial state is the normal one.

### Point values beside every choice

Frank's requirement, and the reasoning is the part worth keeping: **a scorer
who cannot see the weighting cannot tell whether the instrument is behaving,
and on a placeholder instrument that matters more rather than less.** Seeing
the number is the only way to notice that an invented weighting is wrong.

**No item carries a default**, and the reason states the rule better than
"no defaults" does: *a pre-selected answer is an answer nobody gave — and on a
scored instrument it is also points nobody chose.* The second clause is what
makes it worse here than on an ordinary form: the default does not merely
stand in for a missing answer, it contributes arithmetic to a total somebody
will read as a finding.

### An intervention with no responsible person cannot be saved

Said on the screen as well as enforced in `outstanding()`. **A plan nobody owns
is not a plan** — it is a sentence somebody wrote.

An *empty* row is ignored rather than held: a blank row is not an intervention
at all, so only a described one with no owner blocks the record.

That distinction is the difference between a rule that protects something and
one people route around. **A form that refuses to save because of a row
somebody never filled in teaches people to work around the rule**, and a rule
people route around has stopped protecting anything — it only looks like it
still does, which is worse than not having it.

Both halves are tested, and the rule was proved by letting an unowned one
through.

### Four unscored templates ask nothing

Choking, behaviour, environmental risk and COSHH record findings and reach a
level without arithmetic, so the form shows no items and no running score for
them and `outstanding()` asks for nothing. The screen says why rather than
rendering an empty scoring card.

748 tests. The list and the form are proved against their own failures, and
the **blast radius is the check worth having**: rendering only the assessed
templates fails four tests including the "No level" one and the separation one
— not merely a count. That means those tests are about the gap rather than
about the number of rows, which is what §8's assertion entries exist for. A
change that hides the gaps breaks the tests that describe the gaps.

---

## Phase 5 · Re-score and compare

Part of the assessment rather than its own route, so answers survive reaching
it. The title becomes "Re-score — …" when a prior assessment exists, and the
comparison appears once every item is answered.

### The centre column carries an arrow **and** a word

Never the arrow alone. Direction by shape is unreadable in greyscale and means
nothing to a screen reader, so a shape-only indicator is decoration on a
clinical finding. Improved · Unchanged · Deteriorated, with the arrow as
reinforcement and the point difference beneath.

### Every closed review is named, never counted

Frank's requirement, and the distinction is exact: *"This closes 2
post-incident reviews"* is a **figure**; *"the unwitnessed fall of 21/08 and
the witnessed fall of 04/08, both overdue"* is the **record**. A count tells
somebody how much work vanished, not what it was — and somebody discharging two
obligations should see which two.

All open flags for that resident and template close together, not just the
oldest: two incidents that both flagged falls recorded the same obligation
twice, and leaving one open would ask for the same work again. Tested against
the fixture, and the naming was proved by replacing it with a generic phrase.

### Lateness survives the clearing

The half most easily lost, and Frank named exactly why: **the natural write is
to set `completed` and move on.** That loses the fact that it was late, because
the only thing that said so was the *absence* of a completion before `dueBy`.

`wasClearedLate` derives it — `completed.at > dueBy` — so it is permanently
true rather than true until somebody does the work. Nothing is stored, so
nothing can be overwritten. An incident closed late still reads as closed late.

Three cases held: cleared late, cleared in time, and never cleared at all —
because an open flag is *not* "cleared late", it is not cleared, and the detail
screen shows it as overdue instead. Proved by making the function return
`false`.

### The confirmation is raised only when the level changes

Composed on `AlertDialog`'s subject and action: *"Record a falls risk of High
for Beryl Hutchinson?"* — never "Are you sure?". Raising it on every re-score
is volume drowning the distinction: **a warning that fires on the unremarkable
case stops being read on the remarkable one.**

The consequences block names what changes on the profile, every review the
change closes, and the next review date. Beneath it, the hatched note that
staff on shift would be notified and this build will not send it — the export
stub's treatment, because claiming a notification happened would be a record of
something that did not.

755 tests. One screen left in the phase: the cross-resident queue.

---

## Phase 5 · The clearing is a real write

`review-flag-store.ts`, same discipline as `mar-store` and `note-store`: in
memory, never touching the fixtures, gone on reload, undoable within the
session.

Frank's reason for building it rather than leaving the flow inert is the one
worth keeping:

> Every other write in this build creates a record — a care note is written, a
> dose is signed for, a handover is signed. **This one discharges an obligation
> somewhere else.** The incident detail screen is asserting that two reviews
> are owed, and if a re-score does not clear them that assertion stays wrong on
> a screen you have already built.

An obligation that has been met still rendering as outstanding is the invariant
failing in the mirror.

### The undo is a control, not a toast action

Persistent while the clearing stands, the way an undone note review is. A toast
is the right length for "we saved it"; this closed a clinical obligation
somebody else raised, and the chance to take it back should outlast a
five-second banner.

It undoes **as one act**: a re-score that closed two reviews puts both back,
because undoing half would leave the record saying a review was done that was
not — worse than not offering undo at all.

Clearing never touches a flag somebody else completed. Re-clearing one would
overwrite whoever actually did the work with whoever happened to re-score
afterwards.

### Two of my three new tests were vacuous

Caught by probing the fixtures rather than by the suite, which went green on
them. Both hardcoded `falls` and returned early when nothing matched — and one
of the two was the test written for **the branch nobody had exercised**, so the
thing it existed to check never ran.

Same disguise as the pinned resident ids: a hardcoded value standing in for a
property. They derive the template now and assert the fixture exists first.

### A re-score alone cannot empty the outstanding block, and that is correct

The finding underneath the vacuous test. Every flagged incident in the fixtures
owes something a re-score does not touch:

| Incident | Owes |
| --- | --- |
| `inc-941` | falls assessment **and** the mobility care plan domain |
| `inc-010` | pressure ulcer assessment **and** personal care |
| `inc-931` | pressure ulcer assessment **and** a root cause nobody recorded |

That is structural rather than a fixture accident: `REVIEW_TARGETS` gives most
incident types both a risk assessment and a care plan domain, and **a re-score
can only clear the risk-assessment half.** Clearing one obligation of two does
not empty a list, so arriving at the empty block *by doing the work* is not
reachable until Phase 6 builds the care plan review.

The branch itself is covered — an incident with nothing outstanding renders no
block — so what was missing was **the route to it, not the rendering**. Those
are different properties, and a user only has the second.

Building a fixture whose only owed thing is a risk assessment would have made
the test pass, and Frank said he would have accepted one. It is the worse
answer: **a fixture shaped by the test rather than by the home makes the branch
reachable only in the test.** The screen would still be unreachable by doing
the work, and the suite would say otherwise — the illusion of coverage rather
than coverage.

The test asserts what is true instead: clearing removes exactly one item, the
screen renders one fewer, and the block stays up while the care-plan half is
still owed.

765 tests. Proved by making `patchedIncidents` ignore the store: five tests
fail across both modules.

---

## Phase 5 · The fifth queue, and the phase closed

`/risk-assessments`, matching the four before it. The sidebar item is live.

### Never assessed leads, not overdue

The one judgement specific to this queue. **An overdue review is a risk
somebody looked at and has not looked at recently; a never-assessed one is a
risk nobody has looked at at all.** The second is not a worse version of the
first, it is a different claim — so the two are side by side and never summed,
as on the incident log.

Sorting follows from it: never assessed above, then longest overdue within the
rest. **A risk nobody has assessed has no wait to measure**, which is why it
sorts above the ones that do rather than among them.

### The denominator is residents × templates

Not assessments on record. Counting what exists would make a home that has
assessed nothing look complete — absence from a list is the same bug as a blank
cell, at the scale of a home. Break it to count only the assessed ones and four
tests fail, including the one that opens on the finding.

### And the date rolled over again, at 00:13 on a Monday

The MAR chart's detail test failed with `Cannot read properties of null` —
which named the symptom and not the cause. **Every cell on that screen is
derived from now**: the default range is the current week and the fixtures stop
at `NOW`, so in the small hours of a Monday the visible week holds one
part-finished day and every cell is `due` or `not_due`. There was no `given`
cell to click.

Fourth catch for the wall-clock check, and the first where the error message
pointed somewhere else entirely. The file is pinned to the afternoon of the
last day of the previous full week — computed from `NOW.getDay()`, so it lands
on a complete week whatever day the suite runs. The assertion that the cell
exists is now explicit, so the next failure names the cause rather than the
null dereference.

773 tests. **Phase 5 is complete**: the assessment list, the scored form,
re-score and compare with the flags actually clearing, and the queue across the
home.

---

## Phase 6 · The data layer, before the references

### A care plan is revised; a care note is corrected

Stated at the type, because the two are different models rather than different
styles. A note is somebody's **account of a moment**, so editing it rewrites
what they saw — corrections are linked notes and the original stays. A care
plan is a **current instruction staff follow today**, so there is exactly one
current version and the previous becomes history rather than a mistake.

```ts
versions:
  | { kind: 'never_finalised' }
  | { kind: 'finalised'; history: [CarePlanVersion, ...CarePlanVersion[]] }
```

Non-empty where it has been finalised and absent where it has not, so
**"complete implies at least one version" is held by the compiler** rather than
checked at a call site.

### A draft is not a version

`in_progress` holds an unsigned edit in its own field, outside the history.
Frank's reason: *a diff showing changes nobody agreed to is a history of
intentions rather than of instructions*, and what the history is for is what
staff were told to follow.

The consequence is deliberate: **an abandoned draft leaves no trace.** Nobody
followed it.

### The voice is a constraint on the editor, not a copy preference

Two of the three fields are the resident's words and one is not: current needs
and preferences are first person, agreed actions are second person about staff.
The field says so.

And the constraint that follows, which is the sharp end of it:

> The editor cannot pre-fill from an assessment: a Morse score cannot be turned
> into "I need help to walk" without putting words in somebody's mouth.

### One store, extended — not a second mechanism

`review-flag-store` now keys on the whole target rather than a template id, so
a finalised domain review clears a `care_plan_domain` flag exactly as a
re-score clears a `risk_assessment` one. Same undo-as-one-act, same derived
`wasClearedLate`.

Two stores would have meant two undo behaviours and two ways for lateness to be
lost. They are the same obligation with different work behind them.

**This is the phase where the empty outstanding block becomes reachable by
doing the work** — `inc-941` owes falls *and* mobility, and until now only half
could be discharged.

### Volume

320 domains across 32 residents: 218 complete, 22 past review, 12 part-written
with a draft, 68 never started. 78 have been revised at least once, so the diff
has something to show. Adeyemi's 14-month-stale domain is intact, and Sowande
carries **all ten never started** — "never written down" is this module's
"never assessed", and it needs a resident carrying it rather than a scattering.

773 tests.

### Due soon is derived, and the asymmetry with `ReviewState` is correct

Frank's stronger version of the argument, at the declaration and worth keeping
here:

> "Due soon" is not a recorded fact. Nobody wrote it down, and it changes on
> its own as the clock moves. A union member asserts something about the
> record; this is arithmetic on a date the record already holds.

And the second half, which is why the next person should not reconcile the two
unions: **`ReviewState` has `due` and `overdue` as members because a review has
a scheduling lifecycle of its own** — never scheduled, scheduled, due, overdue,
completed, each of them something somebody did or did not do. A care plan
domain's status is about **the plan**, not about the review of it. Two
different things, correctly at different granularities. A note at each
declaration says so.

`REVIEW_DUE_SOON_DAYS = 30`, named like every other figure derived from now,
and folded under open item 2b rather than becoming a second placeholder.

**Due soon renders quietest of the three that are not settled.** Never started
is a plan that does not exist; overdue is a plan nobody revisited past the date
they set. Those are findings — due soon is a diary entry, and the one most
likely to crowd the two that matter.

### And two of my own tests were pinned to the constant's value

Found by changing the threshold to 14 to check the guard bit. Two tests broke
that were not about the constant's value at all: "60 days out" and "17 days
out" were only outside and inside a *30-day* threshold.

The same shape as a hardcoded resident id — a literal standing in for a
property. Every date derives from `REVIEW_DUE_SOON_DAYS` now, and the suite
passes at 7, 14, 30 and 60. **A test that has to be edited when a legitimate
change lands was testing the wrong thing**, and the tell here was that the
change I made to *check* the test was the change that broke it.

783 tests.

## Phase 6 — Care Planning

Built to `docs/care-planning.html`: the domain list as the eighth profile tab,
the domain editor, and version history with the diff. Routes are
`/residents/:id/care-plan`, `…/care-plan/:domainId` and
`…/care-plan/:domainId/history`, each reachable from the one before it and
each asserted in both directions.

The four things named as having to survive translation all did, and one of them
is rendered against the reference rather than from it — see the conflict below.

### The reference's draft row renders one fact where the record holds two

The mockup's Communication row shows **Version 1, signed 03/01/2026** and a
single info chip reading "Draft in progress — A. Okonkwo, yesterday · not
signed". The signed date is in the data and is never rendered; the version
column carries "Version 1" and nothing says a signed plan is in force.

That row is two facts with opposite valence: **there is an instruction staff
are following today, and somebody has started rewriting it and has not
signed.** As one chip it reads as "nothing is in force" — which is wrong in the
direction that matters, on the row where a reader decides what to follow.
Rule 3a, so the rule wins.

Built as: the plan's own state (signed / due soon / overdue / never written)
**and beneath it**, where a draft exists on top of a signed version, a separate
info chip saying so and naming which one staff follow. The reference's
treatment is kept exactly for `in_progress` — a draft with nothing ever signed
— where the info chip is the whole truth and the hatch would be wrong: somebody
has looked, and what is missing is a signature rather than the work.

**No fixture reached the compound state.** The generator only ever produced
"draft, nothing signed", so this is pinned rather than generated — derived by
property inside the patch so it survives a change to the draw order.

### Due soon carries no chip, as specified

Signed date in plain text, review date in caution ink on the second line, no
fill at all. The test asserts it as the **absence** of the treatment the other
two get, because that is the thing that would quietly come back.

### Fixture defects found while probing, all of them wrong on the facts

Probed before building, as usual. Five, in rough order of severity.

**1. Every awaiting review flag in the set read as overdue, and the constant
named `FLAG_STILL_IN_TIME` was not still in time.**

`dueBy` was `after(closedAt, 48)`, and `after` exists to stop a *signature*
landing in the future — correctly, because nobody can sign at a time that has
not happened. Applied to a deadline it does the opposite of its job: it dragged
every flag raised in the last 48 hours back to this instant.

**The guard that existed for this passed on the boundary.** `flagIsOverdue` is
`dueBy < now`, which is false when they are equal, so a flag with *zero seconds
left* counted as one somebody could still do on time. The assertion was green
and the fixture had no in-time flag in it at all. It now asserts with an hour
to spare rather than at the tie.

With the clamp gone, the only naturally overdue flag points at a risk
assessment, so no care plan domain owed a late review and the editor's "it will
still read as closed late" had nothing to render it for. `inc-942` is pinned as
the opposite half of `FLAG_STILL_IN_TIME` — a fall closed four days ago on the
resident whose mobility plan is already two months past its own review date,
because that is what this actually looks like.

The general future-dating sweep had to learn the same distinction: it was
flagging `dueBy` as an impossible date. **A deadline is not a record and is
supposed to be in the future.**

**2. Every previous version had a blank `preferences` field.** A finalised
version with a blank in it is a record the editor refuses to create — and it
would have rendered as an empty box in the middle of the diff: a blank that
reads as "she had no preferences" rather than "nobody wrote them down".

**3. Preferences were drawn from the needs pool**, so a plan's second field was
frequently a verbatim copy of its first. Two boxes saying the same sentence is
one fact rendered twice, which is the diff screen's failure mode arriving
early. `DOMAIN_PREFERENCES` is its own pool, same voice, same length — so the
swap costs no RNG draw and nothing downstream moved.

**4. The gap-7 patch edited a status without the version it points at.** It set
Grace Adeyemi's mobility to "finalised 14 months ago" and left the history
saying February 2026 by whoever the generator picked. Invisible until a screen
rendered both, which is this phase. Now asserted for every domain: the current
version's signature and the status's signature are two halves of one fact.

**5. No domain had a signed version with an unsigned draft over it** — see
above.

All five now have guards, and each guard was proved to fail on the defect it
names before being trusted.

### Two rules that grew an owner

`REVIEW_INTERVAL_MONTHS` — the six-month placeholder — was a local
`sixMonthsFrom` in the risk form and about to be a second one here. Two figures
that agree today and are one edit away from disagreeing, on a screen that tells
somebody when to look at a person again.

`formatLateness` — days under two months, months above. "426 days late" is a
figure nobody converts in their head. Retrofitted into the risk list, the risk
queue and `completeness.ts`, so there is one owner rather than a new rule
beside three old ones. **It rounds rather than truncates**, and the first
version truncated: on an average-month divisor that lands just under every
round number, so a year late rendered as "11 months". Understating a lateness
by four weeks fails in the direction that makes a home look better than it is.
Asserted as a property across 840 day-counts rather than against three more
literals.

### `INCIDENT_TYPES` gained a `phrase`, and this one is yours to reverse

"Fall — witnessed" is the right **label**: it sorts the two falls together in a
filter and puts the distinction where the eye scans. Dropped into prose it
produced "the fall — witnessed of 23/08", which is not English — and that
sentence is in the Phase 5 confirmation dialog too.

Each entry now carries a name for a list and a phrase for a sentence.
Additive, one line per type, and the alternative was a second twelve-id lookup
table in a file that does not know when the first one changes. **It is a change
to the shape of a reference constant and I did not ask first**; it reverts in
one commit if you would rather it did not.

### Two smaller translations away from the reference

**The owed-review block.** The mockup puts it inside the subject card. Our
`ProfileHeader` is shared by every tab, so putting it there would mean every
screen carrying a care-plan-specific finding. It renders beneath the tab strip
on the care plan screens instead, with the same words.

**The type scale.** 14.5px, 13.5px, 12.5px, 11.5px, 10.5px and 22px each take
the nearest step on the closed scale, as Phase 5 settled. Stated in the
stylesheet header.

### Save draft stores nothing, and says so

The only real write on this screen is the one that discharges an obligation —
finalising clears the post-incident review flag through the existing session
store, and undo is a persistent control rather than a toast action, exactly as
the re-score is. The plan text itself is not stored, and the button that
appears to save it says so in a toast rather than pretending.

**A session draft store is the obvious next thing and I have not built it.** It
would make the compound state reachable by doing rather than only by fixture,
and it needs the domain list reading through it — a change to the client layer
rather than a screen. Your call.

### `.toLowerCase()` was quietly removing the point of a label

"What I need help with" became "what i need help with" in the editor's
outstanding line and in the diff summary. It looks like tidy sentence case. The
label is written in the resident's own voice and the pronoun is the one word in
it that matters.

Found by dumping the DOM and reading it, which is also how the missing history
link was found: the link was rendered only where a version existed, so the "no
version has ever been signed" screen was routed, styled, tested and unreachable.

38 test files, 821 tests.

### The four owners are all the same shape

`quantityWithUnit`, `pluralise`, `scoreText`, and now a label with two
grammatical homes. Frank's framing, and it is the general rule the first three
were each an instance of:

> **A value whose correct rendering depends on where it appears cannot be
> rendered by whoever happens to be appending it.**

"1 patches" depends on the count. "[object Object]" depends on the union member.
"the fall — witnessed of 23/08" depends on whether the string is sitting in a
column or in a sentence. In every case the call site had all the information
and no reason to think the question was hard, which is exactly why the rule
cannot live there. The fourth one arrived in a module written three phases
after the first, by the same route: somebody appended a value and it read
wrongly.

The `.toLowerCase()` on a field label is the same defect one step further on —
not a missing owner but a transformation applied by a call site that did not
know what it was transforming. It is now §8.

### The care plan session store

Built for the reason Frank gave, which is the better version of the reason I
had: **a state reachable only from a fixture is one nobody can get to by doing
the work** — and the signed-plus-draft state is the one where a reader most
needs to see both halves, so it is the one most likely to be got wrong in a
real build.

Session only, gone on reload, never touching the fixtures, and every control
that writes says so. Same discipline as `mar-store`, `note-store`,
`handover-store` and `review-flag-store`.

**Saving and signing live in one store, because signing consumes the draft.**
Split across two there would be two ways for a domain to end up claiming a
draft over a version that draft already became.

What each write does, and why:

- **Save draft** sets the draft. A domain with nothing signed becomes
  `in_progress`; a domain with a signed version keeps its status, because the
  signed version is still what staff follow today and the draft is a second
  fact beside it, not a replacement for it. That single rule is what makes the
  compound row reachable by typing.
- **Discard draft** removes it and clears the boxes. Confirmed rather than done
  on a click, naming the subject and the domain in the sentence — it throws
  away work somebody typed and there is no backend to correct a mis-click. An
  abandoned draft leaves no trace in the history, which is correct rather than
  a gap: nobody followed it.
- **Finalise** signs a version, consumes the draft, moves the next review date,
  and clears the post-incident review flag. **Two writes, one act, one undo.**
  Undoing half would leave the record holding a version nobody signed, or an
  obligation reading as met by work that no longer exists.

**Finalising had to create the version, not only clear the flag.** A draft
store whose finalise button leaves the draft in place shows a domain carrying a
rewrite of the thing that rewrite already is. That was not extra scope; it was
the state the store makes possible and therefore has to resolve.

Two supporting changes, both of them seams rather than screens:

**Every read of a resident now goes through the store**, shadowed once in
`client.ts` rather than applied at each call site — for the same reason
`patchedIncidents` is. A draft saved on one screen and not seen on the next is
two screens disagreeing about one record, and the one that has not heard is
always the one somebody is about to act on.

**The profile layout gained a `refresh`.** The tabs are children of one layout
that loads the resident once, so without it the tab that performed the write
would be the only one that had not heard about it. It re-runs the load through
a dep rather than through `retry`, so the screen keeps its data — and the undo
control — while the record is re-read.

`CarePlanText` is now declared once in `data/types/clinical.ts`, derived from
`CarePlanVersion`. Three things need exactly those three fields and no others:
the editor's boxes, the draft, and the diff. A second hand-written copy of the
list is how a fourth field ends up in two of them and not the third.

**One test failure worth keeping.** A missing import made `afterEach` throw, and
because that aborts the rest of the queue it took Testing Library's cleanup with
it — so every later test rendered into a document holding every earlier
render's DOM, and 36 tests failed with an accessibility error about duplicate
banner landmarks. The reported failure had nothing to do with the cause. **When
a whole file fails at once, read the `afterEach` before reading the
assertions.**

### Two things the store surfaced, both found by dumping the screen

**The screen contradicted itself about the work somebody had just done.** After
finalising, the owed-review banner still said the plan owed a post-incident
review. The flag *had* been cleared; the banner reads it through its own
`useResource`, which `refresh` does not touch. What this screen says comes from
two reads — what the plan holds, and what it owes — and updating one of them is
worse than updating neither, because the two halves then disagree in front of
somebody. Both now follow the same write counter.

**And the footer said "Waiting on: all three fields" about a plan just signed.**
The boxes empty on signing, because the draft became the version — so a line
computed from the boxes describes the wrong thing the moment the act succeeds.
The footer has three states now, and the third is the one a footer usually
forgets: not "what is outstanding" but "what just happened".

Neither was visible from the tests. Both came from rendering the flow and
reading it, and the first reading was itself wrong — the dump read the DOM
before the re-read had landed, so it looked like three defects where there was
one. **A dump that does not wait for the write to settle reports the race, not
the screen.**

### Lateness, finished

`formatLateness` now owns every rendering of it. The domain list said "2 months
late" while the Needs tab, on the same record, said "61 days overdue" — the
one-owner problem showing itself between two tabs of the same resident. Also
retrofitted into `ReviewBadge`.

One test had to be relaxed to let that land, which means it was testing the
wrong thing: `/days overdue/` pinned the *unit* in order to check that a
duration was stated at all. It now asserts that the row says how long in
whatever unit reads best, which is the property, and still fails on a bare
"Review due" with no figure.

### One thing observed and not changed

**The Needs tab shows no sign of a draft in progress.** For a domain with a
signed version, the draft does not move the status, so that tab renders exactly
what it rendered before. That is arguably right — the Needs tab is the plan,
and a draft is not the plan, so nothing it claims is false. But a reader of
that tab cannot tell a revision is being written. Left alone rather than
decided quietly; it is a treatment question for a screen whose scope was
settled in Phase 1.

### The revision on the Needs tab

Frank's argument, which is the one I did not make: **"somebody is rewriting
this" is a fact about the current plan, and the Needs tab is a summary of the
current plan.** A reader who sees a domain there and does not know it is under
revision may act on a version that is about to be superseded. Nothing the tab
claimed was false, and the silence was still not neutral.

Plain text, no chip, no tint, no hatch, at the weight the settled facts sit at.
It never touches the status: the signed version is still in force and still
what staff follow, and only a signature changes that. Both properties have a
guard, and both guards were proved to fail — one by moving the status when a
draft exists, one by putting a pill in the line.

It renders only where a signature exists to be in force. With nothing signed,
`in_progress` already says a draft exists and who is writing it, and saying it
twice in one cell is volume drowning a distinction in miniature.

### And it turned up a sixth formatting owner

Reading the rendered line: **"A revision is in progress, not yet signed — A.
Okonkwo, 11:29 BST."** A draft written last Tuesday, rendered as this morning.

`formatAttribution` is the owner of who-and-when, and it renders the *time*
alone — correct for a record somebody is reading on the day it was made: a dose
at 08:04, a note from this shift, a handover being signed now. Every use of it
until this one was that kind of record.

The domain list had the same fact wrong in the opposite direction: "A.
Okonkwo, 2 days ago", relative time with no absolute beside it, which
CLAUDE.md §6 forbids outright.

`formatAttributionOn` now owns the fuller form and both screens use it. It
keeps the `(deactivated)` marker, because records outlive access and one of the
two attributions quietly telling a different truth is how that gets lost.

### The formatting owners, all the same shape

Six now, each found the same way and each an instance of one rule:

> **A value whose correct rendering depends on where it appears cannot be
> rendered by whoever happens to be appending it.**

| Owner | The value | What it depends on |
| --- | --- | --- |
| `quantityWithUnit` | stock | the count — "1 patches" |
| `pluralise` | a plain count | the count — "1 days" |
| `scoreText` | a risk score | the union member — "[object Object]" |
| `INCIDENT_TYPES.phrase` | an incident type | column or sentence |
| `formatLateness` | how overdue | the size — "426 days late" |
| `formatAttributionOn` | who and when | how old the record is |

**And the tell was the same for the last two.** A test had to be relaxed to let
a correct change land, which means it was pinning the rendering rather than
checking the property: `/days overdue/` was asserting the *unit* in order to
check that a duration was stated at all.

### Two things worth keeping for their own sake

**Atomicity is a property of the record, not of the code.** Splitting a
finalise into two writes with one undo each would leave the record holding a
version nobody signed, or an obligation reading as met by work that no longer
exists. Neither is a bug in a function — each is a false statement in a care
record, and that is the reason the two writes belong in one store rather than a
preference about how to arrange them.

**A dump taken at the wrong moment measures a state that never existed.** My
first reading of the write flow was taken before the re-read had landed, and it
produced three confident findings where there was one. The practice is "dump
the DOM and read it"; the missing half is **wait for the write to settle
first**, or the reading is of a screen mid-flight that no user ever sees.

## Phase 7 — Reviews

Built to `docs/reviews.html`: the review queue at `/reviews`, the completed
filter on it, the whole care plan review session, and `/care-plans` — the
cross-resident care plan queue Phase 6 owed and did not build.

### The fixture fix first, and the counts

**`never_scheduled` was reachable only from a record that did not exist.**
`makeReviewState` returned it when the thing had never been done at all, so of
180 assessed risks **not one** carried "assessed, and nobody set a date to look
again" — the branch `AssessmentListTab` renders for exactly that case had no
fixture reaching it. Phase 5 wrote the branch; §8's first standing check would
have caught it if anything had asked.

Fixed in the generator, as instructed, by re-banding the roll that was already
drawn rather than adding a draw. After it:

| | before | after |
| --- | --- | --- |
| assessed risks with no review date | 0 | **7** |
| whole-plan reviews never scheduled | 6 | 8 |
| completed risk reviews | 103 | 103, of which **23 were late** |
| whole-plan reviews carrying outstanding domains | — | **7 of 9** |

Lateness on a completed review was not derivable at all — `ReviewState.completed`
carried `completedOn` and `nextDueOn` and not the date it had been *due*, so
"reviewed on time" and "reviewed three weeks late" were the same record. It now
carries what it was completed against.

**And that field is a union, not a date.** A review nobody ever scheduled can
still be done, and it had no deadline to beat. A plain `dueOn` would have to be
invented for that case, and an invented deadline produces a lateness nobody can
check — the blank that means two things, inside the field that exists to stop
one. `{ kind: 'due_on'; dueOn } | { kind: 'never_scheduled' }`, and a review
completed against nothing is neither late nor on time: the row says what
happened instead of choosing.

### The projection is the module

Three populations, one shape: 181 assessed risks, 320 domains, 32 whole-plan
reviews — **533 reviewable records**, and every finding carries the
composition. The queue is a rendering of it and the two sessions already exist,
so this phase builds no third.

**Both exclusions are named on the screen**, because silence on either is a
claim. 107 risk assessments have never been done, so there is no review to
schedule for them — but a home that has assessed nothing would otherwise read
as a home with nothing overdue. 87 care plan domains have no signed version;
they are counted in the denominator and excluded from the three findings,
because a domain with nothing signed has no review to be late for.

That second one is where the reference is internally inconsistent, and it is
worth stating. It counts all 320 domains and only the 180 risk assessments that
exist. The distinction that makes it coherent: **every resident has all ten
domains by definition, so an unwritten domain is a record with no content; an
assessment nobody did is not a record at all.** Followed, and both exclusions
named rather than left to the reader.

### The completed filter, and why it is a filter

A queue of completed records has no gap to lead on, so the lead becomes an
`Aggregate`. The denominator is *records whose review fell due in the window*,
never *records reviewed in the window* — and a completion is counted against
the date it was **due**, not the date it was done, or a home that clears a
year's backlog in one afternoon makes the year it neglected disappear.

`MIN_REVIEWS_FOR_A_RATE` exists because rendering the denominator is necessary
and not sufficient: "100% — 2 of 2" is true and still invites a judgement two
records cannot support. Below the floor the figure is Insufficient Evidence,
which is the absence of a finding rather than a milder one. **The number is
invented** and belongs with the other invented figures in §9.

### The session completes over gaps, and the record carries them

The handover signature pattern, and Frank's argument for it rather than mine:
refusing would mean the meeting happened and the system holds no evidence of it
— and a review meeting happens *because* there are gaps. Permitting it silently
would let "care plan reviewed" sit over three domains nobody has written.

**18 of 32 residents had exactly that**: a care plan review reading `completed`
or `scheduled` while a domain of that plan was unwritten or past its date.
Grace Adeyemi's read *completed* over a mobility domain two months overdue. The
generator now builds the review from the plan rather than beside it, and the
completed record names which domains were outstanding — named, not counted.

### The reachability guard learned a distinction rather than gaining an exemption

`care-plan/review` is a routed profile screen with no tab, deliberately: the
reference forbids a tab, because each module already answers for its own
records. The guard that caught the MAR chart fired, correctly.

It now has `REACHED_FROM_ELSEWHERE`, and that is **not an exemption list**.
Each entry names where the screen is reached from *and* supplies the links that
place actually produces; the test fails if the screen stops appearing among
them. Proved by breaking the projection's route and watching it fire. An
exception list is where a guard goes to die, so this one moves the proof rather
than waiving it.

### Two of my own tests were vacuous, and one was a proxy

**`expect(after.items.length).toBeGreaterThan(0)`** on the *unpatched* fixture
resident — true before the click and after it. It now reads the record back
through the store's own patch, which is what every screen reads it through, and
asserts the outstanding domains equal the gaps.

**`rows.length % 10 === 0`** — true of 0, of 10, and of every wrong answer that
happens to be a multiple of ten, including an empty list. Now the exact figure,
derived from residents × domains.

And one that was neither mine nor new: **`residents.test.tsx` asserted a
hand-written approximation of the "all assessed, no flags" condition** — four
of the six things the cell actually checks. The approximation stopped being
satisfiable while the real condition still was, so the test failed on a screen
that was working perfectly. Both it and the fixture guard now call
`hasNoRiskFlags`, exported from the cell. **A proxy for a rule is a second
rule, and the two drift** — in either direction, and the failure looks
different each way round while being the same defect.

### The nav item's phase tag was a claim that had stopped being true

`/care-plans` was tagged P6 and disabled after Phase 6 closed without building
it. Frank's framing: a phase tag naming a closed phase is worse than a disabled
item, because it is a claim that has stopped being true. Both items are now
enabled and routed, and the bidirectional sidebar guard holds them.

### The denominator, fixed rather than justified

Frank's correction, and he is right that my reading rationalised the
reference's inconsistency instead of resolving it:

> The distinction — "a domain is a record with no content, an assessment nobody
> did is not a record" — does not hold. All ten domains and all nine templates
> are slots that exist for every resident. Neither is more of a record than the
> other.

**The property is reviewability**, and it applies to both the same way. A
never-written domain has nothing to review, exactly as a never-assessed risk
does. Counting one and not the other inflated the denominator with things that
cannot be reviewed and made this screen a partial duplicate of two others.

So both are out. The denominator is **records that exist and could carry a
review date** — written domains, assessed risks, whole-plan reviews. Both
exclusions are named on screen and point at the queue that leads on them.

It also sharpens the lead, which is the part I had not seen: *"nobody scheduled
a review for a record that exists"* is a cleaner finding than one mixed with
records that do not.

`no_record_to_review` is gone from `ReviewStanding` — with both populations
excluded, nothing reaches it, and a member no fixture reaches is either the
fixture's fault or the branch's. What replaced it is a sentinel from the
projection helper rather than a member of the union, because it is not a
standing: it is the reason the record is not in this population at all. As a
member it would be a row on a queue about reviews saying that a review cannot
exist — another screen's finding wearing this screen's shape.

**The test asserts the pair, not each half.** The defect was that the two were
treated differently, and a test for each in isolation would have passed on the
asymmetry. Proved by putting the unwritten domains back and watching two tests
fire.

### `MIN_REVIEWS_FOR_A_RATE` — approved at 8

Frank's framing, which is an amendment to Rule 4 rather than a local decision
and is going into the PRD: rendering the denominator is necessary and not
sufficient. "100% — 2 of 2" is true and still invites a judgement two records
cannot support. Below the threshold the figure does not render at all — it
shows Insufficient Evidence with the coverage.

**The first use of §2.3 outside the compliance dashboard it was designed for**,
and it belongs there for the reason §2.3 exists: what is missing is evidence
rather than performance.

### Three §8 entries

**A proxy for a rule is a second rule, and two rules drift** — in whichever
direction. Here it failed on a screen that was working, which is the direction
that gets working code changed to satisfy a broken test; the other way round it
passes while the branch it protects goes dead. Same defect, different-looking
failure. Assert through the thing itself.

**A fact you intend to derive is only derivable if the record keeps what it is
derived from.** Lateness was not hidden, it was absent. And what a derivation
compares against may not exist — which is why the field is a union rather than
a date. **Frank's connection: the same shape as a stock count with no opening
balance.** The comparison has two inputs and the missing one is a state, not a
zero.

**A suite that goes green on the first run of new tests deserves a look at
whether the tests can fail.** Third time this instinct has paid.

### `no_record_to_review` — a distinct shape from the standing checks

Frank's framing, and it is not the check §8 already lists:

> It was not a member no fixture reached — it was a member that only existed
> because the population had been drawn wrongly, and once the population was
> right it had nothing left to describe.

The existing check asks *does anything reach this branch?* This one asks *what
is this member for?* — and the answer was: to describe why a record is outside
the set. **That belongs to the projection, not to the standing.** A union
member saying why a record is not in the population is a category error,
because the union's job is to say where a thing has got to, and something
outside the set has not got anywhere.

The tell is that the member could only ever carry one value, and that value was
a reason rather than a state. It is now a sentinel returned by the helper that
builds the population, where it means "do not include this" and disappears at
the boundary — which is exactly its scope.

Worth keeping because the fix looked like deleting dead code and was not: the
code was reachable and rendering right up until the population was corrected.

## Phase 8 — Goals: types and fixtures

Screens wait for the references. Types, fixtures and their guards are built,
because the shapes were settled and everything else depends on them — and
because probing before building is what has caught the last four phases' worth
of unreachable states.

### One constant, not two

`NO_GOALS_ALERT_DAYS = 30`, from admission, under 2b. Frank's correction and it
is the sharper reading: *"past its target date with nothing recorded" needs no
constant at all — the date is the threshold, and it is the goal's own.* Two
meanings that happen to share a number would have moved together when only one
of them should.

### What a goal is, and what it is not

Written into the type, because if the answer had been "it is an agreed action
with a date" then two screens would hold the same thing:

- **A care plan action is standing; a goal is finite.** "Offer an arm on the
  corridor" is done every shift forever. "Walk to the dining room without my
  frame by Christmas" happens once or not at all.
- **An action is the home's method; a goal is the resident's intention.**
- **An action cannot fail.** Whether it was followed is a compliance question
  about the home. Whether a goal was achieved is a question about a person, and
  the answer may be no for reasons that are nobody's failure.

The link to a domain is deliberately thin: the goal is the outcome, the domain
holds the method. A goal that restates the domain's agreed actions is a
mis-filed care plan action, and `statement` is first person to make that
visible.

### The union: one member removed, one split, one added

**No `in_progress`.** As a stored status it is the stalest claim in the
product: set once, never revisited, and a goal nobody has touched in eight
months still saying somebody is working on it. Derived from the progress notes,
which carry their own dates and authors — so it cannot go stale, and the lead
finding is derived with it.

**`abandoned` splits.** `withdrawn_by_resident` is somebody exercising a right
over their own life; `stopped_by_service` is something that happened to them.
Merged, a family cannot be told which it was.

**`ResidentView` on every closure — `agreed · disagreed · not_asked`.** Frank's
argument, and it is the reason the module exists: every other record in this
build is somebody's account of a resident, and this one is a claim about
whether a person got what *they* wanted. Staff marking a goal achieved over
somebody who does not think they did is the invariant failing in the one place
where the subject is the person themselves. **`not_asked` is the default and
renders as the gap it is** — and it applies to every closing state, of which
"stopped by the service, resident not asked" is the sharpest.

### The type permits a combination the world does not

`withdrawn_by_resident` with `residentView: not_asked` — you cannot record that
somebody withdrew their own goal without having heard from them. `disagreed`
stays coherent (staff record a withdrawal the person later says was not what
they meant); `not_asked` does not.

**Fixed in the fixture and raised rather than narrowed in the union**, because
narrowing one member's view is a shape decision. Guard added, and proved by
allowing it back.

### The first draw of the fixtures was wrong four ways

Every one of them found by probing rather than by a screen:

| | first draw | after |
| --- | --- | --- |
| goals | 21 | **48** |
| `disagreed` | **0** — unreachable | 3 |
| no target date | 1 | 10 |
| open past its date | 3 | 5, one with no progress at all |
| goals dated **before admission** | 12 | **0** |
| residents here too briefly to say | **0** | 1 (Sowande) |

Two of those are wrong on the facts rather than thin. **A goal dated before the
person was admitted is impossible**, not sparse — the same class as an incident
closed a day and a half from now. And a resident admitted yesterday had four
goals, which is not a home.

Both are fixed by one rule that is not a threshold: goals accumulate at a rate,
so somebody here a day has none and somebody here two years may have four.
`DAYS_PER_GOAL` is a rate, deliberately not the alert constant — **that makes
"here too briefly to say anything" fall out of the data rather than being
asserted on top of it**, which is the same shape as the resident who cannot yet
be missing a 48-hour care note.

The third was `continue` on a duplicate draw, which silently produced fewer
goals than the count said — the spread described a home the generator was not
building.

### `pronounsOf` had drifted into being private

It was an unexported helper in `care-notes.ts`, and the second module needing
it was one copy away from having its own. Moved to `pronouns.ts` where it
belongs. Two copies of a fallback rule drift in whichever direction, and this
one decides whether "his" appears on a woman's record.

40 test files, 880 tests.

## Layout pass — Incidents and Risk assessments

Done against screenshots rather than against the source, which is the only
reason three of the five were diagnosed correctly. Headless Chrome, no new
dependency.

### 1. One module had its own content width, and a third inside it

`.page` in the incidents stylesheet carried `max-width: 960px` — the reference
measure for the report *form* — and the incident **log** shares that class, so
the whole module stopped two thirds across while every other queue filled the
container. `.detailPage` had a third width of its own, `1080px`.

Both gone. The shell owns the width (`--layout-max-width`); a form that wants a
narrow measure constrains its own fields, never the page. `.detailPage` was
then identical to `.page` and has been deleted rather than left as a class
whose only content was a width that no longer exists.

**Swept the other modules**: incidents was the only one. Frank's reason for
asking is the right one — one module with its own width is where the others
learn to have one.

The report form now spans the full width and reads better than expected: the
two-up fields fill, the four harm tiles spread, and it matches the care plan
editor rather than being the one form shaped differently.

### 2 and 3. The lead cards were rendering as columns

This is the one the source would never have shown. `.findingLead` composes
`unrecordedPanel`, which is a **flex column**, and then sets `flex-direction:
row` — and the composed rule was winning. Every lead card in the build was
stacking its figure above its body.

So the "large empty region below the description" was not padding and not the
content: it was a card laid out the wrong way round, taller than a row of the
same material. **Compensating with padding would have made it worse and hidden
the cause.**

Fixed at the source rather than by fighting the cascade: these cards compose
`unrecorded` — the treatment, dashed border and hatch — and draw their own box.
They wanted the hatch, not the panel. Four modules had the same latent bug:
incidents, risk, reviews, care plans.

`align-items: stretch` on each findings row, so the cards are equal height and
read as one comparison. Each card still lays its own content out from the top.

### 4 and 5. The flexible track was in the middle

On both queues the `1fr` column sat between the content columns, so it absorbed
every pixel of slack and pooled it into one lake — before the state chip on
risk, before Open on incidents. Content-sized columns now, packed left.

Two things this turned up that only the screenshots showed:

**Proportional columns do not fix it.** I tried `1fr 1.4fr 1.3fr auto` first;
it spread the same slack across three gaps instead of one. The rows genuinely
have less content than the container is wide, and no column arrangement
invents content — the honest answer is to pack left and leave the tail.

**An `auto` track absorbs leftover space, and a grid item stretches to its
track.** So on the care plan queue the primary "Write this domain" button
stretched half the row. `justify-self: start` on every row action, in all four
queues.

Reviews and care plans had the same row defect and were fixed with them —
leaving them would have guaranteed the drift the width fix was about.

Screens read back: `/incidents`, `/incidents/new`, `/incidents/inc-901`,
`/risk-assessments`, `/reviews`, `/care-plans`.

## Layout pass, second round — the register cards and the report form

### The controlled drug register had the same card bug

`.findingNever` composed `unrecordedPanel` and overrode `flex-direction: row`,
which is the defect from the first round in a sixth place. Fixed the same way
— compose the treatment, draw your own box — and `align-items: stretch` on the
row so the two cards are one comparison rather than two.

**Six modules had it in total.** That is worth noting about `composes`: a
property the composed class sets is not a default a composer can rely on
overriding, and nothing in the source makes the loss visible. It was found by
looking at a screenshot, twice.

### The form's fields were misaligned because a Select has no label

`Select` took a `label` prop and used it only as an `aria-label`, so in a
two-up grid a select cell had a bare control and a text cell had a label above
its input. **The columns were perfectly aligned and the fields were not** —
they started at different heights because one had a label and the other did
not.

`labelVisible` renders the label as a real `<label>` and drops the
`aria-label`, so the visible text *is* the accessible name rather than a second
one saying the same thing. Off by default: a filter pill row carries its
meaning in the placeholder and a label there is noise.

Three more things had to match before it actually lined up, none of which the
source would have shown:

- **The label treatment.** Caption, uppercase, ink-500 — the form's, not a new
  one.
- **The gap between label and control.** The Select's field used `--space-8`
  and the form's `--space-4`: labels level, controls four pixels out.
- **The control metrics.** The form's `.input` had a 1px border and a
  different radius against the trigger's 1.5px — a different shape as well as a
  different height. And a native `datetime-local` sizes to its own internal
  line box, so `min-height` left it short; it takes an explicit height.

### A chosen option was saying so with colour alone

The subject, harm and injury cards are `role="radio"` and marked a selection
with a tinted border and nothing else — colour as the sole carrier of meaning,
which §7 forbids and which is invisible in greyscale. Each now carries a mark:
an empty ring until chosen, a filled tick after. It says the card *is* a choice
before anybody clicks it, as well as which one is taken.

**Driven by the prop, not by a parent class.** A descendant rule off
`.choiceSelected` would have styled the subject and injury cards and silently
done nothing on the severity tiles, which carry `.severitySelected` — a
permanent empty ring on the row where harm is chosen. The kind of thing that
looks right in the source and is wrong on screen, which is what this whole pass
has been about.

## Phase 8 — Goals, built

Four screens to `docs/goals.html` — the tab, the tab where nobody has set one,
the goal detail with its timeline, and the queue — plus the form, built from
the care plan editor precedent.

### The narrowing, and why a guard was the weaker version

`withdrawn_by_resident` now carries a `GoalEnding` rather than a
`GoalClosure`: no `residentView` at all. Frank's argument goes further than
mine did and is right — **asking what somebody thought of their own decision is
incoherent whichever value it takes**, `agreed` included. A person agreeing
with themselves is not a record of anything.

The fixture guard I had written is deleted, and its absence is noted in the
test file so nobody adds it back and concludes the rule is untested. **A guard
reports the mistake after somebody writes it; the type stops them writing it.**
Four call sites had to narrow on `kind` first, which is the compiler doing the
work the guard was doing by hand.

### The empty tab is the screen

No list, because there is nothing to list — a table header over an empty body
says the opposite of what the screen is for. And it names how long they have
been here, which is `NO_GOALS_ALERT_DAYS` doing visible work rather than
sitting in a constant: **"no goals set" means nothing about somebody admitted
yesterday and a great deal about somebody here three and a half years.**

Both sides are reachable. Eight residents alert (91 to 1348 days) and Sowande
is excluded at two days, where the screen says the window has not elapsed
rather than rendering the same finding at him.

### `formatDuration` — a seventh owner, and it absorbed the sixth

The empty tab rendered **"they have been here 42 months"**. `formatLateness`
switched days → months and stopped there, which is fine for a review three
weeks late and useless for somebody here three and a half years.

"How long" is one question — how overdue a review is, how long somebody has
lived here, how long a goal has gone unanswered — so `formatDuration` owns it
and `formatLateness` is a name for one use of it. Days below two months, months
below two years, then years and months.

The property test needed its parser widened to read the new unit. **That is the
rendering gaining a unit, not the property moving** — the assertion still says
no rendered span may be more than half its own unit from the truth, now across
4,000 day-counts.

### Three treatments that had to be right, each proved by breaking it

**Not achieved is not a failure treatment.** Plain border on
`bg-surface-sunken`. Critical and caution are for things somebody must act on;
a goal that was not reached is a thing that happened to a person, and a warning
colour turns the record into a judgement about them.

**"Not asked" renders as the gap it is**, on every closure that carries a view.
A family reading this later is entitled to know whether the person was asked.

**A withdrawal carries no view**, and the screen agrees with the type.

Each proved by mutation: giving not-achieved the positive treatment, rendering
not-asked as agreed, and growing a view on a withdrawal. All three fire.

### The reachability guard learned to render

`goals/new` is a routed profile screen with no tab, reached from the empty
tab's only action. Unlike the whole-plan review, whose link comes from the
projection and can be read as data, **this link is in JSX** — so the proof
renders the tab and collects its hrefs. The file is now `.tsx` for that reason.
Proved by pointing the link elsewhere and watching it fail.

### And an absence assertion matched something that was supposed to be present

`expect(container.querySelector('ul')).toBeNull()` — written to prove the empty
tab has no list — matched the **profile header's risk flags list**. The test
failed on a screen that was working, for the third time in this build by the
same mechanism. Anchored to `[data-goals-panel]`.

## The layout pass, finished — and why I said it was done when it was not

Four of the five were in place. The incidents row grid was not: it was still
the proportional version I had tried and rejected, not the fixed-column one I
reported landing.

**The cause is worth more than the fix.** The edit that was supposed to apply
it was a `str.replace` with no assertion, and Prettier had already wrapped the
declaration across two lines — so the search string did not match, the replace
did nothing, and the script printed "done". **An operation that reports success
while doing nothing** is the same class as everything else this build keeps
finding, and I shipped a report on the strength of it.

The screenshot did not catch it either, because at 1600px the proportional and
fixed-column versions look similar. So: **read the source back after an edit
that a screenshot cannot distinguish.** Every subsequent edit in this pass
asserted its match count and printed what it applied.

Both screens read back afterwards. Incidents now matches risk: resident, state,
type, severity and Open packed left as one line.

## The absence-assertion check is a script now, not an entry

Frank's instruction, and the general form is worth keeping:

> A standing check that has not prevented a recurrence after three tries is not
> a check, it is a note. Either it becomes enforceable or it stops being
> counted as coverage.

`scripts/check-absence-assertions.mjs`, wired into `npm run lint` beside the
hatch, tel and plural checks.

### The rule took three attempts, and the first two were instructive

**Attempt one — scope.** Flag any negative assertion rooted on `screen`,
`document` or `container`. It reported **78 findings**, nearly all of them a
positive assertion sitting above a negative one, because it read a four-line
window and joined each assertion to the next. A check that cries wolf is a
check somebody turns off.

**Attempt two — scope, per assertion.** 21 findings, all real page-rooted
queries. But twenty of them were *correct*: `'Review'`, `'Balance after'`,
`/^Acknowledge/i`. Scope was not the discriminator.

**Attempt three — specificity.** Every recurrence used a **loose matcher**:
`/Acknowledge/i` matched "Not acknowledged", `'ul'` matched another list.
Every correct page-wide assertion names its target exactly. So the rule is: a
negative query must be rooted on an element the test chose, **or** name its
target specifically — a `[data-*]` hook, an exact string, an anchored pattern,
or three words. Five findings, every one the real shape.

### And the check passed on the exact defect it was written for

Mutating the goals test back to `container.querySelector('ul')` did not fire
it. The assertion slice ran to the *next* `expect(`, which pulled the following
test's `[data-*]` markup into this one and made a bare `ul` selector look
specific. Bounded at its own matcher, it fires — and the tighter bound
immediately surfaced two more genuine findings the loose slice had been
masking.

**A guard has to be proved against the case it was written for, not only
against a case.** This one was written from three known defects and passed on
one of them.

### Four fixed, one opted out

`/edit/i` → `/^Edit/i`; `/mark reviewed/i` → `/^Mark reviewed/i` in two files;
`/undo review/i` → `/^Undo review/i`; a bare `table` selector scoped to the
register card. One `// absence-ok:` where the claim really is page-wide — no
dialog open anywhere — with the reason on the line above and the count printed
so it cannot quietly grow.

## Phase 9 — Activities, built

Three screens to `docs/activities.html` — the week calendar, the recording
grid, and the plan drawer — plus the list arrangement, which is the same data
in the ninth queue's shape rather than a fourth screen.

### The four session states, and why only one is a gap

`planned · unrecorded · partly_recorded · fully_recorded`, all derived. **A
planned session takes a dashed purple border, not the hatch**: nothing has
happened yet, so nobody has failed to record anything, and the hatch would say
"this should have been written up" about an afternoon that has not arrived.
Proved by giving planned the hatch and watching the guard fire.

All four reachable in the fixtures — 21 fully recorded, 12 partly, 10
unrecorded, 8 planned.

### Attendance is this module's MAR cell

`attended · did_not_attend(reason) · not_recorded`, mapping onto the precedent
exactly: **`did_not_attend` is a recorded negative and looks settled** —
"declined, said she was tired" is a complete record of a person exercising a
choice — and `not_recorded` is the gap. The same distinction `not_given` and
`omitted` draw, for the same reason.

Choosing "did not" asks why and cannot be saved without one, because a negative
with no reason is indistinguishable from nobody having looked, which is the
whole point of the third state.

**A session nobody wrote up renders one hatched row per invited resident, never
"0 attended".** Zero attended says nobody came; nothing recorded says nobody
wrote it down. The tally's four cells all count over the invitation list.

### §2.4 applied per row

Every row carries the avatar, the preferred name, the **full legal name** and
the room — and each answer control names the person in its accessible label. On
a grid the failure is not picking the wrong person from a list, it is slipping
a row, and that identity is the only thing between Doris being marked present
and Beryl being marked absent. Proved by removing the full legal name.

No row has a default: a pre-selected answer is an answer nobody gave, and here
it is a claim about somebody's afternoon.

### No "mark all", and joiners stay outside the list

There is no bulk control and the footer says why. Frank's rule for later if a
coordinator asks: the handover's answer — permit it loudly and store that it
was set in bulk, so the record cannot read as eighteen individual observations.

A joiner is recorded in their own section and **is not added to the invitation
list**, because adding them retroactively would rewrite the plan to say they
were always expected. Proved by folding joiners into the denominator: two
guards fire.

### The drawer reads the care plan and adds nothing

Activity preferences come from the social and emotional wellbeing domain in the
resident's own words. **"Never asked what they like" comes free and correctly**
— an unwritten domain *is* nobody having asked, it already renders hatched
everywhere else, and the drawer links to the screen that fixes it rather than
offering a field that would become a second place for the same fact.

### The calendar was rendering the viewer's day, not the site's

The screenshot showed Monday highlighted when it was Tuesday: `new
Date().toISOString()` is UTC, and at ten past midnight British Summer Time that
is still yesterday. **§3.6's rule arriving on a diary instead of a
timestamp** — the site's zone decides which square is today, because the
sessions in it happened there. `zonedDate` against the site timezone.

Found by looking at a picture. No test would have caught it: the suite pins the
clock to the fixture instant, where UTC and the site agree.

### One thing needing your wording

`CLAUDE.md` §6 still says "Segmented control = range". The build now uses it
for arrangement as well, on your instruction, and §6 is yours rather than mine.
It needs a line saying a segmented control means one of a small set of mutually
exclusive presentations of the same data — of which range is an instance.

## Phase 10 — Consent, built

Three screens to `docs/consent.html` — the tab, the capacity gate, the
withdrawal — plus the dashboard in the tenth queue's shape.

### The split, and the gap it closed

`ConsentStatus` is now **outcome × authority**. Five of the old six members
said what was decided and one said who, which are answers to different
questions sharing a union — and the gap that left is the argument:

**41 of the 168 recorded decisions in the fixtures are best-interests
refusals**, a shape the old type could not express at all. `best_interest`
implied a positive by omission, so a process that decided *against* something
had nowhere to go. It is now the second commonest authority-and-outcome pair in
the set.

`not_sought` and `pending` carry no authority, and the screen renders that as
the hatch rather than a blank — nothing has been decided, so there is nobody
who decided it.

### Blanket capacity is not expressible, and the compiler is what says so

`CapacityAssessment` carries `covers` as a **map rather than a list**, and
`ConsentStatus<T>` requires an authority holding a `CapacityAssessment<T>`.
Structural width subtyping does the rest: an assessment covering three types is
assignable wherever any one of those three is expected, and **an assessment
naming three types with a fourth consent recorded against it does not
compile.**

`Resident.consents` is a mapped type rather than a `Record`, which is what
makes each of the eight know its own key. The compiler reported
`DecisionAuthority<"photography">` on the pinned gap the moment it was wired —
that message is the rule working.

One cost, stated plainly: reading needs a widened alias. `AnyConsent =
ConsentStatus<never>` has `covers: {}`, which every assessment satisfies, and
it is what a badge takes when it does not know which type it is looking at. One
alias, one docblock, and recording still goes through `ConsentStatus<K>` where
the rule bites.

### The gate is a gate

The question stands alone and **nothing else on the screen exists until it is
answered** — no scope selector, no MCA stages, no continue. No default, because
a pre-selected answer is an answer nobody gave and here it is a legal finding
about somebody's mind. Both stages required on a lacks-capacity finding, each
named individually in the footer while empty.

All three proved by mutation: answering the gate for the user, dropping stage
two, and rendering an uncounted effect as zero.

### The pinned gap has reached a screen, five phases later

Brennan's withdrawn photography renders as **two facts** — withdrawn on
28/07/2026, and a hatched block naming what withdrawing did not undo. The
effects are **data with counts**, which is the only version that can be
asserted against: a prose note that forgot the photographs would have looked
identical to one that did.

All three count kinds are live on that one record — 14 counted, the corridor
prints **not counted**, and Family Portal access **unchanged**. The last is the
cross-module consequence: a separate consent this withdrawal does not touch,
derived from the record rather than remembered by whoever writes the note.

### Two tests failed on screens that were working

**The handover pronoun sweep** flagged "…when {their} sister is coming. She
died in 2019…" — the "She" is the **sister**, not the resident, and the guard
has no way to know. The limitation is real; the fix was to keep the fixture
pool free of third-party pronouns rather than teach the guard grammar.

**The badge strip test** took `[data-state="recorded"]` and assumed it was
allergies. A shifted fixture stream put a recorded falls risk in front of it.
**That is the unscoped-absence defect wearing a positive** — a proxy for the
thing it meant — and the fix is the same one: anchor to `[data-badge="allergies"]`.
The new lint rule does not catch positive assertions, which is worth knowing
about it.

43 test files, 945 tests.

## The absence check became a specificity check

Renamed to `scripts/check-selector-specificity.mjs` (`npm run lint:selectors`,
opt-out `// selector-ok: <why>`) and widened to positive assertions.

**The polarity was never the discriminator.** Rooted-on-a-chosen-element or
specific has nothing to do with whether the claim is that something is there;
and a positive assertion reaching for a loose selector fails in the *more*
dangerous direction — it passes on the wrong element rather than failing on the
right one.

Three narrowings were needed to keep it honest rather than loud:

- **`getBy` and `findBy` are exempt from naming.** They throw on zero matches
  and throw again on more than one, so an ambiguous name fails loudly at the
  call. The library already enforces there what this check enforces elsewhere.
  Without this, 180 findings, nearly all `getByRole('link', {name: /Reviews/})`.
- **`container` is scoped in a component test.** `render(<Thing/>).container`
  *is* the element the test chose. Only under a router does it stop meaning
  anything, which is where every recurrence happened.
- **An un-indexed `…All…` query is a sweep, not a pick** — every link on the
  page is supposed to be broad. Checked only when it claims the sweep found
  nothing.

The check flagged its own case study: the docblock in `goals.test.tsx`
explaining which selector went wrong contains that selector, and the note about
the defect read as the defect. Comments are now blanked before scanning.

### Thirteen findings, and one was the defect again

`within(container.querySelector('header')!)` on the incident log — page-level,
so `header` matches the app shell's top bar before the log's own head. Anchored
to `[class*="logHead"]`, matching the line above it.

The `container.querySelector('table')` sites became `getByRole('table')` /
`findByRole('table')`, which is not a dodge: it is the version that fails when
a second table appears.

Proved by adding `expect(container.querySelector('ul')).toBeTruthy()` — the old
defect wearing a positive — and watching it flag.

### What the widened rule still does not catch, and why

**`container.querySelector('[data-state="recorded"]')` still passes**, because
an attribute selector counts as naming. The badge defect is not a loose
selector, it is a selector that names a **condition** where the test meant an
**identity** — and lint cannot tell those apart:

- Deriving conditions from the source (attributes emitted with two or more
  distinct literal values) separates `data-state`, `data-finding`, `data-gap`
  from `data-badge`, `data-field`, `data-domain` correctly — then calls
  `data-tally-cell="invited"` a condition, which is an identity by value. 85
  findings, false positives among them.
- Listing condition words by hand is a list somebody has to maintain, and a
  check nobody maintains goes stale silently.

The mechanism that would work is runtime, not static: **a pick that matches
more than one element should fail**, which is exactly what `getBy` does and
`querySelector` does not. That is a helper, and it costs the 416 page-level
`container.querySelector(` sites in this suite. Put to Frank rather than
decided here.

## Phase 11 — Documents, built

Three screens to `docs/documents.html` — the resident library, the
organisation library, the upload drawer — plus expiry tracking in the settled
queue shape. 356 documents across two sites.

### Two constants became one each

`REVIEW_DUE_SOON_DAYS` → **`DUE_SOON_DAYS`**, and expiry reads it. An expiry
date and a review's due date are the same kind of instant — a deadline
somebody has to beat — and 30 written twice is two figures that agree today
and are one edit away from disagreeing.

`MIN_REVIEWS_FOR_A_RATE` → **`MIN_POPULATION_FOR_A_RATE`**, moved to
`data/types/aggregate.ts` beside `Aggregate` itself. It was always the general
rule wearing one module's name. PRD §9.2b still names both by their old names;
that is Frank's file to correct.

### Does-not-expire is a decision with somebody's name on it

`ExpiryDecision` has three members and the middle one is the argument:

    | { kind: 'expires'; on: IsoDate }
    | { kind: 'does_not_expire'; decidedBy: StaffRef; on: IsoDate }
    | { kind: 'not_recorded' }

`expiresOn?: IsoDate` would make a considered judgement and a document nobody
has looked at the same value. The screen renders the name, because plain text
saying "Does not expire" with nobody against it is indistinguishable from an
assumption made while filing.

**The three findings are never summed.** Expired takes critical, expiring
takes caution, and no-expiry-recorded takes the hatch — one "needs attention"
number would weigh a lapsed DNAR and an unclassified photograph the same.

### Empty is not always emptiness, and the sharpest case is cross-module

A category with nothing in it is quietly empty. A category another module's
record says should hold something renders the hatch, naming what is missing and
where the expectation came from. Four sources, all derived: an admission that
happened, a consent taken in writing, a care plan somebody finalised — and
**Brennan's withdrawal**.

Withdrawing his photography consent recorded 14 photographs it could not undo.
His Photographs and media category holds nothing. Those two records disagree,
and the library says so in his own record's words. That is Phase 10's counted
effect reaching a screen it was not written for, checkable from data rather
than remembered by whoever wrote this one.

22 expectation sites across 32 residents and seven categories — enough to reach
the branch, few enough not to drown it.

### Four phases of ids that pointed at nothing

DNAR, ADRT, LPA and scanned prescriptions have carried `documentId`s since
Phase 1 with nothing behind them, and **none was rendered anywhere**. They now
either resolve to a document or render as a finding: hatched, unlinked, naming
the id, the module holding it and what that module says. 93 resolve; 29 do not,
across 18 residents, at most three each.

There is no third option where an id quietly means nothing.

### Where the reference was not followed

**Nothing says "Open".** The reference gives real documents an Open button and
broken ones a disabled "Cannot open". But there is no file behind a fixture
document either — the format and size describe a document that exists on paper
somewhere — so an enabled Open would hand somebody nothing. Every row says
which kind of nothing it is: "Not retrievable here", or "Cannot open — not on
file". Same discipline as the export stub, applied to the reference itself.

### Three defects the screenshot caught that the tests did not

**"Filed by C. Nwosu, 02/10/2025 01:00 BST"** — an hour nobody recorded. A
filing date is a *date*; widening it to midnight UTC and rendering it through
the site's zone invented a time. That is the §8 instant-kind entry from the
other direction, and the fix has one owner (`FiledBy`) rather than a format
call at each site.

**A broken reference printed its own title three times**, because the origin
detail repeated what the row already said.

**"It holds Photographs, video and audio"** — a capitalised fragment
mid-sentence. Fixed in the constant rather than with a `.toLowerCase()` at the
call site, which would have turned "DNAR" into "dnar".

### Proved by mutation

Five guards, each broken on purpose and each caught: iterating categories from
the data instead of the constant; collapsing an expected gap into plain
emptiness; offering a broken reference as a link; treating an unanswered expiry
as permanent; and moving the 30-day boundary off its own edge.

44 test files, 976 tests.

### The lapsed DNACPR is pinned, and it is deliberate

`doc-dnar-0041` now carries a fixed expiry rather than one drawn from the
spread: **a resuscitation decision the badge strip shows as in force, resting
on a document that has lapsed.** Some DNACPRs are genuinely time-limited
pending review, so this is a real situation rather than a contradiction — and
it is exactly the case somebody should meet in review, which is why it cannot
be allowed to vanish on a re-roll.

**Three months, not the seven the accident drew.** Emmanuel's DNAR was signed
180 days ago, and a document cannot lapse before the decision it records was
made — the accidental version was incoherent as well as unrepeatable. The
pinned expiry sits after the signature and before today, and the guard asserts
that ordering rather than the number of months.

Written literally rather than drawn, so the random stream is untouched and
every other document is where it was. Proved by moving the expiry into the
future and watching both guards fail.

## Phase 12 — CQC Compliance and the Dashboard, built

Five screens to `docs/compliance-dashboard.html`: the Dashboard at `/`, the
compliance overview, a Key Question drill-down, the inspection pack, and the
statutory notifications queue in the settled shape.

### Insufficient Evidence reached the screen it was designed for

Approved before Phase 0, used in reviews and documents since, and this is the
first screen built for it. **Two floors, and they compose.**
`MIN_POPULATION_FOR_A_RATE` is a floor on one rate's denominator;
`INSUFFICIENT_EVIDENCE_THRESHOLD` is a floor on how much of a panel can
support a figure at all. A check below the first becomes Insufficient
Evidence; a panel with fewer than three in five usable checks becomes
Insufficient Evidence itself.

**An unusable check does not count toward the threshold** — the same argument
as the Phase 7 denominator exclusion. Proved by letting them count: one real
green check and four thin ones rate the panel green.

### Three kinds of absence, and the third is new

- **A finding** — green, amber, red.
- **Insufficient Evidence** — the hatch, stating coverage instead of a rating.
- **Not held here** — solid `bg-surface-sunken`, plain border, **no pattern**.

The third is the one this phase added, and the argument for its own treatment
is that the hatch already means two things and both are actionable. "Staff
training is not recorded in diGi-Care" is actionable by nobody on any screen,
and giving it the hatch would send a manager looking for a screen that does not
exist. It is listed, never counted, never rated, and its wording says the
product does not record the thing rather than that the home has not done it —
enforced by a guard that reads every statement.

**Eight of them across the five Key Questions**: staff training; supervision
and appraisal; induction; dignity observations; resident and family surveys;
complaints as records; audits; the policy review cycle.

### Everything at Rosewood is Red, and that is the rule rather than the data

Worst-of over five to nine checks in a home with any real gaps returns red
every time. Rosewood rates red on all five panels; Ashgrove, the deliberately
thin site, returns Insufficient Evidence on three.

That is worth saying plainly: **a rating rule that always returns red is as
uninformative as one that always returns green.** It is a true property of
worst-of, not of these fixtures, and it is the strongest argument for the
placeholder banner the screens carry. Green and amber are reachable and do
render — on the drill-down, where the per-check ratings live, all four states
appear on one screen.

### The Dashboard shares the machinery and shares no figure

Deadline-shaped, over today, ordered by how long. **Nothing on it is green and
no compliance percentage appears anywhere** — a tile with nothing wrong renders
calm, plain surface and an ink-700 figure. Both proved by mutation: a positive
tone and a "Compliance 92%" tile each fail a guard.

Every tile carries its population. The overdue tile's breakdown — "4 doses · 23
reviews past its date · 1 handover unsigned" — is a decomposition rather than a
denominator, and the guard caught that: it now ends "across 28 residents".

### The instant-kind class landed for the third time, so it became a rule

A review's `dueOn` widened to midnight printed **"01:00 BST" against every
overdue review on the Dashboard** — an hour nobody recorded, on a record whose
whole content is a day. Same class as the Phase 7 clamp and the Phase 11
`filedOn`.

Fixed with a union — `Deadline` is an instant or a date, and the column cannot
render a date as a time because a date does not have one — and enforced by
`scripts/check-instant-kinds.mjs` (`npm run lint:instants`, opt-out
`// instant-ok: <why>`). A date widened by string concatenation is a finding
unless `new Date(` consumes it on the same line, which is arithmetic.

It found a third site nobody was looking at: `PrescriptionsTab` widening
`startedOn` to 09:00 for a relative-time note. Benign — the hour never reaches
the screen — and it now says so in a comment rather than by nobody having
noticed.

**What it does not catch**, stated because a guard whose limits are unstated
reads as broader coverage than it has: the original clamp defect, where a
helper written for signatures was applied to deadlines. That is a function
applied to the wrong kind of instant, not a string shape, and the tell still
has to do the work for that half.

### Two guards from earlier phases caught this one

`never-written-up` caught the Dashboard spelling out its own "Never written up"
label instead of using the component that owns those words. `check-plurals`
caught `${OMISSION_WINDOW_DAYS} days` agreed at the call site. Both were
written for defects in other modules and both fired on new code without being
touched.

The dashboard's own date-kind guard was too loose on its first pass: it
asserted "at least one row is a date", which the unsigned handovers satisfied
while every review was widened. It now names the reviews by reference — the
§8 specificity defect, wearing a positive, in a test I had just written.

### `dueWithinTwoHours` became `dueWithinLookahead`

The figure was written twice and named neither time: the fixture generator
marked a record `due` inside `2 * 3_600_000`, and a function called
`dueWithinTwoHours` claimed the same window in its name while its body only
read the state the generator had set. Now `MEDICATION_LOOKAHEAD_HOURS` in
`lib/shift.ts`, read by both, with the profile header's label and its test
derived from it rather than retyped.

Not parameterised as `dueWithin(hours)`: the state is baked at generation, and
a function accepting an argument it could not honour would be worse than one
that says which rule it applies.

46 test files, 1,019 tests.

### The rating now names the check driving it

`PanelVerdict` carries a `driver` — the worst usable check, its name and its
figure — and the panel renders that instead of "worst of 9 usable checks". The
rule is unchanged; the screen went from five identical sentences to five
different ones:

- **Safe** — risk assessments completed, 78 of 252 never assessed
- **Effective** — decided consents resting on a capacity assessment, 161 of 224
- **Caring** — closed goals recording what the resident said, 11 of 21
- **Responsive** — goals still open past their date, 5 of 15
- **Well-led** — documents carrying an expiry decision, 69 of 306

Ties break on the lower figure and then on declaration order, so the same
record always names the same check. Asserted rather than assumed: a guard
requires the five drivers not to be the same id.

**Why the uselessly red screen is worth keeping rather than tuning.** A rating
rule that always returns red is as uninformative as one that always returns
green, and this is the strongest argument the placeholder banner has — it is
easier to make the case for sourcing a real framework from a screen that is
visibly inadequate than from one that looks plausible. Tuning the bands until
the panels varied would have hidden exactly the property that makes the case.

**A dead branch fell out of it.** `bandFor` took a `Polarity` and carried a
second pair of bands for failure rates, and no check ever used them — every one
is framed as coverage. A branch no fixture reaches is the §8 rule applied to
code rather than to a screen, so the argument and both bands are gone.

### The lookahead constant cannot be changed by itself

`MEDICATION_LOOKAHEAD_HOURS` is read in two places and only one of them is a
render: the fixture generator decides which MAR records are `due` **at
generation time**, and `dueWithinLookahead` reads that decision. Changing the
constant therefore means regenerating, not re-rendering — worth knowing before
somebody edits it and wonders why nothing moved.

That is the price of not parameterising it, and it is the right price. A
`dueWithin(hours)` signature that could not honour its argument would be a lie
in the type.

### A guard I wrote failed to catch the defect I wrote it for

The Dashboard's date-kind guard asserted that *at least one* row rendered a
date. Every review was widened to an instant and it still passed, because the
unsigned handovers were dates and satisfied it.

**The specificity defect wearing a positive, written minutes after the §8 entry
describing it, by the person who had just written that entry.** Familiarity is
not the defence — the mutation is. It now names the reviews by reference and
fails when they are broken. New §8 line records the general form.

## Phase 13 — Reports, built

Two screens to `docs/reports.html` — the index and the report view, including
the per-staff variant — and eight reports behind them. The seven questions that
would have been a compliance check with a table under it are drill-downs from
that check, listed on the index so nobody concludes the product cannot answer
them.

### The first period in the build

Nothing before this carried one: the compliance panels are all-time or a fixed
window and the queues are "now". `Period` is a from, an inclusive to, and a
length, and `previousPeriod` is always the same length — a 30-day period
compared against a 27-day one would make a home look better for having been
measured over less time.

**Two of the eight are states rather than flows.** Consent coverage and the
document expiry forecast are snapshots, and comparing today's snapshot with one
nobody took is a number with nothing behind it, so the comparison control is
absent with a sentence saying why.

**And five of the eight have no comparison column even though they are flows.**
`comparison` is therefore its own field rather than derived from `dimension`: a
toggle that changes nothing is worse than no toggle, and the guard asserts that
a report offers the control exactly when a column moves with it.

### Comparison is on rates, not counts

Eleven omissions against 420 doses and six against 180 are the same direction on
counts and opposite directions on rates, and the rate is what the row states.
Where either period is below the floor there is nothing to compare and the cell
says **No comparison** rather than printing a change nobody measured.

### The staff report, and the column that could not honestly exist

The reference has a "doses with no record" column per staff member. **It cannot
be filled.** An omission is a dose nobody recorded, so it carries nobody's name,
and attributing one to whoever else was on shift would invent exactly the
accusation the note above the table warns against. The column is gone and the
restated line says why.

The rate column has the same problem in a subtler form. A staff member who
recorded nothing has a coverage of 0 of 28 residents — a denominator that
supports a rate perfectly well — and **"0.0%" against somebody who did not work
is an accusation, not a measurement**. `rate()` now takes the population that
decides whether a figure is supportable, separately from the denominator, and
the staff report passes what that person actually did.

Ordered by name, and the guard fails if it is ordered by any figure.
Deactivated staff stay on the table, marked.

### Two defects the screenshot caught

**"By drug" rendered one row per prescription.** Keyed on the medication id,
morphine appeared three times and paracetamol three times — a per-resident
table wearing a per-drug label, which cannot answer the question the report
exists for. Keyed on the drug and its dose, with the row saying how many people
are on it, the denominators are large enough for the comparison to mean
something and the leading figures change from 4 of 89 to 14 of 1,068.

**`activities_coordinator` printed raw** — a machine identifier in a column
about a person. `STAFF_ROLE_NAMES` is now a `Record` keyed by the union, so a
role added without a name is a compile error rather than a screen defect.

### One owner for "doses due"

`fellDueAt` moved out of the omissions read and into the fixture layer. The
reports module counts the same denominator over two periods at once, and a
second copy would be two definitions of "doses due" that agree today and
disagree after one edit — on the figure a medication error rate is a fraction
of.

### Thin data, marked before opening

Every report is run against the default period to draw the index, so the ones
that cannot say anything are hatched there. Running eight reports to draw a
list is more work than a list usually does, and it is the point of the screen:
the alternative is a reader opening a report to be told it has nothing to say.

Controlled drug reconciliation is thin at both sites — no drug has eight
routine counts in 30 days — which is exactly what the reference predicted.
Ashgrove is thin on six of the eight, which is what the four-resident site is
for.

47 test files, 1,045 tests.

### All three Phase 13 corrections ran in one direction

They were about attributing things to people, and the worst was mine: a
"doses with no record" column per staff member, placed beside a note warning
against exactly that inference. **The note would have read as a disclaimer on a
column that should not have existed.**

The tell generalises, and is now a §8 entry: when a screen needs prose to stop
a reader drawing the obvious inference from a figure, the question is whether
the figure belongs there — not how to word the prose better.

The other two were the same instinct at smaller scale: "0.0%" against somebody
who worked nothing, and a table that could be read as a ranking unless it was
ordered by name. All three came from building the shape a reporting tool
usually has rather than the shape this record can honestly support.

## Phase 14 — Team Management, built

Four screens to `docs/team.html` — the list, a staff detail, a staff detail
for somebody who has left, and the permission matrix — plus the session
activity log in the settled timeline shape.

### "(deactivated)" is derived now, and it touched six modules

`StaffRef.isActive` was a fact about **now** stored in a record about **then**.
The reactivation case is the argument: bring somebody back and every historic
note would still have called them deactivated.

So standing lives on a `StaffMember` in the team store, `StaffRef` stays the
snapshot every record carries, and the decoration has one owner — `staffLabel`,
which reads current standing at render time. `formatAttribution` and
`formatAttributionOn` lost their `isActive` argument entirely: whether the
author still has access is not a formatter's business.

Twenty-three files changed. **And not one test failed**, which is the finding:
the marker rendered in six modules and nothing anywhere asserted it except one
unit test on the formatter. The team suite now pins it, by flipping a standing
and watching the label follow.

The word changed too. "(deactivated)" was system jargon; the suffix is now
"(no longer has access)", with "(access suspended)" and "(never had access)"
beside it — one owner, two forms, the `INCIDENT_TYPES` shape.

### Standing has four members and one of them is a gap

Has access is quiet plain text. No-longer and suspended are settled, with
when, why and who. **Never given access takes the hatch** — somebody who
appears on the record and was never set up is a gap rather than a decision
anybody made, and it is the one standing nobody chose.

Every member carries an author, including the gap: whoever added them to the
team and never set up access. A standing with no author is a flag, not a
record, and the guard walks all four.

### The minimum record, and the reason

Name, role, site, standing. No start date, no contract type, no employment
fields. Frank's line is the reason and it is worth keeping: **a field nobody
has asked for is a field nobody has decided how to protect**, and inventing an
employment record is how a care system starts holding HR data it was not built
to hold.

### No counts on the staff detail

There is no rota and no shift record, so a count of what somebody recorded has
no honest denominator — and a bare count beside another person's bare count is
a ranking the reader performs themselves. Not ordering the list only stops us
doing it for them.

So: recent activity as a list, each row linking to the record, and a note
saying the figures live on the coverage report where the period and the
denominators are stated. The guard asserts there is no `[data-numeric]`
anywhere on the page.

**The "Not held here" block sits above the activity**, reusing the Phase 12
treatment exactly. A page of what somebody recorded reads as the beginning of a
performance record unless it is told otherwise first — and a note underneath
would be a caveat on a page the reader has already interpreted. Proved by
moving it below and watching the guard fail.

### The permission matrix describes this product, not the source PRD's

Fifty-four permissions across nine modules is a number from a product that has
a permission model. This one has **sixteen modules and none**, so the matrix
takes its modules from the sidebar — a matrix that does not match the product
is worse than no matrix — and its levels are the four distinctions the build
already makes: no access · read · record · approve.

The statement that nothing is enforced renders **before** the first cell,
because a grid of permissions is the most convincing thing on any admin screen
and this one decides nothing.

`STAFF_ROLE_NAMES` earned its keep immediately: the matrix has seven role
columns and would have printed two identifiers.

### The activity log is narrow because the wide one would be fabricated

Session writes only. The two things a real log answers — who read a record, and
who did something that left no trace on one — need authentication, reads and
exports, none of which exist here. The screen lists what a deployed log would
carry and says that a log claiming to hold them would be inventing its own
evidence.

It is fed from `client.ts` and nowhere else, because every write already passes
through there; a call per screen is a call the third screen forgets.

**The instant-kinds guard caught the logging code as it was written.** A care
plan finalisation carries a date and a care note an instant, and the log took
the record's own timestamp — widening the date into an invented midnight. The
fix is better than the bug: the log stamps its own entries from the clock,
because it is about this session in order rather than about the records.

48 test files, 1,069 tests.

## Phase 15 — Multi-site, built

Two screens to `docs/group-overview.html` — the group overview and the
cross-site banner — plus site settings, which needed no reference because it is
a labelled list of figures.

### The premise of the settings screen was wrong, and checking it changed the build

The instruction was that everything in §9.2b is baked into fixture generation,
so a control would move a label and not the data. **Only one of the six is.**
`MEDICATION_LOOKAHEAD_HOURS` is the sole constant any file under
`src/data/fixtures/` imports. The others — waking hours, the gap threshold,
`DUE_SOON_DAYS`, `MIN_POPULATION_FOR_A_RATE`, the Insufficient Evidence
threshold, `NO_GOALS_ALERT_DAYS` — appear in no fixture at all. They are read
while a screen draws.

So the rule stands and its application inverts: **settable if and only if it is
read at render**, which makes five of them real controls and one read-only.
Reported before building rather than agreed silently, because accepting the
premise would have made five live figures read-only for a reason that was not
true of them.

The constants became live readers — `minPopulationForARate()` rather than the
constant — across nine files. `setFigure` **throws** on a generation-fixed
figure rather than accepting it and doing nothing: a setter that silently
ignores its argument is a control that does nothing, one layer down.

### No group rating, so nothing for the threshold to gate

Frank's answer dissolved a rule I had planned. `INSUFFICIENT_EVIDENCE_THRESHOLD`
exists to gate a rating; with no group rating there is nothing to transpose, and
the two-site arithmetic problem disappears rather than needing an answer. The
group view renders coverage per site and the group's spread, and every home's
own standing beside it.

**A group figure assembled from two unusable ones is not usable**, and the
guard proves it: raise the floor above both homes' populations and every row
loses its group figure rather than gaining one from the sum. That is the whole
defect the screen exists against — summing two populations that each fall below
the floor produces one that clears it.

Site cards carry **counts, not rates**, because a count needs no population
floor. The thin tag is said once, in Ashgrove's card head, rather than on every
row it affects.

### The two site names that disagreed

The top bar named the selected home and the profile header named the record's
own, correctly, with nothing saying which governed the timestamps. Neither was
wrong; the screen was.

The banner says which — the record's own home decides — and **offers the switch
without performing it**. Navigating somebody away from a record they are reading
is the app deciding they made a mistake, and a manager covering both homes reads
across them all day.

### Two more assertions that measured the work rather than the rule

`expect(navItems).toHaveLength(17)` in two shell tests, edited every time a
module landed. The rule is that the sidebar renders every declared item, which
the per-item loop already checks; the count added nothing but maintenance. Both
now derive from the declaration.

That is the §8 entry firing twice in one phase, on tests written long before it.

### Where a changed figure is announced

On every screen, from the app shell, naming which figure moved and what it was.
**Not on a mapping of figures to affected screens** — that would be a second
rule beside the first one and two rules drift, which §8 names exactly. Every
screen is a superset and cannot go stale.

49 test files, 1,086 tests.

## Phase 16 — Admission and record editing, built

One screen to `docs/admission.html`, plus record editing across the profile and
the closing of what earlier phases left owed.

### Admission produces Ismail Sowande, and the guard says so by name

He has been that resident since Phase 0 — admitted yesterday, almost nothing
filled in — so the test asserts field by field that a newly admitted resident
is indistinguishable from him. **If admission produced anything different, one
of the two would be wrong**, and every module already renders him correctly.

**The type is what stops admission creating less.** `consents` is a mapped type
over eight keys, `risks` a `Record` over nine templates, `carePlan` an array the
screens iterate from a constant: a resident missing any of them does not
compile. Proved by cutting the consent loop to three types and watching the
guard fail.

Two things the compiler caught that a reader would not. `Recorded<T>` says
`unrecorded` and `RecordedList<T>` says `not_recorded` — the same idea, two
words, and only one of them is right per field. And `ConsentRecord` built by
spread produces a union TypeScript declines to represent, which is the mapped
type doing its job: each key knows its own consent.

### The seventh field that is not a seventh field

`Allergy` requires a severity, and the form asked for a substance and a
reaction. Adding "how bad it gets" is not a seventh identity field — it is part
of the one clinical question, and **"rash and swelling" without saying whether
that is mild or anaphylaxis is the half-record this build refuses**, on the
field where the difference is whether somebody carries an adrenaline pen.

### One correction to the plan: not everything could honestly go live

All the confirm-only *forms* now write — the risk assessment, both consent
paths, and the allergies negative. Two surfaces on the profile do not, and the
reason is the same one that keeps prescribing disabled:

**A resuscitation decision and an ADRT need a clinician's signature and a
document reference, and this build captures neither.** Recording one from the
profile with the current user as signatory would be inventing a clinical
signature. The copy no longer says a later phase will build it — it says what
the product does and does not capture, which is the "not held here" distinction
rather than a gap somebody can close.

The allergies control writes only the **negative**. Recording an allergy needs
three fields, which is a form rather than a confirmation.

### What was owed, and is now closed

- The sidebar alert said "The Reviews module arrives in a later phase". It
  shipped in Phase 7. **Nine phases stale, and nothing caught it** — the §8
  entry from Phase 15 exactly: copy that renders everywhere is the least likely
  thing to be asserted.
- Two `PendingLink`s tagged `phase={11}` now open the document library, where an
  ADRT or LPA whose id resolves to nothing renders as the broken reference the
  library was built for. The phase closes its own loop.
- **Sign out is removed rather than disabled.** No authentication exists and
  none will, so there is nothing behind it — and a disabled control implies the
  capability could exist. Same argument as the inspection pack's absent download.
- Profile opens the staff detail built in Phase 14.
- Add resident is live from both places it appears, and still absent under
  read-only rather than disabled.

### What stays stubbed, and why

- **Prescribing.** A prescriber's act; no prescriber, no directions model, no
  interaction checking. The tooltip says that rather than promising a phase.
- **The MAR export and the inspection pack.** Both name what they would produce.
- **Goals, incidents and activity attendance** still confirm without writing.
  They are the three surfaces that need their own session store rather than a
  patch to the resident record, and they are the honest remainder of this phase
  rather than something the report should claim.

### The three that wait on a care manager

Unchanged, all visible on screen, none of them mine to answer: the risk
instrument (§9.2a), the CQC mapping and the worst-of rule (§9.2d), and the
invented figures (§9.2b) — now adjustable on the settings screen, which is the
closest this build can come to letting somebody see what a different answer
would do.

50 test files, 1,099 tests.

### Two entries this phase, and one is a second occurrence

**The stale alert is the ubiquity entry landing again, one phase after it was
written.** The sidebar told every screen in the product that "the Reviews
module arrives in a later phase" for nine phases after Reviews shipped, and
nothing caught it — nothing could have. It was true when written. It renders on
every screen. It is exactly the string everybody has stopped reading.

That is the sharpening the second occurrence buys: **ubiquity is what makes
staleness invisible, not what protects against it.** A string on one screen
gets read by whoever opens that screen; a string on all of them is furniture.
The §8 entry now carries both occurrences, because one was about a value nobody
asserted and this one is about a sentence nobody re-read, and they are the same
failure from opposite ends.

**And a new entry, from the severity field.** `Allergy` had always required a
severity and the form asked for a substance and a reaction, so "rash and
swelling" was not a field somebody forgot — it was **a fact with its other half
missing**, and it reads as complete because both words are there.

The tell generalises and is worth having in the form Frank put it: not *is this
field present* but *does what this says mean anything without the thing beside
it*. A presence check finds nothing here. The question that does is whether the
value can be acted on alone, and "rash and swelling" cannot — the difference
between mild and anaphylaxis is whether that person carries an adrenaline pen.

The same test finds the next one: a dose with no unit, a score with no band, a
count with no denominator, a negative with no source. Three of those four are
already rules in this build, arrived at one at a time. This is the question that
would have found them together.

---

## The analytical restyle — Compliance and Reports

Frank approved `docs/compliance-analytical_1.html` as a restyle of the
compliance overview: same data, same rules, denser and more analytical. Applied
to Compliance and to Reports, and deliberately **not** to the Dashboard, whose
job is what is late right now.

What travelled: varied tile sizes carrying the hierarchy rather than four equal
tiles, a stacked-bar chart where the five panels were, a dense table with hover,
and `--radius-xl` (20px, already in `tokens.css` — no new token) on the outer
panels. What did not travel is its CSS and its JS; every rule here is written
against our tokens.

### The three defects reading the DOM back found

None of these was a styling problem. All three were claims the new layout made
because it had the room to make them.

**1. The footer's reason for refusing an overall figure was false.** It read
"N of 5 Key Questions cannot be rated at all, and no arithmetic turns a mixture
of ratings and unratables into a percentage" — and N was **zero**. All five
panels are rated (worst-of, all Red). So the screen's stated reason for its most
load-bearing refusal did not hold on the day it was written, and would have
started holding again, silently, the first time a panel went thin.

The hero carried the same thing one size larger: "0 of 5 — Key Questions
unratable **as a result**". Four checks that cannot support a figure had left
every panel ratable, so "as a result" asserted a causal link the data did not
support — and a zero was sitting in the one position on the screen reserved for
the least reassuring number available.

Both rewritten. The footer now gives the standing reason (five ratings taken
over checks counting residents, doses, documents and consents have no
denominator in common, so their average could not be checked against anything)
and states the current count as a fact afterwards rather than as the reason. The
hero's second sub-figure is now the Key Question worst affected — "2 of 9 on
Safe" — which cannot go reassuring while the headline beside it is not.

`CLAUDE.md` §8 has this as **a refusal that rests on a figure stops being a
refusal the moment the figure moves**, with the tell: if the sentence explaining
a refusal contains a number, ask what it says when that number is zero.

**2. The Well-led bar counted the wrong population.** It read "213 of 306
documents in date", so its hatched segment claimed 93 records "nobody has
written" — and an expired document *was* written, by somebody whose name is on
it. This is Rule 3 (a recorded negative is not an unrecorded value) surfacing in
an aggregate instead of in a cell, where it is far harder to see: the cell
version is one wrong badge, the aggregate version quietly recruits every
recorded-but-unwelcome answer into the missing-evidence total. It had inflated
the "evidence never recorded" mini from 341 to 365.

The bar now counts documents carrying an expiry **decision** — 237 of 306, the
same population the Well-led panel already names as its driver — and being out
of date went back to being a finding rather than a gap. §8 has it as **the
complement of a population is not automatically a gap**.

**3. The same population needed two phrasings.** The missing list rendered
`bar.population` against a missing count and produced "42 consents sought" for
forty-two consents nobody has sought — a gap reading as a positive figure. That
is the one-owner rule again, so `EvidenceBar` carries `population` for the bar
("182 of 224 consents sought") and `missingPhrase` for the list ("42 consents
nobody has sought"), and neither call site agrees the wording itself.

### One deviation from the reference, for the record

The reference's bar is "the evidence expected for that Key Question". Summing a
panel's check populations would double-count — a care plan domain appears in
both "ever written" and "reviewed on time" — and produce a total nobody could
check against anything. So **each bar counts one named population, stated on the
bar, with no "others" bucket**. Five bars, five populations, each one a number a
reader can go and verify.

### One rule that beat the reference

The reference puts status dots in the rating column. On Reports there are no
ratings at all (§6.6h, Frank's "NO RATINGS ON REPORTS — agreed"), so the dots do
not travel there: borrowing the shape would be one concept in two treatments and
two in one at the same time. The Reports index keeps the dense table, the hover
and the 20px radius, and marks thin rows with the hatch it already used. A guard
asserts there is no `[data-dot]` and no `[data-rating]` anywhere on it.

### The five refusals, each with a guard that fails on the real defect

The suite went green on the first run after a change touching six files, which
is the tell the Phase 15 entry names. Ten new guards, and each was proven by
breaking the code under it:

| Refusal | Mutation that must break it |
| --- | --- |
| No green in the hero; it carries the unusable count | hero renders `findings` instead of `unusable` |
| No overall compliance percentage | "Overall compliance: 87.3%" added to the footer |
| The hatch survives into the chart as a segment | gap segment given the recorded bar's class |
| Insufficient Evidence stays a chip, not a fourth dot | a `data-dot="insufficient"` added beside it |
| No trend without both figures named | "↓ down 5" added to the hero label |

All five failed as intended, and the five on Reports likewise (hero leads on
findings; a rating dot borrowed onto the index; the thin segment shaded rather
than hatched; "— was 1.2%" stripped from the change cell; the coverage mini
moved below the table).

The Insufficient Evidence guard needed the thin site rendered rather than
computed — Rosewood rates all five — so `renderAt` now takes a site and switches
the session the way the switcher does, since the active site comes from the
session and never from a route or a prop.

**Read back as a DOM dump rather than a screenshot.** There is no screenshot
tool in this repo and installing one is a §9 conversation, not a decision. The
dump is what found all three defects above; a screenshot would have found none
of them, because every one was a sentence rather than a pixel.

### One thing the restyle nearly left behind

The dense table grew its own coverage bar and its own "N of M checks can support
a figure" sentence, which left `CoverageBar` in `ComplianceParts` used by
nothing. Two renderings of one concept is the §6 defect, and a dead export is
how it starts. `CoverageBar` now owns both the bar and the sentence — the bar
alone is a proportion with no denominator, which is the figure this product
refuses everywhere else — and the overview calls it. Nothing was deleted.

Verify: 50 files, 1,109 tests, all five lint rules green.

---

## The Dashboard as an analytics screen

Frank approved `docs/dashboard-charts.html`: four rows, four chart types, same
data and same rules. Built.

### Two premises in the brief did not hold, and both changed the approach

**recharts is not in the stack.** Not in `package.json`, not in
`node_modules` — so using it would have been a §9 install-before-asking, and the
brief's own fallback ("where a chart type is awkward in recharts, hand-author
the SVG rather than adding a dependency") points the other way. The decisive
fact is that **the approved reference contains no recharts either**: every chart
in it is raw SVG — the sparklines are `<polyline>`, the area chart two `<path>`s,
the donut and the rings `<circle>`s with `stroke-dasharray`. So everything here
is hand-authored, which is also what requirement 1 needs: a `<pattern>` fill on
an area and a pattern *stroke* on an arc is the thing chart libraries make hard,
and it is the requirement that matters most. Nothing was installed. If Frank
wants recharts anyway the swap is contained to `charts.tsx`.

**There is no screenshot tool in this repo** — which I reported last time as a
reason the read-back was a DOM dump. That was true and it was not the end of it:
Chrome is on this machine, and `--headless --screenshot` plus `sips` for
greyscale needs no dependency at all. So this screen was read back the way Frank
asked, in colour and in greyscale, and that is now the method.

### What the screenshots found that the tests could not

**The donut painted a black disc over its own denominator.** An SVG circle with
no `fill` declared defaults to black; the one arc taking its stroke from the
hatch pattern had no `fill: none`, so it filled. Every test passed — "of 162
doses scheduled today" was in the DOM, in the right element, with the right
numbers. The DOM had the denominator and the screen did not. §8 has this as a
class no text assertion in this build can reach.

**The area chart was accurate and unreadable.** This home records ~98% of its
doses, so the hatched gap is three per cent of the chart's height. The
tempting fix — starting the y-axis near the data — magnifies the gap by hiding
zero, which is a percentage without its denominator in a different shape. The
geometry stayed honest and each day's gap now prints its count above the band,
so 6 says six whether or not six pixels show.

### The bug the probe found before either

Two derivations of "doses scheduled today" disagreed by one: 162 and 163. The
schedule helper was written by reading the generator and restating its
arithmetic faithfully except for a `Math.min(…, 89)` clamp — one token — that
anchors the schedule to the first day on the chart rather than the prescription
date. The generator now exports `MAR_HISTORY_DAYS` and both sides read it. §8
carries it as a second occurrence of the proxy/drift entry, arrived at from the
other end: a formula copied *correctly* is still a second rule.

### The sparkline that is not the figure above it, and says so

"Overdue now" counts doses, reviews past their date and unsigned handovers.
Of the three, **only the doses can be reconstructed for a past day**: a review
completed since keeps no record of the day it stopped being overdue, and a
signed handover keeps no record of the day it was signed. A seven-day line of
the composite would be this week's number drawn backwards over a week that did
not have it.

So `DaySeries.what` is required rather than optional, and every card prints it.
The line under "Overdue now" says *doses with no record, each of the last seven
days*, and that is what it is. The other three are exact — residents with no
care note, doses due, and incidents reported-and-not-yet-acknowledged at the end
of each day (exact because every acknowledged state carries the moment it
happened; the record keeps what the figure is derived from, which is precisely
why this one can exist and the first cannot).

### One shared owner extracted

Risk assessments, care plan domains and consents are counted on the compliance
chart and now on the Dashboard's module bars. Rather than a second copy,
`features/dashboard/populations.ts` owns the three and `compliance/analysis.ts`
delegates to it. Nothing was deleted and compliance's 37 tests are unchanged.

### The hatch guard was blind to the medium it had just gained

`check-hatch.mjs` read `.css` files only. The moment the hatch acquired an SVG
form, a second `<pattern>` anywhere would have shipped under a tick reading
"exactly one definition". It now scans `.ts`/`.tsx` too, permits the pattern in
`charts.tsx` alone, and says *per medium*. Proven by adding a second pattern to
the route and watching it fail.

### The refusals, each with a guard proven against its own defect

Six new guards, each broken on purpose:

| Refusal | Mutation |
| --- | --- |
| The hatch carries into every chart | area band given the recorded line's class |
| Recorded against expected, never a percentage | "98.8%" added to the donut centre |
| Sparklines carry direction, with the subject named | the caption emptied |
| All four dose states listed, including the zeroes | not-due-yet hidden when zero |
| Nothing green, including a quiet shift | `--status-positive-ink` on the calm tile |
| One derivation behind the donut and the rings | the clamp reverted |

All six failed as intended.

### Two things in the brief the fixture does not produce

Frank named these as doing real work, and they do not appear:

- **"The 08:00 ring is visibly short."** It is 83 of 84. Every ring on this home
  reads as complete, because the fixture's omission rate is 1%.
- **"The area chart's widest gap is at the same round."** The widest gap is six
  doses on a chart whose axis runs to 165.

Both are true of the reference's illustrative numbers and not of this home. The
shapes are built and would show it — a home that records nothing draws a
mostly-hatched ring, because the segments are counts. The fixtures stay as they
are; this is recorded rather than corrected, since the gaps in this build are
deliberate and 1% is the rate Frank approved on 22/08.

Verify: 50 files, 1,115 tests, all five lint rules green.

---

## Three corrections, and one premise that did not hold

**§3.1 of the PRD is corrected.** The stack table listed `recharts` — Phase 12+
only, not before, and recharts was never installed. Frank's own account of it is
the useful part: *"I asserted it as fact about the codebase and it was fact about
a document I wrote before the build started."* The row now reads **no chart
library, hand-authored SVG**, with a note underneath giving the three reasons in
order of weight — the hatch has to reach inside a chart as a `<pattern>` fill and
an arc *stroke*; colour must arrive as `var(--token)` through a stylesheet so
Stylelint still governs it; and five shapes do not justify an axis engine and a
tooltip layer. Corrected rather than acted on: installing it now to make the
table true would be the document changing the build instead of describing it.

Nothing was renumbered. A new §3.5 would have collided with "Type scale is
closed" and pushed "Other hard conventions" to 3.7, which two live
cross-references point at — so the correction sits inside §3.1, where the error
was.

**The §8 occlusion entry has Frank's framing**, which is sharper than the one it
replaces. The distinction worth keeping: this is *not* a test asserting the
wrong thing, which is what most of §8 is about. It is a test asserting the right
thing **about the wrong medium**. The string was in the DOM, in the right
element, with the right numbers in it, and every assertion over it was correct.
Occlusion, contrast, clipping and z-order are a class no text query reaches,
however well written.

And the consequence is recorded as a change of method: **the read-back is a
screenshot now, not a DOM dump.** The dump was the method while there was no way
to rasterise a page. There is one — the Chrome already on this machine, plus
`sips` for greyscale, no dependency added. The greyscale pass is the one that
proves the hatch is carrying the meaning rather than the hue.

**The truncated axis is the more important call**, and Frank named why better
than the entry did: it *magnifies a gap by hiding zero — the reassurance failure
run backwards, alarming rather than soothing but the same lie about proportion.*
The entry now says that and cross-links `FLAG_STILL_IN_TIME`, which manufactured
an alarm on every row. A false alarm and a hidden gap cost the same, because
both teach the reader to stop looking.

### Ashgrove does not show the shapes

Frank's closing suggestion — *"if somebody wants to see the shapes work,
Ashgrove is the site to open"* — does not hold, and it is worth saying so rather
than writing it down:

| | Rosewood Court | Ashgrove Lodge |
| --- | --- | --- |
| Residents | 28 | 4 |
| Today's donut | 160 of 162, 2 with no record | **12 of 12, none missing** |
| Shortest ring today | 83 of 84 (99%) | **every ring 100%** |
| Week's widest gap | 6 on an axis of 165 | 1 on an axis of 12 |

Ashgrove is thin in **volume**, not in recording. The 1% omission rate applied to
twelve doses a day rounds to nothing, so opening Ashgrove shows *fewer* of these
shapes than Rosewood — its donut has no hatched arc at all. No site in this
build draws a short ring.

That leaves the branches unreached from any screen, which the standing check
says means either the fixture is wrong or the branch is. Here it is neither: the
rate is what a real home looks like and the shapes are correct. So they are held
**by construction** instead — two component tests render a home that has
recorded nothing (a fully hatched ring rather than an empty one) and a round
that is short, plus the opposite case that must not be hatched: a round nobody
has reached yet takes the plain track, because not-due-yet and
nothing-outstanding both have zero doses missing and are opposite states. Both
proven by mutation. The fixtures are untouched, and it is written down here that
no site displays these rather than left to be rediscovered.

Verify: 50 files, 1,117 tests, all five lint rules green.

---

## The Dashboard cut back, and the em dash removed from the platform

Three instructions from Frank: take the sparklines off the cards, cut the
descriptive writing, and get rid of every em dash across the platform.

### The cards

The four seven-day sparklines are gone, and with them `DaySeries`,
`omissionsByDay`, `dosesDueByDay`, `unwrittenByDay` and `unacknowledgedByDay`.
`dosesByDay` stays, because the area chart is built on it. Each card is now a
label, a figure with its denominator, and one line of detail.

**The denominator guard caught the trim**, which is what it is for. Cutting
"across 28 residents" off the overdue tile left a bare count, and Rule 4 does
not have an exception for concision. The breakdown got shorter instead
("23 reviews" rather than "23 reviews past its date") and the denominator
stayed.

Every panel note is one or two lines. "One ring per round." replaced a sentence
about zoom levels; the chart caption lost the paragraph explaining why the band
is small and kept the clause that matters.

### The em dash, platform-wide

1,930 in `src/`, of which 1,463 are in comments and docblocks and **338 were on
screen**. All 338 are gone, plus 37 in tests that asserted against them.

The rewriter is comment-aware and picks its replacement by context: a colon
after a short label, a comma before a conjunction or where a comma already
follows, a full stop where the clause stands alone. Comments and documentation
are untouched, because they are not the platform.

`scripts/check-em-dashes.mjs` keeps them out and is wired into `npm run lint`.
It blanks comments line-by-line rather than character-by-character, and that is
deliberate: the first version scanned characters, took the apostrophe in
`Today's doses` for a string delimiter, and lost track of every comment after
it — reporting eight findings that were comments and missing the ones that were
not. Six deliberate opt-outs remain, all of them guards asserting that a dash
is *absent*, which have to keep the character to assert against it.

### Three placeholder dashes were the real finding

A dash standing in for a value is not punctuation, it is a blank — and a blank
that cannot be told from "nobody has looked" is the thing this product exists to
prevent. Three were on screen:

- the controlled drug register's change column, now **"No change"**;
- the round queue's room cell, now **"No room recorded"**;
- an incident location in the fixtures, now **"not recorded"** (renders as
  "Room not recorded").

### And one guard died silently

The round queue's "unrecorded rooms sort last" test found that row with
`rooms.indexOf('—')`. With the dash gone the lookup returned -1 for ever, and
the assertion under it — guarded by `if (unrecorded !== -1)` — stopped running.
The suite stayed green and the test count did not move.

The cell now carries `data-queue-room="recorded|unrecorded"` and the test reads
that. §8 has it as a new entry: a test that identifies a state by the characters
it renders dies silently when the copy changes, and an ordinary house-style
sweep is exactly what changes them all at once.

### Read back

Dashboard and the medications omissions screen were screenshotted and read.
The copy scans cleanly; "across 0 of 28 residents" replaced an awkward
"across 0 residents of 28" on the second tile.

Verify: 50 files, 1,117 tests, six lint rules green.

---

## Bar chart, donut, and the late list gets filters and pages

Four changes to the Dashboard.

**The week is a bar chart.** One stacked bar a day: recorded at the bottom,
the gap hatched on top, so the bar's height is what was due and the two parts
are what became of it. Each gap still carries its count above the bar, for the
reason recorded last time: the axis is not truncated to make a three per cent
gap look bigger, because hiding zero magnifies it and that is the same lie
about proportion as a percentage with no denominator. Today's bar is outlined
rather than filled, because the day is still running.

The caption and the legend were rewritten with it. Both still described a solid
line, a dashed line and a band, none of which the screen draws any more, and
the dashed "Due" swatch pointed at a line that no longer exists. Stale copy on
a changed graphic is the class §8 already carries twice.

**The donut is thinner.** The ring went from 5.5 to 4.4, which widens the hole
enough for "of 162 doses scheduled today" to sit clear of the arc. Segments now
carry a hairline seam of the track between them, drawn *on top* rather than
subtracted from each arc: shortening the arcs to make gaps would have shrunk
the smallest segment out of existence, and the smallest segment here is the
doses nobody recorded.

**The late list filters and pages.** Four pills with their counts, eight rows a
page.

Pills rather than a tab strip, and that is the §6 rule rather than a
preference: an underline strip means navigation in this product, a pill means a
filter, and these narrow a list on the screen you are already on. Same
treatment as the omissions screen.

The claim above the list carries the filter and the unfiltered total, because a
figure of 26 above a list of 3 is a claim about a set the reader is not looking
at. And because paging hides rows, the line says which slice is on screen: a
reader who sees eight rows and no total has been told the home has eight
problems.

### Two guards passed on the defect they were written for

Both caught by mutation, in the same sitting.

**The claim guard** checked `toContain('late in total')` and
`toContain(String(total))`. Changing the claim to lead with the *unfiltered*
figure — precisely the Rule 3c defect it exists to catch — left both true,
because the total was still in the sentence, just in the position the filtered
count should have held. `toContain` on a sentence says a value is present and
never that it is in the right place; it names a figure the way
`querySelector('ul')` names an element. It now reads the leading figure and
compares it against the pill's own count. §8 has it as the specificity rule
applied to text rather than to elements.

**The paging guard** survived its mutation for a different and better reason:
two mechanisms hold the reader on a page that exists, and either alone is
enough. Removing both fails the test. That is belt-and-braces rather than
broken, and it is now said out loud in a comment beside the clamp, because the
next person to mutate one of them will otherwise read the green as a defect.

Neither case is distinguishable from a working guard without running the
mutation.

Verify: 50 files, 1,121 tests, six lint rules green.

---

## The omission rate raised to 7%, so the charts can be seen to work

Frank asked to reduce the recorded doses far enough to see "Due and not
recorded" on both charts, and to bring the donut's centre text together.

**This reverses the decision recorded two turns ago** and the reversal is
right, because the two decisions answer different questions. 1% was chosen for
the omissions *queue*: thirteen rows in a week, long enough for the sort and
the filters to mean something, short enough to read. Nothing about that choice
was about a chart, and 1% in a chart is three pixels of a bar and a hairline of
an arc. Legible in a queue and visible in a chart are different requirements,
and the first was the only one anybody had asked of it.

7% is ~11 a day and ~78 a week. Every bar now carries a gap between 4% and 12%
of its height, the donut's arc is 6.8%, and the 08:00 ring is 76 of 84 and
visibly short. The three §5.3 omissions are still pinned by hand rather than
left to the draw, and the change is one branch boundary: `roll <= 1` became
`roll <= OMISSION_RATE_PERCENT`, taking its extra share from `given` and
leaving `not_given` at 8%, so the RNG stream is bit-for-bit unchanged and no
other fixture moved.

This also closes something recorded two turns ago as open: the short ring and
the hatched arc were held by construction in tests because no site displayed
them. They are now on the screen.

### Three tests broke, and each was worth the breakage

**The rate guard** pinned the rate to a hand-typed band of 0.5% to 2%. Raising
the rate meant editing the assertion to make a legitimate change pass, which is
exactly how a guard stops asserting. The generator now exports
`OMISSION_RATE_PERCENT` and the guard checks that it produces the rate it
declares, within a tolerance. One number to change, in one place.

**Two opening-count guards** submitted the one controlled drug they were about
and nothing else. That worked only while every other dose at that round
happened to be signed for already; one unrecorded dose beside it and the round
refused for being short, so both tests failed on a shortfall message rather
than on the guard they exist to prove. This is the §8 entry about what has
already happened to a record before somebody opens the screen: a round with
nothing else outstanding is the exception, not the rule.

Fixed by answering every open dose, with the open set read from the round's own
derivation rather than a copy of the rule in the test. `openDosesAt` is now
exported from the client and `recordRound` calls the same function.

**And a third thing fell out of that.** The test's `given()` helper witnessed
every dose, including drugs that need no witness, and the round reads a
required witness as the mark of a controlled drug and then demands an opening
count for it. The state a test writes has to say what the prescription says.

### Still zero, and not because of the data

"Due now" and "Not due yet" read 0 on the donut, and no rate change will move
them: they are a function of the clock. The rounds are at 08:00, 14:00, 18:00
and 20:00, and these screenshots were taken at 23:00, by which time all four
are past. Open the Dashboard between roughly 12:00 and 13:00 and all four
segments populate, because the 14:00 round is inside its window and 18:00 and
20:00 are still to come.

Read back in colour and in greyscale. The hatched segments carry on every bar
and on the arc.

Verify: 50 files, 1,121 tests, six lint rules green.

---

## Navigation restructure and module corrections

Thirteen items from Frank. What was done, and the three that needed a decision.

### 1. Active state

`useMatch({ path: item.path, end: false })` keeps a parent lit on its children,
which is what /residents needs on /residents/:id. The Dashboard's path is `/`,
and every URL in the product is prefixed by `/`, so it matched all of them and
the front door stayed lit on every screen. The root is now matched exactly and
everything else by prefix.

### 10-12. Settings is the single administrative entry

Team, All homes and Settings were three sidebar items and are three tabs under
one. Nothing was removed: `/settings` is the team list, `/settings/homes` the
group overview, `/settings/figures` the build's figures, and permissions,
activity and a staff member keep their own URLs underneath.

### 5. Team member management

The store gained `addMember`, `inviteMember`, `suspendMember`, `removeMember`
and `isAddedThisSession`. The screen gained count cards, an add dialog, and
give-access, suspend, delete and permissions on a member.

Two rules shaped it rather than the checklist:

**Adding somebody and giving them access are two acts.** A person arrives with
`never_given_access`, which carries who added them and when, and takes the
hatch. A single "add and invite" would have made a person nobody set up
indistinguishable from one who is ready.

**Delete is only ever available for somebody added this session, and it says
so.** Records outlive access: every note, dose and signature carries a
`StaffRef` snapshot, and deleting a real member would leave those records
naming somebody the team list says does not exist. `removeMember` throws rather
than allowing it, and the dialog explains that removing access is the act for
them.

On the resident-flow complaint: the staff detail was already team-shaped, and
what read as a resident record was the hero. It now says **Team member** above
the name, and the list links to `team/<id>` under Settings rather than into
anything resident-shaped.

### 3. Handover status tabs

Not reviewed, Urgent, Needs attention and All well are tabs, each with its
count. Every status stays on the strip at zero, because dropping an empty one
would make "nobody is urgent" and "nobody checked whether anybody is urgent"
the same absence.

**They are pills, not an underline strip.** §6: an underline means navigation
and a pill means a filter, and these choose which group to work through on the
screen you are already on. Same decision as the late list.

Six handover tests broke and each was worth it. They asserted against four
stacked sections; the rules they carry are unchanged, so they now sweep the
tabs — including "lists everybody living at the site", which visits all four
and unions the residents rather than counting one panel.

### 4, corrected. The row was the problem, not the button

The first attempt gave the action column a named width and made the control
fill it. That was the wrong end of the problem, and Frank was right to send it
back: **every track in these row grids was a fixed rem width**, so the row was
as wide as its columns and no wider. On a 1,990px card the content stopped at
about 800px and the last third was dead space, with the action sitting wherever
the fixed tracks happened to end.

Five rules had no flexible track at all: `.queueRow` in risk, goals and
consent, `.row` in reviews, `.logRow` in incidents. Each column now has a floor
and a share of the width, and the action sits at the right edge of a row that
reaches it. Care plans already did this and was the model.

The comment that used to sit on the risk rule described the opposite fix, a
middle `1fr` absorbing all the slack and stranding the chip at the far right.
Both readings were about where the slack went. There should not have been that
much slack.

### 2. Notes count cards, and the Open buttons

Notes carries four counts, each with its denominator, and the residents nobody
has written up takes the hatch because that is evidence missing rather than a
low number.

The six list modules had their action column set to `auto`, which sized the
control to the word "Open" and stranded it against the right edge of a wide
row. The column is now a named width the control fills.

### 6-8. All homes

The h1 and the paragraph explaining what the screen is for are gone, which is
what was crowding the cards. In their place: an **Across all homes** metric
strip, and each home's counts as metric tiles rather than a plain list. Every
figure carries its denominator and every one is a count, which is what lets a
four-resident home sit beside a twenty-eight-resident one without either being
hidden inside a rate.

Opening a home switches the session to it **and navigates to its front door**.
It previously changed the active site in place, so the click had no visible
effect on a screen about every home.

### One thing found by reading it back

"11,150 notes, written by 9 persons." `pluralise` defaults to `+s`, and the
plural lint only catches a count agreed at the call site, not an irregular one
agreed by the owner. The owner takes the plural explicitly now.

Verify: 50 files, 1,119 tests, six lint rules green. Two tests fewer than
before, which is the nav-item count deriving from the declaration rather than
being pinned.

---

## One figure card, four modules

Frank asked for the cards in Care notes, Handover and Medications to be the
ones the residents list uses.

**Extracted rather than copied.** `components/metric/MetricTile` holds the card
now, and the residents stylesheet composes its look from there. Four modules
that look alike because they were typed alike is exactly the drift this build
keeps finding; copying the rules into three more places would have guaranteed
it.

The card requires `of`. A big figure on a card looks finished without a
denominator, which makes a metric strip the easiest place in a build for a bare
count to appear, so here it has nowhere not to be: it renders on the face and
goes into the spoken claim.

**No card is tinted by state.** The tinted caution and hatched cards the three
modules had are gone; a gap is an `<Unrecorded>` chip inside a plain card. The
hatch has one owner, and a tinted card cannot say whether the tint is the
finding or the card.

### Two rules the change nearly cost, and what kept them

**The handover's lead figure.** Not reviewed is the only thing still fixable
before the signature goes on, and four equal cards make the reader do the
ranking. The card gained an `emphasis` prop: the lead spans two columns and
carries the sentence saying why. Same card, more room, rather than a different
card.

**The omissions claim.** The banner carried the filtered count with its filter
named in the caption, which is Rule 3c in its most direct form. Replacing it
with four fixed tiles would have dropped the filtered claim entirely. The tiles
are the whole week, each with its own denominator, and the filtered claim moved
to the line above the list where the filter that produced it is named beside
it.

### The icon scanner does not see a name passed as a prop

Every screen using the new card threw at runtime: `Icon "…" is not in the
generated registry`. The scanner reads the name attribute on an Icon element in
JSX, so a name handed to `MetricTile` as `icon={…}` is invisible to it. The
name typechecks, the generator sees no usage, and the failure lands at runtime
rather than at build time — which the scanner's own docblock warns about, for
this reason.

`components/metric/metric-tiles.icons.ts` is the sanctioned answer: a file
named for icons has every icon-shaped string treated as used. Including strings
in its comments, which cost one more build until the example name written in
the docblock came out. That is now said in the docblock, without an example.

Four guards were retargeted, and three of them for the same reason: a
page-wide sweep for `[data-unrecorded-detail]` or `[data-state="unrecorded"]`
now catches the chip inside a metric card. Each is scoped to the rows it meant.

Verify: 50 files, 1,119 tests, six lint rules green.

---

## The Dashboard takes the same card

Fifth and last module on the shared figure card. "Overdue now" leads, spanning
two columns; the residents nobody has written up carry the hatch as a chip
inside a plain card.

**What this costs, and it is worth saying rather than leaving to be noticed:**
the overdue tile lost its critical tint. On the screen whose whole job is what
is late right now, that is the strongest case in the build for colouring a
card, and the case is still not good enough: a tinted card cannot say whether
the tint is the finding or the card, and the ranking is carried by position and
width instead, which survives greyscale. The alarm is the figure, its label,
the breakdown beneath it, and the table below.

### A guard had already gone quiet

`carries a denominator on every tile` looped over `[data-tile]`. The shared card
emits `data-metric-tile`, so the query matched nothing, the loop body never ran,
and the test passed. Rule 4 was unprotected on the screen it matters most on,
and nothing failed to say so — the count of tests did not move either, because
the test still existed and still passed.

It now reads through the card's own `[data-metric-of]` element and asserts
there are four of them. Proven by emptying one card's denominator.

Two more guards on the same screen were retargeted and proven: the ranking
(broken by flattening the lead to supporting) and the no-green rule, which now
covers the shared stylesheet as well as the Dashboard's own.

Verify: 50 files, 1,119 tests, six lint rules green.

---

## The donut's smallest segment was being eaten by its own rounding

Frank: "you changed the Due now pie chart bar, increase it as it was" — and
then, after the ring went back from 4.4 to 5.5, "didn't do anything."

He was right, and the thickness was not the thing. **The round caps were
swallowing the small segment.**

A round cap costs the stroke width in arc at each end, and the compensation
subtracts that from the dash so the painted extent equals the true share. For a
segment smaller than the allowance there is nothing left to subtract from: the
dash clamped to a 0.5 minimum, the two caps met, and what should have been a
short arc rendered as a rounded blob. Doses with no record are 4.9% of the
ring, and they painted 6.0% as a stub with no length in it.

Raising the stroke width made it worse rather than better, which is why the
change looked like nothing: a thicker stroke is a larger allowance, so the
segment lost more.

**Below the allowance the arc keeps its length and gives up the rounding.**
Square-capped at its true 4.9% it is a short arc, which is what it is. Rounding
is a finish; it does not get to eat the smallest segment on the chart, and on
this chart the smallest segment is usually the one that matters.

| Segment | Share | Cap | Paints |
| --- | --- | --- | --- |
| Recorded | 60.5% | round | 60.5% |
| No record | 4.9% | square | 4.9% |
| Not due yet | 34.6% | round | 34.6% |

Guarded, and proven by compensating every segment again and watching the small
one go negative.

Verify: 50 files, 1,120 tests, six lint rules green.

---

## Why "Due now" was zero, and the defect found while checking

Frank asked what was happening with "Due now · inside its window" sitting at 0.

**The zero was correct.** Rounds are 08:00, 14:00, 18:00 and 20:00 with a
two-hour lookahead. At 15:01 the 14:00 round had closed an hour earlier and
18:00 was three hours off, so nothing was inside a window. Today's records
were given 98, not_due 63, omitted 9, not_given 7 — and not one `due`.

**But checking it turned up a real defect.** The two halves of that question
were derived from different clocks:

- `due now` read the `due` state **baked into the fixture at generation**,
  which is whenever the page first loaded;
- `not due yet` beside it compared the round's wall-clock time with the
  **home's current** wall clock.

So a round that opened while somebody had the tab open stayed not-due-yet while
the header's clock said otherwise, and one that closed stayed due. The screen
looked like a chart that would not update, which is exactly how it read.

Both now decide by comparing the round's wall clock with the home's, which is
the comparison `dosesByDay` already made. The donut moves through the day:

| Site clock | Recorded | No record | Due now | Not due yet |
| --- | --- | --- | --- | --- |
| 15:30 | 98 | 8 | 0 | 56 |
| 18:30 | 98 | 8 | **6** | 50 |
| 19:30 | 98 | **14** | 0 | 50 |
| 21:30 | 98 | 64 | 0 | 0 |

The 18:00 round's six doses are due inside their hour and missing after it,
which is the state change the screen exists to show.

§8 has it as **two halves of one question, answered to two clocks**, with the
tell: a stale figure looks like a working one, so what to watch for is not
staleness but two figures in one set computed from different sources. The sum
stayed right the whole time — 162 in every row above — which is why the total
adding up proved nothing.

Guarded with pinned instants either side of a round's window, and proven by
putting due-now back on the baked state.

Verify: 50 files, 1,121 tests, six lint rules green.

---

## "Due now" was unreachable, not stale

Frank, twice: it is still zero, what exactly has not changed.

**Nothing had, and the previous answer was wrong about why.** The clock fix
recorded last entry was real but it could not have shown anything, because the
state it was fixing did not exist in the data.

The generator records **every** round in the past. A round that opened four
minutes before the page loaded was already given, not-given or omitted, so no
dose in the fixture was ever inside its window, and the donut's due-now segment
could not be non-zero on any fresh load at any hour. Reading zero was correct
every single time, and a reader cannot tell a true zero from a dead one.

A round whose hour is still running is now left in progress. That is also
simply what a home looks like at 08:20. Gated after the RNG draw rather than
instead of it, so the stream is bit-for-bit unchanged and no other fixture
moved.

Proved by faking the clock before importing the fixtures, which is the only way
to ask what the home looks like at another hour:

| Fresh load at | Recorded | No record | Due now | Not due yet |
| --- | --- | --- | --- | --- |
| 08:20 | 0 | 0 | **84** | 78 |
| 09:30 | 76 | 8 | 0 | 78 |
| 14:20 | 76 | 8 | **22** | 56 |
| 15:30 | 98 | 8 | 0 | 56 |
| 18:20 | 98 | 8 | **6** | 50 |
| 20:20 | 104 | 8 | **50** | 0 |

Non-zero for the hour after each round, and 162 in every row. Frank was looking
at 15:00 and 15:27, both just after the 14:00 window closed, which is why two
correct answers in a row looked like a screen that had stopped working.

`due-now.test.ts` holds it: doses inside their window twenty minutes into a
round, none an hour later, and the same doses missing instead. Proven by making
the generator finish the open round again.

§8 has it as **a figure that is correct and indistinguishable from broken**,
with the tell for fixtures generated against `now`: ask what that makes true of
now specifically, because the states that only exist in progress are the ones
it will quietly complete.

Verify: 51 files, 1,123 tests, six lint rules green.

---

## The clock is movable, because nothing but a decision was stopping it

Frank: this is not connected to a backend, so make it changeable from the front
end.

He was right, and the previous two answers were both "correct, and useless".
The record is generated in the browser at page load against `new Date()`. There
was no server refusing to move it; there was only me treating a fixture
constant as immovable.

**`?at=HH:MM` regenerates the whole record at that time.** A query parameter
rather than storage, for three reasons: the fixtures are built at module load
so the value has to be readable before any import runs, a reload is needed
anyway to rebuild them, and §6 keeps record data out of storage. The URL also
makes the override visible and shareable rather than a mode somebody can leave
switched on.

`Settings → Settings` carries the control, and it offers hours named by the
state each one makes reachable rather than a bare time picker: the reason to
move the clock is always a state, never an hour.

### The first version had the defect it was fixing

Moving the fixtures and leaving the screens on the real clock meant the header
said 15:42 over a record of the morning, and every "how long ago" on every
screen was hours out. That is the two-clocks defect the donut had between two
of its own segments, one layer up and across forty files.

`now()` comes from the same place as the record's instant, and the forty call
sites that read `new Date().toISOString()` now read it. With no override it is
the real time, exactly as before.

### And it says so, everywhere

`MovedClockBanner` renders on every screen while the clock is moved, alongside
the changed-figures banner and for the same reason: a map from the clock to the
screens it affects would be a second rule, and every screen is a superset that
cannot go stale. A wrong figure is wrong in one place; a wrong clock makes every
timestamp on every screen agree with each other and with nothing outside.

At `?at=08:20` the Dashboard reads: header 08:20, due now **84**, recorded 0,
no record 0. The state that had never once been visible.

Verify: 52 files, 1,126 tests, six lint rules green.

---

## The clock defaults to a time when the home is doing something

Frank, on the plain URL: nothing has changed.

He was right again. The last change put the control behind `?at=`, which meant
opening the app did what it always did. A demo that only works if you know a
query parameter does not work.

**With no parameter, the record is drawn at the real time when a round is
running, and twenty minutes into the most recent round when one is not.** This
home gives medication at 08:00, 14:00, 18:00 and 20:00, so for sixteen hours of
the day nothing is due; opened at 15:55 the last round had closed fifty-five
minutes earlier and the next was two hours off. Every screen built to show a
round in progress showed nothing, correctly, and there was no way to tell that
from a screen that had stopped working.

`?at=real` pins the real clock for anybody who wants it, and the banner on
every screen names both instants and why they differ.

### `now()` is the generation instant, always

The first version of this left `now()` returning the live clock unless a time
had been asked for. The moment the default started moving the clock for itself,
the header read 16:05 over a record drawn at 14:20. The whole record is a
snapshot taken at one moment; every screen is as of that moment, and a clock
ticking past it compares the record with a time it was not drawn against.

### Two things the default broke, and both were worth finding

**A dose twenty minutes into its window was being marked missed.** Letting half
the open round fall through to the ordinary past-dose logic put six doses down
as omissions inside a window that had not closed. The window is what decides
that. The open round is now built in one place, alternating on the drug's index
so a resident with two drugs at that round has one signed and one still to
give, and neither branch can produce an omission.

**A part-recorded round became unreachable at 14:00.** The guard for it opened
whichever resident the screen landed on, and at 14:00 this home gives each
resident a single dose, so nobody there can be part way through anything. It
walks the rounds and the residents now, using the round selector that is on the
screen for exactly the same reason a nurse uses it. The state is real; which
round holds it depends on the hour.

`rounds.ts` owns the round times, imported by the clock and held against every
drug's schedule by a fixture test, because the clock is read before any fixture
module loads and could not import the drugs.

On the plain URL: header 14:20, **due now 22**, 19 of 28 residents.

Verify: 52 files, 1,127 tests, six lint rules green.

---

## The clock notice was wearing a finding's clothes

Frank, on a working screen: this is what it shows, why.

The figures were right — due now 13, header and record both 14:20. What was
wrong was the notice above them. It was built in `--status-caution`, the amber
border and tint a finding wears, four lines deep, ending "nothing here is a
record of what has actually happened today".

**Every word of that is true of every screen in this build at every hour**,
because the whole record is fixtures. Saying it loudly only where the clock has
moved implies the rest is real. And it put a standing alarm across the top of
the front door for something nobody needs to act on, which is how the alarm
treatment stops meaning anything where there is an actual finding.

One quiet line now: the instant, why it is that instant, the real time, and the
way back.

> **14:20** Showing the 14:00 round, which is the nearest one running. Real
> time 16:31. *Use the real time*

§8 has it as **spending the alarm vocabulary on something that is not a
finding**, with the tell borrowed from the entry about figures that need a note
explaining how not to read them: if the prose is doing the work, ask whether
the treatment is wrong rather than writing better prose.

Verify: 52 files, 1,127 tests, six lint rules green.

---

## "Due in the next 2 hours: 6" and "Due now: 0" were both right, and the screen never said so

Frank: is the tile not supposed to reflect in the pie chart?

They measure different things and both were correct. **Due now** is a round
whose hour is open. **Due in the next 2 hours** is a round that has not opened
yet but will inside the lookahead. At 17:09 the 14:00 round closed two hours
earlier and the 18:00 one was fifty-one minutes away, so nothing was open and
six doses were coming.

What was wrong is that the ring called those same six **not due yet**. Two true
statements about one set of doses, on one screen, left for the reader to
reconcile.

Due soon is its own segment now, in caution rather than critical: it is not a
finding, and it is not nothing. The ring and the tile count the same doses, and
the five segments still sum to the day.

### When Due now is non-zero

The hour after each round: 08:00 to 09:00, 14:00 to 15:00, 18:00 to 19:00,
20:00 to 21:00. Outside those the plain URL draws the record twenty minutes
into the most recent round so it is always visible; `?at=real` pins the real
clock, which is what the screenshot was showing.

Verify: 52 files, 1,127 tests, six lint rules green.

---

## Eight from this round

**1 and 2, Residents.** The three views sit centred on their own row and the
search leads the filter row: search, falls risk, review status, then the
figures period, which is last because it does not narrow the list.

**The default was `critical`**, so the module opened on eighteen of
twenty-eight residents under a heading that looked like the whole home. A
screen that opens filtered makes a claim over a subset by default, which is
Rule 3c with nobody having chosen it. It opens on everybody now, and the search
counts as a narrowing filter so "clear" clears it too.

**3, the admission form** had a max width and no auto margin, so its measure
sat against the left edge with the rest of the screen empty. Centred.

**4, the Target date** wore `.textarea`, whose 96px minimum exists so somebody
can write a paragraph. On a date field beside a select, in a two-column row
read as a pair, it was three times the height of its neighbour. It has its own
class matching the select's trigger.

**5, check marks.** `SelectedMark` is one component and one treatment for a
chosen option, using the same tick the `Select` menu and the `Checkbox` already
used. Applied to the consent scope chips Frank named and to every filter pill,
status tab and view toggle in the product. A filled pill beside an unfilled one
is colour carrying meaning alone, which §7 does not allow.

Two stylesheets had **no rule for the pill class their screens rendered** — care
plans among them, where the queue's filters carried no class at all and had no
visible chosen state.

**6, notes.** The tab called "All notes" showed only today, which is the one
thing a tab of that name must not do: somebody looking for Tuesday found
nothing and could not tell that from its not existing. It holds the whole
record now, fifteen to a page, with the total and the slice stated above the
list. By author is tabs with All staff among them rather than a dropdown, and
the same paging serves all three.

The rule the old default protected still holds and is still guarded: **no named
member of staff is chosen for the reader.** All staff is, which is not the same
as somebody being put under supervision by accident.

**7, signing.** The round asked for four digits and checked only that four had
been typed, which establishes that a person was at the trolley and nothing
about which person. On a shared device that is the shared-login failure with a
keypad in front of it. `SigningIdentity` is one component for every signing
surface: it names who is signing, takes a code belonging to them, checks it, and
states what goes on the record. Wired into the medication round and the handover
signature.

Said on the screen, because a home would otherwise trust it: **an identifier,
not a password.** There are no accounts in this build, and a code that implied
otherwise would be the more dangerous of the two.

**8, the CQC decision.** The three buttons on the incident had no `onClick` at
all, so a duty the compliance panel tracks could be read, judged and then not
recorded. `notification-store` takes the three decisions, each carrying who and
when; "not required" refuses an empty reason and a notification refuses an empty
reference, because a judgement with nothing behind it cannot be told from nobody
having made one. The incident reads through this session's decision, so the
screen stops saying nobody has decided the moment somebody has.

Verify: 54 files, 1,132 tests, six lint rules green.

---

## Document viewer, pharmacy cycle, interim medication

Three screens from `docs/documents-medication-intake.html`.

**Routes.** `/documents/:documentId` for the viewer, reached from the Open action on
a document row. Two new tabs on Medications: Pharmacy cycle and Add interim. The
Medications tab strip is now five.

**Tokens.** Three added, values taken from the reference, which states why brand
purple is wrong for the stage: `--stage-ground: #2a2140`, `--stage-banner: #3a3154`,
`--shadow-page`. The reference's reasoning is that a dark *neutral* makes the page
it holds read as paper; brand purple would make it read as a product surface.

### Document viewer

Replaces "not retrievable" only where the metadata is real. `file.kind ===
'not_retrievable'` — a document added this session, with no type to sample and no
filing behind it — keeps the message it had. A broken reference keeps "Cannot open,
not on file" untouched, and there is a guard asserting the row has no Open link and
no `/documents/` href at all.

The banner sits above the page, never across it. It carries neither the hatch nor
the caution treatment: the sample is a fact about a build with no file storage, not
a gap in a care record and not a finding about this home. `lint:hatch` caught the
first attempt, which had given it a dashed unrecorded border.

The rail's "what points at this document" is the broken-reference relationship seen
from the other end. It is derived by `documentReferrers`, which walks the residents
rather than holding a list.

**Two defects found by reading the screenshot back, neither visible in the DOM
dump or the tests.**

1. The banner said "a representative dnar form". `document.title.toLowerCase()`,
   applied to a title somebody typed into a record. Second occurrence of a §8 entry
   written a phase earlier. Fixed at both sites, and the same transformation was
   found and removed on `allergy.reaction` — free text on a clinical record that
   can carry a device or a drug name.
2. The rail said "3 records rely on this document" where two of the three reached
   it through one field: `resident.resuscitation` and
   `resident.futurePlans.resuscitation` are the same decision, and the fixture
   builds the second from the first. Counting both made one record read as two
   things relying on the document. `documentReferrers` now asks the top-level
   field only, and a guard pins one future-plans entry per decision.

Both are new §8 entries, along with a third from the cycle screen.

### Pharmacy cycle

Four tallies, the fourth hatched: on the MAR but not in the cycle. Derived by
`gapsAgainst` as a set difference, not a hand-written list — a drug the home is
still giving that the pharmacy has stopped supplying is invisible from either side
alone, which is what makes the screen a comparison.

No accept all. The guard states it as a property rather than as a ban on a name:
every accept control belongs to exactly one row, and the count of controls equals
the count of rows. A first attempt scanned the store's export names for /all|bulk/
and failed on `allHandled` — an assertion about spelling, not behaviour. Mutation-
tested by adding an Accept-all button; the guard fails on it.

The footer counts changes, not rows: the gaps below them are findings the pharmacy
did not send, and they are not changes anybody can accept.

**Defect found in the screenshot:** gap rows read "30mg · 30mg · capsules".
`Medication.form` is *form and strength as the register lists it*, and the row put
`dose` in front of it. Seventh instance of the one-owner rule, and the first found
by reading a string back rather than by reasoning about ownership.

### Interim medication

Source first and required, with no default — a pre-selected route is the system
answering "where did this come from" on somebody's behalf.

The controlled drug refusal is stated where the route is chosen, before anybody
types. It wears the caution border the reference gives it.

A verbal order reveals a witness field and adds the witness to what the form is
waiting on. The 24-hour written confirmation is stated as an obligation that stays
outstanding on the record.

Allergies render beside the resident field, and all three members of the union are
reachable from the residents on this site. The hatched member has its own guard:
mutation-testing found that a guard covering only the `allergies` branch passed
while the union was collapsed and the hatch destroyed.

**Two changes beyond the reference, both stated here rather than assumed:**

1. Strength and dose are both required. "One tablet" is a different prescription at
   250mg and at 500mg, and whoever gives it cannot tell which from the MAR chart.
2. The prescriber and supporting-document fields moved below the resident, into
   their own section. Documents are filed against a person, so a list of filed
   documents offered before anybody has said who this is for can only be empty.

### Standing

`npm run verify` green: 1156 tests, 57 files, all eight lint scripts.

One pre-existing unhandled error, unrelated to this work and left alone:
`src/features/group/group.test.tsx` throws `TypeError: Cannot read properties of
undefined (reading 'element')` after its 16 tests pass. It reproduces in isolation.

**Found while running the suite after midnight, unrelated to these screens.** Two
care-notes tests went red at 00:02 that had been green all evening: they built
notes with `new Date()` while the screen asks what "today" is through the
generation clock, and the two part company the moment the clock is not real time.
Third occurrence of the §8 entry about tests deriving from `now`. Fixed at four
sites — the two failing ones, one more in the same file that would have gone the
same way, and two in `notes.test.tsx` that were recording notes four hours in the
future relative to the app's clock.

---

## Staff onboarding and authentication

Five screens from `docs/staff-auth.html`. **Gated**, on Frank's call: every route
redirects to `/sign-in` until somebody signs in, and a reload signs you out
because there is no session to remember.

**Routes.** `/sign-in`, `/invitation/:staffId`, `/invitation/:staffId/access` and
`/sign-out` sit outside the shell. `/me` and `/me/permissions` are inside it.

**Identity.** The session gained a `SignInState` union. Signing in sets who the
current user is, so the top bar, every author line and `/me` follow it. Signed
out, `currentUser` falls back to the registered manager — which is what this
field was before there were accounts — and the gate means no product screen ever
renders under it.

Signing in as Kwame Osei renders the reference exactly, from real records: he has
been in the fixtures since Phase 0.

### Signing out is real, and that was the engineering

Everything this build writes is in memory. Signing out now calls `endSession()`,
which resets all twelve stores, so the confirmation had to be true.

**The obvious source was wrong.** `session-log.ts` exists to record what a
session wrote, and its docblock said every write passes through one logging
function in the client. Nine of the client's nineteen write functions never reach
it — every medication round, PRN dose, controlled drug opening count, review flag
closed, care plan draft saved and every undo. A loss list built on the log would
have destroyed a shift's medication records under a list that did not mention
them, and looked complete while doing it. The docblock has been corrected and
says what it actually covers.

So `session-losses.ts` asks each store. Every store gained a `…Holdings():
SessionHolding[]` naming what it holds in its own words — only the note store
knows that its "4" means care notes and not doses — and a `resetSession…()`.
`scripts/check-session-losses.mjs` fails `npm run lint` if a store in
`src/data/access` holds session state and the loss list does not ask it. Proved
in both directions: a thirteenth store added, and an existing one dropped.

Six stores had no reset at all. Four had one commented "Test hook. Nothing in the
app calls this" — now something does.

`team-store` needed the most care: `setStanding` writes onto the member objects,
so resetting had to rebuild them from the fixtures rather than copy the array.

### What the reference asked for and what the data allowed

**Two departures, both because the honest version is different.**

1. **"On your list, not written up" is "Nobody has written up".** There is no
   rota in this build, so nothing allocates a resident or a round to anybody. A
   tile saying "your residents" would invent an allocation nobody made — and put
   a person's name against a gap they were never given. The tile counts the
   home's list, carries its denominator, and says on its face that it is not
   allocated to anybody including you. The next-round tile says the same.
2. **Sign-in asks who you are signing in as, not for an email address.** Identity
   here is a choice from the team, and a free-text email field would be a second
   control that does nothing on the screen carrying the notice about the first.
   Only people whose standing is `has_access` are offered: somebody suspended, or
   on the team with access never set up, is an access decision the team record
   already made.

The "no counts of your work" refusal is on the dashboard and holds: three tiles,
none of them a total of this person's output, and a list of what they recorded
with no figure above or below it.

### Fixture limit, and a decision for Frank

**The only invitation in the fixtures is expired.** Laura Bennett is the one
person with `never_given_access`, added 38 days ago, so her invitation lapsed —
which is a real and useful state, and the screen handles it as a screen rather
than as a failure on submit.

The live path is reachable only through Team → add somebody, which creates a
`never_given_access` member dated today. A second person invited this week would
put both states on a fresh load, and that is one more staff member — which makes
PRD §5.2's "14 staff" fifteen. Not changed: that figure is Frank's.

### Defects found, and one class that is new

**The hatched tile rendered as a plain white card.** It carried
`composes: unrecorded`, `data-state="unrecorded"` and a `className` matching
`/unrecorded/` — three green assertions — while a shared `.tile, .tileNow,
.tileWarn, .tileGap` rule set `background: var(--bg-surface)` and won on source
order. Nothing was wrong in the DOM. Found in a screenshot, confirmed in
greyscale after the fix. New §8 entry: a `composes:` is a claim about cascade,
and cascade is only observable in a picture.

**An assertion that could not run.** The invitation guard checked that role and
access render above the password fields, inside `if (password !== null)` — and
the only invitation in the fixtures is expired, so there are no password fields
and the check never ran. Now built against a live invitation through
`addMember`, with the password checklist guarded too. New §8 entry.

**Two assertions that could not fail**, both caught by mutation rather than by
reading: a `compareDocumentPosition` check asking about containment rather than
order, and a loss-total guard whose sample had every count at 1, so the sum and
the row count were the same number.

**Stale claims corrected in five places.** The permission matrix said the build
had "no sign-in and no session identity beyond one hard-coded user"; the top bar
said sign out was absent because "there is nothing behind it"; `AppShell` passed
`userRoleLabel="Registered Manager"` as a literal. All rendered on every screen
and all were true when written.

**`router.routes[0]`** in four guards, plus two more in other files. Adding
routes outside the shell broke six assertions that had nothing to do with
authentication: they held the shell by its index. Now found by what it is.

**The care-notes flake is fixed.** `takes the note off the queue once reviewed`
read a row count before the queue had finished rendering, then waited for
`before - 1` — a target the list had already passed. It now names the note it
reviewed and asserts that one is gone.

**A dashboard chart guard was hour-dependent.** It asserted the donut's
no-record arc outright; before the first round closes there is nothing
unrecorded and the arc does not exist. It failed at 08:57 on a correct screen.
Now a property over whichever absence elements render, with the bar segments as
the floor so the sweep cannot go quiet.

### One thing to look at

A care worker's row shows **Record** against Dashboard and Residents. That comes
from Phase 14's `BASE.care_worker: 'record'` with no exception for either, and it
renders the same way on the manager's matrix. It was not visible as a problem
until this screen put it in front of the person it describes. Changing it is a
change to the permission model, so it is Frank's call.

### Standing

`npm run verify` green: 1196 tests, 60 files, nine lint scripts (`lint:losses`
is new). The pre-existing unhandled error in `group.test.tsx` is unchanged.

---

## Corrections: the second invitation, and the permission rows

**Fifteen staff.** Funke Adeyinka is a care worker invited two days ago and not
yet accepted, beside Laura Bennett whose invitation lapsed 38 days ago. Both
invitation states are now reachable from a fresh load, which is the reachability
rule: a branch nobody can get to without first doing something else is not built.
The live path previously existed only for a reviewer who went to Team and added
somebody. `fixtures.test.ts` takes 15; Frank is correcting PRD §5.2.

A guard holds both states by what they are — one invitation somebody can accept
and one that has run out — and fails five ways when the fixture is removed.

It also caught a positional lookup in the making: `invitations()[0]` was the
lapsed one until the live invitation sorted ahead of it, at which point the guard
for the expired screen was pointing at a form. Both are now chosen by predicate.

### The permission matrix

**Fixed as a class rather than as cells.** A care worker read "Record" against
the Dashboard and against Residents. The Dashboard records nothing for anybody,
and Residents-record means admitting or editing a resident, which is a manager
act. Correcting those two cells would have left the mechanism that produced them.

Each module now declares what it actually offers — the write, and the sign-off,
each named — and `levelFor` returns the lower of the role's level and the
module's ceiling. What that changed beyond the two rows asked for:

- **Dashboard** is Read for every role. It was Record for four and Approve for
  two.
- **Reports** is Read for everybody who sees it. Approve on a view over records
  written elsewhere is an act that does not exist.
- **Residents, Risk Assessments, Goals, Activities, Documents, Settings** drop
  from Approve to Record for managers: none of them has a sign-off act.
- **Residents** is Read for senior carers as well as care workers, on the same
  reasoning Frank gave for care workers.

`ceilingFor` throws on a module with no acts declared, because an uncapped module
is how Record got onto the Dashboard in the first place. A guard asserts no cell
exceeds its module's ceiling, and it fails when the cap is removed *and* when the
cap itself is wrong — the second mutation matters, because a property test over a
ceiling passes happily if the ceiling says the Dashboard takes writes.

**Five dead exceptions found in the same pass.** Four roles carried a `/team`
entry, and `/team` stopped being a sidebar item in Phase 15 when Team, homes and
figures became tabs under Settings. They narrowed nothing for anybody and still
read as decisions somebody had taken. A dead exception is worse than a missing
one.

**Why nobody caught this for fifteen phases**, which is the §8 entry: a
permission matrix reads as a specification of somebody else's access. A reader
checks its shape, not its claims, because a cell about another person's job is
one nobody has the standing to contradict. Showing the same row to the person it
describes is the first audit it ever gets — and the cheapest one available.

### Both departures stand

Frank confirmed the third tile and the sign-in identity choice. On the tile: "your
residents" is the omissions-per-staff column from Phase 13 in another costume — a
figure that attributes a gap to somebody who was never given the allocation. The
reference invented one to make a sentence read better.

**A pattern worth naming from the same pass: an exception that no longer excludes
anything is indistinguishable from one that does.** Four roles carried a `/team`
permission exception. `/team` stopped being a sidebar item in Phase 15, when
Team, homes and figures became three tabs under Settings — after which those
entries narrowed nothing, for nobody, on a module that no longer existed. They
still read as decisions somebody had taken, and a reader has no way to tell a
rule that fires from one that cannot: both are a key and a value, both look
deliberate, and the one that does nothing looks *more* deliberate because it is
the unusual case.

Nothing found them for a phase and a half. What found them was re-deriving the
matrix from the modules rather than reading the table: `levelFor` now throws on a
module with no acts declared, so an exception naming a module the sidebar does
not have is a crash rather than a silence. That is the same shape as the sidebar
alert that told every screen the Reviews module was coming for nine phases after
it shipped — true when written, invisible once ubiquitous, and only found by
asking the source rather than reading the output.

The general form: **a rule with no subject cannot be distinguished from a rule
with one by reading it.** Only re-derivation finds it, which means the exception
list has to be checked against the thing it excepts from, not reviewed.

---

## Sign-in, rebuilt to the reference

The screen had five paragraphs of explanation on it and they were read as a wall
rather than as five statements. Removed: the page heading and its subtitle, the
prototype banner, the timezone sentence, the note about who appears in the list,
the "nowhere to send a reset to" line, and the access count.

**The email field replaced the team-member select.** An address is derived from a
name and a home — `k.osei@rosewoodcourt.example`, exactly as the reference — by
one function that both suggests and recognises it, because two places building an
address from a name is two rules and the second drifts the day somebody has two
surnames. `StaffMember` gained no email field: it holds the minimum on purpose,
and a field nobody has decided how to protect is how a care system starts holding
data it was not built to hold.

Any password is accepted and none is checked. **The person is still real**: an
address matching nobody leaves the button down, because a session belonging to
nobody in particular would put a name on every record written afterwards that
nobody could be asked about. Somebody suspended, or never set up, has an address
that reads like everybody else's and does not get in — the team record already
took that decision and the form does not retake it.

**The prototype statement moved rather than went.** It is behind the
forgotten-password link, which is the one control on the screen that cannot
honestly do what it says — so the click that would have exposed the absence is
the click that explains it. Same words, on-demand instead of always-on. It stays
as a banner on the invitation screens, where somebody is being asked to accept
something.

That is a deliberate narrowing of a property this build previously held, and the
guard says so in place rather than quietly covering two screens under a name
claiming three: sign-in is now absent from the "on every authentication screen"
list, with the reason written above it.

**What the removals did not cost.** Each site row already carried its own
timezone, so the choice still states its consequence without the sentence
explaining it. The screen is centred now: a card pinned to the top edge over an
empty half-page read as a page that had failed to finish loading, which was
invisible while a heading and a notice sat above it.

---

## The product mark, and the sign-in panel

**Two SVGs supplied, moved into `src/assets/brand/`** as `logo-lockup.svg`
(mark plus wordmark) and `logo-mark.svg` (the mark alone). The Figma export
names went with the move.

**Not an icon, and deliberately not in the icon registry.** That pipeline is
generated from the Aligned Line Icons set and normalises everything to
`currentColor`; a two-tone lockup put through it would come out flat.

**Colour comes from CSS, not from the file.** The artwork bakes in `#6935CF` on
the mark and `#1E0059` on the wordmark — which are `--purple-600` and
`--purple-900` exactly — and every path now carries `data-part`, so a CSS
`fill` can override both. That is what lets the same lockup sit on a white rail
and on the deep purple sign-in panel: `tone="ink"` is the artwork as supplied,
`tone="light"` puts the whole thing in one light colour, because a two-tone
mark on a dark ground loses the darker half of itself.

**The guard is about a failure that is invisible to a DOM query.** A re-export
from the design tool would drop the `data-part` attributes, the artwork would
fall back to its baked hex, and the mark on the sign-in panel would render brand
purple on brand purple — present, correct, and unreadable. Nothing else in the
suite would have noticed. The guard breaks when the attributes are stripped.

**The stand-in it replaced is gone.** `shellIcons.logo` was
`medical/healtcare`, a stethoscope standing in until there was a real mark, and
a stand-in that outlives the thing it stood in for is indistinguishable from a
decision. The registry is down to 41 icons.

**The name announced is the name on the artwork.** The mark reads "Radiant
digicare" and the product's copy says diGi-Care in thirty places; Frank's call
is that the logo goes in as it is and the copy stays. So the accessible name is
"Radiant digicare" — a screen reader hearing "diGi-Care" for an image showing a
different word is being told about something other than what is on screen.

**Sign-in panel.** Contents centred in their half: a 400px column in a 700px
panel leaves 300px of nothing, which was invisible while a page heading and a
five-line notice sat above the card and became the widest thing on the screen
once they went. The fields stay left-aligned inside the centred column, because
centred form labels read as a poster. The timezone sentence is back under the
home choice; "Prototype build. No data leaves this browser." is gone.

One alignment slip found in the read-back and fixed: `.lede` had a `max-width`
of its own, so inside a centred column it centred itself and read as a one-word
indent under the heading.

**An intermittent failure fixed on the way past**, unrelated to this work.
`important-people.test.tsx` clicked a confirm button by `screen.getByRole` with
a name that the dialog's button *and* every row button behind it satisfied. It
passed only when Radix had already hidden the background from the accessibility
tree, which it had not always done by that point — so the query threw on roughly
one run in three. Now scoped to the dialog. A name that more than one element
can satisfy is not a name.

---

## Seven changes, and two that removed the only way in

**Password reveal**, as a primitive rather than three copies. Sign-in has one
field and the invitation has two, and a reveal that behaves differently on the
confirm field from the one above it is how somebody concludes their password did
not match when it did. The control is labelled with the direction it goes —
"Show password" while hidden — because a toggle labelled with its current state
reads as a claim about the field rather than as something to press.

**Residents**: the three views moved to the left of their row.

**Account menu**: "View as" removed, icons on the three items. The icon names
live in `top-bar.icons.ts`, because a name written in a plain object literal
inside a `.tsx` is invisible to the usage scanner, drops out of the registry and
throws when the component renders.

**Sign out**: matched to the reference. The destructive control is an outline
rather than a solid fill — a solid red button is the loudest thing on a screen
whose loudest thing should be the list of what would go. Sign-in keeps its
vertical centring; the screens that lead with a heading do not, because centring
a page that starts with a title puts the title in the middle of the screen.

**Team**: the three controls moved opposite the ordering note, on the row that
says what the list is. The note is cut to one line.

**The "Review" section is out of the sidebar**, and `/dev/states` is still
routed. It was never a product module — it sat under a heading of its own, which
put a developer's tool in a care manager's navigation.

### What the removals cost, and one guard that could not see it

**Read-only is now unreachable.** "View as" was the only control that set
`accessMode`, and it is one of the seven states every screen is reviewed against
(PRD §6). The session still carries the mode and five screens still branch on
it; nothing can currently reach those branches. Removing it was asked for and is
done; where the control should live instead is a decision, not a defect, and
Settings is where the rest of the configuration is.

**Taking `/dev/states` out of the rail exposed a hole in the reachability
guard.** Both of its directions start from `navItems` — every enabled item has a
route, every route has an enabled item — so a route with *no* sidebar entry at
all is invisible to both. The guard whose docblock says a module reachable only
by typing the URL is not built could not see one.

Closing it found seven more immediately: `/me`, `/me/permissions`,
`/residents/new`, `/documents/expiry`, `/compliance/pack`,
`/compliance/notifications` and `/incidents/new`. None is an orphan — each is
opened from a screen rather than from the rail — which is the distinction the
guard now makes: a route with no nav item must be named in a short list that
says **where it is reached from**, and that entry point must itself be a route.
An unlisted route with no way in fails.

The second half of that guard is the dead-exception lesson applied immediately:
an excuse naming a route that no longer exists narrows nothing and still reads as
a decision somebody took, so the list is checked against the router in both
directions. Both fail on their real defect.

**And one guard rewritten rather than re-pinned.** The team ordering note's
assertion matched the sentence verbatim and failed the moment the sentence was
shortened. It now asserts the reason — that a table of people sorted by a count
is a ranking — because the reason is what stops somebody adding the sort control,
and an ordinary rewording should not be a test failure.

---

## A way into onboarding

**How you reach it: sign in → "I have been invited and need to set up my
account" → `/invitation` → a person → their invitation.**

**In a real deployment that link does not exist.** An invitation arrives as a
link in an email addressed to one person, and that link is the only way anybody
reaches theirs. Nothing here sends email, so the alternative was an onboarding
path openable only by somebody who already knew the URL — which is the same as
not having built it.

So `/invitation` lists who the team record holds as added-and-never-set-up, and
says on the screen why it is listing them. It is not a staff directory:
everybody on it is in the one standing an invitation exists to close.

**Both states are on it, and the lapsed one is not filtered out.** An invitation
that ran out is a finding about a home — somebody was added over a month ago and
nobody followed it up — and a list showing only what can be acted on would report
that as nothing to do.

### The guard was blind to half the router

`topLevelPaths()` read the shell's children, which was the whole router until
four authentication screens landed as *siblings* of the shell. After that
`/sign-in`, `/sign-out` and both invitation routes sat outside every assertion in
`reachability.test.tsx` — including the one written yesterday to catch a screen
with no way in. **The guard that exists to find unreachable screens could not see
the four screens that are not in the sidebar by design.**

That is §8's medium-blindness entry in a new place: when a concept gains a new
place to live — a new file type, a new renderer, a second branch of the route
tree — every check naming that concept is narrower than its own success message.
The check either learns the new place or its message stops claiming the concept.

It has learned it. `topLevelPaths()` now reads both, the four authentication
routes are named in the exception list with where each is reached from, and a
route added outside the shell with no way in fails — proved by adding one.

### One more clock finding, third of its kind here

`fixtures.test.ts` asserted the record-clamp against `Date.now()` while
`recordedBetween`'s ceiling is `NOW`, the generation instant. With the clock on
the 08:00 round and the wall clock at 13:45, an event "six hours before now" is
five hours *after* `NOW`, so the clamp pulled it back and the assertion failed on
a function that was working.

Two neighbouring sweeps had the same defect pointing the safe way — "no record
later than `Date.now()`" passes trivially when the fixture's present is hours
earlier — so they were weaker than they read. All four now use `NOW`, which is
what they always meant.

---

## The invitation flow, stripped

Same treatment as sign-in. Removed: the page heading and subtitle on all three
screens, the prototype banner from all three, the note about who is in the list,
the password-privacy line, the long expiry paragraph, and the closing sentence
describing what accepting would do.

**The statement did not go; it moved onto the control it is about.** Accept and
set up my account creates no account, so pressing it opens the statement and
then returns to sign in. That is the same move as the recovery link on sign-in,
and for the same reason: five lines of preamble above a form are read as a wall
and skipped, while the sentence attached to the act is read by somebody who is
deciding rather than skimming.

Both now read from `prototype-statement.ts`. Two screens saying it separately is
two wordings, and the one that goes stale is whichever the reader is looking at.

**The guard says the banner is gone rather than quietly dropping the
assertion.** It asserts no authentication screen carries it, and separately that
the statement is behind Accept — so the property that this build says what it
does not do is still held, in the place it now lives. Both fail on their real
defect: Accept navigating away silently, and a banner reappearing on any of the
four screens.

**"Nothing here is enforced" is one line now**, on both permission screens. It
stays before the first row: a list of permissions is the most convincing thing on
any screen and this one decides nothing. The paragraph explaining that went.

**Two links to one destination collapsed to one.** "See what this means" under
Access and "See what I would be able to do" in the footer went to the same
screen. The footer control keeps it.

Heading order fixed on the way past: the card's own heading became the page's
`h1` when the outer one was removed, which left the section headings skipping a
level. `vitest-axe` caught it.

---

## What the Figma export was losing, and a bug it uncovered

The export was not damaged HTML. Every text node, colour and box came through;
what it lost was **both charts**, and it lost them for two separate reasons that
are the same underneath: neither chart was drawn as geometry.

**The hatch was declared in an `<svg>` of its own and referenced from four
others.** `ChartDefs` rendered one hidden `<svg>` per page holding the
`<pattern>`, and each chart filled with `url(#digicare-chart-hatch)`. A browser
resolves that, because ids are document-wide. Anything reading one `<svg>` as a
standalone document does not: it finds a fill pointing at a paint server that is
not there and falls back to solid.

**Which means the export inverted the meaning of the most load-bearing visual in
the product.** A hatched bar segment is doses nobody recorded; solid purple is
doses that were. Every gap in the exported file reads as recorded, and the file
looks like a home with nothing outstanding. That is worth more than a rendering
note — anyone reviewing that Figma page would be reviewing the opposite of what
the screen says.

The pattern is now declared inside each chart's own `<svg>`, with an id minted
per instance by `useId` — one definition in the source, one per chart in the
document, no reference crossing an `<svg>` boundary.

**The arcs were `stroke-dasharray` on a full circle.** That renders correctly
and is a trick rather than a shape: nothing in the markup says where an arc
starts or ends, only how long the painted run is and how far the dash is
offset. An importer repeats the dash, which is what the markup literally says,
and the donut arrives in pieces. Both charts now draw explicit `M … A …` paths.

### The bug that was hiding behind the dash

The dash convention is 0–100 because the donut's radius is 15.915, whose
circumference is 99.997. **The rings copied the convention at `r=17`, whose
circumference is 106.814** — so every ring painted its share times 100/106.8. A
round with 76 per cent recorded drew 71. It understated what a home had done, on
a chart a manager glances at, and nothing caught it for a phase.

That is the copied-formula entry again: a formula is a second rule even when it
is copied correctly, because the constant that made the original true does not
come with it. Explicit arcs take a fraction and a radius, so there is no
constant to leave behind.

### Two guards, and why the first one was not enough

`data-arc-share` and `data-ring-share` state what is painted, so a guard reads
the number the component committed to rather than measuring a path string —
which would be the same arithmetic written twice.

**But an attribute is the component's claim, and the claim and the drawing come
from one variable, so they cannot currently disagree.** A guard reading only the
attribute passes on a wrong radius, a wrong start angle, or a sweep flag the
wrong way round. So a second guard measures the ink: it takes the arc's two
endpoints out of the `d`, converts them to angles about the centre, and compares
the swept fraction with the share claimed. Mutating the radius by exactly the
factor the old dash bug had — 100/106.8 — fails it.

The hatch guards changed the same way. They compared the fill against a literal
id, which said nothing about whether it resolved; they now follow the reference
and assert the `<pattern>` exists **inside the same `<svg>`**, which is the
defect itself.

**Applied everywhere, and now enforced.** Three files in the build render raw
SVG: the Icon component, the incident body map, and the Dashboard's charts.
Only the charts used either broken mechanism, so fixing them fixed the build —
there is no `url(#…)` and no dash-drawn arc anywhere else.

That was true because the Dashboard is the only screen with charts, which is a
fact about today rather than a property. So `scripts/check-svg-portable.mjs`
now fails the build on either shape: an `<svg>` that declares paint and draws
nothing, so every reference to it crosses an element boundary; and any
`strokeDashoffset`, which is an arc pretending to be a dash. Both proved by
reintroducing them.

Two differences between screen and export remain, and neither is a defect in
the markup:

- **The sidebar exports one viewport tall.** The shell is `height: 100vh;
  overflow: hidden` with the main region scrolling inside it, which is what a
  fixed rail beside a long page *is*. An exporter walks the scrolled content and
  gets a page taller than the rail. Changing it would change the product; in
  Figma it is one drag.
- **One list in Medications loses its bullets.** `.requiresItem::before` draws
  them, and pseudo-elements have no node to export. It is the only pseudo-element
  in the build carrying a visual.

---

## Two gitignore findings, both silent

**A pattern with no leading slash matches at every depth.** `export/` was written
for the Figma output at the project root and also matched `scripts/export/` —
the exporter itself, which is source. It was never committed, and nothing said
so: an ignore rule reports no collateral, the folder simply does not appear in
`git status`, and `git add -A` skips it without a word. It surfaced only because
somebody went looking for the exporter on GitHub and it was not there.

Same shape as the selector-specificity check in a different file format: a
pattern that names less than it matches, where the over-match is invisible
because the failure mode is silence rather than an error. `/export/` anchors it.

**And a check whose success message was wider than what it verified.**
`src/assets/icons-generated/` is generated rather than committed, and
`registry.generated.ts` — which *is* committed — imports forty-six SVGs from it.
So on a fresh clone the registry is perfectly current and every icon it imports
is missing.

`npm run icons:check` passed in exactly that state and printed "registry is
current", which was true of the two files it compared and useless to somebody
whose test suite had just failed to resolve forty-six modules with no mention of
icons in the error. `predev` and `prebuild` masked it for the two commands that
have hooks; `npm run test` and `npm run verify` have none, so a fresh clone could
run the build and not the suite.

Both halves fixed: a `postinstall` generates the icons on `npm install`, and
`icons:check` now asserts the files are on disk rather than only that the
registry describing them is current.

---

## The install that only worked on this machine — 29/08/2026

Vercel failed on `npm install` with an ERESOLVE peer conflict:
`eslint-plugin-jsx-a11y@6.10.2` declares `eslint` `^3 || … || ^9`, and we are
on `eslint@10`. It had never failed here because the local tree was installed
once with `--legacy-peer-deps`.

**That flag left no trace in the repository.** No `.npmrc`, project or user —
checked both. It was typed at a terminal, and the only thing that remembered it
was this laptop's `node_modules`. Anyone cloning got the failure on their first
install, and the first machine to actually report it was a build server that
had never seen the flag. A dependency decision that lives in a shell history is
not a decision the project has made.

### Upgrade first, override second

Checked before reaching for the override, as asked: **6.10.2 is `latest`**.
There is no newer jsx-a11y, and no prerelease — `dist-tags` are only `latest`
and a `v5-backport`. Every other ESLint plugin here already declares 10:
`react-hooks` `^10.0.0`, `react-refresh` `^9 || ^10`, `typescript-eslint`
`^10.0.0`, `@eslint/js` `^10.0.0`. jsx-a11y is the single laggard, so there was
nothing to upgrade to and the override is the remaining answer.

```json
"overrides": { "eslint-plugin-jsx-a11y": { "eslint": "$eslint" } }
```

`$eslint` rather than a pinned literal, so it tracks whatever `eslint` version
the project declares. A hardcoded `^10.8.0` here would be a second place to
remember to bump, and it would be the place nobody remembers.

### The override is not hiding a real incompatibility

Worth separating, because silencing a peer warning and fixing a break look
identical from the install log. **The plugin works on ESLint 10** — a probe
file with `<img src="/x.png" />` and no alt was flagged by `jsx-a11y/alt-text`
under `eslint@10.9.1`. The stale declaration is the whole problem; the code
behind it is fine.

### Proved by breaking it

`rm -rf node_modules package-lock.json` then a plain `npm install`, no flags:
**succeeds**. Then the mutation — the same clean install with the `overrides`
block deleted — **reproduces Vercel's exact error locally**, naming the same
peer range. So the override is what fixes it, rather than something incidental
like the npm version being more forgiving.

Regenerating the lockfile moved **64 packages**, all within the semver ranges
already in `package.json` — `eslint` 10.8.1 → 10.9.1, `react-router`
7.18.2 → 7.18.3, `vite` 8.2.1 → 8.2.2 and so on. Expected when a lockfile is
deleted rather than a symptom.

**`--legacy-peer-deps` is no longer needed anywhere**, and nothing in the repo
asks for it.

### `npm run verify` is not green, and was not before

Reported rather than tidied away, because it would be easy to leave the
impression that this change cleared the board. Two failures, both pre-existing:

- **`group.test.tsx`** — 16 of 16 assertions pass, but the file exits 1 on an
  unhandled rejection. `GroupOverviewRoute` does `navigate('/')` on the
  card's switch control, and the test's memory router has no `/` route, so
  react-router completes the navigation against an undefined match and throws
  `Cannot read properties of undefined (reading 'element')`. **Confirmed
  identical on the committed tree** by restoring `package-lock.json` from git
  and running `npm ci --legacy-peer-deps` — same exit, same error. It is a test
  harness gap, though it is worth deciding whether the product should navigate
  to `/` at all when `/` only redirects to `/residents`.
- **`care-notes-route.test.tsx`** — passes 32 of 32 in isolation in 42s, fails
  once in the full run at 66s. A load-dependent timing flake, not a
  dependency-resolution consequence.

Neither is a dependency problem and neither is fixed here; both are somebody's
decision rather than a silent repair on the way past.

---

## The 42 seconds was not what it looked like — 29/08/2026

### Standing check: state that lives outside the repo

**A flag typed once at a terminal is invisible to everyone who clones
afterwards, and it surfaces on a machine that has never seen it.**
`--legacy-peer-deps` installed this tree for weeks and left nothing behind — no
`.npmrc`, project or user. The build server was the first machine to run a
plain `npm install`, so it was the first to see the failure that had been there
all along.

Same family as the gitignore pattern: **the state that matters lives somewhere
nobody reading the repo can see.** A shell history is not a decision the
project has made. If a command needs a flag to work, the flag belongs in a file
that gets committed, or the need for it does.

### `navigate('/')` — my report was wrong, so the fix was not the one asked for

I reported `/` as "a route whose only job is to redirect to `/residents`". That
was true before Phase 12 and has not been since: `{ index: true, element:
<DashboardRoute /> }`. **`/` is the Dashboard.** The sidebar's Dashboard item
points at it deliberately, with a comment saying there is no second URL for the
same screen.

So `navigate('/')` from the group overview already means "go to this home's
dashboard" — the destination Frank asked me to change it to. There was no
redirect hop and no product change to make. The other `navigate('/')`, on
sign-in, is correct for the same reason.

**The real defect was in the test, and it was worse than a missing route.** The
memory router had `group` and `settings` and no `/`, so the click navigated
into nothing and react-router threw. The assertion was:

```
await user.click(open)
expect(container.querySelector('[data-group-overview]')).toBeTruthy()
```

which passed **because** the navigation crashed. Had the button worked, the
overview would have unmounted and the assertion would have failed. A test that
is satisfied by the wreckage of the act it is testing.

Now the router has `/`, and the assertion reads the act: the stand-in prints
the active site, so one check covers both halves — the session moved and the
reader moved. Proved by mutating each half separately: removing `navigate`
fails on "expected null to be truthy", removing `setActiveSite` fails on
"expected 'Rosewood Court' to be 'Ashgrove Lodge'".

### The 42 seconds: measured, not guessed

The suspicion was 397 unpaginated notes. **It was not**, and the numbers say so
plainly:

| | |
|---|---|
| Synchronous mount | 33ms |
| Waiting for content | 944ms |
| DOM rendered | 168 nodes, 5 list items |
| 120ms latency sleeps per render | 1 |

The feed paginates at 15. The DOM is tiny. Only one simulated-latency sleep.
None of the usual suspects.

Timing the three derivations over the site's 11,125 notes found it:

```
authorsIn ............ 1.1ms
flaggedNotReviewed ... 0.2ms
withoutNoteToday ..... 404.7ms
```

`withoutNoteToday` asks which day each note falls on, so it called `zonedDate`
11,125 times — and `zonedWallClock` **constructed a new
`Intl.DateTimeFormat` on every call**. Construction is the expensive part,
about 36µs; formatting with one that exists is well under a microsecond.
11,125 × 36µs is the 405ms, and 32 tests each paying it is the 42 seconds.

Cached by shape and zone in `format.ts`: **404.7ms → 39.6ms**, and the file
**42.16s → 12.42s**.

This was never only a test cost. `zonedDate` is called in loops by the
dashboard, the group figures, the MAR chart and the note series, so the real
screens were paying it too — 405ms of blocked main thread on every load of the
care notes screen.

### Still outstanding: the profile timeline, and it IS the windowing case

`npm run verify` now exits 0 and the suite is 69.8s → 50.6s. But it is not
stable: one run in two came in at 76.7s with three timeouts across three files,
all of them `waitFor` running out rather than anything asserting wrongly.

The headroom is gone because of **one test costing 33.2 seconds** — the axe
scan of the profile notes tab. Its own comment already says the timeout has
been raised three times and that the fix is to "scope what axe is given rather
than the clock it is given". It **has** been scoped to the tab panel. The panel
is still enormous: `res-okafor` has **394 notes**, and `NotesTab` renders every
one, unpaginated, with gap markers interleaved. Axe walks all of it.

**So this is the windowing decision, and it is overdue.** `PagedNotes` already
exists and is used by the cross-resident feed at 15 a page with a claim reading
"showing 1–15 of N", which satisfies the no-truncation rule by stating the
whole count.

**Not done here, because it is a product decision with a trap in it.** The
timeline is not a list of notes — `buildTimeline` interleaves gap markers, and
a gap marker is a claim about elapsed time between notes. Paginate naively and a
marker's span becomes an artefact of where the page broke, which is Rule 3c
exactly: a claim over a filtered set that does not carry the filter is false.
Getting that wrong would put a fabricated gap on a clinical record to make a
test faster. It needs deciding, not guessing.

---

## The timeline gets a window — 29/08/2026

### Vercel, first

Both of Frank's changes need nothing from me. `vercel.json` is committed and
its rewrite is the right shape: Vercel checks the filesystem *before* rewrites,
so `/assets/*` still serves real files and only unmatched paths fall through to
`index.html`. A clean clone has everything the build needs — all 3,559 SVGs
tracked, and the generated icon registries tracked too, so the build does not
depend on `postinstall` succeeding. The author email is a forward-only
correction; nothing in the repo hardcodes one.

### Windowed, not paginated

Frank's reasoning, which is the part worth keeping: **a window is a stated
bound and a page is not.** "The last 30 days" is a claim a reader can see and
check; "page 2" is a claim about nothing, so a gap marker inside it has no
denominator — it would state a span whose ends were chosen by where the page
broke. That was the Rule 3c trap, and windowing removes it rather than working
around it.

- **Rolling, not calendar-aligned.** The MAR chart's `month` starts on the 1st.
  Here the sentence on screen says "the last 30 days", so the window is the
  last 30 days; a calendar month would make that sentence false for 30 days out
  of every 31. The *control* is the MAR chart's — same segmented group, same
  stepping buttons, composed from its stylesheet rather than copied — so the
  two screens behave alike to a reader's hand even though the arithmetic
  differs.
- **Stepping is what makes the bound honest.** A window with no way past it
  would hide the rest of the record behind a default nobody chose. Every note
  is still reachable, and the "later" button is disabled rather than hidden at
  the newest window, so a reader never wonders whether it was ever there.
- **The edge is a statement, not a gap marker.** At the foot of the timeline —
  newest-first, so that is where the window cuts — it says *"Showing the last
  30 days. The previous note was 14/07/2026, 34 days before the one above."*
  The bound and the true elapsed time across it. Nothing fabricated, nothing
  hidden. Where the window already reaches the start of the record it says
  **"There are no notes before this. This is the whole record"**, because "no
  earlier notes" and "earlier notes we are not drawing" are different facts and
  a reader deciding whether they have the whole history needs to know which.

**One deviation from the brief, and it is a factual one.** The statement was
specified as the timeline's *first* element, referring to "the one below". The
timeline is newest-first, so the window cuts at the *foot*; placed at the top,
"the previous note was 34 days before the one below" would point at the
**newest** note and be false. It is at the foot, and reads "the one above".

**A third empty state.** Notes exist but none inside the window is not "never
written up" and not "no notes match these filters" — the second would blame a
filter the reader never set. It says so with its bound, and the filter bar's
"showing X of Y" now counts Y over the window rather than the whole record,
because a denominator measured over a population that is not on screen is not
a denominator.

### Both checks Frank asked for

**The axe scan, without touching the clock: 33,235ms → 3,089ms.** The timeout
sat at 120s after three raises. It is now 20s — lowered because the cause went,
not retuned again — which is about six times the measured cost: loose enough
to survive parallel load, tight enough that a return to the old behaviour fails
here rather than being absorbed.

**The suite stabilises, and the variance is the evidence.** Before: 69.8s, with
one run in two spiking to 76.7s and taking three files down on `waitFor`
timeouts. After the formatter cache: 50.6s, still flaky. After the window:

```
37.82s  37.68s  37.77s  38.14s  37.89s     all 1224 passing
```

Five consecutive runs inside half a second of each other. A spread of ±26s
collapsing to ±0.4s is what says the windowing was the whole answer rather than
a reduction — if something else were still costing time under load, the spikes
would have survived it.

### Guards, and the mutations that prove them

Four new tests, each broken on purpose:

- Remove the window and *draw a bounded window* fails, naming the note that is
  too old.
- Render the edge as a gap marker and *no gap marker at the boundary* fails.

The first version of the bounded-window test asserted "fewer than a quarter of
the record" and failed at 143 of 394 — a ratio is a property of the fixtures,
not of the window (§8). It now asserts the bound itself: no note drawn is more
than 30 days older than the newest one drawn.

---

## Pagination, surveyed before adding — 29/08/2026

Frank asked for pagination on all the modules. The survey says it belongs on
one, is unnecessary on most, and is **forbidden on three**.

### Measured, per module

| List | Rows it can draw | Bounded? |
|---|---|---|
| Documents · expiry queue, "Everything on file" | **346** | now paged, 25 |
| Care notes · cross-resident feed | 12,153 held | already paged, 15 |
| Care notes · profile timeline | 394 held | already windowed, 30 days |
| MAR chart | 15,376 held | already bounded by week/month |
| Activities | 52 | no |
| Goals | 48 | no |
| Incidents | 46 | no |
| Residents | 32 | no |
| Documents · library | 7 category rows | not a document list |
| Goal progress notes | 5 on the busiest goal | no |

Everything below the fold of that table is a list a reader can take in at
once. Paging 32 residents would add a control, hide rows, and oblige the screen
to state a total it was already showing — cost with nothing bought.

### Where pagination is forbidden

**Risk assessments (10 templates), consent (8 types), care plans (10
domains).** CLAUDE.md §1 names these explicitly: *"All ten risk assessment
templates are listed even if none is completed. All eight consent types. All
care plan domains."*

The reason is the whole product: on those screens an item's absence *is* the
finding. Paginate them and "not on this page" becomes indistinguishable from
"never assessed" — a blank cell wearing a page number. **The rule wins over the
instruction**, and these are left alone deliberately rather than overlooked.

### What was added

The documents expiry queue, at 25 a page. It is the only list that can reach
346 rows, and it is the right shape for paging precisely because it makes **no
claim about the stretches between its rows** — unlike the note timeline, where
a page boundary would invent a gap and which therefore took a window instead
(29/08/2026, above). Same question, two different answers, and the difference
is whether the spaces between rows mean anything.

**Paging hides rows, so the claim carries the slice.** It already named the
filter and the library total; it now names what is on screen as well:

> 346 of 692 documents at Rosewood Court, showing **everything on file**.
> On screen: 1 to 25.

Three figures, all real. The mutation that proves it is the reason it is there:
delete the slice and the sentence reads **"306 of 306 documents at Rosewood
Court"** while twenty-five are visible — a true sentence that a reader would
take as false, or worse, a false one they would take as true.

The pager composes the note queue's styles rather than declaring its own — one
shape, one meaning (§6) — and its page is clamped on render rather than reset
in an effect, so narrowing the filter cannot paint an empty page first.

Three guards, each mutated: draw every row and the page test fails at 306; drop
the slice and the claim test fails on the sentence above.

1,227 tests.

---

## Pagination across the modules — and where it stopped — 29/08/2026

Frank confirmed he meant modules, not modals. My first survey was wrong in a
way worth recording: **I measured fixture collections, not what each queue
draws.** A module queue is `residents.flatMap(templates)`, so the row count is
a product, not a table length — the risk queue is 32 × 10, the consent
dashboard 32 × 8. Counting the fixture arrays missed that entirely and led me
to report "one module needs this" when the truth was five.

Measured properly, by rendering each queue and counting rows under its
broadest filter:

| Queue | Rows | Paged |
|---|---|---|
| Reviews | **419** | yes |
| Documents · expiry | 346 | yes (earlier today) |
| Care plans | 320 | **no — see below** |
| Risk assessments | 320 | **no — see below** |
| Consent | 256 | **no — see below** |
| Goals | 40 | yes |
| Activities · incidents · handover | ≤ 52 | no — under one page, so the pager would hide itself |
| Residents | 28 | **no, and this one was an oversight — see the correction below** |

### One pager, and the slice inside it

`usePaged` + `<Pager>` in the primitives. Six screens page; a slice line
written six times is a slice line forgotten once, so **the component renders it
and there is no way to page without saying so**:

> Showing 1 to 25 of 419 reviews

It hides itself entirely below one page, so the small queues carry the
machinery without showing chrome that asserts a bound that is not there. The
page is clamped on render rather than reset in an effect, so narrowing a filter
cannot paint an empty page first.

### Where it stopped, and why I did not push through

Three queues are **not** paged: risk assessments, care plans, consent. I paged
them, and `reviews.test.tsx` failed:

> the care plan queue › renders every resident against every domain, from the
> constant

It asserts `residents × CARE_PLAN_DOMAINS` rows are **rendered**. Paging draws
25, so it fails.

**I could have made it pass in one line** — assert the denominator in the claim
instead of the rows on screen. That is the move §8 exists to stop: *"an
assertion you edit each phase to make it pass has stopped asserting"*. Worse,
this particular test carries a comment saying it was already hardened once,
after asserting `rows.length % 10 === 0` — true of ten, of twenty, and of an
empty list. Editing a guard so my change can land, on the second attempt at the
same guard, is not a judgement I should be making alone.

**The question underneath is real and is Frank's:** on a cross-resident queue,
does §1's "all ten domains are listed" mean *all rows on screen*, or is
"Showing 1 to 25 of 320" enough, given the denominator is stated and the
finding — a home that has written nothing shows 320 pending — survives? The
queue's own code comment argues the second: *"the denominator is residents ×
templates rather than assessments on record"*, which is a claim about a figure,
not about rendered rows.

I think paging is defensible there. I am not confident enough to weaken a
completeness guard to prove it, so the three stay whole and the decision is
recorded rather than taken.

### Correction: residents was not a decision

The table above first grouped residents with the lists that are too short to
page. It is not one. It draws **28 rows** against a page size of **25**, so it
would page — the only thing stopping it is that `usePaged` was never applied
there.

There is no rule protecting it, either: a resident roster is a population, not
a complete-set list, and its caption already states "16 of 28 residents at
Rosewood Court", so the denominator survives paging. Whether it *should* page
is a real question — splitting 28 rows into 25 and 3 helps nobody — but that is
a judgement about the threshold, not the reason it was skipped. It was skipped
because I put it in the wrong column.

### Guards

Four on the primitive rather than one per screen, since the slice lives in the
component. Mutated: delete the slice line and three fail; render the pager at
one page and the fourth fails.

1,231 tests.

---

## Paging the cross-resident queues — 30/08/2026

Frank's two rulings, and the distinction that settles the whole question:

> A resident's care plan tab is a complete set — all ten domains, always, never
> paged, because a reader there is looking at that person's whole plan and a
> partial list reads as a complete one. `/care-plans` is a population, and
> "1 to 25 of 320" carries what the rule protects.

**Complete set versus view over a population.** That is the line, and it is
sharper than the one I drew. Risk assessments, care plans and consent are now
paged at module level; the per-resident tabs beneath them are untouched and
must stay that way.

**Residents is not paged.** Splitting 28 rows into 25 and 3 helps nobody. Where
a table does need paging, the page size goes up rather than the table being
carved at 25 — `usePaged` takes `perPage` for exactly that.

### The condition, which was not already satisfied

All three defaulted to the gap filter — `never_assessed`, `never_written`,
`never_sought` — so that half held. **The sort did not.** The consent dashboard
had no `.sort` at all: its "Never sought" rows sat wherever `residents × types`
happened to put them. Harmless while every row was on screen, and a way of
burying the finding the moment only the first twenty-five are. A gap on page
eight is hidden as surely as a gap behind a green tile — the ordering doing the
work the colour used to. It now ranks gaps first, in the same shape as the
other two, so three screens that rank a gap above a record rank it the same
way.

### The guard, rewritten — and the hole in my first attempt

`renders every resident against every domain` counted rendered rows against
`residents × CARE_PLAN_DOMAINS`. It now reads the denominator out of the claim
the screen makes, plus a check that what is drawn is *fewer* than the whole —
otherwise it would pass on a screen that never paged.

**The proxy did not fail. It stopped matching.** Paging broke nothing the guard
protected: the constant was still the source, the denominator still right. It
went red for a reason unrelated to the defect it existed to catch — and that is
the dangerous kind, because a test that has stopped matching invites you to
adjust the number until it is green, which is the same keystroke as fixing a
real regression and the opposite act.

A second guard, as Frank required: **the gaps are on the first page.** Three
mutations were run against it, and the third is the reason it is worth
recording — setting the default filter to "All" **passed**. My assertion was
"every row on page one is a gap", which the sort satisfies on its own: gaps
first means page one is all gaps whichever filter is default. The guard was
being satisfied by the very mechanism it was meant to be independent of. It now
asks the filter control which one is pressed, and the mutation fails.

Sorting gaps last fails it too, and counting the drawn rows as the pager's
total fails the denominator guard.

### Two entries added to §8

*A test's history is what tells you whether an edit is a fix or a retreat* —
the comment recording the earlier hardening is the only thing that made the
second edit visible as a pattern rather than as maintenance, and neither the
assertion nor the diff carries that.

*A red test can stop matching rather than fail* — the harder version to notice,
for the reason above.

1,232 tests.

---

## The Figma exporter takes a width — 01/09/2026

### What it used, and why it had to become a parameter

`const WIDTH = 1440`. The output freezes it: every box is emitted at an
absolute position the browser resolved at that width, so an export is not a
responsive layout that adapts later — it is **one width, made permanent**.
Discovering the wrong one in Figma means running the whole thing again.

```
npm run export:figma -- --width 1920
```

Defaults to 1440. **Rejected below 1280**, with the reason said out loud: below
`--layout-min-width` the app deliberately refuses to lay out and shows the
too-narrow notice instead (PRD §4.6), so a smaller export would be a picture of
that message. It would look like a plausible file and be worthless, which is
exactly the kind of thing worth failing on rather than producing.

### The font strip is gone, and so is its offset

Removed entirely rather than switched off. The strip reserved 108px and
**every captured box was offset by it** — `stripHeight` threaded through
`walk.mjs` in four places. Leaving that parameter behind at zero would have
left a knob that exists only to be nothing, which is the sort of thing the next
reader spends ten minutes understanding. Content now starts at `top:0`.

### The app caps content width, and that is the answer to the dead space

**Yes — `--layout-max-width: 1440px`, applied by `.content` in
`AppShell.module.css` with `margin: 0 auto`.** Measured across four viewports:

| Viewport | Content | Dead space each side |
|---|---|---|
| 1440 | 1132px | 24px (the gutter) |
| 1600 | 1292px | 24px |
| 1748 | 1440px | 24px — the cap exactly reached |
| **1920** | **1440px** | **110px** |

So the cap bites at about **1748px** and above. Below it the content fills and
the only inset is the 24px gutter; above it the layout stops growing and the
extra width becomes white space either side.

**Exporting at 1920 therefore gives the same layout with more margin, not a
wider one.** The sidebar and the top bar span the full 1920 — the export's
widest box does reach 1920 — but the content column stops at 1440.

**That is a property of the app, not of the exporter**, so nothing has been
changed about it. Removing or raising the cap is a design decision about how
wide a care record should get before it stops being readable, and it would
change every screen at once, not only the export.


---

## The MAR week view cannot show a week — costed, guarded, not yet fixed — 01/09/2026

Frank's naming of the defect is the useful part: **the heading says "Week of
31/08 to 06/09" and the grid beneath renders six days.** A caption disagreeing
with what it captions — the same class as a figure without its denominator,
except the claim is in the heading and the contradiction is in the pixels.

### It is 218px, not 58px

58px is the overflow at 1440. **At 1280 — the narrowest width the app
supports, and therefore the number any fix has to satisfy — it is 218px.**

The grid is 1188px, and it decomposes exactly:

| Part | Width |
|---|---|
| Medication column (sticky left) | 250px |
| 21 round columns × 38px (34px cell + 4px gutter) | 798px |
| Totals column (sticky right) | 140px |
| **Total** | **1188px** |

Visible: **970px** at 1280, **1130px** at 1440.

*(One correction: the 250px column is the medication name, not the totals. The
totals column is 140px.)*

### What each option costs

**Narrow the totals column — 140px available.** Removing it entirely still
leaves 78px short at 1280. It carries "3 given of 14 due" per medication, which
is a Rule 4 figure with its denominator; narrowing forces it to wrap, removing
it drops the denominator. **Cost: a figure, and still not enough.**

**Narrow the 34px cells — 210px available, and this is the one with a floor
under it.** WCAG 2.5.8 Target Size (Minimum), AA, is 24×24 CSS px. Going 34 →
24 gives a 28px column and saves 10 × 21 = 210px, which almost exactly closes
1280 — **and lands precisely on the accessibility minimum with no margin**, for
the control that records a medication, the highest-consequence button in the
product. The cell is also deliberately in `rem` rather than px so it grows
under text-only zoom; that reasoning is unaffected, but the 100% floor is what
2.5.8 measures. **Cost: the accessibility headroom, entirely.**

**Narrow the medication column — 250px, of which 48px is padding.** A drug name
is the subject of its row. "Morphine sulfate oral solution" already wraps to
two lines at 202px of text; taking 60px makes it three and taller rows.
Truncating a drug name on a MAR chart is not available. **Cost: row height, and
a wrapping risk on the one field that must never be ambiguous.**

**Drop the 4px round gutter — 84px available.** Cells then touch. At 34px they
still clear 2.5.8's 24px minimum, so it is legal; the cost is that adjacent
dose targets abut, which raises mis-click risk on exactly the control where a
mis-click is a medication error. **Cost: 84px for a real safety trade, and
still 134px short.**

**What I can also see, and it is the answer none of the four gives.** The space
is in the chrome around the grid, not in the grid. Measured at 1280:

| | Visible | Needed | Short by |
|---|---|---|---|
| As built | 970px | 1188px | 218px |
| Sidebar collapsed | 1146px | 1188px | 42px |
| Collapsed **and** no page gutter | **1194px** | 1188px | **fits** |

The rail holds 176px and the gutter 48px — 224px between them, against 218px
needed. **The week fits at the minimum supported width without touching cell
size, drug names, or the totals denominator.**

That suggests the fix is a property of the route rather than of the grid: this
one screen wants its rail collapsed and its gutters off, the way a spreadsheet
does. Whether that should happen automatically on entering the chart, or be
offered, is a design decision and Frank's.

### The guard

`scripts/check-week-fits.mjs`, `npm run check:layout`. It asserts what the
caption already claims: seven day columns, no clipping, at 1280.

**It cannot be a vitest test, and that is worth stating rather than working
around.** jsdom performs no layout — every `getBoundingClientRect` is zero — so
the same assertion written as a unit test would pass on any grid at any width.
It would look like coverage and be nothing. So it drives a real browser against
a built preview.

**It currently fails, by design**, reporting `clipped by 218px at 1280px`. It
is deliberately *not* wired into `npm run verify`: a red gate blocks every
unrelated change, and the defect is awaiting a decision rather than an
oversight. It joins `verify` the day the fix lands.

Its first version read the caption with `document.querySelector('h2')` and
picked up the profile header's "Medication due · next 2 hours" — a loose
selector naming the wrong element, in a check whose whole subject is a caption.
It names the chart title now.

## Automatic wide screen on the MAR chart, and a layout guard that found four more

**The rail collapse is automatic and the rail is restorable.** `useWideScreen()`
(`src/components/shell/wide-screen.ts`) collapses the rail and drops the page
gutter for as long as the MAR chart is mounted, and restores whatever the rail
was *on arrival* when the screen unmounts. The collapse control stays visible
throughout, so it is obviously reversible; expanding it again clips the week,
which is the reader's call.

**The first version of its test suite could not fail.** Four tests, all green,
and both mutations of the hook — never restore, and restore the reader's last
state rather than their arrival state — passed too. The reason is worth keeping:
the third test had the reader manually expand the rail before leaving, so every
one of the three behaviours ended with the rail expanded, and the fourth arrived
already collapsed, so every one ended collapsed. Neither test created the case
where the behaviours differ. Rewritten as two: arrive open, let the screen
collapse it, leave untouched (catches "never restore"); and arrive collapsed,
expand by hand while there, leave (catches "restore the last state"). Both
mutations now fail, and so does a third — adding `collapsed` to the effect's
dependency array, which is how the ref would actually be lost in a future edit.

A fourth mutation still passes and is *not* a gap: with stable dependencies the
effect runs once, so reading `collapsed` inside it captures the arrival value
anyway. The ref is legibility, not mechanism, and the comment now says that
rather than claiming a guarantee it does not provide.

**`check:layout` is in `verify`.** It builds first — it serves `dist` through
`vite preview`, so without a build in the chain it would have gated on whatever
was last built, which for a gate is worse than no gate. Cost: about 110s.

**The guard was generalised from the week view to the whole app, and found four
defects nothing else could see.** It crawls the app's own links rather than
holding a route list (a list here would be a second copy of the route table, and
two rules drift), reached 70 screens, and asserts one contract: content fits its
own box, or declares how it does not — a scroller, an ellipsis, a line clamp.

1. **Dashboard and Handover tiles, a clipped denominator.** `.tileChange` was
   `white-space: nowrap`, which set the grid track's floor above the content
   column at 1280. The fourth tile ran off the right edge with "of 40 on record
   at Rosewood Court" cut mid-word, and Handover showed "of 22 residents
   reviewed this shif" three times over. Fixed at the owner: `min-width: 0` on
   the tile so the track can shrink, and the pill wraps.
2. **Reports, "What each report has to work with".** `16rem minmax(0,1fr) 6rem`
   asks 376px of floor inside a 344px panel, so the bar track was squeezed to
   **nought pixels** — the hatch carrying "below the floor" was not drawn at
   all — and the panel's `overflow: hidden` cut every figure: "15 of", "0 of",
   "8 o". Every denominator on the one panel whose subject is denominators.
   Restacked: label and figure on one line, bar full width beneath.
3. **Incidents rows** overflowed their card by 14px on every row; the column
   floors summed to 1,008px against 970px available. An earlier pass had fixed
   the row for a 1,990px card and never measured the other end.
4. **The status pill** ran 3px into the next column on the residents table,
   which is `table-layout: fixed`, so the column cannot grow to meet it. Now
   `max-width: 100%` with `flex-wrap: wrap`.

**And the week fix was incomplete when it was reported as done.** The grid's
width is seven days times that resident's rounds a day: `res-okafor` at three
rounds fits 1,194px, and the five residents on four rounds need 1,454px.
Collapsing the rail took it from 5 of 28 fitting to 23 of 28 — a real
improvement reported as a completed fix, because the check named one resident.
The guard now prints "23 of 28 weeks fit" and holds 23 as a floor. **The
remaining five are a decision, not an oversight** — closing 260px costs either
the dose target's WCAG 2.5.8 floor (34px cells → 25px) or the medication
column's drug names, and neither is mine to spend.

Three §8 entries added: jsdom performs no layout, as the third variant of
right-assertion-wrong-medium; a guard naming one subject measures that subject;
and a mutation whose build fails silently reports the previous mutation's
findings — which happened here, and printed a plausible red tick.

## The export fits the window it is opened in

The exported HTML is absolute pixels resolved at the capture width — that is
the whole reason the importer has nothing left to interpret — so it could not
fit anything but a screen of exactly that width, and a 1,440px export on a
1,280px laptop scrolled sideways.

**Reflowing it was the wrong half of the choice.** The text runs are captured
as pinned boxes with positions and widths already decided; making their
containers relative while the runs stayed put would misalign the page, and the
brief asks for identical rather than merely fitting. A uniform scale keeps
every relative position exactly as captured.

So the capture is wrapped in `#fit` / `#page`. `#page` holds the untouched
capture and is out of flow, so its width never reaches the layout and never
raises a horizontal scrollbar; a small inline script sets
`transform: scale(min(1, viewport / captureWidth))` on it and gives `#fit` the
height the scaled capture actually occupies.

**Clamped at 1, which is what protects the Figma path.** At any viewport at
least as wide as the capture the transform is `none` and the geometry is
identical to the file this exporter produced before — verified: at 1440, 1536
and 1920 the computed transform is exactly `none`. And with scripting off,
which is how a good deal of import tooling reads a pasted document, nothing
runs and the result is that same untouched capture. Fitting is layered on top;
it cannot subtract from what is exported. That is reasoning plus a measurement
of the transform, not a test of html.to.design itself, which cannot be run
from here.

Measured on the re-exported dashboard, no horizontal scrollbar at any of
1024, 1280, 1440, 1536 or 1920, and the foot of the page lands exactly at the
foot of the viewport rather than leaving dead space.

**And the comparison found a defect that had nothing to do with width.** Held
against the app at 1440, the donut was a quarter turn out: `.donut` carries
`transform: rotate(-90deg)` on the `<svg>` root so its first arc starts at
twelve o'clock, and the walker's paint loop iterates `querySelectorAll('*')` —
the children — so the root's own transform was never copied. Every arc was the
right length and the right colour and the ring was rotated, which is why it
survived: **a chart can be wrong about *where* while being right about how
much**, and the figures a reader checks are the ones that were correct. The
hatched "no record" wedge sat opposite where the app puts it. The clone now
carries the root's transform and transform-origin.

## The content cap is gone, and a correction about a green build

`--layout-max-width` is `none`. Content now fills the viewport at every width:
content is 972px at 1280, 1132 at 1440, 1612 at 1920 and 2252 at 2560, with
only the 24px `--layout-gutter` either side. The ceiling only ever bound above
about 1748px — below that the viewport was the narrower limit, which is why
the 1440 export never showed the dead space the app did.

Swept the newly-uncapped regime: 60 screens at 1920 clean, 60 at 2560 clean
apart from three SVG `<text>` nodes reporting 4–10px. Those are a measurement
artefact — `clientWidth` on an SVG text node is not a CSS box, and the axis
labels render complete — so `check-layout.mjs` now skips anything with an
`ownerSVGElement`. Left in, it would have been three findings a week from now
that nobody could act on, which is how a guard turns into wallpaper.

**A correction. I reported `npm run verify` green after the layout work and it
was not.** The background command was `npm run verify > log 2>&1; echo $?;
tail -6 log`, so the status I read was `tail`'s, and the six lines I read were
the layout guard's success message — which sits *after* the tests in the log
and passes whether or not they did. The run had `27 failed | 1209 passed`.

The cause was mine, from the same commit: `useWideScreen()` called
`useShellLayout()`, which throws outside the shell, and `mar.test.tsx` and
`export.test.tsx` render the MAR route on its own. The throw reached React
Router's error boundary, so the screen never rendered and 27 assertions failed
on an "Unexpected Application Error" page. Bisected to confirm: `MarChartRoute`
at HEAD~2 passes 19/19, at HEAD fails 18.

`useWideScreen` now reads the context optionally and does nothing without a
shell — taking the width is something a screen does *to* a shell, so with no
shell there is nothing to take. The silence is only safe because the layout
guard counts weeks that fit and that count falls from 23 to 8 without the
hook; all three mutations still fail. Verify is now exit 0 with 1236/1236.

**Two things worth keeping from how this was missed.** A compound command ends
with the exit status of its last element, so `cmd; echo $?; tail` reports the
tail. And reading the foot of a verify log reads the *last* check, not the
worst one — the ordering of the chain decided which failure I saw.

## Fonts: the change asked for is already in place

An audit of another project found Manrope loaded as a variable font, which
Figma resolves to the family's default master — ExtraLight — and the fix was
static files, one per weight. Checked against this codebase before changing
anything, and it does not apply:

- `src/main.tsx` imports `@fontsource/manrope/{400,500,600,700,800}.css`.
- Each declares a single `font-weight`, no range, pointing at its own file.
- The seven latin `woff2` files have seven different md5s — genuinely
  different masters, not one variable file reused.
- No variable font ships in `@fontsource/manrope/files/` and nothing imports
  one. `dist/` carries 50 static subset files.

**And the export does not read the app's fonts**, which is the part of the
model to correct: `embeddedFonts()` reads three `woff2` files straight out of
`node_modules` and writes its own `@font-face` block, so a font change in the
app would not reach the export at all. Geometry is read from the app; type is
not. The exported file declares exactly three faces, 400/600/700, each with an
unambiguous weight and no range.

Weights in use: 700 (254), 600 (241), 800 (64), 400 (37), 500 (30) — all five
real, no raw `font-weight` outside the tokens. The export already collapses
them to three, rounding 500→400 and 800→700, which on the dashboard is 64
roundings.

Grid audit, for the second half: 122 `display: grid` against 462 `display:
flex` and 87 `inline-flex`. Of 113 `grid-template-columns`, 112 use `fr`, 90
use `minmax()` and 12 use `auto-fit`/`auto-fill`.

## Per-weight family names in the export

Tried the one hypothesis left for the ExtraLight problem. Neither the app nor
the exporter has ever presented a variable font or a weight range — that was
checked and disproved last turn — but an importer resolving by *family name*
would look up bare `Manrope`, find Figma's own Manrope, which is variable, and
take its default master. That master is ExtraLight, and it explains the one
thing the range theory could not: why installing Manrope in Figma does not
help.

So the export now ships three families rather than one at three weights:
`Manrope Regular` 400, `Manrope SemiBold` 600, `Manrope Bold` 700. Verified in
the emitted file — three `@font-face` rules, 227 content references split
119/54/54, 19 SVG `font-family` attributes, and **no bare `Manrope` anywhere**.

Browser rendering is unchanged, and that was measured rather than assumed: all
three faces report `loaded`, and a probe string renders at 483 / 496 / 502px
against 473px for the sans-serif fallback. Three distinct real faces, none
falling back, none shared.

This is a test, not a fix. If Figma still resolves to ExtraLight, the family
name was not the mechanism and the idea is ruled out.

One §8 entry added, about the green build that was red.

## All five weights ship; nothing rounds

The export carried three faces and rounded the other two — 500→400 and
800→700, 64 runs of text on the dashboard alone. That was visible: the
sidebar's nav items and section labels are 500 in the app and arrived at 400,
noticeably thinner. A rounding that changes what a reader sees is not a
conversion, it is a loss, and there was no reason to take it — `@fontsource`
ships a static master for each of the five.

Five families now, one per weight: `Manrope Regular` 400, `Manrope Medium`
500, `Manrope SemiBold` 600, `Manrope Bold` 700, `Manrope ExtraBold` 800.
**0 weights rounded**, and `dashboard.weights.txt` says nothing was rounded.

The arithmetic reconciles against what was reported before, which is the check
that it moved the right text rather than merely reporting a smaller number:
content references went 119 Regular → 74 Regular + 46 Medium (45 moved, the
exact 500→400 count) and 54 Bold → 35 Bold + 20 ExtraBold, with 7 of the SVG
labels among them. All five faces load and render at 931.0 / 946.6 / 962.2 /
977.6 / 993.2px on a probe string against 889.4px for the fallback — five
distinct real faces in a monotonic progression, none falling back, none
shared. The nav item "Residents" now resolves to `Manrope Medium` at 500.

`nearestWeight` still exists and now rounds nothing. It is what *reports* a
rounding, so a sixth weight introduced without a face to carry it shows up in
`.weights.txt` named rather than silently flattened.

**And the log header had gone stale in one release.** It still read "The
export carries three static faces: 400, 600, 700" after five started shipping
— true when written, printed every run, and precisely the sentence nobody
reads. Second occurrence of the §8 staleness class this build. It is derived
from `FONT_FACES` now rather than typed.

Cost: five embedded faces instead of three, so the file is larger. Named
rather than traded away quietly.

## The exporter is parked, and the grid audit

**Parked, not deleted.** The premise was wrong rather than the execution: the
walker resolves the layout away, and html.to.design builds auto-layout *from*
flex and gap and reads type from elements in normal flow. The two things it
needs are the two things the walker strips. `npm run export:figma` is gone from
`package.json` and the README now says to point the plugin at the running app.

Kept rather than deleted because the walker learned things that are true of the
product rather than of the approach, and they are cheaper to read than to
rediscover: an SVG shape with no `fill` renders black once it leaves the
stylesheet; `repeating-linear-gradient` has no Figma equivalent so the hatch
needs geometry; `.donut` carries a transform on the `<svg>` root that a
child-only paint loop misses; the product uses five weights and rounding two of
them is visible in the sidebar.

One §8 entry added, and it is the one that matters here: six repairs in a row,
every one a real defect correctly fixed, is what a wrong premise looks like
from the inside. A wrong premise does not present as one wrong thing; it
presents as a queue of right ones.

Also fixed two stale counts while in there — the README claimed 1220 tests
against 1236, and listed the parked command. Counts removed rather than
corrected, because a tally in a README is a number nobody updates.

### Grid, measured

122 grid rules across 26 stylesheets, against 549 flex (462 `flex`, 87
`inline-flex`) — about 4.5:1. Of the 110 that declare `grid-template-columns`,
108 use `fr`, 88 use `minmax()`, and **exactly one uses fixed or auto tracks
only**.

Mutually exclusive buckets, so they sum:

| | |
|---|---|
| 58 | one-off row inside a card — nothing aligns against it |
| 42 | repeated row, aligning columns down a list |
| 11 | card grid, `repeat(auto-fit, minmax(…))` |
| 7 | single-column stack |
| 4 | two-dimensional (named areas or explicit rows) |

Grid-heavy stylesheets: incidents (12), medications (10), resident profile (8),
group (7), risk (7), auth (6), compliance (6), me (6).

**Only 4 of 122 are two-dimensional**, and one of those is the app shell itself
(`auto 1fr`, rail plus main) and one is the Reports chart row written last week.
So the "grid is 2D and flex is 1D" objection barely applies here.

**The real cost is the 42 repeated rows.** In grid, every `.logRow` in a list
resolves the same track definition, so columns line up down the page. Flex
sizes each row independently, so holding the alignment means converting every
`fr` and `minmax` track to a fixed or percentage width. That is mechanical, and
it drops the floors: 6 of the 42 carry a non-zero `minmax` floor — the consent,
goals, risk and reviews queues, the incident log, and the group metric row —
and those floors are what stop a column being squeezed below its content. That
is not hypothetical here: the incident row's floors summing above the available
width is the defect fixed two commits ago, and a squeezed column is how the
Reports panel lost every denominator.

So: 76 of 122 would swap cleanly (58 one-off rows, 11 card grids to
`flex-wrap` + `flex-basis`, 7 stacks). 42 are mechanical but lossy. 4 are
genuinely hard, and two of those are load-bearing shell and chart layout.

## Dashboard grids converted to flex — the probe

Three rules converted, two left alone, and the measurements held.

**Converted**

- `.rowTwo` — `1.85fr 1fr`, the chart panel beside the donut panel. Flex with
  `flex-basis: 0` and grow factors 1.85 and 1. Measured ratio 1.845 at 1280,
  1.847 at 1440, 1.845 at 1920 — the same split the tracks gave.
- `.rowThree` — `1fr 1fr`. Flex, equal grow. 478/478, 558/558, 798/798.
- `.tiles` in `MetricTile.module.css` — `repeat(auto-fit, minmax(170px, 1fr))`
  to `flex-wrap` with `flex-basis: 0` and `min-width` restoring the 170px
  floor. Shared, so this also moves Handover, Care Notes, Medications and
  Residents; all four were measured before and after.

**Left alone**: `.roundRow` and `.row`, both repeated rows where the shared
track definition is the column alignment, and the shell's `grid-template-areas`.

**The tile widths are identical, and getting there found the real cost of a
conversion.** `.tileLead` was `grid-column: span 2`. The obvious flex form —
grow 2 against grow 1 — gave 413/224/224/224 where grid gave 443/214/214/214.
The cause is that **`box-sizing: border-box` clamps `flex-basis: 0` to padding
plus border**, 34px here, so a tile's base size is never zero and the grow
factors divide only what is left. Grid has no such floor because padding sits
*inside* a track. Stating the difference as basis — the swallowed gap plus one
track's worth of chrome, from the same tokens the padding uses — makes it exact
at every width, and the algebra reduces to grid's `2t + g` rather than being
tuned to one measurement: verified at 972, 1132 and 1612px.

**A correction to my own audit.** The "76 that swap cleanly" was counted by
classifying the rule that declares `display: grid`, and it never looked at
children. `.tiles` was bucketed a clean card grid while `.tileLead` carried
`grid-column: span 2`. Sweeping properly: 14 grid-placement declarations on
children, 6 of them on the four already-known two-dimensional grids, leaving
**8 grids in the "clean" buckets with a spanning or explicitly placed child** —
medications (3), interim, admission, goals, auth, consent, incidents. So the
number is nearer 68 straightforward and 8 needing the treatment above, not 76.
Each of those 8 is doable; none is free.

Verify green: 1236/1236, layout guard 23 of 28, 70 screens crawled.

`format:check` earned its place in the chain by catching a `shot.tmp.mjs` I had
left in the repo root.
