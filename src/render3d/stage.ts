import * as THREE from 'three';
import {
  type KeyframeSet, type Stance, type Stroke, RACKET, getSet, poseAt, racketSpeed, shoulderHipSeparation, solvePose,
} from '../model';
import { add, scale } from '../model/vec';
import { FloorAnnotations } from './annotations';
import { Ball, ballPosition } from './ball';
import { CameraRig, VIEWS, type ViewName, viewDirection } from './cameraRig';
import { LabelLayer } from './labels';
import { Mannequin } from './mannequin';
import { OUTLINE_COLOR, OUTLINE_WIDTH } from './materials';
import { type Palette, onPaletteChange, readPalette } from './palette';
import { FpsGovernor, TIER_SETTINGS, type QualityTier, detectDevice, initialTier } from './quality';
import { Racket } from './racket';
import { toThree } from './space';
import { Trail } from './trail';

export interface Overlays {
  floor: boolean;
  trail: boolean;
  path: boolean;
  markers: boolean;
  labels: boolean;
}

export interface Readout {
  speed: number;
  separation: number;
  weightLeft: number;
}

export type MiniName = 'front' | 'side' | 'top';
export interface MiniRect {
  name: MiniName;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StageOptions {
  multiView?: boolean;
  overlays?: Partial<Overlays>;
  /** 标签文字（随语言变化） */
  label?: (kind: 'separation' | 'speed', value: number) => string;
  /** 每次重画后回调（用于同步三视图的 HTML 标签位置） */
  onLayout?: (rects: MiniRect[]) => void;
  tier?: QualityTier;
}

export interface Stage {
  readonly canvas: HTMLCanvasElement;
  setMotion(stroke: Stroke, stance: Stance): void;
  setTime(t: number): void;
  setView(v: ViewName | 'free'): void;
  setMultiView(on: boolean): void;
  setOverlays(o: Partial<Overlays>): void;
  setPlaying(on: boolean): void;
  readout(): Readout;
  tier(): QualityTier;
  dispose(): void;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uGrid;
  uniform vec3 uMajor;
  uniform vec2 uCenter;
  varying vec3 vWorld;
  float gridLine(vec2 p, float size, float width) {
    vec2 g = abs(fract(p / size - 0.5) - 0.5) * size;
    vec2 fw = fwidth(p) * width;
    vec2 l = 1.0 - smoothstep(vec2(0.0), fw, g);
    return max(l.x, l.y);
  }
  void main() {
    float minor = gridLine(vWorld.xz, 0.1, 1.0);
    float major = gridLine(vWorld.xz, 0.5, 1.4);
    float d = length(vWorld.xz - uCenter);
    float fade = 1.0 - smoothstep(1.0, 3.0, d);
    vec3 col = mix(uGrid, uMajor, major);
    float a = max(minor * 0.7, major) * fade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createStage(container: HTMLElement, opts: StageOptions = {}): Stage | null {
  if (!webglAvailable()) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  container.appendChild(canvas);

  let tier: QualityTier = opts.tier ?? initialTier(detectDevice());
  let palette: Palette = readPalette();
  const overlays: Overlays = { floor: true, trail: true, path: true, markers: true, labels: true, ...opts.overlays };
  let multi = opts.multiView ?? false;
  let set: KeyframeSet = getSet('forehand', 'semi');
  let t = 0;
  let playing = false;
  let sceneDirty = true;
  let dirty = true;
  let lastRender = 0;
  let width = 1;
  let height = 1;
  let rects: MiniRect[] = [];

  const scene = new THREE.Scene();
  const rig = new CameraRig(2.6);
  const labels = new LabelLayer(container);

  // 地面：网格、球场线、阴影
  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: { uGrid: { value: new THREE.Color() }, uMajor: { value: new THREE.Color() }, uCenter: { value: new THREE.Vector2() } },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -2;
  scene.add(floor);

  const courtMat = new THREE.MeshBasicMaterial({ color: '#8fa3c4' });
  const baseline = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.06), courtMat);
  baseline.rotation.x = -Math.PI / 2;
  baseline.position.set(0, 0.001, -0.9);
  const centerMark = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.12), courtMat);
  centerMark.rotation.x = -Math.PI / 2;
  centerMark.position.set(-1.4, 0.001, -0.96);
  scene.add(baseline, centerMark);

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.13 });
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), shadowMat);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.0015;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.12, depthWrite: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  scene.add(blob);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.01;
  const sc = light.shadow.camera;
  sc.left = -1.8;
  sc.right = 1.8;
  sc.top = 1.8;
  sc.bottom = -1.8;
  sc.near = 0.5;
  sc.far = 9;
  scene.add(light, light.target);

  const mannequin = new Mannequin(palette, tier);
  const racket = new Racket();
  const ball = new Ball();
  const trail = new Trail();
  const notes = new FloorAnnotations();
  scene.add(mannequin.group, racket.group, ball.mesh, trail.sweep, trail.path, notes.group);

  const minis: Record<MiniName, THREE.OrthographicCamera> = {
    front: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40),
    side: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40),
    top: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40),
  };

  const governor = new FpsGovernor(tier, (next) => {
    tier = next;
    applyTier();
  });

  function applyTier(): void {
    const s = TIER_SETTINGS[tier];
    const pr = Math.min(window.devicePixelRatio || 1, s.maxDpr);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = s.shadows;
    light.castShadow = s.shadows;
    shadowCatcher.visible = s.shadows;
    blob.visible = !s.shadows;
    mannequin.setTier(tier);
    mannequin.setPixelRatio(pr);
    shadowMat.needsUpdate = true;
    dirty = true;
  }

  function applyPalette(p: Palette): void {
    palette = p;
    scene.background = p.paper.clone();
    OUTLINE_COLOR.value.copy(p.ink);
    floorMat.uniforms.uGrid.value.copy(p.grid);
    floorMat.uniforms.uMajor.value.copy(p.gridMajor);
    courtMat.color.copy(p.court);
    shadowMat.color.copy(p.dark ? new THREE.Color('#000814') : p.ink);
    shadowMat.opacity = p.dark ? 0.35 : 0.13;
    blobMat.color.copy(p.dark ? new THREE.Color('#000814') : p.ink);
    blobMat.opacity = p.dark ? 0.3 : 0.11;
    mannequin.setPalette(p);
    racket.setPalette(p);
    ball.setPalette(p);
    trail.setPalette(p);
    notes.setPalette(p);
    sceneDirty = true;
    dirty = true;
  }

  function frameTargets(): void {
    // 以整个挥拍过程中骨盆的平均位置为视角中心
    let x = 0;
    let y = 0;
    for (let i = 0; i <= 20; i++) {
      const p = poseAt(set, (set.times[set.times.length - 1] * i) / 20);
      x += p.pel[0];
      y += p.pel[1];
    }
    const center = toThree([x / 21, y / 21, 100]);
    rig.target.copy(center);
    floorMat.uniforms.uCenter.value.set(center.x, center.z);
    light.position.set(center.x - 1.3, 3.6, center.z - 1.5);
    light.target.position.set(center.x, 0, center.z);
  }

  function layout(): void {
    rects = [];
    if (multi && width >= 720) {
      const gap = 10;
      let sw = Math.round(Math.min(210, Math.max(132, width * 0.19)));
      let sh = Math.round(sw * 1.05);
      const maxH = (height - 28 - 2 * gap) / 3;
      if (sh > maxH) {
        sh = Math.floor(maxH);
        sw = Math.round(sh / 1.05);
      }
      const x = width - sw - 14;
      (['front', 'side', 'top'] as const).forEach((name, i) => rects.push({ name, x, y: 14 + i * (sh + gap), w: sw, h: sh }));
    }
    const shiftPx = rects.length ? (rects[0].w + 28) / 2 : 0;
    rig.setAspect(width / height, (shiftPx * rig.frameHeight) / height);
    opts.onLayout?.(rects);
  }

  function resize(): void {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    layout();
    dirty = true;
  }

  function updateScene(): void {
    const pose = poseAt(set, t);
    const j = solvePose(pose);
    mannequin.update(j, pose, set.stroke === 'backhand');
    mannequin.setMarkersVisible(overlays.markers);
    racket.update(j.racket, pose.a[4]);
    ball.update(ballPosition(set, t));
    trail.sweep.visible = overlays.trail;
    if (overlays.trail) trail.update(set, t);
    trail.path.visible = overlays.path;
    notes.group.visible = overlays.floor;
    if (overlays.floor) notes.update(j, pose);
    const pc = toThree([pose.pel[0], pose.pel[1], 0]);
    blob.position.set(pc.x, 0.002, pc.z);

    const sep = Math.abs(shoulderHipSeparation(pose));
    const fmt = opts.label ?? ((k: string, v: number) => (k === 'speed' ? `${v.toFixed(1)} m/s` : `${Math.round(v)}°`));
    labels.setVisible(overlays.labels);
    labels.set('sep', overlays.floor && sep >= 4 ? notes.arcLabel : null, fmt('separation', sep), 'is-sep');
    const tc = set.times[set.contactIndex];
    const near = Math.abs(t - tc) < 0.07;
    const tip = add(j.racket.center, scale(j.racket.dir, RACKET.headHalfLength + 6));
    labels.set('speed', near ? toThree(tip) : null, fmt('speed', racketSpeed(set, tc)), 'is-speed');
    sceneDirty = false;
  }

  function renderView(camera: THREE.OrthographicCamera, x: number, y: number, w: number, h: number, outlinePx: number, clear: THREE.Color): void {
    renderer.setViewport(x, height - y - h, w, h);
    renderer.setScissor(x, height - y - h, w, h);
    renderer.setScissorTest(true);
    renderer.setClearColor(clear, 1);
    renderer.clear();
    const wpp = (camera.top - camera.bottom) / camera.zoom / h;
    OUTLINE_WIDTH.value = outlinePx * wpp;
    notes.setResolution(w, h);
    renderer.render(scene, camera);
  }

  function placeMini(name: MiniName, cam: THREE.OrthographicCamera, aspect: number): void {
    const spec = VIEWS[name];
    const el = name === 'top' ? 89.9 : 0;
    const [x, y, z] = viewDirection(spec.azimuth, el);
    const tg = rig.target;
    cam.position.set(tg.x + x * 12, tg.y + y * 12, tg.z + z * 12);
    if (name === 'top') cam.up.set(0, 0, -1);
    else cam.up.set(0, 1, 0);
    cam.lookAt(tg);
    const half = name === 'top' ? 1.15 : 1.3;
    cam.left = -half * aspect;
    cam.right = half * aspect;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
  }

  function render(now: number): void {
    if (sceneDirty) updateScene();
    renderView(rig.camera, 0, 0, width, height, 1.5, palette.paper);
    labels.update(rig.camera, width, height);
    for (const r of rects) {
      const cam = minis[r.name];
      placeMini(r.name, cam, r.w / r.h);
      renderView(cam, r.x, r.y, r.w, r.h, 1.1, palette.paper2);
    }
    renderer.setScissorTest(false);
    if (playing && lastRender && now - lastRender < 120) governor.sample(now - lastRender);
    lastRender = now;
  }

  let raf = 0;
  const loop = (now: number) => {
    if (rig.update(now)) dirty = true;
    if (dirty || sceneDirty) {
      dirty = false;
      render(now);
    }
    raf = requestAnimationFrame(loop);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const offPalette = onPaletteChange(applyPalette);

  applyPalette(palette);
  frameTargets();
  trail.setMotion(set);
  resize();
  applyTier();
  raf = requestAnimationFrame(loop);

  return {
    canvas,
    setMotion(stroke, stance) {
      set = getSet(stroke, stance);
      frameTargets();
      trail.setMotion(set);
      sceneDirty = true;
    },
    setTime(v) {
      t = v;
      sceneDirty = true;
    },
    setView(v) {
      if (v === 'free') rig.enableFree(canvas);
      else rig.setView(v, performance.now());
      canvas.classList.toggle('is-free', v === 'free');
      dirty = true;
    },
    setMultiView(on) {
      multi = on;
      layout();
      dirty = true;
    },
    setOverlays(o) {
      Object.assign(overlays, o);
      sceneDirty = true;
    },
    setPlaying(on) {
      playing = on;
      lastRender = 0;
      governor.reset();
    },
    readout() {
      const pose = poseAt(set, t);
      return { speed: racketSpeed(set, t), separation: Math.abs(shoulderHipSeparation(pose)), weightLeft: pose.w };
    },
    tier: () => tier,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      offPalette();
      rig.disableFree();
      mannequin.dispose();
      racket.dispose();
      ball.dispose();
      trail.dispose();
      notes.dispose();
      labels.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
