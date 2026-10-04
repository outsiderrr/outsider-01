import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('控件状态对比度', () => {
  it('分段按钮切换前景与背景时保持完整选中态颜色，仅位移动效过渡', () => {
    const css = readFileSync(new URL('../src/styles/controls.css', import.meta.url), 'utf8');
    const rule = css.match(/\.seg > button \{([^}]+)\}/)?.[1] ?? '';
    const transition = rule.match(/transition:([^;]+);/)?.[1] ?? '';
    expect(transition).toContain('transform');
    expect(transition).not.toMatch(/(?:background|color|all)/);
    expect(css).toContain(".seg > button[aria-pressed='true']");
    expect(css).toContain('color: var(--on-ink)');
  });
});
