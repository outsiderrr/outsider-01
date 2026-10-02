import { describe, expect, it } from 'vitest';
import { SETS } from '../src/model';
import { hermite, poseAt, segmentAt, tangent } from '../src/model/interp';
import { STANCES, STROKES } from '../src/model/types';

describe('hermite / tangent', () => {
  it('首尾切线为 0', () => {
    expect(tangent([0, 1, 2], [0, 1, 2], 0, -1)).toBe(0);
    expect(tangent([0, 1, 2], [0, 1, 2], 2, -1)).toBe(0);
  });
  it('均匀直线的中间切线等于斜率', () => {
    expect(tangent([0, 1, 2], [0, 1, 2], 1, -1)).toBeCloseTo(1);
  });
  it('击球帧：来球一侧更陡时取该侧割线', () => {
    // 0→10 用 0.1 秒（斜率 100），10→12 用 0.3 秒（斜率约 6.7）
    expect(tangent([0, 10, 12], [0, 0.1, 0.4], 1, 1)).toBeCloseTo(100);
    expect(tangent([0, 10, 12], [0, 0.1, 0.4], 1, -1)).toBeLessThan(100);
  });
  it('hermite 经过关键帧', () => {
    const v = [0, 5, 3, 8];
    const T = [0, 1, 1.5, 3];
    expect(hermite(v, T, 1, 0, -1)).toBeCloseTo(5);
    expect(hermite(v, T, 1, 1, -1)).toBeCloseTo(3);
  });
  it('segmentAt 定位并夹紧到范围内', () => {
    expect(segmentAt([0, 1, 2], -1)).toEqual({ i: 0, s: 0 });
    expect(segmentAt([0, 1, 2], 1.5)).toEqual({ i: 1, s: 0.5 });
    expect(segmentAt([0, 1, 2], 9)).toEqual({ i: 1, s: 1 });
  });
});

describe('poseAt', () => {
  for (const stroke of STROKES) for (const stance of STANCES) {
    const set = SETS[stroke][stance];
    it(`${stroke}/${stance}：关键帧时刻与关键帧一致，脚不抬起`, () => {
      set.frames.forEach((k, i) => {
        const p = poseAt(set, set.times[i]);
        k.pel.forEach((v, j) => expect(p.pel[j]).toBeCloseTo(v, 6));
        k.tor.forEach((v, j) => expect(p.tor[j]).toBeCloseTo(v, 6));
        k.rh.forEach((v, j) => expect(p.rh[j]).toBeCloseTo(v, 6));
        k.rk.forEach((v, j) => expect(p.rk[j]).toBeCloseTo(v, 6));
        k.lf.forEach((v, j) => expect(p.lf[j]).toBeCloseTo(v, 6));
        k.rf.forEach((v, j) => expect(p.rf[j]).toBeCloseTo(v, 6));
        expect(p.w).toBeCloseTo(k.w, 6);
        expect(p.lift[0]).toBeCloseTo(0, 6);
        expect(p.lift[1]).toBeCloseTo(0, 6);
      });
    });
    it(`${stroke}/${stance}：中间关键帧两侧速度连续`, () => {
      const h = 1e-5;
      for (let k = 1; k < set.times.length - 1; k++) {
        const t = set.times[k];
        for (const pick of [(p: ReturnType<typeof poseAt>) => p.tor[0], (p: ReturnType<typeof poseAt>) => p.rh[0]]) {
          const left = (pick(poseAt(set, t)) - pick(poseAt(set, t - h))) / h;
          const right = (pick(poseAt(set, t + h)) - pick(poseAt(set, t))) / h;
          expect(Math.abs(left - right)).toBeLessThan(1 + 0.01 * Math.abs(left));
        }
      }
    });
  }
  it('移动中的脚在两帧中间抬起', () => {
    const set = SETS.forehand.neutral; // 左脚在第 0→1 帧向前迈步
    const p = poseAt(set, set.times[1] / 2);
    expect(p.lift[0]).toBeGreaterThan(5);
  });
});
