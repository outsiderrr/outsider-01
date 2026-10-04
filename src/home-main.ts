import { t, type Lang } from './i18n';
import { currentChoice, initTheme, nextChoice, setThemeChoice } from './ui/theme';

initTheme();
document.documentElement.classList.add('js');
const lang: Lang = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
const force2d = new URLSearchParams(location.search).get('force2d') === '1';
if (force2d) document.documentElement.classList.add('force-2d');

// 原首页的章节链接继续定位完整报告；实验室锚点留在新首页。
const reportAnchors = new Set(['cover', 'abstract', 'fig-01', 'fig-02', 'fig-03', 'fig-04', 'conclusion', 'notes']);
const reportAnchor = location.hash.slice(1);
const navigatingToReport = reportAnchors.has(reportAnchor);
if (navigatingToReport) {
  location.replace(`report.html${force2d ? '?force2d=1' : ''}#${reportAnchor}`);
}

const abort = new AbortController();
const { signal } = abort;
const theme = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
function syncTheme() {
  if (!theme) return;
  const label = `${t(lang, 'site.theme.label')} · ${t(lang, `site.theme.${currentChoice()}`)}`;
  theme.textContent = label;
  theme.dataset.choice = currentChoice();
  theme.setAttribute('aria-label', `${label} / ${t(lang, `site.theme.${nextChoice(currentChoice())}`)}`);
  theme.hidden = false;
}
theme?.addEventListener('click', () => setThemeChoice(nextChoice(currentChoice())), { signal });
window.addEventListener('themechange', syncTheme, { signal });
syncTheme();

// 降级预览切换语言、进入报告时，继续保留用户主动选择的二维模式。
if (force2d) document.querySelectorAll<HTMLAnchorElement>('.lab-home-tools a, .lab-home-footer a, .lab-home-static__note a').forEach(link => {
  const href = link.getAttribute('href');
  if (!href) return;
  const [path, hash = ''] = href.split('#');
  link.setAttribute('href', `${path}?force2d=1${hash ? `#${hash}` : ''}`);
});

const root = document.getElementById('lab-root');
let disposed = false;
let disposeLab: (() => void) | undefined;
let firstFrame = 0;
let secondFrame = 0;

// 两次动画帧确保已生成的文字和线稿先上屏，再获取实验室交互模块。
firstFrame = requestAnimationFrame(() => {
  secondFrame = requestAnimationFrame(() => {
    if (disposed || !root || navigatingToReport) return;
    const fallback = root.innerHTML;
    void import('./sections/lab/lab').then(module => {
      if (disposed) return;
      const handle = module.mountLab(root, lang, { force2d });
      disposeLab = () => handle.dispose();
    }).catch(() => {
      if (disposed) return;
      root.classList.remove('lab');
      root.innerHTML = fallback;
      const status = root.querySelector<HTMLElement>('[data-home-status]');
      if (status) {
        status.setAttribute('role', 'status');
        status.prepend(document.createTextNode(lang === 'zh'
          ? '交互暂时未能加载。'
          : 'Interactive controls could not load. '));
      }
    });
  });
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  abort.abort();
  cancelAnimationFrame(firstFrame);
  cancelAnimationFrame(secondFrame);
  disposeLab?.();
});
