import { BODY, RACKET } from './body';
import type { Cyl, Foot, Pose } from './types';
import { DEG, type Vec3, add, azimuth, cross, dist, dot, length, lerp3, normalize, scale, sub } from './vec';

export interface IkResult {
  joint: Vec3;
  end: Vec3;
  /** 目标距离 ÷ 两段总长；接近或大于 1 表示够不着，末端被拉回 */
  reach: number;
}

/** 两段式 IK：根 A 伸向目标 C，段长 a、b，hint 指定关节往哪边弯 */
export function solveTwoBone(A: Vec3, C: Vec3, a: number, b: number, hint: Vec3): IkResult {
  let d = sub(C, A);
  let L = Math.max(1e-6, length(d));
  const reach = L / (a + b);
  const max = a + b - 0.5;
  let end = C;
  if (L > max) {
    end = add(A, scale(d, max / L));
    d = sub(end, A);
    L = max;
  }
  const n = scale(d, 1 / L);
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let bend = sub(hint, scale(n, dot(hint, n)));
  if (length(bend) < 1e-6) bend = Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0]);
  return { joint: add(add(A, scale(n, x)), scale(normalize(bend), h)), end, reach };
}

export interface FootJoints {
  ankle: Vec3;
  toe: Vec3;
  heel: Vec3;
  dir: Vec3;
}

/** 脚的关节：抬脚跟时整只脚绕脚尖转动 */
export function footJoints(f: Foot, lift: number): FootJoints {
  const dir = azimuth(f[2]);
  const toe: Vec3 = [f[0] + dir[0] * BODY.footLength, f[1] + dir[1] * BODY.footLength, BODY.toeHeight + lift];
  const alpha = f[3] * BODY.heelLiftMaxDeg * DEG;
  // (u 沿脚尖方向, v 向上) 相对脚尖的坐标，顺时针转 alpha
  const rot = (u: number, v: number): Vec3 => {
    const ru = u * Math.cos(alpha) + v * Math.sin(alpha);
    const rv = -u * Math.sin(alpha) + v * Math.cos(alpha);
    return [toe[0] + dir[0] * ru, toe[1] + dir[1] * ru, toe[2] + rv];
  };
  return {
    dir,
    toe,
    ankle: rot(-BODY.footLength, BODY.ankleHeight - BODY.toeHeight),
    heel: rot(-BODY.footLength - BODY.heelBehindAnkle, -BODY.toeHeight),
  };
}

export interface RacketGeom {
  dir: Vec3;
  normal: Vec3;
  width: Vec3;
  butt: Vec3;
  grip: Vec3;
  leftGrip: Vec3;
  throat: Vec3;
  center: Vec3;
  rim: Vec3[];
}

/** 球拍几何：grip 是右手位置，rk = [方位角°, 仰角°, 拍面滚转°] */
export function racketGeom(grip: Vec3, rk: readonly [number, number, number], leftGripOffset: number): RacketGeom {
  const az = rk[0] * DEG;
  const el = rk[1] * DEG;
  const roll = rk[2] * DEG;
  const dir: Vec3 = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
  let e1 = cross(dir, [0, 0, 1]);
  e1 = length(e1) < 0.05 ? [1, 0, 0] : normalize(e1);
  const e2 = cross(e1, dir);
  const normal = add(scale(e1, Math.cos(roll)), scale(e2, Math.sin(roll)));
  const width = cross(dir, normal);
  const center = add(grip, scale(dir, RACKET.headCenter));
  const rim: Vec3[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    rim.push(add(add(center, scale(dir, RACKET.headHalfLength * Math.cos(a))), scale(width, RACKET.headHalfWidth * Math.sin(a))));
  }
  return {
    dir,
    normal,
    width,
    center,
    rim,
    grip,
    butt: add(grip, scale(dir, -RACKET.buttBehindGrip)),
    leftGrip: add(grip, scale(dir, leftGripOffset)),
    throat: add(grip, scale(dir, RACKET.throat)),
  };
}

export interface Joints {
  pelvis: Vec3;
  pelvisRight: Vec3;
  hipL: Vec3;
  hipR: Vec3;
  kneeL: Vec3;
  kneeR: Vec3;
  footL: FootJoints;
  footR: FootJoints;
  chest: Vec3;
  torsoUp: Vec3;
  torsoRight: Vec3;
  torsoForward: Vec3;
  shoulderL: Vec3;
  shoulderR: Vec3;
  neck: Vec3;
  head: Vec3;
  nose: Vec3;
  elbowL: Vec3;
  wristL: Vec3;
  elbowR: Vec3;
  wristR: Vec3;
  racket: RacketGeom;
  reach: { legL: number; legR: number; armL: number; armR: number };
  /** 左手离应握位置的距离（cm），左手握拍时才有意义 */
  gripError: number;
}

export function solvePose(p: Pose): Joints {
  const pelvis: Vec3 = [p.pel[0], p.pel[1], p.pel[2]];
  const py = p.pel[3] * DEG;
  const pelvisRight: Vec3 = [Math.cos(py), -Math.sin(py), 0];
  const hipL = add(pelvis, scale(pelvisRight, -BODY.hipHalf));
  const hipR = add(pelvis, scale(pelvisRight, BODY.hipHalf));

  const ty = p.tor[0] * DEG;
  const pitch = p.tor[1] * DEG;
  const roll = p.tor[2] * DEG;
  const fwd0: Vec3 = [Math.sin(ty), Math.cos(ty), 0];
  const right0: Vec3 = [Math.cos(ty), -Math.sin(ty), 0];
  const up1 = add(scale([0, 0, 1], Math.cos(pitch)), scale(fwd0, Math.sin(pitch)));
  const torsoUp = add(scale(up1, Math.cos(roll)), scale(right0, Math.sin(roll)));
  const torsoRight = sub(scale(right0, Math.cos(roll)), scale(up1, Math.sin(roll)));
  const torsoForward = cross(torsoUp, torsoRight);

  const chest = add(pelvis, scale(torsoUp, BODY.torso));
  const shoulderL = add(chest, scale(torsoRight, -BODY.shoulderHalf));
  const shoulderR = add(chest, scale(torsoRight, BODY.shoulderHalf));
  const neck = add(chest, scale(torsoUp, BODY.neck));
  const head = add(chest, scale(torsoUp, BODY.neck + BODY.headRadius));
  const nose = add(head, scale(azimuth(p.hd), BODY.headRadius * 0.95));

  const footL = footJoints(p.lf, p.lift[0]);
  const footR = footJoints(p.rf, p.lift[1]);
  const kneeHint = (f: FootJoints): Vec3 => add(f.dir, [0, 0, 0.15]);
  const legL = solveTwoBone(hipL, footL.ankle, BODY.thigh, BODY.shin, kneeHint(footL));
  const legR = solveTwoBone(hipR, footR.ankle, BODY.thigh, BODY.shin, kneeHint(footR));

  const cyl = (c: Cyl): Vec3 => [pelvis[0] + c[1] * Math.sin(c[0] * DEG), pelvis[1] + c[1] * Math.cos(c[0] * DEG), c[2]];
  const armR = solveTwoBone(shoulderR, cyl(p.rh), BODY.upperArm, BODY.forearm, p.re);
  const racket = racketGeom(armR.end, p.rk, p.lg);
  const armL = solveTwoBone(shoulderL, lerp3(cyl(p.lh), racket.leftGrip, p.lt), BODY.upperArm, BODY.forearm, p.le);

  return {
    pelvis,
    pelvisRight,
    hipL,
    hipR,
    kneeL: legL.joint,
    kneeR: legR.joint,
    footL,
    footR,
    chest,
    torsoUp,
    torsoRight,
    torsoForward,
    shoulderL,
    shoulderR,
    neck,
    head,
    nose,
    elbowL: armL.joint,
    wristL: armL.end,
    elbowR: armR.joint,
    wristR: armR.end,
    racket,
    reach: { legL: legL.reach, legR: legR.reach, armL: armL.reach, armR: armR.reach },
    gripError: dist(armL.end, racket.leftGrip),
  };
}
