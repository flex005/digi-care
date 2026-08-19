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
