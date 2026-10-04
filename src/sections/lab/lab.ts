import { type Lang, t as tr } from '../../i18n';
import {
  PHASES, STANCES, STROKES, TIMES, getSet, poseAt, racketSpeed, shoulderHipSeparation, solvePose, type Stance, type Stroke,
} from '../../model';
import type { Vec3 } from '../../model/vec';
import type { ViewName } from '../../render3d/cameraRig';
import type { MiniRect, Stage } from '../../render3d/stage';
import type { Camera2D } from '../../render2d/project';
import { renderFigure } from '../../render2d/stickFigure';
import '../../render3d/stage.css';
import './lab.css';

type View = ViewName | 'free';
const VIEWS: readonly View[] = ['axo', 'front', 'side', 'top', 'free'];
const TEND = TIMES[TIMES.length - 1];
const SLOW = 5;
const CAM2D: Camera2D = { phi: 30, elev: 12, scale: 1.45, cx: 300, groundY: 372 };

const ICON_PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M9.5 2 4 7l5.5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4.5 2 10 7l-5.5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

export interface LabOptions {
  figNo?: string;
  force2d?: boolean;
}

export interface LabHandle {
  dispose(): void;
}

const pct = (t: number) => `${((t / TEND) * 100).toFixed(3)}%`;

export function mountLab(root: HTMLElement, lang: Lang, opts: LabOptions = {}): LabHandle {
  const T = (k: string) => tr(lang, k);
  let stroke: Stroke = 'forehand';
  let stance: Stance = 'semi';
  let view: View = 'axo';
  let time = TIMES[1];
  let playing = false;
  let slow = true;
  let phase = -1;
  let disposed = false;
  const abort = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowScreen = matchMedia('(max-width: 960px)');
  let minisExpanded = false;

  const segButtons = (group: string, items: readonly string[], label: (v: string) => string) =>
    items.map((v) => `<button type="button" data-${group}="${v}" aria-pressed="false">${label(v)}</button>`).join('');

  root.classList.add('lab');
  root.innerHTML = `
    <header class="lab__head">
      <p class="lab__fig">${opts.figNo ?? 'FIG. 05'}</p>
      <h2 class="lab__title" id="lab-title">${T('lab.title')}<span class="lab__title-en" lang="en">LAB</span></h2>
      <p class="lab__sub">${T('lab.subtitle')}</p>
    </header>
    <div class="lab__body">
      <div class="lab__stage">
        <div class="lab__hud">
          <p class="lab__phase"><span class="lab__phase-no"></span><span class="lab__phase-name"></span></p>
          <p class="lab__cue"></p>
        </div>
        <div class="lab__minis"></div>
        <p class="lab__hint" hidden></p>
        <p class="sr-only" aria-live="polite"></p>
      </div>
      <aside class="lab__panel">
        <div class="lab__group" role="group" aria-labelledby="lab-g-stroke">
          <span class="label" id="lab-g-stroke">${T('lab.stroke')}</span>
          <div class="seg">${segButtons('stroke', STROKES, (v) => T(`stroke.${v}`))}</div>
        </div>
        <div class="lab__group" role="group" aria-labelledby="lab-g-stance">
          <span class="label" id="lab-g-stance">${T('lab.stance')}</span>
          <div class="seg">${segButtons('stance', STANCES, (v) => T(`stance.${v}`))}</div>
        </div>
        <div class="lab__group" role="group" aria-labelledby="lab-g-view">
          <span class="label" id="lab-g-view">${T('lab.view')}</span>
          <div class="seg">${segButtons('view', VIEWS, (v) => T(`view.${v}`))}</div>
        </div>
        <button type="button" class="btn lab__multi-toggle" aria-expanded="false" hidden>${lang === 'zh' ? '展开三视图' : 'Show three views'}</button>
        <dl class="lab__readouts">
          <div class="ro"><dt>${T('lab.speed')}</dt><dd><span class="ro__num" data-ro="speed">0.0</span><span class="ro__unit">m/s</span></dd></div>
          <div class="ro"><dt>${T('lab.separation')}</dt><dd><span class="ro__num" data-ro="sep">0</span><span class="ro__unit">°</span></dd></div>
          <div class="ro ro--weight"><dt>${T('lab.weight')}</dt><dd><span data-ro="wl"></span><span class="wbar" aria-hidden="true"><i></i></span><span data-ro="wr"></span></dd></div>
        </dl>
        <p class="lab__note label">${T('lab.modelNote')}</p>
      </aside>
    </div>
    <div class="lab__transport">
      <button type="button" class="btn btn--primary lab__play" aria-pressed="false"></button>
      <div class="seg" role="group" aria-label="${T('lab.speedLabel')}">
        <button type="button" data-speed="slow" aria-pressed="true">${T('lab.slow')}</button>
        <button type="button" data-speed="real" aria-pressed="false">${T('lab.real')}</button>
      </div>
      <div class="lab__steps">
        <button type="button" class="btn btn--icon" data-step="-1" aria-label="${T('lab.prev')}">${ICON_PREV}</button>
        <button type="button" class="btn btn--icon" data-step="1" aria-label="${T('lab.next')}">${ICON_NEXT}</button>
      </div>
      <div class="timeline">
        <div class="timeline__ruler"></div>
        <div class="timeline__keys"></div>
        <div class="timeline__ticks"></div>
        <div class="timeline__head"></div>
        <input class="timeline__input" type="range" min="0" max="${Math.round(TEND * 1000)}" step="1" aria-label="${T('lab.timeline')}" />
      </div>
    </div>
    <div class="lab__diagram-key" hidden>
      <ul aria-label="${lang === 'zh' ? '示意图图例' : 'Diagram key'}">
        <li><span class="lab__key-mark lab__key-mark--shoulder" aria-hidden="true"></span>${lang === 'zh' ? '肩轴投影' : 'Shoulder projection'}</li>
        <li><span class="lab__key-mark lab__key-mark--hip" aria-hidden="true"></span>${lang === 'zh' ? '髋轴投影' : 'Hip projection'}</li>
        <li><span class="lab__key-mark lab__key-mark--arc" aria-hidden="true"></span>${lang === 'zh' ? '夹角弧线' : 'Angle arc'}</li>
        <li><span class="lab__key-mark lab__key-mark--weight" aria-hidden="true"></span>${lang === 'zh' ? '承重示意点' : 'Load marker'}</li>
        <li><span class="lab__key-mark lab__key-mark--trail" aria-hidden="true"></span>${lang === 'zh' ? '拍头轨迹带' : 'Racket sweep'}</li>
      </ul>
      <p>${lang === 'zh' ? '肩轴与髋轴投影在地面，俯视采用叠加显示。肩髋差取模型的水平转角差。' : 'The shoulder and hip axes are ground projections, shown as overlays in Top view. Separation reports the model’s difference in horizontal rotation.'}</p>
    </div>
    <p class="lab__keys label">${T('lab.keys')}</p>`;

  const q = <E extends Element>(sel: string) => root.querySelector(sel) as E;
  const stageEl = q<HTMLDivElement>('.lab__stage');
  const minisEl = q<HTMLDivElement>('.lab__minis');
  const hintEl = q<HTMLParagraphElement>('.lab__hint');
  const liveEl = q<HTMLParagraphElement>('[aria-live]');
  const playBtn = q<HTMLButtonElement>('.lab__play');
  const input = q<HTMLInputElement>('.timeline__input');
  const head = q<HTMLDivElement>('.timeline__head');
  const multiToggle = q<HTMLButtonElement>('.lab__multi-toggle');
  const diagramKey = q<HTMLDivElement>('.lab__diagram-key');
  stageEl.setAttribute('role', 'group');
  stageEl.setAttribute('aria-label', T('lab.stageLabel'));
  stageEl.tabIndex = 0;

  // 时间轴刻度
  const ticks = q<HTMLDivElement>('.timeline__ticks');
  for (let s = 0; s <= TEND + 1e-6; s += 0.2) ticks.insertAdjacentHTML('beforeend', `<span class="timeline__tick" style="left:${pct(s)}">${s.toFixed(1)}s</span>`);
  const keysEl = q<HTMLDivElement>('.timeline__keys');

  const placeMinis = (rects: MiniRect[]) => {
    const names = { front: T('lab.multiFront'), side: T('lab.multiSide'), top: T('lab.multiTop') };
    const en = { front: 'FRONT', side: 'SIDE', top: 'TOP' };
    minisEl.innerHTML = rects
      .map((r) => `<div class="mini" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"><span class="mini__label">${names[r.name]}${lang === 'zh' ? ` <span lang="en">${en[r.name]}</span>` : ''}</span></div>`)
      .join('');
  };

  let stage: Stage | null = null;
  let pendingStage: Stage | null = null;
  let svg: SVGSVGElement | null = null;
  // 先显示可操作的线稿。强制 2D 时完全不下载 Three.js，而不是下载后再降级。
  function show2d(finalFallback: boolean) {
    if (svg) {
      if (!finalFallback || root.querySelector('.lab__notice')) return;
    } else {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 654 400');
    svg.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(svg);
    }
    if (finalFallback) {
      diagramKey.hidden = true;
      stageEl.insertAdjacentHTML('beforeend', `<p class="lab__notice">${T('lab.fallback')}</p>`);
      root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => (b.disabled = b.dataset.view !== 'axo'));
    }
  }
  show2d(Boolean(opts.force2d));

  const setPressed = (attr: string, value: string) =>
    root.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));

  function renderKeys() {
    keysEl.innerHTML = PHASES.map((ph, i) => {
      const cls = ['timeline__key', i === 3 ? 'is-contact' : '', i === PHASES.length - 1 ? 'is-last' : ''].join(' ');
      return `<div class="${cls}" style="left:${pct(TIMES[i])}"><span><b class="k-name">${T(`phase.${stroke}.${stance}.${ph}.name`)}</b><b class="k-no">0${i + 1}</b></span></div>`;
    }).join('');
  }

  const paths = new Map<string, Vec3[]>();
  function draw2d() {
    if (!svg) return;
    const set = getSet(stroke, stance);
    const p = poseAt(set, time);
    const key = `${stroke}-${stance}`;
    let path = paths.get(key);
    if (!path) {
      path = [];
      for (let i = 0; i <= 160; i++) path.push(solvePose(poseAt(set, TIMES[1] + ((TEND - TIMES[1]) * i) / 160)).racket.center);
      paths.set(key, path);
    }
    const trail: Vec3[] = [];
    for (let s = Math.max(0, time - 0.26); s <= time; s += 0.01) trail.push(solvePose(poseAt(set, s)).racket.center);
    svg.innerHTML = renderFigure(p, solvePose(p), CAM2D, {
      path,
      trail,
      inset: { cx: 590, cy: 66, r: 40, big: true },
      labels: { net: T('lab.net'), separation: T('lab.separation') },
      bothArms: stroke === 'backhand',
    });
  }

  function nearestPhase(t: number): number {
    let best = 0;
    for (let i = 1; i < TIMES.length; i++) if (Math.abs(t - TIMES[i]) < Math.abs(t - TIMES[best])) best = i;
    return best;
  }

  function sync() {
    const set = getSet(stroke, stance);
    stage?.setPlaying(playing, playing && time < TEND);
    stage?.setTime(time);
    draw2d();
    const pose = poseAt(set, time);
    const speed = racketSpeed(set, time);
    q<HTMLSpanElement>('[data-ro="speed"]').textContent = speed.toFixed(1);
    q<HTMLSpanElement>('[data-ro="sep"]').textContent = String(Math.round(Math.abs(shoulderHipSeparation(pose))));
    const wl = Math.round(pose.w * 100);
    q<HTMLSpanElement>('[data-ro="wl"]').textContent = `${T('lab.left')} ${wl}%`;
    q<HTMLSpanElement>('[data-ro="wr"]').textContent = `${T('lab.right')} ${100 - wl}%`;
    q<HTMLElement>('.wbar > i').style.left = `${100 - wl}%`;
    head.style.left = pct(time);
    input.value = String(Math.round(time * 1000));
    const ph = nearestPhase(time);
    input.setAttribute('aria-valuetext', `${time.toFixed(2)} ${lang === 'zh' ? '秒' : 'seconds'} · ${T(`phase.${stroke}.${stance}.${PHASES[ph]}.name`)}`);
    if (ph !== phase) {
      phase = ph;
      const id = PHASES[ph];
      const name = T(`phase.${stroke}.${stance}.${id}.name`);
      q<HTMLSpanElement>('.lab__phase-no').textContent = `0${ph + 1}`;
      q<HTMLSpanElement>('.lab__phase-name').textContent = name;
      q<HTMLParagraphElement>('.lab__cue').textContent = T(`phase.${stroke}.${stance}.${id}.cue`);
      liveEl.textContent = name;
    }
  }

  function setMotion(s: Stroke, st: Stance) {
    stroke = s;
    stance = st;
    setPressed('stroke', s);
    setPressed('stance', st);
    stage?.setMotion(s, st);
    renderKeys();
    phase = -1;
    sync();
  }

  function setView(v: View) {
    if (!stage && v !== 'axo') return;
    view = v;
    setPressed('view', v);
    stage?.setView(v);
    hintEl.hidden = v !== 'free';
    hintEl.textContent = lang === 'zh' ? '拖动旋转 · 滚轮或双指缩放' : 'Drag to rotate · scroll or pinch to zoom';
  }

  // 播放
  let raf = 0;
  let last = 0;
  let clock = 0;
  const HOLD = 0.6;
  function tick(now: number) {
    if (!playing || disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt / (slow ? SLOW : 1);
    if (clock > TEND + HOLD / (slow ? SLOW : 1)) clock = 0;
    time = Math.min(clock, TEND);
    sync();
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on: boolean) {
    on = on && visible && !document.hidden && !disposed;
    if (on && playing) return;
    cancelAnimationFrame(raf);
    playing = on;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.innerHTML = `${on ? ICON_PAUSE : ICON_PLAY}<span>${T(on ? 'lab.pause' : 'lab.play')}</span>`;
    stage?.setPlaying(on, on && time < TEND);
    if (on) {
      clock = time >= TEND - 1e-3 ? 0 : time;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else cancelAnimationFrame(raf);
  }

  function step(dir: number) {
    setPlaying(false);
    const eps = 1e-3;
    if (dir > 0) time = TIMES.find((k) => k > time + eps) ?? TIMES[0];
    else time = [...TIMES].reverse().find((k) => k < time - eps) ?? TIMES[TIMES.length - 1];
    sync();
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.stroke) setMotion(b.dataset.stroke as Stroke, stance);
    else if (b.dataset.stance) setMotion(stroke, b.dataset.stance as Stance);
    else if (b.dataset.view) setView(b.dataset.view as View);
    else if (b.dataset.speed) {
      slow = b.dataset.speed === 'slow';
      setPressed('speed', b.dataset.speed);
    } else if (b.dataset.step) step(Number(b.dataset.step));
    else if (b === playBtn) setPlaying(!playing);
    else if (b === multiToggle) {
      minisExpanded = !minisExpanded;
      syncMultiView();
    }
  }, { signal: abort.signal });
  input.addEventListener('input', () => {
    setPlaying(false);
    time = Number(input.value) / 1000;
    sync();
  }, { signal: abort.signal });

  // 只观察画面本身：长章节在手机上永远未必能达到 35% 的可见比例。
  const bounds = stageEl.getBoundingClientRect();
  let visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  const syncVisibility = () => {
    const active = visible && !document.hidden;
    stage?.setActive(active);
    if (!active) setPlaying(false);
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
    syncVisibility();
  }, { threshold: [0, 0.01] });
  io.observe(stageEl);
  document.addEventListener('visibilitychange', syncVisibility, { signal: abort.signal });
  // 用户切换系统设置时立即停止播放；不因为再次关闭减少动态效果而自动恢复。
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) setPlaying(false);
  }, { signal: abort.signal });
  const onKey = (e: KeyboardEvent) => {
    if (!visible || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const tgt = e.target as HTMLElement;
    // 页面其它控件，以及实验室的原生按钮/滑块，保留各自的键盘语义。
    if (!root.contains(tgt) || tgt.closest('button, a, input, select, textarea, summary, [contenteditable="true"], [role="slider"]')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      setPlaying(!playing);
    } else if ((k === 'arrowleft' || k === 'arrowright') && tgt !== input) {
      e.preventDefault();
      step(k === 'arrowright' ? 1 : -1);
    } else if (k === '1' || k === '2' || k === '3') setMotion(stroke, STANCES[Number(k) - 1]);
    else if (k === 'f') setMotion('forehand', stance);
    else if (k === 'b') setMotion('backhand', stance);
    else if (k === 'v') setView(VIEWS[(VIEWS.indexOf(view) + 1) % (stage ? VIEWS.length : 1)]);
  };
  root.addEventListener('keydown', onKey, { signal: abort.signal });

  function syncMultiView() {
    const show = !narrowScreen.matches || minisExpanded;
    stage?.setMultiView(show);
    multiToggle.hidden = !stage || !narrowScreen.matches;
    multiToggle.setAttribute('aria-expanded', String(minisExpanded));
    multiToggle.textContent = lang === 'zh'
      ? (minisExpanded ? '收起三视图' : '展开三视图')
      : (minisExpanded ? 'Hide three views' : 'Show three views');
    root.classList.toggle('lab--minis-expanded', narrowScreen.matches && minisExpanded);
  }
  narrowScreen.addEventListener('change', syncMultiView, { signal: abort.signal });

  setPressed('speed', 'slow');
  setView('axo');
  setPlaying(false);
  setMotion(stroke, stance);

  if (!opts.force2d) {
    void import('../../render3d/stage').then(async ({ createStage }) => {
      if (disposed) return;
      pendingStage = createStage(stageEl, {
        multiView: !narrowScreen.matches || minisExpanded,
        onLayout: placeMinis,
        label: (key, value) => key === 'speed' ? `${value.toFixed(1)} m/s` : `${lang === 'en' ? 'Separation' : T('lab.separation')} ${Math.round(value)}°`,
      });
      if (!pendingStage) { show2d(true); return; }
      pendingStage.setActive(false);
      await pendingStage.ready;
      if (disposed) { pendingStage.dispose(); pendingStage = null; return; }
      stage = pendingStage;
      pendingStage = null;
      diagramKey.hidden = false;
      svg?.remove();
      svg = null;
      stage.setActive(visible && !document.hidden);
      stage.setMotion(stroke, stance);
      stage.setTime(time);
      stage.setView(view);
      stage.setPlaying(playing, playing && time < TEND);
      syncMultiView();
    }).catch(() => {
      pendingStage?.dispose();
      pendingStage = null;
      stage?.dispose();
      stage = null;
      if (!disposed) show2d(true);
    });
  }

  return {
    dispose() {
      disposed = true;
      setPlaying(false);
      abort.abort();
      io.disconnect();
      stage?.dispose();
      pendingStage?.dispose();
      root.innerHTML = '';
    },
  };
}
