import { PHASES, getSet, poseAt, type PhaseId, type Pose, type Stance, type Stroke } from '../model';
import type { ViewSpec } from '../render3d/cameraRig';
import { timeAlong } from './progress';

export interface PhaseState {
  index: number;
  phase: PhaseId;
  time: number;
  view: ViewSpec;
}

/** 视角也是示意：击球侧按正反手镜像，随挥用后方轴测。 */
export function phaseView(index: number, stroke: Stroke): ViewSpec {
  const side = stroke === 'forehand' ? 1 : -1;
  return [
    { azimuth: 32 * side, elevation: 16, zoom: 1 },
    { azimuth: 0, elevation: 89.5, zoom: 1 },
    { azimuth: 90 * side, elevation: 3, zoom: 1 },
    { azimuth: 18 * side, elevation: 5, zoom: 1 },
    { azimuth: 145 * side, elevation: 18, zoom: 1 },
  ][Math.max(0, Math.min(4, Math.round(index)))];
}

export function phaseState(position: number, stroke: Stroke, stance: Stance): PhaseState {
  const clamped = Math.max(0, Math.min(4, position));
  const index = Math.round(clamped);
  return { index, phase: PHASES[index], time: timeAlong(getSet(stroke, stance).times, clamped), view: phaseView(index, stroke) };
}

/** 只用于切换站位时的可视过渡，不参与任何模型测量或约束判定。 */
export function blendStoryPose(from: Pose, to: Pose, amount: number): Pose {
  const k = Math.max(0, Math.min(1, amount));
  const result = {} as Record<keyof Pose, number | number[]>;
  for (const key of Object.keys(from) as (keyof Pose)[]) {
    const a = from[key];
    const b = to[key];
    result[key] = typeof a === 'number'
      ? a + ((b as number) - a) * k
      : a.map((value, i) => value + ((b as readonly number[])[i] - value) * k);
  }
  return result as unknown as Pose;
}

export function storyPose(stroke: Stroke, stance: Stance, time: number): Pose {
  return poseAt(getSet(stroke, stance), time);
}
