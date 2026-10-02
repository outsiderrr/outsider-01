import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';
import { en } from '../src/i18n/en';
import { zh } from '../src/i18n/zh';
import { PHASES, STANCES, STROKES } from '../src/model/types';

const keys = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object'
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe('i18n', () => {
  it('中英文的键完全一致', () => {
    expect(keys(en).sort()).toEqual(keys(zh).sort());
  });
  it('每种击球 × 站位 × 阶段都有阶段名和要点', () => {
    for (const lang of ['zh', 'en'] as const) {
      for (const s of STROKES) for (const st of STANCES) for (const ph of PHASES) {
        expect(t(lang, `phase.${s}.${st}.${ph}.name`).length).toBeGreaterThan(0);
        expect(t(lang, `phase.${s}.${st}.${ph}.cue`).length).toBeGreaterThan(0);
      }
    }
  });
  it('缺键时报错', () => {
    expect(() => t('zh', 'nope.missing')).toThrow();
  });
});
