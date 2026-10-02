import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Joints, Pose } from '../model';
import { type Vec3, lerp3 } from '../model/vec';
import type { Palette } from './palette';
import { toThree } from './space';

const LIFT = 0.4; // 线画在地面以上 0.4 cm，避免与地面闪烁

const onFloor = (v: Vec3): Vec3 => [v[0], v[1], LIFT];
const horizDir = (v: Vec3): [number, number] => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

function makeLine(width: number): Line2 {
  const mat = new LineMaterial({ linewidth: width, worldUnits: false, transparent: true });
  const line = new Line2(new LineGeometry(), mat);
  line.frustumCulled = false;
  line.renderOrder = 3;
  return line;
}

function setLine(line: Line2, pts: Vec3[]): void {
  const arr: number[] = [];
  const v = new THREE.Vector3();
  for (const q of pts) {
    toThree(q, v);
    arr.push(v.x, v.y, v.z);
  }
  line.geometry.setPositions(arr);
}

/** 地面注释：肩线、髋线的投影和它们的夹角弧，两脚之间的重心条 */
export class FloorAnnotations {
  readonly group = new THREE.Group();
  /** 夹角弧中点外侧的位置，供标签使用 */
  readonly arcLabel = new THREE.Vector3();
  private readonly shoulder = makeLine(2.4);
  private readonly hip = makeLine(2.4);
  private readonly arc = makeLine(1.5);
  private readonly weight = makeLine(1.2);
  private readonly dotMat = new THREE.MeshBasicMaterial({ color: '#1d3f94' });
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: '#1d3f94', transparent: true, opacity: 0.5 });
  private readonly dot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 24), this.dotMat);
  private readonly ring = new THREE.Mesh(new THREE.RingGeometry(0.046, 0.054, 40), this.ringMat);

  constructor() {
    for (const m of [this.dot, this.ring]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.group.add(m);
    }
    this.group.add(this.shoulder, this.hip, this.arc, this.weight);
  }

  update(j: Joints, p: Pose): void {
    const c = onFloor(j.pelvis);
    const sm = onFloor(lerp3(j.shoulderL, j.shoulderR, 0.5));
    const [sx, sy] = horizDir(j.torsoRight);
    const [hx, hy] = horizDir(j.pelvisRight);
    setLine(this.shoulder, [
      [sm[0] - sx * 30, sm[1] - sy * 30, LIFT],
      [sm[0] + sx * 30, sm[1] + sy * 30, LIFT],
    ]);
    setLine(this.hip, [
      [c[0] - hx * 24, c[1] - hy * 24, LIFT],
      [c[0] + hx * 24, c[1] + hy * 24, LIFT],
    ]);
    const a0 = Math.atan2(hy, hx);
    let a1 = Math.atan2(sy, sx);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
    const r = 38;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((a1 - a0) * i) / 24;
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, LIFT]);
    }
    setLine(this.arc, pts);
    const am = (a0 + a1) / 2;
    toThree([c[0] + Math.cos(am) * (r + 14), c[1] + Math.sin(am) * (r + 14), LIFT], this.arcLabel);

    const fr = onFloor(j.footR.ankle);
    const fl = onFloor(j.footL.ankle);
    setLine(this.weight, [fr, fl]);
    const w = lerp3(fr, fl, p.w);
    toThree([w[0], w[1], LIFT + 0.1], this.dot.position);
    this.ring.position.copy(this.dot.position);
  }

  setResolution(w: number, h: number): void {
    for (const l of [this.shoulder, this.hip, this.arc, this.weight]) l.material.resolution.set(w, h);
  }

  setPalette(p: Palette): void {
    this.shoulder.material.color.copy(p.ink);
    this.hip.material.color.copy(p.faint);
    this.arc.material.color.copy(p.signal);
    this.weight.material.color.copy(p.text2);
    this.weight.material.opacity = 0.7;
    this.dotMat.color.copy(p.ink);
    this.ringMat.color.copy(p.ink);
  }

  dispose(): void {
    for (const l of [this.shoulder, this.hip, this.arc, this.weight]) {
      l.geometry.dispose();
      l.material.dispose();
    }
    this.dot.geometry.dispose();
    this.ring.geometry.dispose();
    this.dotMat.dispose();
    this.ringMat.dispose();
  }
}
