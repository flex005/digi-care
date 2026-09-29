import { useState } from 'react'
import type { CustomRisk, IsoDateTime, Resident } from '@/data/types'
import { recordCustomRisk } from '@/data/access/client'
import { useSession } from '@/app/session/use-session'
import { now as appNow } from '@/data/fixtures/clock'
import { Button, Dialog } from '@/components/primitives'
import { RiskFields, asEntry, draftFrom, isAnswered } from './RiskFieldSet'

/**
 * Re-scoring a risk recorded outside the nine. Phase 30.
 *
 * **The same act as re-scoring a template, so it takes the same fields and the
 * same writer.** What it cannot borrow is the assessment screen: that screen
 * is an instrument, and a risk a home wrote down for one resident has no
 * instrument behind it. The fields are the shared set, which is what keeps the
 * two from becoming two shapes of one record.
 *
 * **Prefilled from what is on the record.** A re-score that opened blank and
 * saved what was on screen would delete the description and the actions the
 * last assessor wrote, because the next one did not retype them.
 */
export function CustomRiskDialog({
  resident,
  risk,
  onClose,
  onRecorded,
}: {
  resident: Resident
  risk: CustomRisk
  onClose: () => void
  onRecorded: () => void
}) {
  const { currentUser } = useSession()
  const [draft, setDraft] = useState(() => draftFrom(risk))
  const [failure, setFailure] = useState('')

  const save = () => {
    const entry = asEntry(draft, false)
    void recordCustomRisk({
      residentId: resident.id,
      riskId: risk.id,
      name: risk.name,
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
      title={`Re-score ${risk.name.toLowerCase()} for ${resident.preferredName}`}
      description={`${resident.fullLegalName}. Your name and the time go on the record.`}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!isAnswered(draft)}
            data-record-custom-rescore
            onClick={save}
          >
            Record this assessment
          </Button>
        </>
      }
    >
      <RiskFields
        idPrefix={`rescore-${risk.id}`}
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
