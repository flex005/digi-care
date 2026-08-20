import { Icon } from '@/components/icon/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/primitives'
import { shellIcons } from '@/app/nav-items.icons'
import { digiApps, NOT_LINKED } from '@/app/digi-apps'
import styles from './AppSwitcher.module.css'

/**
 * The diGi app switcher — the grid beside the alerts bell.
 *
 * Not named in PRD §4.7, which lists five things in the top bar and no sixth.
 * Added on request; flagged in PROGRESS.md so the document can catch up.
 *
 * The apps it lists come from `digi-apps.ts`, which carries the rule that
 * matters here: only apps the documents name. A launcher full of plausible
 * siblings would put fictional products in real chrome.
 *
 * Nothing here navigates, because there is nowhere to navigate to in a
 * frontend-only build. Each unreachable app says so **in visible text inside
 * the item**, not in a tooltip — a reason a keyboard user cannot reach is not
 * a reason. PRD §6.4's rule for the stubbed export applies: present, honest,
 * never a silent no-op.
 */
export function AppSwitcher() {
  return (
    <DropdownMenu>
      {/* aria-label plus tooltip: PRD §7's requirement for an icon-only
          control, which this is and the bell beside it now is too. */}
      <Tooltip content="diGi apps">
        <DropdownMenuTrigger className={styles.trigger} aria-label="diGi apps">
          <Icon name={shellIcons.appSwitcher} size={20} />
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end">
        {/* "Apps", not "diGi apps": the label style uppercases, and
            "DIGI APPS" mangles a brand whose casing is the point. The trigger's
            name keeps the full "diGi apps". */}
        <DropdownMenuLabel>Apps</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {digiApps.map((app) => (
          <DropdownMenuItem
            key={app.name}
            // Every one of them, current or not, has nowhere to go. Disabling
            // is the truthful state; a selectable item that did nothing would
            // be the silent no-op.
            disabled
            className={styles.app}
          >
            <span className={styles.appText}>
              <span className={styles.appName}>{app.name}</span>
              <span className={styles.appDescription}>{app.description}</span>
            </span>
            <span className={styles.appState}>
              {app.isCurrent ? 'Current app' : NOT_LINKED}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
