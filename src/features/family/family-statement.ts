/**
 * What to say where a screen records a disclosure that reaches nobody.
 *
 * **This build's only dangerous stub, and the danger is specific.** Everywhere
 * else a stub costs a reader a file: the MAR export, the inspection pack and
 * the data export all say what they would produce and produce nothing, and
 * believing them harms nobody. These three screens are different — a manager
 * who reads "Shared with family" as *the family were told* **may not telephone
 * them**, and for an incident that is a family not hearing that their relative
 * fell. The screen did not cause the harm; it occupied the place where the
 * decision to ring would have been made.
 *
 * Three things follow, and none of them is a banner.
 *
 * **It cannot sit behind a click.** Every other statement in this build is one
 * click away, on the control it is about, because a paragraph in front of a
 * form is a paragraph nobody reads. Here the risk is precisely somebody not
 * clicking, which inverts the argument.
 *
 * **It is an instruction, not a caveat.** "This is a prototype" tells somebody
 * about the software. "Telephone them" tells somebody what to do, which is the
 * thing that was about to not happen.
 *
 * **One owner, so three screens cannot drift into three wordings.** The one
 * that goes stale is always whichever the reader is looking at.
 */

/**
 * What to do instead, at the moment of the act.
 *
 * Phrased per screen because the action differs: an incident is urgent and a
 * care note is not, and one instruction covering both would be wrong for each.
 */
export const TELL_THEM = {
  incident: 'Nobody has been told: if this family needs to know today, telephone them.',
  note: 'Nobody has been told: this only records that the note could be shown.',
  access: 'Nothing is sent to them: tell them yourself that they have access.',
} as const

/**
 * What a family member's state is called, and what it must never be called.
 *
 * **Never "Invited".** It implies an email in flight and a status that will
 * turn Active, and here nothing was sent and nothing can activate: the state
 * would be permanent and its name would be a promise about a thing that cannot
 * happen. What it is, is a decision recorded here.
 */
export const ACCESS_RECORDED = 'Recorded here, nothing sent'
