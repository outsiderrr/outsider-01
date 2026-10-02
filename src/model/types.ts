import type { Vec3 } from './vec';

export type Stroke = 'forehand' | 'backhand';
export type Stance = 'neutral' | 'semi' | 'open';
export type PhaseId = 'ready' | 'backswing' | 'drive' | 'contact' | 'finish';

export const STROKES: readonly Stroke[] = ['forehand', 'backhand'];
export const STANCES: readonly Stance[] = ['neutral', 'semi', 'open'];
export const PHASES: readonly PhaseId[] = ['ready', 'backswing', 'drive', 'contact', 'finish'];

/** 脚：[x, y, 朝向角°, 脚跟抬起 0..1] */
export type Foot = readonly [number, number, number, number];
/** 柱坐标（绕骨盆竖轴）：[方位角°, 水平半径, 高度] */
export type Cyl = readonly [number, number, number];
/** 发力标记：[腿, 髋, 躯干, 手臂, 球拍]，0..1 */
export type Activation = readonly [number, number, number, number, number];

export interface KeyframeValues {
  lf: Foot;
  rf: Foot;
  /** 骨盆：[x, y, 高度, 朝向角°] */
  pel: readonly [number, number, number, number];
  /** 躯干：[朝向角°, 前倾°, 侧倾°（正值右肩下沉）] */
  tor: readonly [number, number, number];
  /** 头的朝向角° */
  hd: number;
  /** 右手（握在拍柄底部）的目标位置 */
  rh: Cyl;
  /** 球拍：[方位角°, 仰角°, 拍面滚转°] */
  rk: readonly [number, number, number];
  /** 右肘弯曲方向提示 */
  re: Vec3;
  /** 左手不握拍时的目标位置 */
  lh: Cyl;
  /** 左手握到拍杆上的权重 0..1 */
  lt: number;
  /** 左手握拍点离右手的距离（cm，沿拍杆）：28 是拍颈，9 是双手握拍 */
  lg: number;
  /** 左肘弯曲方向提示 */
  le: Vec3;
  a: Activation;
  /** 刹车标记 0..1 */
  br: number;
  /** 左脚承担的重心比例 0..1 */
  w: number;
}

export interface KeyframeSet {
  stroke: Stroke;
  stance: Stance;
  /** 5 个关键帧的时间（秒） */
  times: readonly number[];
  /** 击球帧的序号 */
  contactIndex: number;
  frames: readonly KeyframeValues[];
}

export interface Pose extends KeyframeValues {
  /** 两只脚此刻的抬起高度（cm）：[左, 右] */
  lift: readonly [number, number];
}
