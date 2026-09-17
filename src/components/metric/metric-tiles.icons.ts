import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons for the figure cards in Care notes, Handover and Medications.
 *
 * **A map rather than names written at each call site**, because the icon
 * scanner reads the name attribute on an Icon element in JSX, and a name
 * passed as a prop to another component is invisible to it. The name
 * typechecks, the generator sees no usage, and the screen throws at runtime,
 * which is exactly what happened here before this file existed.
 *
 * `scan-usage.mjs` treats every icon-shaped string in a file named for icons
 * as used. That includes strings in this comment, so there are none here: an
 * example name written above cost a build until it was taken out.
 */
export const metricIcons = {
  /** A note that exists. */
  notes: 'note-task/note-01',
  /** A note with a cross: the note that is not there. */
  notesMissing: 'note-task/note-remove',
  /** Everything on the record, rather than today's. */
  notesAll: 'note-task/note-03',
  alert: 'alert-notification/alert-02',
  urgent: 'alert-notification/alert-01',
  attention: 'alert-notification/notification-01',
  /** Reviewed and nothing outstanding. Not a success mark: a state. */
  settled: 'check-validation/checkmark-badge-01',
  waiting: 'date-and-time/clock-01',
  /**
   * Somebody looked at a gap and said why. Not a tick: a closed omission is
   * still a dose with no record, and a success mark would say otherwise.
   */
  looked: 'users/user-search-01',
  doses: 'medical/medicine-01',
} satisfies Record<string, IconName>
