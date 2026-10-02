import { t, type Lang } from '../i18n';
import { chainCurves, getSet, peakTime, PHASES, poseAt, solvePose, type PhaseId, type Stance, type Stroke } from '../model';
import { type Vec3 } from '../model/vec';
import { projector, type Camera2D } from '../render2d/project';
import { renderFigure } from '../render2d/stickFigure';
import { stanceSnapshot } from '../story/stanceModel';

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (value: number): string => value.toFixed(1);

/** 直接复用动作模型与 2D 渲染器，静态线稿不是独立绘制的一套姿势。 */
export function renderPhaseFigure(stroke: Stroke, stance: Stance, phase: PhaseId, lang: Lang): string {
  const set = getSet(stroke, stance);
  const index = PHASES.indexOf(phase);
  const pose = poseAt(set, set.times[index]);
  const joints = solvePose(pose);
  const views = [
    { phi: 30, elev: 16 }, { phi: 0, elev: 80 }, { phi: 90, elev: 12 },
    { phi: stroke === 'forehand' ? 18 : -18, elev: 12 }, { phi: 155, elev: 20 },
  ];
  const camera: Camera2D = { ...views[index], scale: 1, cx: 0, groundY: 0 };
  const pr = projector(camera);
  const bodyPoints: Vec3[] = [joints.head, joints.nose, joints.hipL, joints.hipR, joints.kneeL, joints.kneeR,
    joints.footL.toe, joints.footR.toe, joints.footL.heel, joints.footR.heel, joints.shoulderL, joints.shoulderR,
    joints.elbowL, joints.elbowR, joints.wristL, joints.wristR, ...joints.racket.rim];
  const projected = bodyPoints.map(pr);
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const xmin = Math.min(...xs) - 16;
  const xmax = Math.max(...xs) + 16;
  const ymin = Math.min(...ys) - 16;
  const ymax = Math.max(...ys) + 16;
  camera.scale = Math.min(490 / (xmax - xmin), 340 / (ymax - ymin), 1.85);
  camera.cx = 300 - ((xmin + xmax) / 2) * camera.scale;
  camera.groundY = 220 - ((ymin + ymax) / 2) * camera.scale;
  const label = `${t(lang, `stroke.${stroke}`)} · ${t(lang, `stance.${stance}`)} · ${t(lang, `phase.${stroke}.${stance}.${phase}.name`)}`;
  return `<svg class="phase-figure" viewBox="0 0 600 440" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 48V28H52 M548 28H568V48 M32 392V412H52 M548 412H568V392" fill="none" stroke="var(--faint)"/>
    ${renderFigure(pose, joints, camera, { bothArms: stroke === 'backhand', ball: phase === 'contact' ? { p: joints.racket.center, opacity: 1 } : null })}
    <text x="34" y="432" fill="var(--text-2)" font-size="12" font-family="var(--font-mono)">${String(index + 1).padStart(2, '0')} / 05 · ${set.times[index].toFixed(2)} s</text>
    <text x="566" y="432" text-anchor="end" fill="var(--text-2)" font-size="12">${escape(t(lang, 'lab.modelNote'))}</text>
  </svg>`;
}

/** 每条曲线独立归一化；线型与文字同时区分，不只依赖颜色。 */
export function renderChainChart(lang: Lang): string {
  const curves = chainCurves(getSet('forehand', 'semi'), 180);
  const x0 = 62, x1 = 568, top = 36, bottom = 208;
  const x = (time: number) => x0 + (time - .55) / (1.22 - .55) * (x1 - x0);
  const keys = ['pelvis', 'torso', 'arm', 'head'] as const;
  const colors = ['var(--text-2)', 'var(--brake)', 'var(--ink)', 'var(--signal)'];
  const dashes = ['2 4', '8 4', '14 4', 'none'];
  const paths = keys.map((key, i) => {
    const max = Math.max(...curves[key]);
    const path = curves.t.map((time, k) => `${k ? 'L' : 'M'}${n(x(time))},${n(bottom - Math.max(0, curves[key][k]) / max * (bottom - top))}`).join(' ');
    const peak = peakTime(curves.t, curves[key]);
    return `<path data-curve="${key}" d="${path}" fill="none" stroke="${colors[i]}" stroke-width="${key === 'head' ? 2.8 : 2}" stroke-dasharray="${dashes[i]}"/><circle cx="${n(x(peak))}" cy="${top}" r="3" fill="${colors[i]}"/>`;
  }).join('');
  return `<svg class="chain-chart" viewBox="0 0 600 280" role="img" aria-label="${escape(t(lang, 'chain.chart.title'))}" data-time-start="0.55" data-time-end="1.22" data-x-start="${x0}" data-x-end="${x1}" xmlns="http://www.w3.org/2000/svg">
    ${[0, .5, 1].map((v) => `<path d="M${x0} ${n(bottom - v * (bottom - top))}H${x1}" stroke="var(--line)" fill="none"/><text x="48" y="${n(bottom - v * (bottom - top) + 5)}" text-anchor="end" fill="var(--text-2)" font-size="14">${Math.round(v * 100)}%</text>`).join('')}
    ${paths}
    <path d="M${n(x(.92))} ${top}V${bottom}" stroke="var(--signal)" stroke-dasharray="2 5" opacity=".6"/>
    <text x="${n(x(.92) + 5)}" y="22" fill="var(--signal-text)" font-size="14">${escape(t(lang, 'chain.chart.contact'))}</text>
    <line data-chain-cursor x1="${x0}" x2="${x0}" y1="30" y2="214" stroke="var(--text)" stroke-width="1.3"/>
    ${[.55, .7, .85, 1, 1.22].map((time) => `<text x="${n(x(time))}" y="239" text-anchor="${time === 1.22 ? 'end' : 'middle'}" fill="var(--text-2)" font-size="14" font-family="var(--font-mono)">${time.toFixed(2)}</text>`).join('')}
    <text x="568" y="273" text-anchor="end" fill="var(--text-2)" font-size="14">${escape(t(lang, 'chain.chart.x'))}</text>
  </svg>`;
}

/** 脚、身体方向、重心与击球点完全来自同一个站位快照。 */
export function renderStanceFigure(stroke: Stroke, value: number, lang: Lang): string {
  const s = stanceSnapshot(stroke, value);
  const x = (v: number) => 300 + v * 2.3;
  const y = (v: number) => 314 - v * 2.3;
  const foot = (v: readonly number[], dashed: boolean) => `<ellipse cx="${n(x(v[0]))}" cy="${n(y(v[1]))}" rx="12" ry="27" transform="rotate(${n(v[2])} ${n(x(v[0]))} ${n(y(v[1]))})" fill="${dashed ? 'none' : 'var(--ink)'}" fill-opacity=".08" stroke="${dashed ? 'var(--signal)' : 'var(--ink)'}" stroke-width="2"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
  const direction = (yaw: number, half: number, color: string, width: number) => {
    const rad = yaw * Math.PI / 180;
    const dx = Math.cos(rad) * half;
    const dy = -Math.sin(rad) * half;
    return `<path d="M${n(x(s.backswing.pelvis[0] - dx))} ${n(y(s.backswing.pelvis[1] - dy))}L${n(x(s.backswing.pelvis[0] + dx))} ${n(y(s.backswing.pelvis[1] + dy))}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  const start = s.backswing.weightCenter, end = s.contact.weightCenter;
  const ax = x(end[0]) - x(start[0]), ay = y(end[1]) - y(start[1]);
  const angle = Math.atan2(ay, ax);
  const arrow = `M${n(x(start[0]))} ${n(y(start[1]))}L${n(x(end[0]))} ${n(y(end[1]))}M${n(x(end[0]) - Math.cos(angle - .5) * 12)} ${n(y(end[1]) - Math.sin(angle - .5) * 12)}L${n(x(end[0]))} ${n(y(end[1]))}L${n(x(end[0]) - Math.cos(angle + .5) * 12)} ${n(y(end[1]) - Math.sin(angle + .5) * 12)}`;
  return `<svg class="stance-figure" viewBox="0 0 600 460" role="img" aria-label="${escape(t(lang, 'stances.title'))}" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 70H540 M60 400H540 M300 390V410" stroke="var(--faint)" stroke-width="1" fill="none"/>
    <path d="M300 51V23M294 30L300 23L306 30" stroke="var(--ink)" stroke-width="1.5" fill="none"/>
    <text x="316" y="39" fill="var(--text-2)" font-size="13">${escape(t(lang, 'lab.net'))}</text>
    ${foot(s.backswing.feet.left, false)}${foot(s.backswing.feet.right, false)}${foot(s.contact.feet.left, true)}${foot(s.contact.feet.right, true)}
    ${direction(s.backswing.hipYaw, 12, 'var(--faint)', 6)}${direction(s.backswing.shoulderYaw, 22, 'var(--ink)', 3)}
    <circle cx="${n(x(s.backswing.pelvis[0]))}" cy="${n(y(s.backswing.pelvis[1]))}" r="10" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>
    <path d="${arrow}" fill="none" stroke="var(--signal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${n(x(s.contact.point[0]))}" cy="${n(y(s.contact.point[1]))}" r="7" fill="var(--signal)" stroke="var(--ink)" stroke-width="1"/>
    <path d="M${n(x(s.contact.point[0]))} ${n(y(s.contact.point[1]) - 11)}V${n(y(s.contact.point[1]) - 28)}H${n(x(s.contact.point[0]) + 25)}" fill="none" stroke="var(--signal)"/>
    <text x="${n(x(s.contact.point[0]) + 30)}" y="${n(y(s.contact.point[1]) - 24)}" fill="var(--signal-text)" font-size="12">${escape(t(lang, 'chain.chart.contact'))}</text>
    <text x="60" y="441" fill="var(--text-2)" font-size="12" font-family="var(--font-mono)">${escape(t(lang, `stroke.${stroke}`))} · ${escape(t(lang, 'view.top'))}</text>
    <text x="540" y="441" text-anchor="end" fill="var(--text-2)" font-size="12">${escape(t(lang, 'lab.modelNote'))}</text>
  </svg>`;
}

export function renderAbstractIcon(index: number): string {
  const paths = [
    '<path d="M15 65C25 12 36 70 47 35S70 18 78 10"/><circle cx="15" cy="65" r="5"/><circle cx="78" cy="10" r="4"/>',
    '<path d="M10 42H76M66 32L76 42L66 52M25 20C50 3 77 24 61 54M60 42L61 54L73 53"/>',
    '<path d="M13 65L28 22M42 65L42 22M63 65L77 65"/><ellipse cx="18" cy="45" rx="5" ry="11" transform="rotate(20 18 45)"/><ellipse cx="56" cy="45" rx="5" ry="11" transform="rotate(-20 56 45)"/>',
  ];
  return `<svg viewBox="0 0 90 80" class="abstract-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[index]}</svg>`;
}
