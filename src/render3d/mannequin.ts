import * as THREE from 'three';
import { BODY, type Joints, type Pose } from '../model';
import { type Vec3, add, azimuth, cross, dist, dot, lerp3, normalize, scale, sub } from '../model/vec';
import { addOutline, createFillMaterial, createMarkerMaterial } from './materials';
import type { Palette } from './palette';
import { TIER_SETTINGS, type QualityTier } from './quality';
import { CM, toThree } from './space';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

/** 躯干截面：[沿脊柱位置 0..1, 半宽 cm, 半厚 cm]（髋 → 腰 → 胸 → 肩线） */
const PROFILE: readonly (readonly [number, number, number])[] = [
  [0, 14.2, 9.6],
  [0.1, 15.8, 10.8],
  [0.22, 15.4, 10.4],
  [0.36, 13.4, 9.4],
  [0.5, 13.8, 9.7],
  [0.64, 15.4, 10.5],
  [0.78, 16.8, 11],
  [0.9, 17, 10.6],
  [1, 15.4, 8.8],
];
const RINGS = 12;
const SEG = 28;
const SUPER = 2.6;

function radiiAt(s: number): [number, number] {
  for (let i = 1; i < PROFILE.length; i++) {
    const [s1, w1, d1] = PROFILE[i];
    const [s0, w0, d0] = PROFILE[i - 1];
    if (s <= s1) {
      const k = (s - s0) / (s1 - s0);
      return [w0 + (w1 - w0) * k, d0 + (d1 - d0) * k];
    }
  }
  const last = PROFILE[PROFILE.length - 1];
  return [last[1], last[2]];
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const spow = (v: number, e: number): number => Math.sign(v) * Math.pow(Math.abs(v), e);

function bezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, s: number): Vec3 {
  const u = 1 - s;
  const a = u * u * u;
  const b = 3 * u * u * s;
  const c = 3 * u * s * s;
  const d = s * s * s;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

function bezierTangent(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, s: number): Vec3 {
  const u = 1 - s;
  const a = 3 * u * u;
  const b = 6 * u * s;
  const c = 3 * s * s;
  return [
    a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
    a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]),
    a * (p1[2] - p0[2]) + b * (p2[2] - p1[2]) + c * (p3[2] - p2[2]),
  ];
}

/** 可扭转的躯干：截面环从骨盆的朝向渐变到躯干的朝向 */
class Torso {
  readonly geometry = new THREE.BufferGeometry();
  private readonly pos: Float32Array;

  constructor() {
    const count = RINGS * SEG + 2;
    this.pos = new Float32Array(count * 3);
    const zone = new Float32Array(count);
    for (let i = 0; i < RINGS; i++) {
      const s = i / (RINGS - 1);
      const z = smooth(0.26, 0.44, s);
      for (let k = 0; k < SEG; k++) zone[i * SEG + k] = z;
    }
    zone[RINGS * SEG] = 0;
    zone[RINGS * SEG + 1] = 1;
    const idx: number[] = [];
    for (let i = 0; i < RINGS - 1; i++) {
      for (let k = 0; k < SEG; k++) {
        const a = i * SEG + k;
        const b = i * SEG + ((k + 1) % SEG);
        const c = (i + 1) * SEG + k;
        const d = (i + 1) * SEG + ((k + 1) % SEG);
        idx.push(a, b, c, b, d, c);
      }
    }
    const bottom = RINGS * SEG;
    const top = bottom + 1;
    for (let k = 0; k < SEG; k++) {
      const a = k;
      const b = (k + 1) % SEG;
      idx.push(bottom, b, a);
      const ta = (RINGS - 1) * SEG + k;
      const tb = (RINGS - 1) * SEG + ((k + 1) % SEG);
      idx.push(top, ta, tb);
    }
    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);
    this.geometry.setAttribute('aZone', new THREE.BufferAttribute(zone, 1));
    this.geometry.setIndex(idx);
  }

  update(j: Joints): void {
    const p0 = sub(j.pelvis, [0, 0, 6]);
    const p3 = sub(j.chest, scale(j.torsoUp, 1.5));
    const len = dist(p0, p3);
    const p1 = add(p0, [0, 0, len / 3]);
    const p2 = sub(p3, scale(j.torsoUp, len / 3));
    const v = new THREE.Vector3();
    let upFirst: Vec3 = [0, 0, 1];
    let upLast: Vec3 = j.torsoUp;
    for (let i = 0; i < RINGS; i++) {
      const s = i / (RINGS - 1);
      const c = bezier(p0, p1, p2, p3, s);
      const up = normalize(bezierTangent(p0, p1, p2, p3, s));
      if (i === 0) upFirst = up;
      if (i === RINGS - 1) upLast = up;
      let r = normalize(lerp3(j.pelvisRight, j.torsoRight, smooth(0.22, 0.95, s)));
      r = normalize(sub(r, scale(up, dot(r, up))));
      const f = cross(up, r);
      const [hw, hd] = radiiAt(s);
      for (let k = 0; k < SEG; k++) {
        const th = (k / SEG) * Math.PI * 2;
        const ex = spow(Math.cos(th), 2 / SUPER) * hw;
        const ey = spow(Math.sin(th), 2 / SUPER) * hd;
        const pt: Vec3 = [c[0] + r[0] * ex + f[0] * ey, c[1] + r[1] * ex + f[1] * ey, c[2] + r[2] * ex + f[2] * ey];
        toThree(pt, v);
        const o = (i * SEG + k) * 3;
        this.pos[o] = v.x;
        this.pos[o + 1] = v.y;
        this.pos[o + 2] = v.z;
      }
    }
    toThree(sub(p0, scale(upFirst, 1.5)), v);
    this.pos.set([v.x, v.y, v.z], RINGS * SEG * 3);
    toThree(add(p3, scale(upLast, 1.2)), v);
    this.pos.set([v.x, v.y, v.z], (RINGS * SEG + 1) * 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

type FillMat = THREE.ShaderMaterial;

interface Capsule {
  mesh: THREE.Mesh;
  radius: number;
  length: number;
  /** true：胶囊端部正好落在两个点上（脚）；false：圆柱段等于骨段，端部包住关节 */
  inset: boolean;
}

/** 线稿风格的人偶 */
export class Mannequin {
  readonly group = new THREE.Group();
  private readonly torso = new Torso();
  private readonly mats: Record<'skin' | 'legs' | 'hips' | 'armR' | 'armL' | 'shoulder' | 'torso', FillMat>;
  private readonly capsules: Record<string, Capsule> = {};
  private readonly spheres: Record<string, THREE.Mesh> = {};
  private readonly head: THREE.Mesh;
  private readonly nose: THREE.Mesh;
  private readonly noseMat = new THREE.MeshBasicMaterial({ color: '#1d3f94' });
  private readonly markers: THREE.Points;
  private readonly markerMat = createMarkerMaterial();
  private tier: QualityTier;
  private signal = new THREE.Color('#ee4f17');
  private brake = new THREE.Color('#4c7bd9');

  constructor(palette: Palette, tier: QualityTier) {
    this.tier = tier;
    this.mats = {
      skin: createFillMaterial(),
      legs: createFillMaterial(),
      hips: createFillMaterial(),
      armR: createFillMaterial(),
      armL: createFillMaterial(),
      shoulder: createFillMaterial(),
      torso: createFillMaterial({ zone: true }),
    };

    const torsoMesh = new THREE.Mesh(this.torso.geometry, this.mats.torso);
    torsoMesh.frustumCulled = false;
    torsoMesh.castShadow = true;
    addOutline(torsoMesh).frustumCulled = false;
    this.group.add(torsoMesh);

    const cap = (name: string, radius: number, length: number, mat: FillMat, inset = false) => {
      const mesh = new THREE.Mesh(undefined, mat);
      mesh.castShadow = true;
      this.capsules[name] = { mesh, radius, length, inset };
      this.group.add(mesh);
    };
    cap('upperArmL', 4.2, BODY.upperArm, this.mats.armL);
    cap('upperArmR', 4.2, BODY.upperArm, this.mats.armR);
    cap('forearmL', 3.6, BODY.forearm, this.mats.armL);
    cap('forearmR', 3.6, BODY.forearm, this.mats.armR);
    cap('thighL', 6.4, BODY.thigh, this.mats.legs);
    cap('thighR', 6.4, BODY.thigh, this.mats.legs);
    cap('shinL', 4.9, BODY.shin, this.mats.legs);
    cap('shinR', 4.9, BODY.shin, this.mats.legs);
    cap('neck', 4.6, BODY.neck, this.mats.skin);
    const footLen = Math.hypot(BODY.footLength + BODY.heelBehindAnkle, BODY.toeHeight);
    cap('footL', 4.1, footLen, this.mats.legs, true);
    cap('footR', 4.1, footLen, this.mats.legs, true);

    const sph = (name: string, radius: number, mat: FillMat) => {
      const mesh = new THREE.Mesh(undefined, mat);
      mesh.castShadow = true;
      mesh.userData.radius = radius;
      this.spheres[name] = mesh;
      this.group.add(mesh);
    };
    sph('shoulderL', 5.8, this.mats.shoulder);
    sph('shoulderR', 5.8, this.mats.shoulder);
    sph('hipL', 7, this.mats.hips);
    sph('hipR', 7, this.mats.hips);
    sph('handL', 4.3, this.mats.armL);
    sph('handR', 4.3, this.mats.armR);

    this.head = new THREE.Mesh(undefined, this.mats.skin);
    this.head.castShadow = true;
    this.group.add(this.head);
    // 鼻尖点：标出视线方向
    this.nose = new THREE.Mesh(new THREE.SphereGeometry(1.7 * CM, 12, 8), this.noseMat);
    this.group.add(this.nose);

    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    this.markers = new THREE.Points(mg, this.markerMat);
    this.markers.frustumCulled = false;
    this.markers.renderOrder = 5;
    this.group.add(this.markers);

    this.buildGeometry();
    this.setPalette(palette);
  }

  private buildGeometry(): void {
    const s = TIER_SETTINGS[this.tier];
    for (const c of Object.values(this.capsules)) {
      c.mesh.geometry?.dispose();
      const cyl = c.inset ? Math.max(0.01, c.length - 2 * c.radius) : c.length;
      c.mesh.geometry = new THREE.CapsuleGeometry(c.radius * CM, cyl * CM, s.capSegments, s.radialSegments);
      c.mesh.clear();
      addOutline(c.mesh);
    }
    for (const m of Object.values(this.spheres)) {
      m.geometry?.dispose();
      m.geometry = new THREE.SphereGeometry((m.userData.radius as number) * CM, s.radialSegments, Math.max(8, s.radialSegments - 4));
      m.clear();
      addOutline(m);
    }
    this.head.geometry?.dispose();
    this.head.geometry = new THREE.SphereGeometry(BODY.headRadius * CM, s.radialSegments + 6, s.radialSegments);
    this.head.clear();
    addOutline(this.head);
    for (const m of Object.values(this.mats)) m.uniforms.uHatch.value = s.hatching ? 1 : 0;
  }

  setTier(t: QualityTier): void {
    if (t === this.tier) return;
    this.tier = t;
    this.buildGeometry();
  }

  setPixelRatio(pr: number): void {
    for (const m of Object.values(this.mats)) m.uniforms.uPixelRatio.value = pr;
    this.markerMat.uniforms.uSize.value = 7 * pr;
  }

  setPalette(p: Palette): void {
    for (const m of Object.values(this.mats)) {
      m.uniforms.uBase.value.copy(p.figFill);
      m.uniforms.uShade.value.copy(p.figShade);
      m.uniforms.uInk.value.copy(p.ink);
      m.uniforms.uTintMax.value = p.dark ? 0.28 : 0.48;
    }
    this.noseMat.color.copy(p.ink);
    this.markerMat.uniforms.uInk.value.copy(p.ink);
    this.markerMat.uniforms.uFill.value.copy(p.figFill);
    this.signal = p.signal.clone();
    this.brake = p.brake.clone();
  }

  private place(c: Capsule, a: Vec3, b: Vec3): void {
    toThree(a, tmpA);
    toThree(b, tmpB);
    c.mesh.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
    tmpDir.copy(tmpB).sub(tmpA).normalize();
    c.mesh.quaternion.setFromUnitVectors(Y_AXIS, tmpDir);
  }

  private tint(m: FillMat, act: number, brake: number, zoneB?: number): void {
    const useBrake = brake > act;
    m.uniforms.uTint.value.copy(useBrake ? this.brake : this.signal);
    m.uniforms.uTintA.value = Math.min(1, useBrake ? brake : act);
    if (zoneB !== undefined) m.uniforms.uTintB.value = Math.min(1, zoneB);
  }

  update(j: Joints, p: Pose, bothArms: boolean): void {
    const c = this.capsules;
    this.place(c.upperArmL, j.shoulderL, j.elbowL);
    this.place(c.upperArmR, j.shoulderR, j.elbowR);
    this.place(c.forearmL, j.elbowL, j.wristL);
    this.place(c.forearmR, j.elbowR, j.wristR);
    this.place(c.thighL, j.hipL, j.kneeL);
    this.place(c.thighR, j.hipR, j.kneeR);
    this.place(c.shinL, j.kneeL, j.footL.ankle);
    this.place(c.shinR, j.kneeR, j.footR.ankle);
    this.place(c.neck, j.chest, j.neck);
    this.place(c.footL, j.footL.heel, j.footL.toe);
    this.place(c.footR, j.footR.heel, j.footR.toe);
    const sp = this.spheres;
    toThree(j.shoulderL, sp.shoulderL.position);
    toThree(j.shoulderR, sp.shoulderR.position);
    toThree(j.hipL, sp.hipL.position);
    toThree(j.hipR, sp.hipR.position);
    toThree(j.wristL, sp.handL.position);
    toThree(j.wristR, sp.handR.position);
    toThree(j.head, this.head.position);

    toThree(add(j.head, scale(azimuth(p.hd), BODY.headRadius * 0.96)), this.nose.position);

    this.torso.update(j);

    const pts = [j.shoulderL, j.shoulderR, j.elbowL, j.elbowR, j.wristL, j.wristR, j.hipL, j.hipR, j.kneeL, j.kneeR, j.footL.ankle, j.footR.ankle];
    const arr = this.markers.geometry.attributes.position.array as Float32Array;
    pts.forEach((q, i) => {
      toThree(q, tmpA);
      arr[i * 3] = tmpA.x;
      arr[i * 3 + 1] = tmpA.y;
      arr[i * 3 + 2] = tmpA.z;
    });
    this.markers.geometry.attributes.position.needsUpdate = true;

    const a = p.a;
    this.tint(this.mats.legs, a[0], 0);
    this.tint(this.mats.hips, a[1], 0);
    // 躯干发力时髋部也带一点颜色，避免腰部出现生硬的色带
    this.tint(this.mats.torso, Math.max(a[1], a[2] * 0.55), 0, a[2]);
    this.tint(this.mats.armR, a[3], p.br);
    this.tint(this.mats.armL, bothArms ? a[3] : 0, bothArms ? p.br : 0);
    this.tint(this.mats.shoulder, 0, p.br);
  }

  setMarkersVisible(v: boolean): void {
    this.markers.visible = v;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of Object.values(this.mats)) m.dispose();
    this.noseMat.dispose();
    this.markerMat.dispose();
  }
}
