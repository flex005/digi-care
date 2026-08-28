/**
 * Pronoun substitution for hand-written fixture prose.
 *
 * **The defect this exists to prevent.** Every pool of fixture sentences —
 * care note bodies, handover notes, communication needs — was written with
 * pronouns baked into the string and then drawn with `rng.pick`, which knows
 * nothing about the resident it is drawing for. The result was 1,988 of 12,139
 * care notes referring to a resident by the wrong pronoun: "Preferred to stay
 * in his room today" on a woman's record, "said her hip was aching" on a
 * man's.
 *
 * In a care record that is not a typo. It is the sentence a family reads when
 * they ask what their mother did yesterday, and it tells them nobody is paying
 * attention.
 *
 * So the pools carry tokens and the resident supplies the answer. Substitution
 * happens **after** the random draw, so the RNG stream is untouched and no
 * other fixture moves.
 *
 * **Verb agreement is carried by the tokens**, not left to luck. "They was
 * reluctant to mobilise" is the failure one step along from the one this
 * fixes, and it arrives the moment a resident is recorded as they/them — which
 * no fixture is today and any real service will be. `{were}`, `{are}`,
 * `{have}` and `{does}` exist so a sentence can be written once and read
 * correctly for all three.
 *
 * `scripts/`-level enforcement is not needed: `fixtures.test.ts` fails if any
 * rendered fixture string contains a bare gendered pronoun, which is what stops
 * the next hand-written pool being added the old way.
 */

/** he/him, she/her, they/them. Anything else falls back to they/them. */
export type PronounSet = 'he' | 'she' | 'they'

export function pronounSetOf(pronouns: string): PronounSet {
  const first = pronouns.trim().toLowerCase().split('/')[0]
  if (first === 'he') return 'he'
  if (first === 'she') return 'she'
  return 'they'
}

/**
 * Subject, object, possessive, possessive pronoun, reflexive — then the verb
 * forms that change with them.
 *
 * Keyed by token so a writer can see the whole vocabulary in one place. A
 * token not listed here is left alone and caught by the guard test rather than
 * silently rendering as `{itself}`.
 */
const FORMS: Record<string, Record<PronounSet, string>> = {
  they: { he: 'he', she: 'she', they: 'they' },
  them: { he: 'him', she: 'her', they: 'them' },
  their: { he: 'his', she: 'her', they: 'their' },
  theirs: { he: 'his', she: 'hers', they: 'theirs' },
  themself: { he: 'himself', she: 'herself', they: 'themself' },
  // Verb agreement. Without these, "they was unsettled" is the next defect.
  were: { he: 'was', she: 'was', they: 'were' },
  are: { he: 'is', she: 'is', they: 'are' },
  have: { he: 'has', she: 'has', they: 'have' },
  do: { he: 'does', she: 'does', they: 'do' },
}

const TOKEN = /\{([A-Za-z]+)\}/g

/**
 * Replaces `{they}` and friends with the forms for this resident.
 *
 * `{They}` — capitalised token — yields a capitalised form, so a sentence can
 * open with a pronoun without the caller doing anything.
 *
 * An unknown token is left in place rather than removed. A stray `{sh}` that
 * renders as `{sh}` on screen is obvious and gets fixed; one that silently
 * vanishes leaves a sentence that reads fine and means something else.
 */
export function pronounise(text: string, pronouns: string): string {
  const set = pronounSetOf(pronouns)
  return text.replace(TOKEN, (whole, token: string) => {
    const lower = token.toLowerCase()
    const form = FORMS[lower]?.[set]
    if (form === undefined) return whole
    const capitalised = token[0] === token[0]?.toUpperCase()
    return capitalised ? form[0]!.toUpperCase() + form.slice(1) : form
  })
}

/**
 * A resident's pronouns, or they/them where nobody has recorded any.
 *
 * **One owner**, because this was a private helper in `care-notes.ts` and the
 * second module that needed it was one copy away from having its own — and two
 * copies of a fallback rule drift, in whichever direction. `pronouns.kind ===
 * 'unrecorded'` is a real state on every resident, and a fixture pool that
 * guesses instead of falling back is how "his" ends up on a woman's record.
 */
export function pronounsOf(resident: {
  pronouns: { kind: string; value?: string }
}): string {
  return resident.pronouns.kind === 'recorded'
    ? (resident.pronouns.value ?? 'they/them')
    : 'they/them'
}
