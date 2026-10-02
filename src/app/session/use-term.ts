import {
  organisationTypeAsConfigured,
  subjectTermIdAsConfigured,
} from '@/data/access/settings-store'
import { subjectTerm, type Term } from '@/lib/vocabulary'

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
