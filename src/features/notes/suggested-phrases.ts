import type { CareNoteCategoryId } from '@/data/types'

/**
 * Category-based suggested phrases for the composer. PRD §6.3.
 *
 * **Openers, not answers.** Every one is a fragment that has to be finished:
 * "Ate ", "Declined ", "Observations taken: ". A suggestion that completes a
 * sentence gets pressed instead of typed, and a care record filled with
 * identical sentences is a record nobody wrote — it looks like evidence and
 * contains none.
 *
 * That is why none of these carries a judgement either. There is no "settled
 * throughout" and no "no concerns": those are findings, and a button that
 * writes a finding is a button that records something nobody observed.
 */
export const SUGGESTED_PHRASES: Record<CareNoteCategoryId, string[]> = {
  personal_care: ['Supported with ', 'Declined ', 'Chose ', 'Skin checked: '],
  nutrition: ['Ate ', 'Drank ', 'Needed prompting with ', 'Fluid chart updated: '],
  mobility: ['Walked to ', 'Transferred using ', 'Reluctant to ', 'Used the '],
  medication: [
    'Administered as prescribed: ',
    'Refused ',
    'PRN given for ',
    'GP contacted about ',
  ],
  /*
   * **"Family visited: " keeps the word, and this is the one place the term is
   * refused on purpose.** These are not labels: pressing one puts the text into
   * a care note, and a care note is immutable after submission. A configured
   * word inside recorded free text would leave the same home's notes saying
   * "Family visited" before a term change and "Next of Kin visited" after it,
   * which is the one thing `vocabulary.ts` says this is safe because it never
   * does — a claim about presentation, not about what a record says.
   */
  social_emotional: ['Joined ', 'Talked about ', 'Family visited: ', 'Preferred to '],
  health_observation: [
    'Observations taken: ',
    'Reported ',
    'Skin: ',
    'GP informed of ',
  ],
  behaviour: [
    'Became distressed when ',
    'Settled after ',
    'Called out ',
    'Approach that worked: ',
  ],
  general: ['Slept ', 'Spent the morning ', 'Spent the afternoon ', 'Visitors: '],
}
