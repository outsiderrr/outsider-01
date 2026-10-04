import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderLabHome, renderLabHomeDocument } from '../src/site/labHome';

const shell = '<!doctype html><html lang="zh-CN"><head><title>placeholder</title><!--lab-home-head--></head><body><!--lab-home--><script type="module" src="/src/home-main.ts"></script></body></html>';
const site = 'https://outsiderrr.github.io/outsider-01/';

describe('实验室首页', () => {
  for (const lang of ['zh', 'en'] as const) {
    it(`${lang} 构建时包含线稿、说明、唯一主标题和完整报告入口`, () => {
      const page = renderLabHome(lang);
      expect(page.match(/<h1\b/g)).toHaveLength(1);
      expect(page).toContain('<h1 class="sr-only">');
      expect(page).toContain('id="lab-root"');
      expect(page).toContain('id="main"');
      expect(page).toContain('href="#main"');
      expect(page).toContain('id="lab-static-title"');
      expect(page).toContain('<svg');
      expect(page).toContain('role="img"');
      expect(page).toContain('href="report.html"');
      expect(page).toContain('href="report.html#notes"');
      expect(page).toContain(lang === 'zh' ? '模型示意值' : 'Model values');
      expect(page).not.toContain('data-story-slot');
      expect(page).not.toMatch(/NaN|Infinity|undefined/);
    });

    it(`${lang} 使用独立元信息以及部署子目录内的相对语言链接`, () => {
      const html = renderLabHomeDocument(shell, lang);
      expect(html).toContain(`<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">`);
      expect(html).toContain(`<link rel="canonical" href="${site}${lang === 'en' ? 'en/' : ''}"/>`);
      expect(html).toContain(`<link rel="alternate" hreflang="zh-CN" href="${site}"/>`);
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${site}en/"/>`);
      expect(html).toContain('hreflang="x-default"');
      expect(html).toContain(`<a class="lab-home-language" href="${lang === 'zh' ? 'en/' : '../'}" data-lang-link`);
      expect(html).toContain('<meta name="description"');
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain(`share/report-${lang}.png`);
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html.indexOf("localStorage.getItem('outsider01-theme')")).toBeLessThan(html.indexOf('</head>'));
      expect(html).not.toContain('placeholder');
      expect(html).not.toContain('<!--lab-home');
    });
  }

  it('无首页占位符的报告和独立实验室保持原样', () => {
    const unchanged = '<html lang="en"><head><title>Lab</title></head><body><!--site--></body></html>';
    expect(renderLabHomeDocument(unchanged, 'zh')).toBe(unchanged);
  });

  it('无脚本时保留可读线稿与链接，主题控件在增强完成后启用', () => {
    const page = renderLabHome('zh');
    expect(page).toContain('data-theme-toggle hidden');
    expect(page).toContain('当前为静态线稿');
    expect(page).not.toContain('<noscript>');
    expect(page).not.toContain('<canvas');
    const css = readFileSync(new URL('../src/styles/lab-home.css', import.meta.url), 'utf8');
    expect(css).toContain('.lab-home-theme[hidden] { display: none; }');
    expect(css).toContain('.lab-home-skip:focus');
    expect(css).toContain('.lab-home-root.lab { padding-top: 16px; }');
  });

  it('交互入口延后加载实验室并保留强制二维与热更新释放', () => {
    const entry = readFileSync(new URL('../src/home-main.ts', import.meta.url), 'utf8');
    expect(entry).toContain("import('./sections/lab/lab')");
    expect(entry).not.toMatch(/import\s+\{[^}]*mountLab[^}]*\}\s+from/);
    expect(entry).toContain(".get('force2d') === '1'");
    expect(entry).toContain('root.innerHTML = fallback');
    expect(entry).toContain('cancelAnimationFrame(firstFrame)');
    expect(entry).toContain('cancelAnimationFrame(secondFrame)');
    expect(entry).toContain('disposeLab?.()');
    expect(entry).toContain('abort.abort()');
  });

  it('原首页章节锚点继续指向完整报告，实验室保留为默认首页', () => {
    const entry = readFileSync(new URL('../src/home-main.ts', import.meta.url), 'utf8');
    expect(entry).toContain("'cover', 'abstract', 'fig-01', 'fig-02', 'fig-03', 'fig-04', 'conclusion', 'notes'");
    expect(entry).toContain('const navigatingToReport = reportAnchors.has(reportAnchor)');
    expect(entry).toContain('if (navigatingToReport)');
    expect(entry).toContain('location.replace(`report.html');
  });
});
