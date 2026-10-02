import {
  PHASES, SETS, STANCES, STROKES, chainCurves, getSet, peakTime, poseAt, racketSpeed, shoulderHipSeparation, solvePose,
  type Stance, type Stroke,
} from '../model';
import type { Vec3 } from '../model/vec';
import type { Camera2D } from '../render2d/project';
import { renderFigure } from '../render2d/stickFigure';

const THUMB: Camera2D = { phi: 30, elev: 12, scale: 0.8, cx: 112, groundY: 228 };
const BIG: Camera2D = { phi: 30, elev: 12, scale: 1.4, cx: 300, groundY: 360 };
const LABELS = { net: '球网', separation: '肩髋差' };
const NAME: Record<string, string> = { forehand: '正手', backhand: '反手', neutral: '中性', semi: '半开放', open: '开放' };

function swingPath(stroke: Stroke, stance: Stance): Vec3[] {
  const set = getSet(stroke, stance);
  const pts: Vec3[] = [];
  const t0 = set.times[1];
  const t1 = set.times[set.times.length - 1];
  for (let i = 0; i <= 160; i++) pts.push(solvePose(poseAt(set, t0 + ((t1 - t0) * i) / 160)).racket.center);
  return pts;
}

const grid = document.getElementById('grid')!;
for (const stroke of STROKES) {
  for (const stance of STANCES) {
    const set = SETS[stroke][stance];
    const path = swingPath(stroke, stance);
    const c = chainCurves(set, 300);
    const peaks = [c.pelvis, c.torso, c.arm, c.head].map((v) => peakTime(c.t, v).toFixed(3)).join(' / ');
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      `<div class="meta"><b>${NAME[stroke]} · ${NAME[stance]}</b><br>击球拍速 ${racketSpeed(set, set.times[set.contactIndex]).toFixed(1)} m/s` +
      `<br>引拍肩髋差 ${Math.abs(shoulderHipSeparation(poseAt(set, set.times[1]))).toFixed(0)}°<br>峰值 ${peaks}</div>` +
      PHASES.map((_, i) => {
        const p = poseAt(set, set.times[i]);
        return `<svg viewBox="0 0 220 240">${renderFigure(p, solvePose(p), THUMB, { path, inset: { cx: 188, cy: 40, r: 22 }, labels: LABELS, bothArms: stroke === 'backhand' })}</svg>`;
      }).join('');
    grid.appendChild(row);
  }
}

const big = document.getElementById('big')!;
const strokeSel = document.getElementById('stroke') as HTMLSelectElement;
const stanceSel = document.getElementById('stance') as HTMLSelectElement;
const slider = document.getElementById('t') as HTMLInputElement;
const info = document.getElementById('info')!;
const playBtn = document.getElementById('play') as HTMLButtonElement;
let playing = false;
let last = 0;

function draw() {
  const stroke = strokeSel.value as Stroke;
  const stance = stanceSel.value as Stance;
  const set = getSet(stroke, stance);
  const t = Number(slider.value) / 1000;
  const p = poseAt(set, t);
  const j = solvePose(p);
  const trail: Vec3[] = [];
  for (let q = Math.max(0, t - 0.3); q <= t; q += 0.01) trail.push(solvePose(poseAt(set, q)).racket.center);
  big.innerHTML = renderFigure(p, j, BIG, {
    path: swingPath(stroke, stance), trail, inset: { cx: 590, cy: 70, r: 40, big: true }, labels: LABELS, bothArms: stroke === 'backhand',
  });
  info.textContent =
    `t = ${t.toFixed(3)} s\n拍速 ${racketSpeed(set, t).toFixed(1)} m/s\n肩髋差 ${Math.abs(shoulderHipSeparation(p)).toFixed(0)}°\n` +
    `重心 左 ${(p.w * 100).toFixed(0)}%\n腿伸展 L ${j.reach.legL.toFixed(3)} R ${j.reach.legR.toFixed(3)}\n` +
    `臂伸展 L ${j.reach.armL.toFixed(3)} R ${j.reach.armR.toFixed(3)}\n握拍误差 ${j.gripError.toFixed(2)} cm`;
}

function tick(ts: number) {
  if (!playing) return;
  const dt = Math.min(50, ts - last) / 5;
  last = ts;
  slider.value = String((Number(slider.value) + dt) % 1221);
  draw();
  requestAnimationFrame(tick);
}

playBtn.onclick = () => {
  playing = !playing;
  last = performance.now();
  if (playing) requestAnimationFrame(tick);
};
for (const el of [strokeSel, stanceSel, slider]) el.oninput = draw;
draw();
