import type { PhotoStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import styles from './Avatar.module.css'

/**
 * A resident's photograph, or their initials when there is none.
 *
 * PRD §2.4 makes the photo a control against wrong-subject writes, so this is
 * not decoration — it is one of the things a care worker checks before writing
 * against a record. Which is exactly why a missing photograph shows initials
 * rather than an anonymous silhouette: a silhouette looks the same for every
 * resident, and a control that cannot distinguish two people is not a control.
 *
 * The initials monogram is not hatched. A missing photograph is an identity
 * aid, not a clinical or compliance record, and spending the hatch on
 * non-clinical gaps would blunt the one signal that matters.
 */

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge'

/**
 * `neutral` is the record surface — a resident in a list or a profile header.
 * `brand` is chrome: the account pill in the top bar, which is the one avatar
 * on screen that is not a resident and should not be mistaken for one.
 */
export type AvatarTone = 'neutral' | 'brand'

export interface AvatarProps {
  photo: PhotoStatus
  /** Full name — used for the initials and for the accessible name. */
  name: string
  size?: AvatarSize
  tone?: AvatarTone
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  small: styles.small,
  medium: styles.medium,
  large: styles.large,
  xlarge: styles.xlarge,
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return `${first}${last}`
}

export function Avatar({
  photo,
  name,
  size = 'medium',
  tone = 'neutral',
}: AvatarProps) {
  const className = [
    styles.avatar,
    SIZE_CLASS[size],
    tone === 'brand' ? styles.brand : '',
  ]
    .filter(Boolean)
    .join(' ')

  switch (photo.kind) {
    case 'not_on_file':
      return (
        <span
          className={className}
          role="img"
          aria-label={`${name}, no photograph on file`}
        >
          <span aria-hidden="true">{initialsOf(name)}</span>
        </span>
      )

    case 'on_file':
      return (
        <span className={className}>
          <img className={styles.image} src={photo.url} alt={`Photograph of ${name}`} />
        </span>
      )

    default:
      return assertNever(photo)
  }
}
