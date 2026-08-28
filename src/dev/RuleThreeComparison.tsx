import { StatusPill, Unrecorded } from '@/components/status'
import styles from './dev.module.css'

/**
 * The single most important panel on this page.
 *
 * Rule 3: "A recorded negative looks settled; an unrecorded value looks
 * unfinished. Users must be able to tell these apart peripherally, without
 * reading." So here they are side by side, at production size. If you can
 * tell each pair apart from the far side of a desk — and with the greyscale
 * toggle on — the rule holds. If you cannot, it does not, and that is a
 * finding regardless of what the rest of the page looks like.
 *
 * The left column is a COMPLETE clinical record. The right column is a hole.
 */

interface PairProps {
  what: string
  recorded: React.ReactNode
  unrecorded: React.ReactNode
}

function Pair({ what, recorded, unrecorded }: PairProps) {
  return (
    <>
      <div className={styles.compareCell}>
        <span className={styles.compareLabel}>{what}: recorded</span>
        <div className={styles.row}>{recorded}</div>
      </div>
      <div className={styles.compareCell}>
        <span className={styles.compareLabel}>{what}: unrecorded</span>
        <div className={styles.row}>{unrecorded}</div>
      </div>
    </>
  )
}

export function RuleThreeComparison() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Rule 3: a recorded negative is not an unrecorded value
      </h2>
      <p className={styles.sectionNote}>
        Every pair below is a complete clinical record on the left and a hole in the
        record on the right. They must never look alike. Turn on greyscale above and
        check they are still distinguishable. On the MAR chart this distinction is
        clinical, not cosmetic.
      </p>
      <p className={styles.sectionNote}>
        The consultants pair is the recorded negative in its second flavour. Green says
        “recorded, complete, and fine”, which a confirmed “no known allergies” genuinely
        claims; blue says “recorded, complete, and neutral”, which is all “nobody is
        involved” claims. Both are settled records with an author. Neither is a gap.
      </p>

      <div className={styles.compare}>
        <Pair
          what="Allergies"
          recorded={
            <StatusPill
              tone="positive"
              label="No known allergies"
              detail="C. Nwosu, 12/03/2026"
            />
          }
          unrecorded={<Unrecorded label="Allergies not recorded" />}
        />

        <Pair
          what="Consultants and specialists"
          recorded={
            <StatusPill
              tone="info"
              label="No consultants or specialists involved"
              detail="T. Akinyemi, 20/08/2026"
            />
          }
          unrecorded={<Unrecorded label="Consultants and specialists not recorded" />}
        />

        <Pair
          what="08:00 Amlodipine 5mg"
          recorded={
            <StatusPill
              tone="caution"
              label="Not given"
              detail="resident refused · C. Nwosu, 08:04"
            />
          }
          unrecorded={
            <Unrecorded label="Omitted" detail="due 08:00 · escalated 09:04" />
          }
        />

        <Pair
          what="Falls risk"
          recorded={
            <StatusPill
              tone="positive"
              label="Falls risk · LOW"
              detail="score 15 · C. Nwosu, 02/07/2026"
            />
          }
          unrecorded={<Unrecorded label="Falls risk not assessed" />}
        />

        <Pair
          what="Resuscitation"
          recorded={
            <StatusPill
              tone="positive"
              label="For resuscitation"
              detail="A. Okonkwo, 16:30"
            />
          }
          unrecorded={<Unrecorded label="No decision recorded" />}
        />

        <Pair
          what="Photography consent"
          recorded={
            <StatusPill
              tone="caution"
              label="Refused"
              detail="06/05/2026 · C. Nwosu · declined for the newsletter"
            />
          }
          unrecorded={<Unrecorded label="Consent not sought" />}
        />

        <Pair
          what="Care plan review"
          recorded={
            <StatusPill
              tone="positive"
              label="Completed"
              detail="31/07/2026 by M. Halloran · next due 31/10/2026"
            />
          }
          unrecorded={<Unrecorded label="Never scheduled" />}
        />
      </div>
    </section>
  )
}
