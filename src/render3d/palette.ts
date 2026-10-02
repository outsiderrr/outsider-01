import * as THREE from 'three';

export interface Palette {
  paper: THREE.Color;
  paper2: THREE.Color;
  grid: THREE.Color;
  gridMajor: THREE.Color;
  ink: THREE.Color;
  text: THREE.Color;
  text2: THREE.Color;
  faint: THREE.Color;
  signal: THREE.Color;
  brake: THREE.Color;
  ball: THREE.Color;
  figFill: THREE.Color;
  figShade: THREE.Color;
  court: THREE.Color;
  dark: boolean;
}

const VARS = {
  paper: '--paper',
  paper2: '--paper-2',
  grid: '--grid',
  gridMajor: '--grid-major',
  ink: '--ink',
  text: '--text',
  text2: '--text-2',
  faint: '--faint',
  signal: '--signal',
  brake: '--brake',
  ball: '--ball',
  figFill: '--fig-fill',
  figShade: '--fig-shade',
  court: '--court-line',
} as const;

/** 从页面的 CSS 变量读出 3D 用的颜色，保证 3D 与页面主题一致 */
export function readPalette(el: HTMLElement = document.documentElement): Palette {
  const cs = getComputedStyle(el);
  const get = (name: string) => new THREE.Color(cs.getPropertyValue(name).trim() || '#808080');
  const out = Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, get(v)])) as Omit<Palette, 'dark'>;
  const p = out.paper;
  const lum = 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
  return { ...out, dark: lum < 0.2 };
}

/** 主题切换时回调；返回取消监听的函数 */
export function onPaletteChange(cb: (p: Palette) => void): () => void {
  const handler = () => cb(readPalette());
  window.addEventListener('themechange', handler);
  return () => window.removeEventListener('themechange', handler);
}
