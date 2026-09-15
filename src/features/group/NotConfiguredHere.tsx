import styles from './group.module.css'

/**
 * What AM v2.0's settings screen has and this one does not. Phase 22.
 *
 * **Named rather than omitted, because a page that quietly leaves out what
 * somebody came looking for is its own failure.** Four of SETT-01's sections
 * are absent, and somebody who has read that document will scroll for them.
 *
 * **Inert, never hatched.** The hatch means nobody has looked, and it invites
 * completion; none of these is a gap anybody can close from this screen. They
 * are statements about what the product is.
 *
 * **Two reasons, not one, and the reader acts differently on each.** Two are
 * absent because the product has no server to do the thing at all, and two
 * because the switch would reach back and break records already on file.
 * Collapsing them into one list of four would lose the difference between
 * "this needs a backend" and "this needs a decision about existing records".
 *
 * **And no promise.** "Coming in a later phase" is what the sidebar said about
 * Reviews for nine phases after Reviews shipped. These say what is true now.
 */
const ABSENT: {
  id: string
  title: string
  because: 'no_server' | 'would_break_records'
  why: string
}[] = [
  {
    id: 'notifications',
    title: 'Notification settings',
    because: 'no_server',
    why: 'Which events alert whom, and through which channel. Nothing in this build sends anything: there is no server, no email and no push, so there is no delivery to configure. A read-only version would imply the thing exists in a disabled state.',
  },
  {
    id: 'data-export',
    title: 'Data export',
    because: 'no_server',
    why: 'A full export of the site, zipped and emailed within 24 hours. That needs a server, a mailbox and somewhere to put the file. A button here would be worse than its absence: a subject access request has a statutory clock, and somebody who believed they had started one would not start the real one.',
  },
  {
    id: 'family-portal-switch',
    title: 'Turning the Family Portal on or off for this home',
    because: 'would_break_records',
    why: 'Off would make every recorded Family Portal consent unusable, and every disclosure already made unreadable, from a screen that looks like preferences. A setting that silently invalidates records is worse than one that does nothing. The default access level, which applies only to the next decision, is on the Consent tab where it is used.',
  },
  {
    id: 'pharmacy-cycle',
    title: 'Turning the 28-day pharmacy cycle off',
    because: 'would_break_records',
    why: 'The cycle screen holds checked rows, four tallies and the finding that only it can produce: a drug still being given that the pharmacy has stopped supplying. Hiding the module would hide those records rather than end them.',
  },
]

const BECAUSE: Record<(typeof ABSENT)[number]['because'], string> = {
  no_server: 'Needs a server this build does not have',
  would_break_records: 'Would change what records already on file say',
}

export function NotConfiguredHere() {
  return (
    <section className={styles.settingsSection} data-not-configured>
      <h2 className={styles.settingsTitle}>Not configured here, and why</h2>
      <p className={styles.settingsNote}>
        Four sections of the source specification&rsquo;s settings screen are absent
        from this one. They are named because somebody who has read it will look for
        them, and a page that quietly omits what somebody came for is its own failure.
        None of these is a gap anybody can close.
      </p>

      <ul className={styles.absentList}>
        {ABSENT.map((entry) => (
          <li key={entry.id} className={styles.absentRow} data-absent={entry.id}>
            <span className={styles.absentWhy} data-because={entry.because}>
              {BECAUSE[entry.because]}
            </span>
            <span>
              <b className={styles.absentTitle}>{entry.title}</b>
              <span className={styles.absentBody}>{entry.why}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
