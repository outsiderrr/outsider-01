import * as THREE from 'three';
import { clampLabelCenter, type LabelBounds } from './labelLayout';

interface Item {
  el: HTMLDivElement;
  pos: THREE.Vector3 | null;
  text: string;
  leader: SVGLineElement;
}

/** 贴在 3D 点上的文字标签（HTML，文字清晰、可被读屏软件读到） */
export class LabelLayer {
  readonly el: HTMLDivElement;
  private readonly items = new Map<string, Item>();
  private readonly v = new THREE.Vector3();
  private readonly leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stage-labels';
    this.leaders.setAttribute('aria-hidden', 'true');
    Object.assign(this.leaders.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', color: 'var(--ink)' });
    this.el.append(this.leaders);
    container.appendChild(this.el);
  }

  set(id: string, pos: THREE.Vector3 | null, text: string, cls = ''): void {
    let it = this.items.get(id);
    if (!it) {
      const el = document.createElement('div');
      el.className = `stage-label ${cls}`.trim();
      this.el.appendChild(el);
      const leader = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      leader.setAttribute('stroke', 'currentColor');
      leader.setAttribute('stroke-width', '1');
      leader.setAttribute('stroke-dasharray', '2 3');
      leader.setAttribute('opacity', '0.65');
      this.leaders.append(leader);
      it = { el, pos: null, text: '', leader };
      this.items.set(id, it);
    }
    if (it.text !== text) {
      it.el.textContent = text;
      it.text = text;
    }
    it.pos = pos ? (it.pos ?? new THREE.Vector3()).copy(pos) : null;
    it.el.hidden = !pos;
    if (!pos) it.leader.style.display = 'none';
  }

  update(camera: THREE.Camera, w: number, h: number, bounds: LabelBounds = { x: 0, y: 0, w, h }): void {
    if (this.el.hidden) return;
    this.leaders.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const it of this.items.values()) {
      if (!it.pos || it.el.hidden) continue;
      it.el.style.maxWidth = `${Math.max(48, bounds.w - 16)}px`;
      it.el.style.whiteSpace = 'normal';
      this.v.copy(it.pos).project(camera);
      const x = ((this.v.x + 1) / 2) * w;
      const y = ((1 - this.v.y) / 2) * h;
      const width = it.el.offsetWidth;
      const height = it.el.offsetHeight;
      if (!width || !height) continue;
      const center = clampLabelCenter(x, y, width, height, bounds);
      it.el.style.transform = `translate(${center.x.toFixed(1)}px, ${center.y.toFixed(1)}px)`;
      const displaced = Math.hypot(center.x - x, center.y - y) > 8;
      it.leader.style.display = displaced ? '' : 'none';
      if (displaced) {
        it.leader.setAttribute('x1', String(Math.max(2, Math.min(w - 2, x))));
        it.leader.setAttribute('y1', String(Math.max(2, Math.min(h - 2, y))));
        it.leader.setAttribute('x2', String(Math.max(center.x - width / 2, Math.min(center.x + width / 2, x))));
        it.leader.setAttribute('y2', String(Math.max(center.y - height / 2, Math.min(center.y + height / 2, y))));
      }
    }
  }

  setVisible(v: boolean): void {
    this.el.hidden = !v;
  }

  dispose(): void {
    this.el.remove();
    this.items.clear();
  }
}
