import { describe, expect, it } from 'vitest';
import { add, angleBetween, azimuth, cross, dist, dot, length, normalize, scale, sub } from '../src/model/vec';

describe('vec', () => {
  it('基本运算', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 0])).toBe(5);
    expect(dist([0, 0, 0], [0, 3, 4])).toBe(5);
  });

  it('normalize 遇到零向量返回零向量', () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
    expect(normalize([0, 0, 2])[2]).toBeCloseTo(1);
  });

  it('angleBetween 返回度数', () => {
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(90);
    expect(angleBetween([1, 0, 0], [2, 0, 0])).toBeCloseTo(0);
  });

  it('azimuth：0° 朝网，90° 朝右', () => {
    const a = azimuth(0);
    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(1);
    const b = azimuth(90);
    expect(b[0]).toBeCloseTo(1);
    expect(b[1]).toBeCloseTo(0);
  });
});
