import * as THREE from 'three';

interface Item {
  el: HTMLDivElement;
  pos: THREE.Vector3 | null;
  text: string;
}

/** 贴在 3D 点上的文字标签（HTML，文字清晰、可被读屏软件读到） */
export class LabelLayer {
  readonly el: HTMLDivElement;
  private readonly items = new Map<string, Item>();
  private readonly v = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stage-labels';
    container.appendChild(this.el);
  }

  set(id: string, pos: THREE.Vector3 | null, text: string, cls = ''): void {
    let it = this.items.get(id);
    if (!it) {
      const el = document.createElement('div');
      el.className = `stage-label ${cls}`.trim();
      this.el.appendChild(el);
      it = { el, pos: null, text: '' };
      this.items.set(id, it);
    }
    if (it.text !== text) {
      it.el.textContent = text;
      it.text = text;
    }
    it.pos = pos ? (it.pos ?? new THREE.Vector3()).copy(pos) : null;
    it.el.hidden = !pos;
  }

  update(camera: THREE.Camera, w: number, h: number): void {
    for (const it of this.items.values()) {
      if (!it.pos) continue;
      this.v.copy(it.pos).project(camera);
      const x = ((this.v.x + 1) / 2) * w;
      const y = ((1 - this.v.y) / 2) * h;
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
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
