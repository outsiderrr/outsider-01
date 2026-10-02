export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
}

export function nextChoice(c: ThemeChoice): ThemeChoice {
  return c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system';
}

const KEY = 'outsider01-theme';
const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

function writeChoice(c: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    // 隐私模式等情况下存不了，忽略
  }
}

let choice: ThemeChoice = 'system';

export function currentTheme(): Theme {
  return resolveTheme(choice, media()?.matches ?? false);
}

export function currentChoice(): ThemeChoice {
  return choice;
}

function apply(): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: currentTheme(), choice } }));
}

export function setThemeChoice(c: ThemeChoice): void {
  choice = c;
  writeChoice(c);
  apply();
}

export function initTheme(): void {
  choice = readChoice();
  apply();
  media()?.addEventListener('change', () => {
    if (choice === 'system') apply();
  });
}
