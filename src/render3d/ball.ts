import * as THREE from 'three';
import { BALL_RADIUS, type KeyframeSet, poseAt, solvePose } from '../model';
import { type Vec3, add, scale } from '../model/vec';
import { addOutline, createFillMaterial } from './materials';
import type { Palette } from './palette';
import { CM, toThree } from './space';

/** 球在某时刻的位置：击球前 0.1 秒飞来，击球后 0.15 秒飞走；其余时间不显示 */
export function ballPosition(set: KeyframeSet, t: number): Vec3 | null {
  const tc = set.times[set.contactIndex];
  const j = solvePose(poseAt(set, tc));
  const c = add(j.racket.center, scale(j.racket.normal, BALL_RADIUS + 1.5));
  const side = set.stroke === 'forehand' ? 1 : -1;
  const dt = tc - t;
  if (dt > 0 && dt <= 0.1) return add(c, scale([0.12 * side, 1, 0.1], dt * 1500));
  if (dt <= 0 && dt > -0.15) return add(c, scale([-0.05 * side, 1, 0.3], -dt * 1800));
  return null;
}

export class Ball {
  readonly mesh: THREE.Mesh;
  private readonly mat = createFillMaterial();

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS * CM, 20, 14), this.mat);
    this.mesh.castShadow = true;
    addOutline(this.mesh);
    this.mesh.visible = false;
  }

  update(p: Vec3 | null): void {
    this.mesh.visible = p !== null;
    if (p) toThree(p, this.mesh.position);
  }

  setPalette(p: Palette): void {
    this.mat.uniforms.uBase.value.copy(p.ball);
    this.mat.uniforms.uShade.value.copy(p.ball).multiplyScalar(0.72);
    this.mat.uniforms.uInk.value.copy(p.ink);
    this.mat.uniforms.uHatch.value = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
