# Manrope, subset and self-hosted

Five static weights, committed as binaries. **They are here rather than pulled
from a package because the packaged ones lie about their own identity.**

## Why these files exist

`@fontsource/manrope@5.3.0` ships `.woff2` files whose internal name table says
**`Manrope ExtraLight`** — `Manrope ExtraLight SemiBold`, `Manrope ExtraLight
Medium`, and so on — while its `.woff` files of the same weights are named
correctly. The outlines and `usWeightClass` are right, so the screen renders
correctly and the weights measure distinctly; only the *name* is wrong. Every
tool that reads a font's name rather than its outlines — Font Ninja, Figma
importers, anything cataloguing what a page uses — reports ExtraLight.

It is not @fontsource's mistake alone. The variable font Google ships,
`ofl/manrope/Manrope[wght].ttf`, declares `family(1) = "Manrope ExtraLight"`
with `usWeightClass 200` and a `wght` axis defaulting to 200, because name IDs
1 and 2 describe a variable font's *default instance*. Anyone instancing
statics from it inherits that name.

## Provenance

- **Source**: https://github.com/aaronbell/manrope — `fonts/webfonts/`,
  commit `6f81ebecdf65e4463b798cc07b16a4f8d5216917` (2021-07-22). This is the
  upstream `google/fonts` records for Manrope; the original `sharanda/manrope`
  is deleted.
- **Subset with**: fontTools 4.60.2 (`pyftsubset`), run once, not at build time.

```
pyftsubset Manrope-<Style>.woff2 \
  --output-file=Manrope-<Style>.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga,clig,calt,ccmp,locl,mark,mkmk,tnum' \
  --unicodes='<latin>,<latin-ext>' \
  --name-IDs='*' --name-legacy --name-languages='*' \
  --no-hinting --desubroutinize
```

`--name-IDs='*'` is load-bearing: `pyftsubset` drops most name records by
default, and the names are the entire reason these files exist. `tnum` is kept
because `--text-mono-num` is Manrope with tabular numerals.

The `<latin>` and `<latin-ext>` ranges are the two in `tokens.css`, which are
Google's own subset definitions. Cyrillic, Greek and Vietnamese are dropped —
nothing in this build reaches them.

## Re-verify before trusting a replacement

Subsetters rewrite name tables, so the check belongs on the *output*, not the
input. Every file must report:

| file | `family(1)` | `subfamily(2)` | `postScript(6)` | `usWeightClass` |
| --- | --- | --- | --- | --- |
| Regular | `Manrope` | Regular | `Manrope-Regular` | 400 |
| Medium | `Manrope Medium` | Regular | `Manrope-Medium` | 500 |
| SemiBold | `Manrope SemiBold` | Regular | `Manrope-SemiBold` | 600 |
| Bold | `Manrope` | Bold | `Manrope-Bold` | 700 |
| ExtraBold | `Manrope ExtraBold` | Regular | `Manrope-ExtraBold` | 800 |

No file may contain `ExtraLight` in any name record, and none may carry an
`fvar` table. If a future file fails that, it is the ExtraLight bug again.
