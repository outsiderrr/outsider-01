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
  it('模型时长、峰值、角度和承重不伪装成实测或通用训练目标', () => {
    for (const lang of ['zh', 'en'] as const) {
      const model = lang === 'zh' ? /模型/ : /model/i;
      expect(t(lang, 'cover.lead')).toMatch(model);
      expect(t(lang, 'cover.meta.duration')).toMatch(model);
      expect(t(lang, 'lab.real')).toMatch(model);
      expect(t(lang, 'lab.stageLabel')).toMatch(lang === 'zh' ? /不是精确动作标准/ : /not an exact technique standard/);
      for (const part of ['hips', 'trunk', 'arm', 'head']) expect(t(lang, `chain.steps.${part}.body`)).toMatch(model);
      for (const stroke of STROKES) {
        for (const stance of STANCES) expect(t(lang, `phases.detail.${stroke}.${stance}.backswing.detail`)).toMatch(model);
        expect(t(lang, `phases.detail.${stroke}.neutral.contact.detail`)).toMatch(model);
      }
      expect(t(lang, 'abstract.p3.body')).not.toMatch(/各占一半|half and half/i);
      expect(t(lang, 'stances.rows.semi.main')).not.toMatch(/各一半|half and half/i);
      expect(t(lang, 'abstract.p1.body')).not.toMatch(/每一节都比上一节|faster than the one before/i);
      expect(t(lang, 'conclusion.closing')).not.toMatch(/自然就会|open stance tends to follow/i);
    }
  });
});
