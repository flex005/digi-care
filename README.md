# diGi-Care

A **frontend-only prototype** of a care management platform for residential and
nursing homes: resident records, care notes, medication and the MAR chart, risk
assessments, care plans, incidents, consent, documents, CQC compliance and
reports.

It exists to test one idea, which every screen is built around:

> **A blank must never be able to mean either "no" or "nobody has looked yet".**
> In a regulated care record those are opposites.

So every clinical and compliance status is a closed discriminated union with an
explicit unrecorded member, missing evidence renders as a hatched treatment with
words saying what is missing, and no aggregate appears anywhere without its
denominator. The compiler rejects a screen that forgot the unrecorded case.

---

## What this is not

**Do not put this in front of a real home, and do not enter a real resident's
details into it.**

- **No backend.** No server, no database, no API. Every screen reads typed
  fixtures in `src/data/`.
- **No authentication.** There is a sign-in screen and it checks nothing. Any
  password signs you in, no permission is enforced, and every screen is
  reachable by anybody who opens the URL. The screens say so where somebody can
  read it before they type.
- **Nothing persists.** Everything written is held in the browser tab and is
  gone on reload. Signing out destroys it deliberately, and names what it is
  destroying item by item.
- **The data is invented.** People, homes, GP practices and pharmacies are made
  up. NHS numbers use the 999 range NHS Digital reserves for test data,
  telephone numbers use Ofcom's ranges reserved for drama, and every email
  address is `.invalid` or `.example`. None of it can reach or describe a real
  person.
- **Three things are placeholders and are flagged on screen**: the risk
  assessment instruments, the mapping of evidence to CQC Key Questions, and
  several invented thresholds. Each needs a care manager rather than a
  developer. See §9 of the PRD.

---

## Running it

```bash
npm install          # add --legacy-peer-deps if npm objects to the eslint tree
npm run dev          # http://localhost:5173
```

It opens on the sign-in screen, because every route redirects there until
somebody signs in. The email is prefilled — one click on **Sign in** gets you
in as a care worker. Any password works.

```bash
npm run verify       # icons, typecheck, lint scripts, format, tests, layout
npm run test         # tests alone
npm run build        # production build
npm run check:layout # a real browser: nothing clips at the narrowest width
```

No counts here on purpose — a tally of tests or lint scripts in a README is
a number nobody updates and everybody reads.

**For Figma**, point [html.to.design](https://html.to.design) at the running
app. It builds auto-layout from flex and gap and reads type from elements in
normal flow, which is what the app already is.

> **A Figma frame imported from this app is not a picture of the product.**
> Read [docs/FIGMA-HANDOFF.md](docs/FIGMA-HANDOFF.md) before working from one,
> and before showing one to anybody. The importer drops the hatch in both media
> — the SVG pattern *and* the CSS gradient — so every unrecorded value on every
> screen arrives looking settled. "Nobody recorded this" becomes
> indistinguishable from "recorded", which is the one failure this product
> exists to prevent. It cannot be fixed in code.

`npm run icons` regenerates the icon registry and is wired into `predev` and
`prebuild`; it compiles only the icons actually used, out of 3,559 available.

---

## The two documents that explain the reasoning

Neither is a changelog. Both exist because the reasoning is the point.

- **[`docs/FRONTEND_PRD.md`](docs/FRONTEND_PRD.md)** — the specification. What
  each screen is for, the state primitives the Evidence Invariant lives in, the
  design system, the phased build order, and the open items that are blocked on
  a care manager rather than on code.
- **[`PROGRESS.md`](PROGRESS.md)** — what was built, in order, and **why each
  decision went the way it did**. Every defect found, how it was found, and what
  guard now stops it recurring. It is long on purpose: the failures are more
  instructive than the features.

`CLAUDE.md` holds the rules that must never be violated, and a section of
standing checks — each one written down because it caught a real defect more
than once.

---

## Stack

React 19 · TypeScript strict · Vite 8 · React Router 7 · Radix primitives,
hand-authored · plain CSS and CSS Modules over custom properties · Vitest with
Testing Library and axe.

No CSS framework, no component library, no icon library, no chart library, no
state manager. Every chart is hand-authored SVG. Colour reaches a component only
as `var(--token)`, and Stylelint fails the build on a hex literal anywhere but
`src/styles/tokens.css`.

Ten lint scripts run in `npm run lint`. Eight of them are bespoke, and each was
written after a specific defect got through: the hatch having one definition per
medium, telephone links being dialable, plurals having an owner, test selectors
naming what they mean, dates not being widened into instants, em dashes staying
out of the UI, every in-memory store appearing on the sign-out loss list, and
every SVG being geometry that survives leaving the page.
