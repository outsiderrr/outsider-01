import { t, type Lang } from '../i18n';
import { chainCurves, getSet, peakTime, PHASES, poseAt, racketSpeed, shoulderHipSeparation, STANCES, STROKES, type PhaseId, type Stance, type Stroke } from '../model';
import { stanceSnapshot } from '../story/stanceModel';
import { renderAbstractIcon, renderChainChart, renderPhaseFigure, renderStanceFigure } from './figures';

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const SITE_URL = 'https://outsiderrr.github.io/outsider-01/';
const NAV = [ ['abstract', 'abstract'], ['fig-01', 'chain'], ['fig-02', 'stances'], ['fig-03', 'forehand'], ['fig-04', 'backhand'], ['lab', 'lab'], ['conclusion', 'conclusion'], ['notes', 'notes'] ] as const;

export function modelNumbers(stroke: Stroke, stance: Stance): Record<string, string> {
  const set = getSet(stroke, stance);
  const backswing = poseAt(set, set.times[1]);
  const curves = chainCurves(set);
  const headPeak = peakTime(curves.t, curves.head);
  return {
    tor: Math.abs(backswing.tor[0]).toFixed(0), pel: Math.abs(backswing.pel[3]).toFixed(0),
    sep: Math.abs(shoulderHipSeparation(backswing)).toFixed(0),
    pelvis: peakTime(curves.t, curves.pelvis).toFixed(3), torso: peakTime(curves.t, curves.torso).toFixed(3),
    arm: peakTime(curves.t, curves.arm).toFixed(3), speed: racketSpeed(set, headPeak).toFixed(1),
  };
}

const insertNumbers = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`未替换的模型占位符：${key}`);
    return values[key];
  });

function heading(lang: Lang, number: string, title: string, lead = ''): string {
  return `<div class="section-heading"><p class="eyebrow">${escape(number)}</p><h2 class="section-title">${escape(title)}</h2>${lead ? `<p class="section-lead">${escape(lead)}</p>` : ''}<span class="section-rule" aria-hidden="true"></span><span class="model-note label">${escape(t(lang, 'lab.modelNote'))}</span></div>`;
}

function stageSlot(lang: Lang, slot: string, stroke: Stroke = 'forehand', phase: PhaseId = 'contact'): string {
  return `<div class="stage-slot" data-story-slot="${slot}"><div class="static-stage">${renderPhaseFigure(stroke, 'semi', phase, lang)}</div></div>`;
}

function phaseSection(lang: Lang, stroke: Stroke): string {
  const T = (key: string) => t(lang, key);
  const number = stroke === 'forehand' ? '03' : '04';
  const views = ['axo', 'top', 'side', 'front', 'back'];
  const values = Object.fromEntries(STANCES.map((stance) => [stance, modelNumbers(stroke, stance)]));
  const cards = PHASES.map((phase, index) => `<article class="story-step phase-step${index === 0 ? ' is-active' : ''}" data-step="${index}" data-phase="${phase}">
    <p class="phase-number label">${String(index + 1).padStart(2, '0')} / 05 <span>${getSet(stroke, 'semi').times[index].toFixed(2)} s</span></p>
    ${STANCES.map((stance) => {
      const phaseKey = `phase.${stroke}.${stance}.${phase}`;
      const detailKey = `phases.detail.${stroke}.${stance}.${phase}`;
      const pose = poseAt(getSet(stroke, stance), getSet(stroke, stance).times[index]);
      const parts = ['legs', 'hips', 'trunk', stroke === 'backhand' ? 'arms' : 'arm', 'racket'];
      const driving = parts.map((key, group) => ({ group, label: T(`phases.parts.${key}`) })).filter(({ group }) => pose.a[group] > .3);
      return `<div data-stance-content="${stance}" class="stance-content${stance === 'semi' ? ' is-active' : ''}">
        <p class="phase-stance label">${escape(T(`stance.${stance}`))}</p>
        <h3>${escape(T(`${phaseKey}.name`))}</h3><p class="phase-cue">${escape(T(`${phaseKey}.cue`))}</p>
        <p class="phase-analogy">${escape(T(`${detailKey}.image`))}</p>
        <p class="phase-detail">${escape(insertNumbers(T(`${detailKey}.detail`), values[stance]))}</p>
        <div class="power-tags">${driving.length ? driving.map(({ group, label }) => `<span class="tag tag--power" data-emphasis="${group}" tabindex="0">${escape(T('phases.power'))} · ${escape(label)}</span>`).join('') : `<span class="tag">${escape(T('phases.relaxed'))}</span>`}${pose.br > .3 ? [2, 3].map((group) => `<span class="tag tag--brake" data-emphasis="${group}" tabindex="0">${escape(T('phases.brake'))} · ${escape(T(`phases.parts.${parts[group]}`))}</span>`).join('') : ''}</div>
        <figure class="phase-static" data-phase-figure="${stroke}-${stance}-${phase}">${renderPhaseFigure(stroke, stance, phase, lang)}<figcaption>${escape(T('phases.viewLabel'))} · ${escape(T(`view.${views[index]}`))}</figcaption></figure>
      </div>`;
    }).join('')}
  </article>`).join('');
  return `<section class="site-section phase-section" id="fig-${number}" data-stroke="${stroke}" aria-labelledby="heading-${stroke}"><div class="section-inner">
    ${heading(lang, T(`phases.${stroke}.fig`), T(`phases.${stroke}.title`), T(`phases.${stroke}.lead`)).replace('class="section-title"', `class="section-title" id="heading-${stroke}"`)}
    <div class="story-layout"><div class="story-steps">${cards}</div><div class="story-visual">
      <div class="phase-toolbar"><span class="label">${escape(T('phases.stanceLabel'))}</span><div class="seg" role="group" aria-label="${escape(T('phases.stanceLabel'))}">${STANCES.map((stance) => `<button type="button" data-story-stance="${stance}" aria-pressed="${stance === 'semi'}">${escape(T(`stance.${stance}`))}</button>`).join('')}</div></div>
      <div class="stage-caption label"><span>${number} / 05</span><output data-current-phase aria-live="polite">${escape(T(`phase.${stroke}.semi.ready.name`))}</output></div>
      ${stageSlot(lang, stroke, stroke, 'ready')}
      <div class="phase-controls seg" data-phase-controls role="group" aria-label="${escape(T('lab.timeline'))}">${PHASES.map((phase, i) => `<button type="button" data-phase-step="${i}" aria-pressed="${i === 0}" aria-label="${escape(T(`phase.${stroke}.semi.${phase}.name`))}">${String(i + 1).padStart(2, '0')}</button>`).join('')}</div>
      <p class="stage-footnote label">${escape(T('lab.modelNote'))} · ${escape(T('stroke.' + stroke))}</p>
    </div></div>
  </div></section>`;
}

/** 页面正文在构建时写入，交互脚本只做渐进增强。 */
export function renderPage(lang: Lang): string {
  const T = (key: string) => t(lang, key);
  const other = lang === 'zh' ? 'en/' : '../';
  const numbers = modelNumbers('forehand', 'semi');
  const chainKeys = ['legs', 'hips', 'trunk', 'arm', 'head'];
  const chartKeys = ['pelvis', 'torso', 'arm', 'head'];
  const snapshot = stanceSnapshot('forehand', .5);
  const chart = chainCurves(getSet('forehand', 'semi'));
  const sourcePending = lang === 'zh' ? '源代码将在发布后公开' : 'Source code will be shared at launch';
  const bookPending = lang === 'zh' ? '中文版出版社、译者及出版年份待版权页核对，发布前补全。' : 'Chinese-edition publisher, translator and year will be verified against the copyright page before publication.';
  const geometryNote = lang === 'zh' ? '重心位置按模型双脚承重比例估算；前方指朝球网方向。' : 'Weight position is estimated from the model’s foot-loading ratio; “ahead” means toward the net.';
  return `<a class="skip-link" href="#main">${escape(T('site.skip'))}</a>
  <header class="site-header"><div class="header-inner">
    <a class="site-brand" href="#cover" aria-label="${escape(T('site.title'))}"><span class="brand-mark" aria-hidden="true">↗</span><span>${escape(T('site.project'))}</span></a>
    <button class="btn menu-toggle" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false">${escape(T('site.navLabel'))}<span aria-hidden="true">＋</span></button>
    <nav id="site-nav" class="site-nav" aria-label="${escape(T('site.navLabel'))}">${NAV.map(([id, key]) => `<a href="#${id}" data-nav-link="${id}">${escape(T(`site.nav.${key}`))}</a>`).join('')}</nav>
    <div class="header-tools"><a class="lang-switch" href="${other}" data-lang-link lang="${lang === 'zh' ? 'en' : 'zh-CN'}" hreflang="${lang === 'zh' ? 'en' : 'zh-CN'}" aria-label="${escape(T('site.lang.otherName'))}">${escape(T('site.lang.other'))}</a><button class="btn btn--icon theme-toggle" type="button" data-theme-toggle aria-label="${escape(T('site.theme.label'))} · ${escape(T('site.theme.system'))}"><span aria-hidden="true">◐</span></button></div>
  </div></header>
  <main id="main">
    <section id="cover" class="site-section cover" aria-labelledby="cover-title"><div class="section-inner cover-inner">
      <div class="cover-copy"><p class="eyebrow">${escape(T('cover.kicker'))}</p><h1 class="cover-title" id="cover-title">${lang === 'zh' ? '<span>网球挥拍</span><span>实验报告<span class="title-dot">。</span></span>' : '<span>A Tennis Swing</span><span>Lab Report<span class="title-dot">.</span></span>'}</h1>
        <p class="cover-subtitle">${escape(T('cover.subtitle'))}</p><p class="cover-lead">${escape(T('cover.lead'))}</p>
        <dl class="cover-meta">${['subject', 'duration', 'frames'].map((key) => `<div><dt>${escape(T(`cover.meta.${key}`))}</dt><dd>${escape(T(`cover.meta.${key}Value`))}</dd></div>`).join('')}</dl>
        <a class="cover-scroll" href="#abstract"><span aria-hidden="true">↓</span>${escape(T('cover.scroll'))}<span class="label" aria-hidden="true">01—09</span></a>
      </div><div class="cover-stage"><div class="stage-caption label"><span>00 / 05</span><span>${escape(T('stroke.forehand'))} · ${escape(T('stance.semi'))}</span></div>
        ${stageSlot(lang, 'cover')}
        <div class="cover-stage-footer"><span class="model-note label">${escape(T('lab.modelNote'))}</span><button class="btn cover-play" type="button" aria-pressed="true">${lang === 'zh' ? '暂停演示' : 'Pause demo'}</button></div>
      </div>
    </div></section>
    <section id="abstract" class="site-section abstract-section"><div class="section-inner">
      ${heading(lang, T('abstract.fig'), T('abstract.title'))}<div class="abstract-grid">${[1, 2, 3].map((n) => `<article class="abstract-card"><span class="abstract-no label">0${n}</span>${renderAbstractIcon(n - 1)}<h3>${escape(T(`abstract.p${n}.title`))}</h3><p>${escape(T(`abstract.p${n}.body`))}</p></article>`).join('')}</div>
    </div></section>
    <section id="fig-01" class="site-section chain-section"><div class="section-inner">
      ${heading(lang, T('chain.fig'), T('chain.title'), T('chain.lead'))}
      <div class="story-layout"><div class="story-steps">${chainKeys.map((key, i) => `<article class="story-step${i === 0 ? ' is-active' : ''}" data-step="${i}"><p class="step-index label">0${i + 1} / 05</p><h3>${escape(T(`chain.steps.${key}.name`))}</h3><p>${escape(insertNumbers(T(`chain.steps.${key}.body`), numbers))}</p></article>`).join('')}</div>
        <div class="story-visual"><div class="stage-caption label"><span>01 / 05</span><output data-current-phase aria-live="polite">${escape(T('chain.steps.legs.name'))}</output></div>${stageSlot(lang, 'chain', 'forehand', 'drive')}
          <figure class="chain-figure"><figcaption class="label">${escape(T('chain.chart.title'))}</figcaption>${renderChainChart(lang)}<div class="curve-legend">${chartKeys.map((key) => `<span data-curve-label="${key}"><i aria-hidden="true"></i>${escape(T(`chain.chart.${key}`))}<strong>${peakTime(chart.t, chart[key as keyof Omit<typeof chart, 't'>]).toFixed(3)} s</strong></span>`).join('')}</div><p class="figure-note">${escape(T('chain.chart.note'))}</p></figure>
        </div>
      </div>
    </div></section>
    <section id="fig-02" class="site-section stance-section"><div class="section-inner">
      ${heading(lang, T('stances.fig'), T('stances.title'), T('stances.lead'))}
      <div class="momentum-grid">${['linear', 'angular'].map((key, i) => `<article><span class="label">0${i + 1}</span><h3>${escape(T(`stances.${key}.name`))}</h3><p>${escape(T(`stances.${key}.body`))}</p></article>`).join('')}</div>
      <div class="stance-layout"><figure class="stance-diagram"><div data-stance-figure>${renderStanceFigure('forehand', .5, lang)}</div><figcaption class="stance-legend">${['start', 'end', 'arrow', 'contact'].map((key) => `<span class="legend-${key}">${escape(T(`stances.legend.${key}`))}</span>`).join('')}</figcaption></figure>
        <div class="stance-controls"><div class="seg" role="group" aria-label="${escape(T('lab.stroke'))}">${STROKES.map((stroke) => `<button type="button" data-stance-stroke="${stroke}" aria-pressed="${stroke === 'forehand'}">${escape(T(`stroke.${stroke}`))}</button>`).join('')}</div>
          <label class="label" for="stance-range">${escape(T('stances.slider'))}</label><input id="stance-range" data-stance-slider type="range" min="0" max="1" step="0.01" value="0.5" aria-valuetext="${escape(T('stance.semi'))}"/>
          <div class="stance-range-labels">${STANCES.map((stance) => `<span>${escape(T(`stance.${stance}`))}</span>`).join('')}</div>
          <dl class="stance-readouts"><div><dt>${escape(T('stances.sep'))}</dt><dd><span data-stance-readout="sep">${snapshot.separation.toFixed(0)}</span><small>°</small></dd></div><div><dt>${escape(T('stances.shift'))}</dt><dd><span data-stance-readout="shift">${snapshot.weightShift.toFixed(1)}</span><small> cm</small></dd></div><div><dt>${escape(T('stances.ahead'))}</dt><dd><span data-stance-readout="ahead">${snapshot.contactAhead.toFixed(1)}</span><small> cm</small></dd></div></dl>
          <p class="figure-note">${escape(T('stances.note'))} ${escape(geometryNote)}</p>
        </div>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="${escape(T('stroke.forehand'))} · ${escape(T('stances.title'))}"><table class="data-table"><caption>${escape(T('stroke.forehand'))} · ${escape(T('stances.note'))}</caption><thead><tr>${['stance', 'main', 'image', 'sep', 'shift', 'ahead'].map((key) => `<th scope="col">${escape(T(`stances.table.${key}`))}</th>`).join('')}</tr></thead><tbody>${STANCES.map((stance, i) => {
        const s = stanceSnapshot('forehand', i / 2);
        return `<tr><th scope="row">${escape(T(`stance.${stance}`))}</th><td>${escape(T(`stances.rows.${stance}.main`))}</td><td>${escape(T(`stances.rows.${stance}.image`))}</td><td>${s.separation.toFixed(0)}°</td><td>${s.weightShift.toFixed(1)} cm</td><td>${s.contactAhead.toFixed(1)} cm</td></tr>`;
      }).join('')}</tbody></table></div>
      <h3 class="subsection-title">${escape(T('stances.when.title'))}</h3><div class="when-grid">${STANCES.map((stance, i) => `<article><span class="label">0${i + 1}</span><h4>${escape(T(`stance.${stance}`))}</h4><p>${escape(T(`stances.when.${stance}`))}</p></article>`).join('')}</div>
    </div></section>
    ${phaseSection(lang, 'forehand')}${phaseSection(lang, 'backhand')}
    <section id="lab" class="site-section lab-section"><div class="section-inner">${heading(lang, '05 / ' + T('lab.title'), T('lab.title'), T('lab.subtitle'))}
      <div id="lab-mount"><div class="lab-static"><figure>${renderPhaseFigure('forehand', 'semi', 'contact', lang)}<figcaption>${escape(T('lab.modelNote'))} · ${escape(T('stroke.forehand'))} · ${escape(T('stance.semi'))}</figcaption></figure><p>${escape(T('lab.subtitle'))}</p><p class="figure-note">${lang === 'zh' ? '启用 JavaScript 后可以播放、切换视角和拖动时间轴；上方所有动作说明与静态图无需 JavaScript。' : 'Enable JavaScript to play, turn the view and scrub the timeline. Every explanation and static drawing above remains available without it.'}</p></div></div>
    </div></section>
    <section id="conclusion" class="site-section conclusion-section"><div class="section-inner">${heading(lang, T('conclusion.fig'), T('conclusion.title'))}
      <div class="conclusion-grid">${STROKES.map((stroke) => `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(T(`conclusion.${stroke}.title`))} · ${escape(T('stances.when.title'))}"><table class="data-table"><caption>${escape(T(`conclusion.${stroke}.title`))}</caption><thead><tr><th scope="col">${escape(T('stances.table.stance'))}</th><th scope="col">${escape(T('stances.when.title'))}</th></tr></thead><tbody>${STANCES.map((stance) => `<tr><th scope="row">${escape(T(`stance.${stance}`))}</th><td>${escape(T(`conclusion.${stroke}.${stance}`))}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div><p class="conclusion-closing">${escape(T('conclusion.closing'))}</p>
    </div></section>
    <section id="notes" class="site-section notes-section"><div class="section-inner">${heading(lang, lang === 'zh' ? '附注 / REFERENCES' : 'NOTES / REFERENCES', T('notes.title'))}
      <div class="notes-grid"><div><h3>${escape(T('notes.safetyTitle'))}</h3><ol class="safety-list">${[1, 2, 3].map((i) => `<li>${escape(T('notes.s' + i))}</li>`).join('')}</ol><h3>${escape(T('notes.disclaimerTitle'))}</h3><p>${escape(T('notes.disclaimer'))}</p></div><div><h3>${escape(T('notes.sourcesTitle'))}</h3><ol class="source-list"><li>${escape(T('notes.source1'))}<p class="bibliography-pending">${escape(bookPending)}</p></li><li>${escape(T('notes.source2'))}</li></ol></div></div>
    </div></section>
  </main>
  <footer class="site-footer"><div class="footer-inner"><div><a class="site-brand" href="#cover">${escape(T('site.project'))}</a><p>${escape(T('footer.line'))}</p></div><div class="footer-links"><span>${escape(sourcePending)}</span><a href="${other}" data-lang-link>${escape(T('site.lang.otherName'))}</a><a href="#cover">${escape(T('footer.top'))} ↑</a></div><p class="label">${escape(T('footer.updated'))}</p></div></footer>`;
}

export function renderSiteDocument(shell: string, lang: Lang): string {
  if (!shell.includes('<!--site-->')) return shell;
  const url = SITE_URL + (lang === 'en' ? 'en/' : '');
  const title = escape(t(lang, 'site.title'));
  const description = escape(t(lang, 'site.description'));
  const metadata = `<meta name="description" content="${description}"/>
    <link rel="canonical" href="${url}"/>
    <link rel="alternate" hreflang="zh-CN" href="${SITE_URL}"/>
    <link rel="alternate" hreflang="en" href="${SITE_URL}en/"/>
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}"/>
    <meta property="og:type" content="website"/><meta property="og:title" content="${title}"/>
    <meta property="og:description" content="${description}"/><meta property="og:url" content="${url}"/>
    <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : 'en_US'}"/>
    <meta name="twitter:card" content="summary_large_image"/>`;
  return shell.replace(/<html\b[^>]*>/, `<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace('<!--site-head-->', metadata)
    .replace('<!--site-->', renderPage(lang));
}
