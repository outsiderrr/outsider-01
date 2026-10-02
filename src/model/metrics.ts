import { poseAt } from './interp';
import { solvePose } from './solve';
import type { KeyframeSet, Pose } from './types';
import { DEG, dist, lerp3 } from './vec';

/** 肩髋差（度）：躯干朝向减骨盆朝向 */
export const shoulderHipSeparation = (p: Pose): number => p.tor[0] - p.pel[3];

/** 拍头（拍面中心）速度，m/s */
export function racketSpeed(set: KeyframeSet, t: number, h = 0.002): number {
  const a = solvePose(poseAt(set, t - h)).racket.center;
  const b = solvePose(poseAt(set, t + h)).racket.center;
  return dist(a, b) / (2 * h) / 100;
}

export interface ChainCurves {
  t: number[];
  /** 骨盆转速，度/秒，正值表示朝击球方向转 */
  pelvis: number[];
  /** 躯干转速，度/秒 */
  torso: number[];
  /** 手腕绕骨盆竖轴的角速度，度/秒 */
  arm: number[];
  /** 拍头线速度，m/s */
  head: number[];
}

const wrap180 = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/** 图 01 的发力链曲线：从引拍结束到随挥结束 */
export function chainCurves(set: KeyframeSet, n = 300): ChainCurves {
  const t0 = set.times[1];
  const t1 = set.times[set.times.length - 1];
  const sign = set.stroke === 'forehand' ? -1 : 1;
  const h = 0.002;
  const armAngle = (t: number): number => {
    const p = poseAt(set, t);
    const j = solvePose(p);
    const w = set.stroke === 'forehand' ? j.wristR : lerp3(j.wristR, j.wristL, 0.5);
    return Math.atan2(w[0] - p.pel[0], w[1] - p.pel[1]) / DEG;
  };
  const out: ChainCurves = { t: [], pelvis: [], torso: [], arm: [], head: [] };
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const a = poseAt(set, t - h);
    const b = poseAt(set, t + h);
    out.t.push(t);
    out.pelvis.push((sign * (b.pel[3] - a.pel[3])) / (2 * h));
    out.torso.push((sign * (b.tor[0] - a.tor[0])) / (2 * h));
    out.arm.push((sign * wrap180(armAngle(t + h) - armAngle(t - h))) / (2 * h));
    out.head.push(dist(solvePose(a).racket.center, solvePose(b).racket.center) / (2 * h) / 100);
  }
  return out;
}

/** 曲线最大值所在的时刻 */
export function peakTime(t: readonly number[], v: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return t[best];
}
