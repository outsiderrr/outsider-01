import { CONTACT_INDEX, TIMES } from '../body';
import { mirrorKeyframe } from '../mirror';
import type { KeyframeSet, KeyframeValues, Stance } from '../types';
import { FOREHAND, READY } from './forehand';

type Adjust = (m: KeyframeValues) => Partial<KeyframeValues>;

/**
 * 双手反手：身体取正手的左右镜像，手和球拍按双手握拍重新设定。
 * 右手握拍柄底部，左手在上方 9 cm；准备姿势与正手相同（左手扶拍颈，引拍时滑下来）。
 */
const ADJUST: readonly Adjust[] = [
  () => ({}),
  (m) => ({
    tor: [-110, m.tor[1], m.tor[2]],
    rh: [-125, 38, 120], rk: [-170, 40, 180], re: [0.2, 0.6, -0.8], le: [-0.6, -0.3, -0.8], lt: 1, lg: 9,
  }),
  () => ({ rh: [-115, 36, 98], rk: [-185, -40, 180], re: [0.3, 0.4, -1], le: [-0.3, -0.5, -1], lt: 1, lg: 9 }),
  () => ({ rh: [-10, 40, 104], rk: [-82, 2, 0], re: [0.2, 0.2, -1], le: [-0.3, -0.3, -1], lt: 1, lg: 9 }),
  () => ({ rh: [55, 26, 150], rk: [165, 38, 180], re: [0.3, 0.8, 0.3], le: [-0.1, 1, 0.1], lt: 1, lg: 9 }),
];

function backhandFrames(stance: Stance): KeyframeValues[] {
  return FOREHAND[stance].frames.map((f, i) => {
    if (i === 0) return READY;
    const m = mirrorKeyframe(f);
    return { ...m, ...ADJUST[i](m) };
  });
}

const set = (stance: Stance): KeyframeSet => ({
  stroke: 'backhand',
  stance,
  times: TIMES,
  contactIndex: CONTACT_INDEX,
  frames: backhandFrames(stance),
});

export const BACKHAND: Record<Stance, KeyframeSet> = {
  neutral: set('neutral'),
  semi: set('semi'),
  open: set('open'),
};
