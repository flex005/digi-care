import type { CommunalAreaId, IncidentTypeId } from '@/data/types'
import { COMMUNAL_AREAS, INCIDENT_TYPES } from '@/data/types'
import { Select } from '@/components/primitives'
import { useTerm, useTerms } from '@/app/session/use-term'
import { SectionHeading, type HeadingLevel } from './SectionHeading'
import styles from './incidents.module.css'

/** Where it happened, as the two forms both need to express it. */
export type AreaChoice = CommunalAreaId | 'resident_room' | 'not_recorded' | ''

/**
 * What happened: the type, where, when, who saw it, and the account.
 *
 * Extracted so the correction modal renders this markup rather than its own
 * plainer version of the same five fields. Every hint and placeholder is the
 * report form's, because those are the feel as much as the layout is.
 */
export function WhatHappenedSection({
  type,
  onType,
  occurredAt,
  onOccurredAt,
  area,
  onArea,
  room,
  onRoom,
  witnessChoice,
  onWitnessChoice,
  witnessNames,
  onWitnessNames,
  description,
  onDescription,
  level = 'h2',
}: {
  type: IncidentTypeId | ''
  onType: (value: IncidentTypeId) => void
  occurredAt: string
  onOccurredAt: (value: string) => void
  area: AreaChoice
  onArea: (value: AreaChoice) => void
  /** Supplied only where the caller can hold a typed room. */
  room?: string
  onRoom?: (value: string) => void
  witnessChoice: 'nobody' | 'witnessed' | ''
  onWitnessChoice: (value: 'nobody' | 'witnessed') => void
  witnessNames: string
  onWitnessNames: (value: string) => void
  description: string
  onDescription: (value: string) => void
  level?: HeadingLevel
}) {
  const term = useTerm()
  const terms = useTerms()

  return (
    <section className={styles.section} aria-labelledby="what-heading">
      <SectionHeading level={level} id="what-heading">
        What happened
      </SectionHeading>

      <div className={styles.twoUp}>
        <Select
          labelVisible
          label="Type"
          placeholder="Choose a type"
          value={type === '' ? undefined : type}
          onValueChange={(value) => onType(value as IncidentTypeId)}
          options={INCIDENT_TYPES.map((entry) => ({
            value: entry.id,
            label: entry.name,
          }))}
        />
        <label className={styles.field}>
          <span className={styles.label}>When it happened</span>
          <input
            className={styles.input}
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => onOccurredAt(event.target.value)}
          />
          <span className={styles.hint}>Not when you are writing this up.</span>
        </label>
      </div>

      <div className={styles.twoUp}>
        <Select
          labelVisible
          label="Where"
          placeholder="Choose a place"
          value={area === '' ? undefined : area}
          onValueChange={(value) => onArea(value as AreaChoice)}
          options={[
            { value: 'resident_room', label: `The ${term.ones} own room` },
            ...COMMUNAL_AREAS.map((entry) => ({
              value: entry.id,
              label: entry.name,
            })),
          ]}
        />

        {/* Asked, never left blank. "Leave blank if nobody saw it" would
            make an empty field mean either "nobody saw it" or "nobody
            recorded who" — and on an unwitnessed fall that is the
            difference the record turns on. */}
        <div className={styles.field}>
          <Select
            labelVisible
            label="Anyone who saw it"
            placeholder="Choose an answer"
            value={witnessChoice === '' ? undefined : witnessChoice}
            onValueChange={(value) => onWitnessChoice(value as 'nobody' | 'witnessed')}
            options={[
              { value: 'nobody', label: 'Nobody saw it happen' },
              { value: 'witnessed', label: 'Somebody saw it' },
            ]}
          />
          {witnessChoice === 'witnessed' ? (
            <input
              className={styles.input}
              type="text"
              value={witnessNames}
              onChange={(event) => onWitnessNames(event.target.value)}
              placeholder="Who saw it"
              aria-label="Who saw it"
            />
          ) : null}
        </div>
      </div>

      {/*
        **Only where a caller can hold one.** On the report route the subject is a
        resident, so `resident_room` resolves to the room the record already
        knows. A correction may be about an incident with no resident at all, so
        there the room is typed and `onRoom` is supplied.
      */}
      {onRoom === undefined || area !== 'resident_room' ? null : (
        <label className={styles.field}>
          <span className={styles.label}>Room</span>
          <input
            className={styles.input}
            type="text"
            value={room ?? ''}
            data-correct-room
            onChange={(event) => onRoom(event.target.value)}
          />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>In your own words</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder={`What you found, what you saw, what the ${term.one} said.`}
        />
        <span className={styles.hint}>
          Written for whoever reads this next: a {terms.manager.one} tonight, an
          inspector in a year.
        </span>
      </label>
    </section>
  )
}
