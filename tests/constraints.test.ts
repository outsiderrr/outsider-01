import { describe, expect, it } from 'vitest';
import { BODY } from '../src/model/body';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { chainCurves, peakTime, racketSpeed } from '../src/model/metrics';
import { solvePose } from '../src/model/solve';
import type { KeyframeSet } from '../src/model/types';
import { angleBetween, dist, lerp3, sub, type Vec3 } from '../src/model/vec';

const END = (s: KeyframeSet) => s.times[s.times.length - 1];
const CONTACT = (s: KeyframeSet) => s.times[s.contactIndex];
const LEG_CLAMP = (BODY.thigh + BODY.shin - 0.5) / (BODY.thigh + BODY.shin);

function racketPath(set: KeyframeSet, n = 6000): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) out.push(solvePose(poseAt(set, (END(set) * i) / n)).racket.center);
  return out;
}

/** 按弧长每 step cm 重新取点 */
function resample(points: Vec3[], step: number): Vec3[] {
  const out: Vec3[] = [points[0]];
  let a = points[0];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    let seg = dist(a, b);
    while (carry + seg >= step) {
      a = lerp3(a, b, (step - carry) / seg);
      out.push(a);
      seg = dist(a, b);
      carry = 0;
    }
    carry += seg;
    a = b;
  }
  return out;
}

function maxTurnDeg(points: Vec3[]): number {
  let max = 0;
  for (let i = 2; i < points.length; i++) {
    max = Math.max(max, angleBetween(sub(points[i - 1], points[i - 2]), sub(points[i], points[i - 1])));
  }
  return max;
}

export function checkConstraints(label: string, set: KeyframeSet) {
  describe(label, () => {
    it('1. 拍头轨迹没有折角：每 1 cm 一段，相邻段转角 < 4°', () => {
      expect(maxTurnDeg(resample(racketPath(set), 1))).toBeLessThan(4);
    });

    it('2. 拍头速度峰值在击球前后 0.03 秒内', () => {
      let best = 0;
      let bestT = 0;
      for (let t = 0.6; t <= END(set); t += 0.002) {
        const v = racketSpeed(set, t);
        if (v > best) {
          best = v;
          bestT = t;
        }
      }
      expect(Math.abs(bestT - CONTACT(set))).toBeLessThanOrEqual(0.03);
    });

    it('3. 发力顺序：骨盆 → 躯干 → 手臂 → 拍头，拍头峰值在击球前后 0.05 秒内', () => {
      const c = chainCurves(set, 400);
      const tp = peakTime(c.t, c.pelvis);
      const tt = peakTime(c.t, c.torso);
      const ta = peakTime(c.t, c.arm);
      const th = peakTime(c.t, c.head);
      expect(tp).toBeLessThan(tt);
      expect(tt).toBeLessThan(ta);
      expect(ta).toBeLessThan(th);
      expect(Math.abs(th - CONTACT(set))).toBeLessThanOrEqual(0.05);
    });

    it('4. 踩稳的脚不打滑：脚尖漂移 < 0.5 cm', () => {
      for (let k = 0; k < set.frames.length - 1; k++) {
        for (const side of ['lf', 'rf'] as const) {
          const a = set.frames[k][side];
          const b = set.frames[k + 1][side];
          if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) continue;
          const foot = side === 'lf' ? 'footL' : 'footR';
          const toe0 = solvePose(poseAt(set, set.times[k]))[foot].toe;
          for (let s = 1; s <= 20; s++) {
            const t = set.times[k] + ((set.times[k + 1] - set.times[k]) * s) / 20;
            expect(dist(solvePose(poseAt(set, t))[foot].toe, toe0)).toBeLessThan(0.5);
          }
        }
      }
    });

    it('5. 骨段长度恒定，腿始终够得着地面', () => {
      for (let i = 0; i <= 200; i++) {
        const j = solvePose(poseAt(set, (END(set) * i) / 200));
        expect(j.reach.legL).toBeLessThan(LEG_CLAMP);
        expect(j.reach.legR).toBeLessThan(LEG_CLAMP);
        expect(Math.abs(dist(j.hipL, j.kneeL) - BODY.thigh)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.kneeR, j.footR.ankle) - BODY.shin)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.shoulderL, j.elbowL) - BODY.upperArm)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.elbowR, j.wristR) - BODY.forearm)).toBeLessThan(0.5);
      }
    });

    it('6. 左手握拍时不脱手：误差 < 1 cm', () => {
      for (let i = 0; i <= 200; i++) {
        const p = poseAt(set, (END(set) * i) / 200);
        if (p.lt < 0.99) continue;
        expect(solvePose(p).gripError).toBeLessThan(1);
      }
    });
  });
}

for (const [stance, set] of Object.entries(FOREHAND)) checkConstraints(`forehand/${stance}`, set);
