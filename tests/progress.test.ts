import { describe, expect, it } from 'vitest';
import { focusIndex, sectionProgress, stepAt, timeAlong } from '../src/story/progress';

describe('sectionProgress', () => {
  it('元素顶部到视口顶部为 0，元素底部到视口底部为 1，并夹紧在 0..1', () => {
    expect(sectionProgress(0, 2000, 800)).toBe(0);
    expect(sectionProgress(-1200, 2000, 800)).toBe(1);
    expect(sectionProgress(-600, 2000, 800)).toBeCloseTo(0.5);
    expect(sectionProgress(300, 2000, 800)).toBe(0);
    expect(sectionProgress(-5000, 2000, 800)).toBe(1);
  });
  it('元素比视口矮时不除以零', () => {
    expect(sectionProgress(0, 500, 800)).toBe(0);
  });
});

describe('stepAt', () => {
  it('把进度分成 n 步', () => {
    expect(stepAt(0, 5)).toEqual({ index: 0, local: 0 });
    expect(stepAt(0.5, 5)).toEqual({ index: 2, local: 0.5 });
    expect(stepAt(1, 5)).toEqual({ index: 4, local: 1 });
  });
});

describe('focusIndex', () => {
  it('焦点线落在哪两张卡片中心之间，就返回连续的位置值', () => {
    const centers = [100, 300, 500];
    expect(focusIndex(centers, 100)).toBeCloseTo(0);
    expect(focusIndex(centers, 200)).toBeCloseTo(0.5);
    expect(focusIndex(centers, 500)).toBeCloseTo(2);
    expect(focusIndex(centers, 0)).toBe(0);
    expect(focusIndex(centers, 900)).toBe(2);
  });
});

describe('timeAlong', () => {
  it('连续位置值换算成动作时间', () => {
    const T = [0, 0.55, 0.8, 0.92, 1.22];
    expect(timeAlong(T, 0)).toBe(0);
    expect(timeAlong(T, 1.5)).toBeCloseTo(0.675);
    expect(timeAlong(T, 4)).toBeCloseTo(1.22);
  });
});
