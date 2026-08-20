import type { ReactNode } from 'react'
import {
  AllergyBadge,
  DomainStatusBadge,
  EolcBadge,
  IsolationBadge,
  MoodBadge,
  SupportLevelBadge,
} from '@/components/status'
import { Avatar } from '@/components/primitives'
import {
  allergyStates,
  domainStatusStates,
  eolcStates,
  isolationStates,
  moodStates,
  photoStates,
  supportLevelStates,
} from './states.fixtures'
import styles from './dev.module.css'

/**
 * Every state of every union Phase 1 introduced. Same discipline as
 * `StatusStates` — the lists come from `states.fixtures.ts`, which is typed so
 * that adding a member to any of these breaks the build until an example
 * exists here and is therefore visible on this page.
 */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.stack}>{children}</div>
    </div>
  )
}

export function Phase1States() {
  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>AllergyStatus — three states</h2>
        <p className={styles.sectionNote}>
          The sharpest case in the product. Three members rather than{' '}
          <code>Recorded&lt;Allergy[]&gt;</code>, because an empty array meaning
          “confirmed none known” would put the most consequential distinction here one{' '}
          <code>.length</code> check away from being lost. A care worker about to give
          penicillin must be able to tell all three apart from across the room.
        </p>
        {Object.entries(allergyStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <AllergyBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>EolcStatus</h2>
        <p className={styles.sectionNote}>
          Rendered in <strong>info blue</strong>, deliberately departing from source PRD
          §16.3’s grey — grey is reserved system-wide for unrecorded, so a recorded EOLC
          decision in grey would read as “nobody has looked”. Check it against DNAR and
          ISOLATION with greyscale on: the three recorded states must stay mutually
          distinguishable, and none of them may read as the hatch.
        </p>
        {Object.entries(eolcStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <EolcBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>IsolationStatus</h2>
        <p className={styles.sectionNote}>
          “Not isolating” is a recorded observation, not an absence. Somebody checked
          this morning, versus nobody has said.
        </p>
        {Object.entries(isolationStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <IsolationBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>SupportLevel</h2>
        <p className={styles.sectionNote}>
          “Independent” and “nobody has assessed them” are opposite claims about a
          person’s safety. Reading the second as the first is how somebody gets left to
          manage the stairs alone.
        </p>
        {Object.entries(supportLevelStates).map(([kind, levels]) => (
          <Group key={kind} title={kind}>
            {levels.map((level, index) => (
              <SupportLevelBadge key={index} level={level} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>CarePlanDomainStatus</h2>
        <p className={styles.sectionNote}>
          Not Started, In Progress, Complete and Review Due must all be distinguishable
          (PRD §6.7). Not Started is hatched: a domain nobody has written is a hole in
          the care plan, and the Needs tab lists all ten domains whether or not they
          have content.
        </p>
        {Object.entries(domainStatusStates).map(([kind, states]) => (
          <Group key={kind} title={kind}>
            {states.map((status, index) => (
              <DomainStatusBadge key={index} status={status} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>MoodRecord</h2>
        <p className={styles.sectionNote}>
          Always a word, never a face alone. A note without a mood recorded is hatched,
          not neutral — a care worker who did not record how somebody seemed has not
          recorded that they seemed fine.
        </p>
        {Object.entries(moodStates).map(([kind, moods]) => (
          <Group key={kind} title={kind}>
            {moods.map((mood, index) => (
              <MoodBadge key={index} mood={mood} />
            ))}
          </Group>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>PhotoStatus</h2>
        <p className={styles.sectionNote}>
          No resident in the fixtures has a photograph on file, so all 32 render an
          initials monogram — which is what the system genuinely shows in the absence of
          a photograph, not a stand-in for one. The <code>on_file</code> branch is
          exercised here against a synthetic sample so it is not dead code; that sample
          is dev-only and never appears on a real screen. When real photographs arrive
          they drop into the fixtures and this branch lights up with no code change.
        </p>
        <div className={styles.row}>
          <div className={styles.stack}>
            <span className={styles.groupTitle}>not_on_file — initials monogram</span>
            <Avatar
              photo={photoStates.not_on_file[0]}
              name="Emmanuel Okafor"
              size="large"
            />
          </div>
          <div className={styles.stack}>
            <span className={styles.groupTitle}>on_file — synthetic sample</span>
            <Avatar
              photo={photoStates.on_file[0]}
              name="Emmanuel Okafor"
              size="large"
            />
          </div>
        </div>
      </section>
    </>
  )
}
