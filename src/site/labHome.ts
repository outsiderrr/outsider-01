import { t, type Lang } from '../i18n';
import { renderPhaseFigure } from './figures';

const SITE_URL = 'https://outsiderrr.github.io/outsider-01/';
const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 首页先提供真实模型的静态线稿，实验室挂载后在同一位置渐进增强。 */
export function renderLabHome(lang: Lang): string {
  const T = (key: string) => escape(t(lang, key));
  const other = lang === 'zh' ? 'en/' : '../';
  const report = lang === 'zh' ? '阅读实验报告' : 'Read the report';
  const staticNote = lang === 'zh'
    ? '当前为静态线稿。完整报告包含动作说明与各阶段示意图。'
    : 'Static model preview. The full report includes explanations and diagrams for every phase.';
  return `<a class="lab-home-skip" href="#main">${T('site.skip')}</a>
    <header class="lab-home-header"><div class="lab-home-header__inner">
      <a class="lab-home-brand" href="#main" aria-label="${T('site.title')}">${T('site.project')}</a>
      <nav class="lab-home-tools" aria-label="${T('site.navLabel')}">
        <a class="lab-home-report" href="report.html">${escape(report)}</a>
        <a class="lab-home-language" href="${other}" data-lang-link lang="${lang === 'zh' ? 'en' : 'zh-CN'}" hreflang="${lang === 'zh' ? 'en' : 'zh-CN'}" aria-label="${T('site.lang.otherName')}">${T('site.lang.other')}</a>
        <button class="btn lab-home-theme" type="button" data-theme-toggle hidden aria-label="${T('site.theme.label')} · ${T('site.theme.system')}">${T('site.theme.label')} · ${T('site.theme.system')}</button>
      </nav>
    </div></header>
    <main id="main" class="lab-home-main" tabindex="-1">
      <h1 class="sr-only">${T('lab.title')} · ${T('site.title')}</h1>
      <div id="lab-root" class="lab-home-root">
        <section class="lab-home-static" aria-labelledby="lab-static-title">
          <div class="lab-home-static__head"><p class="label">FIG. 05</p><h2 id="lab-static-title">${T('lab.title')}<span lang="en">LAB</span></h2><p>${T('lab.subtitle')}</p></div>
          <figure class="lab-home-static__figure">${renderPhaseFigure('forehand', 'semi', 'backswing', lang)}<figcaption>${T('stroke.forehand')} · ${T('stance.semi')} · ${T('phase.forehand.semi.backswing.name')}</figcaption></figure>
          <p class="lab-home-static__note" data-home-status>${escape(staticNote)} <a href="report.html">${escape(report)} ↗</a></p>
        </section>
      </div>
    </main>
    <footer class="lab-home-footer"><p>${T('lab.stageLabel')} · ${T('lab.modelNote')}</p><a href="report.html#notes">${T('notes.title')} ↗</a></footer>`;
}

export function renderLabHomeDocument(shell: string, lang: Lang): string {
  if (!shell.includes('<!--lab-home-->')) return shell;
  const url = SITE_URL + (lang === 'en' ? 'en/' : '');
  const title = escape(`${t(lang, 'lab.title')} · ${t(lang, 'site.title')}`);
  const description = escape(t(lang, 'site.description'));
  const metadata = `<script>document.documentElement.classList.add('js');try{const t=localStorage.getItem('outsider01-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}</script>
    <meta name="description" content="${description}"/>
    <link rel="canonical" href="${url}"/>
    <link rel="alternate" hreflang="zh-CN" href="${SITE_URL}"/>
    <link rel="alternate" hreflang="en" href="${SITE_URL}en/"/>
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}"/>
    <meta property="og:type" content="website"/><meta property="og:title" content="${title}"/>
    <meta property="og:description" content="${description}"/><meta property="og:url" content="${url}"/>
    <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : 'en_US'}"/>
    <meta property="og:image" content="${SITE_URL}share/report-${lang}.png"/>
    <meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
    <meta property="og:image:alt" content="${description}"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:image" content="${SITE_URL}share/report-${lang}.png"/>`;
  return shell.replace(/<html\b[^>]*>/, `<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace('<!--lab-home-head-->', metadata)
    .replace('<!--lab-home-->', renderLabHome(lang));
}
