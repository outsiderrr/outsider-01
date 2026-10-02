import { STANCES, getSet, poseAt, shoulderHipSeparation, solvePose, type Foot, type Pose, type Stance, type Stroke } from '../model';

export type Point2 = readonly [number, number];
interface GroundPose {
  feet: { left: Foot; right: Foot };
  pelvis: Point2;
  /** 按双脚承重比例加权的示意重心投影，不是实测身体质心。 */
  weightCenter: Point2;
}
export interface StanceSnapshot {
  value: number;
  from: Stance;
  to: Stance;
  mix: number;
  backswing: GroundPose & { shoulderYaw: number; hipYaw: number };
  contact: GroundPose & { point: Point2 };
  separation: number;
  weightShift: number;
  /** 击球拍面中心相对于当时骨盆、沿球网方向的距离（厘米）。 */
  contactAhead: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angle = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
const point = (a: Point2, b: Point2, t: number): Point2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const foot = (a: Foot, b: Foot, t: number): Foot => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), angle(a[2], b[2], t), lerp(a[3], b[3], t)];
const ground = (p: Pose): GroundPose => ({
  feet: { left: [...p.lf], right: [...p.rf] },
  pelvis: [p.pel[0], p.pel[1]],
  weightCenter: [p.lf[0] * p.w + p.rf[0] * (1 - p.w), p.lf[1] * p.w + p.rf[1] * (1 - p.w)],
});
const interpolateGround = (a: GroundPose, b: GroundPose, t: number): GroundPose => ({
  feet: { left: foot(a.feet.left, b.feet.left, t), right: foot(a.feet.right, b.feet.right, t) },
  pelvis: point(a.pelvis, b.pelvis, t),
  weightCenter: point(a.weightCenter, b.weightCenter, t),
});

function sample(stroke: Stroke, stance: Stance) {
  const set = getSet(stroke, stance);
  const back = poseAt(set, set.times[1]);
  const contact = poseAt(set, set.times[set.contactIndex]);
  const racket = solvePose(contact).racket.center;
  return {
    backswing: { ...ground(back), shoulderYaw: back.tor[0], hipYaw: back.pel[3] },
    contact: { ...ground(contact), point: [racket[0], racket[1]] as Point2 },
    separation: Math.abs(shoulderHipSeparation(back)),
  };
}

/** 0 / 0.5 / 1 分别是中性、半开放和开放。中间值用于比较图，不产生新的标准动作。 */
export function stanceSnapshot(stroke: Stroke, value: number): StanceSnapshot {
  value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
  const index = Math.min(1, Math.floor(value * 2));
  const from = STANCES[index]!, to = STANCES[index + 1]!;
  const mix = value * 2 - index;
  const a = sample(stroke, from), b = sample(stroke, to);
  const backswing = {
    ...interpolateGround(a.backswing, b.backswing, mix),
    shoulderYaw: angle(a.backswing.shoulderYaw, b.backswing.shoulderYaw, mix),
    hipYaw: angle(a.backswing.hipYaw, b.backswing.hipYaw, mix),
  };
  const contact = { ...interpolateGround(a.contact, b.contact, mix), point: point(a.contact.point, b.contact.point, mix) };
  return {
    value, from, to, mix, backswing, contact,
    separation: lerp(a.separation, b.separation, mix),
    weightShift: Math.hypot(contact.weightCenter[0] - backswing.weightCenter[0], contact.weightCenter[1] - backswing.weightCenter[1]),
    contactAhead: contact.point[1] - contact.pelvis[1],
  };
}
