import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewName = 'axo' | 'front' | 'side' | 'top';

export interface ViewSpec {
  azimuth: number;
  elevation: number;
  zoom: number;
}

/** 方位角：相机在模型坐标里的方位（0 在球网一侧，90 在球员右侧）；仰角 0 是平视，90 是正上方 */
export const VIEWS: Record<ViewName, ViewSpec> = {
  axo: { azimuth: 32, elevation: 16, zoom: 1 },
  front: { azimuth: 0, elevation: 3, zoom: 1 },
  side: { azimuth: 90, elevation: 3, zoom: 1 },
  top: { azimuth: 0, elevation: 89.5, zoom: 1 },
};

/** 相机相对目标点的单位方向（Three 坐标） */
export function viewDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  const mx = Math.sin(a) * Math.cos(e);
  const my = Math.cos(a) * Math.cos(e);
  const mz = Math.sin(e);
  return [mx, mz, -my];
}

/** 两个方位角之间走最短的弧 */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const DISTANCE = 12;
const UP = new THREE.Vector3(0, 1, 0);
const NET_UP = new THREE.Vector3(0, 0, -1);

interface Tween {
  from: ViewSpec;
  to: ViewSpec;
  start: number;
  duration: number;
}

/** 正交相机：预设视角之间平滑过渡，也可以切到自由旋转 */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(0, 1.0, 0);
  view: ViewName | 'free' = 'axo';
  private spec: ViewSpec = { ...VIEWS.axo };
  private tween: Tween | null = null;
  private controls: OrbitControls | null = null;
  private controlsChanged = false;

  constructor(readonly frameHeight = 2.6) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    this.apply();
  }

  /** offset：把画面中心往右挪的世界距离（米），给右侧的三视图小窗让位 */
  setAspect(aspect: number, offset = 0, verticalOffset = 0, heightScale = 1): void {
    const h = this.frameHeight / 2 * heightScale;
    this.camera.left = -h * aspect + offset;
    this.camera.right = h * aspect + offset;
    this.camera.top = h + verticalOffset;
    this.camera.bottom = -h + verticalOffset;
    this.camera.updateProjectionMatrix();
  }

  setView(name: ViewName, now: number, animate = true): void {
    this.setViewSpec(VIEWS[name], now, animate);
    this.view = name;
  }

  /** 故事专用相机位置；仍然共用与实验室相同的正交投影和短弧过渡。 */
  setViewSpec(spec: ViewSpec, now: number, animate = true): void {
    this.disableFree();
    const to = { ...spec, zoom: Math.max(0.1, spec.zoom) };
    if (!animate) {
      this.spec = to;
      this.tween = null;
      this.apply();
      return;
    }
    this.tween = { from: { ...this.spec }, to, start: now, duration: 700 };
  }

  /** 动作/站位改变了目标点时，保持当前方位重新对准。 */
  refreshTarget(): void {
    this.controls?.target.copy(this.target);
    if (!this.controls) this.apply();
  }

  enableFree(dom: HTMLElement): void {
    if (this.controls) return;
    this.view = 'free';
    this.tween = null;
    const c = new OrbitControls(this.camera, dom);
    c.target.copy(this.target);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.enablePan = false;
    c.minZoom = 0.6;
    c.maxZoom = 3;
    c.addEventListener('change', () => {
      this.controlsChanged = true;
    });
    this.controls = c;
  }

  disableFree(): void {
    if (!this.controls) return;
    // 从当前相机位置反推方位、仰角，让之后的过渡从这里开始
    const d = this.camera.position.clone().sub(this.target).normalize();
    this.spec = {
      azimuth: (Math.atan2(d.x, -d.z) * 180) / Math.PI,
      elevation: (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI,
      zoom: this.camera.zoom,
    };
    this.controls.dispose();
    this.controls = null;
  }

  /** 每帧调用；返回相机这一帧是否变化（需要重画） */
  update(now: number): boolean {
    if (this.controls) {
      this.controlsChanged = false;
      this.controls.update();
      return this.controlsChanged;
    }
    if (!this.tween) return false;
    const k = Math.min(1, (now - this.tween.start) / this.tween.duration);
    const e = easeInOutCubic(k);
    const { from, to } = this.tween;
    this.spec = {
      azimuth: lerpAngle(from.azimuth, to.azimuth, e),
      elevation: from.elevation + (to.elevation - from.elevation) * e,
      zoom: from.zoom + (to.zoom - from.zoom) * e,
    };
    if (k >= 1) this.tween = null;
    this.apply();
    return true;
  }

  get animating(): boolean {
    return this.tween !== null || this.controls !== null;
  }

  /** 正交相机下，屏幕 1 像素对应的世界长度（米） */
  worldPerPixel(viewportHeightPx: number): number {
    return (this.camera.top - this.camera.bottom) / this.camera.zoom / Math.max(1, viewportHeightPx);
  }

  private apply(): void {
    const [x, y, z] = viewDirection(this.spec.azimuth, this.spec.elevation);
    this.camera.position.set(this.target.x + x * DISTANCE, this.target.y + y * DISTANCE, this.target.z + z * DISTANCE);
    const w = smoothstep(70, 89.5, this.spec.elevation);
    this.camera.up.copy(UP).multiplyScalar(1 - w).addScaledVector(NET_UP, w).normalize();
    this.camera.lookAt(this.target);
    this.camera.zoom = this.spec.zoom;
    this.camera.updateProjectionMatrix();
  }
}
