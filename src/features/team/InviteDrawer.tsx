import { useState } from 'react'
import type { ResidentAssignment, ResidentId, SiteId, StaffRole } from '@/data/types'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { Button, Dialog } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { addMember, setResidentAssignment, teamMembers } from '@/data/access/team-store'
import { residentsBySite } from '@/data/fixtures/residents'
import { toIsoDate } from '@/data/fixtures/generate'
import { now as appNow } from '@/data/fixtures/clock'
import { pluralise } from '@/lib/format'
import styles from './team.module.css'

/**
 * Inviting somebody to the team. AM v2.0 TM-02, Phase 18.
 *
 * **Adding somebody and granting them access are two acts**, and this does the
 * first. The person lands on the team with `never_given_access`, which is the
 * hatched standing and the honest one: they are on the record and nobody has
 * set their account up. `inviteMember` is the second act and it carries a
 * name. That was Phase 14's shape and this screen does not flatten it.
 *
 * **A role an Admin cannot invite is stated rather than absent.** AM v2.0 says
 * an Admin cannot invite another Admin — that is the Superadmin's act, in a
 * product this build does not contain. A dropdown quietly missing the option
 * would read as a product that has no such role.
 *
 * **Residents are asked for only when the role is a care worker**, which is
 * the rule that stands in for a fourth union member. And the question has
 * three answers rather than two: named residents, the whole home as a
 * decision, or nobody deciding yet — because AM v2.0's "leave it blank and
 * they see everybody" makes a blank mean two opposite things.
 */
export function InviteDrawer({ onAdded }: { onAdded: () => void }) {
  const { activeSite, sites, currentUser } = useSession()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<StaffRole>('care_worker')
  const [siteIds, setSiteIds] = useState<SiteId[]>([activeSite.id])
  const [cover, setCover] = useState<ResidentAssignment['kind']>('never_set')
  const [residents, setResidents] = useState<ResidentId[]>([])

  const named = fullName.trim().split(/\s+/).filter(Boolean)
  const existing = teamMembers().find(
    (member) => member.ref.fullName.toLowerCase() === fullName.trim().toLowerCase(),
  )
  const isCareWorker = role === 'care_worker'
  const ready =
    named.length >= 2 &&
    siteIds.length > 0 &&
    existing === undefined &&
    (!isCareWorker || cover !== 'assigned' || residents.length > 0)

  const choices = siteIds.flatMap((siteId) => residentsBySite(siteId))

  const reset = () => {
    setFullName('')
    setRole('care_worker')
    setSiteIds([activeSite.id])
    setCover('never_set')
    setResidents([])
  }

  const submit = () => {
    if (!ready) return
    const member = addMember({
      fullName: fullName.trim(),
      role,
      siteIds,
      addedBy: currentUser,
    })
    if (isCareWorker && cover !== 'never_set') {
      const on = toIsoDate(appNow())
      setResidentAssignment(
        member.id,
        cover === 'all_residents_at_site'
          ? { kind: 'all_residents_at_site', decidedBy: currentUser, on }
          : { kind: 'assigned', residents, decidedBy: currentUser, on },
      )
    }
    reset()
    setOpen(false)
    onAdded()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} data-invite-open>
        <Icon name="add-remove-delete/add-01" size={16} aria-hidden />
        Invite staff member
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? undefined : (reset(), setOpen(false)))}
        title="Invite somebody to the team"
        description="They land on the team record with their account not yet set up, which is what an invitation is for. Granting access is a second act with a name on it."
      >
        <div className={styles.inviteForm} data-invite-form>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              data-field="full-name"
            />
            {existing !== undefined ? (
              <span className={styles.fieldError} data-already-on-team>
                {existing.ref.fullName} is already on the team record. Their homes can
                be changed on their own page; changing a role is not something this
                build does, and adding them twice would not do it either.
              </span>
            ) : null}
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Role</span>
            <div className={styles.roleChoices}>
              {(['care_worker', 'senior_carer', 'deputy_manager'] as StaffRole[]).map(
                (entry) => (
                  <label
                    key={entry}
                    className={role === entry ? styles.choiceOn : styles.choice}
                    data-role-option={entry}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      checked={role === entry}
                      onChange={() => setRole(entry)}
                    />
                    {STAFF_ROLE_NAMES[entry]}
                  </label>
                ),
              )}
            </div>
            <p className={styles.hint} data-cannot-invite-admin>
              A registered manager is not on this list. Registering somebody as the
              person a service is registered to is not an act this platform performs,
              and it is not missing from the product.
            </p>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Homes</span>
            <div className={styles.roleChoices}>
              {sites.map((site) => (
                <label
                  key={site.id}
                  className={
                    siteIds.includes(site.id) ? styles.choiceOn : styles.choice
                  }
                  data-site-option={site.id}
                >
                  <input
                    type="checkbox"
                    checked={siteIds.includes(site.id)}
                    onChange={() =>
                      setSiteIds((current) =>
                        current.includes(site.id)
                          ? current.filter((id) => id !== site.id)
                          : [...current, site.id],
                      )
                    }
                  />
                  {site.name}
                </label>
              ))}
            </div>
          </div>

          {isCareWorker ? (
            <div className={styles.field} data-assignment-field>
              <span className={styles.fieldLabel}>Which residents?</span>
              <p className={styles.hint}>
                This decides what they see in the care worker app. It changes nothing on
                this platform, and no gap here is attributed to whoever was assigned.
              </p>
              <div className={styles.roleChoices}>
                {(
                  [
                    ['never_set', 'Not decided yet'],
                    ['all_residents_at_site', 'Everybody at these homes'],
                    ['assigned', 'Named residents'],
                  ] as const
                ).map(([kind, label]) => (
                  <label
                    key={kind}
                    className={cover === kind ? styles.choiceOn : styles.choice}
                    data-cover-option={kind}
                  >
                    <input
                      type="radio"
                      name="invite-cover"
                      checked={cover === kind}
                      onChange={() => setCover(kind)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {cover === 'never_set' ? (
                <p className={styles.hint} data-cover-gap>
                  Their record will say nobody has decided, which is what it will be.
                  Covering the whole home is a decision somebody takes, and it carries
                  their name.
                </p>
              ) : null}
              {cover === 'assigned' ? (
                <ul className={styles.residentChoices} data-resident-choices>
                  {choices.map((resident) => (
                    <li key={resident.id}>
                      <label
                        className={
                          residents.includes(resident.id)
                            ? styles.choiceOn
                            : styles.choice
                        }
                        data-resident-option={resident.id}
                      >
                        <input
                          type="checkbox"
                          checked={residents.includes(resident.id)}
                          onChange={() =>
                            setResidents((current) =>
                              current.includes(resident.id)
                                ? current.filter((id) => id !== resident.id)
                                : [...current, resident.id],
                            )
                          }
                        />
                        {resident.preferredName}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className={styles.inviteActions}>
            <p className={styles.hint}>
              {siteIds.length === 0
                ? 'Choose at least one home.'
                : `${pluralise(siteIds.length, 'home')} · nothing here is sent anywhere, and it is gone on reload.`}
            </p>
            <Button disabled={!ready} onClick={submit} data-invite-submit>
              Add to the team
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
