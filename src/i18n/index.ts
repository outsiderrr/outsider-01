import { en } from './en';
import { zh } from './zh';

export type Lang = 'zh' | 'en';
export type Dict = typeof zh;

const DICTS: Record<Lang, Dict> = { zh, en };

export function t(lang: Lang, path: string): string {
  const v = path
    .split('.')
    .reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), DICTS[lang]);
  if (typeof v !== 'string') throw new Error(`missing i18n key: ${lang}:${path}`);
  return v;
}
