# Handing off to Figma — read this first

**A Figma frame imported from this app is not a picture of the product.**

The importer drops every form of the unrecorded hatch, in both media. In an
imported frame, *"nobody has recorded this"* renders as a plain settled box —
indistinguishable from a recorded value. That is the exact failure this product
was built to prevent, reproduced at the last step by a tool.

It is not confined to the charts. **It reaches every screen.**

Anything shown to a stakeholder from these frames misrepresents the design in
the one way that matters most: it shows a record that looks complete when it is
not.

---

## What to do

1. **Do not present an imported frame as the product.** Not in a review, not in
   a deck, not as a screenshot. Show the running app, or a screenshot of it.
2. **If frames must be used, redraw the hatching in Figma first**, working from
   the running app rather than from the import. There is no way to tell from
   the frame alone which boxes were hatched.
3. **Treat every plain box in an imported frame as unverified.** It may be a
   recorded value or a gap whose treatment was dropped. The frame cannot tell
   you, and neither can anyone reading it.

## Why this is the worst possible thing for this product to lose

The hatch is not decoration. It is the only treatment in the system that says
*nobody has looked at this yet*, as distinct from *somebody looked and the
answer was no*. In a care record those are opposites, and a blank that could
mean either is the defect the entire product is built around (CLAUDE.md §1, the
Evidence Invariant).

Dropping it does not degrade the design gracefully. It inverts the one claim
the product exists to make. A frame showing a resident with no falls assessment
looks identical to one showing a resident assessed as low risk.

**The Evidence Invariant does not survive this import.**

## One thing that does survive, and its limit

`<Unrecorded>` takes `label` as a **required** prop — by design, so the pattern
can never be the sole carrier of meaning. **That text imports correctly.** An
imported frame still reads "Falls risk — not assessed" in words.

So the record is not silently complete; it is complete *at a glance*, and only
a reader going label by label will find the gaps. That is enough to reconstruct
the truth and nowhere near enough to present from, because nobody reads a frame
that way — and the at-a-glance reading is the entire job the hatch does.

Where the hatch had no label beside it — chart regions, the donut's no-record
arc, ring tracks — there is nothing left at all.

## The technical cause

**html.to.design resolves no referenced SVG definition, and does not render CSS
gradient backgrounds.**

| mechanism | where it is used | result |
| --- | --- | --- |
| `fill="url(#pattern)"` | chart bar caps, legend swatches | dropped — shape arrives unfilled |
| `stroke="url(#pattern)"` | donut arc, ring tracks | dropped — stroke arrives unpainted |
| `clip-path="url(#clip)"` | (the proposed fallback) | dropped — clip ignored, contents lost |
| `repeating-linear-gradient` | **every hatched box in the product** | dropped — arrives plain |

**Everything else imports correctly**: `<path>`, `<circle>`, `<rect>` with
`rx`, solid fills and strokes, colours, text, font weights, and layout —
including flex and CSS grid.

Established by `docs/figma-probe.html`: twelve labelled specimens containing no
app code, imported once. **Specimens 1, 2, 3, 4, 8 and 11 failed. 5, 6, 7, 9,
10 and 12 arrived.**

Not separately established: whether the `1.5px dashed` border on `.unrecorded`
survives when its gradient does not. Do not rely on it either way — a dashed
outline was never sufficient on its own, which is why the treatment is a
pattern plus a label rather than a border.

## What is affected

**Both halves of the hatch, so effectively the whole product.**

The CSS half — `src/styles/unrecorded.module.css`, a `repeating-linear-gradient`
— reaches **49 sites across 19 feature stylesheets**, in six variants (`badge`,
`cell`, `panel`, `row`, `chip`, `flag`), rendered by **84 files across 17
feature modules**: activities, care-plan, compliance, consent, dashboard,
documents, goals, group, handover, incidents, medications, notes, reports,
residents, reviews, risk, team.

Concretely, and not exhaustively: the MAR grid's omitted dose cells; every
never-assessed risk template; not-sought consents; care plan domains never
started; documents with no expiry decision; residents with no care note;
"Insufficient evidence" wherever a figure cannot carry a claim; every
`<Unrecorded>` badge, chip, cell, panel, row and flag anywhere it appears.

The SVG half — `src/features/dashboard/charts.tsx` — is the Dashboard only:
7 bar-gap segments (`[data-bar-segment="gap"]`), the donut's no-record arc
(`[data-arc="no-record"]`), 2 ring tracks (`[data-ring-track="gap"]`), and the
2 legend swatches that explain them.

## Why there is no code change

The obvious fix for the SVG half is to stop referencing a definition: draw the
stripes as ordinary `<rect>`s clipped to the shape. It was costed at **65 added
nodes** for the nine fill uses, and **it does not work** — a
`clip-path="url(#…)"` is the same referenced-definition mechanism, and specimen
8 confirmed the importer drops it too. The fallback would have traded one
dropped reference for another and arrived at the same blank shape, 65 nodes
heavier. The probe is why that cost was one HTML file rather than a build.

There is no fix at all for the CSS half. A `repeating-linear-gradient` is how
the hatch is drawn in every box in the product; replacing it would mean
rendering tens of thousands of striped elements as SVG, in a product where the
hatch appears on nearly every screen.

Changing the app to suit the importer would mean drawing its most load-bearing
visual worse for every real user, in order to serve a handoff step. That trade
is not available.

## The honest options

1. **Do not hand off imported frames as the design.** Use the running app as
   the reference and Figma only for work that does not depend on the hatch.
2. **Redraw the hatching in Figma after every import**, from the running app.
   Manual, repeated, and correct.
3. **Use a different import route** — one that rasterises rather than
   reconstructs, so the hatch arrives as pixels. It loses editability, which is
   the whole point of importing, but it does not lie about the record.

What is not an option is presenting an unmodified imported frame as a picture
of this product.
