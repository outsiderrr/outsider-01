import * as THREE from 'three';
import type { Vec3 } from '../model/vec';

export const CM = 0.01;

/** 模型坐标（cm；x 右、y 朝网、z 上）→ Three 坐标（m；x 右、y 上、z 指向底线后方） */
export function toThree(v: Vec3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(v[0] * CM, v[2] * CM, -v[1] * CM);
}

/** 方向向量（不缩放） */
export function dirToThree(v: Vec3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(v[0], v[2], -v[1]);
}
