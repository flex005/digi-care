import {
  chosenTermsAsConfigured,
  organisationTypeAsConfigured,
  subjectTermIdAsConfigured,
} from '@/data/access/settings-store'
import {
  subjectTerm,
  vocabularyFor,
  type Term,
  type Vocabulary,
} from '@/lib/vocabulary'

/**
 * The word this organisation uses for the people it holds records about.
 *
 * **One owner, asked for a form.** `useTerm().one` is the mid-sentence
 * singular, `.Many` the sentence-initial plural, `.ones` the possessive, and
 * so on — see `Term`. A screen never takes one of these and transforms it:
 * that is the defect this exists to prevent, and it is the reason there are
 * six forms rather than one string and a convention.
 *
 * **Read at render, like the configured organisation name beside it.** The
 * term is session state in `settings-store`, so a screen that renders after
 * it changes shows the new word without anything subscribing — the same
 * mechanism, and the same limitation, as every other configured value here.
 */
export function useTerm(): Term {
  return subjectTerm(organisationTypeAsConfigured(), subjectTermIdAsConfigured())
}

/**
 * Every term at once, for a screen that names more than the subject.
 *
 * `useTerm()` above stays the subject, because a hundred call sites ask for
 * that one and `useTerms().subject` at each of them would be noise. This is
 * the same owner, read the same way at render.
 */
export function useTerms(): Vocabulary {
  const type = organisationTypeAsConfigured()
  const chosen = chosenTermsAsConfigured()
  const key = `${type}|${JSON.stringify(chosen)}`
  if (lastVocabulary?.key !== key) {
    lastVocabulary = { key, value: vocabularyFor(type, chosen) }
  }
  return lastVocabulary.value
}

/**
 * The last vocabulary built, so the same configuration returns the same object.
 *
 * **Referential stability, not speed.** `useTerm()` happens to be stable
 * because `subjectTerm` returns a declared `Term` out of a constant;
 * `vocabularyFor` assembles a new wrapper every call, and a value that is
 * equal but never identical is the one thing a `useMemo` dependency cannot
 * cope with. The reports index memoises eight whole-record runs on
 * `[data, terms]`, and without this every render would redo all eight — §8's
 * `zonedWallClock` entry, where the cost of rebuilding something cheap in a
 * loop was a screen blocking for 400ms.
 *
 * Derived rather than held: this is a cache of a pure function of two
 * configured values, so it carries nothing a session has to clear. The key is
 * both of those values, so changing a term in Settings returns a new object on
 * the next render and every memo keyed on it recomputes.
 */
let lastVocabulary: { key: string; value: Vocabulary } | undefined
