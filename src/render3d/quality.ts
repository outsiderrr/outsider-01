export type QualityTier = 'high' | 'medium' | 'low';

export interface DeviceInfo {
  mobile: boolean;
  dpr: number;
  cores: number;
}

export function initialTier(d: DeviceInfo): QualityTier {
  if (d.mobile) return d.cores >= 6 ? 'medium' : 'low';
  return d.cores >= 4 ? 'high' : 'medium';
}

export interface TierSettings {
  shadows: boolean;
  maxDpr: number;
  capSegments: number;
  radialSegments: number;
  hatching: boolean;
}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  high: { shadows: true, maxDpr: 2, capSegments: 8, radialSegments: 18, hatching: true },
  medium: { shadows: false, maxDpr: 1.5, capSegments: 6, radialSegments: 14, hatching: true },
  low: { shadows: false, maxDpr: 1.25, capSegments: 4, radialSegments: 10, hatching: false },
};

/** 连续 3 秒平均帧率低于 45 就降一档；最低到 low */
export class FpsGovernor {
  private acc = 0;
  private frames = 0;

  constructor(
    private tier: QualityTier,
    private readonly onChange: (t: QualityTier) => void,
  ) {}

  sample(dtMs: number): void {
    this.acc += dtMs;
    this.frames += 1;
    if (this.acc < 3000) return;
    const fps = (this.frames * 1000) / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 45 && this.tier !== 'low') {
      this.tier = this.tier === 'high' ? 'medium' : 'low';
      this.onChange(this.tier);
    }
  }

  /** 暂停播放后重新计时，避免把空闲时间算进帧率 */
  reset(): void {
    this.acc = 0;
    this.frames = 0;
  }
}

export function detectDevice(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return {
    mobile: coarse || /Android|iPhone|iPad|Mobile/i.test(ua),
    dpr: typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
    cores: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4,
  };
}
