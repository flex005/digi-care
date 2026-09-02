# Handing off to Figma — read this first

**The importer drops the Dashboard's chart hatching.** Bar gaps, the donut's
no-record arc and the ring tracks arrive as blank shapes, so on those charts
*"nobody recorded this"* looks like a recorded value — the one failure this
product exists to prevent, reproduced by a tool.

**Everywhere else the hatch imports correctly.** The CSS hatch — every
`<Unrecorded>` badge, chip, cell, panel, row and flag, the MAR grid's omitted
doses, never-assessed risks, not-sought consents — arrives with its stripes.

So an imported frame is usable, with one specific hole in it. This page says
where the hole is.

---

## What to do

1. **Redraw the hatching on the Dashboard charts in Figma**, from the running
   app. Nothing else needs touching.
2. **Treat a plain fill inside a chart as unverified.** Outside the charts, a
   plain box is genuinely a plain box.
3. **Do not present the Dashboard charts from an imported frame** without that
   redraw. The bar gaps and the donut's no-record share are precisely the parts
   that go missing, and they are the parts a reader looks at.

## Why it matters where it does

The hatch is not decoration. It is the only treatment in the system that says
*nobody has looked at this yet*, as distinct from *somebody looked and the
answer was no*. In a care record those are opposites (CLAUDE.md §1).

On the Dashboard, the hatched regions carry doses due and not recorded, and the
share of today's doses whose window closed with nothing written. Losing the
treatment there does not degrade the chart — it inverts it. A day with
forty unrecorded doses draws the same as a day with none.

## The technical cause

**html.to.design does not resolve referenced SVG definitions.** Anything
addressed as `url(#…)` is dropped.

| mechanism | where | result |
| --- | --- | --- |
| `fill="url(#pattern)"` | bar gap caps, legend swatches | dropped — arrives unfilled |
| `stroke="url(#pattern)"` | donut arc, ring tracks | dropped — arrives unpainted |
| `clip-path="url(#clip)"` | (the proposed fallback) | dropped — clip ignored |
| `repeating-linear-gradient` | every hatched box outside the charts | **imports correctly** |

Everything else imports: `<path>`, `<circle>`, `<rect>` with `rx`, solid fills
and strokes, colours, text, font weights, and layout including flex and grid.

Established by `docs/figma-probe.html` — twelve labelled specimens containing
no app code. **Specimens 1, 2, 3, 4 and 8 failed. 5, 6, 7, 9, 10, 11 and 12
arrived.**

### This is tested, not inferred

It was inferred for a while, and the inference was checked. The app's chart
`<svg>` elements carry no `xmlns`; re-parsed on their own their root
`namespaceURI` is `null`, so they stop being SVG — and the probe, written the
same way, shared that defect. That left an alternative reading: not that the
importer drops references, but that *namespace-less markup* loses them.

**Specimens 13 and 14 settled it.** They are 1 and 8 with `xmlns` added and
nothing else changed. They arrived blank as well. The namespace was not the
cause, and the diagnosis now stands on an experiment rather than a reading.

Specimen 14 also kills the `clipPath` fallback a second time, independently.

## What is affected

Dashboard only:

| element | selector | what it says |
| --- | --- | --- |
| 7 bar-gap segments | `[data-bar-segment="gap"]` | doses due and not recorded, per day |
| donut arc | `[data-arc="no-record"]` | doses whose window closed with no record |
| 2 ring tracks | `[data-ring-track="gap"]` | rounds with doses still unrecorded |
| 2 legend swatches | chart legend, donut key | the key explaining the above |

## Why there is no fix yet

The stripe fallback — drawing the hatch as `<rect>`s clipped to the shape — was
costed at 65 added nodes and **is dead**: a `clip-path="url(#…)"` is the same
dropped mechanism, confirmed by specimen 8 and again by specimen 14 with a
namespace.

Using the CSS hatch instead is being costed. It is viable for the bars and the
swatches and **not for the donut arc or the ring tracks**, because a
`repeating-linear-gradient` is linear and cannot follow a curved band. Any
partial fix therefore recovers the bars and leaves the donut, and that has to
be stated rather than discovered.

## This page has been wrong twice

Both directions, before it was right:

1. **First it was inferred.** The scope was written as chart-only from the
   probe, without asking whether specimen 11 had arrived.
2. **Then it was "corrected" to product-wide** on a misreading of a report,
   which was worse — a confident, specific, wrong claim in five files, and the
   specificity made it more trusted rather than less.
3. **Now it is chart-only again**, from a direct observation: the "Not written
   up today" tile imports with its stripes intact.

**State what was observed, name what was inferred, and let the inferred parts
stay visibly unsettled** — then go and test them. The `xmlns` hypothesis sat on
this page as an open question for exactly one round, and specimens 13 and 14
closed it. Nothing on this page is inferred now.
