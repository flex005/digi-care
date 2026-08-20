import styles from './dev.module.css'

/**
 * The token sheet. Every colour, type step, spacing step, radius and shadow
 * in the system, rendered from the tokens themselves.
 *
 * No literal values appear here — the swatches read `var(--token)`, so this
 * page cannot drift from tokens.css, and the file stays compliant with the
 * rule it exists to document. The values themselves live in
 * src/styles/tokens.css, which is the only place they may.
 *
 * **The contrast figures below are hand-measured constants, not computed.**
 * They were checked against the palette by hand and typed in; nothing on this
 * page recalculates them, so a token edit changes the swatch and leaves the
 * ratio beside it saying whatever it said before.
 *
 * This comment previously read "measured, not asserted … what the palette
 * actually computes to", which described a page that has never existed. Last
 * verified by hand 20/08/2026. Computing them from getComputedStyle would make
 * the sentence true and self-maintaining — see PROGRESS.md, it is an open
 * decision.
 */

const BRAND = [
  '--purple-900',
  '--purple-600',
  '--purple-400',
  '--purple-200',
  '--purple-50',
]
const SURFACES = ['--bg-page', '--bg-surface', '--bg-surface-sunken']
const INKS = ['--ink-900', '--ink-700', '--ink-500', '--ink-400']
const BORDERS = ['--border-strong', '--border-subtle', '--border-unrecorded']

interface StatusRow {
  name: string
  fill: string
  ink: string
  tint: string
  inkOnTint: string
  inkOnWhite: string
}

const STATUS_ROWS: StatusRow[] = [
  {
    name: 'positive',
    fill: '--status-positive',
    ink: '--status-positive-ink',
    tint: '--status-positive-tint',
    inkOnTint: '4.99',
    inkOnWhite: '5.40',
  },
  {
    name: 'caution',
    fill: '--status-caution',
    ink: '--status-caution-ink',
    tint: '--status-caution-tint',
    inkOnTint: '4.88',
    inkOnWhite: '5.49',
  },
  {
    name: 'critical',
    fill: '--status-critical',
    ink: '--status-critical-ink',
    tint: '--status-critical-tint',
    inkOnTint: '5.81',
    inkOnWhite: '6.48',
  },
  {
    name: 'info',
    fill: '--status-info',
    ink: '--status-info-ink',
    tint: '--status-info-tint',
    inkOnTint: '7.32',
    inkOnWhite: '8.21',
  },
  {
    name: 'unrecorded',
    fill: '--status-unrecorded',
    ink: '--status-unrecorded-ink',
    tint: '--status-unrecorded-tint',
    inkOnTint: '6.32',
    inkOnWhite: '7.10',
  },
]

const TYPE_STEPS = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'body-sm',
  'caption',
  'micro',
  'mono-num',
]

const WEIGHTS = ['regular', 'medium', 'semibold', 'bold', 'extrabold']
const SPACES = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
const RADII = ['sm', 'md', 'lg', 'xl', 'pill']

function Swatch({ token, meta }: { token: string; meta?: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchChip} style={{ backgroundColor: `var(${token})` }} />
      <span className={styles.swatchName}>{token}</span>
      {meta ? <span className={styles.swatchMeta}>{meta}</span> : null}
    </div>
  )
}

export function TokenSheet() {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Colour tokens</h2>
        <p className={styles.sectionNote}>
          Values live only in <code>src/styles/tokens.css</code>. Every swatch here
          reads <code>var(--token)</code>, which is also the only way colour reaches any
          component in the project — stylelint rejects a hex, an <code>rgb()</code> or a
          named colour anywhere else.
        </p>

        <div className={styles.group}>
          <span className={styles.groupTitle}>Brand</span>
          <div className={styles.swatches}>
            {BRAND.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.groupTitle}>Surfaces</span>
          <div className={styles.swatches}>
            {SURFACES.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.groupTitle}>Ink</span>
          <div className={styles.swatches}>
            {INKS.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.groupTitle}>Borders</span>
          <div className={styles.swatches}>
            {BORDERS.map((token) => (
              <Swatch
                key={token}
                token={token}
                meta={
                  token === '--border-unrecorded'
                    ? '2.20:1 on its tint — below the 3:1 in PRD §7'
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Status palette — fill, ink, tint</h2>
        <p className={styles.sectionNote}>
          Each status carries three tokens because one value cannot do both jobs.{' '}
          <code>--status-X</code> is for fills, dots, bars, borders and icons.{' '}
          <code>--status-X-ink</code> is for text on the tint. Using the fill token for
          text fails contrast and is a review blocker. Ratios below are measured against
          this palette.
        </p>
        {STATUS_ROWS.map((row) => (
          <div key={row.name} className={styles.group}>
            <span className={styles.groupTitle}>{row.name}</span>
            <div className={styles.swatches}>
              <Swatch token={row.fill} meta="fills · dots · borders · icons" />
              <Swatch
                token={row.ink}
                meta={`text — ${row.inkOnTint}:1 on tint · ${row.inkOnWhite}:1 on white`}
              />
              <Swatch token={row.tint} meta="tint background" />
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Type scale — nine steps, five weights</h2>
        <p className={styles.sectionNote}>
          The scale is closed. Stylelint rejects any <code>font-size</code>,{' '}
          <code>line-height</code> or <code>font-weight</code> that is not a{' '}
          <code>var(--token)</code>, so a tenth step cannot be introduced locally — it
          is a change to tokens.css and a conversation.
        </p>
        {TYPE_STEPS.map((step) => (
          <div key={step} className={styles.typeRow}>
            <span className={styles.typeToken}>--text-{step}</span>
            <span
              style={{
                fontSize: `var(--text-${step}-size)`,
                lineHeight: `var(--text-${step}-line)`,
                fontVariantNumeric: step === 'mono-num' ? 'tabular-nums' : undefined,
              }}
            >
              {step === 'mono-num'
                ? '08:04 · 1,024mg · 46 of 50'
                : 'Emmanuel Okafor — Room 14'}
            </span>
          </div>
        ))}
        <div className={styles.group}>
          <span className={styles.groupTitle}>Weights</span>
          <div className={styles.row}>
            {WEIGHTS.map((weight) => (
              <span key={weight} style={{ fontWeight: `var(--weight-${weight})` }}>
                {weight}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Spacing, radii, elevation</h2>
        <p className={styles.sectionNote}>
          4px scale, nothing off-scale. Tokens are named by value so an off-scale step
          is obvious on sight.
        </p>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Spacing</span>
          {SPACES.map((space) => (
            <div key={space} className={styles.spacingRow}>
              <span className={styles.typeToken}>--space-{space}</span>
              <span
                className={styles.spacingBar}
                style={{ width: `var(--space-${space})` }}
              />
            </div>
          ))}
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Radii</span>
          <div className={styles.row}>
            {RADII.map((radius) => (
              <span
                key={radius}
                className={styles.radiusChip}
                style={{ borderRadius: `var(--radius-${radius})` }}
              >
                {radius}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Elevation</span>
          <div className={styles.row}>
            <span
              className={styles.shadowChip}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              --shadow-card
            </span>
            <span
              className={styles.shadowChip}
              style={{ boxShadow: 'var(--shadow-overlay)' }}
            >
              --shadow-overlay
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
