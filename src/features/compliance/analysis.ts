import type { KeyQuestionId } from '@/data/types'
import {
  carePlanDomains,
  consentsSought,
  riskAssessments,
} from '@/features/dashboard/populations'
import type { ComplianceData } from './data'
import type { Panel } from './key-questions'

/**
 * The figures the analytical layout leads on. Phase 12, restyled.
 *
 * **The hero carries the least reassuring number available**, in the largest
 * position on the screen: how many checks cannot support a figure at all. Not
 * that they are bad — that they are unmeasurable, which is the one thing a
 * compliance screen must never let a reader mistake for a pass.
 */
export interface Headline {
  /** Checks that exist and cannot support a figure. */
  unusable: number
  /** Every derived check, across the five. */
  derived: number
  /** Key Questions that cannot be rated at all. */
  unratable: number
  panels: number
  /**
   * The Key Question carrying the most unusable checks.
   *
   * **Not the count of unratable panels**, which is what the hero carried
   * first and was zero: four checks that cannot support a figure had left
   * every panel still ratable, so the hero's own sub-figure said "0 ... as a
   * result" — a causal claim the data did not support, in the largest type on
   * the screen. A figure that is reassuring exactly when the headline beside
   * it is not is the reassuring-branch problem in miniature.
   */
  worstAffected: { name: string; unusable: number; total: number } | undefined
  /** Checks nothing in this product records. Never counted toward either. */
  notHeld: number
  /** Usable checks whose reading is a finding — amber or red. */
  findings: number
  usable: number
  /** The worst of them, named, with its own figures. */
  worst: { name: string; detail: string } | undefined
}

export function headlineFor(panels: Panel[]): Headline {
  let unusable = 0
  let derived = 0
  let notHeld = 0
  let findings = 0
  let usable = 0
  let worst: { name: string; detail: string; value: number } | undefined
  let worstAffected: { name: string; unusable: number; total: number } | undefined

  for (const panel of panels) {
    let panelUnusable = 0
    let panelDerived = 0
    for (const result of panel.results) {
      if (result.kind === 'not_held') {
        notHeld += 1
        continue
      }
      derived += 1
      panelDerived += 1
      if (result.reading.kind === 'insufficient') {
        unusable += 1
        panelUnusable += 1
        continue
      }
      usable += 1
      if (result.reading.rating === 'green') continue
      findings += 1
      const value = result.reading.aggregate.value
      if (worst === undefined || value < worst.value) {
        worst = {
          name: result.definition.name,
          detail: result.reading.detail,
          value,
        }
      }
    }

    if (
      panelUnusable > 0 &&
      (worstAffected === undefined || panelUnusable > worstAffected.unusable)
    ) {
      worstAffected = {
        name: panel.question.name,
        unusable: panelUnusable,
        total: panelDerived,
      }
    }
  }

  return {
    unusable,
    derived,
    unratable: panels.filter((panel) => panel.verdict.kind === 'insufficient_evidence')
      .length,
    panels: panels.length,
    notHeld,
    findings,
    usable,
    worstAffected,
    worst: worst === undefined ? undefined : { name: worst.name, detail: worst.detail },
  }
}

/**
 * One named population of records per Key Question, and what is missing from it.
 *
 * **One population each, named on the bar, and never a sum across a panel's
 * checks.** Two of the five have checks counting the same records from
 * different angles — a care plan domain appears in "ever written" and in
 * "reviewed on time" — so adding a panel's populations together would count
 * some records twice and produce a total nobody could check.
 *
 * What each bar counts is stated beside it, which is what makes "expected and
 * missing" a figure somebody can act on rather than a shortfall against a
 * target nobody set.
 */
export interface EvidenceBar {
  id: KeyQuestionId
  label: string
  /** What the bar counts, named on the bar: "174 of 252 risk assessments". */
  population: string
  /**
   * The same population named from the missing side: "78 risk assessments
   * never done".
   *
   * **Two phrasings because the same words are wrong in the second place.**
   * The bar's phrasing listed against a missing count reads as a positive one —
   * "42 consents sought" for 42 consents nobody has sought — which is the blank
   * that means either "no" or "nobody has looked" wearing a number.
   */
  missingPhrase: string
  recorded: number
  expected: number
}

export function evidenceBars(data: ComplianceData): EvidenceBar[] {
  /*
   * Counted by the shared owner, because the Dashboard's module bars ask the
   * same three questions and a second copy of the arithmetic is a second rule.
   */
  const assessments = riskAssessments(data.residents)
  const domains = carePlanDomains(data.residents)
  const consents = consentsSought(data.residents)

  const happened = data.activities.filter((activity) => activity.endsAt < data.now)
  const invitations = happened.flatMap((activity) => activity.invited)
  const answered = invitations.filter(
    (invitation) => invitation.attendance.kind !== 'not_recorded',
  ).length

  const dated = data.documents.filter((record) => record.expiry.kind !== 'not_recorded')

  return [
    {
      id: 'safe',
      label: 'Safe',
      population: 'risk assessments',
      missingPhrase: 'risk assessments never done',
      recorded: assessments.recorded,
      expected: assessments.expected,
    },
    {
      id: 'effective',
      label: 'Effective',
      population: 'care plan domains finalised',
      missingPhrase: 'care plan domains never finalised',
      recorded: domains.recorded,
      expected: domains.expected,
    },
    {
      id: 'caring',
      label: 'Caring',
      population: 'consents sought',
      missingPhrase: 'consents nobody has sought',
      recorded: consents.recorded,
      expected: consents.expected,
    },
    {
      id: 'responsive',
      label: 'Responsive',
      population: 'invitations answered',
      missingPhrase: 'invitations with no answer either way',
      recorded: answered,
      expected: invitations.length,
    },
    {
      id: 'well_led',
      label: 'Well-led',
      /*
       * The expiry *decision*, not whether the document is in date.
       *
       * The bar first counted documents in date, and its hatched segment then
       * claimed 93 records "nobody has written" — but an expired document was
       * written, and by somebody whose name is on it. Being out of date is a
       * finding; having no expiry decision at all is the gap, and it is the
       * one this bar is for.
       */
      population: 'documents carrying an expiry decision',
      missingPhrase: 'documents with neither an expiry date nor a decision',
      recorded: dated.length,
      expected: data.documents.length,
    },
  ]
}

/** Every record the home is expected to hold and does not, by named component. */
export function missingEvidence(bars: EvidenceBar[]): {
  total: number
  components: { label: string; missing: number }[]
} {
  const components = bars.map((bar) => ({
    label: bar.missingPhrase,
    missing: bar.expected - bar.recorded,
  }))
  return {
    total: components.reduce((running, entry) => running + entry.missing, 0),
    components,
  }
}
