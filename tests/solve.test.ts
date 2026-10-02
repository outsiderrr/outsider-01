import { describe, expect, it } from 'vitest';
import { BODY, RACKET } from '../src/model/body';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { footJoints, racketGeom, solvePose, solveTwoBone } from '../src/model/solve';
import { dist, dot, length } from '../src/model/vec';

describe('solveTwoBone', () => {
  it('够得着时保持两段长度，关节朝提示方向弯', () => {
    const r = solveTwoBone([0, 0, 0], [30, 0, 0], 20, 20, [0, 0, 1]);
    expect(dist([0, 0, 0], r.joint)).toBeCloseTo(20);
    expect(dist(r.joint, r.end)).toBeCloseTo(20);
    expect(r.joint[2]).toBeGreaterThan(0);
    expect(r.reach).toBeCloseTo(0.75);
  });
  it('够不着时拉直而不拉长，并报告 reach > 1', () => {
    const r = solveTwoBone([0, 0, 0], [100, 0, 0], 20, 20, [0, 0, 1]);
    expect(dist([0, 0, 0], r.joint)).toBeCloseTo(20);
    expect(dist(r.joint, r.end)).toBeCloseTo(20);
    expect(r.reach).toBeGreaterThan(1);
  });
});

describe('footJoints', () => {
  it('抬脚跟时脚尖不动、脚长不变、踝关节升高', () => {
    const flat = footJoints([10, 20, 30, 0], 0);
    const up = footJoints([10, 20, 30, 1], 0);
    expect(dist(flat.toe, up.toe)).toBeCloseTo(0);
    expect(dist(flat.ankle, flat.toe)).toBeCloseTo(dist(up.ankle, up.toe));
    expect(flat.ankle[2]).toBeCloseTo(BODY.ankleHeight);
    expect(up.ankle[2]).toBeGreaterThan(flat.ankle[2]);
  });
});

describe('racketGeom', () => {
  it('拍杆方向、拍面法线、拍面宽度两两垂直，且都是单位向量', () => {
    const g = racketGeom([0, 0, 100], [30, 10, 45], 9);
    expect(length(g.dir)).toBeCloseTo(1);
    expect(length(g.normal)).toBeCloseTo(1);
    expect(length(g.width)).toBeCloseTo(1);
    expect(dot(g.dir, g.normal)).toBeCloseTo(0);
    expect(dot(g.dir, g.width)).toBeCloseTo(0);
    expect(dot(g.normal, g.width)).toBeCloseTo(0);
    expect(dist(g.grip, g.center)).toBeCloseTo(RACKET.headCenter);
    expect(dist(g.grip, g.leftGrip)).toBeCloseTo(9);
  });
});

describe('solvePose', () => {
  it('骨段长度恒定', () => {
    const set = FOREHAND.semi;
    for (const t of [0, 0.3, 0.55, 0.8, 0.92, 1.1, 1.22]) {
      const j = solvePose(poseAt(set, t));
      expect(dist(j.hipL, j.kneeL)).toBeCloseTo(BODY.thigh, 3);
      expect(dist(j.kneeR, j.footR.ankle)).toBeCloseTo(BODY.shin, 3);
      expect(dist(j.shoulderR, j.elbowR)).toBeCloseTo(BODY.upperArm, 3);
      expect(dist(j.elbowL, j.wristL)).toBeCloseTo(BODY.forearm, 3);
    }
  });
  it('正手准备姿势：左手扶在拍颈上', () => {
    expect(solvePose(poseAt(FOREHAND.semi, 0)).gripError).toBeLessThan(1);
  });
});
