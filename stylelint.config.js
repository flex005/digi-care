/**
 * The token rule, enforced mechanically. PRD §3.3, CLAUDE.md §4.
 *
 * No component may contain a raw colour value. Colour reaches a component only
 * as `var(--token)`. `src/styles/tokens.css` is the single exemption and the
 * only file in the repo where a literal may appear.
 *
 * Four rules do the work together, because the PRD's literal instruction — an
 * allowed-list on every colour-bearing property — rejects legitimate shorthands
 * like `border: 1.5px dashed var(--border-unrecorded)`:
 *
 *   1. color-no-hex ................ no hex, anywhere, in any position
 *   2. color-named ................. no `red`, `white`, `black`
 *   3. allowed-list ................ pure colour properties take var(--*) only
 *   4. disallowed-list ............. shorthands reject raw colour functions
 *
 * A fifth closes the type scale (PRD §3.5): font-size, line-height and
 * font-weight are var(--*) only, so a tenth step cannot be introduced locally.
 *
 * Do not disable, weaken, or add exemptions to any of this. CLAUDE.md §4.
 */

/** Properties whose entire value is a colour. */
const COLOUR_PROPERTIES = [
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-block-color',
  'border-inline-color',
  'border-block-start-color',
  'border-block-end-color',
  'border-inline-start-color',
  'border-inline-end-color',
  'outline-color',
  'text-decoration-color',
  'text-emphasis-color',
  'column-rule-color',
  'caret-color',
  'accent-color',
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'lighting-color',
]

/** What a pure colour property is allowed to hold. */
const COLOUR_VALUES = [
  /^var\(--/,
  'transparent',
  'currentColor',
  'inherit',
  'unset',
  'initial',
  'revert',
  'none',
]

/** Shorthands that may carry a colour among other things. */
const COLOUR_SHORTHANDS = [
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-block',
  'border-inline',
  'background',
  'background-image',
  'box-shadow',
  'text-shadow',
  'outline',
  'text-decoration',
  'column-rule',
  'filter',
  'backdrop-filter',
]

/** Raw colour functions. Banned in shorthands; hex and named are caught above. */
const RAW_COLOUR_FUNCTIONS = [
  /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i,
]

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // ---- 1 & 2: no literal colours in any position ----------------------
    'color-no-hex': true,
    'color-named': 'never',

    // ---- 3: pure colour properties take a token, and nothing else -------
    'declaration-property-value-allowed-list': [
      {
        ...Object.fromEntries(COLOUR_PROPERTIES.map((p) => [p, COLOUR_VALUES])),

        // ---- 5: the type scale is closed. PRD §3.5. --------------------
        'font-size': [/^var\(--/, 'inherit'],
        'line-height': [/^var\(--/, 'inherit', 'normal'],
        'font-weight': [/^var\(--/, 'inherit'],
      },
      {
        message: (prop) =>
          `"${prop}" must use a token — var(--token). Colour and type literals live only in src/styles/tokens.css. See CLAUDE.md §4.`,
      },
    ],

    // ---- 4: shorthands reject raw colour functions ----------------------
    'declaration-property-value-disallowed-list': [
      Object.fromEntries(COLOUR_SHORTHANDS.map((p) => [p, RAW_COLOUR_FUNCTIONS])),
      {
        message: (prop) =>
          `"${prop}" contains a raw colour function. Colour reaches a component only as var(--token). See CLAUDE.md §4.`,
      },
    ],

    // ---- house style ----------------------------------------------------
    'custom-property-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      { message: (name) => `Expected custom property "--${name}" to be kebab-case` },
    ],
    // PRD §3.4 and §4.5 both write `currentColor`; keep that casing.
    // `composes` values are CSS Module class names, not CSS keywords.
    'value-keyword-case': [
      'lower',
      { ignoreKeywords: ['currentColor'], ignoreProperties: ['composes'] },
    ],
    // `grid-template` collapses rows/columns/areas into one dense value that
    // is markedly harder to read than the three longhands.
    'declaration-block-no-redundant-longhand-properties': [
      true,
      { ignoreShorthands: ['grid-template'] },
    ],

    // ---- CSS Modules ----------------------------------------------------
    // `composes` is how the unrecorded hatch stays a single definition.
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['global', 'local'] },
    ],
    // CSS Modules class names are camelCase so they survive as JS identifiers.
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: (name) => `Expected class "${name}" to be camelCase` },
    ],
  },

  overrides: [
    {
      // The one exemption in the project. tokens.css is where literals live.
      files: ['src/styles/tokens.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'declaration-property-value-allowed-list': null,
        'declaration-property-value-disallowed-list': null,
        // Values here are carried verbatim from the PRD §4 tables, so that
        // swapping a verified value in later is a literal find-and-replace
        // against the spec rather than a translation.
        'color-function-notation': null,
        'color-function-alias-notation': null,
        'alpha-value-notation': null,
        'color-hex-length': null,
        // Blank lines separate the token groups. In a 200-line token sheet
        // that is the difference between readable and not.
        'custom-property-empty-line-before': null,
      },
    },
  ],
}
