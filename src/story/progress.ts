const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** 元素在视口中滚动的进度：元素顶部到达视口顶部时为 0，元素底部到达视口底部时为 1 */
export function sectionProgress(top: number, height: number, viewport: number): number {
  const span = height - viewport;
  if (span <= 0) return top <= 0 ? 1 : 0;
  return clamp01(-top / span);
}

/** 把 0..1 的进度分成 n 步：返回当前步序号和步内进度 */
export function stepAt(progress: number, n: number): { index: number; local: number } {
  const x = clamp01(progress) * n;
  const index = Math.min(n - 1, Math.floor(x));
  return { index, local: x - index };
}

/**
 * 焦点线在一串卡片中心之间的位置：正好在第 i 张卡片中心时返回 i，
 * 在第 i、i+1 张之间时线性插值；超出两端时夹紧。
 */
export function focusIndex(centers: readonly number[], focus: number): number {
  if (centers.length === 0) return 0;
  if (focus <= centers[0]) return 0;
  const last = centers.length - 1;
  if (focus >= centers[last]) return last;
  for (let i = 0; i < last; i++) {
    if (focus <= centers[i + 1]) return i + (focus - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return last;
}

/** 连续位置值（0 = 第 0 个关键帧）换算成动作时间 */
export function timeAlong(times: readonly number[], pos: number): number {
  const last = times.length - 1;
  const p = Math.min(last, Math.max(0, pos));
  const i = Math.min(last - 1, Math.floor(p));
  return times[i] + (times[i + 1] - times[i]) * (p - i);
}
