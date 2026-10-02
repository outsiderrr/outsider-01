import { BACKHAND } from './keyframes/backhand';
import { FOREHAND } from './keyframes/forehand';
import type { KeyframeSet, Stance, Stroke } from './types';

export const SETS: Record<Stroke, Record<Stance, KeyframeSet>> = { forehand: FOREHAND, backhand: BACKHAND };
export const getSet = (stroke: Stroke, stance: Stance): KeyframeSet => SETS[stroke][stance];

export * from './types';
export { BODY, RACKET, BALL_RADIUS, TIMES, CONTACT_INDEX } from './body';
export { poseAt } from './interp';
export { solvePose, type Joints, type RacketGeom, type FootJoints } from './solve';
export { shoulderHipSeparation, racketSpeed, chainCurves, peakTime, type ChainCurves } from './metrics';
