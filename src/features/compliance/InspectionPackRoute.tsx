import { Link } from 'react-router-dom'
import { useSession } from '@/app/session/use-session'
import { Card } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { formatCount } from '@/lib/format'
import { NotHeldHere, PlaceholderBanner } from './ComplianceParts'
import { packContents } from './pack'
import { useComplianceData } from './use-compliance'
import styles from './compliance.module.css'

/**
 * The inspection pack. PRD §6.7, Phase 12.
 *
 * The sentence: **what the pack would contain, then what it cannot contain and
 * why, then the plain statement that no file can be produced here.**
 *
 * **The second section is the useful half and is longer than the first.** A
 * manager reading this before an inspection gets more from the gaps than from
 * the list, and the two kinds of gap are not the same kind: evidence the home
 * has not recorded is a gap somebody can close, evidence this product does not
 * hold is not.
 *
 * **There is no download control at all — not a disabled one.** There is no
 * file, and a disabled button implies there could be.
 */
export function InspectionPackRoute() {
  const { activeSite } = useSession()
  const data = useComplianceData()

  if (data === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Reading the whole record…</p>
      </div>
    )
  }

  const contents = packContents(data)

  return (
    <div className={styles.page} data-inspection-pack>
      <Link to=".." relative="path" className={styles.backLink} data-back-link>
        <Icon name="arrows-sharp/arrow-left-01-sharp" size={16} aria-hidden />
        Compliance
      </Link>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Inspection pack</h1>
          <p className={styles.pageSubtitle}>
            {activeSite.name} · what an inspector would be given, and what they would
            not
          </p>
        </div>
      </header>

      <PlaceholderBanner what="pack" />

      <Card>
        <section className={styles.packSection} data-pack-section="would-contain">
          <h2 className={styles.packHeading}>What the pack would contain</h2>
          <p className={styles.packNote}>
            Evidence that exists in the record, with where it lives.
          </p>
          <ul className={styles.packList}>
            {contents.holds.map((entry) => (
              <li key={entry.id} className={styles.packItem} data-pack-holds={entry.id}>
                <span>{entry.what}</span>
                <span className={styles.packCount} data-numeric>
                  {entry.count}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.packSection} data-pack-section="not-recorded">
          <h2 className={styles.packHeading}>
            What it cannot contain, because the home has not recorded it
          </h2>
          <p className={styles.packNote}>
            These are gaps somebody can close. Each names the screen that closes it.
          </p>
          <ul className={styles.packList}>
            {contents.gaps.map((entry) => (
              <li key={entry.id} data-pack-gap={entry.id}>
                <Link to={entry.to} className={styles.packGapLink}>
                  <Unrecorded
                    variant="row"
                    label={entry.what}
                    detail={`${entry.count} · ${entry.where}`}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.packSection} data-pack-section="not-held">
          <h2 className={styles.packHeading}>
            What it cannot contain, because diGi-Care does not hold it
          </h2>
          <p className={styles.packNote}>
            Nothing on any screen in this product can close these. They are gaps in the
            system rather than in the home, and an inspector will ask for them from
            somewhere else.
          </p>
          <ul className={styles.packList}>
            {contents.notHeld.map((entry) => (
              <li key={entry.id} data-pack-not-held={entry.id}>
                <span className={styles.packNotHeldRow}>
                  <NotHeldHere statement={entry.statement} />
                  <span className={styles.packWhere}>{entry.where}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.noFile} data-no-file data-state="unrecorded">
          <p className={styles.noFileTitle}>No file can be produced here.</p>
          <p className={styles.noFileBody}>
            This build has no backend and no file storage, so there is nothing to
            download and nothing has been generated. What is above is the manifest: the
            list of what a real pack would hold, what it would be missing, and why.
            There is no download control on this screen because there is no file; a
            disabled one would imply that there could be.
          </p>
          <p className={styles.noFileBody}>
            <span data-numeric>{formatCount(contents.holds.length)}</span> kinds of
            evidence would go in,{' '}
            <span data-numeric>{formatCount(contents.gaps.length)}</span> gaps the home
            can close would be missing, and{' '}
            <span data-numeric>{formatCount(contents.notHeld.length)}</span> things this
            product does not record would have to come from somewhere else.
          </p>
        </div>
      </Card>
    </div>
  )
}
