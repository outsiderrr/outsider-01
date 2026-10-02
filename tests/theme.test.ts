import { describe, expect, it } from 'vitest';
import { nextChoice, resolveTheme } from '../src/ui/theme';

describe('theme', () => {
  it('resolveTheme：跟随系统时看系统设置，否则用用户的选择', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('nextChoice 循环一圈回到跟随系统', () => {
    expect(nextChoice('system')).toBe('light');
    expect(nextChoice('light')).toBe('dark');
    expect(nextChoice('dark')).toBe('system');
  });
});
