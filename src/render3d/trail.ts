import * as THREE from 'three';
import { type KeyframeSet, RACKET, poseAt, solvePose } from '../model';
import { add, scale } from '../model/vec';
import type { Palette } from './palette';
import { toThree } from './space';

const N = 30;
const WINDOW = 0.26;

/**
 * 拍头扫掠带：最近 0.26 秒里拍头顶端和拍颈连成的带子，越早越淡，能看出挥拍平面。
 * 每帧直接按模型重新采样，所以拖动时间轴、倒放都一致。
 */
export class Trail {
  readonly sweep: THREE.Mesh;
  readonly path: THREE.Line;
  private readonly pos = new Float32Array(N * 2 * 3);
  private readonly sweepMat: THREE.ShaderMaterial;
  private readonly pathMat = new THREE.LineDashedMaterial({ color: '#9fb2cc', dashSize: 0.035, gapSize: 0.03, transparent: true, opacity: 0.9 });

  constructor() {
    const g = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', posAttr);
    const age = new Float32Array(N * 2);
    const edge = new Float32Array(N * 2);
    const idx: number[] = [];
    for (let i = 0; i < N; i++) {
      age[i * 2] = age[i * 2 + 1] = i / (N - 1);
      edge[i * 2] = 1;
      edge[i * 2 + 1] = 0;
      if (i < N - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setAttribute('aAge', new THREE.BufferAttribute(age, 1));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    g.setIndex(idx);
    this.sweepMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#ee4f17') }, uOpacity: { value: 0.5 } },
      vertexShader: /* glsl */ `
        attribute float aAge;
        attribute float aEdge;
        varying float vAge;
        varying float vEdge;
        void main() {
          vAge = aAge;
          vEdge = aEdge;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAge;
        varying float vEdge;
        void main() {
          float a = pow(vAge, 1.7) * uOpacity * mix(0.45, 1.0, vEdge);
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.sweep = new THREE.Mesh(g, this.sweepMat);
    this.sweep.frustumCulled = false;
    this.sweep.renderOrder = 2;

    this.path = new THREE.Line(new THREE.BufferGeometry(), this.pathMat);
    this.path.frustumCulled = false;
  }

  setMotion(set: KeyframeSet): void {
    const pts: THREE.Vector3[] = [];
    const t0 = set.times[1];
    const t1 = set.times[set.times.length - 1];
    for (let i = 0; i <= 180; i++) pts.push(toThree(solvePose(poseAt(set, t0 + ((t1 - t0) * i) / 180)).racket.center));
    this.path.geometry.dispose();
    this.path.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.path.computeLineDistances();
  }

  update(set: KeyframeSet, t: number): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const ti = Math.max(0, t - WINDOW + (WINDOW * i) / (N - 1));
      const r = solvePose(poseAt(set, ti)).racket;
      const tip = add(r.center, scale(r.dir, RACKET.headHalfLength));
      const neck = add(r.center, scale(r.dir, -RACKET.headHalfLength * 0.6));
      toThree(tip, v);
      this.pos.set([v.x, v.y, v.z], i * 6);
      toThree(neck, v);
      this.pos.set([v.x, v.y, v.z], i * 6 + 3);
    }
    this.sweep.geometry.attributes.position.needsUpdate = true;
  }

  setPalette(p: Palette): void {
    this.sweepMat.uniforms.uColor.value.copy(p.signal);
    this.sweepMat.uniforms.uOpacity.value = p.dark ? 0.55 : 0.48;
    this.pathMat.color.copy(p.faint);
  }

  dispose(): void {
    this.sweep.geometry.dispose();
    this.path.geometry.dispose();
    this.sweepMat.dispose();
    this.pathMat.dispose();
  }
}
