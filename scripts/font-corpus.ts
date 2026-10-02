import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'rolldown/utils';

/** 保留所有源码文字，仅排除确定不会显示的注释；不猜测运行时是否使用字符串。 */
export function withoutFontComments(source: string, filename: string): string {
  if (filename.endsWith('.ts')) {
    const parsed = parseSync(filename, source);
    if (parsed.errors.length) throw new Error(`字体文案源码无法解析：${filename}`);
    for (const comment of [...parsed.comments].sort((a, b) => b.start - a.start)) {
      source = source.slice(0, comment.start) + source.slice(comment.end);
    }
    return source;
  }
  if (!filename.endsWith('.css')) return source;
  let output = '', quote = '';
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      output += char;
      if (char === '\\') output += source[++index] ?? '';
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char; output += char;
    } else if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error(`字体样式注释未结束：${filename}`);
      index = end + 1;
    } else output += char;
  }
  return output;
}

export function collectFontCharacters(root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')): string {
  const characters = new Set<string>();
  function visit(folder: string): void {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:ts|css|html)$/.test(entry.name)) {
        const source = withoutFontComments(readFileSync(path, 'utf8'), path);
        for (const character of source.match(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu) ?? []) characters.add(character);
      }
    }
  }
  visit(root);
  return [...characters].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join('');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify({ characters: collectFontCharacters() }));
}
