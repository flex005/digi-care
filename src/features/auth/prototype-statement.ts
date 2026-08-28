/**
 * What this build does not do, in one place.
 *
 * **One owner, because it is said on two screens and they must not drift.**
 * It was a banner across the top of every authentication screen; it is now on
 * the two controls that cannot honestly do what they say — the recovery link,
 * which sends nothing, and Accept, which creates no account. The honesty lands
 * at the moment of the act rather than as a preamble in front of it.
 */
export const PROTOTYPE_STATEMENT =
  'There is no authentication in this build: any password signs you in, none is checked, and nothing here is protected.'

export const PROTOTYPE_WARNING =
  'This is a prototype for reviewing how the product works. It must not be put in front of a real home: anybody opening it would have full access to every resident’s clinical record.'
