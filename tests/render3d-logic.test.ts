import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig, VIEWS, lerpAngle, viewDirection } from '../src/render3d/cameraRig';
import { FpsGovernor, initialTier } from '../src/render3d/quality';
import { dirToThree, toThree } from '../src/render3d/space';

describe('space', () => {
  it('模型坐标（cm，z 向上）换算到 Three（m，y 向上）', () => {
    const v = toThree([100, 200, 50]);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0.5);
    expect(v.z).toBeCloseTo(-2);
  });
  it('保持右手系', () => {
    const x = dirToThree([1, 0, 0]);
    const y = dirToThree([0, 1, 0]);
    const z = dirToThree([0, 0, 1]);
    const c = new THREE.Vector3().crossVectors(x, y);
    expect(c.distanceTo(z)).toBeCloseTo(0);
  });
});

describe('cameraRig', () => {
  it('方位 0 平视时，相机在球网一侧（Three 的 −z 方向）', () => {
    const [x, y, z] = viewDirection(0, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });
  it('方位 90 在球员右侧，仰角 90 在正上方', () => {
    expect(viewDirection(90, 0)[0]).toBeCloseTo(1);
    expect(viewDirection(0, 90)[1]).toBeCloseTo(1);
  });
  it('lerpAngle 走最短的弧', () => {
    expect(((lerpAngle(350, 10, 0.5) % 360) + 360) % 360).toBeCloseTo(0);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0);
  });
  it('四个预设视角都在定义里', () => {
    expect(Object.keys(VIEWS).sort()).toEqual(['axo', 'front', 'side', 'top']);
  });
  it('故事专用后方视角可以直接设置，也可以平滑过渡', () => {
    const rig = new CameraRig();
    rig.setViewSpec({ azimuth: 145, elevation: 18, zoom: 1.2 }, 0, false);
    expect(rig.animating).toBe(false);
    expect(rig.camera.position.z).toBeGreaterThan(0);
    expect(rig.camera.zoom).toBe(1.2);
    rig.setViewSpec({ azimuth: -145, elevation: 18, zoom: 1 }, 100);
    expect(rig.animating).toBe(true);
    rig.update(800);
    expect(rig.animating).toBe(false);
    expect(rig.camera.position.x).toBeLessThan(0);
  });
  it('移动端底部三视图为主画面保留上方空间', () => {
    const rig = new CameraRig();
    rig.setAspect(0.8, 0, -0.4, 1.3);
    expect((rig.camera.top + rig.camera.bottom) / 2).toBeCloseTo(-0.4);
    expect(rig.camera.top - rig.camera.bottom).toBeCloseTo(2.6 * 1.3);
  });
});

describe('quality', () => {
  it('initialTier 按设备分档', () => {
    expect(initialTier({ mobile: false, dpr: 2, cores: 8 })).toBe('high');
    expect(initialTier({ mobile: false, dpr: 1, cores: 2 })).toBe('medium');
    expect(initialTier({ mobile: true, dpr: 3, cores: 8 })).toBe('medium');
    expect(initialTier({ mobile: true, dpr: 2, cores: 4 })).toBe('low');
  });
  it('持续 3 秒低于 45 帧降一档，只回调一次', () => {
    const seen: string[] = [];
    const g = new FpsGovernor('high', (t) => seen.push(t));
    for (let i = 0; i < 95; i++) g.sample(1000 / 30);
    expect(seen).toEqual(['medium']);
  });
  it('帧率正常不降档；已是最低档不再回调', () => {
    const seen: string[] = [];
    const ok = new FpsGovernor('high', (t) => seen.push(t));
    for (let i = 0; i < 200; i++) ok.sample(1000 / 60);
    expect(seen).toEqual([]);
    const low = new FpsGovernor('low', (t) => seen.push(t));
    for (let i = 0; i < 200; i++) low.sample(1000 / 20);
    expect(seen).toEqual([]);
  });
});
