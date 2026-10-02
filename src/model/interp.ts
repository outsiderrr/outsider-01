import type { Activation, Cyl, Foot, KeyframeSet, KeyframeValues, Pose } from './types';
import type { Vec3 } from './vec';

type Pick = (k: KeyframeValues) => number;
type PickArr = (k: KeyframeValues) => readonly number[];

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const smoothstep = (s: number): number => s * s * (3 - 2 * s);

/**
 * 关键帧 k 处的切线（每秒变化量）：首尾为 0，中间取三点抛物线导数。
 * k 等于 contactIndex 时，如果来球一侧的割线更陡，就改用这条割线。
 */
export function tangent(v: readonly number[], T: readonly number[], k: number, contactIndex: number): number {
  if (k <= 0 || k >= v.length - 1) return 0;
  const d0 = T[k] - T[k - 1];
  const d1 = T[k + 1] - T[k];
  const s0 = (v[k] - v[k - 1]) / d0;
  const s1 = (v[k + 1] - v[k]) / d1;
  const m = (s0 * d1 + s1 * d0) / (d0 + d1);
  if (k === contactIndex && s0 * s1 > 0 && Math.abs(s0) > Math.abs(m)) return s0;
  return m;
}

export function hermite(v: readonly number[], T: readonly number[], i: number, s: number, contactIndex: number): number {
  const d = T[i + 1] - T[i];
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * v[i] +
    (s3 - 2 * s2 + s) * d * tangent(v, T, i, contactIndex) +
    (-2 * s3 + 3 * s2) * v[i + 1] +
    (s3 - s2) * d * tangent(v, T, i + 1, contactIndex)
  );
}

export function segmentAt(T: readonly number[], t: number): { i: number; s: number } {
  const last = T.length - 1;
  const u = clamp(t, T[0], T[last]);
  let i = 0;
  while (i < last - 1 && u > T[i + 1]) i++;
  return { i, s: (u - T[i]) / (T[i + 1] - T[i]) };
}

const asTuple = <R>(xs: number[]): R => xs as unknown as R;

/** 任意时刻 t（秒）的姿态 */
export function poseAt(set: KeyframeSet, t: number): Pose {
  const { times: T, frames: K, contactIndex } = set;
  const { i, s } = segmentAt(T, t);
  const sm = smoothstep(s);
  // 身体：普通三次插值；手和球拍：击球帧保持速度；离散类：smoothstep
  const body = (pick: Pick) => hermite(K.map(pick), T, i, s, -1);
  const hand = (pick: Pick) => hermite(K.map(pick), T, i, s, contactIndex);
  const step = (pick: Pick) => pick(K[i]) + (pick(K[i + 1]) - pick(K[i])) * sm;
  const each = (pick: PickArr, f: (p: Pick) => number) => pick(K[i]).map((_, j) => f((k) => pick(k)[j]));
  const lift = (pick: (k: KeyframeValues) => Foot) => {
    const a = pick(K[i]);
    const b = pick(K[i + 1]);
    return Math.sin(Math.PI * s) * Math.min(10, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.3);
  };
  return {
    lf: asTuple<Foot>(each((k) => k.lf, step)),
    rf: asTuple<Foot>(each((k) => k.rf, step)),
    pel: asTuple<KeyframeValues['pel']>(each((k) => k.pel, body)),
    tor: asTuple<KeyframeValues['tor']>(each((k) => k.tor, body)),
    hd: body((k) => k.hd),
    rh: asTuple<Cyl>(each((k) => k.rh, hand)),
    rk: asTuple<KeyframeValues['rk']>(each((k) => k.rk, hand)),
    re: asTuple<Vec3>(each((k) => k.re, body)),
    lh: asTuple<Cyl>(each((k) => k.lh, body)),
    lt: step((k) => k.lt),
    lg: step((k) => k.lg),
    le: asTuple<Vec3>(each((k) => k.le, body)),
    a: asTuple<Activation>(each((k) => k.a, step)),
    br: step((k) => k.br),
    w: step((k) => k.w),
    lift: [lift((k) => k.lf), lift((k) => k.rf)],
  };
}
