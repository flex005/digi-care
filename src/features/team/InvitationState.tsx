import type { IsoDate } from '@/data/types'
import { invitationStandingOn } from '@/data/fixtures/invitations'
import { invitationSentence, useHomeToday } from './invitation-wording'
import styles from './team.module.css'

/** The invitation fact beside a never-given-access gap. See invitation-wording.ts. */
export function InvitationState({ invitedOn }: { invitedOn: IsoDate }) {
  const today = useHomeToday()
  const standing = invitationStandingOn(invitedOn, today)
  return (
    <span
      className={
        standing.kind === 'expired' ? styles.invitationExpired : styles.invitationOpen
      }
      data-invitation={standing.kind}
    >
      {invitationSentence(standing)}
    </span>
  )
}
