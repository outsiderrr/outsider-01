import { describe, expect, it } from 'vitest';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { chainCurves, peakTime, racketSpeed, shoulderHipSeparation } from '../src/model/metrics';

describe('metrics', () => {
  it('肩髋差 = 躯干朝向 − 骨盆朝向', () => {
    expect(shoulderHipSeparation(poseAt(FOREHAND.semi, 0))).toBeCloseTo(0);
    expect(shoulderHipSeparation(poseAt(FOREHAND.semi, 0.55))).toBeCloseTo(44);
  });
  it('击球时拍头速度在 10–30 m/s（业余水平的示意值）', () => {
    const v = racketSpeed(FOREHAND.semi, 0.92);
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(30);
  });
  it('发力链曲线各数组等长', () => {
    const c = chainCurves(FOREHAND.semi, 50);
    for (const k of ['t', 'pelvis', 'torso', 'arm', 'head'] as const) expect(c[k]).toHaveLength(51);
  });
  it('peakTime 取最大值所在时刻', () => {
    expect(peakTime([0, 1, 2], [3, 9, 4])).toBe(1);
  });
});
