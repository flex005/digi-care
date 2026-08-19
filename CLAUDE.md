# CLAUDE.md — diGi-Care

Rules that hold in every session. Read `FRONTEND_PRD.md` for the full spec; this file is the short list that must never be violated, whatever the task looks like.

**Project:** diGi-Care — care management platform, desktop manager app, frontend only. No backend, no API, no auth. All data from typed fixtures in `src/data/`.

**Stack:** Vite 8 · React 19 · TypeScript strict · React Router 7 (data router API) · Radix primitives (hand-authored) · plain CSS + CSS Modules over custom properties · `vite-plugin-svgr`.

---

## 1. The Evidence Invariant — the rule this product exists to protect

**A blank must never be able to mean either "no" or "nobody has looked yet".** In a regulated care record those are opposites. Everything below follows from that.

- **No clinical or compliance status is optional.** Every one is a closed discriminated union with an explicit unrecorded member. No `status?:`, no `| null`, no `| undefined`, no default parameter standing in for a missing record. The compiler must reject a screen that forgot the unrecorded case.
- **Unrecorded gets the hatched treatment** (`--status-unrecorded`, dashed border, diagonal hatch) plus visible text saying what is missing. Never empty space. Never a solid neutral fill. Never a RAG colour.
- **A compound state renders as separate facts.** Given-but-no-second-signature is a green "Given" pill *and* a hatched "Second signature not recorded" — two facts, two treatments. Never merged into one pill with the gap in small print.
- **A recorded negative is not an unrecorded value.** "Not Given — resident refused — signed 08:04" is a complete record and looks settled. An omission looks unfinished. Never the same treatment.
- **Every aggregate carries its denominator.** No bare counts, no bare percentages, anywhere. Use the `Aggregate` type. Where coverage is too thin to support a claim, render **Insufficient Evidence** — which is not a milder Red, it is the absence of a finding.
- **Absence from a list is the same bug as a blank cell.** All ten risk assessment templates are listed even if none is completed. All eight consent types. All care plan domains.

If you find yourself writing a fallback like `?? 'Low risk'`, `|| 'None'`, `?? 0`, or `?? '—'` for anything clinical or compliance-related, stop. That fallback is the bug this product is being built to prevent.

## 2. Wrong-subject writes

- Every write surface carries a persistent, non-collapsing subject header: resident photo, name, preferred name, room, DOB.
- Subject identity comes from the route parameter. Never from navigation history, "last viewed", or component state.
- Confirmation dialogs name the subject in the sentence. "Record 08:00 medications for Emmanuel Okafor?" — never "Are you sure?".
- Active site name is always visible in the header, including for single-site users.

## 3. Icons

- **No icon library. Ever.** Do not install `lucide-react`, `react-icons`, `@heroicons`, or any equivalent, for any reason, including "just for this one icon".
- Icons come from the Aligned Line Icons set in `src/assets/icons/<CATEGORY>/` (3,559 SVGs, ~40 category folders). Never hand-edit those files.
- **Names are namespaced by category** because filenames repeat across folders: `<Icon name="add-remove-delete/add-01" />`, not `<Icon name="add-01" />`.
- Build step normalises used icons to `currentColor` so they take colour from CSS, then SVGR compiles them.
- `npm run icons` generates both `registry.names.generated.ts` (full name union, types only) and `registry.generated.ts` (import map of **only the icons actually used**, found by scanning source). Importing all 3,559 would bloat the bundle.
- **Never hand-type, hand-edit, or hand-extend either generated file.** A name not present in the folder fails the build.
- Re-run `npm run icons` after using a new icon name. It is wired into `predev`/`prebuild`.
- One `<Icon name="..." />` component. No raw `<svg>` in feature code, no direct imports from `src/assets/icons`.
- If a needed icon is not in the folder: **stop and ask.** Do not substitute an inline SVG, an emoji, a character glyph, or a similar-looking icon.

## 4. Colour and type

- **Colour only from tokens.** No hex, `rgb()`, `hsl()`, or named colours in any component. Colour reaches a component only as `var(--token)`. `src/styles/tokens.css` is the single exception and the only place a literal may appear.
- Stylelint enforces this and must stay in CI and pre-commit. Do not disable, weaken, or add exceptions to that rule.
- **Each status has a bright fill token and a darker ink token.** `--status-X` is for fills, dots, bars, borders and icons. `--status-X-ink` is for text on a tint. Using the fill token for text fails contrast and is a review blocker.
- **The type scale is closed.** Nine steps, five weights, all in `tokens.css`. No component introduces a size, line height or weight outside it. A tenth step is a conversation, not a local override.
- No dark mode. One palette. Do not add theme switching, `prefers-color-scheme`, or a `.dark` class.
- Spacing is the 4px scale only. No off-scale values.

## 5. Primitives

- **Do not run the shadcn CLI.** It installs `lucide-react` and overwrites the stylesheet with its own tokens — both break rules above. This is known; it does not need rediscovering.
- Primitives are hand-authored in `src/components/primitives/`, thin wrappers over Radix, styled to our tokens from the first line.
- Reading shadcn source as a reference for Radix composition is fine. Copying its stylesheet, token names, or dependencies is not.

## 6. Conventions

- British English in code and UI copy. `Organisation`, `Authorised`, `Finalise`.
- Dates `DD/MM/YYYY`, times 24-hour. Relative time only alongside an absolute timestamp, never instead of it.
- **Clinical timestamps render in the site's timezone, never the viewer's.** Show the zone label where ambiguous. Relative time is the exception — it is about now, not the record.
- Every clinical record shows its author and timestamp. Always visible, never hover-only.
- Care notes are immutable after submission. There is no edit control. Corrections create a new linked note.
- No `any`. No `@ts-expect-error` without a comment naming what removes it.
- No `localStorage` / `sessionStorage` for record data. In-memory only.
- No placeholder or lorem text. No `console.log`. No commented-out code.
- Fixtures stay messy on purpose — missing assessments, omissions, thin sites. Do not "clean up" fixture data to make a screen look better. The gaps are the test.

## 7. Accessibility

- WCAG 2.2 AA. Colour never the sole carrier of meaning. Visible focus ring, never removed.
- The MAR grid is a real `<table>` with header associations and full-sentence accessible names per cell.
- Icons are `aria-hidden` unless labelled. Icon-only controls need a visible adjacent label or an `aria-label` plus tooltip.

## 8. Stop and ask

Ask before doing anything expensive to reverse. Frank is a product manager, not a developer — a wrong assumption costs him a rebuild, not a quick undo. Stop and ask before:

- Installing any dependency not already in `package.json`.
- Adding, renaming or removing a design token, or introducing a colour or type step.
- Changing the shape of a fixture type, especially a status union.
- Restructuring folders, routing, or the app shell.
- Changing anything in `FRONTEND_PRD.md` or this file.
- Deleting or rewriting existing working code to accommodate new code.
- Any workaround that would relax a rule in this file "temporarily".

When something in the spec is ambiguous or looks wrong, say so and wait. Do not pick the interpretation that is easiest to build.

## 9. Working cadence

- Build **one phase at a time**, in the order in `FRONTEND_PRD.md` §8. Stop at the end of each phase for review.
- In Phase 1, stop after **each screen**. From Phase 2, a full module per review is fine unless problems appear.
- Before starting a phase, restate what you are about to build and wait for approval.
- **Reports in chat are short**: what to look at, and anything needing a decision. Nothing else.
- **Bugs, reasoning, decisions, and anything discovered go in `PROGRESS.md`** — never in the chat reply. Append, do not rewrite history.
- Every screen is reviewed against all seven states before it is called done: Loading · Empty · Partial · Populated · Stale · Error · Read-only.
