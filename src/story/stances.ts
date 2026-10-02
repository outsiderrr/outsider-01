import { type Lang, t } from '../i18n';
import { STANCES, type Stroke } from '../model';
import { renderStanceFigure } from '../site/figures';
import { stanceSnapshot } from './stanceModel';

/** 图 02 使用原生 range 保留方向键、Home/End 和读屏操作。 */
export function mountStances(root: HTMLElement, lang: Lang): { dispose(): void } {
  const slider = root.querySelector<HTMLInputElement>('[data-stance-slider]');
  const figure = root.querySelector<HTMLElement>('[data-stance-figure]');
  if (!slider || !figure) return { dispose() {} };
  const abort = new AbortController();
  let stroke: Stroke = root.querySelector<HTMLElement>('[data-stance-stroke][aria-pressed="true"]')?.dataset.stanceStroke === 'backhand' ? 'backhand' : 'forehand';

  function sync() {
    const snapshot = stanceSnapshot(stroke, Number(slider!.value));
    const nearest = STANCES[Math.round(snapshot.value * 2)]!;
    const name = t(lang, `stance.${nearest}`);
    const atExact = Math.abs(snapshot.value * 2 - Math.round(snapshot.value * 2)) < 0.001;
    const valueText = atExact ? name : lang === 'zh'
      ? `${t(lang, `stance.${snapshot.from}`)}到${t(lang, `stance.${snapshot.to}`)}，${Math.round(snapshot.mix * 100)}%`
      : `${t(lang, `stance.${snapshot.from}`)} to ${t(lang, `stance.${snapshot.to}`)}, ${Math.round(snapshot.mix * 100)}%`;
    slider!.setAttribute('aria-valuetext', valueText);
    figure!.innerHTML = renderStanceFigure(stroke, snapshot.value, lang);
    const readouts = { sep: snapshot.separation.toFixed(0), shift: snapshot.weightShift.toFixed(1), ahead: snapshot.contactAhead.toFixed(1) };
    for (const [key, value] of Object.entries(readouts)) {
      const element = root.querySelector<HTMLElement>(`[data-stance-readout="${key}"]`);
      if (element) element.textContent = value;
    }
    root.querySelectorAll<HTMLButtonElement>('[data-stance-stroke]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.stanceStroke === stroke));
    });
  }

  slider.addEventListener('input', sync, { signal: abort.signal });
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-stance-stroke]');
    if (!button || !root.contains(button)) return;
    const next = button.dataset.stanceStroke;
    if (next !== 'forehand' && next !== 'backhand') return;
    stroke = next;
    sync();
  }, { signal: abort.signal });
  sync();
  return { dispose: () => abort.abort() };
}
