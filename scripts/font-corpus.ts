import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 保守覆盖全部源代码中的汉字与中文标点，也包含注释，避免遗漏运行时文案。 */
export function collectFontCharacters(root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')): string {
  const characters = new Set<string>();
  function visit(folder: string): void {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:ts|css|html)$/.test(entry.name)) {
        for (const character of readFileSync(path, 'utf8').match(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu) ?? []) characters.add(character);
      }
    }
  }
  visit(root);
  return [...characters].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join('');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify({ characters: collectFontCharacters() }));
}
