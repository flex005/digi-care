# Handing off to Figma — read this first

**The importer drops the hatch. In an imported frame, "nobody recorded this"
looks exactly like "recorded".**

That is the one failure this product exists to prevent, reproduced at the last
step by a tool. Everything else about the import is sound. This page exists so
nobody works from a Figma frame believing the absence of a hatch means the
record is complete.

---

## What to do

1. **Treat every plain or solid fill in a chart as unverified.** It may be a
   recorded value, or it may be a gap whose treatment was dropped in transit.
   The frame cannot tell you which.
2. **Redraw the hatching in Figma**, against the running app rather than
   against the imported frame. The list of affected elements is below.
3. **Never take a screenshot of an imported frame as a picture of the
   product.** It understates what is missing from the record, which is the
   specific direction of error this build treats as unacceptable.

## Why it matters more than it looks

The hatch is not decoration. It is the only treatment in the product that says
*nobody has looked at this yet*, as distinct from *somebody looked and the
answer was no*. Those are opposites in a care record: a blank that could mean
either is the defect the whole product is built around (CLAUDE.md §1).

When the hatch is dropped, a hatched region imports as an empty or solid shape
— visually identical to a recorded value. The reader of that frame is shown a
complete-looking record with no way to tell that anything is missing. A
designer working from it will reproduce the wrong thing, and reasonably.

## The technical cause

**html.to.design does not resolve referenced SVG definitions.** Anything
addressed as `url(#…)` is dropped:

| mechanism | result |
| --- | --- |
| `fill="url(#pattern)"` | dropped — shape arrives unfilled |
| `stroke="url(#pattern)"` | dropped — stroke arrives unpainted |
| `clip-path="url(#clip)"` | dropped — clip ignored, contents lost |

**Everything else imports correctly**: `<path>`, `<circle>`, `<rect>` with
`rx`, solid fills and strokes, colours, text, font weights, and layout —
including flex and CSS grid.

Established by `docs/figma-probe.html`, twelve labelled specimens with no app
code in them, imported once. Specimens 1–4 and 8 failed; 5, 6, 7, 9, 10, 11 and
12 arrived.

## What is affected, precisely

Everything below is on the **Dashboard**; it is the only screen drawing the
hatch as SVG.

| element | selector in the DOM | what it says |
| --- | --- | --- |
| 7 bar-gap segments | `[data-bar-segment="gap"]` | doses due and not recorded, per day |
| donut arc | `[data-arc="no-record"]` | doses whose window closed with no record |
| 2 ring tracks | `[data-ring-track="gap"]` | rounds with doses still unrecorded |
| 2 legend swatches | in the chart legend and the donut key | the key explaining the above |

**The rest of the product's hatching is CSS** — a `repeating-linear-gradient`
in `src/styles/unrecorded.module.css` — and specimen 11 confirmed it imports.
Hatched cells, chips, panels and badges outside the charts are not affected.

## Why there is no code change

The obvious fix is to stop referencing a definition: draw the stripes as
ordinary `<rect>`s clipped to the shape. It was costed at **65 added nodes**
for the nine fill uses.

**It does not work, and the probe is why we know before building it.** A
`clip-path="url(#…)"` is the same referenced-definition mechanism as a pattern
fill, and specimen 8 confirmed the importer drops it too. The fallback would
have traded one dropped reference for another and arrived at the same blank
shape, 65 nodes heavier.

Drawing stripes without a clip is not available either: the bar caps have
rounded top corners (`BAR_RADIUS`), and unclipped stripes would overrun them.

The three stroke uses are worse again — a hatched arc is stripes along a curved
band, which means abandoning the stroke for computed filled geometry. That was
never reached, because the fills failed first.

## The honest options

1. **Redraw the hatch in Figma after import.** Manual, repeated every import,
   and correct.
2. **Accept solid fills in the design file** and rely on this page being read.
   Cheaper and more fragile — it depends on everyone who opens the frames
   knowing what is missing from them.

There is no third option that lives in the codebase. Changing the app to suit
the importer would mean drawing the product's most load-bearing visual in a
worse way for every real user, to serve a handoff step.
