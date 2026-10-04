import { BODY, type Joints, type Pose } from '../model';
import { type Vec3, add, scale } from '../model/vec';
import { type Camera2D, type Projected, projector } from './project';

export interface FigureOptions {
  path?: readonly Vec3[];
  trail?: readonly Vec3[];
  ball?: { p: Vec3; opacity: number } | null;
  inset?: { cx: number; cy: number; r: number; big?: boolean };
  labels?: { net: string; separation: string };
  /** 双手反手：两条手臂都显示发力和刹车 */
  bothArms?: boolean;
}

const C = {
  near: 'var(--fig-near)',
  far: 'var(--fig-far)',
  fill: 'var(--fig-fill)',
  signal: 'var(--signal)',
  brake: 'var(--brake)',
  shoulder: 'var(--ink)',
  hip: 'var(--faint)',
  text2: 'var(--text-2)',
  ball: 'var(--ball)',
  outline: 'var(--ink)',
};

const f = (v: number): string => v.toFixed(1);
const line = (a: Projected, b: Projected, col: string, w: number, op = 1): string =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"${op < 1 ? ` stroke-opacity="${op.toFixed(2)}"` : ''}/>`;
const points = (pts: readonly Projected[]): string => pts.map((v) => `${f(v[0])},${f(v[1])}`).join(' ');

export function renderFigure(pose: Pose, j: Joints, cam: Camera2D, o: FigureOptions = {}): string {
  const pr = projector(cam);
  const s = cam.scale;
  const a = pose.a;
  const items: { d: number; svg: string }[] = [];
  const limb = (p: Vec3, q: Vec3, col: string, w: number, act: number, brake: number) => {
    const A = pr(p);
    const B = pr(q);
    let svg = line(A, B, col, w * s);
    if (act > 0.03) svg += line(A, B, C.signal, w * s, Math.min(1, act));
    if (brake > 0.03) svg += line(A, B, C.brake, w * s, Math.min(1, brake));
    items.push({ d: (A[2] + B[2]) / 2, svg });
  };

  limb(j.hipL, j.kneeL, C.far, 4.4, a[0], 0);
  limb(j.kneeL, j.footL.ankle, C.far, 4, a[0], 0);
  limb(j.footL.heel, j.footL.toe, C.far, 3.2, 0, 0);
  limb(j.hipR, j.kneeR, C.near, 4.4, a[0], 0);
  limb(j.kneeR, j.footR.ankle, C.near, 4, a[0], 0);
  limb(j.footR.heel, j.footR.toe, C.near, 3.2, 0, 0);

  {
    const q = [j.hipL, j.hipR, j.shoulderR, j.shoulderL].map(pr);
    const pts = points(q);
    let svg = `<polygon points="${pts}" fill="${C.fill}" stroke="${C.near}" stroke-width="${f(1.6 * s)}" stroke-linejoin="round"/>`;
    if (a[2] > 0.03) svg += `<polygon points="${pts}" fill="${C.signal}" fill-opacity="${(a[2] * 0.45).toFixed(2)}"/>`;
    svg += line(q[0], q[1], C.hip, 3.6 * s);
    if (a[1] > 0.03) svg += line(q[0], q[1], C.signal, 3.6 * s, a[1]);
    svg += line(q[3], q[2], C.shoulder, 3.2 * s);
    if (pose.br > 0.03) svg += line(q[3], q[2], C.brake, 3.2 * s, pose.br);
    items.push({ d: q.reduce((m, v) => m + v[2], 0) / 4, svg });
  }

  limb(j.chest, add(j.head, scale(j.torsoUp, -BODY.headRadius)), C.near, 3, 0, 0);
  {
    const H = pr(j.head);
    const N = pr(j.nose);
    items.push({ d: H[2], svg: `<circle cx="${f(H[0])}" cy="${f(H[1])}" r="${f(BODY.headRadius * s)}" fill="${C.fill}" stroke="${C.near}" stroke-width="${f(1.6 * s)}"/>` });
    items.push({ d: N[2] + 0.01, svg: `<circle cx="${f(N[0])}" cy="${f(N[1])}" r="${f(2 * s)}" fill="${C.near}"/>` });
  }

  const armL = o.bothArms ? a[3] : 0;
  const brakeL = o.bothArms ? pose.br : 0;
  limb(j.shoulderL, j.elbowL, C.far, 3.6, armL, brakeL);
  limb(j.elbowL, j.wristL, C.far, 3.2, armL, brakeL);
  limb(j.shoulderR, j.elbowR, C.near, 3.8, a[3], pose.br);
  limb(j.elbowR, j.wristR, C.near, 3.4, a[3], pose.br);

  {
    const A = pr(j.racket.butt);
    const B = pr(j.racket.throat);
    items.push({ d: (A[2] + B[2]) / 2, svg: line(A, B, C.near, 2.6 * s) });
  }
  {
    const q = j.racket.rim.map(pr);
    const pts = points(q);
    let svg = `<polygon points="${pts}" fill="${C.near}" fill-opacity="0.07" stroke="${C.near}" stroke-width="${f(1.7 * s)}" stroke-linejoin="round"/>`;
    if (a[4] > 0.03) svg += `<polygon points="${pts}" fill="none" stroke="${C.signal}" stroke-opacity="${Math.min(1, a[4]).toFixed(2)}" stroke-width="${f(1.9 * s)}" stroke-linejoin="round"/>`;
    items.push({ d: pr(j.racket.center)[2], svg });
  }
  if (o.ball) {
    const b = pr(o.ball.p);
    items.push({
      d: b[2] + 50,
      svg: `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(3.6 * s)}" fill="${C.ball}" stroke="${C.outline}" stroke-width="1" fill-opacity="${o.ball.opacity}" stroke-opacity="${o.ball.opacity}"/>`,
    });
  }

  items.sort((x, y) => x.d - y.d);

  let out = '';
  const g = pr([(pose.lf[0] + pose.rf[0]) / 2, (pose.lf[1] + pose.rf[1]) / 2, 0]);
  out += `<ellipse cx="${f(g[0])}" cy="${f(g[1])}" rx="${f(62 * s)}" ry="${f(11 * s)}" fill="${C.near}" fill-opacity="0.05"/>`;
  const wg = pr([pose.rf[0] + (pose.lf[0] - pose.rf[0]) * pose.w, pose.rf[1] + (pose.lf[1] - pose.rf[1]) * pose.w, 0]);
  out += `<circle cx="${f(wg[0])}" cy="${f(wg[1])}" r="${f(7 * s)}" fill="none" stroke="${C.near}" stroke-opacity="0.35" stroke-width="1"/><circle cx="${f(wg[0])}" cy="${f(wg[1])}" r="${f(3.2 * s)}" fill="${C.near}"/>`;
  if (o.path) out += `<polyline points="${points(o.path.map(pr))}" fill="none" stroke="${C.text2}" stroke-width="1" stroke-dasharray="3 4" stroke-opacity="0.7"/>`;
  if (o.trail && o.trail.length > 1) {
    for (let i = 1; i < o.trail.length; i++) out += line(pr(o.trail[i - 1]), pr(o.trail[i]), C.signal, 2.2, (i / o.trail.length) * 0.8);
  }
  out += items.map((x) => x.svg).join('');
  if (o.inset) out += inset(pose, o.inset, o.labels ?? { net: 'NET', separation: 'X' });
  return out;
}

function inset(p: Pose, o: NonNullable<FigureOptions['inset']>, labels: { net: string; separation: string }): string {
  const { cx, cy, r, big } = o;
  const fs = big ? 13 : 11;
  const rad = (d: number) => (d * Math.PI) / 180;
  const ln = (yaw: number, l: number) => [Math.cos(rad(yaw)) * l, Math.sin(rad(yaw)) * l];
  const h = ln(p.pel[3], r * 0.55);
  const sh = ln(p.tor[0], r * 0.8);
  const sep = Math.round(Math.abs(p.tor[0] - p.pel[3]));
  const kk = r / 60;
  let svg = `<g data-diagram="shoulder-hip"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.hip}" stroke-width="0.8"/>`;
  for (const [q, solid] of [[p.lf, false], [p.rf, true]] as const) {
    const x = cx + (q[0] - p.pel[0]) * kk;
    const y = cy - (q[1] - p.pel[1]) * kk;
    svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.08)}" ry="${f(r * 0.19)}" transform="rotate(${f(q[2])} ${f(x)} ${f(y)})" fill="${solid ? C.text2 : 'none'}" stroke="${C.text2}" stroke-width="1"/>`;
  }
  svg += `<line x1="${f(cx - h[0])}" y1="${f(cy - h[1])}" x2="${f(cx + h[0])}" y2="${f(cy + h[1])}" stroke="${C.hip}" stroke-width="${big ? 5 : 3.5}" stroke-linecap="round"/>`;
  svg += `<line x1="${f(cx - sh[0])}" y1="${f(cy - sh[1])}" x2="${f(cx + sh[0])}" y2="${f(cy + sh[1])}" stroke="${C.shoulder}" stroke-width="${big ? 3.5 : 2.5}" stroke-linecap="round"/>`;
  svg += `<circle cx="${f(cx + sh[0])}" cy="${f(cy + sh[1])}" r="${big ? 4 : 2.8}" fill="${C.shoulder}"/>`;
  svg += `<path d="M${cx - 4} ${cy - r - 5} L${cx} ${cy - r - 11} L${cx + 4} ${cy - r - 5}" fill="none" stroke="${C.text2}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  svg += `<text x="${cx + 8}" y="${cy - r - 5}" style="font-size:${fs}px;fill:${C.text2}">${labels.net}</text>`;
  svg += `<text x="${cx}" y="${cy + r + 15}" text-anchor="middle" style="font-size:${fs}px;fill:${C.text2}">${labels.separation} ${sep}°</text>`;
  return svg + '</g>';
}
