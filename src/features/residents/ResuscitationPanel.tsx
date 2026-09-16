import type { ResuscitationStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { ClinicalChangeControl } from './ClinicalChangeControl'
import styles from './profile.module.css'
import { staffLabel } from '@/data/access/team-store'

/**
 * The resuscitation decision, as a full-width panel rather than one row of
 * eight — the Future Plans counterpart of the allergies panel, and for the
 * same reason.
 *
 * PRD §2.1: "For DNAR the same ambiguity is catastrophic in both directions."
 * A missing badge must never read as "for resuscitation", and it must never
 * read as "DNAR". So there are three states and the third is rendered loudly:
 *
 *   DNAR in place        brand purple — a recorded clinical decision
 *   For resuscitation    green — recorded, and CPR is to be attempted
 *   No decision recorded hatched — nobody has asked, and CPR is the default
 *
 * DNAR is brand rather than red or green because it is neither good news nor
 * bad news; colouring a signed legal document would editorialise it, and a
 * care worker who hesitates over red loses the seconds the decision exists to
 * save. PRD §6.2.
 *
 * The hatched state says what happens in the absence of a decision, because
 * that is the part a reader cannot infer: CPR is attempted by default, so an
 * unrecorded decision is not a neutral gap — it is an active outcome nobody
 * chose.
 */
export function ResuscitationPanel({
  status,
  residentName,
  siteName,
}: {
  status: ResuscitationStatus
  residentName: string
  siteName: string
}) {
  const format = useSiteFormat()

  const control = (
    <ClinicalChangeControl
      residentName={residentName}
      siteName={siteName}
      buttonLabel={
        status.kind === 'no_decision_recorded'
          ? 'Record resuscitation decision'
          : 'Change resuscitation decision'
      }
      action={
        status.kind === 'no_decision_recorded'
          ? 'Record a resuscitation decision'
          : 'Change the resuscitation decision'
      }
      description={DESCRIPTIONS[status.kind]}
      confirmLabel={
        status.kind === 'no_decision_recorded' ? 'Record decision' : 'Change decision'
      }
      destructive={status.kind !== 'no_decision_recorded'}
    />
  )

  switch (status.kind) {
    case 'no_decision_recorded':
      return (
        <div className={styles.bannerSlot} data-resuscitation="no_decision_recorded">
          <Unrecorded
            variant="panel"
            caption="Resuscitation"
            label="No decision recorded"
            detail={`Nobody has recorded whether CPR should be attempted for ${residentName}; in the absence of a decision CPR is attempted.`}
          />
          <div className={styles.bannerActions}>{control}</div>
        </div>
      )

    case 'dnar_in_place':
      return (
        <div className={styles.bannerSlot} data-resuscitation="dnar_in_place">
          <div className={`${styles.banner} ${styles.bannerBrand}`}>
            <p className={styles.bannerCaption}>Resuscitation</p>
            <p className={styles.bannerHeadline}>DNAR in place</p>
            <p className={styles.bannerDetail}>
              Do not attempt cardiopulmonary resuscitation. This is a signed clinical
              decision and applies wherever {residentName} is.
            </p>
            <p className={styles.attribution}>
              Signed by {status.signedBy},{' '}
              <span data-numeric>{formatDate(status.signedOn)}</span>
            </p>
            {control}
          </div>
        </div>
      )

    case 'for_resuscitation':
      return (
        <div className={styles.bannerSlot} data-resuscitation="for_resuscitation">
          <div className={`${styles.banner} ${styles.bannerSettled}`}>
            <p className={styles.bannerCaption}>Resuscitation</p>
            <p className={styles.bannerHeadline}>For resuscitation</p>
            <p className={styles.bannerDetail}>CPR is to be attempted.</p>
            <p className={styles.attribution}>
              Recorded by {staffLabel(status.recordedBy)},{' '}
              <span data-numeric>{format.instantDate(status.recordedAt)}</span>
            </p>
            {control}
          </div>
        </div>
      )

    default:
      return assertNever(status)
  }
}

const DESCRIPTIONS: Record<ResuscitationStatus['kind'], string> = {
  dnar_in_place:
    'Changing it overrides a signed clinical decision about whether CPR is attempted.',
  for_resuscitation: 'Changing it alters whether CPR is attempted.',
  no_decision_recorded: 'Recording one changes what staff do in an emergency.',
}
