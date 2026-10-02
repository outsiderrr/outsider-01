import { DEG, type Vec3 } from '../model/vec';

/** 2D 相机：phi 是相机所在的方位角（0 在球网一侧），elev 是俯视角 */
export interface Camera2D {
  phi: number;
  elev: number;
  scale: number;
  cx: number;
  groundY: number;
}

/** [屏幕 x, 屏幕 y, 朝向相机的深度（越大越近）] */
export type Projected = readonly [number, number, number];

export function projector(c: Camera2D): (v: Vec3) => Projected {
  const cp = Math.cos(c.phi * DEG);
  const sp = Math.sin(c.phi * DEG);
  const ce = Math.cos(c.elev * DEG);
  const se = Math.sin(c.elev * DEG);
  return (q) => {
    const sx = -q[0] * cp + q[1] * sp;
    const depth = q[0] * sp + q[1] * cp;
    const sy = q[2] * ce - depth * se;
    return [c.cx + c.scale * sx, c.groundY - c.scale * sy, depth];
  };
}
