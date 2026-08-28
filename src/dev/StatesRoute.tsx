import { useState } from 'react'
import { Switch } from '@/components/primitives'
import { RuleThreeComparison } from './RuleThreeComparison'
import { EmphasisLadder } from './EmphasisLadder'
import { StatusStates } from './StatusStates'
import { Phase1States } from './Phase1States'
import { FixtureAudit } from './FixtureAudit'
import { TokenSheet } from './TokenSheet'
import { PrimitiveGallery } from './PrimitiveGallery'
import styles from './dev.module.css'

/**
 * The Status Kitchen Sink, at /dev/states. PRD §6.1.
 *
 * This route is not deleted at the end of Phase 0. It is how the Evidence
 * Invariant is checked visually in every later review: every state of every
 * status primitive, side by side, at production size.
 *
 * The greyscale toggle exists to test one specific claim. Rule 2 says the
 * unrecorded state is carried by pattern rather than hue, and is therefore
 * "distinguishable at a glance, distinguishable in greyscale, and
 * distinguishable to a colour-blind user". That is either true or it is not,
 * and one click settles it. It is a CSS filter on this page only — it touches
 * no token, and it is not theme switching.
 */
export function StatesRoute() {
  const [greyscale, setGreyscale] = useState(false)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Status states</h1>
        <p className={styles.lede}>
          Every state of every status primitive in diGi-Care. A blank must never be able
          to mean either “no” or “nobody has looked yet”. In a regulated care record
          those are opposites. This page is where that holds or fails, and it is checked
          at the end of every phase, not just this one.
        </p>
      </header>

      <div className={styles.controls}>
        <Switch
          label="Greyscale: proves the unrecorded state survives without hue"
          checked={greyscale}
          onCheckedChange={setGreyscale}
        />
      </div>

      <div className={greyscale ? styles.greyscale : undefined}>
        <div className={styles.page}>
          <FixtureAudit />
          <RuleThreeComparison />
          <EmphasisLadder />
          <StatusStates />
          <Phase1States />
          <PrimitiveGallery />
          <TokenSheet />
        </div>
      </div>
    </div>
  )
}
