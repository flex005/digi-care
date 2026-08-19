# diGi-Care — Frontend Build PRD

**Source of truth for product scope:** `diGi_Care_PRD_v3.docx` (Ezekiel Dada).
**This document governs the frontend build only.** Where the two disagree on UI behaviour, this document wins; where they disagree on product intent, the source PRD wins and this document gets corrected.

**Build scope:** Desktop manager application. Frontend only — no backend, no API, no auth. All data comes from typed fixtures.
**Out of scope for this build:** mobile care-worker views, Family Portal. Both are specified at product level in the source PRD and will be separate builds.

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

**Rule 4 — Every aggregate carries its denominator.**
No bare counts, no bare percentages, anywhere in the product. Not "3 incidents" but "3 incidents across 32 residents". Not "92% compliance" but "92% — 46 of 50 expected notes; 12 residents have no expected frequency set". Where coverage is too thin to support a judgement, the aggregate shows **Insufficient Evidence** rather than a figure.

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
border: 1.5px dashed var(--border-unrecorded);   /* #A8A1BC */
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

### 4.7 App shell

diGi-Care gets **its own navigation**, carrying the diGiLog visual language (deep purple bar, white cards on pale lavender, pill controls, generous radii) but not its information architecture.

- **Top bar** `--purple-900`: diGi-Care wordmark, site name (always visible), site switcher (multi-site users only), global search, alerts bell with count, user menu.
- **Left sidebar**, collapsible: Dashboard · Residents · Care Notes · Medications · Incidents · Risk Assessments · Care Plans · Reviews · Goals · Activities · Consent · Documents · Compliance · Reports · Team · Settings. Items carry a count badge where the source PRD specifies one (overdue reviews, open incidents).
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
- 14 staff across the seven roles.
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
- Partial: residents with incomplete records carry a hatched "Records incomplete" chip listing what is missing.
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

### 6.3 Phase 2 — Care Notes

**Note timeline** (`/residents/:id/notes`) — reverse chronological, filterable by category, date range, shift, author, flagged status. Gaps of more than 4 waking hours render as an explicit hatched gap marker in the timeline: *"No care note recorded — 6 hours 20 minutes"*. The gap is a rendered object, not an absence of rows. This is the invariant applied to time itself.
**Note composer** — category, shift (auto from diGi-Time fixture, editable with reason), note body with category-based suggested phrases, mood indicator (5 faces, each with a text label — never icon-only), flag for review.
**Note detail** — author, timestamp, shift, immutability notice. There is **no edit control**, ever, for a submitted note. Only "Add correction note", which creates a new linked note and marks the original as superseded while leaving it visible.
**Handover** (`/handover`) — all residents with status All Well / Needs Attention / Urgent, plus **Not Reviewed** as a fourth, hatched state, because a resident nobody looked at is not "All Well". Dual signature, outgoing and incoming.

### 6.4 Phase 3 — Medication and MAR

The highest-consequence module in the build.

**MAR chart** (`/residents/:id/medications`) — month grid, medications down, days and administration rounds across. Every cell is one of the five `MarCellState` values, each visually distinct, each with an accessible name read by screen readers as a full sentence ("08:00, 5 April, Amlodipine 5mg — given by C. Nwosu at 08:04"). A legend is permanently visible above the grid, not hidden behind a tooltip.
**Administration flow** — due-now panel, per-medication Given / Not Given / PRN. Not Given requires a reason before it can be submitted. PRN requires reason, symptom, and outcome. PIN confirmation dialog names the resident and the medications. Controlled drugs require a second signature and a stock count before and after, and a mismatch blocks submission and raises an incident.
**Medication setup** — all fields from source PRD §5.3, including controlled drug flag, PRN flag with 24-hour maximum, storage instructions, prescription photo.
**Omissions view** — everything unrecorded past its window, by resident and by round, with escalation state.
**Export** — MAR PDF export is stubbed in this build (button present, produces a fixture PDF or a clear "not available in prototype" state — never a silent no-op).

### 6.5 Phase 4 — Incidents

**Incident log** (`/incidents`) — filter by type, severity, status, location, date, resident, reporter. Severity uses the four-tier scale with distinct treatments; status is Open / Under Review / Closed, plus **Reported, not yet acknowledged** as a hatched state.
**Incident report form** — the source PRD requires under two minutes on mobile; on desktop the same form, single column, no wizard. Body map for injury location is a click-to-mark SVG with a text list of marked areas beside it, because a body map alone is not accessible.
**Incident detail and manager review** — root cause, actions taken, preventive measures, CQC notification decision. The notification decision is a **three-state** field: notification required / not required / **not yet decided**, and "not yet decided" is the default and is hatched. It never silently defaults to "not required".
**Post-incident review flags** — closing an incident auto-flags related care plan domains and risk assessments for 48-hour review, shown on the resident profile.

### 6.6 Phase 5 — Risk Assessments

**Assessment list per resident** — all ten built-in templates always listed, each showing Not Assessed (hatched), Completed with score and level, or Review Due / Overdue. A template that has never been used is *listed*, not omitted — absence from a list is the same failure as a blank cell.
**Scored assessment form** — Morse, Waterlow, MUST, Braden and the rest, with live score calculation, band display, and interventions with a responsible person each.
**Re-score and compare** — previous versus new score with Improved / Same / Deteriorated indicator, each carrying an arrow *and* a word. A risk level change raises a confirmation warning that all staff on shift are notified and the profile header will change.
**Custom template builder** — fields, scoring rules, review frequency.

### 6.7 Later modules — screen and state level

Expanded to full detail at the start of their phase.

| Module | Screens | Core-risk notes |
| --- | --- | --- |
| **Care Planning** | Domain list, domain editor (current needs / preferences / agreed actions), version history and diff, finalise-and-sign | Domain status must distinguish Not Started from Complete from Review Due. Version history renders "no previous version" explicitly. |
| **Reviews** | Review dashboard (upcoming / overdue / completed), care plan review session with side-by-side versions, risk assessment re-score session | Review compliance rate is an `Aggregate`; never shows 100% off a denominator of two. "Never scheduled" is its own row, not an omission from the list. |
| **Goals** | Goals tab, goal form, progress note timeline, status update | "No goals set" is a rendered state with a 30-day alert, not an empty list. |
| **Activities** | Week calendar, activity list, plan drawer with preferences panel, completion recording | Attendance is per-invited-resident three-state: attended / did not attend / **not recorded**. |
| **Consent** | Consent tab, add consent with capacity gate, withdrawal flow, consent dashboard | Capacity gate is mandatory and has no default selection. Withdrawal must show downstream effects before confirming. |
| **Documents** | Resident library (7 categories), organisation library, upload, expiry tracking | An empty category is listed with "No documents"; expiry with no date set is hatched, not treated as "does not expire". |
| **CQC Compliance** | Five Key Question panels, gap drill-down, inspection pack generator, statutory notifications | Where Insufficient Evidence lives. Every panel shows coverage. |
| **Reports** | Report index, 15 report views, filters, export controls | Every figure is an `Aggregate`. Reports over thin data say so at the top, before the table. |
| **Team Management** | Staff list, staff detail, permission matrix, activity log | Deactivated staff remain visible on historic records. |
| **Multi-site** | Site switcher, group overview, per-site drill-down, site settings | Site is always labelled, never inferred. Group figures aggregate coverage, not just values. |

---

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
| 12 | **CQC Compliance** | Five Key Questions, Insufficient Evidence, gap drill-down, inspection pack, statutory notifications | Needs most modules to have data to aggregate |
| 13 | **Reports** | All 15 reports, filters, export | Needs 12 |
| 14 | **Team Management** | Staff list, permissions, activity log | |
| 15 | **Multi-site** | Switcher, group overview, site settings | Last because it re-scopes everything before it |

**Deferred to separate builds:** mobile care-worker application, Family Portal.

---

## 9. Open items

Carried from the source PRD's own open questions plus items raised by this document. None block Phase 0; several block later phases.

1. Remaining ⚠️ values — the three intermediate ink steps (§4.2), type sizes (§4.3), radii and shadows (§4.6). Not blocking; swap into `tokens.css` in one edit once confirmed against a design file.
2. Insufficient Evidence threshold — 60% is my default, needs a real answer before Phase 12.
3. Care worker PIN behaviour on shared devices — affects the MAR confirmation dialog in Phase 3.
4. Whether activity planning is owned by a dedicated Activities Coordinator — affects the Phase 9 permission model.
5. Non-UK regulatory frameworks — out of scope for this build, all compliance UI is CQC-shaped.
6. Pricing model — affects nothing in this build; noted so it is not forgotten.
