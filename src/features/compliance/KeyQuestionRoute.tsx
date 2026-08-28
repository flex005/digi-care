import { Link, useParams } from 'react-router-dom'
import type { CheckResult, Rating } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import {
  CheckFigure,
  NotHeldHere,
  PanelRating,
  PlaceholderBanner,
} from './ComplianceParts'
import { keyQuestionById } from './key-questions'
import { usePanels } from './use-compliance'
import styles from './compliance.module.css'

/**
 * One Key Question, every check. PRD §6.7, Phase 12.
 *
 * The sentence: **every check listed whether or not it has data, findings
 * first, each naming the module it comes from.**
 *
 * A figure whose origin is not stated is a figure nobody can check, so every
 * row carries where it came from — and where the evidence is weaker than the
 * figure makes it look, the row says that too.
 */
const ORDER: Record<Rating, number> = { red: 0, amber: 1, green: 2 }

function severity(result: CheckResult): number {
  // Findings first, then figures that cannot support one, then what this
  // product does not hold — which is last because nothing here can act on it.
  if (result.kind === 'not_held') return 5
  if (result.reading.kind === 'insufficient') return 4
  return ORDER[result.reading.rating]
}

export function KeyQuestionRoute() {
  const { activeSite } = useSession()
  const { keyQuestion } = useParams()
  const panels = usePanels()
  const question = keyQuestion === undefined ? undefined : keyQuestionById(keyQuestion)

  if (question === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.errorTitle}>That is not a Key Question</p>
        <p className={styles.errorBody}>
          There are five, and CQC names them. Nothing is shown rather than an empty
          panel, because a panel with no question above it is a rating of nothing.
        </p>
        <Link to=".." relative="path" className={styles.headLink}>
          Back to compliance
        </Link>
      </div>
    )
  }

  if (panels === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the whole record…</p>
      </div>
    )
  }

  const panel = panels.find((candidate) => candidate.question.id === question.id)
  if (panel === undefined) throw new Error(`No panel for ${question.id}`)

  const sorted = [...panel.results].sort((a, b) => severity(a) - severity(b))

  return (
    <div className={styles.page} data-key-question={question.id}>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Compliance
      </Link>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{question.name}</h1>
          <p className={styles.pageSubtitle}>
            {question.asks} · {activeSite.name}
          </p>
        </div>
        <PanelRating verdict={panel.verdict} />
      </header>

      <PlaceholderBanner what="screen" />

      <Card>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Every check, findings first</h2>
          <p className={styles.sectionNote}>
            Each names the module it comes from. A figure whose origin is not stated is
            a figure nobody can check.
          </p>
        </div>

        <ul className={styles.checks}>
          {sorted.map((result) => (
            <li key={result.definition.id}>
              <div
                className={styles.check}
                data-check={result.definition.id}
                data-check-kind={result.kind}
              >
                <div>
                  <p className={styles.checkName}>{result.definition.name}</p>
                  <p className={styles.checkFrom} data-check-from>
                    {result.kind === 'not_held'
                      ? 'Not held in diGi-Care'
                      : result.definition.from}
                  </p>
                  {result.kind === 'derived' && result.reading.caveat !== undefined ? (
                    <p className={styles.checkCaveat} data-check-caveat>
                      {result.reading.caveat}
                    </p>
                  ) : null}
                </div>

                <p className={styles.checkDetail}>
                  {result.kind === 'not_held'
                    ? result.definition.statement
                    : result.reading.detail}
                </p>

                {result.kind === 'not_held' ? (
                  <span data-check-verdict="not_held">
                    <NotHeldHere
                      statement="Not counted toward coverage or rating."
                      compact
                    />
                  </span>
                ) : (
                  <CheckFigure reading={result.reading} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
