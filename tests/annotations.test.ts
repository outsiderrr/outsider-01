import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { describe, expect, it } from 'vitest';
import { SETS, poseAt, solvePose } from '../src/model';
import { FloorAnnotations } from '../src/render3d/annotations';
import { CameraRig } from '../src/render3d/cameraRig';

const sets = Object.values(SETS).flatMap(stances => Object.values(stances));
const lineOf = (notes: FloorAnnotations, name: string): Line2 => notes.group.getObjectByName(name) as Line2;
const ends = (line: Line2): [THREE.Vector3, THREE.Vector3] => [
  new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('instanceStart'), 0),
  new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('instanceEnd'), 0),
];

describe('实验室地面示意图', () => {
  it('六套动作的肩轴与髋轴保持原投影方向、长度和离地高度', () => {
    const notes = new FloorAnnotations();
    for (const set of sets) {
      for (const time of set.times) {
        const pose = poseAt(set, time);
        const joints = solvePose(pose);
        notes.update(joints, pose);
        for (const [name, direction, length] of [
          ['shoulder-projection', joints.torsoRight, 0.6],
          ['hip-projection', joints.pelvisRight, 0.48],
        ] as const) {
          const [a, b] = ends(lineOf(notes, name));
          expect(a.y).toBeCloseTo(0.004);
          expect(b.y).toBeCloseTo(0.004);
          expect(a.distanceTo(b)).toBeCloseTo(length);
          const expected = new THREE.Vector3(direction[0], 0, -direction[1]).normalize();
          expect(b.sub(a).normalize().distanceTo(expected)).toBeCloseTo(0);
        }
      }
    }
    notes.dispose();
  });

  it('肩轴使用实线，髋轴使用已计算距离的虚线，适用于两种主题', () => {
    const notes = new FloorAnnotations();
    const pose = poseAt(sets[0], sets[0].times[1]);
    notes.update(solvePose(pose), pose);
    const shoulder = lineOf(notes, 'shoulder-projection');
    const hip = lineOf(notes, 'hip-projection');
    expect(shoulder.material.dashed).toBe(false);
    expect(hip.material.dashed).toBe(true);
    expect(hip.material.dashSize).toBe(0.05);
    expect(hip.material.gapSize).toBe(0.035);
    expect(hip.geometry.getAttribute('instanceDistanceEnd').getX(0)).toBeCloseTo(0.48);
    notes.dispose();
  });

  it('夹角弧保持两根地面投影的方向，不随线型改变', () => {
    const notes = new FloorAnnotations();
    for (const set of sets) {
      const pose = poseAt(set, set.times[1]);
      const joints = solvePose(pose);
      notes.update(joints, pose);
      const arc = lineOf(notes, 'separation-arc');
      const start = arc.geometry.getAttribute('instanceStart');
      const end = arc.geometry.getAttribute('instanceEnd');
      const center = new THREE.Vector3(joints.pelvis[0] / 100, 0.004, -joints.pelvis[1] / 100);
      for (const [point, direction] of [
        [new THREE.Vector3().fromBufferAttribute(start, 0), joints.pelvisRight],
        [new THREE.Vector3().fromBufferAttribute(end, end.count - 1), joints.torsoRight],
      ] as const) {
        expect(point.distanceTo(center)).toBeCloseTo(0.38);
        const expected = new THREE.Vector3(direction[0], 0, -direction[1]).normalize();
        expect(point.sub(center).normalize().distanceTo(expected)).toBeCloseTo(0);
      }
    }
    notes.dispose();
  });

  it('承重示意点沿左右脚投影之间移动，保留原模型权重', () => {
    const notes = new FloorAnnotations();
    const base = poseAt(sets[0], sets[0].times[1]);
    for (const w of [0, 0.5, 1]) {
      const pose = { ...base, w };
      const joints = solvePose(pose);
      notes.update(joints, pose);
      const point = notes.group.getObjectByName('weight-point')!.position;
      expect(point.x).toBeCloseTo((joints.footR.ankle[0] * (1 - w) + joints.footL.ankle[0] * w) / 100);
      expect(point.z).toBeCloseTo(-(joints.footR.ankle[1] * (1 - w) + joints.footL.ankle[1] * w) / 100);
    }
    notes.dispose();
  });

  it('俯视主画面和小窗单独叠加轴线，后续轴测与侧视恢复深度', () => {
    const notes = new FloorAnnotations();
    const rig = new CameraRig();
    for (const view of ['top', 'axo', 'top', 'side', 'front'] as const) {
      rig.setView(view, 0, false);
      notes.prepareView(rig.camera);
      for (const name of ['shoulder-projection', 'hip-projection', 'separation-arc']) {
        const line = lineOf(notes, name);
        expect(line.material.depthTest).toBe(view !== 'top');
        expect(line.material.depthWrite).toBe(view !== 'top');
        expect(line.material.opacity).toBe(view === 'top' ? 0.9 : 1);
      }
      // 承重示意条仍贴地，俯视叠加只影响肩髋说明线。
      expect(lineOf(notes, 'weight-bar').material.depthTest).toBe(true);
    }
    notes.dispose();
  });

  it('相机过渡仅在高俯视时显示叠加，不改变投影几何', () => {
    const notes = new FloorAnnotations();
    const pose = poseAt(sets[0], sets[0].times[1]);
    notes.update(solvePose(pose), pose);
    const shoulder = lineOf(notes, 'shoulder-projection');
    const before = ends(shoulder);
    const rig = new CameraRig();
    for (const [elevation, overlay] of [[40, false], [75, true], [16, false]] as const) {
      rig.setViewSpec({ azimuth: 32, elevation, zoom: 1 }, 0, false);
      notes.prepareView(rig.camera);
      expect(shoulder.material.depthTest).toBe(!overlay);
      expect(ends(shoulder)).toEqual(before);
    }
    notes.dispose();
  });
});
