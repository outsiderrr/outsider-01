import { stepAt } from './progress';

/** 图 01 的五个滚动位置只表示强调顺序，不伪装成各关节实测峰值。 */
export function chainState(progress: number): { time: number; group: number; progress: number } {
  const p = Math.max(0, Math.min(1, progress));
  return { time: 0.55 + (0.92 - 0.55) * p, group: stepAt(p, 5).index, progress: p };
}

export function cursorPosition(time: number, start: number, end: number, left: number, right: number): number {
  if (end <= start) return left;
  const p = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return left + (right - left) * p;
}

export function updateChainFigure(section: HTMLElement, time: number, group: number): void {
  const cursor = section.querySelector<SVGLineElement>('[data-chain-cursor]');
  const svg = cursor?.ownerSVGElement;
  if (cursor && svg) {
    const x = cursorPosition(time, Number(svg.dataset.timeStart ?? 0.55), Number(svg.dataset.timeEnd ?? 1.22), Number(svg.dataset.xStart ?? 48), Number(svg.dataset.xEnd ?? 580));
    cursor.setAttribute('x1', x.toFixed(2));
    cursor.setAttribute('x2', x.toFixed(2));
    let reveal = svg.querySelector<SVGRectElement>('[data-chain-reveal]');
    if (!reveal) {
      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'defs');
      const clip = document.createElementNS(ns, 'clipPath');
      clip.id = `${section.id || 'chain'}-progress-clip`;
      clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
      reveal = document.createElementNS(ns, 'rect');
      reveal.dataset.chainReveal = '';
      reveal.setAttribute('x', '0');
      reveal.setAttribute('y', '0');
      reveal.setAttribute('height', '240');
      clip.append(reveal);
      defs.append(clip);
      svg.prepend(defs);
    }
    reveal.setAttribute('width', x.toFixed(2));
    for (const curve of svg.querySelectorAll<SVGPathElement>('[data-curve]')) {
      const names = ['pelvis', 'torso', 'arm', 'head'];
      const index = names.indexOf(curve.dataset.curve ?? '');
      curve.classList.toggle('is-active', index + 1 === group);
      // 用 SVG clip path 揭示曲线，保留整张图的静态无脚本版本。
      curve.setAttribute('clip-path', `url(#${section.id || 'chain'}-progress-clip)`);
    }
  }
}
