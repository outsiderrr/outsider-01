import { describe, expect, it } from 'vitest';
import { clampLabelCenter } from '../src/render3d/labelLayout';

describe('舞台文字标签边界', () => {
  const bounds = { x: 0, y: 90, w: 343, h: 280 };
  it('英文长标签不越过手机主画面左边界', () => {
    expect(clampLabelCenter(-20, 340, 150, 24, bounds)).toEqual({ x: 83, y: 340 });
  });
  it('避开上方 HUD 与下方三视图', () => {
    expect(clampLabelCenter(170, 20, 100, 24, bounds).y).toBe(110);
    expect(clampLabelCenter(170, 430, 100, 24, bounds).y).toBe(350);
  });
  it('小窗非常狭窄时居中，不产生反向边界', () => {
    expect(clampLabelCenter(0, 0, 200, 80, { x: 5, y: 10, w: 60, h: 40 })).toEqual({ x: 35, y: 30 });
  });
});
