# diGi-Care — Frontend Build PRD

**Source of truth for product scope, and there are now three documents rather than one.** Named plainly here because the line below said `diGi_Care_PRD_v3.docx` for sixteen phases while two newer documents existed, and a stale pointer at the top of a spec is how somebody reads the wrong one as authoritative:

- `diGi Care PRD v3.docx` (Ezekiel Dada) — **what Phases 0 to 16 were built against.** Everything in §6 below traces to it.
- `diGi_Care_PRD_v4.docx` — a later, wider document: five care settings, a seven-role model that is not this build's seven, and modules this build does not have (bed management, discharge planning, GPS-verified domiciliary visits). **Not the spec for the current work**, and where it is cited below it is cited by name.
- `AM_PRD (1).docx`, "Admin & Manager, v2.0, aligned to diGi-Care Prototype Screens" — **what Phases 17 to 24 are being built against.** It is the newest of the three, it is the only one written with this prototype in front of it, and its own dashboard arithmetic is computed over this build's constants. Where it disagrees with v4, it wins: newer, and specified at the level of screens.

**This document governs the frontend build only.** Where it and a source PRD disagree on UI behaviour, this document wins; where they disagree on product intent, the source PRD wins and this document gets corrected.

**Build scope:** Desktop manager application. Frontend only — no backend, no API, no auth. All data comes from typed fixtures.
**Out of scope for this build:** mobile care-worker views, and the Family Portal itself. Both are separate builds. **Managing the Family Portal from this one is in scope from Phase 21** — who may see a resident's updates, on what basis, and which care notes are shared — because that is an act a manager performs here even though the surface it affects is elsewhere.

---

## 1. Product model

diGi-Care is not a care app. It is an **evidence system** that happens to be used during care delivery.

Everything on every screen exists to answer one of two questions:

1. *What does this person need right now?* — the care worker's question, answered in seconds, before entering a room.
2. *Can you prove you did what you said you would?* — the regulator's question, answered across twelve months of records.

The product's users, in this build:

| Role | What they do in the desktop app |
| --- | --- |
| Registered Manager / Organisation Admin | Primary user of this build. Creates care plans and risk assessments, reviews and closes incidents, runs the compliance dashboard, generates inspection packs, manages team and consent. |
| Deputy Manager | As above, minus organisation settings and billing. |
| Senior Carer / Clinical Lead | Reviews and countersigns care notes, countersigns medication, runs handovers. |
| Read-Only / Auditor | Full read, zero write. Used by external auditors and by CQC inspectors during an inspection. |

Care Worker and Activities Coordinator exist in the role model and must be representable in Team Management, but their primary working surface is mobile and is not built here.

The organisational hierarchy is **Organisation → Site → Resident**. Every resident, staff member, record and compliance figure belongs to exactly one site. Cross-site users see consolidated views; single-site users never see a site switcher at all.

---

## 2. The core risk — the Evidence Invariant

> **A blank on screen does not tell you whether the answer is "no" or "nobody has looked yet". These two things are not close together. In a regulated care record they are opposites.**

This is the single highest-consequence thing the UI can get wrong, and it is the concept the rest of this document is organised to protect. It is not a styling preference. It is the difference between a signed clinical decision and a hole in the record.

### 2.1 Where it bites

- **MAR chart.** An empty cell means "not due yet", or "due, window open, nobody has acted", or "window closed, no record — this is an omission". A filled cell means "Given", or "Not Given, resident refused, signed at 08:04" — which is a *complete and correct* record, not a gap. Five states. The source PRD's 30-minute and 60-minute escalation logic is meaningless unless the UI distinguishes them.
- **Profile header risk badges.** No FALLS RISK badge reads to a care worker as "assessed, he's fine". It may mean nobody has ever assessed him. For DNAR the same ambiguity is catastrophic in both directions.
- **Compliance dashboard.** A Key Question shows Green because the evidence is complete, or Green because the denominator is zero. A dashboard whose entire purpose is "trust me, you're ready for inspection" must never look reassuring because it is empty.
- **Consent.** Pending, Refused, Withdrawn, and Lacks Capacity — Best Interest are legally distinct outcomes. None of them is a blank.
- **Reviews and goals.** "Never scheduled" and "scheduled and completed on time" must not both render as untroubled.

### 2.2 The four rules

These are load-bearing. Every screen specification below is written to satisfy them, and `CLAUDE.md` restates them as hard constraints.

**Rule 1 — No clinical or compliance status is optional.**
Every such value is a closed discriminated union that always includes an explicit unrecorded member. No `status?: Foo`. No `string | null`. No `undefined` reaching a component. The compiler must refuse to build a screen that forgot the unrecorded case.

**Rule 2 — Unrecorded has its own visual treatment.**
Not empty space, not neutral grey, not the same as a recorded negative. In this design system, unrecorded is the *only* state carried by a pattern (dashed border + diagonal hatch) rather than by hue alone. It is therefore distinguishable at a glance, distinguishable in greyscale, and distinguishable to a colour-blind user — which matters because on the MAR chart the distinction is clinical.

**Rule 3 — A recorded negative looks settled; an unrecorded value looks unfinished.**
"Not Given — resident refused — C. Nwosu, 08:04" is a finished record and should read as finished. An omission should read as an open loop. Users must be able to tell these apart peripherally, without reading.

**Rule 3a — A compound state renders as separate facts, not a merged one.**
Where a record is partly complete, each part keeps its own treatment. A dose that was given but whose required second signature was never recorded shows a solid green "Given" pill *and* a hatched "Second signature not recorded" beneath it — two facts, two treatments. Never one pill with the gap in small print, and never a single treatment averaging the two.

**Rule 3b — Recorded and unremarkable renders quietly.**
The corollary of Rule 2. If unrecorded must be conspicuous, then everything recorded and fine must not compete with it — a completed in-date review, a scheduled one, "nothing due", "all assessed". These render as plain text, never as a filled pill. **Quiet is not hidden**: the full record still shows, author and timestamp included, always visible and never hover-only. It is simply not shouted. Reaching for the quiet treatment to calm down an inconvenient *gap* is the bug the product exists to prevent.

**Rule 3c — A claim made over a filtered set carries the filter, or it is false.**
Absence within a filter is not absence. A gap marker on a timeline filtered to "Medication notes only" would assert that nobody wrote anything for six hours when somebody may have written four notes in other categories — a confident false claim about a person's care. So derived claims (gap markers, coverage figures, "all assessed", RAG states) are either suppressed while a filter is active or restated to name the filter. This is Rule 2 in the opposite direction: never let absence read as fine, and never assert an absence that is an artefact of the view.

**Rule 5 — Every screen names the one fact it exists to surface.**
Before a screen is built, state in one sentence the single thing it exists to tell somebody. That fact gets the largest type, the strongest weight and the top position; everything else is context and renders quieter (Rule 3b). If the sentence cannot be written, the screen is doing two jobs and should be two screens. Examples from this build: the handover is *"these residents have not been looked at, and you are about to sign"*; the MAR chart is *"these doses have no record against them, and the window has closed"*; the round is *"these doses are due now, for this person, and you are about to sign for them"*. Note that none of them is "here is the data" — a month grid renders ~900 cells and most of them say "given"; the screen exists for the handful that say nothing.

**Rule 4 — Every aggregate carries its denominator.**
No bare counts, no bare percentages, anywhere in the product. Not "3 incidents" but "3 incidents across 32 residents". Not "92% compliance" but "92% — 46 of 50 expected notes; 12 residents have no expected frequency set". Where coverage is too thin to support a judgement, the aggregate shows **Insufficient Evidence** rather than a figure.

**Rendering the denominator is necessary and not sufficient.** "100% — 2 of 2" is true, and still invites a judgement two records cannot support. Every rate therefore has a minimum population below which it does not render as a figure at all — it renders Insufficient Evidence with its coverage. That is §2.3 used outside the compliance dashboard it was designed for, and it belongs there for the same reason: what is missing is evidence, not performance.

### 2.3 Insufficient Evidence (approved departure from source PRD)

The source PRD gives the compliance dashboard a three-state RAG per CQC Key Question. This build adds a fourth:

| State | Meaning |
| --- | --- |
| Green | We looked, evidence is complete, it is good. |
| Amber | We looked, there are gaps we can name. |
| Red | We looked, it is bad. |
| **Insufficient Evidence** | We cannot tell you. Coverage is below the threshold needed to make any claim. |

Insufficient Evidence is **not** a milder Red. Red is a finding; Insufficient Evidence is the absence of one. It renders in the unrecorded treatment (Rule 2), never in a RAG hue, and it always states what is missing and how much: *"Insufficient evidence — 4 of 32 residents have a completed falls risk assessment."*

Threshold default: a Key Question shows Insufficient Evidence when fewer than 60% of its contributing checks have any data at all. Configurable per organisation in a later phase; hard-coded to 60% in fixtures for now.

### 2.4 The supporting risk — wrong-subject writes

A care note or medication record saved against the wrong resident, or into the wrong site, is the second-worst failure available. Structural mitigations, applied everywhere and not re-decided per screen:

- Every write surface carries a **persistent subject header**: resident photo, full name, preferred name, room, DOB. It is sticky, it is not collapsible, and it does not scroll away.
- Subject identity is read from the route parameter, never inferred from navigation history, "last viewed", or component state.
- Every confirmation dialog restates the subject by name in the confirming sentence — never "Are you sure?", always "Record 08:00 medications for Emmanuel Okafor?"
- The active site name is permanently visible in the app header for all users, including single-site users, who do not get a switcher but do get the label.
- Switching site while a form holds unsaved input is blocked behind a confirmation.

---

## 3. Stack and hard conventions

### 3.1 Stack

| Concern | Choice | Note |
| --- | --- | --- |
| Build tool | Vite 8 | |
| Framework | React 19 + TypeScript, `strict: true` | |
| Routing | React Router 7, data router API | |
| Primitives | Radix UI, **hand-authored wrappers** | See 3.2 |
| Styling | Plain CSS + CSS Modules over CSS custom properties | See 3.3 |
| Icons | Local SVG folder → `vite-plugin-svgr` | See 3.4 |
| Dates | `date-fns`, en-GB locale | |
| Charts | `recharts` — Phase 12+ only, not before | |
| Testing | Vitest + React Testing Library + `vitest-axe` | |
| Lint | ESLint, Stylelint, Prettier | Stylelint config is load-bearing, see 3.3 |

No state management library. No data-fetching library. There is no server; a thin `src/data/` access layer returns fixture data behind promise-shaped functions so a real API can replace it later without touching components.

**Known dependency note:** the project is on ESLint 10; `eslint-plugin-jsx-a11y` currently declares peer support only up to ESLint 9. It was installed with `--legacy-peer-deps` and **verified working** — it correctly flags `jsx-a11y/alt-text` under ESLint 10. Use that flag only for this package, never in `.npmrc`, which would silence peer conflicts project-wide. Re-check when the plugin publishes ESLint 10 support and drop the flag.

### 3.2 Component primitives — no shadcn CLI

**Do not run the shadcn CLI.** It installs `lucide-react` as a dependency and overwrites the project stylesheet with its own colour tokens. Both directly violate constraints in this document. This is known before we start; it is not to be rediscovered.

Primitives are hand-authored in `src/components/primitives/`, each a thin wrapper over the corresponding Radix package, styled against our tokens from the first line. Radix packages we will use: `dialog`, `dropdown-menu`, `select`, `tabs`, `tooltip`, `popover`, `checkbox`, `radio-group`, `switch`, `accordion`, `alert-dialog`, `toast`, `visually-hidden`.

Consulting shadcn's published source as a *reference* for Radix composition patterns is fine. Copying its stylesheet, its token names, or its dependency list is not.

### 3.3 Styling and the token rule

One file, `src/styles/tokens.css`, declares every colour, type step, spacing step, radius and shadow as a CSS custom property on `:root`. There is no dark mode and no theme switching — one palette only.

**No component may contain a raw colour value.** No hex, no `rgb()`, no `hsl()`, no named colours. Colour reaches a component only as `var(--token-name)`. This is enforced by Stylelint (`color-no-hex`, plus a `declaration-property-value-allowed-list` restricting colour-bearing properties to `var(--*)`, `transparent`, `currentColor`, and `inherit`) and the lint must run in CI and pre-commit. The rule is enforced mechanically because it will not survive being enforced by memory.

`tokens.css` itself is the one file exempt, and it is the only file where a hex literal may ever appear.

### 3.4 Icons

There is **no icon library** in this project. `lucide-react`, `react-icons`, `@heroicons` and equivalents are not to be installed under any circumstance.

Icons come from the **Aligned Line Icons** set, copied raw into `src/assets/icons/` — **3,559 SVGs across ~40 category subfolders** (`ADD REMOVE DELETE`, `ALERT NOTIFICATION`, `DATE AND TIME`, …). Filenames are lowercase kebab-case with numeric variant suffixes (`add-01.svg`, `add-circle-half-dot.svg`).

**Names are namespaced by category**, because the same filename appears in multiple folders (`apple.svg` exists in more than one). The name is slugified-category + filename stem:

```tsx
<Icon name="add-remove-delete/add-01" size={20} />
<Icon name="alert-notification/alert-circle" size={16} />
```

Pipeline:

1. Raw `.svg` files live in `src/assets/icons/<CATEGORY>/`. They are never hand-edited.
2. A build-time script normalises each icon used to `stroke="currentColor"` / `fill="none"` (or `fill="currentColor"` for solid glyphs) so icons inherit colour from CSS and never carry their own.
3. `vite-plugin-svgr` compiles them to React components.
4. `npm run icons` generates two files:
   - `registry.names.generated.ts` — the full `IconName` union of all 3,559 namespaced names, read from the folder. Types only, zero runtime cost. This is what gives autocomplete and what makes an invalid name fail to typecheck.
   - `registry.generated.ts` — an import map containing **only the icons actually used**, found by scanning source for `<Icon name="…" />`. Importing all 3,559 would compile every one into the bundle.
5. A name that appears in source but not in the folder **fails the build**, loudly, naming the missing icon.
6. **Neither generated file is ever hand-typed or hand-edited.** They are regenerated from the folder and from usage.
7. One `<Icon>` component is the only way an icon reaches a screen. No raw `<svg>` in feature code, no direct imports from `assets/icons`.
8. `npm run icons` re-runs after adding a new icon name to a screen; it is wired into `predev` and `prebuild` so it cannot be forgotten. `npm run icons:check` fails CI if the committed output is stale.

Icons are decorative by default (`aria-hidden`, `focusable="false"`). An icon carrying meaning on its own requires an adjacent visible text label — see §7.

### 3.5 Type scale is closed

The scale in §4.3 is the complete set. Nine steps, five weights. A component may not introduce a font size, line height or weight outside it. If a design genuinely needs a tenth step, that is a change to `tokens.css` and a conversation, not a local override.

### 3.6 Other hard conventions

- **British English throughout**, in code and in UI copy. `Organisation`, `Authorised`, `Finalise`.
- **Dates `DD/MM/YYYY`, times 24-hour.** Never `MM/DD`, never am/pm. Relative time ("2 hours ago") is allowed alongside, never instead of, an absolute timestamp on any clinical record.
- **Clinical timestamps render in the site's timezone, never the viewer's.** A dose given at 08:04 at Rosewood Court reads 08:04 to every viewer, anywhere, forever — that is what the care worker signed and what the paper record says. Rendering viewer-local would make the screen contradict the record, which is the core risk in another costume. Show the zone label wherever ambiguity is possible. Relative time is the one exception: it is about now, not about the record, so it is computed against real elapsed time.
- **Every clinical record displays its author and its timestamp.** No exceptions, no hover-to-reveal.
- **No `any`.** No `@ts-expect-error` without a comment naming what will remove it.
- **No `localStorage` or `sessionStorage`** for record data. In-memory only; fixtures reset on reload, which is correct and intended.
- **No placeholder or lorem text** in any committed screen. Fixture content is realistic care content.
- **No `console.log` in committed code.**
- Files: components `PascalCase.tsx`, everything else `kebab-case.ts`. One component per file.

---

## 4. Design system

Sources: the supplied swatch sheet and the diGiLog dashboard screenshot. There is no token sheet for this product, so values below are marked by confidence.

> ⚠️ **Unverified.** Values marked ⚠️ are read by eye off the screenshot, not from an exact source. They are **not blocking** — they live only in `tokens.css`, so verified values swap in later as a single edit touching no component (see §9). Values marked ✅ are exact, sampled from the screenshot or stated directly.

### 4.1 Brand palette ✅

| Token | Value | Use |
| --- | --- | --- |
| `--purple-900` | `#1E0059` ✅ | App header, primary text on light, headings |
| `--purple-600` | `#6935CF` ✅ | Primary action, active nav, focus ring |
| `--purple-400` | `#A284F1` ✅ | Secondary accent, chart series, hover states |
| `--purple-200` | `#D5C6FB` ✅ | Selected rows, subtle fills, disabled primary |
| `--purple-50` | `#F1ECFF` ✅ | Tinted card backgrounds, tag fills |

### 4.2 Surfaces and neutrals ⚠️

Sampled from the screenshot. The page background and card border are exact ✅; the intermediate ink steps are still interpolated ⚠️ (the screenshot shows too few text weights to sample them all).

| Token | Value | Use |
| --- | --- | --- |
| `--bg-page` | `#F2F6FE` ✅ | Application background |
| `--bg-surface` | `#FFFFFF` ✅ | Cards, tables, drawers, dialogs |
| `--bg-surface-sunken` | `#F8FAFE` ⚠️ | Table header rows, inset panels |
| `--ink-900` | `#1E0059` ✅ | Primary text (reuses brand deep purple, as in screenshot) |
| `--ink-700` | `#443B63` ⚠️ | Body text |
| `--ink-500` | `#6E6688` ⚠️ | Secondary text, labels |
| `--ink-400` | `#9A93B0` ⚠️ | Placeholder, disabled text |
| `--border-strong` | `#E7E4FD` ✅ | Input borders, dividers under headers |
| `--border-subtle` | `#EFEAFE` ✅ | Card borders, table row rules |

### 4.3 Type ✅ / ⚠️

**Family: Manrope** ✅ (stated on the swatch sheet). Self-hosted, woff2, weights 400/500/600/700/800, `font-display: swap`. No secondary family. Numerals are `font-variant-numeric: tabular-nums` in every table, MAR grid and metric.

Sizes ⚠️ — proportioned to the screenshot rather than measured from it.

| Token | Size / line-height | Use |
| --- | --- | --- |
| `--text-display` | 32 / 40 | Dashboard greeting, single per page |
| `--text-h1` | 24 / 32 | Page titles |
| `--text-h2` | 20 / 28 | Card and section titles |
| `--text-h3` | 17 / 24 | Sub-sections, drawer titles |
| `--text-body` | 15 / 22 | Default body, form inputs |
| `--text-body-sm` | 13 / 20 | Table cells, secondary text |
| `--text-caption` | 12 / 16 | Labels, metadata, timestamps |
| `--text-micro` | 11 / 14 | Badge text, denominators |
| `--text-mono-num` | 13 / 20 | MAR grid, controlled drug balances |

Weights: 400 body, 500 emphasis, 600 headings and buttons, 700 page titles, 800 display only.

### 4.4 Status palette ⚠️ — proposed, needs sign-off

**Sampled from the diGiLog dashboard screenshot** — this palette already exists in the design language (the Alerts card pills) and is adopted directly so diGi-Care stays visually continuous with diGiLog. Fill and tint values are exact ✅.

Each status carries **two tokens plus a tint**, because one value cannot do both jobs:

- **`--status-X`** — the house value. Solid fills, status dots, bars, borders, icons, chart series. Non-text UI, so the bar is 3:1.
- **`--status-X-ink`** — a derived darker value in the same hue, for any *text* on the tint. The house fills are far too light for text (`#46BC4A` on its own tint is 2.27:1), so this token is what makes RAG panels and status pills legible.

| Status | Fill / icon | Ink (text on tint) | Tint background | Meaning |
| --- | --- | --- | --- | --- |
| Positive | `#46BC4A` ✅ | `#1F7A33` | `#EEF9EE` ✅ | Green. Recorded, complete, within tolerance. Given. Low risk. |
| Caution | `#F07D13` ✅ | `#A65200` | `#FFEFE1` ✅ | Amber. Recorded and needs attention. Due soon. Moderate risk. |
| Critical | `#DD4347` ✅ | `#B3272B` | `#FFEFEF` ✅ | Red. Recorded and bad. High risk. Overdue. Critical incident. |
| Info | `#1563FF` ✅ | `#0B45B8` | `#ECF2FF` ✅ | Blue. Neutral information. "Medications due at 08:00" banner. |
| Unrecorded | `#8E86A8` | `#5C5470` | `#F2F1F6` | **Unrecorded / Insufficient Evidence.** See below. Deliberately muted — it must never compete with a recorded status for attention. |

Measured contrast: every ink value holds ≥4.88:1 on its own tint and ≥5.4:1 on white. If any value changes, re-measure — the ratios are the reason the split exists.

### 4.5 The unrecorded treatment ⚠️ — the most important thing in this section

`--status-unrecorded` is the only state in the system carried by **pattern, not hue**:

```
border: 1.5px dashed var(--border-unrecorded);   /* = var(--status-unrecorded), #8E86A8 */
background: repeating-linear-gradient(
  45deg,
  var(--status-unrecorded-tint) 0 6px,
  transparent 6px 12px
);
color: var(--status-unrecorded-ink);   /* ink, not fill — see §4.4 */
```

Constraints on it:

- It must never be rendered as a solid neutral fill, because a solid neutral fill reads as "fine".
- It must never be omitted in favour of empty space.
- It must never share a treatment with a recorded negative. A recorded "Not Given" uses `--status-caution` with a **solid** tint and a settled, closed appearance. An omission uses the hatch.
- Every unrecorded element carries visible text saying so — "Not recorded", "Not assessed", "No decision recorded", "Insufficient evidence". The pattern is reinforcement, never the sole carrier.
- Under `prefers-reduced-motion` nothing changes here; the hatch is static by design.

### 4.6 Shape, spacing, elevation ⚠️

Spacing scale, 4px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. Nothing off-scale.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 8px ⚠️ | Inputs, small buttons |
| `--radius-md` | 12px ⚠️ | Buttons, tags |
| `--radius-lg` | 16px ⚠️ | Cards |
| `--radius-xl` | 20px ⚠️ | Drawers, large panels |
| `--radius-pill` | 999px ✅ | Status pills, avatars |
| `--shadow-card` | `0 1px 2px rgba(30,0,89,.04), 0 4px 12px rgba(30,0,89,.06)` ⚠️ | Cards |
| `--shadow-overlay` | `0 8px 32px rgba(30,0,89,.16)` ⚠️ | Dialogs, drawers, popovers |

Layout: 12-column fluid grid, 24px gutters, max content width 1440px, app shell min-width 1280px. Desktop only in this build — below 1280px the app shows a message directing the user to a wider screen rather than degrading into a broken layout.

### 4.6a Navigation shapes

One shape, one meaning, across the whole product:

- **Underline strip** = navigation. Profile tabs, module tabs, sub-tabs. Moving between screens.
- **Pill** = filter. Narrowing what a list shows without leaving it.
- **Segmented control** = one of a small set of mutually exclusive presentations of the same data. Week / month on the MAR chart is an instance of that, not the definition — calendar / list on the activities week is another. Widened deliberately rather than inventing a fourth shape that would then need distinguishing from the three that exist.

Two concepts in one treatment is the same defect as one concept in two, arrived at from the other side. A reader learns the shape, not the screen it appeared on, so "they never appear together" is not a defence.

### 4.7 App shell

diGi-Care gets **its own navigation**, carrying the diGiLog visual language (deep purple bar, white cards on pale lavender, pill controls, generous radii) but not its information architecture.

- **Top bar** `--purple-900`: diGi-Care wordmark, site name (always visible), site switcher (multi-site users only), global search, alerts bell with count, user menu.
- **Left sidebar**, collapsible: Dashboard · Residents · Care Notes · Handover · Medications · Incidents · Risk Assessments · Care Plans · Reviews · Goals · Activities · Consent · Documents · Compliance · Reports · Team · Settings. (Dashboard is built in Phase 12 — see §8 — and stays disabled until then; `/` redirects to `/residents` in the meantime.) Items carry a count badge where the source PRD specifies one (overdue reviews, open incidents).
- Sidebar items for modules not yet built are present but disabled with a "Coming in a later phase" tooltip, so the shell does not change shape as phases land.

---

## 5. Fixture data shape

All fixtures live in `src/data/fixtures/`, typed in `src/data/types/`. Fixtures are the specification of the data contract as much as the screens are.

### 5.1 The state primitives — where the Evidence Invariant lives in code

```ts
// The general shape. Every clinical status follows it.
export type Recorded<T> =
  | { kind: 'unrecorded' }
  | { kind: 'recorded'; value: T; recordedBy: StaffRef; recordedAt: IsoDateTime };

// Risk — absence of a badge is never silence. reviewState is the single
// source of truth for review timing; there is no separate reviewDue field.
export type RiskLevel = 'low' | 'moderate' | 'high';
export type RiskStatus =
  | { kind: 'not_assessed' }
  | { kind: 'assessed'; level: RiskLevel; score: number; assessedAt: IsoDateTime;
      assessedBy: StaffRef; reviewState: ReviewState };

// Resuscitation — three states, and "no decision recorded" is one of them.
// signedBy is a plain string, not StaffRef: a DNAR is signed by a clinician
// who is often not a member of staff in this system.
export type ResuscitationStatus =
  | { kind: 'no_decision_recorded' }
  | { kind: 'dnar_in_place'; signedBy: string; signedOn: IsoDate; documentId: DocumentId }
  | { kind: 'for_resuscitation'; recordedBy: StaffRef; recordedAt: IsoDateTime };

// MAR cell — five states, no nulls, no optionals.
// Witness and escalation are their own unions: on a controlled drug, an absent
// witness must distinguish "not required" from "required and not recorded".
export type MarWitness =
  | { kind: 'not_required' }
  | { kind: 'required_not_recorded' }
  | { kind: 'witnessed'; by: StaffRef };

export type MarEscalation =
  | { kind: 'not_escalated' }
  | { kind: 'escalated'; at: IsoDateTime };

export type MarCellState =
  | { kind: 'not_due' }
  | { kind: 'due'; windowOpensAt: IsoDateTime; windowClosesAt: IsoDateTime }
  | { kind: 'given'; givenAt: IsoDateTime; givenBy: StaffRef; witness: MarWitness }
  | { kind: 'not_given'; reason: NotGivenReason; note: string | '';
      recordedAt: IsoDateTime; recordedBy: StaffRef }
  | { kind: 'omitted'; dueAt: IsoDateTime; escalation: MarEscalation };

export type NotGivenReason =
  | 'resident_refused' | 'resident_asleep' | 'medication_unavailable'
  | 'resident_in_hospital' | 'other';

// Reviews.
export type ReviewState =
  | { kind: 'never_scheduled' }
  | { kind: 'scheduled'; dueOn: IsoDate }
  | { kind: 'due'; dueOn: IsoDate }
  | { kind: 'overdue'; dueOn: IsoDate; daysOverdue: number }
  | { kind: 'completed'; completedOn: IsoDate; completedBy: StaffRef; nextDueOn: IsoDate };

// Consent — six outcomes, none of them blank. Every recorded outcome carries
// its author: refusal, withdrawal and best-interest decisions are the most
// legally consequential of them, per §3.6.
export type ConsentStatus =
  | { kind: 'not_sought' }
  | { kind: 'pending'; requestedOn: IsoDate; requestedBy: StaffRef }
  | { kind: 'consented'; method: ConsentMethod; on: IsoDate; by: StaffRef }
  | { kind: 'refused'; on: IsoDate; note: string; recordedBy: StaffRef }
  | { kind: 'withdrawn'; on: IsoDate; note: string; previouslyConsentedOn: IsoDate;
      recordedBy: StaffRef }
  | { kind: 'best_interest'; decidedOn: IsoDate; consulted: string[]; rationale: string;
      decidedBy: StaffRef };

// A care note's shift. The union rather than two fields, so a shift cannot be
// recorded without its provenance: with `shift` and `shiftReason` side by side,
// an overridden note looks identical to one nobody touched. `clockSaid` is what
// makes the reason legible — "recorded on the late shift, though the clock said
// night, because handover overran" is the whole fact.
export type Shift = 'early' | 'late' | 'night';
export type ShiftRecord =
  | { kind: 'auto'; value: Shift }
  | { kind: 'overridden'; value: Shift; clockSaid: Shift; reason: string };

// Every aggregate carries its denominator. `unit` disambiguates the two
// shapes Rule 4 needs: a rate derived from coverage ("92% — 46 of 50") and a
// count where coverage is the population it was measured across
// ("3 incidents across 32 residents").
export type Coverage = { covered: number; total: number };
export type Aggregate =
  | { kind: 'insufficient_evidence'; coverage: Coverage; missingDescription: string }
  | { kind: 'measured'; unit: 'count' | 'percentage'; value: number; coverage: Coverage };
```

`Aggregate` is the type behind every metric, RAG status, dashboard tile and report figure. A component that renders a number without a `Coverage` alongside it is a bug.

### 5.2 Fixture volume

- 1 organisation, **2 sites** — "Rosewood Court" (28 residents) and "Ashgrove Lodge" (4 residents). The second site is deliberately small so every dashboard and report is exercised against a thin dataset.
- 32 residents total. Names are clearly fictional and distinctly Nigerian, British and mixed, reflecting the actual market.
- 15 staff across the seven roles, including two with open invitations — one live, one lapsed — so both invitation states render from a fresh load.
- 90 days of history: care notes, MAR records, incidents, activities, reviews.

### 5.3 Deliberate gaps — the fixtures are not tidy

This is the cheapest and most effective defence in the whole plan. Every screen gets built against messy data by default, so the messy cases show up in review rather than in production.

Every fixture set must contain at least:

- A resident with **no falls risk assessment ever completed** — header must not read as safe.
- A resident with **no resuscitation decision recorded**, alongside one with a DNAR in place and one explicitly for resuscitation.
- A resident admitted **yesterday**, with almost nothing filled in.
- Three **medication omissions**, one escalated past 60 minutes, one inside the 30–60 minute window.
- A controlled drug with a **stock count discrepancy**.
- A resident with **withdrawn photography consent and existing photos still on file**.
- A care plan domain **finalised 14 months ago and never reviewed**.
- A care note **flagged for review and not yet reviewed**, and a **correction note** referencing an earlier note.
- A site (Ashgrove) where compliance coverage is thin enough that Key Questions render **Insufficient Evidence**.
- At least one record authored by a **now-deactivated staff member** — records outlive access.

---

## 6. Screens

Modules in Phases 0–5 are specified in full below. Later modules are specified at screen and state level in §6.7 and are expanded to this level of detail at the start of their own phase — not before, so that what we learn in early phases shapes them.

Every screen below is specified against the same state checklist. **Every screen must answer all seven:**

`Loading` · `Empty (no records ever)` · `Partial (some data, gaps visible)` · `Populated` · `Stale (data past its review/expiry date)` · `Error` · `Read-only (auditor role)`

"Empty" and "Partial" are never a shrug. They are designed states that say what is missing.

### 6.1 Phase 0 — Foundations

No user-facing screens. Deliverables: token stylesheet, icon pipeline and registry, the primitive set, app shell with routing, the fixture layer and its types, lint configuration, and a **Status Kitchen Sink** route at `/dev/states` rendering every state of every status primitive side by side. That route is not deleted; it is how we check the Evidence Invariant visually in every later review.

### 6.2 Phase 1 — Client Profile

**Residents list** (`/residents`)
Table: photo, preferred name, full name, room, site, risk flags, review status, last care note. Filters by site, risk level, review status, "records incomplete". Sort by name, room, most recent note, oldest note.
- Empty: "No residents at this site yet" with an Add Resident action.
- Partial: residents with **critical** gaps carry a hatched "Critical records missing" chip naming them. Gaps are severity-classified — critical is allergies, resuscitation decision, falls risk, choking and dysphagia risk, GP, next of kin, and care-and-support consent — seven; everything else is non-critical. The chip fires on critical only, because a chip that fires on every resident discriminates nothing and the point of this column is finding neglected records. Non-critical gaps are not hidden: the profile lists every gap, and the list filter offers both "critical gaps only" (default) and "any incomplete record".
- The "oldest care note" sort exists specifically so a manager can find neglected records; it is not decoration.

**Profile header** (persistent across all resident tabs)
Photo, preferred name, full legal name, room, DOB and age, site. Risk badge strip. Medication due in next 2 hours. Last care note summary and mood. Review status. One-tap GP and next-of-kin contact.

The badge strip is the sharpest expression of the core risk in this phase:
- `FALLS RISK — HIGH` solid red. `FALLS — NOT ASSESSED` hatched. Never absent.
- `ALLERGIES: penicillin` solid red. `ALLERGIES NOT RECORDED` hatched. `NO KNOWN ALLERGIES — recorded 12/03/2026` solid green — a *recorded* negative, which is different again.
- `DNAR IN PLACE` purple. `FOR RESUSCITATION` green. `NO DECISION RECORDED` hatched.
- Same pattern for EOLC and ISOLATION.

**General Information tab** — all fields from source PRD §16.2. Allergies render in `--status-critical` wherever they appear, and appear on every medication and care screen, not only here.
**Needs tab** — read-only, generated from care plan domains, with support level per domain. A domain with no care plan content shows the unrecorded treatment and links to create it.
**Important People tab** — next of kin, emergency contact, LPA holder with document link, social worker, professionals. Each with communication preference. Primary contact toggle.
**Future Plans tab** — DNAR, ADRT, advance care plan, preferred place of care and death, funeral and religious preferences. Every entry date-stamped, signed, version-controlled. Changing a DNAR or ADRT raises a confirmation naming the resident and warning that all staff on shift are notified.
**Care Notes tab** — the note timeline, specified in §6.3. Built in Phase 2, but it belongs to the profile's tab strip: care notes are the most-read record in the product and must not be harder to reach than Future Plans. Five tabs, therefore, not four.

**Write controls on these tabs.** Two are named in this section — the primary-contact toggle and the DNAR/ADRT change confirmation. Both are built as *affordance plus confirmation, no write*: the control is present and live, pressing it raises the real subject-naming confirmation, and confirming closes with a message stating plainly that nothing was saved and the write lands in a later phase. The confirmation is the §2.4 mitigation demonstrated, which is worth having early; the write would mean inventing a clinical record shape (clinician signature, document reference) that neither document specifies. No message anywhere says "Recorded" for something that was not.

### 6.3 Phase 2 — Care Notes

**Note timeline** (`/residents/:id/notes`) — reverse chronological, filterable by category, date range, shift, author, flagged status. Gaps of more than 4 waking hours render as an explicit hatched gap marker: *"No care note recorded — 6 hours 20 minutes"*. The gap is a rendered object, not an absence of rows. This is the invariant applied to time itself.

*Waking hours* is defined as 07:00–22:00, in one named constant. **This value is invented** — neither document defines it — and is flagged in `PROGRESS.md` as needing a real answer from a care manager. Only minutes inside that window count toward the threshold, so a resident not written up overnight is not flagged as an omission; but an overnight stretch still renders a marker in the quiet treatment, stating its duration and that it is overnight, so the record visibly continues through the night rather than jumping from 21:00 to 07:00. Quiet, not hidden.

Gap markers are **suppressed entirely while a filter is active** — Rule 3c. A hole in "Medication notes only" is a hole in the filter, not in the record.
**Note composer** — category, shift (auto from diGi-Time fixture, editable with reason), note body with category-based suggested phrases, mood indicator (5 faces, each with a text label — never icon-only), flag for review.
**Note detail** — author, timestamp, shift, immutability notice. There is **no edit control**, ever, for a submitted note. Only "Add correction note", which creates a new linked note and marks the original as superseded while leaving it visible.
**Care Notes** (`/care-notes`) — the cross-resident view. Same records as the profile timeline, different question: *what is happening in this home* rather than *what happened to this person*. It earns its place through what the per-resident timeline cannot answer, so it is built around those queries rather than around a feed:
- **Flagged and not yet reviewed, across every resident** — a supervisory duty with nowhere else in the product to discharge it.
- **Residents with no note today** — the neglect question asked across the home. Rendered as named residents, never a count alone.
- **By author** — one worker's records, for supervision or investigation.
- **By shift** — whether the night team wrote anything at all.
Default view is flagged-and-unreviewed, not "everything newest first", which is a screen nobody opens twice. Every figure on it is an `Aggregate`, and Rule 3c applies throughout: no claim about absence survives a filter without naming it.

**Handover** (`/handover`) — all residents with status All Well / Needs Attention / Urgent, plus **Not Reviewed** as a fourth, hatched state, because a resident nobody looked at is not "All Well". Dual signature, outgoing and incoming.

**Signing with unreviewed residents is permitted, loudly.** The confirmation names the site, states how many residents have not been looked at, and says in the confirming sentence that the signature does not mean they are well; it renders destructive while that count is above zero. Blocking the signature is not this build's authority to decide, and it would push the pressure onto marking people All Well to unlock the button — manufacturing exactly the false record the fourth state exists to prevent. Instead **the signature stores the counts at the moment it was given**, so it can never later be read as meaning more than it did.

The Stale state here is a previous shift's handover the outgoing staff signed and the incoming staff never did — a state a three-status model with a single signature cannot represent.

### 6.4 Phase 3 — Medication and MAR

The highest-consequence module in the build.

This module is built and closed. What follows is what exists, not what was proposed.

**On the resident** — the Medications tab, with two sub-tabs.

*Chart* — week grid by default, month reachable as a range control. Medications down, days across with rounds nested beneath them. Sticky medication column and header. Every cell is one of the five `MarCellState` values with three independent carriers — fill, glyph and a full-sentence accessible name — so any one can be removed and the state survives. Given and not-given differ by glyph (tick against bar) rather than by tint, so they hold apart in greyscale; the omitted cell is the only patterned one in the grid, which is what makes it survive desaturation by construction. An escalated omission carries a glyph, not a hue. A dose given without its required second signature carries a dashed underline on the same cell — two facts, two treatments (Rule 3a). Legend permanently visible, never a tooltip. The omissions figure sits above the grid with its denominator: the grid proves it, the banner states it.

*Prescriptions* — what was ordered, as against what was recorded. Every field from source PRD §5.3, plus `form`, `stockUnit`, `doseQuantity`, `intervalDays`, `startedOn`, prescriber, storage, instructions and prescription document. Each drug carries a **"What this requires of you"** block, derived from the drug rather than stored: two signatures on a controlled drug, a cabinet count in the right unit, a rotated patch site, a reason and outcome on a PRN. Where a requirement cannot be met because something is unrecorded, that block goes critical — a PRN with no recorded 24-hour maximum means the system cannot warn anyone that a further dose would exceed it. That is the invariant applied to a rule rather than to a record: the gap is not only missing data, it is a safety check that cannot run.

**Across the home** — `/medications`, three screens under one tab strip.

*Omissions* — every dose with no record, last 7 days, oldest first because the wait is the finding. Filters for escalated and not escalated. Every row names its resident; a dose never renders without the person it belongs to. The figure follows the active filter (Rule 3c) — a count of 20 above a list of 3 is a claim about a set the reader is not looking at.

*Round* — the administration flow. Resident by resident in room order, matching the physical order of the trolley; never drug by drug and never alphabetical. Residents already done stay in the list, marked. The round derives from the clock with a selector that shows which rounds are already complete. Large permanent subject strip with the allergy block beside it in all three states. No dose can be left blank: an unanswered dose renders the hatch, and submit stays disabled until every dose has an answer, every Not Given has a reason, and every controlled drug has a witness and a reconciling count — with the footer naming exactly what it is waiting on. `recordRound` refuses an incomplete round beyond the disabled button, because a disabled button is a courtesy and this is the rule. A dose already recorded by somebody else renders as the record, never as an empty control — inviting a second signature over another person's name is the failure this screen exists to prevent. PRN sits in its own section beneath the due list, never in it: a PRN dose has no due time, therefore no cell to occupy and no omission it could ever be. PIN per submission, checked against a staff fixture, because the trolley is shared and the record must say who gave the dose rather than who unlocked the device.

*Controlled drug register* — running balance per drug, every entry with both signatures, and every movement that the balance moves on: opening count, routine count, administration, receipt, disposal. A register showing two counts a week apart with nothing between asserts that nothing happened, and doses were given. Two findings are rendered side by side and never summed: a count that does not reconcile (critical) and a drug never counted (hatched). No balance renders as the hatch — never a zero, never a dash. A drug with no entries renders no table at all, because an empty table with headers suggests the register exists and happens to be empty. Administration is never blocked by a missing balance: the next person to give the drug counts the cabinet and records that count as the opening balance with two signatures, which is a new record honestly made rather than a figure invented from a fallback. A stock count field never shows the expected figure as a placeholder — that turns an independent check into a confirmation prompt, and the case the count exists to catch is exactly the case where the discrepancy would be typed over.

**Export** — stubbed. The button sits beside the range control, because the range is what it would export, and the dialog names what the document would contain rather than only that it is unavailable. A disabled control that does not say what it does is a control nobody can plan around.

### 6.5 Phase 4 — Incidents

**Incident log** (`/incidents`) — filter by type, severity, status, location, date, resident, reporter. Severity uses the four-tier scale with distinct treatments; status is Open / Under Review / Closed, plus **Reported, not yet acknowledged** as a hatched state.
**Incident report form** — the source PRD requires under two minutes on mobile; on desktop the same form, single column, no wizard. Body map for injury location is a click-to-mark SVG with a text list of marked areas beside it, because a body map alone is not accessible.
**Incident detail and manager review** — root cause, actions taken, preventive measures, CQC notification decision. The notification decision is a **three-state** field: notification required / not required / **not yet decided**, and "not yet decided" is the default and is hatched. It never silently defaults to "not required".
**Post-incident review flags** — closing an incident auto-flags related care plan domains and risk assessments for 48-hour review, shown on the resident profile.

**Phase 4 as built.** The log leads on unacknowledged incidents with undecided notifications as a secondary figure — never summed, because an incident can be both. No acknowledge control on a row: acknowledging without reading is the failure the state exists to make visible. The report form is single column with no wizard; subject is a union (a resident, or a recorded claim that no resident was involved) and witnesses likewise, because "leave blank if nobody saw it" makes a blank mean two things. Injury is three states and the body map is the input method while the text list is the record. The detail screen leads with what is owed — undecided notification, unreviewed flags, and a closed incident with no root cause — above the facts, and renders nothing when nothing is owed. "Notification required" stays unsettled until evidence follows it. Review flags name what would clear them and the phase that builds it; there is no mark-as-reviewed control, because clearing a clinical obligation without the work records a review that did not happen.

### 6.6 Phase 5 — Risk Assessments

**Assessment list per resident** — all ten built-in templates always listed, each showing Not Assessed (hatched), Completed with score and level, or Review Due / Overdue. A template that has never been used is *listed*, not omitted — absence from a list is the same failure as a blank cell.
**Scored assessment form** — Morse, Waterlow, MUST, Braden and the rest, with live score calculation, band display, and interventions with a responsible person each.
**Re-score and compare** — previous versus new score with Improved / Same / Deteriorated indicator, each carrying an arrow *and* a word. A risk level change raises a confirmation warning that all staff on shift are notified and the profile header will change.
**Custom template builder** — fields, scoring rules, review frequency.


**Phase 5 as built.** Nine templates, not ten — **Mental Capacity moved to Consent (Phase 10)**, because a two-stage capacity test produces "has capacity" or "lacks capacity, and here is the best-interests process", not a risk level. Forcing it into a union whose job is producing low/moderate/high would make it say something it does not. Recorded as a departure from the source PRD alongside EOLC.

`RiskStatus.assessed` always yields a level — that is what the badge strip and the risk column consume, and it is a real clinical judgement in every case. Only four of the nine produce a number, so `score` is `{ kind: 'scored'; value } | { kind: 'unscored' }`: an unscored assessment reaches a level; what it lacks is arithmetic.

**The instrument is a placeholder and every screen in the module says so** — invented items and weightings, no clinical decision to be made from a score it produces. Same treatment as the export stub. Review frequency is a single six-month constant, also a placeholder. Both block real use; see §9.

*Assessment list* — all nine rows always render, iterated from the template constant and never from the resident's record. Never assessed carries "No level" in the hatch: never blank, never low by default. "Score now" sits in its own column after the hatched cells rather than inside them — **the property is separation, not proximity**. Inside the hatched cell an action reads as an answer to the gap; in its own column after it, as a response to one.

*Scored form* — running score sticky with its denominator, stating that it is not final until every item is answered: a partial score read as a total is a wrong clinical figure, and on a running total the partial state is the normal one. Point values visible beside every choice, because a scorer who cannot see the weighting cannot tell whether the instrument is behaving. No default on any item — a pre-selected answer is an answer nobody gave, and on a scored instrument it is also points nobody chose. An intervention with a description and no responsible person cannot be saved; an empty row is ignored rather than held, because a form that refuses to save over a row nobody filled in teaches people to route around the rule.

*Re-score* — confirmation raised only on a level change, naming every consequence before it is recorded: the badge strip changing wherever it appears, each post-incident review it closes **named individually rather than counted**, and the next review date moving. Clearing is automatic on completion and never has its own button. **Lateness survives by being derived, not stored** — `wasClearedLate` is `completed.at > dueBy`, so there is nothing to overwrite. A session store makes the clearing real so the incident detail screen sees it; undo is a persistent control rather than a toast action, because this closed a clinical obligation somebody else raised.

*Cross-resident queue* — never assessed leads, not overdue. An overdue review is a risk somebody looked at and has not looked at recently; a never-assessed one is a risk nobody has looked at at all. Different claims, side by side, never summed — and a risk nobody has assessed has no wait to measure, which is why it sorts above the ones that do rather than among them. The denominator is residents × templates, not assessments on record: counting what exists would make a home that has assessed nothing look complete.

### 6.6a Phase 6 — Care Planning

*(Numbered 6.6a rather than 6.7 because §6.7 "Later modules" is referenced by name in code comments and would break if renumbered.)*

**A versioned record is a different model from an immutable one, and the difference is the point.** A care note is immutable and corrected by a linked note: it is somebody's account of a moment, and editing it rewrites what they saw, so the original stays wrong on the record and the correction points at it. A care plan is *revised*: it is a current instruction staff follow today, so there is exactly one current version and the old one becomes history rather than a correction.

`CarePlanDomainRecord` carries a non-empty version list with the current version last; `not_started` carries none, so the compiler holds "complete implies at least one version". **A draft is not a version** — an unfinalised edit becomes history only on signing, because a diff showing changes nobody agreed to is a history of intentions rather than of instructions. An abandoned draft leaves no trace, which is correct: nobody followed it.

**Three fields — current needs · preferences · agreed actions.** The first two are the resident's own words ("I like to…", not "resident prefers…"); the third is written to staff about what they will do. **The editor never pre-fills from an assessment**: a score cannot be turned into "I need help to walk" without putting words in somebody's mouth. The previous version renders beneath each field while writing, visible but never pre-filled into the box.

Finalising requires all three fields — an agreed action with no words is an intervention with no owner. A draft holds anything.

**Due soon is derived, not a union member.** "Due soon" is not a recorded fact: nobody wrote it down and it changes on its own as the clock moves. A union member asserts something about the record; this is arithmetic on a date the record already holds. That `ReviewState` *does* carry `due` and `overdue` as members is not an inconsistency — a review has a scheduling lifecycle of its own, where a domain's status is about the plan rather than the review of it. Both declarations say so, to stop the next reader "fixing" them into agreement.

**A signed plan with a draft over it renders both facts, not one** (Rule 3a). "Staff are following this today" and "somebody is rewriting it, unsigned" are opposite valences; collapsed into one chip the row reads as nothing being in force — the collapse this build exists to prevent, with an active care plan as the thing that vanishes. A single info chip is correct only where the draft is the only thing there. The Needs tab carries the revision quietly, in plain text at the settled weight, and **never lets a draft move the status** — only a signature does that.

**Finalise is two writes and one undo.** It creates the version and clears the post-incident flags together, because half an undo leaves the record holding a version nobody signed, or an obligation met by work that no longer exists. Atomicity as a property of the record rather than of the code. Flag clearing reuses the Phase 5 store rather than a second mechanism, and this is the phase where the empty outstanding block becomes reachable by doing the work rather than only by fixture.

**Version history** — a first finalise is not a diff against nothing; version 1 renders the hatched "no previous version" note. An unchanged field renders once, full width, labelled unchanged: twice in two columns reads as a change that happens to match. Drafts never appear.

**Six values now have an owner rather than a call site**, all the same shape — a value whose correct rendering depends on where it appears cannot be rendered by whoever happens to be appending it: `quantityWithUnit`, `pluralise`, `scoreText`, `INCIDENT_TYPES.phrase` (a label that reads correctly in a column and wrongly in a sentence), `formatLateness`, and `formatAttributionOn` (time alone is correct for a record read on the day it was made, and wrong for one written last Tuesday). The last two were each found by a test having to be relaxed to let a correct change land.

### 6.6b Phase 7 — Reviews

**What the module adds beyond surfacing what exists.** A completed review was invisible: `ReviewState.completed` carried its dates and no screen rendered them, so evidence that a review happened existed in the data and appeared nowhere. `never_scheduled` had no home — it lived merged with overdue inside one residents-list tile, which is the merge that tile's own note warns against. And nothing aggregated review coverage across carriers: each module answered for itself, and "is this home reviewing its records?" had no screen.

**It routes rather than building a third session.** The care plan review session is the domain editor — finalising *is* the review. The risk re-score session is the assessment form. Two ways to do one act is one too many, and the flag-clearing store assumes exactly one.

**The denominator is records that could carry a review date** — assessed risks, written domains, and whole-plan reviews. Never-assessed risks and never-written domains are excluded, and both exclusions are named on screen pointing at the queue that leads on each. The property is reviewability, not record-hood: a never-written domain has nothing to review exactly as a never-assessed risk does, and counting one but not the other inflates the denominator with things that cannot be reviewed while making this screen a partial duplicate of two others. The lead sharpens as a result — "nobody scheduled a review for a record that exists" no longer competes with records that do not.

A consequence worth recording: with both populations excluded, `no_record_to_review` left `ReviewStanding` entirely. It is a sentinel from the projection helper rather than a union member, because it is not a standing — it is the reason a record is outside the population. As a member it would be a row on a review queue saying a review cannot exist.

**The completed filter is the one genuinely new treatment.** A queue of completed records has no gap to lead on, so the lead becomes an `Aggregate` rather than a finding: coverage over the range with its denominator, and how much was completed late. That is why completed is a filter rather than a second screen. Rows render the completed review as a settled record — plain text, author and both dates always visible. Quiet is not hidden.

**Lateness was not derivable at all.** `completed` carried the date it was done and the date it falls due next, but not the date it had been due — the comparison has two inputs and one was missing. It now carries what it was completed against, **as a union rather than a date**, because a review nobody scheduled can still be done and had no deadline to beat; inventing one produces a lateness nobody can check. Same shape as a stock count with no opening balance.

**The whole-plan review can be completed while domains are gaps, and the record stores which ones were.** Same pattern as the handover signature: refusing would mean the meeting happened and the system holds no evidence of it — a review meeting happens *because* there are gaps — and permitting it silently would let "care plan reviewed" sit over three domains nobody has written. Each outstanding domain is named individually rather than counted.

`/care-plans` is built here rather than in Phase 6, leading on domains never written. A nav item tagged with a closed phase is worse than a disabled one: it is a claim that has stopped being true.

### 6.6c Phase 8 — Goals

**A goal is the only record in this build whose subject is the resident's own intention.** Everything else is somebody's account of a resident; this is their account of what they want. So the statement is the largest thing on every screen it appears, in their words, never a clinical paraphrase.

**A goal is not a care plan action**, in three ways. An action is standing and a goal is finite — "offer an arm on the corridor" happens every shift forever, "walk to the dining room by Christmas" happens once or not at all. An action is the home's method; a goal is the resident's intention. And **an action cannot fail where a goal can**: whether an action was followed is a compliance question about the home, whether a goal was achieved is a question about a person, and the answer may be no for reasons that are nobody's failure. A goal reading "staff will offer an arm" is a mis-filed care plan action. It links to a domain rather than restating it — the goal is the outcome, the domain holds the method — with an explicit unlinked member, because a goal nobody filed under a domain is a real state.

**`in_progress` is derived, not recorded.** As a stored status it is the stalest possible claim: set once, never revisited, and a goal nobody has touched in eight months still says somebody is working on it. Derived from the progress timeline it cannot go stale, and the union collapses to what somebody actually decided — `open · achieved · not_achieved · withdrawn_by_resident · stopped_by_service`.

**"Abandoned" split in two.** The resident changed their mind and the service stopped working on it are opposite in the way that matters to the person: the first is them exercising a right, the second is something that happened to them. Merged, a family cannot be told which it was — the collapse this build exists to prevent, applied to somebody's own life rather than to a clinical record.

**Every closure records what the resident said** — agreed · disagreed · not asked — with **not asked as the default, rendered as the gap it is**. Staff marking a goal achieved over somebody who does not think they did is the invariant failing in the one place where the subject is the person themselves. `withdrawn_by_resident` carries no view at all: the withdrawal is the resident's view, and asking what they thought of their own decision is incoherent whichever value it takes. Narrowed in the type rather than guarded in the fixture.

**Not achieved is not a failure treatment** — plain border on `bg-surface-sunken`. Critical and caution are for things somebody must act on; a goal that was not reached is a thing that happened to a person, and treating it as an alarm turns the record into a judgement about them.

The target date is its own union — a goal with no date can never be late, and "no date" must never read as "not yet due". Progress notes are their own record rather than filtered care notes, so a gap in the timeline is a gap in goal progress and makes no claim about the care record; Rule 3c therefore does not apply and a gap marker is honest.

A resident with no goals at all gets the whole card as the lead and no list beneath it — nothing to list — naming how long they have been here, because "no goals set" means nothing on somebody admitted yesterday and a great deal on somebody here five months.

### 6.6d Phase 9 — Activities

**Attendance is the MAR cell.** `attended · did_not_attend(reason) · not_recorded`, mapping onto the precedent exactly: a recorded non-attendance is settled and carries its reason — declined, unwell, off-site — and `not_recorded` takes the hatch. Choosing "did not attend" asks why and cannot be saved without an answer, because a negative with no reason is indistinguishable from nobody having looked.

**The denominator is the invitation list.** "12 attended" is not a fact; "12 of 18 invited, 4 not recorded" is. And an activity nobody wrote up renders eighteen hatched rows, never "0 attended" — zero attended says nobody came, nothing recorded says nobody wrote it down.

**§2.4 moves from the screen to the row.** This is the first module whose subject is a group, and the failure changes shape with it: on a grid you do not pick the wrong person from a list, you slip a row, and Doris is marked present while Beryl is marked absent. So every row carries its own resident identity — avatar, preferred name, full legal name, room — and every answer control names the person in its accessible label. The row is the write, so the row carries the subject.

**No bulk "mark all attended."** One click asserting twelve facts nobody checked is the handover "sign for everybody" failure with twelve people in it. If it is ever added, it follows the handover: permitted loudly, and the record stores that it was set in bulk.

**Somebody who joined without being invited is recorded outside the invitation list.** Folding them in retroactively would rewrite the plan to say they were always expected — a record editing itself to look tidier. Three facts, all true: 12 of 18 invited attended, 4 not recorded, 2 joined uninvited.

**Four session states on the calendar, and only one is a gap.** Happened-and-unrecorded is hatched and is the lead finding; partly recorded takes caution; fully recorded is quiet; **a future session takes a dashed purple border, because nothing has happened and nobody has failed to record anything** — the hatch would say "this should have been written up" about an afternoon that has not arrived.

**Activity preferences are read from the care plan** — the social and emotional wellbeing domain, in the resident's own voice — and duplicated nowhere. Where that domain is unwritten the drawer renders "never asked what they like", because an unwritten domain *is* nobody having asked, and it links to the screen that fixes it rather than offering a field that would drift.

**§3.6 arrived on a diary rather than a timestamp.** The calendar highlighted Monday when it was Tuesday: `new Date().toISOString()` is UTC, and at ten past midnight BST that is still yesterday. The site's zone decides which square is today, because the sessions in it happened there. No test caught it — the suite pins the clock to the fixture instant, where UTC and the site agree — and it was found only by looking at a picture.

### 6.6e Phase 10 — Consent

**Mental capacity is not a status.** The MCA test is decision-specific and time-specific: does this person have capacity for *this* decision, *now*. That is not a property of a resident and not a property of a consent type — it is a property of the occasion on which somebody decided, so it lives on the decision. `not_assessed · has_capacity · lacks_capacity`, and a lacks-capacity finding carries **both MCA stages, both required**: a conclusion with no impairment recorded and no functional finding is a conclusion without a test.

**`ConsentStatus` split into two axes**, because five of the six original members said what was decided and one said who decided — answers to different questions sharing a union. The gap that exposed is the proof: a best-interests process can conclude *no*, and the old type could not express it, so `best_interest` implied a positive outcome by omission. In the fixtures 41 of 168 recorded decisions are best-interests refusals, a shape that previously had nowhere to live.

- **What was decided** — `not_sought · pending · given · refused · withdrawn`
- **Who decided it** — the resident, a best-interests process, or a health-and-welfare LPA holder

`not_sought` and `pending` carry no authority, because nothing has been decided and so there is nobody who decided it. The other three always do, which makes the gate structural: a decided consent cannot be constructed without an authority, and an authority cannot be constructed without a capacity assessment.

**One assessment may name several decisions; it may never be general.** A manager going through consents in one sitting is real practice and one assessment genuinely can cover several decisions — but "has capacity" applied to a decision nobody assessed against is the MCA violation, so a consent may only reference an assessment naming its own type. Enforced by the type rather than by a guard: `covers` is a map, so an assessment covering three types is assignable wherever any of those three is expected and a fourth does not compile.

**The gate is a gate, not a field.** The question stands alone before any consent detail exists, and nothing else on the screen — scope, stages, continue — is reachable until it is answered. No default selection.

**Refused is not a failure treatment.** A resident refusing is them exercising a right; caution or critical would make the record disapprove of them. Same treatment as a goal not achieved.

**Downstream effects are data, not prose.** A sentence cannot be asserted against, so a withdrawal that forgot to mention the photographs would look identical to one that did — the product's own failure inside the dialog written to prevent it. Each effect carries its own count, and **an unknown count renders "not counted" rather than zero**: nobody knowing how many is not the same as none. Cross-module effects belong here and are derived rather than remembered — withdrawing photography while Family Portal Access still stands is a real consequence and is checkable from data.

Every consent type carries a plain-English line saying what consenting to it actually permits. A consent nobody can explain is not informed, and that line is the difference between a record of consent and a record of a signature.

Brennan's withdrawn photography consent with photographs still on file — pinned in §5.3 since Phase 0 — reached a screen here, five phases after it was written.

### 6.6f Phase 11 — Documents

**No folder metaphor and no format icons.** The seven categories are sections of one library rather than places a file sits, so nothing renders a folder — which also sidesteps the Phase 0 icon gap, since the shortage was folders and per-format badges rather than document iconography. Format is text: "PDF · 1.2 MB" says more than a glyph, because a glyph tells you nothing about whether the thing opens.

**Category order is fixed and meaningful**, iterated from the constant and never from the data: Legal and authority · Identity and admission · Health and clinical · Assessments and care planning · Consent records · Correspondence · Photographs and media. Legal is first because a DNAR nobody can produce in ninety seconds is a DNAR that gets overridden.

**Expiry is a closed union in which "does not expire" is a recorded decision** — `expires(on)` · `does_not_expire(decidedBy, on)` · `not_recorded`. Somebody has to have said a document is permanent; an empty date field cannot say it, and the value without an author would be indistinguishable from an assumption.

**Three findings, never summed** — expired (critical), expiring within `DUE_SOON_DAYS` (caution), and no expiry recorded at all (hatched). The third is not a milder version of the first two: it is the absence of the fact they are made of.

**An empty category is not always an emptiness.** Where another module's record implies a category should be non-empty, it renders the hatch naming what is missing and where the expectation came from — "DNAR in place since 17/05/2025, and no document in Legal and authority" — rather than "No documents". Cross-module derivation, checkable from data rather than remembered.

That is also where Phase 10's counted withdrawal effect reached a screen it was not written for: Brennan's withdrawal recorded fourteen photographs it could not undo, his Photographs and media category holds nothing, and the library renders the disagreement in his own record's words.

**A broken reference is a finding, not a dead link.** Four phases of document ids that pointed at nothing now resolve or accuse — the lookup is a closed union, and `not_on_file` renders hatched and unlinked, naming the id, the module holding it and what that module says. Never a link that fails on click, never silence.

**Nothing offers to open a file, because no file exists behind any of it.** Every row says which kind of nothing it is: "not retrievable here" for a document whose metadata is real, "cannot open — not on file" for a broken reference. The export stub's discipline applied to the library itself, and a correction to the reference, which had offered an enabled Open.

### 6.6g Phase 12 — CQC Compliance and the Dashboard

**Two floors, and they compose.** `MIN_POPULATION_FOR_A_RATE` is a floor on one rate's denominator — is there enough here for this percentage to mean anything. `INSUFFICIENT_EVIDENCE_THRESHOLD` (60%) is a floor on how much of a panel has any usable figure at all. So a Key Question is built in two passes: each check returns an `Aggregate`, which may already be Insufficient Evidence because its own population is below eight; then the panel asks what fraction of its checks came back usable. **A check that is itself Insufficient Evidence does not count toward the 60%** — a panel assembled from figures none of which can support a claim cannot support one either, and counting them would let five unusable checks make a panel look measured.

**A third kind of absence, with its own treatment.** "Nobody has recorded a supervision" and "nothing in this product records supervision" are opposites: the first is a finding about the home, the second a finding about the system. Rendering them alike would send a manager looking for a screen that does not exist — the Evidence Invariant failing at the top of the screen built to enforce it.

So **Not held here** is solid `bg-surface-sunken` with a plain border and no pattern, because pattern in this system means "a gap you can close" and nothing on any screen can close this one. It is listed, it never counts toward coverage, it never contributes to a rating, and its wording says the product does not record the thing rather than that the home has not done it — enforced by a guard reading every such statement.

**Compliance and the Dashboard share machinery and share no figure.** Compliance is coverage-shaped, over the whole record, ordered by Key Question — *can we evidence this to an inspector*. The Dashboard is deadline-shaped, over today, ordered by urgency — *what needs doing before the end of this shift*. **No compliance percentage appears on the Dashboard, and nothing on it is green**: a tile with nothing wrong renders calm rather than reassuring, because a "92% compliant" figure on the front door would be most reassuring exactly when the record is thinnest.

**The inspection pack is a manifest, not a file.** No backend and no file storage means no PDF, and there is no download control at all — not a disabled one, because a disabled button implies a file could exist. Three sections: what the pack would contain, what it cannot because the home has not recorded it (hatched — closable), and what it cannot because the product does not hold it (inert — not closable). The second and third are longer than the first, on purpose: a manager reading this before an inspection gets more from the gaps than from the list.

**Every check names the module it comes from**, and a check whose evidence is weaker than it looks says so — fire and legionella are evidenced by a document existing rather than by an assessment record, and hiding that behind a tick would be the screen overstating its own evidence.

### 6.6h Phase 13 — Reports

**Eight reports, not fifteen.** A screen whose only distinction is a name is a screen somebody has to learn for nothing, so the seven questions that would have been a compliance check with a table under it are drill-downs from that check — which is also where a reader already is when the question occurs to them. The index lists them as drill-downs so nobody concludes the product cannot answer them.

**What a report gives that a queue and a panel cannot** is a figure over a *period*, cut by something other than resident. A queue is a worklist ordered by urgency; a panel is coverage over the whole record; a report compares this month with last, by unit, by drug, by staff member. This is the first period in the build.

**Comparison is a field, not a derivation.** Two of the eight measure states rather than flows and carry no comparison control at all, with a sentence saying why — a toggle that changes nothing is worse than no toggle. And comparison is on rates rather than counts: eleven omissions against 420 doses and six against 180 move the same way on counts and opposite ways on rates.

**The finding renders above the filters and above the table**, and where the data is too thin the finding *is* that — with the table still rendering beneath it. Refusing to render hides data somebody may still need; the finding above is what stops the table being read as a conclusion. Rows below the population floor stay in the table, hatched, with Insufficient Evidence in the figure cell rather than a percentage: removing them would make the table look complete.

**Thin reports are marked on the index, before opening.** Opening a report to discover it cannot say anything is a wasted trip, and the index is where that is cheapest to prevent.

**No ratings anywhere.** Figures and coverage on a report; judgement stays on the compliance panel. A green rating here would reintroduce the reassurance the Dashboard refuses.

**Per-staff reports carry a constraint the others do not.** Workload and coverage, never a league table — ordered by name, with a guard failing any ordering by a figure, and every denominator in the same cell as its figure. Deactivated staff stay, marked, because records outlive access.

Two columns in the reference could not honestly exist and were removed rather than filled. **A dose with no record carries nobody's name** — attributing an omission to whoever else was on shift would invent the accusation the screen's own note warns against. And **a rate on a zero numerator is not the same as a rate on a small one**: a staff member who recorded nothing has 0 of 28 residents, a denominator that supports a rate perfectly well, and "0.0%" against somebody who did not work is an accusation dressed as a measurement. `rate()` takes the population that decides supportability separately from the denominator.

This is the first module whose subject is a member of staff, and the invariant cuts the same way it does for residents: a figure about a person that does not carry what it is out of is an accusation rather than a measurement.

### 6.6i Phase 14 — Team Management

**Phase 13's constraint is the whole module, not one screen.** Every screen here has a person as its subject, so the rule stops being a special case: ordered by name and never by anything anybody did, every figure carrying what it is out of, and no figure attributing an absence to somebody, because an absence has no author.

**No counts at all on the staff detail.** There is no rota and no shift record, so a count of what somebody recorded has no honest denominator — and a bare count beside another person's bare count is a ranking whether or not anybody sorted it. Not ordering the list only stops us doing it for the reader. The figures are not wrong; they are wrong without the framing the report gives them, so the detail shows recent activity as a list and links to the coverage report where the period and denominators are stated.

**The "Not held here" block sits above the activity, not below it.** A page of what somebody recorded reads as the beginning of a performance record unless it is told otherwise first. It reuses the Phase 12 component exactly — supervision, appraisal, training and induction are not in this product, and the absence is a gap in the system rather than anything about the person.

**`StaffMember` carries the minimum**: name, role, site, standing. No start date, no contract type, no employment fields — a field nobody has asked for is a field nobody has decided how to protect, and inventing an employment record is how a care system starts holding HR data it was not built to hold.

**Standing is a union with four members and one of them is a gap.** Has access renders plain; no-longer and suspended render settled with when, why and who; **never-given-access takes the hatch**, because nobody chose it. Every member carries an author, including the gap.

**Standing is derived at render time, never snapshotted into the attribution.** The `StaffRef` answers how somebody appeared on a record; standing answers whether they can still get in, and only one of those changes. A reactivated person whose historic notes still said deactivated would be a fact about now stored in a record about then. `formatAttribution` lost its `isActive` argument entirely — whether an author still has access is not a formatter's business.

That change touched twenty-three files and **not one test failed**, which is the finding: the label rendered in six modules and nothing asserted it anywhere except a single unit test on the formatter. Rendering everywhere is not coverage.

**The permission matrix describes this product, not the source PRD's.** Sixteen modules and four levels — no access · read · record · approve — rather than 54 flags inherited from a product with a permission model. Nothing is enforced, there is no authentication, and the statement saying so renders before the first cell.

**The activity log is a write log for this session, and says what it is not.** Its use is showing a reviewer exactly what a demonstration session changed; a read log would be surveillance with nothing behind it, since there is no auth and no reads to log. It is fed from the data access layer rather than per screen, and it stamps its own entries from the clock — the log is about this session in order, not about the records, and taking each record's own timestamp widened a care plan's date into an invented midnight.

### 6.6j Phase 15 — Multi-site

**What the phase adds is the comparison.** The switcher already existed, every module already scoped to the active site, and every record already rendered in its own site's zone. What did not exist was any screen whose subject is the organisation — to compare two homes you switched, read, switched back and remembered. Same argument period comparison had in Phase 13: the one thing that cannot be got any other way.

**No group rating, and that dissolves the threshold question.** `INSUFFICIENT_EVIDENCE_THRESHOLD` exists to gate a rating; with no group rating there is nothing to transpose, and the two-site arithmetic problem disappears rather than needing a rule. A single figure for the organisation would be the most reassuring thing this product could render, and it would be most reassuring exactly when one home is thinnest.

**Every group figure carries its spread in the same sentence as the number** — how many homes are inside it and how many could not support a figure of their own. Each site keeps its own column and its own standing: a Key Question that is Insufficient Evidence at one home and Amber at the other renders as exactly that, never as a third figure that is neither. Where both are unusable the group has none, because a figure assembled from two unusable ones is not usable.

Care plan domains is the case that makes the argument: across the group the coverage figure is true, and it hides four fifths of Ashgrove's plan being unwritten inside Rosewood's population.

**Site cards side by side, not a table.** Two homes read as two homes; a table reads as a league — Phase 13's constraint applied to sites rather than people. The cards carry counts rather than rates, because a count needs no population floor and counts are what a manager acts on.

**The cross-site banner offers the switch and does not perform it**, and says which home governs the timestamps: the record's own. Navigating somebody away from a record they are reading is the app deciding they made a mistake, and a manager covering both homes reads across them all day. The defect it fixes was two visible site names disagreeing with nothing saying which governed what.

**Settings is settable if and only if the figure is read at render.** Five of the six §9 2b figures are — only `MEDICATION_LOOKAHEAD_HOURS` is consumed by fixture generation — so five are live controls and one renders read-only with the reason. `setFigure` throws on the fixed one rather than accepting a value and ignoring it: a setter that discards its argument is a control that does nothing, one layer down.

A changed figure is marked as changed-this-session in the app shell, naming which moved and what it was. Deliberately not a mapping of figures to affected screens — that would be a second rule beside the first, and two rules drift.

**The custom template builder was dropped rather than carried forward.** The instrument is a flagged placeholder, and a template somebody authored themselves reads as theirs rather than as a placeholder — without the banner. Building a factory for a thing whose specification is unresolved produces unresolved things faster. It is blocked on §9 2a, not on a phase.

### 6.6k Phase 16 — Resident admission and record editing

**Admission produces Ismail Sowande**, and the guard says so by name — field by field against the resident who has been that shape since Phase 0. If admission produced anything different, one of the two would be wrong.

That is the phase's finding rather than a disappointment: **admission cannot create anything less than a full set of gaps**, because `consents` is a mapped type over eight keys, `risks` a record over nine templates and `carePlan` an array the screens iterate from a constant. A resident missing any of them does not compile. The type makes forgetting impossible, which is the Phase 10 mapped type doing the job it was given.

**Six fields and one question.** Legal name, preferred name, date of birth, admission date, home, room — anything more asks somebody to guess on the day they know least. Preferred name left blank renders as not recorded rather than defaulting to the legal name; a default there would be the system putting a name in somebody's mouth on their first day.

**Allergies is the one clinical question on the form**, and it is there because the first medication round may happen before anybody asks again. Three states: recorded with what, the reaction and its severity; no known allergies **with a source** — the resident, family, a GP letter, a discharge summary; or not known yet, hatched from the first minute. The source is what stops the field becoming pressure to answer: "no known allergies" with nobody's name on it is a guess wearing a record. Severity is part of the same question rather than a seventh field — "rash and swelling" without saying whether that is mild or anaphylaxis is the half-record this build refuses, on the field where the difference is whether somebody carries an adrenaline pen.

**The form says what starts unrecorded, and where each of those is recorded.** Admission does not create a record; it creates a person and a set of gaps. The footer states plainly what admitting does to every figure in the product — a resident on the list with critical records missing, a compliance figure that just got worse, a group coverage that just fell. All true, and none of it a reason not to admit her. A product that hid it would make admitting somebody look tidier than it is.

**Four editing rules already existed and this phase did not flatten them.** A care note is immutable and corrected by a linked note. A care plan domain is versioned. A consent is superseded. A document is not editable at all. Editing is field by field rather than a form, because a bulk save attributing six changes to one act is the wrong shape for a clinical record.

**Two profile surfaces cannot honestly write, and say so rather than promising a phase.** A resuscitation decision and an ADRT need a clinician's signature and a document reference, and this build captures neither — recording one with the current user as signatory would be inventing a clinical signature. That is the "not held here" distinction rather than a stub.

---

## 6.8 Where the build stands

Sixteen phases closed at fifty test files and 1,099 tests. With the four surfaces added afterwards (§6.9): **60 test files, 1,203 tests, nine lint scripts.** Both figures are kept — the first is what the phased build order produced, the second is where the build stands today, and conflating them would lose which work belonged to which.

**Stubbed with a reason rather than a promise.** Prescribing — a prescriber's act, and there is no prescriber, no directions model and no interaction checking. The MAR export and the inspection pack, each naming what they would produce. Goals, incidents and activity attendance confirm without writing; they need their own session stores rather than a patch to the resident record. And every "gone on reload", which is true of the whole build.

**Blocked on a care manager, not on a developer.** The risk instrument (§9 2a) — nine invented instruments with a banner on every screen. The CQC mapping and the worst-of rule (§9 2d), where the screen going uselessly red is itself the argument for sourcing a real one. The invented figures (§9 2b), now adjustable on the settings screen, which is as close as this build can come to letting somebody see what a different answer does before committing to it.

None of the three can be closed by building anything. All three are visible on screen, banner-flagged, and blocking real use rather than further work.



## 6.9 Additions after Phase 16

Four surfaces added once the sixteen phases had closed, each because a decision made early stopped being right for a build that is deliberately front-end only.

**The document viewer.** "Not retrievable here" described a limitation that is never going away, so documents whose metadata is real now open to a representative sample of that document type, on a dark neutral stage with the sample banner **above** the page rather than watermarked across it — a watermark would make the sample unreadable and would be the second thing in this build to obscure its own content. The rail carries **what points at this document**: every module referencing it, each linked. That is the broken-reference relationship seen from the other end, and it is what makes the viewer worth opening rather than a picture. "Cannot open — not on file" stays exactly as it was for genuine broken references: that message is the product working.

**Medication intake, in two paths, and neither creates a prescription.** Prescribing is a clinical act by a prescriber; what a home does is record a prescription that exists elsewhere. So: a **pharmacy cycle** arrives and is checked against what the home holds, row by row, with four tallies — new, changed, stopped, and **on the MAR but not in the cycle**, hatched. That fourth is the finding, and it cannot be seen from either side alone: a drug the home is still giving that the pharmacy has stopped supplying. No "accept all" — one click asserting nineteen medication changes nobody read is the handover failure with prescriptions in it. And an **interim medication** path for what arrives between cycles, where **the source is the first question and is required**, a verbal order carries a witness and a 24-hour written-confirmation obligation, and a controlled drug cannot be added at all, stated before anybody types rather than failing on submit.

**Staff authentication and onboarding, with the notice that there is none.** Sign-in, invitation, and a staff member's own dashboard at `/me`. The prototype banner is on every auth screen and is not a footnote — a sign-in form that silently accepts anything is worse than no sign-in form, because it implies a check that is not happening. Site is chosen at sign-in rather than after, because it decides the timezone every record written that day carries. An invitation states role, home and access level **before** the password fields, and names its expiry: an invitation with no expiry is a permanent open door.

**`/me` has no counts of the reader's own work.** Phase 14's constraint applies with more force when the subject is reading about themselves, not less — a screen showing somebody their own productivity figures is a performance record whatever it is called. And the third tile is "nobody has written up", not "on your list": there is no rota, so nothing allocates a resident to anybody, and "your residents" would put a person's name against a gap they were never given.

**Signing out is the only action in this build that destroys work rather than failing to save it**, because every write is held in memory. The confirmation names what would be lost item by item with counts, each store reporting in its own words — the session log looked like the obvious source and was wrong, with nine of nineteen write paths never reaching it, so a confirmation built on it would have destroyed a shift's medication records under a list that never mentioned them.

**The permission matrix was wrong for fifteen phases and was caught the first time it was shown to its subject.** A care worker read as Record on Dashboard and on Residents; nothing is recorded on a dashboard by anybody. Fixed as a class rather than as two cells — each module declares the acts it actually offers, and a role's level is capped by the module's ceiling. A screen describing a third party is unaudited by construction, and showing it to the person it describes is the cheapest audit available.

## 7. Accessibility

Target: **WCAG 2.2 AA**. Care managers work long shifts on mediocre monitors; auditors and inspectors using this product may be any age and any ability. Treated as a requirement, not a pass at the end.

- **Colour is never the only carrier of meaning.** Every status has a text label; the unrecorded state additionally carries a pattern. A RAG panel is legible in greyscale. This is checked per screen, not per phase.
- **Contrast** ≥4.5:1 for text, ≥3:1 for UI boundaries and status indicators against their background. This is why §4.4 splits each status into a bright fill token and a darker ink token: **text on a tint uses `--status-X-ink`, never `--status-X`.** Using the fill token for text is an accessibility failure and a review blocker. Re-measure if any value changes.
- **Keyboard**: every action reachable and operable. Visible focus ring, 2px `--purple-600` with 2px offset, never removed. Logical tab order. Focus trapped in dialogs and drawers, returned to the trigger on close. Skip-to-content link.
- **The MAR grid is the hard case.** It is a real `<table>` with proper headers, arrow-key cell navigation, and each cell exposing a full-sentence accessible name including drug, dose, time, state, and who recorded it. It is not a div grid.
- **Screen readers**: Radix gives correct roles for overlays; do not fight it. Live regions announce alerts, omissions and save confirmations. Form errors are associated with `aria-describedby` and announced.
- **Icon-only controls** are permitted only where a visible text label sits adjacent; otherwise `aria-label` plus a tooltip. Icons are `aria-hidden` by default.
- **Targets** ≥24×24px minimum, ≥44×44px for anything destructive or clinical.
- **Motion**: `prefers-reduced-motion` respected. No animation on any clinical state change.
- **Zoom**: usable at 200% without horizontal scroll within the content area.
- Automated `vitest-axe` check per screen, plus a manual keyboard pass before any phase is signed off.

---

## 8. Phased build order

One module per phase. Each phase ends with a stop for review. Within Phase 1, we stop after **each screen**; from Phase 2 onward we can review a whole module at once if Phase 1 goes smoothly.

| # | Phase | Contents | Why here |
| --- | --- | --- | --- |
| 0 | **Foundations** | Tokens, icon pipeline and registry, Radix primitives, app shell, routing, fixture layer and types, lint, `/dev/states` kitchen sink | Nothing else can be correct until the state primitives and the unrecorded treatment exist |
| 1 | **Client Profile** | Residents list, profile header and badge strip, General Information, Needs, Important People, Future Plans | The badge strip is the first real test of the invariant, and everything else hangs off the profile |
| 2 | **Care Notes** | Timeline with gap markers, composer, detail with immutability, handover | Simplest write surface; proves the no-edit and gap-rendering patterns |
| 3 | **Medication and MAR** | MAR grid, administration flow, setup, controlled drugs, omissions | Highest consequence; needs the patterns from 1 and 2 already proven |
| 4 | **Incidents** | Log, report form, body map, manager review, CQC notification decision | Feeds reviews and compliance |
| 5 | **Risk Assessments** | Ten templates, scoring, re-score comparison, custom builder | Closes the loop with the profile badge strip |
| 6 | **Care Planning** | Domains, editor, version history, finalise and sign | |
| 7 | **Reviews** | Review dashboard, care plan review session, assessment re-score session | Needs 5 and 6 |
| 8 | **Goals** | Goals tab, form, progress notes, achievement | |
| 9 | **Activities** | Calendar, list, planning drawer, completion | |
| 10 | **Consent** | Consent tab, capacity gate, withdrawal, dashboard | |
| 11 | **Documents** | Resident and organisation libraries, expiry tracking | |
| 12 | **CQC Compliance + Dashboard** | Five Key Questions, Insufficient Evidence, gap drill-down, inspection pack, statutory notifications — **and the manager Dashboard at `/`**, which is the same aggregate machinery pointed at daily operations rather than inspection | Needs most modules to have data to aggregate. The Dashboard is built here and not earlier because a dashboard over three modules would be rebuilt twice; until then `/` redirects to `/residents` and the Dashboard nav item stays disabled |
| 13 | **Reports** | All 15 reports, filters, export | Needs 12 |
| 14 | **Team Management** | Staff list, permissions, activity log | |
| 15 | **Multi-site** | Switcher, group overview, site settings | Last because it re-scopes everything before it |

| 16 | **Resident admission and record editing** | Admit a resident, edit an existing record, the primary-contact and DNAR/ADRT writes stubbed in Phase 1 | Last because an admission that creates a resident with no consent types, no risk assessment templates and no care plan domains would create the very record this product exists to flag. Everything it writes into must exist first. Until this phase, Add Resident and every edit affordance renders present-but-disabled with its phase tag — never absent, never live |

**Deferred to separate builds:** mobile care-worker application, Family Portal.

---

## 9. Open items

Carried from the source PRD's own open questions plus items raised by this document. None block Phase 0; several block later phases.

1. Remaining ⚠️ values — the three intermediate ink steps (§4.2), type sizes (§4.3), radii and shadows (§4.6). Not blocking; swap into `tokens.css` in one edit once confirmed against a design file.
2. Insufficient Evidence threshold — 60% is my default, needs a real answer before Phase 12.
2a. **The risk assessment instrument is a placeholder** — invented items, weightings and band thresholds, with a banner on every screen saying so. Morse, Waterlow, MUST and Braden are published instruments and must be sourced properly rather than reproduced from memory; a threshold wrong by one point puts a resident in the wrong band. Blocks any real use of Phase 5.
2b. Review frequency is a single six-month constant across all nine templates and all ten care plan domains; `DUE_SOON_DAYS` is 30 and is read by reviews, care plan domains and document expiry alike — a review's due date and an expiry date are the same kind of instant; `MIN_POPULATION_FOR_A_RATE` is 8 and lives beside `Aggregate` itself, because it is a property of rendering a rate rather than of any module; and `NO_GOALS_ALERT_DAYS` is 30 from admission. All are invented and all want the same care manager's answer.
2d. **The mapping of evidence to CQC Key Questions is not derived from CQC's published framework**, and the rating combines a panel's checks by taking the worst of them. Both are placeholders with a banner on every compliance screen saying so. Worst-of was chosen because it errs toward alarm rather than reassurance, which is the only direction to err in this product — but a real weighting is a domain answer, and a threshold wrong by one check puts a home in the wrong band. Blocks any real use of Phase 12.
2c. Waking hours are 07:00–22:00, invented. Needs a care manager's answer; affects every gap marker on the care note timeline.
3. Care worker PIN behaviour on shared devices — affects the MAR confirmation dialog in Phase 3.
4. Whether activity planning is owned by a dedicated Activities Coordinator — affects the Phase 9 permission model.
5. Non-UK regulatory frameworks — out of scope for this build, all compliance UI is CQC-shaped.
6. Pricing model — affects nothing in this build; noted so it is not forgotten.
