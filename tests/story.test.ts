import { describe, expect, it } from 'vitest';
import { getSet, poseAt } from '../src/model';
import { chainState, cursorPosition } from '../src/story/chain';
import { blendStoryPose, phaseState, phaseView } from '../src/story/phases';

describe('滚动叙事纯逻辑', () => {
  it('链条时间范围和强调顺序被夹在规定的五步内', () => {
    expect(chainState(-1)).toEqual({ time: 0.55, group: 0, progress: 0 });
    expect(chainState(1)).toEqual({ time: 0.92, group: 4, progress: 1 });
    expect(chainState(2)).toEqual(chainState(1));
    expect(chainState(0.5).group).toBe(2);
  });
  it('曲线游标按真实时间域换算，不把击球错误地画成曲线终点', () => {
    expect(cursorPosition(0.55, 0.55, 1.22, 48, 580)).toBe(48);
    expect(cursorPosition(0.92, 0.55, 1.22, 48, 580)).toBeCloseTo(341.79, 1);
    expect(cursorPosition(2, 0.55, 1.22, 48, 580)).toBe(580);
    expect(cursorPosition(0, 1, 1, 48, 580)).toBe(48);
  });
  it('五个阶段中心严格对应模型的五个时间点', () => {
    for (const stroke of ['forehand', 'backhand'] as const) {
      const set = getSet(stroke, 'semi');
      set.times.forEach((time, index) => expect(phaseState(index, stroke, 'semi').time).toBe(time));
    }
  });
  it('正反手的击球和后方镜头对称，俯视不受正反手影响', () => {
    expect(phaseView(3, 'forehand').azimuth).toBe(-phaseView(3, 'backhand').azimuth);
    expect(phaseView(4, 'forehand').azimuth).toBe(145);
    expect(phaseView(4, 'backhand').azimuth).toBe(-145);
    expect(phaseView(1, 'forehand')).toEqual(phaseView(1, 'backhand'));
  });
  it('站位过渡的两端精确还原原姿态，不修改源数据', () => {
    const a = poseAt(getSet('forehand', 'neutral'), 0.8);
    const b = poseAt(getSet('forehand', 'open'), 0.8);
    const before = structuredClone(a);
    expect(blendStoryPose(a, b, 0)).toEqual(a);
    expect(blendStoryPose(a, b, 1)).toEqual(b);
    const mid = blendStoryPose(a, b, 0.5);
    expect(mid.pel[0]).toBeCloseTo((a.pel[0] + b.pel[0]) / 2);
    expect(a).toEqual(before);
  });
});
