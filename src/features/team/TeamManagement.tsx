import { useState } from 'react'
import type { StaffMember, StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Button, Dialog } from '@/components/primitives'
import { formatCount } from '@/lib/format'
import { addMember } from '@/data/access/team-store'
import styles from './team.module.css'

/**
 * Team administration. PRD §6.7, Phase 14.
 *
 * **Adding somebody and giving them access are two acts, not one.** A person
 * arrives on the list with `never_given_access`, which carries who put them
 * there and when, and it takes the hatch: somebody on the team nobody has set
 * up is a gap a manager can close, not a quiet default that reads as done.
 */

/** How many of the team are in each standing. Every member, every time. */
export function standingCounts(members: StaffMember[]) {
  const counts = {
    has_access: 0,
    suspended: 0,
    no_longer_has_access: 0,
    never_given_access: 0,
  }
  for (const member of members) counts[member.standing.kind] += 1
  return counts
}

/**
 * One figure with its denominator.
 *
 * Four tones and **none of them is green**: having access is unremarkable
 * rather than good, and a team where everybody is set up has not achieved
 * anything, it is simply the ordinary state.
 */
export function Tally({
  label,
  value,
  of,
  tone = 'plain',
}: {
  label: string
  value: number
  /** The denominator. Never absent. */
  of: string
  tone?: 'plain' | 'caution' | 'gap'
}) {
  const className =
    tone === 'gap'
      ? styles.tallyGap
      : tone === 'caution'
        ? styles.tallyCaution
        : styles.tally

  return (
    <div
      className={className}
      data-tally={label}
      {...(tone === 'gap' ? { 'data-state': 'unrecorded' } : {})}
    >
      <p className={styles.tallyLabel}>{label}</p>
      <p className={styles.tallyFigure}>
        <span className={styles.tallyValue} data-numeric>
          {formatCount(value)}
        </span>
        <span className={styles.tallyOf}>{of}</span>
      </p>
    </div>
  )
}

const ROLES = Object.keys(STAFF_ROLE_NAMES) as StaffRole[]

/**
 * Put somebody on the team.
 *
 * Name, role and site, and nothing else. The minimum is deliberate: a field
 * nobody has asked for is a field nobody has decided how to protect, and
 * inventing an employment record is how a care system starts holding HR data
 * it was not built to hold.
 */
export function AddMemberDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const { currentUser, activeSite, sites } = useSession()
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<StaffRole>('care_worker')
  const [siteId, setSiteId] = useState(activeSite.id)

  const ready = fullName.trim().split(/\s+/).filter(Boolean).length >= 2

  const submit = () => {
    if (!ready) return
    addMember({ fullName, role, siteId, addedBy: currentUser })
    setFullName('')
    onAdded()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Add somebody to the team"
      description="They go on the list with no access. Granting it is a second act, by a named person, and the list says so until somebody does it."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready} data-confirm-add>
            Add to the team
          </Button>
        </>
      }
    >
      <div className={styles.formFields}>
        <label className={styles.formField}>
          <span className={styles.formLabel}>Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            data-field="full-name"
            autoComplete="off"
          />
          {/* Said before it is enforced, so the disabled button is never a
              puzzle: a record needs the name a rota would use. */}
          <span className={styles.formHint}>
            First and last, as the rota has it. Records carry this name for ever.
          </span>
        </label>

        <label className={styles.formField}>
          <span className={styles.formLabel}>Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            data-field="role"
          >
            {ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {STAFF_ROLE_NAMES[entry]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.formField}>
          <span className={styles.formLabel}>Home</span>
          <select
            value={siteId}
            onChange={(event) => setSiteId(event.target.value as typeof siteId)}
            data-field="site"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  )
}
