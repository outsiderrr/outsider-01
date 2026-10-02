import { describe, expect, it } from 'vitest';
import { inlineReportStyles, inlineReportStylesPlugin } from '../vite-plugin-site';

describe('报告首屏样式', () => {
  const base = '/outsider-01/';
  const assets = new Map([
    ['assets/base.css', 'body{color:blue}'],
    ['assets/site.css', '@font-face{src:url(/outsider-01/assets/font.woff2)}body{color:red}'],
  ]);
  it('保留两张样式表的层叠次序', () => {
    const html = '<link rel="stylesheet" crossorigin href="/outsider-01/assets/base.css"><link href="/outsider-01/assets/site.css" rel="stylesheet">';
    const result = inlineReportStyles(html, base, assets);
    expect(result.match(/ disabled data-inline-style-for=/g)).toHaveLength(2);
    expect(result).toContain('href="/outsider-01/assets/base.css" disabled');
    expect(result).toContain('href="/outsider-01/assets/site.css" disabled');
    expect(result.indexOf('body{color:blue}')).toBeLessThan(result.indexOf('body{color:red}'));
    expect(result.match(/<style /g)).toHaveLength(2);
  });
  it('中英文页保留构建后的绝对字体路径', () => {
    expect(inlineReportStyles('<link rel="stylesheet" href="/outsider-01/assets/site.css">', base, assets))
      .toContain('url(/outsider-01/assets/font.woff2)');
  });
  it('再次处理时不复制已有内联样式和禁用标记', () => {
    const once = inlineReportStyles('<link rel="stylesheet" href="/outsider-01/assets/base.css">', base, assets);
    expect(inlineReportStyles(once, base, assets)).toBe(once);
  });
  it('不改变图标、预加载或外站样式', () => {
    const html = '<link rel="icon" href="/outsider-01/favicon.svg"><link rel="modulepreload" href="/outsider-01/assets/base.css"><link rel="stylesheet" href="https://example.com/site.css">';
    expect(inlineReportStyles(html, base, assets)).toBe(html);
  });
  it('不静默忽略缺失的构建资源', () => {
    expect(() => inlineReportStyles('<link rel="stylesheet" href="/outsider-01/assets/missing.css">', base, assets)).toThrow('缺少构建样式');
  });
  it('样式字符串不会提前结束 HTML 样式元素', () => {
    expect(inlineReportStyles('<link rel="stylesheet" href="/outsider-01/assets/base.css">', base,
      new Map([['assets/base.css', 'a:after{content:"</style>"}']])))
      .toContain('content:"<\\/style>"');
  });
  it('仅在生产构建后处理，不改变开发服务器', () => {
    const plugin = inlineReportStylesPlugin();
    expect(plugin.apply).toBe('build');
    expect(plugin.enforce).toBe('post');
  });
});
