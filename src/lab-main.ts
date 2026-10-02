import './styles/base.css';
import './render3d/stage.css';
import type { Stance, Stroke } from './model';
import type { ViewName } from './render3d/cameraRig';
import { createStage } from './render3d/stage';
import { initTheme, nextChoice, currentChoice, setThemeChoice } from './ui/theme';

initTheme();

const root = document.getElementById('lab-root')!;
root.innerHTML = `
  <div id="stage" style="position:relative;height:72vh;margin:24px;border:1px solid var(--line-strong)"></div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:0 24px 24px">
    <select id="stroke"><option value="forehand">正手</option><option value="backhand">反手</option></select>
    <select id="stance"><option value="neutral">中性</option><option value="semi" selected>半开放</option><option value="open">开放</option></select>
    <select id="view"><option value="axo">轴测</option><option value="front">正视</option><option value="side">侧视</option><option value="top">俯视</option><option value="free">自由</option></select>
    <input id="t" type="range" min="0" max="1220" value="550" style="flex:1;min-width:200px">
    <button id="theme" type="button">主题</button>
  </div>`;

const stage = createStage(document.getElementById('stage')!, { multiView: true });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stroke = $<HTMLSelectElement>('stroke');
const stance = $<HTMLSelectElement>('stance');
const view = $<HTMLSelectElement>('view');
const slider = $<HTMLInputElement>('t');

if (stage) {
  const sync = () => {
    stage.setMotion(stroke.value as Stroke, stance.value as Stance);
    stage.setTime(Number(slider.value) / 1000);
  };
  stroke.oninput = sync;
  stance.oninput = sync;
  slider.oninput = sync;
  view.oninput = () => stage.setView(view.value as ViewName | 'free');
  $<HTMLButtonElement>('theme').onclick = () => setThemeChoice(nextChoice(currentChoice()));
  sync();
  (window as unknown as { __stage: typeof stage }).__stage = stage;
}
