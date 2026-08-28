import type {
  Aggregate,
  DocumentRecord,
  ExpiryDecision,
  IsoDate,
  StaffRef,
} from '@/data/types'
import { wholeDaysBetween } from '@/lib/review-interval'
import { dueSoonDays, minPopulationForARate } from '@/data/access/settings-store'

/**
 * What an expiry decision means today.
 *
 * **Say what kind of instant this is before touching it**: an expiry date is a
 * deadline — the day a document stops being valid — which is the same kind of
 * instant as a review's due date and a different kind from a signature. So it
 * reads `dueSoonDays()`, the constant that already means "how long before a
 * deadline it starts reading as approaching", rather than a second 30 that
 * agrees with the first today and drifts from it later.
 *
 * `today` is the site's day, never the viewer's. At 00:10 in London the
 * viewer's UTC day is still yesterday, and a document expiring today would
 * read as expiring tomorrow.
 */
export type ExpiryFinding =
  | { kind: 'expired'; on: IsoDate; daysAgo: number }
  | { kind: 'expiring'; on: IsoDate; inDays: number }
  | { kind: 'in_date'; on: IsoDate; inDays: number }
  | { kind: 'does_not_expire'; decidedBy: StaffRef; on: IsoDate }
  | { kind: 'not_recorded' }

export function expiryFinding(expiry: ExpiryDecision, today: IsoDate): ExpiryFinding {
  switch (expiry.kind) {
    case 'not_recorded':
      return { kind: 'not_recorded' }
    case 'does_not_expire':
      return { kind: 'does_not_expire', decidedBy: expiry.decidedBy, on: expiry.on }
    case 'expires': {
      const days = wholeDaysBetween(today, expiry.on)
      if (days < 0) return { kind: 'expired', on: expiry.on, daysAgo: -days }
      if (days <= dueSoonDays())
        return { kind: 'expiring', on: expiry.on, inDays: days }
      return { kind: 'in_date', on: expiry.on, inDays: days }
    }
  }
}

/**
 * The three findings a library leads on, and they are never summed.
 *
 * Expired and expiring are findings about a document whose validity somebody
 * decided. **No expiry recorded is not a milder third** — it is the absence of
 * the fact the other two are made of, so it takes the hatch while they take
 * critical and caution. Adding them would produce a number of "documents
 * needing attention" in which a lapsed DNAR and a photograph nobody has
 * classified weigh the same.
 */
export interface ExpiryCounts {
  expired: number
  expiring: number
  notRecorded: number
  /** Every document the three are counted out of. Rule 4's denominator. */
  total: number
}

export function countExpiry(documents: DocumentRecord[], today: IsoDate): ExpiryCounts {
  const counts: ExpiryCounts = {
    expired: 0,
    expiring: 0,
    notRecorded: 0,
    total: documents.length,
  }
  for (const document of documents) {
    const finding = expiryFinding(document.expiry, today)
    if (finding.kind === 'expired') counts.expired += 1
    else if (finding.kind === 'expiring') counts.expiring += 1
    else if (finding.kind === 'not_recorded') counts.notRecorded += 1
  }
  return counts
}

/**
 * How much of the library carries an expiry decision at all.
 *
 * **The numerator is documents somebody has decided about**, either a date or
 * a recorded "does not expire" — not documents that are in date. A home whose
 * every document expired last year would score 100% here, and correctly: this
 * figure is about whether anything can tell you the answer, which is the prior
 * question to what the answer is.
 *
 * Below `minPopulationForARate()` it renders Insufficient Evidence rather
 * than a percentage, because "100% — 2 of 2" invites a judgement two documents
 * cannot support.
 */
export function expiryDecisionCoverage(
  documents: DocumentRecord[],
  where: string,
): Aggregate {
  const decided = documents.filter(
    (document) => document.expiry.kind !== 'not_recorded',
  ).length
  const coverage = { covered: decided, total: documents.length }

  if (coverage.total < minPopulationForARate()) {
    return {
      kind: 'insufficient_evidence',
      coverage,
      missingDescription:
        coverage.total === 0
          ? `No documents are on file at ${where}, so there is no rate to report.`
          : `Only ${coverage.total} documents are on file at ${where}: too few to support a rate.`,
    }
  }

  return {
    kind: 'measured',
    unit: 'percentage',
    value: Math.round((decided / coverage.total) * 100),
    coverage,
  }
}
