import type { ResidentAssignment, StaffMember } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { residentsBySite } from '@/data/fixtures/residents'
import { formatDate, pluralise } from '@/lib/format'
import styles from './team.module.css'

/**
 * Which residents a care worker has been given. AM v2.0 TM-03, Phase 18.
 *
 * **It renders only for a care worker**, which is the rule that replaces a
 * fourth union member: `not_applicable` would be derivable from the role the
 * record already carries, and a derivable member is a second owner of a fact.
 * So the question is asked where it means something and not asked elsewhere,
 * and `check-assignment-reach.mjs` holds the other half — that no other role
 * carries anything but `never_set`.
 *
 * **Never a count on its own.** A list of six residents beside another
 * person's one is a workload comparison with no denominator, which is the
 * figure Phase 14 refused to put on this screen. The names are here because an
 * Admin editing an assignment needs to see what it is; the number that would
 * make it a ranking is not.
 *
 * **The whole-home answer is a decision, not a blank.** AM v2.0 says leaving
 * the field empty means the care worker sees everybody, which would make a
 * blank mean either that or nobody having decided. Those are opposite facts
 * and the second takes the hatch.
 */
export function AssignmentSection({ member }: { member: StaffMember }) {
  if (member.role !== 'care_worker') return null

  const assignment: ResidentAssignment = member.residentAssignment

  return (
    <section className={styles.section} data-assignment={assignment.kind}>
      <h2 className={styles.sectionTitle}>Residents</h2>
      <p className={styles.sectionNote}>
        Who this care worker has been given. It decides what they see in the care worker
        app and nothing on this platform: no figure here is filtered by it, and no gap
        is attributed to whoever was assigned.
      </p>

      {assignment.kind === 'never_set' ? (
        <Unrecorded
          variant="panel"
          label="Nobody has decided"
          detail={`Nobody has recorded which residents ${member.ref.fullName} covers. That is not the same as covering everybody: somebody deciding they cover the whole home is a decision with a name on it, and this is the absence of one.`}
        />
      ) : assignment.kind === 'all_residents_at_site' ? (
        <div className={styles.assignmentSettled}>
          <p className={styles.assignmentValue}>Every resident at this home</p>
          <p className={styles.byline}>
            Decided by <strong>{assignment.decidedBy.fullName}</strong> ·{' '}
            <span data-numeric>{formatDate(assignment.on)}</span>
          </p>
        </div>
      ) : (
        <div className={styles.assignmentSettled}>
          <ul className={styles.assignmentList}>
            {assignment.residents.map((residentId) => {
              const resident = member.siteIds
                .flatMap((siteId) => residentsBySite(siteId))
                .find((entry) => entry.id === residentId)
              return (
                <li key={residentId} data-assigned-resident={residentId}>
                  {resident === undefined ? (
                    /*
                     * A named resident who is not at any of this person's
                     * homes. A broken reference is a finding rather than a row
                     * to drop: dropping it would make an assignment that
                     * points nowhere look like one nobody made.
                     */
                    <span data-assignment-broken={residentId}>
                      {residentId}, who is not at{' '}
                      {pluralise(member.siteIds.length, 'this home')}
                    </span>
                  ) : (
                    <>
                      <span className={styles.assignmentName}>
                        {resident.preferredName}
                      </span>
                      <span className={styles.assignmentRoom}>
                        {resident.fullLegalName}
                      </span>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <p className={styles.byline}>
            Decided by <strong>{assignment.decidedBy.fullName}</strong> ·{' '}
            <span data-numeric>{formatDate(assignment.on)}</span>
          </p>
        </div>
      )}
    </section>
  )
}
