import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { Resident } from '@/data/types'
import { recordCustomCarePlanDomain } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { useTerms } from '@/app/session/use-term'
import { useViewer } from '@/app/session/use-viewer'
import { ReadOnlyHere } from '@/components/status'
import type { ProfileContext } from '@/features/residents/ResidentProfileRoute'
import { Button, Dialog } from '@/components/primitives'
import styles from './care-plan.module.css'

/**
 * Naming a care plan domain outside the ten. Phase 31, narrowed here.
 *
 * **A name, and nothing else.** This used to be the whole editor: three
 * fields, Save draft and a signing step, in a modal that had none of the
 * things the routed editor has — the previous version beneath each box,
 * Discard draft, Undo after signing, the version history. Writing a domain
 * outside the ten is the same act as writing one of the ten, so it happens on
 * the same screen, and the only thing that has to happen first is the one
 * thing the ten never need: the domain has to exist before there is an address
 * to open.
 *
 * So this creates the record and steps out of the way, landing on the editor
 * empty and ready to write.
 *
 * The name is fixed once the domain exists, for the reason a custom risk's is:
 * everything written about it was written about that name.
 */
export function AddCustomDomainDialog({
  resident,
  onClose,
  onAdded,
}: {
  resident: Resident
  onClose: () => void
  /** The tab re-reads, so the new domain is on the list behind the editor. */
  onAdded: () => void
}) {
  const { currentUser } = useSession()
  const viewer = useViewer()
  const terms = useTerms()
  const { refresh } = useOutletContext<ProfileContext>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [failure, setFailure] = useState('')

  /*
   * The trigger in `CarePlanTab` asks this too. Asked here as well so the
   * gate and the act are in one file: a second route to this dialog would
   * otherwise be guarded by whichever screen happened to open it.
   */
  if (!viewer.canRecordIn('/care-plans')) {
    return (
      <ReadOnlyHere
        roleName={viewer.roleName}
        subject={`this ${terms.carePlan.one}`}
        act="add a domain to it"
      />
    )
  }

  const add = () => {
    void recordCustomCarePlanDomain({
      residentId: resident.id,
      name,
      by: currentUser,
    })
      .then((created) => {
        if (!created) return
        /*
         * The profile is re-read before the address changes. The editor
         * resolves `:domainId` against the resident it was handed, and that
         * copy does not hold a domain created a moment ago — navigating first
         * lands on "No such care plan domain" until the read catches up.
         */
        refresh()
        onAdded()
        // The same address the ten's rows link to, so what opens is the same
        // screen rather than a second one that looks like it.
        void navigate(created.id)
      })
      .catch((cause: unknown) =>
        setFailure(cause instanceof Error ? cause.message : 'Nothing was added'),
      )
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={`Add a ${terms.carePlan.one} domain for ${resident.preferredName}, outside the ten`}
      description={`${resident.fullLegalName}. Naming it opens it, ready to write.`}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={name.trim() === ''} data-add-domain-submit onClick={add}>
            Add and open
          </Button>
        </>
      }
    >
      <label className={styles.nameField}>
        <span className={styles.nameLabel}>What this domain is</span>
        <input
          type="text"
          value={name}
          placeholder="The allotment"
          data-field="custom-domain-name"
          onChange={(event) => setName(event.target.value)}
        />
        <span className={styles.nameHint}>This cannot be changed later.</span>
      </label>

      {failure === '' ? null : <p data-custom-domain-failure>{failure}</p>}
    </Dialog>
  )
}
