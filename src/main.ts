import { initTheme } from './ui/theme';
import { mountHeader } from './ui/header';
import type { Lang } from './i18n';

initTheme();
document.documentElement.classList.add('js');
const lang: Lang = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
const force2d = new URLSearchParams(location.search).get('force2d') === '1';
if (force2d) document.documentElement.classList.add('force-2d');
const disposers: (() => void)[] = [mountHeader(lang)];

// 静态文字和线稿首先绘制，故事和实验室分别按需加载。
let disposed = false;
const afterPaint = (callback: () => void) => requestAnimationFrame(() => requestAnimationFrame(callback));
afterPaint(() => {
  if (disposed) return;
  void import('./story/storyStage').then(module => module.mountStory(document.body, lang, { force2d }))
    .then(handle => { if (disposed) handle.dispose(); else disposers.push(() => handle.dispose()); })
    .catch(() => document.documentElement.classList.add('story-unavailable'));
});

const stanceRoot = document.getElementById('fig-02');
if (stanceRoot) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    void import('./story/stances').then(module => {
      if (disposed) return;
      const handle = module.mountStances(stanceRoot, lang);
      disposers.push(() => handle.dispose());
    }).catch(() => stanceRoot.classList.add('interaction-unavailable'));
  }, { rootMargin: '600px' });
  observer.observe(stanceRoot);
  disposers.push(() => observer.disconnect());
}

const labRoot = document.getElementById('lab-mount');
if (labRoot) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    void import('./sections/lab/lab').then(module => {
      if (disposed) return;
      return module.mountLab(labRoot, lang, { force2d });
    }).then(handle => {
      if (!handle) return;
      if (disposed) handle.dispose();
      else disposers.push(() => handle.dispose());
    }).catch(() => labRoot.classList.add('interaction-unavailable'));
  }, { rootMargin: '600px' });
  observer.observe(labRoot);
  disposers.push(() => observer.disconnect());
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  disposers.forEach(dispose => dispose());
});
