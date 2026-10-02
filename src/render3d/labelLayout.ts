export interface LabelBounds { x: number; y: number; w: number; h: number }

/** 标签中心限制在可用主视图内；尺寸来自实际 DOM，适用中英不同字长。 */
export function clampLabelCenter(x: number, y: number, width: number, height: number, bounds: LabelBounds, padding = 8): { x: number; y: number } {
  const minX = bounds.x + Math.min(bounds.w / 2, width / 2 + padding);
  const maxX = bounds.x + Math.max(bounds.w / 2, bounds.w - width / 2 - padding);
  const minY = bounds.y + Math.min(bounds.h / 2, height / 2 + padding);
  const maxY = bounds.y + Math.max(bounds.h / 2, bounds.h - height / 2 - padding);
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}
