import * as THREE from 'three';
import type { RacketGeom } from '../model';
import { RACKET } from '../model/body';
import type { Palette } from './palette';
import { CM, dirToThree, toThree } from './space';

const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x * CM, y * CM, z * CM);

/** 球拍：局部坐标 Y 沿拍杆、X 沿拍面宽度、Z 沿拍面法线，原点在右手握点 */
export class Racket {
  readonly group = new THREE.Group();
  private readonly frameMat = new THREE.MeshBasicMaterial({ color: '#1d3f94' });
  private readonly stringMat = new THREE.LineBasicMaterial({ color: '#1d3f94', transparent: true, opacity: 0.42 });
  private ink = new THREE.Color('#1d3f94');
  private signal = new THREE.Color('#ee4f17');
  private readonly basis = new THREE.Matrix4();

  constructor() {
    const cy = RACKET.headCenter;
    const rx = RACKET.headHalfWidth;
    const ry = RACKET.headHalfLength;
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      ring.push(v3(rx * Math.cos(t), cy + ry * Math.sin(t)));
    }
    const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 120, 0.85 * CM, 6, true), this.frameMat);
    frame.castShadow = true;
    this.group.add(frame);

    const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r * CM, 6, false), this.frameMat);
      m.castShadow = true;
      this.group.add(m);
    };
    const yThroat = cy - ry * Math.sqrt(1 - (7.2 / rx) ** 2);
    tube(v3(0, 18.5), v3(7.2, yThroat), 0.75);
    tube(v3(0, 18.5), v3(-7.2, yThroat), 0.75);
    tube(v3(0, 13.5), v3(0, 19), 1.05);

    const handleLen = 13.5 + RACKET.buttBehindGrip;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.35 * CM, 1.35 * CM, handleLen * CM, 10), this.frameMat);
    handle.position.y = ((13.5 - RACKET.buttBehindGrip) / 2) * CM;
    handle.castShadow = true;
    this.group.add(handle);
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * CM, 1.7 * CM, 1.1 * CM, 12), this.frameMat);
    butt.position.y = -RACKET.buttBehindGrip * CM;
    this.group.add(butt);

    const seg: number[] = [];
    const innerX = rx - 0.6;
    const innerY = ry - 0.6;
    for (let i = 0; i < 16; i++) {
      const x = -innerX + 0.75 + (i * (2 * innerX - 1.5)) / 15;
      const h = innerY * Math.sqrt(Math.max(0, 1 - (x / innerX) ** 2));
      seg.push(x * CM, (cy - h) * CM, 0, x * CM, (cy + h) * CM, 0);
    }
    for (let j = 0; j < 19; j++) {
      const y = cy - innerY + 0.9 + (j * (2 * innerY - 1.8)) / 18;
      const w = innerX * Math.sqrt(Math.max(0, 1 - ((y - cy) / innerY) ** 2));
      seg.push(-w * CM, y * CM, 0, w * CM, y * CM, 0);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    this.group.add(new THREE.LineSegments(sg, this.stringMat));
  }

  update(g: RacketGeom, activation: number): void {
    this.basis.makeBasis(dirToThree(g.width), dirToThree(g.dir), dirToThree(g.normal));
    this.group.quaternion.setFromRotationMatrix(this.basis);
    toThree(g.grip, this.group.position);
    this.frameMat.color.copy(this.ink).lerp(this.signal, Math.min(1, activation));
  }

  setPalette(p: Palette): void {
    this.ink = p.ink.clone();
    this.signal = p.signal.clone();
    this.frameMat.color.copy(p.ink);
    this.stringMat.color.copy(p.ink);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
    });
    this.frameMat.dispose();
    this.stringMat.dispose();
  }
}
