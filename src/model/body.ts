/** 人体尺寸（cm），身高约 175 */
export const BODY = {
  thigh: 46,
  shin: 44,
  ankleHeight: 8,
  hipHalf: 10,
  torso: 50,
  shoulderHalf: 18,
  neck: 8,
  headRadius: 10,
  upperArm: 29,
  forearm: 26,
  footLength: 15,
  heelBehindAnkle: 4,
  toeHeight: 1.5,
  heelLiftMaxDeg: 40,
} as const;

/** 球拍尺寸（cm），总长 68.5 */
export const RACKET = {
  buttBehindGrip: 4.5,
  throat: 28,
  headCenter: 47,
  headHalfLength: 17,
  headHalfWidth: 12.5,
} as const;

export const BALL_RADIUS = 3.35;

/** 5 个关键帧的时间（秒），序号 3 是击球 */
export const TIMES: readonly number[] = [0, 0.55, 0.8, 0.92, 1.22];
export const CONTACT_INDEX = 3;
