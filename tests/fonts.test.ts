import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { collectFontCharacters } from '../scripts/font-corpus';
import manifest from '../src/assets/fonts/manifest.json';

describe('字体子集与预算', () => {
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
