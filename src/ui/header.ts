import { t, type Lang } from '../i18n';
import { currentChoice, nextChoice, setThemeChoice } from './theme';

/** 目录、主题和语言切换只增强已有链接；没有脚本仍能读完整报告。 */
export function mountHeader(lang: Lang): () => void {
  const header = document.querySelector<HTMLElement>('.site-header');
  const menu = header?.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = document.querySelector<HTMLElement>('#site-nav');
  const theme = header?.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const links = [...(nav?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])];
  const sections = links.map(a => document.getElementById(a.hash.slice(1))).filter((s): s is HTMLElement => !!s);
  const abort = new AbortController();
  const { signal } = abort;
  let currentAnchor = location.hash;

  function closeMenu(focus = false) {
    menu?.setAttribute('aria-expanded', 'false');
    header?.classList.remove('menu-open');
    if (focus) menu?.focus();
  }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    header?.classList.toggle('menu-open', open);
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  }, { signal });
  document.addEventListener('click', event => {
    if (!header?.contains(event.target as Node)) closeMenu();
  }, { signal });
  nav?.addEventListener('click', event => {
    if ((event.target as Element).closest('a')) closeMenu();
  }, { signal });

  const syncTheme = () => {
    if (!theme) return;
    const label = `${t(lang, 'site.theme.label')} · ${t(lang, `site.theme.${currentChoice()}`)}`;
    theme.textContent = label;
    theme.setAttribute('aria-label', `${label} / ${t(lang, `site.theme.${nextChoice(currentChoice())}`)}`);
    theme.dataset.choice = currentChoice();
  };
  theme?.addEventListener('click', () => setThemeChoice(nextChoice(currentChoice())), { signal });
  window.addEventListener('themechange', syncTheme, { signal });
  syncTheme();

  const syncLanguage = () => document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach(link => {
    const href = link.dataset.baseHref ?? link.getAttribute('href') ?? '';
    link.dataset.baseHref = href.split('#')[0];
    link.setAttribute('href', `${link.dataset.baseHref}${currentAnchor}`);
  });
  window.addEventListener('hashchange', () => { currentAnchor = location.hash; syncLanguage(); }, { signal });
  document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach(link => link.addEventListener('pointerdown', syncLanguage, { signal }));
  syncLanguage();

  let raf = 0;
  function update() {
    raf = 0;
    const line = Math.min(innerHeight * 0.32, 230);
    let current: HTMLElement | undefined;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section;
    }
    for (const link of links) {
      if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    currentAnchor = current ? `#${current.id}` : '#cover';
    syncLanguage();
    header?.classList.toggle('is-scrolled', scrollY > 24);
    const range = document.documentElement.scrollHeight - innerHeight;
    header?.style.setProperty('--reading-progress', String(range > 0 ? scrollY / range : 0));
  }
  const requestUpdate = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', requestUpdate, { passive: true, signal });
  window.addEventListener('resize', requestUpdate, { passive: true, signal });
  update();
  return () => { abort.abort(); cancelAnimationFrame(raf); };
}
