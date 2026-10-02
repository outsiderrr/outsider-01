import { describe, expect, it } from 'vitest';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { mirrorKeyframe } from '../src/model/mirror';
import type { KeyframeValues } from '../src/model/types';

const flat = (k: KeyframeValues): number[] =>
  [k.lf, k.rf, k.pel, k.tor, [k.hd], k.rh, k.rk, k.re, k.lh, [k.lt, k.lg], k.le, k.a, [k.br, k.w]].flatMap((x) => [...x]);

describe('mirrorKeyframe', () => {
  it('镜像两次回到原样', () => {
    for (const k of FOREHAND.semi.frames) {
      const a = flat(k);
      const b = flat(mirrorKeyframe(mirrorKeyframe(k)));
      a.forEach((x, i) => expect(b[i]).toBeCloseTo(x, 9));
    }
  });
  it('左右脚互换、x 和朝向取反、重心比例取补', () => {
    const k = FOREHAND.open.frames[1];
    const m = mirrorKeyframe(k);
    expect(m.lf).toEqual([-k.rf[0], k.rf[1], -k.rf[2], k.rf[3]]);
    expect(m.pel[3]).toBe(-k.pel[3]);
    expect(m.w).toBeCloseTo(1 - k.w);
  });
});
