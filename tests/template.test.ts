import { describe, expect, it } from 'vitest';
import { renderPage, renderSiteDocument } from '../src/site/template';
import { renderChainChart, renderPhaseFigure, renderStanceFigure } from '../src/site/figures';
import { PHASES, STANCES, STROKES } from '../src/model';

const shell = '<!doctype html><html lang="zh-CN"><head><title>placeholder</title><!--site-head--></head><body><!--site--><script type="module" src="/src/main.ts"></script></body></html>';

describe('构建时双语页面', () => {
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
