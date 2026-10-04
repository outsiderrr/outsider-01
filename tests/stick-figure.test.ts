import { describe, expect, it } from 'vitest';
import { BODY, STANCES, STROKES, getSet, poseAt, solvePose, type Pose } from '../src/model';
import { projector, type Camera2D } from '../src/render2d/project';
import { renderFigure, type FigureOptions } from '../src/render2d/stickFigure';

const camera: Camera2D = { phi: 30, elev: 12, scale: 1, cx: 300, groundY: 372 };
const smallInset = { cx: 188, cy: 40, r: 22 };
const largeInset = { cx: 590, cy: 66, r: 40, big: true };
const samples = STROKES.flatMap(stroke => STANCES.flatMap(stance => {
  const set = getSet(stroke, stance);
  return set.times.map(time => poseAt(set, time));
}));
const fixed = (number: number): number => Number(number.toFixed(1));
const figure = (pose: Pose, options: FigureOptions = {}): string => renderFigure(pose, solvePose(pose), camera, options);

// 仅解析本站生成的 SVG 标签，避免为纯字符串渲染测试引入浏览器环境。
function elements(svg: string, tag: string): Record<string, string>[] {
  return [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map(match =>
    Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])),
  );
}

function insetOf(pose: Pose, inset: NonNullable<FigureOptions['inset']> = largeInset, labels?: FigureOptions['labels']): string {
  const body = figure(pose);
  const full = figure(pose, { inset, labels });
  expect(full.startsWith(body)).toBe(true);
  const fragment = full.slice(body.length);
  expect(fragment).toMatch(/^<g data-diagram="shoulder-hip">.*<\/g>$/);
  return fragment;
}

describe('肩髋俯视示意图', () => {
  it('六套动作五帧的小图和大图只保留边框圆、右肩点、两脚和两轴', () => {
    expect(samples).toHaveLength(30);
    for (const pose of samples) {
      for (const inset of [smallInset, largeInset]) {
        const fragment = insetOf(pose, inset);
        const circles = elements(fragment, 'circle');
        expect(circles).toHaveLength(2);
        expect(circles[0]).toMatchObject({ cx: String(inset.cx), cy: String(inset.cy), r: String(inset.r), fill: 'none' });
        expect(circles[1].fill).toBe('var(--ink)');
        const feet = elements(fragment, 'ellipse');
        expect(feet).toHaveLength(2);
        expect(feet[0].fill).toBe('none');
        expect(feet[1].fill).toBe('var(--text-2)');
        expect(elements(fragment, 'line')).toHaveLength(2);
        expect(elements(fragment, 'path')).toHaveLength(1);
      }
    }
  });

  it('右肩点始终落在肩轴正端，随肩轴旋转而非固定在屏幕右侧', () => {
    const horizontalOffsets: number[] = [];
    for (const pose of samples) {
      const fragment = insetOf(pose);
      const shoulder = elements(fragment, 'line')[1];
      const dot = elements(fragment, 'circle')[1];
      const angle = pose.tor[0] * Math.PI / 180;
      const expectedX = fixed(largeInset.cx + Math.cos(angle) * largeInset.r * 0.8);
      const expectedY = fixed(largeInset.cy + Math.sin(angle) * largeInset.r * 0.8);
      expect(Number(dot.cx)).toBe(expectedX);
      expect(Number(dot.cy)).toBe(expectedY);
      expect(dot.cx).toBe(shoulder.x2);
      expect(dot.cy).toBe(shoulder.y2);
      horizontalOffsets.push(expectedX - largeInset.cx);
    }
    expect(horizontalOffsets.some(offset => offset < 0)).toBe(true);
    expect(horizontalOffsets.some(offset => offset > 0)).toBe(true);
  });

  it('头部朝向变化不再向肩髋俯视图添加方向点', () => {
    for (const pose of samples) {
      const expected = insetOf(pose);
      for (const hd of [-90, 0, 90]) expect(insetOf({ ...pose, hd })).toBe(expected);
    }
  });

  it('承重比例与肩髋俯视图独立，脚下圆环和实心点仍按比例移动', () => {
    const project = projector(camera);
    for (const pose of samples) {
      const expectedInset = insetOf(pose);
      const locations: string[] = [];
      for (const w of [0, 0.5, 1]) {
        const weighted = { ...pose, w };
        expect(insetOf(weighted)).toBe(expectedInset);
        const circles = elements(figure(weighted), 'circle');
        const ring = circles.find(circle => Number(circle.r) === 7)!;
        const point = circles.find(circle => Number(circle.r) === 3.2)!;
        expect(ring).toBeDefined();
        expect(point).toBeDefined();
        expect(ring.fill).toBe('none');
        expect(point.fill).toBe('var(--fig-near)');
        const expected = project([
          pose.rf[0] + (pose.lf[0] - pose.rf[0]) * w,
          pose.rf[1] + (pose.lf[1] - pose.rf[1]) * w,
          0,
        ]);
        for (const mark of [ring, point]) {
          expect(Number(mark.cx)).toBe(fixed(expected[0]));
          expect(Number(mark.cy)).toBe(fixed(expected[1]));
        }
        locations.push(`${point.cx},${point.cy}`);
      }
      expect(new Set(locations).size).toBe(3);
    }
  });

  it('主图人物的头部和鼻尖保持，移除范围仅限肩髋俯视图', () => {
    for (const pose of samples) {
      const joints = solvePose(pose);
      const project = projector(camera);
      const circles = elements(figure(pose), 'circle');
      const head = circles.find(circle => Number(circle.r) === BODY.headRadius)!;
      const nose = circles.find(circle => Number(circle.r) === 2)!;
      expect(circles).toHaveLength(4);
      expect(Number(head.cx)).toBe(fixed(project(joints.head)[0]));
      expect(Number(head.cy)).toBe(fixed(project(joints.head)[1]));
      expect(Number(nose.cx)).toBe(fixed(project(joints.nose)[0]));
      expect(Number(nose.cy)).toBe(fixed(project(joints.nose)[1]));
    }
  });

  it('中英文球网和肩髋差标签保持，角度来自同一模型帧', () => {
    for (const pose of samples) {
      for (const labels of [
        { net: '球网', separation: '肩髋差' },
        { net: 'NET', separation: 'Separation' },
      ]) {
        const fragment = insetOf(pose, largeInset, labels);
        const angle = Math.round(Math.abs(pose.tor[0] - pose.pel[3]));
        expect(fragment).toContain(`>${labels.net}</text>`);
        expect(fragment).toContain(`>${labels.separation} ${angle}°</text>`);
        expect(elements(fragment, 'text')).toHaveLength(2);
      }
    }
  });
});
