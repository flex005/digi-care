import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons for the analytics tiles.
 *
 * Named *.icons.ts deliberately. An icon name written in a plain object
 * literal in an ordinary .ts file is invisible to the usage scanner: it drops
 * out of the generated registry, `icons:check` still reports the registry
 * current — correctly, for the wrong input — and the screen throws at runtime.
 * That happened on 20/08/2026 with the /dev/states nav item.
 *
 * `TileId` lives here rather than in analytics-tiles.ts so the map below can
 * be `satisfies Record<TileId, IconName>` without the two files importing each
 * other. A tile cannot be added without an icon.
 */
export type TileId = 'residents' | 'critical' | 'reviews' | 'notes' | 'falls'

export const tileIcons = {
  residents: 'users/user-multiple',
  critical: 'alert-notification/alert-02',
  /** A blocked calendar — the tile counts never-scheduled as well as overdue. */
  reviews: 'date-and-time/calendar-block-01',
  /** A note with a cross: the note that is not there. */
  notes: 'note-task/note-remove',
  /** Not assessed is not examined. */
  falls: 'medical/stethoscope',
} satisfies Record<TileId, IconName>
