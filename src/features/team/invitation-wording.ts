import type { IsoDate, IsoDateTime } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import type { InvitationStanding } from '@/data/fixtures/invitations'
import { useSession } from '@/app/session/use-session'
import { formatDate, zonedDate } from '@/lib/format'

/**
 * Whether somebody never given access can still accept their invitation.
 *
 * **A second fact beside the gap, never folded into it.** "Never given access"
 * says the team record has nobody set up; whether the invitation that would set
 * them up is still open is a different fact, and the one an admin acts on. At a
 * seven-day lifetime most unaccepted invitations were open and the difference
 * could be left unsaid. At 72 hours most have expired, so the gap alone reads
 * wrong most of the time.
 *
 * Expired takes the caution tint and ink, with the words: it is a finding,
 * somebody has to send another, and it is a recorded state rather than a gap.
 * Open is quiet.
 */
export function invitationSentence(standing: InvitationStanding): string {
  return standing.kind === 'expired'
    ? `Invitation expired ${formatDate(standing.expiredOn)}: it cannot be accepted`
    : `Invitation open until the end of ${formatDate(standing.expiresOn)}`
}

/** The home's day, not the viewer's: an invitation lapses by the home's calendar. */
export function useHomeToday(): IsoDate {
  const { activeSite } = useSession()
  return zonedDate(appNow().toISOString() as IsoDateTime, activeSite.timeZone)
}
