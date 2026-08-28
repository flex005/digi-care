import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons for the Dashboard's four figures.
 *
 * A map rather than names at the call site: the scanner reads the name
 * attribute on an Icon element in JSX, and a name handed to another component
 * as a prop is invisible to it. Every icon-shaped string in a file named for
 * icons counts as used, including any written in this comment, so none is.
 */
export const dashboardIcons = {
  overdue: 'alert-notification/alert-02',
  dueSoon: 'date-and-time/clock-01',
  /** A note with a cross: the note that is not there. */
  unwritten: 'note-task/note-remove',
  incidents: 'alert-notification/notification-01',
} satisfies Record<string, IconName>
