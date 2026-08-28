import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { CarePlanVersion } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import type { ResidentProfile } from '@/data/access/client'
import { Card } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { formatCount } from '@/lib/format'
import { compareVersions } from './plan-fields'
import styles from './care-plan.module.css'

/**
 * Every version of one domain, and what changed between two of them. PRD §6.7.
 *
 * The sentence: **this is what staff were told to do, and when it changed.**
 *
 * **Drafts never appear here.** A history of intentions is not a history of
 * instructions: an unsigned edit was never something anybody followed, so
 * putting it on this screen would show a change nobody agreed to beside
 * changes they did. An abandoned draft leaving no trace is the correct
 * consequence, not a gap.
 *
 * **A first finalise is not a diff against nothing.** Version 1 renders the
 * hatched note saying there was no previous version — an empty left-hand
 * column would read as "this used to say nothing", which is a claim about a
 * plan that did not exist.
 */
export function VersionHistoryRoute() {
  const { resident } = useOutletContext<ResidentProfile>()
  const { domainId } = useParams<{ domainId: string }>()
  const format = useSiteFormat()

  const domain = CARE_PLAN_DOMAINS.find((entry) => entry.id === domainId)
  const record = resident.carePlan.find((entry) => entry.domainId === domainId)

  const history: CarePlanVersion[] =
    record?.versions.kind === 'finalised' ? record.versions.history : []

  // The most recent by default: it is the one staff are following, and the
  // question this screen is opened with is usually "what changed last time".
  const [selected, setSelected] = useState(() => Math.max(history.length - 1, 0))

  if (!domain || !record) {
    return (
      <div className={styles.tabPanel}>
        <Card padded>
          <p className={styles.errorTitle}>No such care plan domain</p>
          <p className={styles.errorBody}>
            This address does not name one of the{' '}
            <span data-numeric>{CARE_PLAN_DOMAINS.length}</span> domains.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.tabPanel}>
      <Link to=".." relative="path" className={styles.backLink}>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} />
        {domain.name}
      </Link>

      <h2 className={styles.screenTitle}>
        {domain.name}, version history for {resident.fullLegalName}
      </h2>

      {history.length === 0 ? (
        <Card>
          <div className={styles.emptyHistory} data-no-versions>
            <Unrecorded
              variant="panel"
              caption={domain.name}
              label="No version has ever been signed"
              detail={`Nothing has been withdrawn or lost. Nobody has finalised this domain for ${resident.fullLegalName}, so there is no instruction for staff to follow and nothing to compare.`}
            />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <ul className={styles.versionList}>
              {history
                .map((version, index) => ({ version, index }))
                .reverse()
                .map(({ version, index }) => (
                  <li key={`${version.finalisedOn}-${index}`}>
                    <div className={styles.versionRow} data-version={index + 1}>
                      <div>
                        <p className={styles.versionNumber} data-numeric>
                          {formatCount(index + 1)}
                          <span className={styles.versionCaption}>version</span>
                        </p>
                        {index === history.length - 1 ? (
                          <span className={styles.versionCurrent} data-current>
                            Current
                          </span>
                        ) : null}
                      </div>

                      <p className={styles.versionSummary}>
                        <Summary history={history} index={index} />
                      </p>

                      <p className={styles.versionSignature}>
                        Signed by <b>{version.finalisedBy.fullName}</b>
                        <br />
                        <span data-numeric>{format.date(version.finalisedOn)}</span>
                      </p>

                      <button
                        type="button"
                        className={
                          index === selected
                            ? `${styles.versionSelect} ${styles.versionSelectActive}`
                            : styles.versionSelect
                        }
                        aria-pressed={index === selected}
                        data-select-version={index + 1}
                        onClick={() => setSelected(index)}
                      >
                        {index === 0 ? 'View' : 'View diff'}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <Diff history={history} index={selected} />
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * What changed in this version, **named field by field rather than counted**.
 *
 * No narrative. The record does not hold why a plan was revised, and writing
 * "rewritten after a change in how far she could walk" would be a sentence
 * nobody wrote appearing above two signatures.
 *
 * A review that changed nothing is a real event and gets its own words: it is
 * somebody looking at the plan and confirming it, not a version that failed to
 * say anything.
 */
function Summary({ history, index }: { history: CarePlanVersion[]; index: number }) {
  if (index === 0) {
    return (
      <>
        The first plan written for this domain.
        <span className={styles.versionChanged}>
          No previous version to compare against.
        </span>
      </>
    )
  }

  const comparison = compareVersions(history[index - 1]!, history[index]!)
  const changed = comparison.filter((entry) => entry.changed)
  const unchanged = comparison.filter((entry) => !entry.changed)
  /*
   * The labels as written, never lowercased.
   *
   * `.toLowerCase()` turned "What I need help with" into "what i need help
   * with" — a field named in the resident's own voice, with the pronoun taken
   * out of it. The transformation looked like tidy sentence case and was
   * destroying the one word in the label that matters.
   */
  const label = (entries: typeof comparison) =>
    formatFields(entries.map((entry) => entry.field.label))

  if (changed.length === 0) {
    return (
      <>
        Reviewed and signed again with no change to the plan.
        <span className={styles.versionChanged}>
          Every field carried forward as it was. Somebody looked at this and left it.
        </span>
      </>
    )
  }

  return (
    <>
      Changed: {label(changed)}.
      <span className={styles.versionChanged}>
        {unchanged.length === 0
          ? 'Every field was rewritten.'
          : `Unchanged: ${label(unchanged)}.`}
      </span>
    </>
  )
}

/**
 * One version against the one before it.
 *
 * Was on the left, now on the right, **and an unchanged field once, full
 * width** — rendering it twice in two columns would read as a change that
 * happens to match, which is the diff's own version of a blank meaning two
 * things.
 */
function Diff({ history, index }: { history: CarePlanVersion[]; index: number }) {
  const format = useSiteFormat()
  const version = history[index]!

  if (index === 0) {
    return (
      <div className={styles.noPrevious} data-no-previous>
        <Unrecorded
          variant="panel"
          label="No previous version"
          detail="Version 1 is the first plan written for this domain, not a change to one. A first finalise is not a comparison against nothing, so there is nothing here to put beside it."
        />
      </div>
    )
  }

  const previous = history[index - 1]!
  const comparison = compareVersions(previous, version)

  return (
    <>
      <p className={styles.diffHeader}>
        Version <span data-numeric>{formatCount(index)}</span> → version{' '}
        <span data-numeric>{formatCount(index + 1)}</span> · signed{' '}
        <span data-numeric>{format.date(version.finalisedOn)}</span> by{' '}
        {version.finalisedBy.fullName}
      </p>

      <div className={styles.diff}>
        {comparison.map((entry) => (
          <div
            className={styles.diffField}
            key={entry.field.id}
            data-diff={entry.field.id}
          >
            <p className={styles.diffFieldLabel}>{entry.field.label}</p>

            {entry.changed ? (
              <div className={styles.diffColumns}>
                <div
                  className={`${styles.diffBox} ${styles.diffWas}`}
                  data-was={entry.field.id}
                >
                  <b className={styles.diffBoxLabel}>
                    Version <span data-numeric>{formatCount(index)}</span>
                  </b>
                  {entry.was}
                </div>
                <div
                  className={`${styles.diffBox} ${styles.diffNow}`}
                  data-now={entry.field.id}
                >
                  <b className={styles.diffBoxLabel}>
                    Version <span data-numeric>{formatCount(index + 1)}</span>
                  </b>
                  {entry.now}
                </div>
              </div>
            ) : (
              <div className={styles.diffUnchanged} data-unchanged={entry.field.id}>
                <b className={styles.diffBoxLabel}>Unchanged</b>
                {entry.now}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * "a and b", "a, b and c" — the fields named rather than counted.
 *
 * All three is a real answer and reads as one: a review that changed
 * everything is a different event from one that changed a sentence.
 */
function formatFields(labels: string[]): string {
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}
