import { useState } from 'react'
import type { CustomRisk, IsoDateTime, Resident } from '@/data/types'
import { recordCustomRisk } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { now as appNow } from '@/data/fixtures/clock'
import { Button, Dialog } from '@/components/primitives'
import styles from './risk.module.css'
import { RiskFields, asEntry, draftFrom, emptyDraft, isAnswered } from './RiskFieldSet'

/**
 * Recording a risk outside the nine, and re-scoring one. Phase 30.
 *
 * **One dialog for both, because they are one act with one writer.** The
 * difference is the name: a new risk needs one, and an existing one keeps the
 * one it has — `recordCustomRisk` takes a `riskId` for the second and nothing
 * for the first. A separate create dialog would be a second copy of the same
 * form, and the two would drift the first time either was touched.
 *
 * **The name is fixed once recorded.** Re-scoring never renames a risk, not
 * even to fix a typo: every disclosure, queue row and note that mentions it
 * was written about that name. A correction is a new risk.
 *
 * What neither mode can borrow is the assessment screen: that screen is an
 * instrument, and a risk a home wrote down for one resident has no instrument
 * behind it.
 *
 * **A re-score is prefilled from what is on the record.** One that opened
 * blank and saved what was on screen would delete the description and the
 * actions the last assessor wrote, because the next one did not retype them.
 */
export function CustomRiskDialog({
  resident,
  risk,
  onClose,
  onRecorded,
}: {
  resident: Resident
  /** An existing risk to re-score, or `new` for one nobody has recorded. */
  risk: CustomRisk | 'new'
  onClose: () => void
  onRecorded: () => void
}) {
  const { currentUser } = useSession()
  const creating = risk === 'new'
  const today = appNow().toISOString().slice(0, 10)
  const [draft, setDraft] = useState(() =>
    risk === 'new' ? emptyDraft(today) : draftFrom(risk),
  )
  const [name, setName] = useState(risk === 'new' ? '' : risk.name)
  const [failure, setFailure] = useState('')

  const ready = isAnswered(draft) && name.trim() !== ''

  const save = () => {
    const entry = asEntry(draft, false)
    void recordCustomRisk({
      residentId: resident.id,
      ...(risk === 'new' ? {} : { riskId: risk.id }),
      name,
      level: entry.level,
      score: entry.score,
      description: entry.description,
      actions: entry.actions,
      by: currentUser,
      at: appNow().toISOString() as IsoDateTime,
      reviewDueOn: entry.reviewDueOn,
    })
      .then(onRecorded)
      .catch((cause: unknown) =>
        setFailure(cause instanceof Error ? cause.message : 'Nothing was recorded'),
      )
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={
        creating
          ? `Add a risk for ${resident.preferredName}, outside the nine`
          : `Re-score ${name.toLowerCase()} for ${resident.preferredName}`
      }
      description={`${resident.fullLegalName}. Your name and the time go on the record.`}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            data-record-custom-risk={creating ? 'new' : 'rescore'}
            onClick={save}
          >
            {creating ? 'Record this risk' : 'Record this assessment'}
          </Button>
        </>
      }
    >
      {creating ? (
        <label className={styles.nameField}>
          <span className={styles.nameLabel}>What the risk is</span>
          <input
            type="text"
            value={name}
            placeholder="Leaving the home unaccompanied"
            data-field="custom-risk-name"
            onChange={(event) => setName(event.target.value)}
          />
          {/* Said before it is enforced, and before anybody types the rest. */}
          <span className={styles.nameHint}>
            This cannot be changed later: a re-score never renames a risk, because
            everything written about it was written about this name.
          </span>
        </label>
      ) : null}

      <RiskFields
        idPrefix={creating ? 'new-custom-risk' : `rescore-${risk.id}`}
        draft={draft}
        /*
         * Never scored: a risk outside the nine has no instrument, so there is
         * no number to work out and none missing. `not_scored_yet` would claim
         * a chart somebody has yet to fill in.
         */
        scored={false}
        onChange={setDraft}
      />
      {failure === '' ? null : <p data-rescore-failure>{failure}</p>}
    </Dialog>
  )
}
