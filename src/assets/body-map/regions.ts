import type { BodyRegionId } from '@/data/types'

/**
 * The body map's geometry. CLAUDE.md §3, the one named exception to the icon
 * rule.
 *
 * **This is not an icon and not a drawing.** It is a labelled interactive
 * diagram whose regions are data: every shape carries a `BodyRegionId` from
 * the closed list, and every one becomes a real button with an accessible
 * name. The exception is bounded to this directory and is not permission for
 * inline SVG anywhere else.
 *
 * Shapes are described rather than written as markup, so nothing here is an
 * SVG string that could drift from the ids beside it — the component turns
 * these into elements and cannot render a region the union does not name.
 *
 * ## Left and right are the resident's
 *
 * Not the viewer's. The resident's **left** arm is drawn on the **right** of
 * the front view and on the **left** of the back view, exactly as it would be
 * if you were standing in front of them and then walked round.
 *
 * Getting this wrong in a care record is a clinical error rather than a
 * labelling one — a bruise recorded on the wrong arm sends somebody looking at
 * the wrong limb — so the coordinates are mirrored between the views and every
 * label says which side it is.
 */

export type RegionShape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; r: number }

export interface MappedRegion {
  id: BodyRegionId
  /** What the button is called. Always names the side where there is one. */
  label: string
  shape: RegionShape
}

export const BODY_MAP_VIEWBOX = { width: 200, height: 345 }

const ellipse = (cx: number, cy: number, rx: number, ry: number): RegionShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
})

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
): RegionShape => ({ kind: 'rect', x, y, width, height, r })

/**
 * Facing the resident.
 *
 * Their left is on the viewer's right, which is why `shoulder_left` sits at
 * x=130 and `shoulder_right` at x=70.
 */
export const FRONT_REGIONS: MappedRegion[] = [
  { id: 'head', label: 'Head', shape: ellipse(100, 30, 21, 25) },
  { id: 'face', label: 'Face', shape: ellipse(100, 36, 13, 15) },
  { id: 'neck', label: 'Neck', shape: rect(90, 53, 20, 13, 4) },
  { id: 'shoulder_right', label: 'Right shoulder', shape: ellipse(70, 76, 15, 11) },
  { id: 'shoulder_left', label: 'Left shoulder', shape: ellipse(130, 76, 15, 11) },
  { id: 'chest', label: 'Chest', shape: rect(76, 68, 48, 46, 8) },
  { id: 'abdomen', label: 'Abdomen', shape: rect(78, 116, 44, 44, 8) },
  { id: 'upper_arm_right', label: 'Right upper arm', shape: rect(50, 82, 18, 46, 8) },
  { id: 'upper_arm_left', label: 'Left upper arm', shape: rect(132, 82, 18, 46, 8) },
  { id: 'elbow_right', label: 'Right elbow', shape: rect(49, 128, 18, 15, 6) },
  { id: 'elbow_left', label: 'Left elbow', shape: rect(133, 128, 18, 15, 6) },
  { id: 'forearm_right', label: 'Right forearm', shape: rect(47, 143, 18, 42, 8) },
  { id: 'forearm_left', label: 'Left forearm', shape: rect(135, 143, 18, 42, 8) },
  { id: 'hand_right', label: 'Right hand', shape: ellipse(56, 196, 11, 13) },
  { id: 'hand_left', label: 'Left hand', shape: ellipse(144, 196, 11, 13) },
  { id: 'hip_right', label: 'Right hip', shape: ellipse(84, 168, 14, 11) },
  { id: 'hip_left', label: 'Left hip', shape: ellipse(116, 168, 14, 11) },
  { id: 'thigh_right', label: 'Right thigh', shape: rect(76, 176, 21, 58, 9) },
  { id: 'thigh_left', label: 'Left thigh', shape: rect(103, 176, 21, 58, 9) },
  { id: 'knee_right', label: 'Right knee', shape: rect(76, 234, 21, 17, 7) },
  { id: 'knee_left', label: 'Left knee', shape: rect(103, 234, 21, 17, 7) },
  { id: 'shin_right', label: 'Right shin', shape: rect(77, 251, 19, 52, 8) },
  { id: 'shin_left', label: 'Left shin', shape: rect(104, 251, 19, 52, 8) },
  { id: 'ankle_right', label: 'Right ankle', shape: rect(78, 303, 17, 13, 5) },
  { id: 'ankle_left', label: 'Left ankle', shape: rect(105, 303, 17, 13, 5) },
  { id: 'foot_right', label: 'Right foot', shape: ellipse(86, 325, 12, 9) },
  { id: 'foot_left', label: 'Left foot', shape: ellipse(114, 325, 12, 9) },
]

/**
 * Standing behind the resident.
 *
 * Their left is now on the viewer's left, so every paired region's x is the
 * mirror of its position on the front view. `shoulder_left` sits at x=70 here
 * and at x=130 there, and it is the same shoulder.
 */
export const BACK_REGIONS: MappedRegion[] = [
  { id: 'head', label: 'Back of head', shape: ellipse(100, 30, 21, 25) },
  { id: 'neck', label: 'Back of neck', shape: rect(90, 53, 20, 13, 4) },
  { id: 'shoulder_left', label: 'Left shoulder', shape: ellipse(70, 76, 15, 11) },
  { id: 'shoulder_right', label: 'Right shoulder', shape: ellipse(130, 76, 15, 11) },
  { id: 'back_upper', label: 'Upper back', shape: rect(76, 68, 48, 46, 8) },
  { id: 'back_lower', label: 'Lower back', shape: rect(78, 116, 44, 38, 8) },
  { id: 'sacrum', label: 'Sacrum', shape: ellipse(100, 163, 17, 12) },
  { id: 'buttock_left', label: 'Left buttock', shape: ellipse(84, 182, 16, 14) },
  { id: 'buttock_right', label: 'Right buttock', shape: ellipse(116, 182, 16, 14) },
  { id: 'upper_arm_left', label: 'Left upper arm', shape: rect(50, 82, 18, 46, 8) },
  { id: 'upper_arm_right', label: 'Right upper arm', shape: rect(132, 82, 18, 46, 8) },
  { id: 'elbow_left', label: 'Left elbow', shape: rect(49, 128, 18, 15, 6) },
  { id: 'elbow_right', label: 'Right elbow', shape: rect(133, 128, 18, 15, 6) },
  { id: 'forearm_left', label: 'Left forearm', shape: rect(47, 143, 18, 42, 8) },
  { id: 'forearm_right', label: 'Right forearm', shape: rect(135, 143, 18, 42, 8) },
  { id: 'hand_left', label: 'Left hand', shape: ellipse(56, 196, 11, 13) },
  { id: 'hand_right', label: 'Right hand', shape: ellipse(144, 196, 11, 13) },
  { id: 'thigh_left', label: 'Left thigh', shape: rect(76, 196, 21, 46, 9) },
  { id: 'thigh_right', label: 'Right thigh', shape: rect(103, 196, 21, 46, 9) },
  { id: 'knee_left', label: 'Left knee', shape: rect(76, 242, 21, 15, 7) },
  { id: 'knee_right', label: 'Right knee', shape: rect(103, 242, 21, 15, 7) },
  { id: 'calf_left', label: 'Left calf', shape: rect(77, 257, 19, 48, 8) },
  { id: 'calf_right', label: 'Right calf', shape: rect(104, 257, 19, 48, 8) },
  { id: 'ankle_left', label: 'Left ankle', shape: rect(78, 305, 17, 12, 5) },
  { id: 'ankle_right', label: 'Right ankle', shape: rect(105, 305, 17, 12, 5) },
  { id: 'heel_left', label: 'Left heel', shape: ellipse(86, 325, 11, 9) },
  { id: 'heel_right', label: 'Right heel', shape: ellipse(114, 325, 11, 9) },
]

/**
 * What a marked site is called in the list beside the map.
 *
 * **The list is the record**, so its wording is the record's wording. The
 * front view calls the head "Head" and the back view "Back of head"; the site
 * is one region and reads as one name wherever it was marked from.
 */
const LIST_LABELS: Partial<Record<BodyRegionId, string>> = {
  head: 'Head',
  neck: 'Neck',
}

export function regionLabel(id: BodyRegionId): string {
  const named = LIST_LABELS[id]
  if (named) return named
  const found =
    FRONT_REGIONS.find((region) => region.id === id) ??
    BACK_REGIONS.find((region) => region.id === id)
  return found?.label ?? id
}

/** Which views a region can be marked from. Used by the tests, not the screen. */
export function viewsFor(id: BodyRegionId): ('front' | 'back')[] {
  const views: ('front' | 'back')[] = []
  if (FRONT_REGIONS.some((region) => region.id === id)) views.push('front')
  if (BACK_REGIONS.some((region) => region.id === id)) views.push('back')
  return views
}
