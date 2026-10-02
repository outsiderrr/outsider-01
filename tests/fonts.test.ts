import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { collectFontCharacters, withoutFontComments } from '../scripts/font-corpus';
import manifest from '../src/assets/fonts/manifest.json';

describe('字体子集与预算', () => {
  it('拉丁字体明确字符范围，不让中文先下载拉丁文件再尝试回退', () => {
    const css = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1]).filter(face => /font-family:\s*'IBM Plex/.test(face));
    expect(faces).toHaveLength(5);
    for (const face of faces) {
      expect(face).toContain('unicode-range: U+0000-00FF');
      expect(face).not.toContain('U+4E00-9FFF');
    }
  });
  it('仅去掉真实代码注释，保留字符串、模板和错误提示的中文', () => {
    const source = '// 开发注释\nconst a = "https://例子.test/真实"; const b = `模板${"插值"}内容`; /* 块注释 */ throw new Error("错误反馈");';
    const result = withoutFontComments(source, 'fixture.ts');
    for (const word of ['例子', '真实', '模板', '插值', '内容', '错误反馈']) expect(result).toContain(word);
    expect(result).not.toContain('开发注释');
    expect(result).not.toContain('块注释');
  });
  it('CSS 注释可排除，但 content 中看似注释的文字仍保留', () => {
    const result = withoutFontComments('/* 开发说明 */ a::after{content:"/*中文*/"} b{content:\'真实\\\'文字\'}', 'fixture.css');
    expect(result).not.toContain('开发说明');
    expect(result).toContain('/*中文*/');
    expect(result).toContain('真实');
    expect(result).toContain('文字');
  });
  it('解析失败时停止字体生成，不静默漏字', () => {
    expect(() => withoutFontComments('const = "中文"', 'fixture.ts')).toThrow('无法解析');
    expect(() => withoutFontComments('/*未结束', 'fixture.css')).toThrow('未结束');
  });
  it('英文页少量中文使用系统字体，不为书名下载整个中文子集', () => {
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
    const english = css.match(/:root\[lang='en'\]\s*\{([^}]+)\}/)?.[1];
    expect(english).toContain('IBM Plex Sans Variable');
    expect(english).toContain('PingFang SC');
    expect(english).not.toContain('Noto Sans SC Variable');
  });
  it('覆盖全部中文源码字符；新增文案必须同步生成字体', () => {
    const available = new Set(manifest.characters);
    const missing = [...collectFontCharacters()].filter((character) => !available.has(character));
    expect(missing, `新增字符需执行 scripts/subset-fonts.py：${missing.join('')}`).toEqual([]);
  });
  it('清单校验与实际 woff2 文件一致，保留 400/500/700/900 变量字重', () => {
    const font = readFileSync(new URL('../src/assets/fonts/' + manifest.font, import.meta.url));
    expect(font.subarray(0, 4).toString()).toBe('wOF2');
    expect(font.length).toBe(manifest.bytes);
    expect(createHash('sha256').update(font).digest('hex')).toBe(manifest.sha256);
    const axis = manifest.axes.find((item) => item.tag === 'wght')!;
    for (const weight of [400, 500, 700, 900]) {
      expect(axis.min).toBeLessThanOrEqual(weight);
      expect(axis.max).toBeGreaterThanOrEqual(weight);
    }
  });
  it('中文字体不覆盖拉丁字符，且保留自托管许可证', () => {
    expect(manifest.codepoints.every((cp) => cp > 255)).toBe(true);
    for (const filename of ['Noto-Sans-SC-OFL.txt', 'IBM-Plex-OFL.txt']) {
      const license = readFileSync(new URL('../src/assets/fonts/' + filename, import.meta.url), 'utf8');
      expect(license).toContain('SIL OPEN FONT LICENSE');
      expect(readFileSync(new URL('../public/fonts/' + filename, import.meta.url), 'utf8')).toBe(license);
    }
    const css = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
    expect(css).toContain('font-display: swap');
    expect(css).not.toContain('@fontsource-variable/noto-sans-sc/wght.css');
    expect(css).not.toMatch(/https?:\/\//);
  });
  it('全部可下载字体合计不超过 300 KB，文件与记录一致', () => {
    let total = manifest.bytes;
    for (const entry of manifest.latin) {
      const font = readFileSync(new URL('../src/assets/fonts/' + entry.font, import.meta.url));
      expect(font.length).toBe(entry.bytes);
      expect(createHash('sha256').update(font).digest('hex')).toBe(entry.sha256);
      total += font.length;
    }
    expect(total).toBeLessThanOrEqual(300_000);
  });
});
