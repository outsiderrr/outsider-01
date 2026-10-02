import type { Cyl, Foot, KeyframeValues } from './types';
import type { Vec3 } from './vec';

const mFoot = (f: Foot): Foot => [-f[0], f[1], -f[2], f[3]];
const mVec = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
const mCyl = (c: Cyl): Cyl => [-c[0], c[1], c[2]];

/**
 * 左右镜像一个关键帧：x 取反、偏航角取反、左右肢体互换、重心比例取补。
 * 拍面滚转角 r 镜像后是 180 − r（镜像会翻转叉积方向）。
 */
export function mirrorKeyframe(k: KeyframeValues): KeyframeValues {
  return {
    lf: mFoot(k.rf),
    rf: mFoot(k.lf),
    pel: [-k.pel[0], k.pel[1], k.pel[2], -k.pel[3]],
    tor: [-k.tor[0], k.tor[1], -k.tor[2]],
    hd: -k.hd,
    rh: mCyl(k.rh),
    rk: [-k.rk[0], k.rk[1], 180 - k.rk[2]],
    re: mVec(k.le),
    lh: mCyl(k.lh),
    lt: k.lt,
    lg: k.lg,
    le: mVec(k.re),
    a: k.a,
    br: k.br,
    w: 1 - k.w,
  };
}
