import { describe, expect, it } from 'vitest';
import { STANCES, STROKES, getSet, poseAt, shoulderHipSeparation, solvePose } from '../src/model';
import { stanceSnapshot } from '../src/story/stanceModel';

describe('站位滑块的模型快照', () => {
  for (const stroke of STROKES) {
    STANCES.forEach((stance, i) => {
      it(`${stroke} 在 ${i / 2} 精确匹配 ${stance}`, () => {
        const set = getSet(stroke, stance);
        const back = poseAt(set, set.times[1]);
        const contact = poseAt(set, set.times[set.contactIndex]);
        const actual = stanceSnapshot(stroke, i / 2);
        expect(actual.backswing.feet).toEqual({ left: back.lf, right: back.rf });
        expect(actual.contact.feet).toEqual({ left: contact.lf, right: contact.rf });
        expect(actual.backswing.shoulderYaw).toBeCloseTo(back.tor[0], 10);
        expect(actual.backswing.hipYaw).toBeCloseTo(back.pel[3], 10);
        expect(actual.separation).toBeCloseTo(Math.abs(shoulderHipSeparation(back)), 10);
        expect(actual.contactAhead).toBeCloseTo(solvePose(contact).racket.center[1] - contact.pel[1], 10);
        const weighted = (p: typeof back) => [p.lf[0] * p.w + p.rf[0] * (1 - p.w), p.lf[1] * p.w + p.rf[1] * (1 - p.w)];
        const a = weighted(back), b = weighted(contact);
        expect(actual.backswing.weightCenter).toEqual(a);
        expect(actual.contact.weightCenter).toEqual(b);
        expect(actual.weightShift).toBeCloseTo(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!), 10);
      });
    });

    it(`${stroke} 中间值连续插值且不污染动作模型`, () => {
      const before = JSON.stringify(getSet(stroke, 'neutral'));
      const a = stanceSnapshot(stroke, 0), b = stanceSnapshot(stroke, 0.5), mid = stanceSnapshot(stroke, 0.25);
      expect(mid.backswing.feet.left[0]).toBeCloseTo((a.backswing.feet.left[0] + b.backswing.feet.left[0]) / 2, 10);
      expect(mid.separation).toBeCloseTo((a.separation + b.separation) / 2, 10);
      expect(mid.contactAhead).toBeCloseTo((a.contactAhead + b.contactAhead) / 2, 10);
      expect(JSON.stringify(getSet(stroke, 'neutral'))).toBe(before);
      const near = stanceSnapshot(stroke, 0.5 - 1e-7), after = stanceSnapshot(stroke, 0.5 + 1e-7);
      expect(near.backswing.shoulderYaw).toBeCloseTo(after.backswing.shoulderYaw, 4);
      expect(near.weightShift).toBeCloseTo(after.weightShift, 4);
    });
  }

  it('限制范围并给非数值一个安全默认值', () => {
    expect(stanceSnapshot('forehand', -5)).toEqual(stanceSnapshot('forehand', 0));
    expect(stanceSnapshot('forehand', 5)).toEqual(stanceSnapshot('forehand', 1));
    expect(stanceSnapshot('forehand', Number.NaN)).toEqual(stanceSnapshot('forehand', 0.5));
  });
});
