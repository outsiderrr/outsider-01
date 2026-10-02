import { describe, expect, it } from 'vitest';
import { renderPage, renderSiteDocument } from '../src/site/template';
import { renderChainChart, renderPhaseFigure, renderStanceFigure } from '../src/site/figures';
import { PHASES, STANCES, STROKES } from '../src/model';
import { siteLanguage } from '../vite-plugin-site';
import { readFileSync } from 'node:fs';

const shell = '<!doctype html><html lang="zh-CN"><head><title>placeholder</title><!--site-head--></head><body><!--site--><script type="module" src="/src/main.ts"></script></body></html>';

describe('构建时双语页面', () => {
  it('开发与生产英文入口的查询参数不会改变语言', () => {
    for (const path of ['/en/', '/en?force2d=1', '/en/?force2d=1', '/en/index.html?force2d=1#lab', '/outsider-01/en/?force2d=1']) {
      expect(siteLanguage(path)).toBe('en');
    }
    expect(siteLanguage('/index.html', '/project/en/index.html')).toBe('en');
    expect(siteLanguage('/?lang=en')).toBe('zh');
    expect(siteLanguage('/outsider-01/?force2d=1')).toBe('zh');
    expect(siteLanguage('/energy/')).toBe('zh');
  });
  for (const lang of ['zh', 'en'] as const) {
    it(`${lang} 不运行 JavaScript 也包含所有章节、文案与 30 张阶段图`, () => {
      const page = renderPage(lang);
      for (const id of ['cover', 'abstract', 'fig-01', 'fig-02', 'fig-03', 'fig-04', 'lab', 'conclusion', 'notes']) {
        expect(page).toContain(`id="${id}"`);
      }
      expect(page.match(/data-phase-figure=/g)).toHaveLength(30);
      expect(page.match(/data-stance-content=/g)).toHaveLength(30);
      expect(page).not.toMatch(/\{(?:tor|pel|sep|pelvis|torso|arm|speed)\}/);
      expect(page).not.toMatch(/\shidden(?:[=>\s])/);
      expect(page).toContain('data-chain-cursor');
      expect(page).toContain('data-story-slot="cover"');
      expect(page).toContain('id="lab-mount"');
      for (const group of [0, 1, 2, 3, 4]) expect(page).toContain(`data-emphasis="${group}" tabindex="0"`);
    });
    it(`${lang} 有正确的独立 metadata 和相对语言链接`, () => {
      const html = renderSiteDocument(shell, lang);
      expect(html).toContain(`lang="${lang === 'zh' ? 'zh-CN' : 'en'}"`);
      expect(html).toContain('<meta name="description"');
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain('rel="canonical"');
      expect(html).toContain('hreflang="zh-CN"');
      expect(html).toContain('hreflang="en"');
      expect(html).toContain(`href="${lang === 'zh' ? 'en/' : '../'}" data-lang-link`);
      expect(html).not.toContain('<!--site-->');
      expect(html).not.toContain('placeholder');
    });
  }
  it('两种语言的正文独立，不误用另一语言标题', () => {
    expect(renderPage('zh')).toContain('三句话讲完');
    expect(renderPage('zh')).not.toContain('The short version');
    expect(renderPage('en')).toContain('The short version');
    expect(renderPage('en')).not.toContain('三句话讲完');
  });
  it('开发入口不依赖 JavaScript 加载基础样式', () => {
    for (const path of ['../index.html', '../en/index.html']) {
      const entry = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(entry).toContain('<link rel="stylesheet" href="/src/styles/base.css"');
      expect(entry).toContain('<link rel="stylesheet" href="/src/styles/site.css"');
    }
  });
  it('所有横向滚动表格都能用键盘聚焦，且有本地化区域名称', () => {
    for (const lang of ['zh', 'en'] as const) {
      const regions = renderPage(lang).match(/<div class="table-scroll"[^>]+>/g)!;
      expect(regions).toHaveLength(3);
      for (const region of regions) {
        expect(region).toContain('tabindex="0"');
        expect(region).toContain('role="region"');
        expect(region).toMatch(/aria-label="[^"]+"/);
        expect(region).toContain(lang === 'zh' ? '手' : 'hand');
      }
    }
  });
  it('两种击球的站位按钮都位于固定舞台内部，滚动时仍可操作', () => {
    expect(renderPage('zh').match(/<div class="story-visual">\s*<div class="phase-toolbar">/g)).toHaveLength(2);
  });
  it('构建转换不会破坏实验室等不含占位符的入口', () => {
    const untouched = '<html lang="en"><head><title>Lab</title></head><body>Lab</body></html>';
    expect(renderSiteDocument(untouched, 'zh')).toBe(untouched);
  });
});

describe('静态示意图', () => {
  it('30 张阶段图可独立渲染，数字均有限', () => {
    for (const stroke of STROKES) for (const stance of STANCES) for (const phase of PHASES) {
      const svg = renderPhaseFigure(stroke, stance, phase, 'zh');
      expect(svg).toContain('<svg');
      expect(svg).toContain('role="img"');
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
  it('曲线保留四条独立路径及时间映射', () => {
    const svg = renderChainChart('en');
    for (const key of ['pelvis', 'torso', 'arm', 'head']) expect(svg).toContain(`data-curve="${key}"`);
    expect(svg).toContain('data-time-start="0.55"');
    expect(svg).toContain('data-time-end="1.22"');
  });
  it('脚印图覆盖两种击球与中间插值，不生成无效数字或重复 id', () => {
    for (const stroke of STROKES) for (const value of [0, .25, .5, .75, 1]) {
      const svg = renderStanceFigure(stroke, value, 'en');
      expect(svg).toContain('<svg');
      expect(svg).toContain('Contact');
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
      expect(svg).not.toContain('id=');
    }
  });
});
